# BCU の見た目レビュー台帳

更新日: 2026-07-02

この台帳は、実行時と決定的なチェックは既にあるが、手動ブラウザ受け入れが必要な領域を記録するものです。パーサやチェックリストの代用品ではありません。

## レビュー規則

1. rhg を BCU のキャプチャまたは再現可能な BCU の振る舞いと比較する。
2. ステージ、ユニット / 敵 / キャノン、レベル / 修飾子、ブラウザ / 端末のスケール、キャプチャしたフレーム範囲を記録する。
3. 見た目が出ているかだけではなく、タイミング、位置、スケール、レイヤー、可視性、後始末まで確認する。
4. 選んだフィクスチャが、記録した主張に十分近いと判断できた場合だけ `accepted` とする。
5. headless チェックや決定的なトレースだけで、`not-reviewed` を `accepted` に変えてはいけない。
6. 必要な実データフィクスチャやアセット別名が存在しない場合は `blocked` とし、具体的なブロッカーを記録する。

## チェックリスト

| 領域 | 現在の整合性状態 | 最低レビュー対象フィクスチャ | 確認する内容 | 結果 | 備考 |
|---|---|---|---|---|---|
| P_DELAY | `human-visual-review-needed` | プレイヤーのクールダウン遅延と敵のステージ行遅延 | エフェクトの配置、actor レイヤー、タイミング、クールダウン・行遅延のフィードバック | `not-reviewed` | 実行時・エフェクト・座標チェックは存在する。 |
| バリア / 悪魔シールド / シールドブレイカー | `accepted` | バリア破壊、悪魔シールド破壊、再生成 | フェーズ順、y オフセット、スケール、レイヤー、再生成タイミング | `accepted` | fixture: バリア持ち敵 + シールドブレイカー / 悪魔シールド持ち敵（check-bcu-barrier-shield-effect-parity / check-bcu-demon-shield-regen-timing のフィクスチャ系）<br>reference: ユーザー所持の BCU 環境（本リポジトリ外）<br>reviewed: 2026-07-02 のユーザー指示により「確認済み」と明示されたため記録。原レビューのブラウザ・端末・日付の一次記録は無い。<br>result: accepted（ユーザー確認）。将来 mismatch が見つかれば即この行を差し戻すこと。 |
| Burrow | `code-complete-candidate` | 通常の burrow 敵 1 体と `TCH_UG` 相互作用 1 つ | DOWN、地下移動、UP、ターゲット可否 / 描画可否の遷移 | `not-reviewed` | ライフサイクルはテスト済み。見た目はまだ未受け入れ。 |
| Spirit | `human-visual-review-needed` | 召喚者と攻撃専用 spirit 形態 | 生成、攻撃アニメ、A_IMUATK、攻撃後の後始末、conjure-card の ready flash | `not-reviewed` | Semantic ZIP / factory 経路はある。ワープ前の起点、容量制限、1 フレームごとのクールダウン、cooldown-ready 強調、conjure 後 1 フレームの生産ロック、生産カードの ready 状態接続、boss-shockwave 免疫は決定的チェック済み。ready/cooldown のデータは `PlayerProductionBar` の `bcuSpirit` に届くので、あとはその flash と spirit / A_IMUATK の見た目をブラウザ受け入れするだけ。 |
| 城 / 基地ガード | `accepted` | ガードされたボスステージ | hold の見た目、保持中の基地ダメージフィードバック、break タイミング / 後始末 | `accepted` | fixture: ガード付きボスステージ（check-bcu-castle-guard-parity のフィクスチャ系）<br>reference: ユーザー所持の BCU 環境（本リポジトリ外）<br>reviewed: 2026-07-02 のユーザー指示により「確認済み」と明示されたため記録。原レビューのブラウザ・端末・日付の一次記録は無い。<br>result: accepted（ユーザー確認）。将来 mismatch が見つかれば即この行を差し戻すこと。 |
| SUMMON entry | `partial` | ローダー付きの実カスタム proc-object summon フィクスチャ | `anim_type`、入場フェーズ、配置、レイヤー、same_health / bond_hp の見える影響 | `blocked` | 実カスタムパックの自動発見 / 読み込みはまだ未完。 |
| Zombie revive | `accepted`（標準経路） | 標準 revive ゾンビ（ゾンビキラーあり / なし） | corpse DOWN、show-window のターゲット可否、REVIVE、表示 / 非表示、完了 | `accepted` | fixture: 標準 revive ゾンビ、ゾンビキラーあり / なし（check-bcu-zombie-corpse-soulstrike-parity のフィクスチャ系）<br>reference: ユーザー所持の BCU 環境（本リポジトリ外）<br>reviewed: 2026-07-02 のユーザー指示により「確認済み」と明示されたため記録。原レビューのブラウザ・端末・日付の一次記録は無い。<br>result: accepted（ユーザー確認）。将来 mismatch が見つかれば即この行を差し戻すこと。 追加 / カスタム revive のソースは loader パリティ済（check-bcu-zombie-extra-revive-source-range-parity）。 |
| Mini-death-surge | `human-visual-review-needed` | ORB_DEATH_SURGE フィクスチャ | demon soul、surge 開始フレーム、WT_MIVC の見た目、後始末 | `not-reviewed` | 保持者 / 実行時は決定的チェック済み。 |
| Wallet button | `accepted` | 買えない場合、買える場合、Lv8 最大時 | ビットマップフレーム、BCU スプライト文字、左下アンカー、点滅周期 | `accepted` | fixture: 財布 Lv1 不足 / 561 で可 / Lv8 上限（check-bcu-wallet-runtime-parity + check-bcu-wallet-button-icon-parity のフィクスチャ系）<br>reference: ユーザー所持の BCU 環境（本リポジトリ外）<br>reviewed: 2026-07-02 のユーザー指示により「確認済み」と明示されたため記録。原レビューのブラウザ・端末・日付の一次記録は無い。<br>result: accepted（ユーザー確認）。将来 mismatch が見つかれば即この行を差し戻すこと。 |
| 基本キャットキャノンのボタン / 発射 | `accepted` | 部分充電、full-flash、発射 | ボタン / ゲージ / FIRE フレーム、基本発射アニメ、18F preTime、移動波 | `accepted` | fixture: 基本キャノン部分充電→full-flash→発射（check-bcu-cat-cannon-runtime-parity / check-bcu-cat-cannon-button-visual-parity のフィクスチャ系）<br>reference: ユーザー所持の BCU 環境（本リポジトリ外）<br>reviewed: 2026-07-02 のユーザー指示により「確認済み」と明示されたため記録。原レビューのブラウザ・端末・日付の一次記録は無い。<br>result: accepted（ユーザー確認）。将来 mismatch が見つかれば即この行を差し戻すこと。 |
| 非基本キャノン: SLOW/STOP/WATER/GROUND/BARRIER/CURSE | `code-complete-candidate` 実行時 | キャノン id ごとのフィクスチャ | ソースアニメの入手可否、射程、sweep / travel タイミング、ヒット / エフェクト位置 | `not-reviewed` | キャノンごとの ATK/EXT ビットマップ別名は接続済み（`getBcuCatCannonAnimFiles` + `spawnCatCannonNonBasicEffect`、`check-bcu-non-basic-cat-cannon-anim-parity`）。正確な sweep / travel タイミングはまだブラウザ受け入れが必要。 |
| BASE_WALL キャノン | `code-complete-candidate` 実行時 | enemy front と no-enemy fallback の Form 339 wall 生成 | 入場、待機、スポーン位置、anchor+100、早期死亡、自爆 | `not-reviewed` | 実行時ライフサイクルはテスト済み。見た目のアセットと配置の受け入れが残る。 |

## 結果値

- `not-reviewed`: 人のブラウザ比較がまだ記録されていない。
- `accepted`: 記録したフィクスチャが BCU 参照と十分に一致している。
- `mismatch`: 見た目の差分が見つかった。短い説明とフレーム / 位置の根拠を添える。
- `blocked`: フィクスチャ、ソースローダー、キャプチャ、アセット別名のいずれかが利用できない。

## 必須のメモ形式

結果を変更する際は、Notes 列を次の形式で置き換える。

```text
fixture: <stage / unit / enemy / cannon / modifiers>
reference: <BCU capture or reproducible BCU setup>
reviewed: <date, browser/device, scale>
result: <what matched or differed>
```

このファイルで実装状態を変えてはいけません。根拠や実行時のカバレッジが変わった場合は、`current-ability-parity-status.md` と `bcu-unresolved-evidence-blockers.md` も別途更新してください。

## 2026-07-02 セッションのブラウザ実走記録（受け入れ判定ではない）

headless Chromium（Playwright, dist ビルドを `vite preview` 経由で配信）で以下を実走した。
これは起動・遷移・ロードのスモーク証跡であり、BCU 比較の見た目受け入れ（accepted）の根拠には使っていない。

- `scripts/check-nonbattle-ui-polish.mjs` 全ビューポート成功（667x375 〜 1440x900）。
  フォーメーション UI、カテゴリ / マップ / ステージ選択、★4 クラウンフィルタ、検索 / リセット、
  ステージ選択→出撃→バトルロード完了（`.app-loading-overlay.is-hidden` 到達、★4 選択保持）まで確認。
  console エラー 0。スクリーンショット: `tmp/ui-polish-screens/`（`battle-loading-1024x768.png` 含む）。
- 戦闘中フレームまでの追加スモーク（legend/main/event 各 1 ステージ）は、同一コード・同一アセットにも
  かかわらず本セッション後半の実行環境のメモリ逼迫（available ≈1.3GB）で Chromium renderer が
  クラッシュし完走できなかった。アプリ欠陥の証跡は無し（前半の同一ビルドでのバトルロード成功と矛盾しない）。
  メモリに余裕のある実機ブラウザでの再実行を推奨。
