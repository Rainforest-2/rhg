# BCU 移行状況

## 最終更新

- 日付: 2026-07-02 (UTC)
- リポジトリ: `Rainforest-2/rhg`
- 対象: BCU ZIP / 実行時 / 能力の整合性、描画・UI の受け入れ、データ読み込み、永続化互換性
- 監査基盤: 現行の rhg コードと `references/bcu/` 配下に含まれる BCU 参照 ZIP

これは高水準の一次情報源です。現行コードと重点ドキュメントが食い違う場合、従来の README や ZIP 分析の主張より優先します。

## 現在の実行時基準

- 既定の実行時モード: `semantic-strict`
- 生成済み semantic ZIP バンドルを、バンドル済みファミリの正式な実行時アセットソースとする
- `public/assets/bcu/**` のファイルは、静かにフォールバックされるものではなく、引き続きソース素材として扱う
- コア起動は `BcuBootLoader` / `SemanticAssetProvider` 経由で `public/assets/bundles/core/core-db.zip` を使う
- 参加可能な犬のロスター表示は、ローカル semantic actor の準備状態で制御される。古い外部 `error-enemy` 除外リストでは、enemy 562 や 661–669 などの完全なバンドル済み actor を隠せない
- 陣形や生産アイコンは、actor-image フォールバックではなく semantic UI アセットで解決する
- キャットユニットの生産値は BCU の `ELineUp` 経路を使う。`StageMap.price=1` で `DataUnit.price` が 1.5 倍の配置コストになり、PCoin の `PC2_COST` / `PC2_CD` が先に価格・再配置時間に反映され、C_DISCOUNT が配置コストに適用され、`Treasure.getFinRes(respawn, C_RESP)` が戦闘中クールダウンの下限を決める
- 霊魂召喚の実行時は、BCU の生産・ステージ状態、クールダウン、1 召喚者あたり 1 霊魂、ワープ前の召喚元、サイド容量制限までカバーする。actor / A_IMUATK の見た目は手動レビュー対象
- BCU sound id `0..190` は、ステージマップ BGM 参照、遅延 sound-cache warming、再生中 SE の奪い合いを抑えて全リクエストを維持する HTMLAudio SE voice pool で解決する

## 現在の重点ドキュメント

| 分野 | 対象文書 |
|---|---|
| 能力・proc・効果の整合性 | `docs/ability-logic/current-ability-parity-status.md` |
| 根拠・互換性ブロッカー | `docs/ability-logic/bcu-unresolved-evidence-blockers.md` |
| ブラウザ上の見た目レビュー | `docs/ability-logic/bcu-visual-review-checklist.md` |
| 死亡・ワープのライフサイクル | `docs/ability-logic/death-warp-current-status.md` |
| BCU ソース根拠 | `docs/ability-logic/bcu-ability-source-evidence.md` |
| 実装順序 | `docs/ability-logic/bcu-parity-codex-workplan.md` |

## 2026-07-02 完成監査サマリ

到達性・BCU 根拠・配線の全面監査を実施しました。

- **実バグ修正**: `DamageAbilityResolverMetalAbiPatch`（AB_METALIC の dog-player 攻撃側金属キャップ）が boot group 未接続で本番未適用だったのを `battleCorePatches.js` へ接続し、チェックに配線アサーションを追加。
- **BCU 根拠で 3 件のランタイム挙動を修正**: boss music 切替（閾値 0/100 無効 + int 切り捨て strict `<`、`DefStageInfo`/`BattleView.aboveBoss`）、被弾 SE（CRIT/SATK/HIT の独立再生 + フレーム毎 dedupe、`Entity.java:1722-1762`）、編成 roster から undeployable ユニット 43 件を除外（`error-ally.json`）。
- **特殊敵城 / EEnemy base 接続を修正**: ステージヘッダの base enemy id と一致する敵行を通常 spawn schedule から除外し、敵アクター拠点として初期配置する。`N/StageRN/stageRN036_05.csv`（ハリーウッド帝国 / ウニバーサンスタジオ）の raw enemy 317 を `check-bcu-enemy-entity-base-runtime` で固定。通常の castle-owned attack runtime は追加していない。
- **BCU 根拠で 6 件を accepted 分類**: 財布 combo 式の非対称、MSD 行 index、maanim keyframe leniency、★1 デフォルトフィルタ、`resolveUnitAsset` fallback、lineup スワイプ定数。
- **孤立コード 36 ファイルを削除**: `js/bcu-render/**`、旧 bcu-runtime スキャフォールド、node:fs 系 Verifier 群、重複ゲスチャランタイム等。import graph で孤立ゼロを機械確認。
- **チェック増強**: `check-bcu-msd-row-alignment-parity`、`check-bcu-maanim-keyframe-integrity`、`check-bcu-lineup-slide-gesture-parity` を新設し safe suite 登録。stale だった 3 チェックを現実装に同期、生成物依存の 4 チェックは再生成手順で成功確認。
- **ブラウザ実走**: 全ビューポートで formation → ステージ選択 → バトルロード完了を headless Chromium で確認（`tmp/ui-polish-screens/`）。戦闘中フレームの追加スモークは実行環境のメモリ逼迫で完走せず（アプリ欠陥の証跡なし）。
- **見た目台帳**: ユーザー確認済み 6 項目（バリア / 悪魔シールド / 城ガード / 標準 zombie revive / 財布ボタン / 基本キャノン）を accepted 記録。残りの見た目項目は human-visual-review-needed のまま（完成宣言はしない）。

## 2026-06-23 監査サマリ

確認済みの `Critical` 整合性欠陥は見つかっていません。見た目以外のソース読み込みギャップ（SUMMON の proc-object、`Trait.targetForms`、combo/orb/treasure/talent/PCoin、追加 / カスタム revive、保存失敗の可視化）は、実際の BCU 形式のフィクスチャで確認済みです。残る主なリスクは、手動での見た目受け入れです。BCU セーブ / 陣形 import-export は対象外です。

## 2026-06-25 参照 Markdown 監査サマリ

チェックイン済みのキャラ能力参照 Markdown を、現在の JS オーナーに対して 1 対 1 で監査しました。監査範囲では `精霊` 小見出しを除外しています。2 つの非見た目ランタイム差分は解消され、`C_VKILL` の combo 増加で `AB_VKILL` を合成し、`AB_IMUSW` がボス出現 `INT_SW` の衝撃波中断から対象を除外するようになりました。残る主要リスクは見た目のブラウザ受け入れであり、決定的なランタイム責務の欠如ではありません。

### 高優先度

| 領域 | 現在の状態 | リスク / 次のアクション |
|---|---|---|
| SUMMON の読み込み | `code-complete-candidate` | 実在の `CustomEntity.atks[].proc.SUMMON` をディスクから読み込み、loader → `BattleAttackProfile` → immediate/on_hit スポーンまで動かす。通常の CSV 保持者は追加しない。召喚エントリの見た目だけが残る。 |
| セーブ / 陣形互換性 | `code-complete-candidate`（自己永続化）; BCU import/export は `out-of-scope` | `FormationStore` / `StageRegistry` が自身の状態を往復し、`BcuStorageDiagnostics` で読み書き失敗を通知する。BCU セーブ / 陣形 import-export は対象外の機能であり欠陥ではない。 |

### 中優先度

| 領域 | 現在の状態 | リスク / 次のアクション |
|---|---|---|
| `Trait.targetForms` / 特殊 trait | `code-complete-candidate` | 実在の `Trait` ファイルが `bcuTraitCompatible` の単一ゲートを proc と Target-Only 経路の両方で動かす。 |
| Combo / orb / treasure / talent / PCoin | `code-complete-candidate`（非見た目） | 実データ 150300 combo と talent/PCoin、treasure/orb 定数が BCU 順で構成され、orb も解決経路に乗る。PCoin の cost/CD と ELineUp の生産コスト/クールダウンもカバーされる。戦闘中の見た目受け入れは別項目。 |
| 追加 / カスタム ゾンビ蘇生 | `code-complete-candidate` | 実在の `REVIVE` proc-object が BCU の `ZombX.updateRevive` の source/range/zombie/warp フィルタを駆動する。死体の見た目は引き続き視覚項目。 |
| 参加可能な犬ロスターの actor 可視性 | `code-complete-candidate` | `buildDogSpecs` は、古い外部エネミー除外一覧に表示 id が入っていても、ローカル semantic actor バンドルを見えるように保つ。`check-dog-playable-roster-readiness` が enemy 562 と 661–669 をカバーする。 |
| 非基本キャットキャノンの見た目 | 実行時は `code-complete-candidate` | キャノンごとの ATK/EXT ビットマップ別名が接続され、各キャノンが独自の `NyCastle.aux.atks[id]` BASE/ATK eanim を読み込み、`spawnCatCannonNonBasicEffect` で表示する。正確な extend/waved の移動・掃討タイミングはブラウザ未受け入れ。 |
| 見えるエフェクト / UI の受け入れ | `human-visual-review-needed` または `partial` | P_DELAY、シールド系、霊魂、城のガード、召喚、ゾンビ蘇生、cat cannon、BASE_WALL は、固定フィクスチャ付きのブラウザレビューが必要。 |

## 修正した過去の主張

現行コードの比較なしにこれを現状の欠陥として再開しないこと。

- 過去の StageDefinitionLoader の指摘（`rowIndex`、castle `noContinue`、`-1` の enemy-castle 解決、`bossGuard` ソース行）は、現行コードでは修正済みであり、現在の主なリスクではない。
- 城 / 基地ガードの JS 所有権は実装済み。残る差分はブラウザ見た目であり、ランタイム担当の欠落ではない。
- 標準的なゾンビの死体 / soulstrike / revive ランタイムは決定的にカバーされており、追加 / カスタム revive の source/range フィルタも loader で確認済み。見た目はまだ開放されている。
- 基本 / 非基本キャットキャノンはともにランタイムが存在する。見た目のアセット別名とブラウザ受け入れは別作業。
- 通常の城が汎用攻撃ランタイムを持つことはなく、ボス基地の攻撃は通常の `EEnemy` オーナーを使う。HP 閾値・撃破数による出現はステージ側の責務。 

## 永続化の境界

このプロジェクトは、自己管理するマイグレーションを支える範囲で、リポジトリ内の永続化スキーマ連続性のみを保証します。以下は主張しません。

- BCU セーブや陣形の import
- BCU でそのまま使える export
- ブラウザストレージがブロック・満杯・利用不可のときの完全な永続化

今後 BCU import/export を行う場合は、まず BCU セーブのオーナー、シリアライズ形式、バージョン規則、round-trip フィクスチャを明示する必要があります。

## 状態を上げる前に必要なチェック

```bash
node scripts/check-bcu-parser-indexes.mjs
node scripts/check-projectile-damage-parity.mjs
node scripts/check-proc-immunity-resistance-parity.mjs
node scripts/check-bcu-delay-runtime.mjs
node scripts/check-bcu-summon-runtime-parity.mjs
node scripts/check-bcu-spirit-bundle-manifest-parity.mjs
node scripts/check-bcu-castle-guard-parity.mjs
node scripts/check-bcu-wallet-runtime-parity.mjs
node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs
node scripts/check-ability-partial-blockers.mjs
```

対象サブシステムに関係するチェックだけを使ってください。通ったチェックが示すのは、その主張に対応する部分だけです。

## 手動ブラウザ確認の焦点

視覚チェックリストを使い、固定ステージ・ユニット・敵・キャノンのフィクスチャに対して `accepted` / `mismatch` / `blocked` を記録してください。

- P_DELAY とシールド系エフェクト
- burrow の down / underground / up 遷移
- 霊魂 actor と A_IMUATK
- 城のガード hold / break
- summon の `anim_type` 入場と配置
- ゾンビの corpse DOWN / REVIVE
- 基本 / 非基本キャノンの発射、移動 sweep、BASE_WALL の入場・待機

## ドキュメント更新ルール

整合性変更後は、重点ドキュメントを次の順で更新します。

1. `current-ability-parity-status.md`
2. `bcu-unresolved-evidence-blockers.md`
3. `bcu-visual-review-checklist.md`（実際のブラウザレビュー後のみ）
4. このファイル
5. `README.md` と `AGENTS.md`（公開サマリやエージェント手順が変わる場合）

現行コードとチェックで解決済みなのに、過去の実装ギャップを現状のブロッカーとして残してはなりません。
