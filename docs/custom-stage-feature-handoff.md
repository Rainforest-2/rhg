# 自作ステージ機能 引き継ぎ (codex 向け)

Claude Code が「自作ステージ = ステージ同士バトルの混成素材」機能のデータ／ランタイム基盤を実装・検証済み。
UI は追加実装済みだが **ブラウザ実機での視覚／モバイル／音声受け入れは未実施**。2026-07-04 の Codex 引き継ぎで、起動後 DOM セレクタの headless 確認、出撃前ガードの UI 結線、ビルダー操作時の全面再描画抑制、カード式アセット選択 UI、詳細条件 UI、確認プレビューは完了。以下の残タスクを引き継ぐこと。

## 完了済み・自動検証済み（回帰なし）

`node --test tests/*.test.mjs` = **59 pass / 0 fail**（既存48 + 新規11）、`npm run check`（safe suite）= OK。

### 新規モジュール `js/custom-stage/`（node 単体テスト可能・DOM非依存）
- `CustomStageSchema.js` — 自作ステージ(schemaVersion1)＋対戦config(schemaVersion2)の型・正規化。型付き参照 `{kind:'bcu'|'custom', id}` と、旧フラット文字列配列への **可逆エンコード**（`custom:<id>` / 素のBCU id）。フレーム単位: **1秒 = 60内部フレーム**（= BCU csvフレーム30fps × FRAME_MUL 2）。ローダ出力と一致するので同じ「8秒」記述で同時刻スポーン。
- `CustomStageStore.js` — `wanko.customStages.v1` の CRUD（作成/保存/複製/削除、正規化読み込み、best-effort書き込み）。
- `CustomStageBattleStore.js` — `wanko.customStageBattle.v1` の **v1→v2 冪等マイグレーション**。フラット配列を **唯一の真実(ground truth)** とし、型付き配列は派生ミラー（既存パッチがフラットのみ更新しても壊れない）。HPオプション(固定城HP/毎FPS減少/オートバリアブレイク)を保全。
- `CustomStageValidator.js` — 保存不可エラー／警告。**生ドラフト値**を検証（schema正規化は0→既定に補修するため）。
- `CustomStageReferenceResolver.js` — 型付き参照解決、削除済み自作の検出、`validateBattleLaunch`（出撃前ガード）。
- `CustomStageAdapter.js` — **中核**。自作ステージ→ `StageDefinitionLoader.parse` と同形の StageDefinition。`StageRuntime`→`buildStageEnemyUnitDefs`→`BcuStageSpawnRuntime` を **そのまま**通過（別戦闘系なし）。城HP条件 [min,max]% → BCU castle_0/castle_1。
- `CustomStageBoot.js` — 起動時マイグレーション。`js/boot/groups/uiPatches.js` 先頭で import 済み。

### ランタイム統合 `js/battle/BattleSceneCustomStageBattlePatch.js`（加算的）
- `loadStageState`: encoded ref を decode。`custom:*` は Adapter、それ以外は従来の `resolveStageSelection`+loader（**BCU経路不変**）。
- `init` override: **基準ステージが自作**なら `this.stageDefinitionLoader.load` を1回だけ差し替え、基準の背景/城/HP/戦場長/BGMを自作から供給（各side用ローダは別インスタンスなので無干渉）。削除済み基準は throw で停止。

### テスト
- `tests/custom-stage-foundation.test.mjs` — ref変換/秒⇄フレーム/マイグレーション冪等・HP保全・custom残存・フラット優先/Store CRUD/Validator/参照解決＋出撃ガード。
- `tests/custom-stage-runtime.test.mjs` — Adapter出力→実ランタイムで frame60 初回・count+respawn・城HPゲート・boss ゲートを検証。

## 実装済みだが **要ブラウザ受け入れQA** — `js/ui/FormationCustomStageBuilderPatch.js`

既存「カスタムステージ」画面(`.formation-custom-stage-battle`, level `custom-stage-battle`)に **加算的に**「自作ステージ」セクション＋ビルダー画面(level `custom-stage-builder`)を追加。既存パッチのラップ順・挙動は不変（prototype を additive wrap）。
- セクション: 新規作成 / 一覧カード(名前・敵数・更新日時・敵側追加/味方側追加/編集/複製/書き出し/削除) / JSON読み込み。
- ビルダー: タブ 基本 / 敵出現 / 確認。±ステッパー＋直接入力＋単位、秒⇄フレーム変換、背景/敵城/BGM/敵は実リポジトリ(`__BCU_DB__.backgrounds/castles/enemies`, musicCatalog)から検索つきカードで選択（DB未ロード時は空で degrade）。敵行の並べ替え(▲▼)・追加/削除、下書き自動保存、明示保存、保存/戻る/敵側・味方側追加、書き出し。
- 敵側/味方側追加は encoded `custom:<id>` を既存 `enemyStageIds/playerStageIds` に書き込み → 既に検証済みのランタイムへ流入。
- 2026-07-04 追記: ステッパーや入力の小変更では `renderStageSelector()` を呼ばず、値と dirty 表示だけを局所更新する。構造が変わる操作（タブ、詳細条件の開閉、敵行追加/削除/移動、チェックボックス）はビルダー本文だけを差し替える。Playwright smoke でステッパー 2 回操作後も render count が増えないことを確認済み。
- 2026-07-04 追記: 背景/敵城/BGM/敵の select を検索つきカードグリッドへ置換。Playwright smoke で背景検索、背景カード選択、敵検索、ステッパー 2 回操作のすべてで `renderStageSelector()` count が `3` のまま増えないこと、desktop/mobile とも横はみ出し 0 を確認済み。敵城カタログは実 DB の `castles.enemy.list()` を参照するよう修正。
- 2026-07-04 追記: 敵行の詳細条件 UI（城HP、撃破数、レイヤー、group）は実装済み。score 条件はランタイム未対応のため表示しない方針を維持。
- 2026-07-04 追記: 確認タブに軽量プレビュー（主要値カード + 出現タイムライン）を追加。これは設定確認用で、実戦闘レンダラや BCU 見た目受け入れではない。
- 2026-07-04 実サムネイル/戦場プレビュー実装（Claude Code）: 「IDしか出ずに何を選んだか分からない」問題を解消。
  - 新規 `js/custom-stage/CustomStageAssetCatalog.js`: 実戦闘と同じ semantic provider から背景/敵城/自軍城/敵アイコンの画像URLを遅延・キャッシュ解決。背景は `imgcut.imgcut` parts[0] で BG 部分を切り出し（アトラス生表示を回避、`StageBackgroundLoader` と同じ経路）。城は image.png 全体（`BcuCastleAssetLoader` と同じ）。敵は `getActorUiIconUrl('enemy:<id>')`→失敗時 `getActorIconUrl`。ダミー/フォールバック画像なし（未解決は「画像なし」表示）。
  - 新規 `js/custom-stage/CustomStagePreviewAudio.js`: 単一 HTMLAudioElement の BGM 試聴。`musicCatalog.resolveUrls` の実URL、`AudioSettings.getEffectiveBgmVolume` 尊重、別曲再生で前曲停止、ビルダー離脱/閉じる/出撃で `stopPreview()`。自動再生なし（再生ボタンのユーザー操作のみ→iOS制約適合）。再生不能な曲はピッカーに出さない。
  - `FormationCustomStageBuilderPatch.js`: 背景/敵城/敵ピッカーのカードに遅延サムネイル（IntersectionObserver、可視分だけ解決＝一括ロードしない）。敵出現カードのタイトルに選択敵アイコン。BGMピッカーは▶/■試聴＋選択カード。基本タブ/確認タブに「戦場プレビュー」（切り出し背景＋自軍城＋敵城＋戦場長/敵城HP/制限/BGM チップ）。
- Playwright 検証（1180×820 / 390×844、`tmp/verify-custom-stage-thumbs.mjs`）: 確認タブ戦場プレビューで背景/敵城/自軍城の実画像が解決、敵アイコン解決、横はみ出し0、BGM 再生→停止、console error 0。単体テスト 59 pass / safe check OK。
- 2026-07-05 UI品質修正（Claude Code）: 敵編集オーバーレイ（spawn modal）と各タブの ± ステッパーが崩壊していた問題を修正。原因は `css/style.css` の全体規則 `button{width:100%}` の打ち消し漏れで、stat カード内ステッパーの ± ボタンがカード全幅（139.5px）に膨張し入力欄と ＋ を枠外へ押し出していた。ステッパーを堅牢化（±ボタン 44px 固定・入力 flex 伸縮・44px タップ領域・native number spinner 除去）し、`.formation-custom-builder-body` / `.formation-custom-edit` の暗黙 grid 列を `minmax(0,1fr)` に固定して潜在していた本文横オーバーフロー（field 474px）を根治。狭幅では条件パネルの入れ子 2 列を縦積み化。iPad横/縦・スマホで横はみ出し0・console error 0・トグル/ステッパー実動作を Playwright で確認。単体テスト 60 pass / safe check は既存の `check-battle-music-and-zombie-killer`（本UI変更と無関係の別ファイル）のみ pre-existing FAIL。
- 2026-07-05 追記: runtime 未接続の設定を新規編集画面から外した。`timeLimitFrames` / `nonContinue` / `limits.maxMoney` / `limits.maxUnitSpawn` / `limits.globalCostMultiplier` / `limits.globalCooldownMultiplier` は schema 互換のため保持するが、現在の戦闘 runtime では実効しないため UI には出さない。

### codex がやるべき残タスク（優先順）
1. **完了: headless DOM確認**: 起動時パッチ後の実画面構造に対しセレクタ(`.formation-stage-list`, `.formation-custom-stage-battle`, `.formation-stage-dialog header strong`)が一致することを 2026-07-04 に Playwright で確認。自作ステージ fixture を storage に注入し、`カスタムステージ` 画面、自作セクション、`自作` バッジ、削除済み自作 ref の出撃前警告を確認済み。これは視覚／モバイル／音声の受け入れではない。
2. **完了: アセットピッカーの品質**: 検索つきカードグリッド＋実サムネイル（背景切り出し/敵城/敵アイコン、遅延ロード・キャッシュ）＋BGM試聴（再生/停止、画面遷移・出撃で停止、iOS制約）。残: 敵城静止プレビューのアニメ化や、背景サムネイルのさらなる仮想化は任意の追加改善。
3. **完了: 戦場プレビュー**: 背景（切り出し）＋自軍城＋敵城を実アセットで合成表示。BGM試聴あり。残（任意）: 城HPトリガーの戦場プレビュー上での視覚化。
4. **完了: 詳細条件UI**: 敵行の `data-custom-spawn-cond` で城HP/撃破数/レイヤーを折りたたみ編集できる。score / group 条件はランタイム未対応のため出さない方針。
5. **完了: モバイル/iPad viewport**: 1180×820 / 390×844 / 820×1500 で横スクロール0、ボタン44px級、プレビューは固定ダイアログ内スクロール。残（任意）: iPhone横向き等の追加実機確認。
6. **完了: 出撃前ガードのUI結線**: `FormationCustomStageBattleApplyHpConfigPatch` が Apply 直前に `validateBattleLaunch` を呼び、削除済み自作/未解決BCU/空side時にカスタムステージ画面へ戻し日本語表示する。`FormationCustomStageBattlePatch` 側の警告表示順も修正済み。
7. **一部完了: Playwright**: サムネイル/プレビュー/BGM/レイアウトの E2E は `tmp/verify-custom-stage-thumbs.mjs` で実施。残（任意）: 敵側/味方側/混成の実出撃→基準自作で背景反映→削除済み参照で停止までの通し E2E。

### 注意（回帰させないこと）
- フラット `enemyStageIds/playerStageIds` が真実。型付き配列で上書きしない（`deriveSideRefs` はフラット優先）。
- BCU単体戦闘・既存BCUステージ同士バトル・城HP固定・毎FPS減少・オートバリアブレイクは不変を保つこと。
- 別戦闘エンジン/別スポーナーを作らない。Adapter で正規化してから既存合成へ。
- 未対応BCU項目を推測実装しない。

#Claude Codeになげかけたげんぶん
Rainforest-2/rhg を実装対象にして、以下の「自作ステージ機能」を設計・実装・検証まで一回で完了させてください。計画だけを書いて止まらず、実際にコードを変更し、既存テストと追加テストを実行してください。

最重要方針

この機能の目的は、既存の「カスタムステージ = ステージ同士バトル」を拡張することです。

自作ステージは単独専用の出撃先ではありません。

既存BCUステージと同様に、ステージ同士バトルの「敵側ステージ」「味方側ステージ」へ混在登録できるステージ素材として扱ってください。

敵側:
- BCUステージ
- 自作ステージ
- BCU + 自作の混成
- 自作複数
味方側:
- BCUステージ
- 自作ステージ
- BCU + 自作の混成
- 自作複数

既存のステージ同士バトル、城HP固定、毎FPS城HP減少、オートバリアブレイク、BCUステージ選択、通常戦闘を壊してはいけません。

作業前に必ず確認すること

1. AGENTS.md と既存の設計資料を読む。
2. 現在の FormationEditor 本体ではなく、起動時に重なるUIパッチ後の実際の画面構造を確認する。
3. FormationCustomStageBattlePatch.js、HP関連パッチ、FormationEditorPerformancePatch.js、PreviewApp、BattleScene、既存のステージ同士バトル合成ランタイムを追跡する。
4. globalThis.__CUSTOM_STAGE_BATTLE_CONFIG__、getCustomStageBattleConfig()、既存設定が最終的に戦闘生成へ渡る経路を実コードで確認する。
5. 既存のBCUステージ定義ローダーと、ステージ同士バトルで敵出現行を合成している唯一の実行経路を特定する。
6. 実行経路が想定と違っても、以下の仕様を満たす最小かつ安全な統合点を選ぶ。

推測で別の戦闘系を新設したり、既存のステージ選択UIを平坦な一覧へ戻したりしないこと。

完成後の画面構造

現在の導線を維持する。

編成画面
  ↓ ステージ選択
カテゴリ一覧
  ↓ カスタムステージ
カスタムステージ画面
  ├─ ステージ同士バトル                 ← 既存機能。維持
  │   ├─ Custom ON / OFF
  │   ├─ 背景・長さ・城の基準
  │   ├─ 既存の特殊ルール
  │   ├─ 敵側ステージ
  │   └─ 味方側ステージ
  │
  ├─ 区切り
  │
  └─ 自作ステージ                        ← 今回追加
      ├─ ＋ 新しいステージを作る
      ├─ 保存済み自作ステージ一覧
      ├─ JSONを読み込む
      └─ JSONを書き出す

自作ステージ一覧の各カードには以下を置く。

自作ステージ名
背景サムネイル / 城サムネイル
敵数 / 最終更新日時
[敵側に追加] [味方側に追加]
[編集] [複製] [書き出し] [削除]

敵側・味方側の登録一覧では、BCUか自作かを見分けられるようにする。

BCU     日本編 第1章
自作    超わんこ大進撃

同一ステージを同じ側へ重複追加しない。ただし敵側と味方側の両方へ入れることは可能にする。

ステージ参照の統一

現在の文字列ID配列だけの保存を、種類付き参照へ移行する。

{
  kind: "bcu" | "custom",
  id: string
}

新しいカスタム対戦設定は以下の考え方にする。

{
  schemaVersion: 2,
  mode: "stage-vs-stage-multi",
  enabled: true,
  enemyStages: [
    { kind: "bcu", id: "..." },
    { kind: "custom", id: "..." }
  ],
  playerStages: [
    { kind: "bcu", id: "..." },
    { kind: "custom", id: "..." }
  ],
  baseSource: "enemy" | "player",
  fixedBaseHpEnabled: false,
  fixedBaseHpValue: 10000000,
  baseHpDrainEnabled: false,
  baseHpDrainPerFrame: 100,
  autoBarrierBreakEnabled: false,
  autoBarrierBreakMultiplier: 5
}

旧 wanko.customStageBattle.v1 の以下の値は必ず壊さず移行する。

enemyStageIds: ["..."]
playerStageIds: ["..."]

旧文字列IDはすべて、

{ kind: "bcu", id: oldId }

へ変換する。

移行は冪等にする。同じ端末で何度起動しても重複・消失・上書き事故が起きないこと。

既存の複数パッチが同じlocalStorageを直接読み書きしているなら、今回を機に共通Storeへ統一すること。保存競合や、片方のパッチが他方の設定を消す構造を残さないこと。

推奨構成:

js/custom-stage/
├─ CustomStageSchema.js
├─ CustomStageStore.js
├─ CustomStageBattleStore.js
├─ CustomStageValidator.js
├─ CustomStageAdapter.js
├─ CustomStageReferenceResolver.js
├─ CustomStageAssetCatalog.js
├─ CustomStagePreviewAudio.js
└─ CustomStagePreviewRenderer.js

名称は既存規約に合わせて調整してよいが、責務の分離は維持すること。

自作ステージ本体の仕様

素材はすべて既存BCU素材だけを使う。

使える:
- 現在rhgで解決できる既存敵
- 現在rhgで解決できる既存背景
- 現在rhgで解決できる既存敵城
- 現在rhgで再生できる既存BGM
使わない:
- 画像アップロード
- 音源アップロード
- 外部URL素材
- 自作アニメーション
- 自作ユニット

自作ステージは素材本体を持たず、既存アセットへの参照IDだけを保存する。

最低限、以下の情報を保存・実行可能にする。

{
  schemaVersion: 1,
  id: "custom-...",
  name: "新しいステージ",
  description: "",
  createdAt: number,
  updatedAt: number,
  battle: {
    stageLength: number,
    enemyBaseHp: number,
    maxEnemyCount: number,
    backgroundId: string | null,
    enemyCastleId: string | null,
    enemyCastleAnimBaseId: string | null,
    enemyCastleCannonId: string | null,
    musicId: string | number | null,
    bossMusicId: string | number | null,
    timeLimitFrames: number,
    nonContinue: boolean,
    bossGuard: boolean
  },
  spawns: [
    {
      id: "spawn-...",
      enemyId: string,
      count: number,
      hpMultiplier: number,
      attackMultiplier: number,
      boss: boolean,
      firstSpawn: {
        minFrames: number,
        maxFrames: number
      },
      respawn: {
        enabled: boolean,
        minFrames: number,
        maxFrames: number
      },
      conditions: {
        enemyBaseHp: {
          enabled: boolean,
          minPercent: number,
          maxPercent: number
        },
        killCount: {
          enabled: boolean,
          value: number
        },
        layer: {
          enabled: boolean,
          min: number,
          max: number
        },
        groupId: number,
        score: {
          enabled: boolean,
          value: number
        }
      }
    }
  ],
  limits: {
    maxMoney: number | null,
    maxUnitSpawn: number | null,
    globalCostMultiplier: number | null,
    globalCooldownMultiplier: number | null,
    rarityDeployLimit: object | null,
    bannedCatComboIds: string[],
    bannedOrbIds: string[]
  }
}

重要:

* UIで秒を入力させる場合でも、内部保存とランタイム変換はBCU互換のフレーム値を基準にする。
* 画面上では秒とフレームを分かりやすく表示する。
* 0.0秒、ランダム幅、再出現なし、条件なしを明確に扱えるようにする。
* 実装されていない設定をUIに置かない。
* UIに置いた設定は必ず実際の戦闘へ反映させる。
* BCUランタイムが既に処理できるStage/Spawn/Limit項目は、実コードを確認したうえで可能な限り編集対象へ含める。
* 未対応・根拠不明なBCU項目を勝手に推測実装しない。

自作ステージを混成戦闘へ流すルール

自作ステージを敵側へ登録した場合、その自作ステージの敵出現行は敵側として出現する。

自作ステージを味方側へ登録した場合、その自作ステージの敵出現行は味方側として出現する。

BCUステージと自作ステージは、最終的に同一の正規化済みステージ定義へ揃えてから、既存のステージ同士バトル合成ランタイムへ渡す。

StageRef
  ↓
BCU:
  既存StageDefinitionLoader
  ↓
自作:
  CustomStageStore
  → CustomStageAdapter
  ↓
共通の正規化済みStageDefinition
  ↓
既存の敵側・味方側ステージ合成処理
  ↓
既存BattleScene

自作ステージ専用の別BattleScene、別敵スポーナー、別攻撃処理を作らないこと。

戦場の共有設定は、現在の baseSource の意味を維持する。

敵側先頭ステージを基準
または
味方側先頭ステージを基準

基準ステージが自作ステージなら、その自作ステージの以下を使用する。

背景
敵城
敵城HP
戦場長
最大敵数
通常BGM
ボスBGM

基準でないステージは、原則として敵出現行の供給源とする。

複数ステージ由来の全体制限を適当に合算しない。既存のステージ同士バトルにおける基準ステージ・制限の実際の意味を確認し、それを自作ステージにも一貫して適用すること。

削除済み自作ステージ参照は自動置換しない。

削除済み自作ステージ

として表示し、Custom ONで出撃しようとしたらエラーとして止めること。

編集画面のUI要件

編集画面は「開発者向け管理画面」ではなく、現在のゲームUIと同じ世界観にすること。

既存の以下を視覚言語として引き継ぐ。

- にゃんこ風の丸い太字フォント
- 黒縁・暖色の押し込みボタン
- ステージ選択カード
- 現在のFormationEditorのカード、検索、グリッド、画面遷移
- 既存のモバイル・iPadレイアウト

無機質なHTMLフォーム、素のselect、細かすぎる数値入力、横スクロール必須の表、英語だらけの管理画面は禁止。

画面遷移

カスタムステージ画面
  ↓ ＋ 新しいステージを作る
自作ステージ編集
  ↓ 保存 / 戻る
カスタムステージ画面

編集画面の戻り先は通常カテゴリではなく、必ずカスタムステージ画面にする。

stageSelectorState = {
  level: "custom-stage-builder",
  customStageId: "custom-..."
}

戻る時:

stageSelectorState = {
  level: "custom-stage-battle"
}

編集画面のレイアウト

PC・iPad横向き

┌─────────────────────────────────────────────────────┐
│ ＜ カスタムステージ   [ステージ名]    保存済み  [保存] │
├───────────────────────────────┬─────────────────────┤
│ 基本・戦場 / 敵出現 / ルール  │ 実際の戦場プレビュー │
│                               │                     │
│ 現在のタブ内容                │ 背景・敵城・BGM      │
│                               │ 出現タイムライン     │
│                               │ 警告・確認結果       │
├───────────────────────────────┴─────────────────────┤
│ [敵側に追加] [味方側に追加] [複製] [書き出し]         │
└─────────────────────────────────────────────────────┘

右側プレビューは編集内容に即時追従する。ただし入力ごとに重い素材を再ロードしたり、画面全体を再描画したりしないこと。

iPad縦向き・スマホ

ヘッダー
タブ
編集内容
プレビューを開く
保存・敵側に追加・味方側に追加

プレビューは折りたたみ式またはボトムシートにし、常に現在の背景・城・BGM・敵数・警告が確認できるようにする。

タップ領域は原則44px以上。数値入力は小さなinputだけにせず、±ステッパー、直接入力、単位表示を組み合わせる。

編集タブ

1. 基本・戦場
2. 敵出現
3. 確認

1. 基本・戦場

ステージ名
説明
背景
敵城
敵城HP
戦場の長さ
最大敵数
通常BGM
ボスBGM
ボスガード

背景、城、BGMは「ID入力」で選ばせないこと。

背景選択

背景選択はカードグリッド形式にする。

[実際の背景サムネイル]
背景名または見やすい識別名

* 実際に戦闘で使う背景解決経路を利用する。
* 選択中背景を大きくプレビューする。
* 全背景を初期に一斉ロードしない。
* FormationEditorと同様に仮想化・遅延ロード・キャッシュを使う。
* 取得失敗した背景は選択肢に残さず、診断可能な形で除外する。

敵城選択

敵城もカードグリッド形式にする。

[実際の敵城プレビュー]
城の名称または識別名

* 実際の BcuCastleAssetLoader 相当の解決経路を使う。
* 単なる番号・プレースホルダではなく、実際の城画像を見て選べること。
* 選択中の城は戦場プレビュー内で背景と組み合わせて確認できること。
* 重いアニメーション全再生は避け、必要なら静止プレビューまたは軽量な短いプレビューにする。

BGM選択

BGMは必ず実際に聞いて選べるようにする。

BGMカード:
[再生/停止] 曲名またはBGM番号  再生中表示  選択ボタン

要件:

* 再生ボタンを押したBGMだけを再生する。
* 別BGMを再生したら前の曲は必ず停止する。
* BGM選択画面を閉じた時、編集画面を閉じた時、戦闘開始時は必ず停止する。
* 現在の音量設定を尊重する。
* 実際に戦闘で使うオーディオ解決経路・キャッシュ・再生エンジンを使う。
* 外部URLや仮音源を使わない。
* 曲名が取れない場合でも、見やすい BGM 012 のような表示を出す。
* IDは補助情報として小さく表示してよいが、主表示にしない。
* 再生不能な曲を選択肢へ出さない。
* 自動再生はしない。iOSのユーザー操作制約を守る。

2. 敵出現

敵出現は、単なる巨大なCSV表にしない。

敵出現
[＋ 敵を追加]
┌─ 敵カード ───────────────────────┐
│ アイコン  敵名            [複製][削除] │
│ 数: 10    HP: 100%   攻撃: 100%        │
│ 初回: 0.0秒                         │
│ 再出現: 4.0〜8.0秒                  │
│ [詳細条件を開く]                    │
└──────────────────────────────────┘

敵カードは上下移動ボタンで並べ替え可能にする。タッチ環境で不安定なドラッグだけに依存しないこと。

敵追加時は、編成画面と同じ感覚で選べる敵選択画面を開く。

敵を選ぶ
├─ 検索
├─ カテゴリ・フィルタ
├─ 仮想化されたカードグリッド
├─ 実際の敵アイコン
├─ 敵名
└─ 選択

要件:

* FormationEditorのカード、検索、仮想化、アイコン遅延読み込み、タッチ操作の知見を再利用する。
* ただし編成保存を触らない。
* 敵選択用の実在するBCU敵カタログを使う。
* raw IDやファイル名だけの選択UIにしない。
* 選択後、すぐ敵出現カードへ戻る。
* 選択済みの敵は大きいアイコン・名前・基本倍率で分かるようにする。

敵出現の基本入力:

敵
出現数
HP倍率
攻撃倍率
ボス扱い
初回出現時間
再出現の有無
再出現時間の最小・最大

詳細条件は折りたたみにする。

敵城HP条件
撃破数条件
レイヤー条件

group / score 条件は、現在の自作ステージ runtime が対応するまで表示しない。

条件が有効な時は、カード上部に短い要約チップを出す。

城HP 70%以下
20体撃破後

同時に右側プレビューでは、時間軸と城HPトリガーを見える化する。

0秒 ─ わんこ
8秒 ─ わんこ
20秒 ─ 師匠
城HP 70% ─ イノシャシ

3. 確認

ここで全体を一画面に要約する。

背景 / 城 / BGM
敵出現数
最初の出現
ボス
城HPトリガー
制限
警告
エラー

保存・敵側追加・味方側追加はここからも可能にする。

プレビューの仕様

プレビューは装飾ではなく、実際の選択結果を確認する手段にする。

戦場プレビュー

最低限、以下を同時に確認可能にする。

選択中背景
プレイヤー城
選択中敵城
戦場長
敵城HP
通常BGM / ボスBGM

背景と敵城は、実際のランタイムで使うアセットを使う。

フルBattleSceneを毎回初期化してプレビューする必要はない。軽量な専用プレビューを作ってよい。ただし、見た目だけ別素材・別パスを使うことは禁止。

敵出現プレビュー

敵出現タブでは以下を表示する。

時間軸
初回出現
再出現範囲
ボス
城HP条件
撃破数条件
合計出現数

無限再出現や条件付き出現は、誤解を招かない表示にする。

バリデーション

以下は保存不可エラーにする。

ステージ名が空
背景が未解決
敵城が未解決
BGMが未解決
戦場長が0以下
敵城HPが0以下
最大敵数が0以下
敵が未解決
敵出現数が0以下
HP倍率または攻撃倍率が0以下
初回出現時間の最小 > 最大
再出現時間の最小 > 最大
壊れた自作ステージJSON

以下は保存可能だが、目立つ警告にする。

敵が0体
BGM未設定
再出現条件が極端
敵最大数が小さく、出現待ちが起きやすい
条件が到達不能の可能性

ステージ同士バトルの出撃直前には以下も検証する。

敵側が空
味方側が空
削除済み自作ステージ参照
BCUステージが解決不能
自作ステージが破損
基準ステージが解決不能

エラー時は、カスタムステージ画面へ戻して該当行へスクロールし、原因を日本語で表示する。

保存・編集体験

* 編集中は「未保存」「保存済み」「エラーあり」を明確に表示する。
* 入力中の内容は安全に下書き保持する。画面を閉じても意図せず消えないようにする。
* ただし明示的な「保存」操作も残し、保存成功を視覚的に示す。
* 複製は新しいIDを生成し、名前に「のコピー」を付ける。
* 削除は確認を出す。
* 削除しても敵側・味方側の参照を別ステージへ勝手に置換しない。
* JSONインポートは構造・バージョン・アセット参照を検証してから取り込む。
* JSONインポートは原則新しいIDを振る。既存ステージの上書きは明示操作の時だけ許可する。
* エクスポートJSONに外部アセットは含めない。

UI品質・操作性の絶対条件

1. 現在のゲームの見た目から浮かないこと。
2. 既存のFormationEditor、ステージ選択、にゃんこ風カードUIのデザイン言語を再利用すること。
3. PC、iPad横向き、iPad縦向き、スマホ縦向きで破綻しないこと。
4. 小さなタップ対象を作らないこと。
5. 横スクロールが必要な巨大テーブルを作らないこと。
6. 生の内部ID、BCU CSV名、semantic keyを主UIに出さないこと。
7. 長いアセット一覧を全件一括描画・一括画像ロード・一括音声ロードしないこと。
8. 編集のたびにオーバーレイ全体を再描画して、スクロール位置・入力フォーカス・音楽再生状態を失わないこと。
9. iOS Safariの音声再生制約、スクロール、キーボード表示を考慮すること。
10. innerHTML にユーザー入力や名称を入れる箇所は、既存のエスケープ方針を守ること。

実装の制約

* BCU通常ステージの選択・読込・戦闘を壊さない。
* Custom ONが無効なら、既存の単一ステージ戦闘は完全に従来通り動くこと。
* Custom ON時でも、BCUだけの既存ステージ同士バトルを従来通り動かすこと。
* 自作ステージだけ別の戦闘エンジンで動かさない。
* 既存のsemantic asset provider、音声エンジン、背景ローダー、城ローダー、敵テンプレートローダーを優先して再利用する。
* 存在しないアセットをフォールバック画像・ダミーBGMでごまかさない。
* 実装根拠のないBCU仕様を推測しない。
* 既存パッチのラップ順序を壊さない。
* 必要なら既存のカスタムステージ関連パッチを整理・統合してよい。ただし既存機能を回帰させない。
* UI用CSSは巨大なJS内style文字列へ無秩序に追加せず、既存のCSS構成と読み込み順を尊重して整理する。

実装後に必ず行う検証

少なくとも以下を自動または実動で確認すること。

1. 旧v1カスタム設定をv2へ移行しても、既存BCUステージ同士バトルが成立する。
2. 自作ステージを新規作成できる。
   - 背景選択が実サムネイルで確認できる
   - 敵城選択が実プレビューで確認できる
   - BGMを実際に再生・停止できる
   - 敵を編成画面と同系統のカードUIで選べる
3. 保存後、再読み込みしても自作ステージが残る。
4. 自作ステージを敵側へ追加できる。
5. 自作ステージを味方側へ追加できる。
6. BCU + 自作の混成を敵側・味方側で実行できる。
7. 自作 + 自作の混成を実行できる。
8. 基準ステージが自作の場合、背景・城・BGM・戦場長が自作設定になる。
9. 削除済み自作ステージ参照は出撃を止め、理由を表示する。
10. Custom OFF時、通常BCUステージ出撃に影響がない。
11. BGMプレビューが画面遷移・閉じる・戦闘開始で停止する。
12. iPad相当の横向き・縦向きviewportで、
    - 操作ボタンが押せる
    - 横にはみ出さない
    - スクロール不能にならない
    - キーボードで主要入力が隠れない

必要なunit test、Playwright test、既存テストを実行すること。失敗したテストを無視しないこと。

完了報告に含めること

実装後は以下を短く明確に報告すること。

- 実装した機能
- 変更したファイル
- 保存形式と移行内容
- 戦闘ランタイムへの統合点
- UI上の操作手順
- 実行したテストと結果
- 残っている制約があれば、その理由

質問で止めず、現行コードを読んで最善の実装判断を行ってください。
