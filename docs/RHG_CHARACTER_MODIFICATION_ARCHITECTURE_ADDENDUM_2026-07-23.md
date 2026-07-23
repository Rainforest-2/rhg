# RHG キャラクター改造アーキテクチャ追補

- 日付: 2026-07-23
- 対象: `Rainforest-2/rhg`
- 基準設計: `RHG_CHARACTER_MODIFICATION_IMPLEMENTATION_PLAN_2026-07-23.md`
- 中核参照: `RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`

この文書は、2026-07-23 中核アーキテクチャ参照資料を上書きせず、キャラクター改造の実装後に追加された責務とデータ境界を記録する追補です。BCU の戦闘計算を置き換える機能ではなく、通常の BCU/RHG 設定解決後に RHG が明示的な絶対値上書きを適用する拡張です。

## 適用順

```text
BCU 元データ（読み取り専用）
-> レベル / ＋値 / 本能 / 本能玉 / お宝 / コンボ
-> 敵倍率 / ステージ補正 / 通常の生産補正
-> 通常の最終 stats
-> CharacterModificationResolver（指定フィールドだけ絶対値上書き）
-> CharacterModificationDerivedModel（派生モデルを新規 object として再構築）
-> BattleActorFactory / ProductionRuntime
-> 既存の対象依存 damage / proc / immunity / lifecycle 順序
```

改造済みフィールドは、後でレベルや敵倍率が変わっても入力値を維持します。未改造フィールドは、その時点の通常計算へ追従します。攻撃力は対象依存能力を適用する前の nominal damage であり、critical、超ダメージ、めっぽう強い、Metal、呪い、proc などの実ダメージ解決順は変更しません。

改造が空の場合、`BattleActorFactory.resolveTemplateStats` は通常 stats object をそのまま返します。raw CSV、BCU source object、公式ステージデータ、戦闘中の既存 actor は変更しません。変更は次の spawn または次の battle 開始から有効です。SUMMON 先には召喚元の改造を継承しません。

## モジュールと所有権

| 責務 | オーナー |
|---|---|
| schema / field metadata | `js/character-modification/CharacterModificationSchema.js`、`CharacterModificationFieldRegistry.js` |
| sparse normalization / validation / diagnostics | `CharacterModificationNormalizer.js`、`CharacterModificationValidator.js`、`CharacterModificationDiagnostics.js` |
| absolute override / provenance | `CharacterModificationResolver.js` |
| attack hits、combat/proc/ability、初期 lifecycle、world/production の再構築 | `CharacterModificationDerivedModel.js` |
| canonical representation / hash / dedupe | `CharacterModificationHash.js`、`CharacterModificationCodec.js` |
| version migration | `CharacterModificationMigration.js` |
| 共通 draft editor / dialog / responsive / accessibility | `js/ui/character-modification/*` |
| formation の形態別所有 | `FormationStore`、`FormationCharacterModificationPatch`、`BattleSceneBcuUnitLevelPatch` |
| custom stage の spawn-row 別所有 | `CustomStageSchema`、`CustomStageStore`、`CustomStageValidator`、`CustomStageCharacterModificationAdapter` |
| template 分離と actor 生成 | `BattleActorFactory` |

boot では `FormationEditorBcuUnitLevelPatch` の後、mobile landscape patch と custom-stage builder の既存順序を保った位置で `FormationCharacterModificationPatch` を導入します。`FormationPremiumMotionPatch` が最後という契約は維持します。custom stage の所有順も `Schema -> Store -> Validator -> Adapter -> BattleScene` のままです。19 phase tick、damage、proc、renderer の順序は変更しません。

## スキーマ

| データ | version | 所有場所 |
|---|---:|---|
| `CharacterModification` | 1 | sparse object。`schemaVersion` と変更した registry field だけ |
| formation | 5 | `options.characterModifications[characterId]`。character id は形態を含む |
| custom stage | 2 | `modifications` table と、各 `spawns[]` の `modificationRef` |
| character modification pack | 1 | `entries[]` と dedupe 済み `modifications` table |

formation は既存のレベル、＋値、本能、本能玉、お宝 draft と同じ character/form の文脈で編集します。editor の「保存」までは `CharacterModificationDraft` 内に留め、キャンセルでは破棄します。保存は `FormationStore` が validation 後に行い、読み書き失敗は既存 storage diagnostics と UI へ返します。

custom stage は敵 ID 全体ではなく spawn row が `modificationRef` を所有します。同じ敵 ID の複数行は別の改造を参照できます。stage modal 内の既存 host に共通 editor を埋め込み、stage 保存までは stage draft に留めます。canonicalization は同一内容を hash でまとめ、参照されない entry を削除します。

### Migration

- version のない `CharacterModification` は v0 として扱い、`stats.hp` を `stats.maxHp`、`attacks.damage` を `attacks.hits.0.damage` へ移し、v1 にします。
- formation v4 以前は `options.characterModifications = {}` を追加して v5 にします。
- custom stage v1 は空の `modifications` table を追加し、spawn row に古い不正な `modificationRef` を残さず v2 にします。
- raw custom-stage JSON と custom-stage export envelope v1 は、preview に migration diagnostics を出した後で v2 candidate にします。
- 未対応の将来 version は推測せず拒否します。

## Field Registry

`CharacterModificationFieldRegistry.js` が field id、category、label、unit/enemy、formation/custom-stage owner、editor/value type、min/max、normalization、validation、runtime apply、derived rebuild、依存関係、`editable` / `readOnly` を持つ唯一の定義元です。UI、normalizer、validator、resolver、codec は registry を参照し、独自の field list を持ちません。

主な editable 領域は次のとおりです。

- 最大体力、KB、速度、感知射程、当たり幅、layer
- formation のコスト、再生産時間、出撃上限
- TBA、攻撃回数、攻撃後待機
- 最大 3 hit の nominal damage、発生 frame、通常 / LD / omni range、単体 / 範囲、城を攻撃できるか
- traits と、runtime に接続済みの ability flag
- ふっとばし、停止、鈍足、弱体化、critical、波動 / 小波動、烈波 / 小烈波 / 死亡烈波、爆波、warp、curse、seal、toxic、各種耐性など registry 登録済み proc
- barrier、demon shield、revive、burrow、解決可能な SUMMON

wave と mini-wave、surge と mini-surge などの排他関係、LD/omni の端点、multi-hit の発生順、owner/kind、SUMMON target の同期解決を validator が検証します。能力を OFF にした場合、chance、level、duration などの従属値は normalizer と resolver が除去し、旧 proc の残骸を runtime へ渡しません。

現在明示的に `readOnly` / unsupported として表示する項目は次です。

- spirit: slot asset と production ownership を scalar override から再構築できない
- damage cut、damage cap、HP regeneration、ARMOR: 安定した runtime ownership が未確立
- raw ABI bitmask: CSV の内部表現を編集面にしない
- animation / semantic ZIP asset: stats 改造の範囲外

runtime 未対応項目を editable に上げる場合は、先に BCU owner、JS owner、derived rebuild、決定的な fixture を追加します。

## 派生モデル

resolver は normal stats を clone し、provenance と canonical modification hash を付けます。derived rebuild は変更フィールドに応じて、少なくとも次を整合させます。

- `damage`、`attackHits`、`attackCount`、representative damage
- hit ごとの ability/proc/target mode/base-hit と `BattleAttackProfile`
- `bcuCombatModel`、`bcuCombatModel.proc`、`bcuProc`
- `abilityModel`、`abilities`、`abilities.proc`、traits/immunity/resistance
- LD/omni、wave、surge、blast
- barrier / demon shield の初期 HP、revive、burrow、SUMMON 初期状態
- speed/range/width の world 値、layer
- production cost、respawn/cooldown、deploy limit

既存 `BattleActor` の hot update は行いません。actor 作成時には再構築済み stats から profile、world coordinate、初期 lifecycle state を読みます。

## Template Cache

template identity は次を含む composite key です。

```text
slot / character identity
+ stats context（unit/enemy id、form、level、combo、treasure、talent、orb、stage modifier、proc object）
+ canonical characterModificationHash（空は none）
+ animation context（asset / semantic key / animation ids）
```

同じキャラクターでも改造 hash が異なれば stats、attack profile、actor template を共有しません。同一 canonical 改造は key 順序が違っても同じ hash になり、安全な template 再利用が可能です。semantic ZIP の animation parse/cache は asset identity をキーに別管理し、異なる改造 template 間でも同じ animation asset を共有できます。

## JSON Export / Import

標準 export は canonical minified JSON です。開発時だけ `pretty` を選べます。1 文字キー化は行いません。

```json
{"type":"rhg-custom-stage","version":2,"stage":{},"modifications":{}}
```

```json
{"type":"rhg-character-modification-pack","version":1,"entries":[],"modifications":{}}
```

codec は sparse field、null、default、空 object/array、無効 proc の従属値を省略します。canonical stringify と content hash で同じ改造を dedupe し、未参照 entry を export しません。

import は parse 前に UTF-8 byte size を確認し、最大 5 MiB、nest depth 12、spawn 1000、modification 500、object key 10000 を適用します。`__proto__`、`prototype`、`constructor`、NaN/Infinity とその不正文字列、循環 object / modification reference、壊れた `modificationRef` を拒否します。unknown field は warning とともに破棄し、runtime へは渡しません。

parse、migration、全参照解決、normalization、validation が完了した candidate だけを preview に渡します。commit callback が成功したときだけ prepared token を消費するため、部分 import は行いません。

## UI / Accessibility / Responsive

formation の既存調整 overlay と custom-stage の敵 spawn-row 設定から、同じ editor を開きます。category navigation、検索、変更済み filter、field/category/all reset、undo/redo、original/current/modified value、件数、validation error、save/cancel、import preview、readOnly 表示を共有します。

dialog は `role="dialog"` / `aria-modal`、label、focus trap、Escape/戻る、起点への focus 復帰、`aria-live`、native checkbox、keyboard 操作を備えます。全 command button は `type="button"` です。埋め込み時は modal 内の無関係な sibling を inert/`aria-hidden` にし、背景 scroll を分離します。

layout は `100dvh`、safe-area inset、`visualViewport`、内部 scroll、低 height landscape の固定 footer、`prefers-reduced-motion` を扱います。自動ブラウザ check の viewport matrix は 320x568、390x844、667x320、800x360、1024x768、768x1024、1280x900 です。viewport resize、文字拡大、software-keyboard 相当の高さ、focus、横 overflow も検査対象です。

この自動 check は DOM、操作、overflow、focus の機能証跡です。物理 iPhone / iPad / Android の software keyboard、safe-area、orientation change の受け入れや、BCU と比較した戦闘エフェクトの見た目受け入れを代替しません。

## 検証入口

```bash
npm run check:character-modification
npm run check:character-modification:ui
node scripts/check-character-modification-schema.mjs
node scripts/check-character-modification-codec.mjs
node scripts/check-character-modification-resolver.mjs
node scripts/check-character-modification-derived-model.mjs
node scripts/check-character-modification-cache.mjs
node scripts/check-character-modification-production.mjs
node scripts/check-custom-stage-character-modification.mjs
node scripts/check-formation-character-modification.mjs
node scripts/check-character-modification-import-security.mjs
```

これらは schema/registry、sparse codec/hash/dedupe/migration、absolute override、derived rebuild、cache separation、production、formation/custom-stage ownership、import security と atomic commit を対象にします。`scripts/check-character-modification-ui.mjs` は共通 editor の操作、draft discard/save、reset/undo/redo/search、import/export、focus/scroll/responsive を headless Chromium で検査します。正確な実行成否は各実装バッチの Verification と CI を一次記録とし、この文書だけで成功を主張しません。

## 互換性と既知の境界

- export/import は `rhg-*` envelope の RHG 内部形式であり、BCU セーブ、BCU 陣形、BCU 公式ステージ形式ではありません。
- `localStorage` の round-trip は RHG 自己永続化であり、BCU serializer 互換の根拠ではありません。
- physical-device と BCU capture の人手比較は別途必要です。
- readOnly 項目は runtime owner と再構築契約が確立するまで編集できません。
- animation asset は共有しますが、改造済み stats/attack profile は hash で分離します。
- modification は SUMMON 先へ暗黙継承しません。

## BCU 参照境界

通常計算と適用順の根拠として、`DataUnit.getPrice/getRespawn/getLimit`、`DefaultData.getAtks/getItv/getPost/getProc/getTBA`、`AtkModelEntity.getAbi/getAttack/inRange/setProc/invokeLater`、`EUnit` の level/treasure/orb/combo construction、`EEnemy` の HP/ATK magnification construction を参照します。これらは normal stats と既存 runtime 順序の根拠です。`CharacterModification` 自体を BCU のデータ holder またはセーブ形式として主張する根拠ではありません。
