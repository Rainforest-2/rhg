# BCU パリティ作業計画

更新日: 2026-07-24  
基準 `main`: `aa6ed5eb82324be4a745a8d85237d4d68775424d`

この文書は active correctness 項目の実行順と完了条件だけを管理します。status は `../bcu-migration-status.md`、source/evidence blocker は `bcu-unresolved-evidence-blockers.md`、visual result は `bcu-visual-review-checklist.md` を参照してください。

## 共通完了条件

各 Issue で次を満たします。

1. BCU file/class/method/field/state transition を Issue または test に固定する。
2. 現行 JS owner と boot reachability を確認する。
3. 不具合を再現する regression check を先に追加または同時追加する。
4. 変更を最小 owner に限定し、wrapper/import order を壊さない。
5. focused check、adjacent check、`npm test`、`npm run build` を実行する。
6. Issue を閉じる変更と同じバッチで current docs を更新する。

## P0 — Crown selection reaches production runtime

### #22 Preserve selected crown/star through the adapter

- `PreviewApp -> BattleScene.options -> buildStageRuntime -> StageRuntimeSceneAdapter` のselection伝播を一本化する。
- explicit method option、`scene.options`、stage metadataのprecedenceを定義する。
- correctly crowned legacy runtimeをdefault-valued adapter runtimeで上書きしない。
- final merged runtimeが`crownMagnificationPercent`、`crownStarIndex`、`enemyRows`で一致することをassertする。
- ★1 defaultと★2–★4 production pathをinstalled wrapper込みで検証する。

## P1 — Crown precision

### #20 Preserve float multiplier until final stat conversion

- `rowMagnification × crownFactor`を途中の整数percentへcollapseしない。
- HPとattackでBCUのfloat multiplicationと最終cast/round orderを個別に固定する。
- `101% × 150% = 151.5%`を保持し、base statへ適用した最終値を比較する。
- barrier、demon shield、damage cut/cap、regeneration等、同じHP multiplierを使う派生値も監査する。
- exact product（例: `400% × 150% = 600%`）を回帰させない。

## P1 — Ranking lifecycle and score

### #23 Implement dojo overtime and score ownership

- overtimeをBCU logic frameで判定する: `trail && timeLimit != 0 && timeLimit * 1800 - logicFrame < 0`。
- first overtime frame以降はstage activityとspawnを停止し、spawn RNGを消費しない。
- eligible normal enemy killでrow score、enemy drop、remaining timeを用いたBCU score式を適用する。
- overtime後、inactive battle、非normal kill、row-less/base enemyの境界を固定する。
- parsed stage-limit dataがある場合、minimum-score outcomeを実装する。
- score/overtimeをdiagnosticsとranking UIへ公開する。

## Correctness 後の queue

- visual acceptance: P_DELAY、burrow、spirit、SUMMON、death-surge、non-basic cannon、BASE_WALL、effect layers
- physical-device acceptance: mobile keyboard/safe-area/orientation/touch/audio
- performance cleanup: debug allocation、重複 wrapper、renderer hot path。correctness owner/check を先に固定する

## Resolved batch

PR #21で旧 #6、#7、#8、#9、#10、#12、#13、#14、#17、#18 の実装と回帰チェックがmainへ入りました。これらをactive roadmapへ戻す場合は、`105411944e64cecc06ec89a53a3ad6e038846902`以降で再現する新しい証拠が必要です。

旧 W1–W3（SUMMON loader、storage failure visibility、modifier/trait fixture）はsource-loading taskとして完了済みです。旧 W7 の同フレーム攻撃監査はactive workから外れています。解決済み項目をactive roadmapに残しません。
