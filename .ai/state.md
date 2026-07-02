# Current Status

更新日: 2026-07-02（完成監査ラウンド）

## Discovered Issues
- 修正済み: `js/battle/DamageAbilityResolverMetalAbiPatch.js` が boot group 未接続で本番未適用だった（AB_METALIC の dog-player 攻撃側金属キャップが効かない実バグ）。`js/boot/groups/battleCorePatches.js` へ接続し、`check-bcu-metal-abi-double-apply` に配線アサーションを追加。
- 修正済み: boss music 切替が BCU と不一致（`pct <= threshold`、デフォルト 100 で即 boss 曲）。BCU は閾値 0/100 の boss track を読み込まず（`DefStageInfo.java:42-45`）、切替は int 切り捨て HP% の strict `<`（`BattleView.kt:314-317`）。`PreviewAppBattleMusicPatch` を修正、`check-battle-music-and-zombie-killer` にアサーション追加。
- 修正済み: 被弾 SE の `else if` 排他と wall-clock throttle が BCU と不一致。BCU `Entity.java:1722-1762` は SE_CRIT / SE_SATK / SE_HIT_0・1 を同一ヒットで独立に鳴らし、`setSE` のフレーム毎 per-id dedupe で抑制する。`BattleSoundEventPatch` の `damageQueued` を `playBcuSetSe` 3 独立呼び出し + HIT_0/1 50/50 に修正。
- 修正済み: 編成 roster が vendored パックに actor runtime の無いユニット 43 件（f-form 不在 or 一部 form の maanim 欠落、例: 515_c01.maanim 不在）を選択可能にしていた。`error-ally.json` に display id を追加し、`check-playable-roster-actor-readiness` をランタイム同等の除外変換 + 全 indexed form 掃引に強化。
- stale チェック 3 件を現実装へ同期: `check-battle-scene-stage-runtime-wiring`（PreviewApp import が withBootCreep ラップ済み）、`check-bcu-effect-classification-parity`（De Morgan 書き換え済みの skip 条件）、`check-bcu-castle-runtime-geometry`（削除した BattleCastleResolver への依存を BattleBase 直接アサーションに置換）。

## Current Task
- 完成監査ラウンド完了。残タスクは「Remaining」参照。

## Audited Areas
- import graph 全域（`js/**`、entry: `js/main.js` + scripts/tests）を機械監査し、孤立ゼロを確認。削除 36 ファイル:
  - `js/bcu-render/**`（4）+ 死んだ橋渡し `js/battle/bcu-runtime/BcuEntityEffectIconRuntime.js`
  - 旧 bcu-runtime スキャフォールド 11（BcuAttackWave/AttackVolcano/Barrier/ContVolcano/ContWaveDef/DemonShield/ProcRandom/StageBasisScheduler/Warp×2/ZombieRevive）
  - node:fs 系 Verifier 11（AttackWaitAnimation/BattleLoadPerformance/BcuLoadingStrategy/UiRegression/BcuModelTransformParity/BattleControlSettings/BootSmoke/FormationLayoutAndApply/FormationStatsLazyLoad/FullscreenLayout/ProductionCardSkin）+ `BattleLoadingProgressVerifier`
  - 重複 / 未接続: `BattleCoordinate`、`BattlefieldRenderTransform`、`BattleSceneBcuEntityOrderPatch`（ライブは `BattleSceneBcuStageBasisTickPatch`）、`GameTouchGuard`（ライブは `BattleTouchGuard`）、`ActorBundleIconComposer`、`BcuMobileGestureRuntime`（ライブは `PlayerProductionBar` 内実装）、`BcuBattleInputAdapter`+テスト、`BattleCastleResolver`、`BattleSceneRendererBcuPatch`（renderer 統合済みの実験パッチ、チェックは renderer 本体を固定するよう書き換え）、`bcuAvailableEnemyAssets.js`（0..299 捏造索引）、`BcuStageDifficultyRuntime`+チェック（難易度ラベル面は out-of-scope、evidence doc に記録）
- scripts/ の全 check-*.mjs を実行し、失敗 7 件を全て解消（stale 3 件のチェック同期、生成物再生成で 3 件、roster 除外で 1 件）。未登録だった `check-bcu-renderer-patch` / `check-bcu-castle-runtime-geometry` を safe suite に登録。
- BCU 根拠での分類確定: 財布 income/max combo 式の非対称は BCU 自体の仕様（`StageBasis.java:806-809` 整数除算 vs `Treasure.java:497-501` 加算）で rhg は一致。MSD 行 index はライブ全 9,606 組で位置ベースと一致。maanim lenient skip は 14,012 ファイルで未発動（既知破損 30 ファイルは両エンジンで失敗）。★1 デフォルトフィルタは BCU の star index 0 デフォルトと一致（`LineUpScreen.kt:125`）。`resolveUnitAsset` の固定 base は `assertRawAllowed` で暗黙フォールバック不能。lineup スワイプ定数は `BattleView.kt:440-481` と一致。
- 新設チェック（safe suite 登録済み）: `check-bcu-msd-row-alignment-parity`、`check-bcu-maanim-keyframe-integrity`、`check-bcu-lineup-slide-gesture-parity`。
- `BcuStatusEffectManager` の死んだ表面（`finished` フラグ / `isDone()`、true になり得ない）を削除。`removeEffect` はライブ呼び出しあり（`BattleActorProcStatusPatch.js:525`）。

## Unaudited Major Areas
- なし（import graph 全域 + 全チェック実行済み。個別ファイルの行単位 read-through はチェック / テスト / graph で代替）。

## Unresolved
- なし（旧 Unresolved は全件、修正または BCU 根拠付き accepted / out-of-scope に分類済み。見た目の残項目は Remaining と台帳で管理）。

## Completed
- ベースライン検証（npm ci / build / verify / check / test）green。
- 上記 Discovered Issues の修正、孤立コード削除、チェック増強、生成物再生成（bcu-asset-audit / bcu-diagnostics / bcu-lang-prune-report。tracked zip は committed 状態を維持）。
- ブラウザ実走: `check-nonbattle-ui-polish` 全ビューポート成功（formation → ステージ選択 → ★4 クラウン → バトルロード完了、console エラー 0、スクリーンショット `tmp/ui-polish-screens/`）。
- ドキュメント同期: README / bcu-migration-status / current-ability-parity-status / bcu-unresolved-evidence-blockers / bcu-visual-review-checklist / bcu-stage-difficulty-evidence / このファイル。

## Remaining
- 見た目のブラウザ受け入れ（BCU 参照比較が必要、台帳 `bcu-visual-review-checklist.md` の not-reviewed / blocked 行）: P_DELAY、burrow、spirit / A_IMUATK、SUMMON entry（blocked: 実カスタムパック自動発見未完）、mini death-surge、非基本キャノン sweep / travel、BASE_WALL、攻撃エフェクト / wave / surge / knockback / status icon のレイヤーと終了処理、モバイル操作、音の実機受け入れ。
- 戦闘中フレームまでの headless バトルスモーク（legend/main/event）は実行環境のメモリ逼迫（available ≈1.3GB、Chromium renderer クラッシュ）で完走せず。メモリに余裕のある環境で再実行すること。アプリ欠陥の証跡なし。
