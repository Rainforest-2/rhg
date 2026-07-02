# BCU の未解決根拠・互換性ブロッカー

更新日: 2026-07-02

この文書では、`RHgrive/rhg` で広範な整合性主張を出す際のブロッカーを列挙します。ここに載っていても、実行時が実装済みである場合があります。ブロッカーの内容は、実データソースの不足、ブラウザ受け入れのギャップ、互換性の境界のいずれかです。

## 現在のブロッカー

残っているブロッカーの多くは、手動のブラウザ受け入れ、描画側のソース不足、対象外機能です。ローダー / データのギャップは解消済みです（解決済み項目を参照）。同フレーム攻撃解決の順序はレビュー項目としてのみ残しており、古いブロッカーノートのままランタイムを変更しないでください。BCU の振る舞いでは相互キルが起こりうるためです。

| 重要度 | 領域 | 現在のブロッカー | 次に必要なこと |
|---|---|---|---|
| 高 | 同フレーム攻撃解決順 | 以前のノートでは BCU が同フレームの相互キルを抑制するとされていたが、これは安全な整合性事実ではありません。相互キルは BCU でも起こりうるため、ソースラインだけでランタイムを抑制しない方がよいです。rhg は現状、同フレームの due-hit capture / damage 挙動を維持しています。 | 固定 BCU キャプチャと決定的な rhg フィクスチャで再監査し、変更前に確認する。キャプチャで相互キルが見えた場合は、ランタイム変更ではなくブロッカーから外す。 |
| 低 | アセット読み込み状態と戦闘ロジック | rhg はユニット / キャノンのアセットをストリーミング読み込みしており（staged critical-path + background warmup、`BattleScene.js:1` メモ参照）、まだ読み込み前のテンプレートが生成遅延や wall cannon（Form 339）の失敗を引き起こす可能性があります。BCU はすべてメモリ上にあるので、これは静かに失敗しない観測可能な差分です。`spawnStageEnemy` / `spawnEnemy` が `enemySpawnRejected` を送信し、`startActorAttack` が `attackDeferredAnimationLoading` を送信し、wall cannon は `wall-template-loading` を記録して充電状態を維持します。最初に攻撃するアセット（最初の敵の攻撃アニメ、wall cannon）は critical path で事前に温められています。 | 長尾のストリーミング遅延は、意図的なブラウザ境界として扱う。完全な blocking preflight を入れると、意図した staged-load UX を壊すため、固定 BCU キャプチャで開幕フレームのスポーン / 攻撃 / キャノンの差分が見えた場合だけエスカレートする。 |
| 中 | extend / waved キャノンタイミング | キャノンごとの ATK/EXT ビットマップ別名が接続され、各キャノンが自身の `NyCastle.aux.atks[id]` BASE/ATK eanim を読み込み、`spawnCatCannonNonBasicEffect` で実アニメを生成するようになりました。残るのは、フレームごとの sweep / travel 座標の正確さで、手動受け入れはまだありません。 | 固定の BCU 参照を取って、ブラウザで extend/waved フレームを比較する。 （見た目） |
| 中 | 召喚エントリの見た目 | `Entity.setSummon(anim_type)` の開始時の見た目、配置、レイヤー、後始末は、ローダーは確認済みでも手動受け入れされていません。 | ローダー付き summon フィクスチャでブラウザ確認する。 （見た目） |
| 中 | BCU の PC 描画側ソース | PC 専用の描画ヘルパーに依存する主張をするには、このチェックアウトに PC 描画側ソース ZIP がありません。 | PC 専用見た目主張をする前に、関連する PC ソースを追加する。 |
| 低 | お金 / bounty の戦闘見た目 | 経済ロジックはソースで裏付けられているが、BCU 側に専用の戦闘エフェクト所有者や安定した見た目別名がない。 | ロジック / 経済のままにしておく。BCU ソースで見た目オーナーが示されるまで、受け入れ対象にしない。 |
| — | BCU セーブ / 陣形 import-export | rhg には BCU セーブ import/export 機能がなく、このチェックアウトに BCU シリアライズオーナーも存在しない。これは対象外で、欠陥ではない。 | もしこの機能を追加するなら、まず BCU 側のオーナーを見つけ、round-trip フィクスチャを先に追加する。ローカル永続化は自己往復の主張に留める。 |
| — | 通常の CSV SUMMON 保持者 | 調査した BCU 根拠では、通常のユニット / 敵 CSV に `SUMMON` を直接持たせることは確認できない（negative evidence / guardrail）。 | ソース根拠が出るまで、通常の CSV パーサは変更しない。 |

## 手動受け入れだけのブロッカー

実行時と決定的な根拠はあるが、まだ見た目として受け入れられていないものです。

- P_DELAY
- バリア / 悪魔シールド / シールドブレイカー
- burrow の DOWN / underground / UP での見た目
- spirit actor と A_IMUATK の見た目
- 城 / 基地ガードの hold / break
- ゾンビ corpse の DOWN / REVIVE と full/mini death-surge の demon-soul 見た目
- 基本キャノンの発射 / 波動、非基本キャノンの sweep、BASE_WALL の入場 / 待機

結果は [bcu-visual-review-checklist.md](./bcu-visual-review-checklist.md) にだけ記録してください。headless テストが通っても、手動ブラウザ受け入れとはみなしません。

## 解決済みまたは negative evidence の項目

現行コードに回帰がない限り、これらを現在の実装ブロッカーとして再掲しないでください。

| 領域 | 現在の結論 |
|---|---|
| 実カスタムパック SUMMON の読み込み | 解決済み: `check-bcu-summon-procobject-loader-parity` が実在の `CustomEntity.atks[].proc.SUMMON` をディスクから読み込み、loader → `BattleAttackProfile` → immediate/on_hit spawn まで通す。 |
| `Trait.targetForms` の実データカバレッジ | 解決済み: `check-bcu-trait-targetforms-loader-parity` が実在の `Trait` ファイル（targetType/targetForms）を読み込み、`bcuTraitCompatible` を通した proc と Target-Only 経路を実行する。 |
| Combo/orb/treasure/talent/PCoin の実データ sweep | 解決済み（非見た目）: `check-bcu-modifier-realdata-sweep-parity` が実データ 150300 combo + talent/PCoin と treasure/orb 定数を BCU 順に組み合わせる。戦闘中の見た目は別項目。 |
| ゾンビ追加 / カスタム revive の source/range | 解決済み: `check-bcu-zombie-extra-revive-source-range-parity` が実在の `REVIVE` proc-object から BCU の `ZombX.updateRevive` の range/warp/`revive_non_zombie`/`imu_zkill` フィルタを駆動する。 |
| 保存失敗の可視化 | 解決済み: `FormationStore` / `StageRegistry` が `BcuStorageDiagnostics` を通して読み書き失敗を通知し、`check-formation-storage-failure-visibility` で確認できる。自己永続化の round-trip は維持される。 |
| Modifier registry fail-open の可視化 | 解決済み: combo / talent（PCoin）レジストリの読み込み失敗は `BcuModifierDiagnostics` を通してレポートされる。`reportModifierRegistryResult` → listeners + `wanko-modifier-registry-error` event で、失敗バンドルが dead-letter 配列にだけ落ちるのではなく問い合わせ可能になる。`check-bcu-modifier-registry-failure-visibility` で、失敗が観測可能で成功時はきれいに報告されることを確認済み。コンボ / talent を設定したプレイヤーに警告を UI で見せるのは、Codex 管理の UI フォローアップ。 |
| `怪人特効` の combo grant | 解決済み: BCU の `EUnit.getAbi()` が正の `C_VKILL` combo 増加から `AB_VKILL` を与え、`DamageAbilityResolver` が固定の villain 攻撃 / 耐性倍率を適用する前にそのビットを合成する。 |
| `衝撃波無効` の boss shockwave スキップ | 解決済み: BCU の `Entity.interrupt(INT_SW)` が `AB_IMUSW` を持つ actor を拒否し、`BattleBossShockwaveRuntimePatch` がボス衝撃波中断からそれを除外する。効果の見た目受け入れは別。 |
| 過去の StageDefinitionLoader ギャップ | 現行コードでは `rowIndex`、castle `noContinue`、`-1` の enemy-castle 置き換え、`bossGuard` ソース行の問題を既に処理済み。古い README の主張は歴史情報として扱う。 |
| 城 / 基地ガード担当 | 実装済み。残るのはブラウザ見た目だけ。 |
| 標準ゾンビ corpse / soulstrike | 決定的な実行時カバレッジがあり、残る範囲は見た目受け入れ。 |
| フル death-surge のタイミング所有権 | 解決済み（非見た目）: `BcuDeathAnimationRuntime` が BCU の `soul.len() - dead == 21` トリガーを担当し、古い priority-effect の即時スポーン経路はガードされ、demon-soul アセットの復旧もテスト済み。ブラウザ見た目は引き続き visual acceptance。 |
| 基本 / 非基本キャノン実行時 | 専用オーナーと決定的なチェックがある。見た目のアセット / タイミング受け入れは別。 |
| 通常の城が持つ攻撃 | negative evidence: 通常の `ECastle` には攻撃オーナーがない。ボス基地の攻撃は通常の `EEnemy` で、HP 閾値 / 撃破数による出現はステージ側が担当。 |
| 特殊城ボススポーン座標 | 実装済み。実行時接続と式のカバレッジがある。 |
| 特殊敵城 / EEnemy base の初期配置 | 解決済み (2026-07-02): ステージヘッダの base enemy id に一致する敵行を通常 spawn schedule から除外し、敵アクター拠点として初期配置する。`check-bcu-enemy-entity-base-runtime` が `N/StageRN/stageRN036_05.csv`（ハリーウッド帝国 / ウニバーサンスタジオ）の raw enemy 317 を固定し、HP% / 勝敗 / placeholder 非表示も確認する。これは通常 `ECastle` に攻撃 runtime を追加するものではない。 |
| 財布 income / max-money combo の式の非対称 | 解決済み (2026-07-02): BCU 自体が非対称。income は `StageBasis.java:806-809` の `mon *= (getInc(C_M_INC)/100 + 1)`（整数除算 = 100% 刻み）、max money は `Treasure.java:497-501` の `base * (100 + inc)`（加算）。rhg の式は両方一致し、`check-bcu-wallet-runtime-parity` に combo 経路のアサーションを追加済み。 |
| Boss music の閾値セマンティクス | 解決済み (2026-07-02): BCU は閾値 0/100 の boss music を読み込まず（`DefStageInfo.java:42-45`）、戦闘中の切替は int 切り捨て HP% の strict `<`（`BattleView.kt:314-317`）。`PreviewAppBattleMusicPatch` を同セマンティクスに修正し、`check-battle-music-and-zombie-killer` にアサーションを追加済み。 |
| モバイル lineup スワイプの閾値・方向 | 解決済み (2026-07-02): `BattleView.kt:440-481`（`height*0.15`、`tan(50°) >= |dx|/|dy|`、`v = dy/dragFrame; v<0 => UP`、guard 群）とライブ実装 `PlayerProductionBar` の一致を確認。孤立重複 `BcuMobileGestureRuntime.js` は削除し、`check-bcu-lineup-slide-gesture-parity` で固定。 |
| 被弾 SE の critical/strong/hit 排他 | 解決済み (2026-07-02): BCU `Entity.java:1722-1762` は SE_CRIT / SE_SATK / SE_HIT_0・1 を同一ヒットで独立に鳴らす（`else if` ではない）。HIT_0/1 は非シードの 50/50。`BattleSoundEventPatch` を setSE 相当のフレーム毎 dedupe（`playBcuSetSe`）に統一し、`check-bcu-battle-sound-effects-parity` に挙動アサーションを追加済み。 |
| MapStageData 行 index のフィルタずれ | 解決済み (2026-07-02): BCU は厳密な位置ベース読み（`FileData.readLine` + `StageMap.StageMapInfo`）。rhg のフィルタ式 indexing は全ライブ stage 行 9,606 組で位置ベースと一致することを実測し、`check-bcu-msd-row-alignment-parity` で恒久ガード化。 |
| `parseAnim` の不正 keyframe 行スキップ | 解決済み (2026-07-02): BCU `Part(Queue)` は不正行で throw。rhg の lenient skip は全 vendored .maanim 14,012 ファイルで未発動（junk 0 行）であることを実測し、既知の破損 30 ファイル（空 2 + pack 100204 のバイナリ破損 28、双方のエンジンでヘッダ検査により失敗）を `check-bcu-maanim-keyframe-integrity` で固定。 |
| ステージ一覧の常時 ★1 フィルタ | 解決済み (2026-07-02): BCU Android のデフォルト star は index 0 = ★1（`LineUpScreen.kt:125`、スピナー position 0）。rhg の常時クラウンフィルタは BCU デフォルトと一致（accepted）。 |
| `resolveUnitAsset` の固定 000004 base | 解決済み (2026-07-02): 固定 base は候補パスの供給のみで、存在確認（`pickFirstExisting` → null）と `assertRawAllowed`（rawOnly 明示なしの raw アクセスは throw）に守られる。捏造アセット内容や暗黙フォールバックにはならない（accepted）。 |
| AB_METALIC の dog-player 攻撃側ケース | 解決済み (2026-07-02): `DamageAbilityResolverMetalAbiPatch` が boot group 未接続で本番未適用だった実バグを修正（`battleCorePatches.js` に接続）。`check-bcu-metal-abi-double-apply` に配線アサーションを追加。 |
| 編成 roster の undeployable カード | 解決済み (2026-07-02): vendored パックに f-form actor runtime（または一部 form の maanim）が存在しない 43 ユニットを `error-ally.json` に display id で追加し、`check-playable-roster-actor-readiness` をランタイムと同じ除外変換（display−1）+ 全 indexed form 掃引に強化。 |
| 孤立コード / 重複実装 / 未使用 verifier | 解決済み (2026-07-02): import graph 監査で到達不能を機械確認し、`js/bcu-render/**`、旧 bcu-runtime スキャフォールド 10 件、node:fs 系 Verifier 11 件、`BattleSceneRendererBcuPatch`、`BattleCastleResolver`、`BcuBattleInputAdapter`、`BcuStageDifficultyRuntime`（ラベル面は out-of-scope、evidence doc に記録）等 36 ファイルを削除。孤立ゼロを確認。 |

## ドキュメントルール

ローダーや見た目受け入れが未完だからといって、実行時そのものがないと決めつけないでください。実際の境界を明示してください。

1. 実行時がない
2. 実行時はあるがソース読み込みが未完
3. 実行時はあるがブラウザ見た目は未受け入れ
4. ソースオーナーが未確認または否定された
5. 互換性の範囲が対象外（製品機能として存在しない）
