# RHG キャラクター改造機能 完全実装計画書

- 対象リポジトリ: `Rainforest-2/rhg`
- 作成日: 2026-07-23
- 基準資料: `RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`
- 対象範囲: 編成キャラクター改造、カスタムステージ敵個別改造、保存、JSON export/import、runtime反映、レスポンシブUI、検証
- 仕様状態: **実装判断に必要な定義は本書で確定済み。未決事項なし**

---

## 1. 結論

本機能は、BCU元データそのものを書き換える編集機能ではない。

通常のレベル、＋値、本能、お宝、コンボ、敵倍率などをすべて解決した後の**実戦用キャラクター設定**に対し、ユーザーが指定した項目だけを絶対値で上書きする機能として実装する。

上書きされた項目は、その後レベル、＋値、倍率、本能、ステージ倍率などを変更しても値を再計算しない。ユーザーが入力した改造値を維持する。上書きしていない項目だけが通常どおり再計算される。

```text
BCU元データ
  ↓
通常のレベル・倍率・本能・お宝・コンボ・ステージ補正
  ↓
通常の最終キャラクター設定
  ↓
CharacterModificationResolverによる項目単位の絶対値上書き
  ↓
派生モデル再構築
  ↓
ゲーム内で使用する改造後キャラクター
```

この方式により、例えばLv50時に最終体力30万のキャラを50万へ改造した場合、後からLv60へ変更しても体力は50万のまま固定される。攻撃力だけ未改造なら、攻撃力はLv60に合わせて通常どおり再計算される。

---

## 2. 本書で確定する重要定義

### 2.1 「表示する最終値」

編集画面で表示する元の値は、生CSV値ではなく、現在の編集コンテキストで通常計算された最終設定値とする。

編成キャラクターでは、少なくとも以下を反映する。

- レベル
- ＋値
- 本能
- お宝
- にゃんコンボ
- 現在装備している本能玉の設定
- ワンコ側キャラクター倍率
- 現行runtimeが構築時に適用しているその他のキャラクター補正

カスタムステージの敵では、少なくとも以下を反映する。

- 敵のBCU基礎値
- その出現行のHP倍率
- その出現行の攻撃倍率
- ステージ側で適用される敵構築時補正

### 2.2 「最終値」に含まれないもの

次はキャラクター設定値ではなく、戦闘中の相手・状態・時点に依存するため、編集画面の「最終攻撃力」には含めない。

- 攻撃対象の属性による超ダメージ、めっぽう強い等の最終与ダメージ
- クリティカル発生時だけの与ダメージ
- メタルへのダメージ制限
- 攻撃力低下、呪い、強化、バーサーク等の戦闘中一時状態
- 城、バリア、悪魔シールド等、攻撃対象固有の受け側処理
- ランダム発動能力の実際の発動結果

したがって、攻撃値の改造対象は**各hitが持つ対象依存処理前の公称ダメージ**である。その値を固定したうえで、クリティカル、属性倍率、状態異常などの通常戦闘ロジックは引き続き適用する。

### 2.3 固定は項目単位

改造の有無はキャラクター全体ではなくフィールド単位で判定する。

```text
体力: 改造あり → 固定
攻撃1ダメージ: 改造あり → 固定
速度: 改造なし → レベルや倍率に合わせて再計算
再生産: 改造なし → 通常計算
波動: 改造あり → 改造設定を使用
```

### 2.4 リセットの意味

- 項目リセット: その項目のoverrideを削除し、現在の条件から通常最終値を再計算する。
- カテゴリリセット: そのカテゴリ配下のoverrideだけを削除する。
- 全改造リセット: 改造データを削除する。レベル、本能、本能玉、倍率など既存設定は消さない。
- 既存の「個別Lv/本能/本能玉解除」と「改造解除」は別操作にする。

### 2.5 保存確定タイミング

編成画面:

- オーバーレイを開いた時点でdraftを生成する。
- 入力中は永続化しない。
- 「決定」で`FormationStore`へ保存する。
- ×、背景タップ、戻る操作ではdraftを破棄する。
- 未保存変更がある場合は確認を出す。

カスタムステージ:

- 敵個別モーダル内の「完了」でステージ編集中draftへ反映する。
- この時点では`CustomStageStore`へ永続化しない。
- ステージ全体の「保存」で初めて永続化する。
- ステージ編集を破棄した場合、敵改造も一緒に破棄する。

### 2.6 保存単位

- 編成側の味方・プレイヤー側ワンコ: **キャラクター形態ID単位**
- カスタムステージ側の敵: **spawn row単位**
- 同じ敵IDでも異なるspawn rowなら別改造を持てる。
- 同一改造内容はexport時に共通modificationへdedupeできる。
- 公式BCUステージの元データは変更しない。

### 2.7 形態単位

第一形態、第二形態、第三形態などは別の`characterId`として扱い、改造を共有しない。形態変更時に自動継承しない。

### 2.8 召喚・精霊・生成物への継承

親キャラクターの改造を、召喚された別エンティティへ暗黙に継承しない。

- 召喚能力の確率、位置、倍率、対象ID等は親側の召喚procとして編集可能。
- 召喚先キャラクター自体の能力・体力・攻撃力は召喚先の定義を使用する。
- 将来、召喚先modificationを指定する場合は明示的な`spawnModification`参照として追加する。
- 再帰参照は禁止する。

### 2.9 runtime未対応項目

UIに表示する能力は、`CharacterModificationFieldRegistry`が次の状態を持つ。

- `editable`: runtimeまで安全に反映できる。
- `readOnly`: 現在値は表示できるが、runtime適用が未完成。
- `hidden`: データ解釈も未確定。

readOnly項目を編集可能に見せて保存することは禁止する。改造機能の完成条件は、現行runtimeが正式対応している戦闘機能をすべてregistryへ登録することである。

---

## 3. 目的

### 3.1 主目的

1. レベル・倍率反映後の実戦値を確認できる。
2. 体力、攻撃、再生産、射程、速度、能力などを項目単位で改造できる。
3. 改造値は絶対値として固定される。
4. 編成画面とカスタムステージで同一の改造エンジンを利用する。
5. 画面幅・向き・safe-areaが異なる端末でもUIを破壊しない。
6. JSON export/importで改造内容を保持する。
7. JSONは差分保存、共通化、空値除去によって肥大化を抑える。
8. 元データ、通常計算値、改造値、ゲーム内使用値の境界を明確にする。

### 3.2 非目的

- `.png`、`.imgcut`、`.mamodel`、`.maanim`の編集
- アニメーションフレームそのものの変更
- BGM、SE、ボイス素材の編集
- BCU公式データファイルの上書き
- 公式BCUステージの恒久改変
- 対象ごとの実ダメージを直接固定するチート式damage override
- 戦闘中に既に出撃しているactorのホット編集
- replay互換性の新規実装

改造は次回spawn・次回battle開始時に反映する。戦闘中の既存actorへ後付けしない。

---

## 4. 現行コードへの適合方針

現行には次の基盤がある。

- `FormationEditorBcuUnitLevelPatch`: レベル、＋値、本能、本能玉、ワンコ倍率のdraft・overlay・保存
- `FormationCharacterTuningMobileLandscapePatch`: スマホ横画面用の調整overlayレイアウト
- `FormationCustomStageBuilderPatch`: カスタムステージ作成と敵個別モーダル
- `CustomStageSchema -> Store -> Validator -> Adapter -> BattleScene`の流れ
- `BattleSceneBcuUnitLevelPatch`: 編成設定をproduction用unit definitionへ注入
- `BattleActorFactory`: 通常補正後のstatsからactor templateを作成
- `BattleAttackProfile`: attackHits、攻撃時間、範囲、procをruntime profileへ変換
- `FormationStore`: 編成単位の永続化

したがって、新規機能は既存overlayを置き換えず、共通エディタを抽出して既存導線へ組み込む。

---

## 5. アーキテクチャ

### 5.1 新規モジュール

```text
js/character-modification/
├─ CharacterModificationSchema.js
├─ CharacterModificationFieldRegistry.js
├─ CharacterModificationNormalizer.js
├─ CharacterModificationValidator.js
├─ CharacterModificationResolver.js
├─ CharacterModificationDerivedModel.js
├─ CharacterModificationCodec.js
├─ CharacterModificationHash.js
├─ CharacterModificationMigration.js
└─ CharacterModificationDiagnostics.js

js/ui/character-modification/
├─ CharacterModificationEditor.js
├─ CharacterModificationOverlayHost.js
├─ CharacterModificationRenderer.js
├─ CharacterModificationDraft.js
├─ CharacterModificationResponsive.css.js
└─ CharacterModificationAccessibility.js

js/custom-stage/
└─ CustomStageCharacterModificationAdapter.js
```

### 5.2 責務

#### CharacterModificationSchema

- 内部schema version
- 正式フィールド名
- 保存可能な型
- 省略可能フィールド
- formationとcustom stageで共通のmodification shape

#### CharacterModificationFieldRegistry

各編集項目の唯一の定義元とする。

```js
{
  id: 'procs.wave',
  category: 'attackEffects',
  label: '波動',
  support: ['unit', 'enemy'],
  status: 'editable',
  editor: 'structured',
  fields: [
    { id: 'enabled', type: 'boolean' },
    { id: 'chance', type: 'percent', min: 0, max: 100 },
    { id: 'level', type: 'integer', min: 1, max: 1000 }
  ],
  normalize,
  validate,
  apply,
  rebuild: ['combatModel', 'attackProfile', 'projectileRuntime']
}
```

UI、validator、codec、resolverが別々にフィールド一覧を持つことは禁止する。

#### CharacterModificationResolver

- 通常最終値と改造差分を受け取る。
- 差分があるフィールドだけ絶対値で上書きする。
- 元のstatsをmutationしない。
- 適用結果にprovenanceを付ける。

#### CharacterModificationDerivedModel

override後に以下を再構築する。

- `attackHits`
- `attackCount`
- representative damage
- `bcuCombatModel`
- `bcuProc`
- `abilityModel`
- `abilities`
- `BattleAttackProfile`
- world単位へ変換した速度・射程・幅
- バリア、悪魔シールド、蘇生などの初期runtime state
- production cost/cooldown

#### CharacterModificationCodec

内部schemaとexport schemaを分離する。

- sparse encode
- default除去
- 空値除去
- modification dedupe
- canonical stringify
- import decode
- version migration

---

## 6. 内部データモデル

### 6.1 CharacterModification v1

```js
{
  schemaVersion: 1,

  stats: {
    maxHp: 500000,
    knockbacks: 4,
    speed: 12,
    detectionRange: 450,
    width: 30,
    layer: 0
  },

  production: {
    cost: 4500,
    respawnFrames: 900,
    deployLimit: 1
  },

  attackCycle: {
    tbaFrames: 180,
    postAttackFrames: 30,
    loopCount: 0
  },

  attacks: {
    hits: {
      "0": {
        damage: 65000,
        preFrames: 20,
        targetMode: "area",
        range: {
          type: "normal",
          min: 0,
          max: 450
        },
        abilityFlags: {},
        procs: {}
      }
    }
  },

  traits: [],
  abilityFlags: {},
  procs: {},
  lifecycle: {},
  summon: {}
}
```

### 6.2 sparse保存

未改造項目は保存しない。

```js
{
  schemaVersion: 1,
  stats: { maxHp: 500000 },
  procs: { wave: { enabled: true, chance: 100, level: 5 } }
}
```

以下はnormalizerが削除する。

- 空オブジェクト
- 空配列
- 未改造を表す`undefined`
- defaultと同じ補助値
- `enabled:false`で他の値が無意味なproc
- 重複したtrait
- 存在しないhit番号

### 6.3 formation保存位置

`FormationStore`のversionを更新し、optionsへ追加する。

```js
options: {
  ...,
  characterModifications: {
    "cat-unit-001-f": { ...sparseModification },
    "dog-enemy-002": { ...sparseModification }
  }
}
```

### 6.4 custom stage保存位置

`CUSTOM_STAGE_SCHEMA_VERSION`を2へ更新する。

```js
{
  schemaVersion: 2,
  modifications: {
    "m1": {
      schemaVersion: 1,
      stats: { maxHp: 500000 },
      procs: { wave: { enabled: true, chance: 100, level: 5 } }
    }
  },
  spawns: [
    {
      id: "spawn-...",
      enemyId: 317,
      hpMultiplier: 200,
      attackMultiplier: 150,
      modificationRef: "m1"
    }
  ]
}
```

内部編集中はrowへインラインdraftを持ってもよいが、保存・export前にcanonical hashでdedupeする。

### 6.5 modification ID

- content-derived canonical hashから生成する。
- 表示順やobject key順に依存しない。
- 同じ内容は同じID候補になる。
- collision時はsuffixを付ける。
- IDそのものをruntimeの意味に利用しない。

---

## 7. 改造適用順

### 7.1 味方ユニット

```text
BattleStatsLoaderによるBCU基礎stats
  ↓
レベル・＋値
  ↓
コンボ
  ↓
お宝
  ↓
本能
  ↓
通常の構築時補正
  ↓
CharacterModificationResolver
  ↓
DerivedModel再構築
  ↓
BattleActorFactory template
```

本能玉の対象依存damage補正は通常のdamage resolverで処理する。改造による公称攻撃値を入力として引き続き作用する。

### 7.2 プレイヤー側ワンコ

```text
BattleStatsLoader enemy基礎stats
  ↓
プレイヤー用ワンコ倍率
  ↓
CharacterModificationResolver
  ↓
DerivedModel再構築
```

### 7.3 カスタムステージ敵

```text
BattleStatsLoader enemy基礎stats
  ↓
spawn row HP倍率・攻撃倍率
  ↓
ステージ構築時補正
  ↓
CharacterModificationResolver
  ↓
DerivedModel再構築
```

HPや攻撃力を改造した後にspawn row倍率を変更しても、改造済みフィールドは固定値を維持する。未改造フィールドだけ倍率変更へ追従する。

### 7.4 production値

costとrespawnはactor statsとは別の所有者が存在するため、production pipelineにも最終override hookを置く。

```text
BCU価格・再生産
  ↓
レベル・本能・コンボ・お宝等の通常補正
  ↓
ステージのglobal cost/cooldown補正
  ↓
CharacterModification production override
  ↓
カード表示・出撃判定
```

改造されたcostとrespawnは固定する。ただし以下のステージルールは引き続き優先する。

- 出撃禁止
- レアリティ制限
- 最大出撃数
- キャラ重複禁止
- ステージ終了・pause等の出撃不能状態

---

## 8. 編集可能項目

registryを唯一の定義元とし、現行runtimeが正式対応するフィールドを網羅する。

### 8.1 基本性能

- 最大体力
- ノックバック数
- 移動速度
- 感知射程
- 当たり幅
- layer
- 属性・trait
- 城判定関連flag
- 対象属性flag

### 8.2 生産

味方、プレイヤー側ワンコで表示する。

- コスト
- 再生産時間
- 出撃上限
- production cardに表示される値

### 8.3 攻撃サイクル

- 攻撃回数
- 各hitのダメージ
- 各hitの発生時間
- TBA
- post attack
- loop
- 単体／範囲
- 基本射程
- 遠方範囲
- 全方位範囲
- 城攻撃可否
- hitごとのability/proc適用範囲

攻撃hit数を変更する場合は1～3を正式サポート範囲とする。追加hitは直前hitを複製せず、安全な0ダメージ・procなしの初期値で生成する。

### 8.4 攻撃能力

現行runtimeで対応済みのものをregistryへ登録する。

- クリティカル
- 渾身
- 波動
- 小波動
- 烈波
- 小烈波
- 爆波
- 死亡烈波
- 毒撃
- バリアブレイカー
- シールドブレイカー
- 基地関連能力
- counter系
- その他`BcuCombatModel`で正式に解釈・実行される攻撃能力

### 8.5 妨害

- ふっとばし
- 停止
- 遅くする
- 攻撃力低下
- 呪い
- 封印
- ワープ
- delay/lethargy系

各項目は、少なくとも以下の必要パラメータを持つ。

- enabled
- chance
- duration
- strengthまたはdistance
- 適用hit

### 8.6 防御・耐性

- バリア
- 悪魔シールド
- 生き残る
- 攻撃無効
- ダメージ軽減
- ダメージ上限
- 状態異常無効
- 波動・烈波等の無効／停止
- HP回復
- 属性耐性

### 8.7 ライフサイクル

- ゾンビ地中移動
- ゾンビ蘇生
- glass
- spirit
- summon
- death effectに伴うproc
- 復活回数
- 復活までの時間
- 復活HP

### 8.8 UIで扱わない項目

- animation asset IDの差し替え
- sprite scaleやmodel part
- raw CSVの未解明列
- renderer専用debug field
- runtime未実装proc

---

## 9. 値の単位と入力規則

### 9.1 基本規則

- 内部保存はruntimeが使用する正規単位。
- UIは人間が理解しやすい単位を表示する。
- 単位変換はfield registryの`toDisplay`/`fromDisplay`で行う。
- 全項目へ一律の30fps/60fps変換を行わない。

### 9.2 時間

- カスタムステージspawn時間は現行schemaどおり内部frameで保存し、UIは秒表示する。
- 再生産時間は既存`respawnFrames`の内部単位で保存する。
- 攻撃発生、TBA、post attackは現在のattack profileが採用するframe契約に従う。
- UIには秒表示とframe表示を併記する。
- 小数入力はregistryが定めた丸め方で整数frameへ変換する。

### 9.3 数値範囲

import時に黙って危険値へclampせず、エラーまたは明示警告にする。

基本上限:

- HP・ダメージ・コスト: `0..2,147,483,647`、HPのみ最低1
- ノックバック数: `1..1,000,000`
- 速度・射程・幅: registry固有の安全範囲
- probability: `0..100`
- magnification: `0..999900`
- wave/surge等level: `1..1000`
- frame: `0..10,800,000`
- attack hit数: `1..3`

0に意味がある項目と、0が無効化を意味する項目はregistryで区別する。

---

## 10. UI計画

### 10.1 編成画面

既存のレベル調整overlayを共通overlay shellへ拡張する。

```text
キャラクター調整
├─ 育成
│  ├─ レベル
│  ├─ ＋値
│  ├─ 本能
│  └─ 本能玉
└─ 改造
   ├─ 基本性能
   ├─ 攻撃
   ├─ 生産
   ├─ 特殊能力
   ├─ 妨害
   ├─ 防御・耐性
   └─ ライフサイクル
```

レベル変更領域の下に明示的な「改造」ボタンを追加する。長押し導線は維持するが、改造機能への唯一の入口にはしない。

### 10.2 カスタムステージ

既存の敵個別設定モーダルへ「キャラ改造」ボタンを追加する。

二重fixed overlayは作らず、同じmodal host内で画面stateを切り替える。

```text
敵個別設定
  ↓ キャラ改造
改造エディタ
  ↓ 戻る
敵個別設定
```

これによりiOS/Androidのscroll lock、focus、software keyboard、safe-area、z-index競合を避ける。

### 10.3 エディタ上部

常に以下を表示する。

- キャラアイコン
- キャラ名
- 形態
- 現在レベルまたは敵倍率
- 改造項目数
- 通常最終値
- 改造後値

例:

```text
体力       302,500 → 500,000  改造済み
攻撃1       48,200 → 65,000   改造済み
移動速度        12             通常
```

### 10.4 大量項目への対策

- category tab
- accordion
- 項目検索
- 「変更済みのみ」filter
- 「現在持っている能力」filter
- 「追加可能な能力」一覧
- active categoryだけDOM生成
- 長いproc一覧の遅延render
- scroll位置保持
- focus/caret保持

### 10.5 編集操作

- 直接数値入力
- ±stepper
- 長押し連続増減
- switch
- native select
- hit選択
- 項目単位リセット
- カテゴリリセット
- 全改造リセット
- session内undo/redo
- 変更前後差分表示

### 10.6 responsive要件

- 320 CSS px以上
- iPhone縦
- iPhone横
- iPad mini横
- iPad縦
- Android低height横画面
- desktop
- `100dvh`
- safe-area inset
- software keyboard表示
- `prefers-reduced-motion`
- 文字拡大

横スクロールは発生させない。狭い画面では左heroを縮小し、カテゴリと入力領域を縦積みにする。

### 10.7 accessibility

- 全入力にlabel
- buttonは`type=button`
- overlayはdialog semantics
- focus trap
- ESC/戻る処理
- close後に起点ボタンへfocus復帰
- `aria-live`で保存、エラー、改造数を通知
- switchはnative checkbox
- 色だけで改造状態を示さない

---

## 11. runtime実装

### 11.1 unit definitionへの注入

`BattleSceneBcuUnitLevelPatch`相当のproduction解決時に、formationから該当character modificationを取得し、unit definitionへ次を追加する。

```js
{
  characterModification,
  characterModificationHash,
  characterModificationSource
}
```

カスタムステージ側は`CustomStageCharacterModificationAdapter`がspawn rowの`modificationRef`を解決し、enemy unit definitionへ同じshapeで渡す。

### 11.2 BattleActorFactory

`resolveTemplateStats()`の通常補正完了後にresolverを呼ぶ。

```js
let stats = resolveNormalStats(...);
stats = applyCharacterModification(stats, unitDef.characterModification, context);
stats = rebuildModifiedDerivedModels(stats, context);
```

### 11.3 template cache

現在のtemplate cacheが改造前statsを再利用しないよう、cache identityへmodification hashを含める。

```text
templateIdentity = slotId + modificationHash + loadLevel + animationIds
```

またはtemplate object内に`statsRevision`を保持し、hash不一致時だけstatsを再構築する。

必須条件:

- 同じキャラ・同じ改造は共有可能。
- 同じキャラ・異なる改造は共有しない。
- animation assetは共有してよい。
- statsとattack profileだけを安全に分離できる設計を優先する。

### 11.4 derived modelの再生成

単純なobject上書きだけで終わらせない。

改造後に必ず整合させる。

- `damage`と`attackHits[0].damage`
- `attackCount`とhit map
- `bcuCombatModel.proc`
- `bcuProc`
- `abilityModel`
- `abilities.proc`
- LD/omniのrange
- wave/surge/blast container生成条件
- barrier/shield初期HP
- revive/burrow/summon manager設定
- actorのcollision/range/speed world値
- `BattleAttackProfile`

### 11.5 provenance

改造後statsへ追跡情報を付ける。

```js
stats.characterModificationDebug = {
  schemaVersion: 1,
  source: 'formation' | 'custom-stage',
  modificationHash,
  appliedFields: [],
  normalFinalValues: {},
  modifiedFinalValues: {},
  warnings: []
};
```

production buildでは巨大な全field debugを恒常生成せず、必要最小限またはdebug有効時だけ保持する。

---

## 12. ability/procの整合性規則

### 12.1 enabled

- `enabled:false`はその能力を完全に除去する。
- `enabled:true`で必須パラメータ不足なら保存不可。
- chance 0は原則disabledへ正規化する。ただしBCU上0に別意味があるprocはregistryで例外化する。

### 12.2 hit単位

攻撃能力とprocは、可能な限りhitごとに設定する。

- 全hit共通設定
- hit固有override

の二層を許可し、hit固有を優先する。

### 12.3 range

- normal
- LD
- omni

を同時に矛盾した状態で保存しない。range editorはtypeを一つ選び、必要なmin/max/start/endだけを表示する。

### 12.4 ability依存

例:

- 波動ONならlevel必須
- 烈波ONならlevel、発生範囲、持続条件必須
- revive ONなら回数、時間、HP必須
- burrow ONなら距離・回数必須
- demon shield ONなら初期HP・再生条件を検証
- summon ONなら対象IDと倍率を検証

依存関係はUIに直書きせずregistryで定義する。

### 12.5 無効化時の残骸除去

能力をOFFにしたら、runtimeで参照される関連フィールドをnormalizerが除去する。古いlevelやdurationが残って再有効化される事故を防ぐ。

---

## 13. JSON export/import

### 13.1 export種類

1. カスタムステージexport
   - stage本体
   - 参照中のmodification
   - schema version

2. キャラクター改造パックexport
   - 編成とは独立して改造だけ共有可能
   - characterIdとmodification
   - 名前、説明は任意

3. 編成全体export
   - 将来または既存formation exportがある場合、そのoptionsへ改造を含める

### 13.2 export envelope

```js
{
  type: "rhg-custom-stage",
  version: 2,
  stage: { ... },
  modifications: { ... }
}
```

または改造パック:

```js
{
  type: "rhg-character-modification-pack",
  version: 1,
  entries: [
    { characterId: "cat-unit-001-f", modificationRef: "m1" }
  ],
  modifications: {
    "m1": { ... }
  }
}
```

### 13.3 肥大化対策

- sparse field保存
- default省略
- null省略
- falseで無意味なproc省略
- 空配列・空object省略
- 同一modificationのhash dedupe
- stage内で未参照modificationを削除
- 標準exportはminified JSON
- 開発用のみpretty export
- 正式フィールド名は維持し、1文字keyへ難読化しない

サイズ削減は可読性を壊す短縮キーではなく、差分化とdedupeで行う。

### 13.4 import安全性

- JSON parse前にファイルサイズ確認
- 最大5 MiB
- 最大nest depth 12
- 最大spawn 1000
- 最大modification 500
- 最大object key数 10000
- `__proto__`、`prototype`、`constructor`を拒否
- unknown fieldは警告付きで破棄
- NaN、Infinity、文字列化された数値の不正形式を拒否
- 参照切れ`modificationRef`をエラー
- 循環・再帰召喚参照をエラー
- 全体validation成功後に一括commit
- 部分import禁止

### 13.5 import preview

適用前に表示する。

- 追加される改造数
- 上書きされるキャラ
- 変更フィールド数
- 警告
- schema migration内容
- 参照切れ・未対応能力

### 13.6 migration

- custom stage v1はmodificationなしとしてv2へ移行する。
- formation旧versionは空`characterModifications`を追加する。
- modification schema更新時は順次migration関数を通す。
- exportは常に最新schemaで行う。

---

## 14. エラー処理

### 14.1 保存不可エラー

- HP 0以下
- attack hitなし
- proc必須値不足
- range矛盾
- 参照先キャラ不明
- summon参照不明
- modificationRef切れ
- 数値上限超過
- schema version未知

### 14.2 警告

- runtime readOnly能力が含まれる
- 極端な速度・射程・frame
- 攻撃力0
- 再生産0
- 100%を超える特殊倍率
- performance負荷が高いwave/surge level

警告は保存可能、エラーは保存不可とする。

### 14.3 storage failure

現行storage diagnosticsへ統合する。

- localStorage unavailable
- quota exceeded
- corrupt JSON
- migration failure

UIは失敗を明示し、保存できたように見せない。

---

## 15. performance設計

- active categoryだけrender
- field registryは静的Object.freeze
- derived normal final valuesはdraft revision単位でmemoize
- modification hashは変更時だけ再計算
- iconは既存semantic asset queueを利用
- custom stage pickerと同様に大量候補をwindow化
- 全項目変更ごとにoverlay全体をinnerHTML再構築しない
- 数値入力中は対象readoutだけ更新
- scroll位置、focus、caretを維持
- templateのvisual assetはmodificationごとに複製しない
- stats/profileだけrevision分離

---

## 16. セキュリティと堅牢性

- imported label/nameはHTML escape
- field pathを任意文字列から直接objectへ書き込まない
- registryに存在するfield IDだけmutation可能
- prototype pollution対策
- deep recursive cloneを無制限に行わない
- `JSON.parse(JSON.stringify(...))`をruntime hot pathで使わない
- user dataから関数名、module path、asset URLを生成しない
- semantic asset strict modeを迂回しない

---

## 17. 変更予定ファイル

### 17.1 主要変更

- `js/battle/FormationStore.js`
- `js/ui/FormationEditorBcuUnitLevelPatch.js`
- `js/ui/FormationCharacterTuningMobileLandscapePatch.js`
- `js/ui/FormationCustomStageBuilderPatch.js`
- `js/custom-stage/CustomStageSchema.js`
- `js/custom-stage/CustomStageStore.js`
- `js/custom-stage/CustomStageValidator.js`
- `js/custom-stage/CustomStageAdapter.js`または対応adapter
- `js/battle/BattleSceneBcuUnitLevelPatch.js`
- `js/battle/BattleActorFactory.js`
- `js/battle/BattleAttackProfile.js`
- `js/battle/ProductionRuntime.js`
- UI/battle boot group installer

### 17.2 新規追加

本書5.1の`js/character-modification/*`と`js/ui/character-modification/*`。

### 17.3 原則変更しない

- BCU raw asset
- semantic bundle
- animation parser
- renderer core
- 19 phase tick order
- DamageCalculatorの既存順序

能力改造を動かすために必要な場合も、既存runtime ownerへ最小限の入力hookを追加し、tick順やdamage順を変更しない。

---

## 18. boot順

UI groupでは、既存レベルoverlay patchの後、mobile landscape patchとcustom stage builderの責務を壊さない位置に共通editorを導入する。

推奨:

```text
FormationEditorBcuUnitLevel
→ CharacterModificationEditor
→ FormationCharacterTuningMobileLandscape
→ FormationCustomStageBattle
→ FormationCustomStageBuilder
→ PremiumMotion(last)
```

battle groupでは、unit level・stage modifierがunit definitionへ注入された後、actor factoryがstatsを構築する直前までにmodification情報を渡す。

prototype wrapperを増やしすぎず、可能なら既存installer groupから明示的に呼ぶ。

---

## 19. テスト計画

### 19.1 schema/codec

- empty modification roundtrip
- sparse encode
- default除去
- dedupe
- canonical hash安定性
- key順序差で同hash
- unknown field除去
- prototype pollution拒否
- size/depth/count limit
- v1→v2 migration

### 19.2 resolver

- HPだけ固定
- damageだけ固定
- 未改造値はレベル変更へ追従
- 改造値はレベル変更後も固定
- 敵HP倍率変更後も改造HP固定
- hitごとのdamage
- ability ON/OFF
- proc parameter
- trait変更
- barrier/shield/revive初期値
- summon非継承

### 19.3 runtime

- normal attack
- multi-hit
- LD/omni
- wave/mini-wave
- surge/mini-surge/death surge
- blast
- proc apply
- immunity
- barrier
- demon shield
- zombie burrow/revive
- spirit/summon
- cost/cooldown
- template cache hash分離
- 同じasset・異なるmodificationの同時spawn

### 19.4 UI

- open/close/draft discard
- save
- field reset
- category reset
- all reset
- undo/redo
- search
- changed-only
- keyboard
- focus return
- iOS software keyboard
- scroll保持
- orientation change
- reduced motion

### 19.5 export/import

- stage export→削除→import→runtime同一
- modification pack roundtrip
- pretty/minified同値
- shared modification dedupe
- broken ref拒否
- unsupported field警告
- atomic import

### 19.6 推奨check script

```text
scripts/check-character-modification-schema.mjs
scripts/check-character-modification-codec.mjs
scripts/check-character-modification-resolver.mjs
scripts/check-character-modification-derived-model.mjs
scripts/check-character-modification-cache.mjs
scripts/check-character-modification-production.mjs
scripts/check-custom-stage-character-modification.mjs
scripts/check-formation-character-modification.mjs
scripts/check-character-modification-import-security.mjs
```

---

## 20. 実装フェーズ

### Phase 0: 事前固定

- current mainのcommitを固定
- 既存checkを全実行
- レベルoverlayとcustom stage modalの画面キャプチャ
- 現行formation/custom stage JSON fixtureを保存

### Phase 1: schema・registry・validator

- modification schema
- registry
- normalizer
- validation
- migration
- unit tests

完了条件: UI/runtimeなしでも任意modificationを安全にnormalize・validateできる。

### Phase 2: resolverと基本stats

対象:

- HP
- knockback
- speed
- range
- width
- damage
- attack timing
- cost
- respawn

完了条件: レベル・倍率変更後もoverrideフィールドだけ固定される。

### Phase 3: derived model

- multi-hit
- LD/omni
- traits
- ability flags
- attack profile rebuild
- cache identity

完了条件: stats object間に不整合がない。

### Phase 4: 編成UI

- 改造ボタン
- common overlay
- category UI
- final value comparison
- draft/save/reset
- responsive

### Phase 5: custom stage UI

- spawn modal内改造ボタン
- 同一modal hostで画面遷移
- stage draftへ適用
- schema v2
- adapter/runtime接続

### Phase 6: proc/lifecycle完全化

- 現行runtime対応能力をregistryへ網羅
- wave/surge/blast
- 妨害
- barrier/shield
- revive/burrow
- summon/spirit
- immunity/resistance

### Phase 7: JSON

- compact export
- modification pack
- import preview
- validation
- migration
- security limits

### Phase 8: 検証・受入

- node checks
- browser checks
- iPad/iPhone/Android/desktop
- performance
- visual acceptance
- docs更新

---

## 21. 完成受入基準

### 21.1 機能

- 編成キャラに改造ボタンがある。
- カスタムステージ敵個別設定に改造ボタンがある。
- 通常最終値と改造後値を確認できる。
- 改造済み値はレベル・倍率変更後も固定される。
- 未改造値は通常再計算される。
- HP、攻撃、速度、射程、KB、攻撃時間、cost、respawnを変更できる。
- 現行runtime対応の主要ability/procを変更できる。
- 改造なしの戦闘結果が変更前と一致する。

### 21.2 UI

- 320px幅で横overflowなし。
- iPad mini横で既存ゲームUIを破壊しない。
- phone landscapeの低heightで決定ボタンへ到達できる。
- modal二重化によるscroll/focus不具合がない。
- 100項目以上でも操作可能。

### 21.3 保存

- formation reload後も保持。
- custom stage reload後も保持。
- export/import後に完全復元。
- JSONが未改造の全BCU statsを複製しない。
- 同一modificationが重複保存されない。
- schema migrationが決定的。

### 21.4 runtime

- template cacheに古い改造が残らない。
- 同じキャラを異なる改造で同時に使用できる。
- attack/proc/derived modelが一致する。
- 改造なしのBCU互換経路を迂回しない。
- 19 phase tick順、damage順、renderer順を変更しない。

### 21.5 品質

- 全check成功。
- storage failureが可視化される。
- importがatomic。
- unknown/unsupported fieldがsilentに有効化されない。
- docsの現状と実装が一致する。

---

## 22. 完成後のドキュメント更新

- `README.md`
- `AGENTS.md`
- `docs/bcu-migration-status.md`
- `docs/ability-logic/current-ability-parity-status.md`
- `docs/ability-logic/bcu-ability-source-evidence.md`
- `RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`の後継版

追加する内容:

- modification適用順
- schema
- ownership
- registry
- JSON migration
- cache identity
- visual acceptance結果
- 未対応readOnly項目

---

## 23. 実装禁止事項

1. raw CSVを直接書き換える。
2. `stats.hp`だけを上書きし、関連modelを更新しない。
3. UI、validator、resolverへ別々のfield一覧を直書きする。
4. custom stage modalの上へ無関係なfixed overlayを重ねる。
5. modification hashをcache keyへ含めない。
6. 全BCU statsをJSONへ複製する。
7. keyを1文字化して保守性を失う。
8. importのunknown fieldをそのままruntimeへ渡す。
9. 改造なしの経路へ余計な補正を加える。
10. patch順を変えてdamage/proc/render順へ影響させる。
11. runtime未対応能力を編集可能と表示する。
12. 戦闘中の既存actorへ状態を破壊するホット更新を行う。

---

## 24. 最終仕様要約

- 表示値は通常計算後の最終キャラクター設定値。
- 改造値は絶対値。
- 改造値はレベル・倍率変更後も固定。
- 固定はフィールド単位。
- 相手依存・戦闘中一時状態は通常ロジックを維持。
- 編成では形態ID単位。
- custom stageではspawn row単位。
- 召喚先へ暗黙継承しない。
- 元BCUデータは不変。
- resolver適用後に派生モデルを再構築。
- template cacheをmodification hashで分離。
- UIは既存overlay/modalを共通hostへ拡張。
- JSONはsparse、dedupe、minified、versioned、atomic import。
- 現行runtime対応能力をregistryで網羅。
- 改造なしのゲーム挙動を完全に維持する。

以上を満たした時点を、キャラクター改造機能の完成とする。
