# BCU 能力・ライフサイクル整合性の現状

更新日: 2026-07-24  
確認した `main`: `aa6ed5eb82324be4a745a8d85237d4d68775424d`

この文書は ability / proc / damage / lifecycle の状態行だけを所有します。project 全体の active correctness 項目と優先順位は `../bcu-migration-status.md` を参照してください。

## 状態語彙

- `verified-owner`: BCU source owner、現行 JS owner、focused check がある。
- `known-defect (partial)`: source-backed な active Issue があり、現行 runtime を完了扱いできない。
- `human-visual-review-needed`: logic owner/check はあるが、見た目が未受け入れ。
- `evidence-blocked`: source/holder/asset/fixture が不足する。
- `out-of-scope`: 現在の project scope に含まれない。

広い `verified-owner` は個別 active Issue を上書きしません。

## Current runtime coverage

| 領域 | 状態 | 現在の境界 |
|---|---|---|
| 凍結 / 減速 / 弱体化 / knockback proc | `verified-owner` | proc owner、resistance、KB lifecycle の focused check がある。見た目は変更時に再確認する。 |
| 呪い / 封印 / toxic | `verified-owner` | runtime / resistance owner がある。effect layer/cleanup は visual ledger 対象。 |
| Warp | `human-visual-review-needed` | entry / hidden / exit / complete と attack/movement interruption は実装済み。WaprCont 表現は未受け入れ。 |
| P_DELAY | `human-visual-review-needed` | cooldown/stage-row delay owner はある。position/layer/timing の手動比較が必要。 |
| Wave / mini-wave / surge / mini-surge / blast | `human-visual-review-needed` | damage/container owner と focused check はある。layer/lifetime/visual exactness は別。 |
| Barrier / demon shield / breaker | `verified-owner` | runtime/check があり、既存 ledger では accepted。新しい mismatch が出た場合は差し戻す。 |
| Death / zombie corpse / soulstrike / revive | `human-visual-review-needed` | standard runtime と extra/custom revive source-range owner はある。未受け入れ visual 項目を残す。 |
| Burrow | `human-visual-review-needed` | state/targetability/collision owner はある。DOWN/underground/UP の見た目未受け入れ。 |
| Spirit | `human-visual-review-needed` | production/stage state、cooldown、一回制限、ready card owner はある。actor/A_IMUATK/flash 未受け入れ。 |
| SUMMON | `human-visual-review-needed` | proc-object loader と spawn owner はある。entry anim/placement/layer/cleanup 未受け入れ。 |
| Castle guard / special `EEnemy` base | `verified-owner` | 通常 castle-owned attack は作らない。特殊 base は enemy actor owner。 |
| Cat cannon / BASE_WALL | `human-visual-review-needed` | runtime owner はある。non-basic sweep/travel と BASE_WALL visual が未受け入れ。 |
| Metal defender / critical semantics | `verified-owner` | PR #21でenemy Metalとunit `AB_METALIC`を分離し、一回のcritical RNG drawへ統合。 |
| `Trait.targetType/targetForms` compatibility | `verified-owner` | PR #21でfully target-traitedへDemon/Relicを追加し、loader checkを更新。 |
| Battle deterministic layer RNG / KC | `verified-owner` | CopRand committed layerとplayer-unit death KC semanticsをPR #21で接続。 |
| Actor layer rendering | `verified-owner` | `currentLayer`優先、scene insertion順tie-breakのstable paint orderをPR #21で導入。 |
| Crown selection propagation | `known-defect (partial)` | #22によりadapter runtimeが選択crown/starを100%/★1で上書きする。 |
| Crown multiplier precision | `known-defect (partial)` | #20によりrow×crownを途中の整数percentへ丸める。 |
| Ranking/trail overtime and score | `known-defect (partial)` | #23によりtimeLimit/row scoreはparsed metadataのままで、overtime・spawn停止・score ownerがない。 |
| Wallet / cost / respawn / modifier | `verified-owner` | BCU 式・registry owner はある。Issue が見つかった場合は個別行へ降格する。 |
| Sound / boss music / SE voice pool | `human-visual-review-needed` | resolver/runtime owner はある。実機多重再生と切替は未受け入れ。 |
| BCU save / lineup import-export | `out-of-scope` | RHG 自己永続化と RHG JSON だけを所有する。 |

## Character modification boundary

Character modification は BCU holder ではありません。通常最終値へ sparse absolute override を適用し、attack/combat/proc/ability/lifecycle/world/production の派生 object を再構築します。

- field metadata: `CharacterModificationFieldRegistry.js`
- current architecture: `../RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md`
- unsupported/readOnly: spirit、damage cut/cap、HP regeneration、ARMOR、raw ABI、animation/semantic asset
- SUMMON target は同期解決できる場合だけ editable。召喚元の modification を召喚先へ継承しない

## 更新規則

- active Issue が存在する領域を `verified-owner` だけで完了扱いしない。
- merged fixと回帰チェックがmainへ入ったら、Issue stateの遅延だけを理由に`known-defect`を残さない。
- Issue 修正時は regression check と同じ変更で該当行を更新する。
- browser/実機比較なしに `accepted` を追加しない。
- source evidence の詳細は `bcu-ability-source-evidence.md`、証拠不足は `bcu-unresolved-evidence-blockers.md` に置く。
