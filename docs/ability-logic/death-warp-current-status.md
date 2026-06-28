# 死亡魂とワープライフサイクルの現状

更新日: 2026-06-23

このメモは、`RHgrive/rhg` での BCU の死亡・ゾンビ蘇生・mini death-surge・ワープライフサイクルを担当する現行の一次資料です。

## 状態の境界

- `code-complete-candidate`: ソース根拠・実行時接続・決定的なチェックが揃っている。
- `human-visual-review-needed`: ブラウザ上の見た目はまだ手動受け入れされていない。
- `partial`: 実データ読み込みや source discovery の不足など、広いギャップがある。

## 死亡魂と標準ゾンビライフサイクル

**状態:** 死亡魂の実行時は `code-complete-candidate`、死亡 / ゾンビの見た目は `human-visual-review-needed`、追加 / カスタム revive の広いソース網羅だけが `partial`。

### 現在の根拠

- `BcuCombatModel.parseDeathAnimation` がユニットの `DataUnit.ints[67]` と敵の `DataEnemy.ints[54]` を読む。
- 敵側の fallback `rawSoulId == -1 && ints[63] == 1` で Soul 9 を解決する。
- `BattleBcuDeathAnimationRuntimePatch` が `BattleActor.enterDeadState` と dead-state の tick を `BcuDeathAnimationRuntime` に接続する。
- `BcuSoulEffectLoader` が `public/assets/bundles/effect/soul.zip` から死亡魂アセットを読む。
- missing-asset の lifetime fallback は JS の安全装置であり、BCU のフレーム値を主張するものではない。
- `check-bcu-death-animation-parity.mjs` は、パーサーのインデックス、通常の death soul、missing-asset cleanup、AB_GLASS の soul スキップ、death-surge の発火タイミングをカバーする。
- `check-bcu-zombie-corpse-soulstrike-parity.mjs` は、revive インデックス、corpse show-window の targetability、AB_ZKILL / AB_CKILL、soulstrike のキャンセル、zombie-killer suppression、revive HP、DOWN / REVIVE の状態遷移、render override、cleanup、二重 death-surge spawn の抑制をカバーする。

### 残っている境界

- 標準の zombie corpse / revive は、もはや「実行時未実装」や「parsed-only」ではない。残る差分は DOWN / REVIVE のブラウザ受け入れだけである。
- 追加 / カスタム revive はフィクスチャベースであり、実データの source discovery や range filter はまだ `partial` である。
- mini death-surge は ORB_DEATH_SURGE holder と決定的な実行時カバレッジがある。残る差分は見た目であり、holder 所有権ではない。

## ワープライフサイクル

**状態:** `code-complete-candidate`。見た目の受け入れだけが残る。

### 現在の根拠

- `BcuWarpLifecycleRuntime` は、入口・隠蔽区間・退出移動・退出アニメーション・完了を単純な countdown ではなくライフサイクルとしてモデル化する。
- ワープ中は actor を隠し、ターゲット不可能・接触不可能にする。
- 退出遷移で位置が変わり、ワープ中の通常移動は許可されない。
- scene tick の各段階で、歩行・再ターゲティング・攻撃開始・攻撃タイムライン進行がスキップされる。
- ワープ開始で進行中の攻撃がキャンセルされ、ワープ完了後に歩行が再開する。
- `IMUWARP` が lifecycle 生成を阻止し、死亡時に stale state がクリアされ、置き換えケースもテストされる。
- `check-bcu-warp-lifecycle-parity.mjs` と `check-bcu-warp-interrupt-scene-parity.mjs` が、通常・置き換え・死亡経路、前進 / 後退退出、攻撃キャンセル、歩行再開をカバーする。

### 残っている境界

- WaprCont のピクセル表現、複数ワープの重なり順、ブラウザレベルの effect 受け入れは未解決のまま残る。

## 2026-06-23 監査ルール

現行監査では、確認された死亡・ワープのランタイム回帰は見つかっていない。標準ゾンビや mini death-surge の実行時を「未実装」や「parsed-only」と再び呼ぶのは、現行コードとテスト失敗を伴わない限り避ける。

## 必須の検証

```bash
node --check js/battle/bcu-runtime/BcuDeathAnimationRuntime.js
node --check js/battle/bcu-runtime/BcuWarpLifecycleRuntime.js
node scripts/check-bcu-death-animation-parity.mjs
node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs
node scripts/check-bcu-mini-death-surge-parity.mjs
node scripts/check-bcu-warp-lifecycle-parity.mjs
node scripts/check-bcu-warp-interrupt-scene-parity.mjs
```

エフェクトバンドルが変わったら、`soul.zip` と `wave.zip` の内容も確認する。見た目結果は `bcu-visual-review-checklist.md` にのみ記録する。