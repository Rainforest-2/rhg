# みんなのステージ実装エージェントガイド

対象: `Rainforest-2/rhg` の Community Stage Platform Phase 3〜11  
用途: CLI Terra High が、設計判断を再発明せずPhase単位で安全かつ高速に実装するための実行契約  
状態: **実装補助資料**。current status、完了台帳、設計書の代替ではない。

## 1. 正規情報源と優先順位

実装開始時は必ず次の順で読む。

1. `AGENTS.md`
2. `docs/README.md`
3. `docs/bcu-migration-status.md`
4. `docs/RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`
5. `docs/RHG_COMMUNITY_STAGE_PLATFORM_COMPLETE_DESIGN_2026-07-24_FINAL.md`
6. このディレクトリの対象Phase文書
7. 現在のコード、テスト、migration、open PR/Issue

優先順位は常に次の通り。

```text
current code + connected deterministic checks
> merged PR / active Issue
> 7/23 core architecture reference
> final community design
> this execution guide
> historical plans/reports
```

このガイドと現行コードが食い違う場合、推測でガイドへ合わせない。差分を調査し、owner・契約・受入条件のどれが変わったかを報告して停止する。

## 2. 絶対不変条件

- online層の失敗を通常プレイ、既存編成、local CustomStage、local JSON入出力、既にimport済みstageへ波及させない。
- `semantic-strict`、BCU frame/world単位、battle phase順、damage/proc/render順を変えない。
- `js/boot/groups/*` のimport順、prototype wrapper chain、元method呼出しを変更しない。
- online payloadを直接`BattleScene`へ渡さず、既存CustomStage normalize → validate → adapterを通す。
- BCU CSV index、save schema、runtime holder、capacity ownerを推測で作らない。
- broad `try/catch`、0、空配列、silent fallbackで不整合を隠さない。
- password、session token、Turnstile secret、admin bootstrap値、raw IPをcommit・log・fixtureへ入れない。
- mutationとcounter、idempotency、aggregate更新を別transactionへ分離しない。
- deterministic checkが証明する範囲を超えて「完成」「互換」「visual accepted」と報告しない。
- Phase外の先行実装、無関係なrename/refactor/format、既存UIやruntimeの全面置換をしない。

## 3. Phase依存関係

```text
Phase 0 audit
  -> Phase 1 schema v3
    -> Phase 2 home shell
      -> Phase 3 Cloudflare foundation
        -> Phase 4 auth
        -> Phase 5 canonical publish/import
          -> Phase 6 browse
          -> Phase 7 social
          -> Phase 8 stats
          -> Phase 9 restrictions
            -> Phase 10 fallback/admin
              -> Phase 11 acceptance
```

Phase 4〜9は一部並行実装できるように見えても、同じmigration/API/common middlewareを触る。1ブランチ1Phaseを原則とし、mainへmerge済みの直前Phaseから開始する。

## 4. Phase別ガイド

| Phase | 文書 | 主な危険 |
|---:|---|---|
| 3 | `phase-3-cloudflare-foundation.md` | binding混同、migration順、secret漏洩、環境差 |
| 4 | `phase-4-auth.md` | session/CSRF/Turnstile/rate limit/admin権限 |
| 5 | `phase-5-canonical-publish-import.md` | hash不一致、R2/D1部分成功、lineage偽装、画像検証 |
| 6 | `phase-6-browse.md` | pagination非決定性、日本語検索、state復元、fallback境界 |
| 7 | `phase-7-social.md` | 二重counter、競合、rate limit、非表示状態 |
| 8 | `phase-8-stats.md` | retry/順序逆転、二重加算、outbox、compaction |
| 9 | `phase-9-restrictions.md` | stat解決順、plus level、combo除外、will+1 capacity |
| 10 | `phase-10-fallback-admin.md` | 破壊的操作、世代publish、権限、rebuild/orphan処理 |
| 11 | `phase-11-acceptance.md` | 未検証範囲、security/load/rollback、誤った完了宣言 |

## 5. Terra共通実行手順

### 5.1 Preflight

最初に以下を実行・記録する。

```bash
git status --short --branch
git rev-parse HEAD
git fetch origin main --prune
git rev-list --left-right --count origin/main...HEAD
npm run agent:context -- --topic community
npm run agent:find -- --topic community
```

続けて対象Phaseの既存owner、関連migration、API route、checkを`rg`で確認する。存在しないpathを設計書だけから作ったことにしない。

### 5.2 実装前宣言

コード変更前に、CLI出力へ次を短く列挙する。

```text
- fixed HEAD
- Phase objective
- prerequisite result
- current owners
- planned files and reason
- files/import order that must not change
- unresolved questions
```

owner不明、契約矛盾、mainとの差分、secret不足、Cloudflare実環境不足があっても、ローカルで安全に進められる範囲と停止すべき範囲を分ける。

### 5.3 実装

- Phase文書の順序で進める。
- 小さな純関数・validation・transaction helperを先に作る。
- clientとserverで同じ契約が必要な処理は、同じfixtureで比較する。
- D1 mutationは必ず「row変更＋counter/idempotency/audit」を一つのtransaction境界で設計する。
- network失敗はcommunity UI/outboxへ閉じ込め、battle tick・render・local storeを待たせない。
- feature flag OFFでは既存RHGと実質同一の入口・挙動を維持する。

### 5.4 検証

変更した全JS/MJSへ`node --check`を実行する。

```bash
npm run agent:checks -- --changed --run
npm run check
npm test
npm run build
```

対象Phaseのfocused check、必要なPlaywright、D1 local migration、Cloudflare preview確認を追加する。既知のbaseline failureがある場合は、今回の回帰と区別して完全なlogを残す。assertやtimeoutを弱めて通さない。

### 5.5 自己レビュー

実装後、別の立場で次を確認する。

```bash
git status --short
git diff --check
git diff --stat
git diff --name-status origin/main...HEAD
git diff origin/main...HEAD
```

確認項目:

1. Phaseの受入条件をすべて証明したか。
2. Phase外実装や無関係な依存追加がないか。
3. normal/offline/flag-offの既存経路を壊していないか。
4. transaction、idempotency、retry、partial failureが閉じているか。
5. client入力・role・hash・lineage・counterをserverが信用していないか。
6. secret、token、raw IP、個人データ、tmp/log/PIDがtrackedになっていないか。
7. testが実装文字列だけでなくobservable behaviorを証明しているか。
8. 未実行の実環境・実機確認を明示したか。

問題を見つけたら修正し、同じレビューを再実行する。

## 6. 停止・Solへ昇格する条件

次のいずれかでは、Terraが仕様を補完して進めず、調査結果と選択肢を報告する。

- final designと現行mainでowner・データ順・API契約が衝突する。
- battle/formation/custom-stageのprototype patch順変更が必要に見える。
- D1 transactionだけでは原子的に閉じないR2との部分成功が残る。
- security要件を満たす複数案があり、公開APIやschemaを固定する判断が必要。
- current Cloudflare仕様・制限が設計前提と異なる。
- migration rollbackにDROP/破壊的変換が必要。
- restriction statを既存resolverから得られず、近似式を作る必要がある。
- testが既存baseline failureと今回の回帰を区別できない。
- diffがPhase想定を大きく超え、責務境界が変わる。

## 7. 完了報告フォーマット

```text
## Result
- Phase:
- HEAD:
- Result: complete / blocked / partial

## Changed
- path: responsibility

## Contracts preserved
- offline/local path
- feature flag OFF
- boot/wrapper order
- schema/API compatibility

## Verification
- command: PASS/FAIL
- browser/preview/device evidence

## Findings fixed during self-review
- severity / cause / fix / regression test

## Remaining risks
- unverified environment/device/permission
- explicit blockers

## Diff scope
- Phase-external changes: none / list with justification
```

## 8. 共通Terra起動プロンプト

対象Phase文書末尾のプロンプトを使う。共通前置きは次の通り。

```text
Rainforest-2/rhg の指定Phaseだけを実装してください。
最初に AGENTS.md、docs/README.md、7/23中核参照書、最終community設計書、対象Phaseガイドを読み、current HEADとownerを再監査してください。

設計書やガイドを現行コードより優先して盲目的に適用せず、差分があれば変更前に報告してください。
Phase外の先行実装、無関係なrefactor、boot/import/wrapper順変更、silent fallback、test弱体化は禁止です。

実装・focused tests・full available checks・build・必要なbrowser/Cloudflare確認・git diff自己レビューまで行い、問題があれば修正して再検証してください。
コード変更前に予定ファイルと理由を列挙し、完了時は本READMEの報告形式で返してください。
```
