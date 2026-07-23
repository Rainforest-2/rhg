# RHG / BCU 中核アーキテクチャ・ゲームロジック参照書

> **対象リポジトリ:** `Rainforest-2/rhg`  \
> **現行コード基準:** `main` / 確認HEAD `604ebb85927a563d37498cb680600c81f2efe6d3`  \
> **作成日:** 2026-07-23  \
> **用途:** 実装、レビュー、デバッグ、BCU整合性監査、後続AIへの引継ぎの一次入口

## 0. この文書の効力と限界

この文書は、現行 `Rainforest-2/rhg`、チェックイン済み/添付済みの BCU 共通・PC・Android参照コード、BCU Animation Guide、CSV index資料、アセットインベントリ、現行のパリティ文書を一つの設計モデルへ統合したものである。

**完全性の意味:** 利用できたスナップショットについて、実装オーナー、起動順、主要データフロー、状態遷移、参照コード対応、検証境界を追える状態を指す。PONOS非公開ソース、未実行の実機視覚比較、将来のコミットまで既知であるという意味ではない。未確認事項は未確認のまま記録する。

### 0.1 証拠の優先順位

1. 現行 `Rainforest-2/rhg` のコードと、そのコードに接続された決定的チェック。
2. `references/bcu/` または本調査に添付された BCU 共通/PC/Androidソース。
3. 生成済み semantic ZIP のmanifest/indexと実アセットインベントリ。
4. 現行の `docs/bcu-migration-status.md`、能力status、visual ledger。
5. Animation Guide、Tutorial、CSV index、Tips。
6. 過去レポート。現行コードと一致する箇所だけ履歴資料として使う。

### 0.2 事実タグ

- **CURRENT-RHG:** 現行コードで確認した事実。
- **BCU-REF:** BCU参照コードで確認した事実。
- **PROJECT-POLICY:** 現行README/AGENTS/statusが定める保守規則。
- **VISUAL-ACCEPTED:** プロジェクト台帳上accepted。一次キャプチャの強さは注記する。
- **HISTORICAL:** 古い実装/レポート。現状判定には直接使わない。
- **UNCONFIRMED:** ソース、loader、fixture、視覚比較の不足により断定不可。

## 1. 一文で表す全体像

`rhg` は、**BCUデータをsemantic ZIPから読み、BCUの一体型 `StageBasis/Entity/Attack` ロジックをブラウザ向けの明示的なscene phase・actor state・projectile runtime・Canvas rendererへ分解して再構成する、Vite/ESMベースの戦闘再現アプリ**である。

```text
index.html
  -> js/main.js
     -> UI patch group
     -> BCU asset helper patch
     -> Battle patch groups [core -> projectile -> scene -> direct -> lifecycle -> renderer]
     -> BcuBootLoader / SemanticAssetProvider
        -> generated semantic indexes
        -> core-db.zip + actor/stage/background/castle/icon/language/effect ZIPs
        -> repositories + BcuAssetDatabase
     -> combo/talent registries
     -> post-load runtime patches [audio/overlays/music]
     -> PreviewApp
        -> FormationEditor -> BattleScene -> fixed 30fps tick
        -> BattleSceneRenderer -> 60fps paint
```

## 2. 絶対に守る不変条件

- 既定モードは `semantic-strict`。生成済みsemantic ZIPが実行時の正規ソースであり、`public/assets/bcu/**` を静かなfallbackにしない。
- BCUのCSV列、proc holder、save schema、effect aliasを名前の印象から捏造しない。
- prototype patchのimport順とwrapper chainは挙動の一部。元関数呼出しを外して単純置換しない。
- 通常の城に汎用attack ownerを作らない。攻撃する特殊拠点は `EEnemy` owner、出現条件はstage owner。
- 決定的チェックは assertion した範囲だけを証明する。見た目のtiming/position/scale/layer/cleanupは手動比較が必要。
- ローカル `localStorage` 往復をBCU save/lineup互換と呼ばない。
- 乱数、target selection、side ownership、frame unitをBCU根拠なしに変更しない。
- エラーや不確実性を広い `try/catch`、0値、空配列、silent fallbackで隠さない。
- raw CSV値、BCU内部値、rhg world/pixel値を同じ単位として扱わない。
- 古いレポートの「未実装」を、現行boot graphとcheckを見ずに再度blockerへ戻さない。

## 3. 現行リポジトリの論理ファイル構成

| 層 | 主ファイル/ディレクトリ | 責務 |
|---|---|---|
| 入口・配信 | `index.html` | canvas/PWA/install gate/CSS cascade/ESM entry |
| 起動 | `js/main.js` | progress、patch install、semantic DB、registry、PreviewApp start |
| 起動順SSOT | `js/boot/groups/*.js` | UI/core/projectile/scene/direct/lifecycle/renderer/runtimeの順序 |
| データ起動 | `js/bcu/BcuBootLoader.js` | semantic indexes→core-db→repositories→global DB |
| アセット境界 | `js/bcu/SemanticAssetProvider.js` | ZIP read/cache/index lookup/object URL/raw fallback guard |
| DB/Repository | `js/bcu/BcuAssetDatabase.js`, `Bcu*Repository.js` | unit/enemy/stage/background/castle/language access |
| アニメーション | `js/bcu/BcuSpriteSheet.js`, `BcuModelInstance.js`, `BcuAnimator.js`, `AnimationRuntime.js` | imgcut/mamodel/maanim評価 |
| アプリ制御 | `js/preview/PreviewApp.js` | formation→battle transition、30fps logic/60fps render |
| 時計 | `js/preview/BattleSimulationClock.js`, `js/battle/BattleFrameClock.js` | 固定tick、no catch-up、BCU frame period |
| 戦闘本体 | `js/battle/BattleScene.js` | scene state、19 phase、spawn/attack/effect/base/camera orchestration |
| エンティティ | `js/battle/BattleActor.js`, `BattleBase.js`, `BattleActorFactory.js` | actor/base stateとasset template生成 |
| 攻撃 | `BattleAttackProfile.js`, `BattleAttackResolver.js`, `BattleAttackTimeline.js` | multi-hit timing、range、target capture |
| ダメージ | `DamageCalculator.js`, `DamageAbilityResolver.js`, `AbilityModel.js` | 倍率、trait、ability、critical/metal等 |
| ステージ | `StageDefinitionLoader.js`, `StageRuntime.js`, `BcuStageSpawnRuntime.js`, `StageRegistry.js` | CSV parse、座標、出現、選択/永続化 |
| 生産・経済 | `BattleEconomy.js`, `ProductionRuntime.js`, `FormationStore.js`, `ELineUp相当patch` | 財布、収入、コスト、再生産、2×5 lineup |
| projectile | `BattleWaveRuntimePatch.js`, `BattleSurgeRuntimePatch.js`, `BattleBlastRuntimePatch.js` | 波動/烈波/爆波 container |
| 状態・能力 | `js/battle/bcu-runtime/*` + `BattleActor*Patch.js` | proc、免疫、耐性、status/effect |
| 描画 | `BattleSceneRenderer.js` + renderer/effect patches | 背景/城/actor/effect/HUD/layer/glow |
| UI | `js/ui/*` | formation、production bar、speed、pause、mobile responsive |
| カスタムステージ | `js/custom-stage/*` | schema/store/validator/resolver/adapter/audio |
| 音 | `js/audio/*` | BGM/SE catalog、voice pool、settings、stage music |
| 検証 | `scripts/check-*.mjs`, `tests/*.test.mjs` | 決定的な局所証明、Playwright受け入れ補助 |
| ドキュメント | `README.md`, `AGENTS.md`, `docs/bcu-migration-status.md`, `docs/ability-logic/*` | 現状・根拠・blocker・visual ledger |
| 参照コード | `references/bcu/*` | BCU共通/PC/Androidを事実根拠として保持 |

### 3.1 起動時patchの厳密な順序

#### UI group
`CustomStageBoot -> FormationEditorPerformance -> FormationCatalogVirtualDom -> NyankoPresentation -> FormationJapaneseBoot -> NyankoUiBehavior -> ProductionCardDogIconFit -> FormationEditorBcuUnitLevel -> FormationCharacterTuningMobileLandscape -> FormationCustomStageBattle -> FormationStageDifficulty -> DifficultyFilterControl -> UiRegressionFix -> PhoneLandscape -> PhonePortrait -> CustomStageBattleHp -> ApplyHpConfig -> CustomStageBuilder -> StageNameBcu -> PremiumMotion(last)`

#### Battle groups

1. **Core:** damage diagnostics → critical effect → AB_METALIC resolver → strict config → negative spawn → KB target → proc status owner → toxic asset → unit level → delay → barrier/shield → soulstrike → burrow → deterministic random → attack nullify。
2. **Projectile:** wave → blocked-hit wave → surge → blast → base projectile proc → runtime bugfix → StageRuntime wiring → renderer order → unit layer。
3. **Scene:** timer → lineup → stage spawn → castle guard → cannon → spirit → button delay → custom stage → spawn header → attack phase → proc apply → wave invalid apply → proc runtime → summon → StageBasis bridge → bounty → status icon/effect → StageBasis tick → custom base HP → enemy entity base。
4. **Direct input:** friendly-fire guard → BCU touch → mobile input。
5. **Actor lifecycle:** KB runtime/priority → strengthen/lethal → zombie revive → glass → death sound/animation → KB visual → immunity/resist visual → priority effect → attack/hit effects → projectile visual parity/performance → crowd performance。
6. **Renderer:** origin → HUD → actor glow → effect glow → debug strip(last)。
7. **Post-load runtime:** sound event → custom stage config → result overlay → pause overlay → page transition → battle music。

**なぜ順序が仕様か:** 後段patchは前段のprototype methodを包む。`queueAttackDamage`, `runTickPhase`, `drawEffects`, `drawActor`, `applyBcuProc` などでoutermost wrapperが変わると、damage/proc/cleanup/描画順が変化する。

## 4. アセット・データ起動パイプライン

### 4.1 semantic index

`SemanticAssetProvider` は次の9 indexを順番に読む。actor/stage/backgroundはruntime向けslim indexを先に試し、full indexへfallbackする。

1. `bcu-bundle-manifest.json`
2. `bcu-actor-index.slim/full.json`
3. `bcu-stage-index.slim/full.json`
4. `bcu-background-index.slim/full.json`
5. `bcu-castle-index.json`
6. `bcu-core-index.json`
7. `bcu-icon-index.json`
8. `bcu-language-index.json`
9. `bcu-canonical-index.json`

### 4.2 core boot

```text
SemanticAssetProvider.load
  -> install RuntimeAssetGuard
  -> readCoreDb(core-db.zip)
  -> BcuLangStore.fromCoreDb
  -> BcuEnemyRepository.fromCoreDb
  -> BcuUnitRepository.fromCoreDb
  -> BcuBackgroundRepository.fromCoreDb
  -> BcuCastleRepository.fromCoreDb
  -> BcuStageRepository.fromCoreDb
  -> BcuAssetSetRepository
  -> error-enemy.json / error-ally.json
  -> BcuAssetDatabase(global)
```

### 4.3 ZIP runtime

- STORE(method 0)とDEFLATE(method 8)をブラウザ内で解凍する。
- bundle fetch promise、archive、core JSON、icon/image object URLをcacheする。
- actor bundleの最低要件は image + imgcut + model + move/idle/attack/kb animation。
- trailing-byte image warningだけのinvalid actorは、必要ファイルが揃う場合runtime usableとして扱う。
- aggregate iconは `enemy:ID`、`unit:ID:form` からcanonical pathを推定できるが、actor本体画像fallbackとは分離する。

### 4.4 実アセット規模

- 調査時root: `public/assets/bcu`
- 総ファイル: **47,237**
- 総サイズ: **573.24 MB** (601,084,767 bytes)

| Extension | Count |
|---|---:|
| `.png` | 14,841 |
| `.maanim` | 14,012 |
| `.csv` | 10,620 |
| `.imgcut` | 3,642 |
| `.mamodel` | 3,630 |
| `.json` | 471 |
| `.preset` | 10 |
| `.tsv` | 10 |
| `.ini` | 1 |

| Category | Count |
|---|---:|
| `org/unit` | 26,848 |
| `org/stage` | 8,519 |
| `org/enemy` | 7,847 |
| `org/data` | 1,043 |
| `org/img` | 997 |
| `org/battle` | 963 |
| `org/page` | 653 |
| `info.json` | 248 |
| `org/castle` | 119 |

## 5. 時間・座標・単位の契約

### 5.1 時間

- BCUの戦闘ロジック基準は30fps、1 logic frame ≈ 33.333ms。
- `PreviewApp` は `BattleSimulationClock(fixedStepMs=33, maxSubSteps=1, bcu-no-catchup)` でlogicを進める。
- paintは60fps。1xのみ前logic位置と現在位置を補間し、2x以上では補間を切る。
- stage CSVのspawn/respawnなどには `FRAME_MUL=2` がある。raw列値と内部frameを混同しない。
- BCU攻撃周期は `max(animation length, longPre + max(TBA-1, post))`。rhg `BattleAttackProfile.buildBcuTiming` がこの契約を保持する。

### 5.2 座標

- stage worldの基準: enemy castle=800、enemy normal spawn=700、player castle=`stageLen-800`、player spawn=`stageLen-700`。
- 特殊castle/bossは `boss-spawns.json` / `CastleImg` 根拠の `bossSpawnWorldX` を使う。
- actorの `x`、combat front、visual anchor、sprite local coordinateは別物。target/damageはcombat body、描画はmodel transformを使う。
- `DataUnit` の速度や射程にはraw倍率（例: speed×2、range×4）があり、loader/coordinate変換後の値だけをsceneで使う。

## 6. BattleSceneの状態と19段階tick

| # | Phase | Owner/意味 |
|---:|---|---|
| 1 | `advance-clock` | logic frame/time/BCU timerを進める |
| 2 | `player-production-requests` | 入力済み出撃要求を検証・消費 |
| 3 | `enemy-spawn` | SCDef/EStage相当の条件で敵を生成 |
| 4 | `economy` | 所持金、財布、収入、キャノンcharge、cooldown |
| 5 | `lineup-change` | 2×5前後列の切替フレーム |
| 6 | `actor-state-update` | status、attack/KB/death/burrow/warp等のowner状態 |
| 7 | `movement` | 停止/接触/方向/速度を考慮して位置更新 |
| 8 | `target-search` | side/trait/touch/range/単体最前列を評価 |
| 9 | `attack-start` | 攻撃開始可否とanimation切替 |
| 10 | `attack-timeline` | multi-hitのdue eventを進める |
| 11 | `hit-target-capture` | 発生時点の対象集合を固定 |
| 12 | `damage-resolve` | 攻撃力・ability・防御・barrier/shield等 |
| 13 | `proc-resolve` | 確率proc、免疫、耐性、status、summon/projectile要求 |
| 14 | `knockback-death` | HB、KB、lethal、corpse、kill lifecycle |
| 15 | `base-post-update` | 城HP、guard、勝敗、特殊敵城 |
| 16 | `effect-spawn` | hit/status/death/projectile effect生成 |
| 17 | `effect-tick` | container/effect animation/lifetime |
| 18 | `cleanup` | dead/finished/pending listの削除とlist merge |
| 19 | `camera-update` | stage clamp、pan/zoom、shake |

BCU `StageBasis.update` は概ね、stage allow→entity update→attack capture→attack excuse→postUpdate→delay反映→cleanupを一つのmethodで行う。rhgのphase分割は処理順を可視化したもので、自由に並べ替えてよいという意味ではない。

## 7. Actorライフサイクル

```text
spawn/added
  -> move
     -> target found -> attack-start -> attack -> post-attack wait -> move/attack
     -> proc/status can stop/slow/weaken/curse/seal/warp/burrow
  -> damage accumulated
     -> barrier/shield/attack-nullify/damage-cap-cut
     -> HP boundary -> knockback
        -> recover to move/attack
        -> final KB -> dying/death
  -> zombie corpse/revive OR spirit/summon special cleanup OR removed
```

### 7.1 BattleActorが保持する主要状態

- identity/side/position/scale/facing/direction/layer
- raw stats、ability model、trait、attack hit data
- HP/maxHP、KB回数・境界・motion frame・targetability
- attack cycle id、timeline elapsed、resolved hit keys、target
- pending hits/damage/procs/knockback/death
- status timer/payload、barrier、demon shield、immunity/resistance
- animation role/id、model/sprite/animator、effect attachments
- burrow/warp/revive/summon/spirit/guard関連のpatch-owned state
- combat bodyとvisual anchorを分離するdebug/source metadata

### 7.2 targetable/touchable

- aliveだけでは不十分。KB初期frame、corpse show window、burrow地下、warp hidden、attack-nullify、base特殊状態を考慮する。
- `touchable` は接触・target capture・counter・base hitに影響する。描画可否と同一にしない。
- traitsは共有traitだけでなく `targetType/targetForms` metadataを単一gateで評価する。

## 8. 攻撃・対象捕捉・ダメージ・proc

### 8.1 攻撃構築

`BattleAttackProfile.fromActor` は `stats.attackHits` を、各hitの `atMs`, damage, targetMode, LD/Omni range, per-hit ability/proc/summonへ正規化する。連続攻撃の発生時刻は相対ではなく、loaderで確定したBCU frame契約を使う。

### 8.2 対象捕捉

- 通常: actor前方の感知/攻撃範囲。
- range attack: 条件を満たす全対象。
- single attack: BCU `AttackSimple.capture` 相当で最前列を一つ。完全同位置は決定的乱数を使う。
- LD: short pointからlong pointの区間。感知射程とhit範囲は別。
- Omni: 後方を含む負側rangeを許す。
- base hit: `allowBaseHit`, touchBase, side, special enemy base ownerを考慮。
- 対象限定: trait compatibilityとtarget-only gateをcaptureとprocの双方で共有。

### 8.3 被弾の概念順

BCU `Entity.damaged` とrhgのresolver/patch群を統合すると、概念上の順序は次のようになる。

1. 入力攻撃値と攻撃metadataを受け取る。
2. 攻撃側/防御側の属性・ability・倍率を解決する。
3. キャノン、波動、移動波、烈波、爆波の免疫/軽減を判定する。
4. attack-nullify/dodge、damage cut/capを判定する。
5. barrierをbreak/absorbし、必要ならprocを取消す。
6. metal/critical/strong等の最終ダメージ補正と専用effect/SE。
7. demon shieldをbreak/減算し、shieldが残る場合HPへ通さない。
8. HP damageとproc tokenを蓄積する。
9. counter/summon/projectile/death side effectを予約する。
10. post-updateでHP境界、KB、lethal、death/reviveを確定する。

### 8.4 Procの共通原則

- `prob=0` 不発、`prob=100` 確定、それ以外はbattle seed由来の乱数。
- proc dataとeffect assetは別責務。効果が動くことと見た目一致は別。
- curse/sealは「既存statusの削除」と「新規procの無効化」を能力ごとのBCU根拠で分ける。
- immunity 100%は完全拒否、部分値は時間/強度/ダメージを縮小する場合がある。procごとに同じ式とは限らない。
- `DELAY` はunit cooldown owner (`ELineUp`) とenemy stage-row owner (`EStage`)へ分岐する。
- SUMMONはproc-object/custom attack data。通常unit/enemy CSVにholderを発明しない。

## 9. Projectile・範囲継続攻撃

| 系統 | BCU owner | rhg owner | 重要契約 |
|---|---|---|---|
| 波動/小波動 | `AttackWave`, `ContWaveDef/Canon` | `BattleWaveRuntimePatch` | 次wave生成、stopper、layer、mini倍率/種別 |
| 烈波/小烈波 | `AttackVolcano`, `ContVolcano` | `BattleSurgeRuntimePatch` | level×20F、20Fごとcapture、START/DURING/END |
| 爆波 | `AttackBlast`, `ContBlast` | `BattleBlastRuntimePatch` | blast segment/捕捉/終了 |
| デス烈波 | death animation/AtkModelEntity | death runtime + surge runtime | 死亡ownerが一度だけspawn、full/mini排他 |
| 移動波/キャノン | `Cannon`, wave container | cat-cannon + projectile patches | キャノンid、速度/幅/時間/距離/interval |

container lifecycleと描画effect lifecycleを同じ物として扱わない。damage containerは生きていても古いphase visualを終了すべき場合があり、逆にvisual cleanupがdamage実行を消してはならない。

## 10. 特殊ライフサイクル

### 10.1 Zombie revive / corpse / soulstrike

- ownerはentity。死亡時に即削除せずcorpse stateへ入る。
- revive show windowだけtargetabilityが変わる。
- zombie killerはrevive抑制、soulstrikeはcorpseへの攻撃/取消を制御。
- revive HP/time/count、extra/custom reviveのsource/range/zombie/warp filterを保持する。
- death surgeは死亡時一回だけ。reviveと重複spawnしないようserial/flagで守る。

### 10.2 Burrow

`DOWN -> underground movement -> UP -> normal`。地下中はtouch/target/drawの可否がphase依存であり、単純なopacity=0ではない。距離はDataEnemy raw holderからBCU変換する。

### 10.3 Warp

entry interruption -> hidden/in transit -> destination resolve -> exit -> normal。位置更新、targetability、animation/effect、summon originを同時に扱う。

### 10.4 Spirit

proc statusではなくproduction/stage state。summonerごとのone-shot、cooldown、ready emphasize、side cap、pre-warp origin、post-conjure 1F production lock、attack-on-add、damage rejection、boss shockwave immunity、自動cleanupを持つ。

### 10.5 SUMMON

attack modelがimmediate/on-hitまたはdelay付きspawnを予約し、`EntCont` 相当が後でentityをsceneへ追加する。stage group/allow、same_health、bond_hp、side/layer/position、anim_typeを別々に解決する。

## 11. Stage・敵出現・城

### 11.1 Stage CSV列とSCDef内部列

| Meaning | Raw CSV | SCDef internal |
|---|---:|---:|
| E enemy id | 0 | 0 |
| N count | 1 | 1 |
| S0 first spawn | 2 | 2 |
| R0 respawn min | 3 | 3 |
| R1 respawn max | 4 | 4 |
| C0 base HP trigger | 5 | 5 |
| L0 layer min | 6 | 6 |
| L1 layer max | 7 | 7 |
| B boss flag | 8 | 8 |
| M HP magnification | 9 | 9 |
| SC score | 10 | 15 |
| M1 ATK magnification | 11 | 13 |
| negative S0 flag | 12 | sign transform |
| KC kill count | 13 | 14 |

- main-story CH系はcastle rowが無く、headerがline 0。row shapeで判定する。
- enemy idはraw表示idから内部asset idへoffsetする。
- count=0はinfinite。
- max enemyは正値を最大50にclamp。
- base enemy idに一致するrowはnormal scheduleから外し、特殊敵城actorにする。
- crown/星倍率は各enemy rowのHP/ATK magnificationに適用する。
- HP trigger、kill-count、group/allow、boss flag、spawn delayはstage ownerで評価する。

### 11.2 城の所有権

- normal castle: HP/body/visual owner。汎用attackは持たない。
- boss enemy base: `EEnemy` actor owner。攻撃・能力・KB/死亡はenemyと同じ。
- castle guard: base damageをholdし、break時に解放するscene/base state。
- boss spawn coordinate: castle-specific auxiliary data。固定700へ潰さない。

## 12. 経済・生産・lineup・育成補正

### 12.1 deploy cost

```text
raw DataUnit.price
 -> PCoin PC2_COST (raw price reduction)
 -> Form/EForm stage price: floor(price * (1 + stagePrice * 0.5))
 -> C_DISCOUNT: cost - floor(cost * discount/100)
 -> internal money unit / UI display
```
通常 `stagePrice=1` ならraw priceの1.5倍が基礎配置コスト。

### 12.2 respawn

```text
raw respawn
 -> PCoin PC2_CD
 -> research = (tech-1)*6 + treasure*0.3
 -> C_RESP combo
 -> max(60F, adjusted respawn)
```
global cooldown limit時は短再生産の扱いが別分岐になる。

### 12.3 wallet/economy

- money/maxMoney/work level/upgrade cost/incomeをsceneのeconomy ownerが保持。
- max walletとincomeのcombo式は対称ではない。整数除算/加算順を変えない。
- production requestはbattle running、slot存在、affordable、cooldown readyを検証してからmoney/cooldownを更新し、actor spawnはscene ownerへ渡す。
- lineupは2行×5列。front row切替はanimation中の入力/slide/production card hit-testingと同期する。

### 12.4 modifierの適用層

| Modifier | 主な適用地点 |
|---|---|
| Treasure | unit HP/ATK、fruit倍率、wallet/research/cannon、alien/star |
| Combo | basis/lineup increments、speed/crit/proc duration/price/cooldownなど |
| Orb | trait条件付きATK/RES/MASSIVE/GOOD/ability |
| PCoin/Talent | raw stats/proc payload/ability/price/respawn |
| Crown/Star | enemy row HP/ATK magnification |
| Stage limits | 出撃可否、rarity/count、combo ban、cooldown/global rules |

## 13. Animation・描画

### 13.1 ファイル契約

| File | 役割 | 主要値 |
|---|---|---|
| `.png` | sprite sheet | pixel image |
| `.imgcut` | sprite sheetの矩形分割 | id, x, y, width, height, name |
| `.mamodel` | parts treeと初期transform | parent, image, z, pos, pivot, scale(1000中立), angle(3600=360°), opacity(255), glow |
| `.maanim` | part propertyのkeyframe列 | part, property, loop, frame, value, easing |

### 13.2 model評価

1. `BcuAnimator` がanimation frameから各trackの値を補間する。
2. `BcuModelInstance/AnimationRuntime` がbase modelへtrack値を適用する。
3. 親→子のpivot/position/scale/angle/flip/opacityを合成する。
4. z/layer/glow/extend metadataでdraw listを整理する。
5. `BattleSceneRenderer` がcamera/world transformとactor ground anchorを加える。
6. attack/status/KB/projectile/base/HUD effectを所定layerへinterleaveする。

### 13.3 easing/loop

- loop `-1`: 無限継続、animation role変更まで止まらない。
- loop `1`: 非ループ/終端待機として扱う資料記述。
- easing `0`: linear。
- easing `1`: skip/step系。
- easing `2`: parameter付き補間。
- easing `3`: sine系ease。

### 13.4 描画で壊れやすい点

- model mutationを跨いだdraw-list cacheは危険。attack/KB/frame/parentMatrixをkeyに含めないcacheは使わない。
- combat positionをsprite boundsから毎frame再推定するとanchor jumpが起きる。stable anchor/sourceを保持する。
- effectの存在、damage発生、visual phaseは別timer。
- glowは黒透過/合成modeに関わり、通常alpha描画へ単純化しない。
- actor layerだけでなくeffect layer、base smoke、wave/surge containerのinterleaveが必要。

## 14. Audio

- BCU sound id `0..190` をvendored audioへ解決する。
- sortie時は選択stage BGMとhot SEだけを先読みし、その他は初回要求時にwarmする。
- HTMLAudio voice poolで同時SE要求を奪い合わない。
- `CommonStatic.setSE` 相当の同frame dedupeは同一要求の重複だけを抑え、CRIT/SATK/HITの異種SEは独立再生する。
- boss musicはthreshold 0/100を無効扱いとし、整数切捨て後strict `<` で切替える。
- visibility pause、page transition、result/pause overlayとBGM ownerを競合させない。

## 15. UI・入力・カスタムステージ

### 15.1 UI所有者

- `FormationEditor`: unit catalog、2×5 formation、stage selector、settings、custom stage、apply battle。
- `PlayerProductionBar`: cost/cooldown/card state、lineup slide、wallet/cannon/spirit ready表示。
- `BattleSpeedControl`: simulation multiplier。render targetは60fps維持。
- `BattlePauseMenu`/Preview overlays: pause、abort、result、page transition。
- phone landscape/portrait CSS+patchはheight/orientation基準。iOS safe-areaとdynamic viewportを考慮。

### 15.2 入力

- DOM touch guard→battle coordinate変換→production/card/cannon/cameraの優先順位。
- friendly-fire guardはside ownershipを入力段階でも守る。
- camera pan/pinch/wheelはrender transformであり、logic world coordinateを直接変えない。
- line-up swipeはBCU定数とproduction card gesture conflictを考慮。

### 15.3 Custom stage

`Schema -> Store -> Validator -> ReferenceResolver -> AssetCatalog -> Adapter -> BattleStore -> BattleSceneCustomStagePatch` の順。typed referencesを用い、古いconfigはboot時にschema migrationする。HP、BGM、背景、城、敵row、選択sideを通常stage runtimeへadapterで渡す。

## 16. BCU参照コードとrhgの対応表

| 領域 | BCU owner | RHG owner | 解釈 |
|---|---|---|---|
| 戦闘全体・フレーム進行 | `StageBasis.update`, `BattleField.update` | `BattleScene.tick` + boot patch chain + `BattleSimulationClock` | BCU は一体化した update、rhg は19 phaseへ明示分割 |
| ステージ出現 | `Stage`, `SCDef`, `EStage.allow/update` | `StageDefinitionLoader`, `StageRuntime`, `BcuStageSpawnRuntime`, stage-spawn patches | raw CSV列→SCDef内部列の変換を境界で固定 |
| エンティティ基底 | `Entity` + nested managers | `BattleActor` + lifecycle patches | 攻撃/KB/状態/死亡をprototype patchで段階追加 |
| 味方補正 | `EUnit`, `BasisLU`, `Treasure`, `Orb`, `PCoin` | stats loaders + combo/talent registries + damage/production resolvers | 構築時補正と被弾時補正を分離 |
| 敵補正 | `EEnemy`, `DataEnemy` | `BattleStatsLoader`, `BcuStageEnemyResolver`, `DamageAbilityResolver` | ステージ倍率・属性・ドロップを明示 |
| 攻撃モデル | `AtkModelEntity/Unit/Enemy`, `AttackAb`, `AttackSimple` | `BattleAttackProfile`, `BattleAttackTimeline`, scene attack/proc patches | 攻撃イベントを発生時刻付きhit列へ正規化 |
| 波動 | `AttackWave`, `ContWaveDef/Canon` | `BattleWaveRuntimePatch` | 伝播containerとeffectを分離 |
| 烈波 | `AttackVolcano`, `ContVolcano` | `BattleSurgeRuntimePatch` | START/DURING/END、20F capture、level×20F |
| 爆波 | `AttackBlast`, `ContBlast` | `BattleBlastRuntimePatch` | 専用container/runtime |
| 状態異常 | `Data.Proc`, `Entity.processProcs`, `EUnit/EEnemy.processProcs` | `BattleActorProcStatusPatch`, `BattleSceneProcApplyPatch`, `BcuProcRuntime`, immunity/resist patches | proc holderと表示effectを別管理 |
| KB・割込み | `Entity.KBManager`, `interrupt`, `updateKB` | `BcuKnockbackRuntimePatch`, priority/effect/animation patches | 最終KB、targetable、距離、演出を分離 |
| ゾンビ | `Entity.ZombX`, corpse animation | zombie revive/death animation/soulstrike patches | corpse window、ZK、soulstrike、reviveをentity-owned |
| 潜伏 | `Entity.startBurrow/updateBurrow` | `BattleActorBcuBurrowPatch` | DOWN→地下→UP、touchabilityを状態機械化 |
| 精霊 | `DataUnit[110]`, `StageBasis.spirit*`, Android lineup draw | `BattleSceneBcuSpiritPatch`, spirit runtime, production card skin | procではなく生産/ステージ状態 |
| 召喚 | `Proc.SUMMON`, attack models, `EntCont`, `SCDef` | `BcuSummonRuntime`, `BattleSceneBcuSummonPatch`, `BattleAttackProfile.summon` | proc-object由来。通常CSV holderを捏造しない |
| 城ガード | `StageBasis.activeGuard`, `ECastle` | castle-guard patch/runtime | 城ダメージhold/breakをbase stateで所有 |
| 特殊敵城 | `EStage.base`, `EEnemy` | enemy-entity-base patch + StageRuntime base row | 通常城攻撃ownerを作らず敵actorとして配置 |
| キャノン | `Cannon`, `Treasure`, `CannonLevelCurve` | cat-cannon patch/runtime | id別timing/target/effect。BASE_WALLはentity |
| 描画 | `AnimU/EAnimI/EAnimD/EPart`, PC/AWT/JOGL renderer | `BcuModelInstance`, `BcuAnimator`, `AnimationRuntime`, `BattleSceneRenderer` + renderer patches | モデル評価とCanvas描画、layer/effect interleave |
| 音 | `CommonStatic.setSE/setBGM`, PC `BCMusic/BCPlayer`, Android `SoundHandler` | `AudioEngine`, `BattleSoundEventPatch`, `StageMusicResolver` | 0..190 id、voice pool、frame dedupe |

## 17. 現在のパリティ状態

| 領域 | 状態 | 確認済み | 残る境界 |
|---|---|---|---|
| 停止/減速/弱体/KB | code-complete-candidate | proc/優先順位/耐性/KB lifecycle | 見た目は変更時に再確認 |
| 呪い/封印/毒 | code-complete-candidate | runtime+resistance | effect layer/cleanupを要確認 |
| ワープ | code-complete-candidate | entry/hide/exit/complete | ブラウザ外観 |
| P_DELAY | human-visual-review-needed | cooldown/stage-row delay runtime | 位置・layer・timing |
| 波動/小波動/烈波/小烈波/爆波 | code-complete-candidate | projectile runtime/checks | visual exactnessは別 |
| バリア/悪魔盾/break | accepted (project ledger) | runtime+user visual acceptance | 一次キャプチャ記録は弱い |
| 死亡/デス烈波/AB_GLASS | code-complete-candidate | death owner/checks | mini/full visual |
| 標準ゾンビ蘇生 | accepted (project ledger) | corpse/soulstrike/revive | 追加custom sourceはloader済 |
| Burrow | code-complete-candidate | state/targetability/collision | visual not reviewed |
| Spirit | human-visual-review-needed | production/state/cooldown/one-shot/card state | actor/A_IMUATK/flash |
| SUMMON | human-visual-review-needed | real proc-object loader→spawn verified | entry anim/placement/layer |
| 城ガード | accepted (project ledger) | hold/break runtime | 再差分時は差し戻す |
| 特殊敵城/EEnemy base | code-complete-candidate | base row除外→enemy actor初期配置 | 通常castle attackはnegative evidence |
| 財布/コスト/再生産 | code-complete-candidate | BCU式+registry | UIはwallet accepted |
| 基本キャノン | accepted (project ledger) | runtime/button/fire | 再差分時は差し戻す |
| 非基本キャノン | code-complete-candidate runtime | id別runtime/alias | sweep/travel visual |
| BASE_WALL | code-complete-candidate runtime | Form339 lifecycle | asset/entry/placement visual |
| 音/BGM/SE | code-complete-candidate | 0..190、voice pool、boss threshold | 実機多重/切替 |
| モバイル操作 | code-complete-candidate | touch/slide/pause/camera owners | 実機 acceptance |
| BCU save/lineup import-export | out-of-scope/unconfirmed | rhg local persistenceのみ | BCU serializer/round-tripなし |

### 17.1 acceptedの注意

プロジェクトvisual ledgerのaccepted項目には、2026-07-02ユーザー確認として記録されたものがあり、元のブラウザ/端末/scale/frame captureの一次記録がない行もある。将来mismatchが出た場合は即座に`not-reviewed`または`mismatch`へ差し戻す。

## 18. 変更影響マップ

| 変更対象 | 必ず追う依存 | 最低検証 |
|---|---|---|
| CSV/unit/enemy index | DataUnit/DataEnemy loader→stats→AbilityModel→ActorFactory→damage/proc | parser indexes + real-data fixture + affected ability check |
| Stage CSV | StageDefinitionLoader→StageRuntime→spawn schedule/base/camera/music | parser + stage runtime + target stage browser smoke |
| Attack timing | stats.attackHits→BattleAttackProfile→Timeline→capture/damage | multi-hit timing + second-cycle + zero/negative edge |
| Damage resolver | ability/trait/orb/talent→barrier/shield→HP/KB/death | projectile + immunity/resistance + metal/critical + death |
| Proc runtime | holder→apply gate→status owner→effect owner | proc-specific deterministic fixture + visual if visible |
| KB | damage threshold→interrupt→motion→targetability→animation→return/death | normal/final/wave/boss shock/warp/burrow |
| Wave/surge/blast | proc→container→capture→damage→effect lifetime/layer | damage count, interval, immunity, stopper, cleanup |
| Zombie/death | kill mode→corpse→targetability→revive/ZK/soulstrike/death surge | all lifecycle branches |
| Production/economy | stats/PCoin/combo/treasure→cost/cd→UI→spawn | wallet + production + lineup + spirit lock |
| Renderer | model evaluation→anchor→camera→layer/effect/HUD | visual fixture at multiple viewport/scale |
| Patch boot order | barrel lists→wrapper chain→runtime owner | import graph + boot smoke + affected integration |
| Semantic bundles | generator/index/manifest→provider→repository→loader | bundle manifest + strict raw guard + boot/apply battle |
| Audio | event→id resolver→cache/voice pool→settings/music owner | SE dedupe/multi + BGM/boss transition + visibility |
| Storage | schema→migration→read/write diagnostics→UI | round-trip + failure visibility; do not claim BCU compatibility |

## 19. 検証戦略

### 19.1 基本ループ

```text
BCU source fact
  -> current JS owner and boot reachability
  -> minimal code/data/asset change
  -> node --check
  -> focused deterministic check
  -> adjacent integration checks
  -> build/test
  -> visual ledger update only after real comparison
  -> focused status docs update
```

### 19.2 代表check

- `node scripts/check-bcu-parser-indexes.mjs`
- `node scripts/check-projectile-damage-parity.mjs`
- `node scripts/check-proc-immunity-resistance-parity.mjs`
- `node scripts/check-bcu-delay-runtime.mjs`
- `node scripts/check-bcu-burrow-lifecycle-parity.mjs`
- `node scripts/check-bcu-death-animation-parity.mjs`
- `node scripts/check-bcu-warp-lifecycle-parity.mjs`
- `node scripts/check-bcu-zombie-corpse-soulstrike-parity.mjs`
- `node scripts/check-bcu-barrier-shield-effect-parity.mjs`
- `node scripts/check-bcu-summon-runtime-parity.mjs`
- `node scripts/check-bcu-summon-procobject-loader-parity.mjs`
- `node scripts/check-bcu-trait-targetforms-loader-parity.mjs`
- `node scripts/check-bcu-modifier-realdata-sweep-parity.mjs`
- `node scripts/check-bcu-zombie-extra-revive-source-range-parity.mjs`
- `node scripts/check-formation-storage-failure-visibility.mjs`
- `node scripts/check-bcu-spirit-bundle-manifest-parity.mjs`
- `node scripts/check-bcu-spirit-cooldown-emphasize-parity.mjs`
- `node scripts/check-bcu-castle-guard-parity.mjs`
- `node scripts/check-bcu-wallet-runtime-parity.mjs`
- `node scripts/check-bcu-non-basic-cat-cannon-runtime-parity.mjs`
- `node scripts/check-bcu-battle-sound-effects-parity.mjs`
- `node scripts/check-ability-partial-blockers.mjs`

### 19.3 Visual acceptanceの必須記録

`fixture / reference / reviewed(date, browser/device, scale) / result` を残し、存在だけでなくtiming, position, scale, layer, visibility, cleanupを比較する。

## 20. 既知の危険構造

- prototype patch多段構造。import順変更はコード変更と同じ。
- projectile runtime bugfixとeffect parity/performance patchの責務が近く、重複wrapしやすい。
- debug no-op後もobject生成が残るとhot path allocationになるが、debug API削除は外部観測契約を変える。
- BattleActorが多くのpatch stateを持ち、field名衝突・初期化漏れ・deep copy漏れが起きやすい。
- visual anchor/combat body/camera transformの三座標系があり、見た目補正をhit判定へ流す事故が起きやすい。
- semantic indexのoptional fallbackが空indexを許す箇所と、strictにhard-failすべき必須bundleの境界を混同しやすい。
- current status docsの更新日が異なるため、古いevidence行より最新migration/READMEと現行checkを優先する。
- 巨大アセットrepoのため、全体scan/PlaywrightはメモリとI/Oを圧迫する。変更領域を絞って検証する。

## 21. 公式ゲーム・BCU・rhgの関係

- **にゃんこ大戦争本体:** 実際の挙動の一次実装。ただし内部ソースは非公開。
- **公開解析/Wiki/添付資料:** ステータス、frame、能力、表示用語を補助する。
- **BCU:** 公開コードとして読めるファンメイド再現実装。処理順/holder/データ構造の主要根拠。
- **rhg:** BCU参照をブラウザruntimeへ移植する本プロジェクト。BCUと同じクラス構造を複製せず、ownerと状態遷移の意味を移植する。

したがって、BCUコード一致は公式ゲーム完全一致の証明ではない。最終的な見た目/挙動は再現可能なBCU環境および可能な範囲のゲーム観測と比較する。

## 22. CSV Unit index資料（添付資料の原文転記）

> この表は添付資料の範囲であり、現行loaderの全index保証ではない。実装時はDataUnit/DataEnemyとparser checkを再確認する。

```text
0 体力　χ=Lv.1・全お宝無しの時のステータスで
1 KB
2 速度　2χ
3 攻撃力　χ=Lv.1・全お宝無しの時のステータスで
4 攻撃待機(時間)
5 感知射程　4χ
6 コスト　100χ
7 再生産(時間)
8 ※感知される範囲
9 ※感知される範囲
10 対赤
11 
12 攻撃種類　0→単体 1→範囲
13 攻撃発生(時間)
14 ※キャラ出現レーンへ
15 ※キャラ出現レーンへ
16 対浮
17 対黒
18 対メ
19 対白
20 対天
21 対エ
22 対ゾ
23 めっぽう強い
24 ふっとばす(確率)
25 動きを止める(確率)
26 動きを止める(時間)
27 動きを遅くする(確率)
28 動きを遅くする(時間)
29 打たれ強い
30 超ダメージ
31 クリティカル(確率)
32 攻撃ターゲット限定
33 撃破時お金アップ
34 城破壊が得意
35 波動(確率)
36 波動(レベル)
37 攻撃力ダウン(確率)
38 攻撃力ダウン(時間)
39 攻撃力ダウン(何%にするか)
40 攻撃力アップ(発動する残り体力の割合)
41 攻撃力アップ(倍率)　100(χ-1)
42 生き残る(確率)
43 メタル
44 ※攻撃射程へ
45 ※攻撃射程へ
46 無効(波動)
47 波動ストッパー
48 無効(ふっとばす)
49 無効(動きを止める)
50 無効(動きを遅くする)
51 無効(攻撃力ダウン)
52 ゾンビキラー
53 魔女キラー
54 
55 ※攻撃回数へ
56 ※攻撃回数へ
57 ※攻撃回数へ
58 ※攻撃回数へ
59 二撃目威力　※多段ヒット攻撃へ
60 三撃目威力　※多段ヒット攻撃へ
61 二撃目発生f　※多段ヒット発生へ
62 三撃目発生f　※多段ヒット発生へ
63 特性付与(一撃目)
64 特性付与(二撃目)
65 特性付与(三撃目)
66 ※生産時へ
67 ※魂
68 
69 
70 バリアブレイカー(確率)
71 ワープ(確率)
72 ワープ(時間)
73 ワープ(※ワープ先へ)
74 ワープ(※ワープ先へ)
75 無効(ワープ)
76 
77 使徒キラー
78 対古
79 無効(古代の呪い)
80 超打たれ強い
81 極ダメージ
82 渾身の一撃(確率)
83 渾身の一撃(倍率)　100(χ-1)
84 攻撃無効(確率)
85 攻撃無効(時間)　25χ
86 烈波(確率)
87 烈波(発生最短位置)　※烈波発生位置へ
88 烈波(発生最長位置)　※烈波発生位置へ
89 烈波(レベル)
90 無効(毒撃)
91 無効(烈波)
92 呪い(確率)
93 呪い(時間)
94 小波動化　波動onの時のみ有効
95 シールドブレイカー(確率)
96 対悪
```

## 23. BCU参照コードの構成統計

- Common reference: 190 indexed source files, 40,769 lines
- PC reference: 204 indexed source/build files, 45,332 lines
- Android reference: 138 source/build files, 41,201 lines

### Common package distribution

| Package | Files | Lines |
|---|---:|---:|
| `common.battle.attack` | 18 | 2181 |
| `common.util.pack.bgeffect` | 17 | 2986 |
| `common.util.stage` | 16 | 4088 |
| `common.battle.data` | 15 | 2473 |
| `common.util.anim` | 15 | 2626 |
| `common.util.unit` | 12 | 1838 |
| `common.battle` | 11 | 3369 |
| `common.battle.entity` | 11 | 4504 |
| `common.util` | 10 | 3394 |
| `common.io` | 9 | 2036 |
| `common.system` | 9 | 940 |
| `common.pack` | 8 | 2676 |
| `common.io.json` | 7 | 1238 |
| `common.util.lang` | 7 | 2278 |
| `common.util.pack` | 7 | 1501 |
| `common.system.files` | 6 | 385 |
| `common.io.assets` | 4 | 1008 |
| `common.system.fake` | 4 | 178 |
| `common.util.stage.info` | 3 | 416 |
| `common` | 1 | 654 |

### PC package distribution

| Package | Files | Lines |
|---|---:|---:|
| `page.support` | 25 | 2346 |
| `page` | 23 | 3419 |
| `page.anim` | 18 | 5596 |
| `page.pack` | 17 | 5739 |
| `page.info.edit` | 16 | 5494 |
| `page.info` | 14 | 3902 |
| `page.info.filter` | 13 | 2516 |
| `page.battle` | 12 | 3410 |
| `page.basis` | 9 | 2317 |
| `page.view` | 8 | 1384 |
| `utilpc` | 8 | 2327 |
| `jogl` | 7 | 574 |
| `page.awt` | 7 | 680 |
| `utilpc.awt` | 7 | 612 |
| `io` | 5 | 1464 |
| `jogl.util` | 5 | 1175 |
| `main` | 4 | 1061 |
| `(build/root)` | 3 | 91 |
| `res` | 3 | 1225 |

### Android package distribution

| Package | Files | Lines |
|---|---:|---:|
| `com.mandarin.bcu` | 34 | 15396 |
| `com.mandarin.bcu.androidutil.supports` | 15 | 1238 |
| `com.mandarin.bcu.androidutil.lineup.adapters` | 12 | 4099 |
| `com.mandarin.bcu.androidutil.stage.adapters` | 11 | 1730 |
| `com.mandarin.bcu.androidutil` | 9 | 5318 |
| `com.mandarin.bcu.androidutil.io` | 9 | 1482 |
| `com.mandarin.bcu.androidutil.supports.adapter` | 9 | 1224 |
| `com.mandarin.bcu.androidutil.unit.adapters` | 6 | 2463 |
| `com.mandarin.bcu.androidutil.fakeandroid` | 5 | 710 |
| `com.mandarin.bcu.androidutil.battle` | 4 | 2022 |
| `com.mandarin.bcu.androidutil.enemy.adapters` | 4 | 1010 |
| `com.mandarin.bcu.androidutil.filter` | 3 | 719 |
| `com.mandarin.bcu.androidutil.animation` | 2 | 403 |
| `com.mandarin.bcu.androidutil.battle.sound` | 2 | 703 |
| `com.mandarin.bcu.androidutil.music.adapters` | 2 | 151 |
| `main` | 2 | 224 |
| `com.mandarin.bcu.androidutil.castle` | 1 | 130 |
| `com.mandarin.bcu.androidutil.io.drive` | 1 | 39 |
| `com.mandarin.bcu.androidutil.lineup` | 1 | 793 |
| `com.mandarin.bcu.androidutil.medal.adapters` | 1 | 102 |
| `com.mandarin.bcu.androidutil.music` | 1 | 34 |
| `com.mandarin.bcu.androidutil.pack.adapters` | 1 | 214 |
| `com.mandarin.bcu.androidutil.pack.conflict.adapters` | 1 | 482 |
| `com.mandarin.bcu.androidutil.pack.conflict.asynchs` | 1 | 114 |
| `com.mandarin.bcu.androidutil.pack` | 1 | 401 |

## 24. BCUプラットフォーム別の責務

### 24.1 Common

戦闘ロジック、データモデル、animation、pack/JSON/virtual fileを所有する。`StageBasis`, `Entity`, `Attack*`, `DataUnit/DataEnemy`, `Treasure`, `Stage/SCDef/EStage`, `Anim*` がrhg移植の中心根拠。

### 24.2 PC

Swing/AWT/JOGLのeditor/viewer/battle UI、音声、録画、pack editor、animation editorを所有する。共通ロジックを描画・操作・編集画面へ接続するため、draw order、controller、asset loading、UI表示の補助根拠になる。戦闘ロジックの一次ownerは原則Common。

### 24.3 Android

Activity/View、touch/gesture、battle lineup描画、sound handler、file/pack management、mobile lifecycleを所有する。モバイル入力、lineup swipe、spirit card表示、Android画面遷移の根拠として使う。戦闘計算はCommonへのadapterである。

## 25. 文書更新規則

1. 新しいBCU事実を `file/class/method/field/state transition` で記録する。
2. 現行rhg ownerとboot reachabilityを確認する。
3. fixture/checkを追加または更新する。
4. `current-ability-parity-status` を更新する。
5. blockerを解消/追加する。
6. 実ブラウザ比較をした場合だけvisual ledgerを更新する。
7. 高水準結論が変わる場合にmigration status/README/AGENTSを更新する。
8. この中核文書はHEAD、更新日、変更理由、対象ownerを更新する。

## 26. 最終チェックリスト（変更前の質問）

- [ ] その挙動のBCU ownerはどのclass/methodか。
- [ ] raw data holderは本当に存在するか。
- [ ] 現行rhg ownerはboot graphから到達可能か。
- [ ] 同じmethodを何個のpatchがwrapしているか。
- [ ] 単位はraw CSV、BCU frame/world、rhg ms/pixelのどれか。
- [ ] 対象捕捉時点とdamage実行時点は同じか。
- [ ] side/trait/targetable/touchable/base条件を落としていないか。
- [ ] barrier/shield/nullify/immunity/proc/KB/deathの順を壊していないか。
- [ ] logic containerとvisual effectのlifetimeを混同していないか。
- [ ] strict semantic asset pathをraw fallbackで隠していないか。
- [ ] 決定的チェックは何をassertし、何をassertしていないか。
- [ ] 見た目の主張に実ブラウザ比較記録があるか。
- [ ] status docsの古い記述を現行コードで再確認したか。

---

# Appendix A — Common reference full source inventory

### BCU common indexed files

| Path | Package | Lines | Classes | Key methods |
|---|---:|---:|---|---|
| `CommonStatic.java` | `common` | 654 | CommonStatic, BattleConst, BCAuxAssets, Config, EditLink, FakeKey, Itf, Lang, Locale | Locale, toString, getBCAssets, getConfig, isInteger, isDouble, parseIntN, verifyFileName, parseDoubleN, parseFloatN … (+19) |
| `battle/Basis.java` | `common.battle` | 29 | Basis | toString |
| `battle/BasisLU.java` | `common.battle` | 181 | BasisLU | getRandom, BasisLU, BasisLU, BasisLU, BasisLU, copy, getInc, getInc, getInc, randomize … (+2) |
| `battle/BasisSet.java` | `common.battle` | 249 | BasisSet | current, def, list, getBackupSet, synchronizeOrb, read, setCurrent, write, conditionalOrb, listRaw … (+11) |
| `battle/BattleField.java` | `common.battle` | 67 | BattleField | BattleField, BattleField, update, act_can, act_lock, act_mon, act_sniper, act_change_up, act_change_down, act_spawn |
| `battle/CannonLevelCurve.java` | `common.battle` | 68 | CannonLevelCurve, PART | CannonLevelCurve, getMax, applyFormula, applyFormulaRaw |
| `battle/ELineUp.java` | `common.battle` | 129 | ELineUp | ELineUp, get, delay, update |
| `battle/LineUp.java` | `common.battle` | 417 | LineUp | LineUp, LineUp, arrange, contains, getLv, occupance, renew, set, setLv, setOrb … (+7) |
| `battle/SBCtrl.java` | `common.battle` | 163 | SBCtrl, Recorder | SBCtrl, SBCtrl, getData, sniperCoords, actions, add, write |
| `battle/SBRply.java` | `common.battle` | 191 | SBRply, Mirror, MirrorSet, Release | SBRply, back, prog, restoreTo, size, transform, update, Mirror, Mirror, sniperCoords … (+10) |
| `battle/StageBasis.java` | `common.battle` | 1270 | StageBasis | StageBasis, getMoney, getMaxMoney, getUpgradeCost, changeTheme, changeBG, findEntitiesOf, entityCount, entityCountRar, entityCount … (+39) |
| `battle/Treasure.java` | `common.battle` | 605 | Treasure | readCannonCurveData, injectData, Treasure, Treasure, Treasure, getAlienMulti, getAtkMulti, getBaseHealth, getCanonAtk, getCannonMagnification … (+26) |
| `battle/attack/AtkModelAb.java` | `common.battle.attack` | 40 | AtkModelAb | AtkModelAb, invokeLater, getLayer |
| `battle/attack/AtkModelEnemy.java` | `common.battle.attack` | 141 | AtkModelEnemy | AtkModelEnemy, summon, getAttack, getProc |
| `battle/attack/AtkModelEntity.java` | `common.battle.attack` | 313 | AtkModelEntity | getEnemyAtk, getUnitAtk, setExtraAtks, getAbi, getAtk, getAttack, getDeathSurge, getDire, getPos, inRange … (+6) |
| `battle/attack/AtkModelUnit.java` | `common.battle.attack` | 149 | AtkModelUnit | AtkModelUnit, summon, getAttack, getProc |
| `battle/attack/AttackAb.java` | `common.battle.attack` | 227 | AttackAb | AttackAb, AttackAb, getProc, process, notifyEntity |
| `battle/attack/AttackBlast.java` | `common.battle.attack` | 81 | AttackBlast | AttackBlast, capture, excuse |
| `battle/attack/AttackCanon.java` | `common.battle.attack` | 21 | AttackCanon | AttackCanon |
| `battle/attack/AttackSimple.java` | `common.battle.attack` | 253 | AttackSimple | AttackSimple, AttackSimple, capture, counterEntity, excuse |
| `battle/attack/AttackVolcano.java` | `common.battle.attack` | 74 | AttackVolcano | AttackVolcano, capture, excuse |
| `battle/attack/AttackWave.java` | `common.battle.attack` | 93 | AttackWave | AttackWave, AttackWave, AttackWave, capture, excuse |
| `battle/attack/ContAb.java` | `common.battle.attack` | 33 | ContAb | ContAb |
| `battle/attack/ContBlast.java` | `common.battle.attack` | 102 | ContBlast | ContBlast, draw, drawAxis, update, updateAnimation, IMUTime, getTime |
| `battle/attack/ContExtend.java` | `common.battle.attack` | 87 | ContExtend | ContExtend, draw, update, updateAnimation, IMUTime |
| `battle/attack/ContMove.java` | `common.battle.attack` | 81 | ContMove | ContMove, draw, update, updateAnimation, IMUTime |
| `battle/attack/ContVolcano.java` | `common.battle.attack` | 199 | ContVolcano | ContVolcano, ContVolcano, draw, update, updateAnimation, updateProc, drawAxis, IMUTime |
| `battle/attack/ContWaveAb.java` | `common.battle.attack` | 73 | ContWaveAb | ContWaveAb, draw, deactivate, drawAxis |
| `battle/attack/ContWaveCanon.java` | `common.battle.attack` | 115 | ContWaveCanon | ContWaveCanon, ContWaveCanon, draw, getSize, update, updateAnimation, nextWave, IMUTime |
| `battle/attack/ContWaveDef.java` | `common.battle.attack` | 99 | ContWaveDef | ContWaveDef, ContWaveDef, update, updateAnimation, nextWave, IMUTime |
| `battle/data/AtkDataModel.java` | `common.battle.data` | 155 | AtkDataModel | AtkDataModel, AtkDataModel, AtkDataModel, clone, copy, getAltAbi, getAtk, getDire, getLongPoint, getMove … (+9) |
| `battle/data/CustomEnemy.java` | `common.battle.data` | 112 | CustomEnemy | CustomEnemy, copy, getDrop, getPack, getStar, getSummon, importData, multi, getLimit |
| `battle/data/CustomEntity.java` | `common.battle.data` | 343 | CustomEntity | allAtk, updateAllProc, getAllProc, getAtkCount, getAtkModel, getAtks, getAvailable, getItv, getPost, getProc … (+19) |
| `battle/data/CustomUnit.java` | `common.battle.data` | 142 | CustomUnit | CustomUnit, getBack, getFront, getPack, getPrice, getRespawn, getLimit, importData, clone |
| `battle/data/DataAtk.java` | `common.battle.data` | 61 | DataAtk | DataAtk, getAtk, isOmni, getLongPoint, getProc, getShortPoint, isRange |
| `battle/data/DataEnemy.java` | `common.battle.data` | 256 | DataEnemy | DataEnemy, fillData, getDrop, getPack, getStar, multi, getLimit |
| `battle/data/DataEntity.java` | `common.battle.data` | 93 | DataEntity | getAbi, getAtkLoop, getDeathAnim, getTraits, getTraitsRaw, getHb, getHp, getRange, getSpeed, getWidth … (+3) |
| `battle/data/DataUnit.java` | `common.battle.data` | 290 | DataUnit | DataUnit, getBack, getFront, getPack, getPrice, getRespawn, getLimit, getTraits, clone, getTouch |
| `battle/data/DefaultData.java` | `common.battle.data` | 137 | DefaultData | allAtk, getAllProc, getAtkCount, getAtkModel, getAtks, getItv, getPost, getProc, getRepAtk, getTBA … (+8) |
| `battle/data/MaskAtk.java` | `common.battle.data` | 43 | MaskAtk | getAltAbi, getDire, getMove, getTarget, loopCount |
| `battle/data/MaskEnemy.java` | `common.battle.data` | 26 | MaskEnemy | getSummon |
| `battle/data/MaskEntity.java` | `common.battle.data` | 124 | MaskEntity | getAnimLen, getResurrection, getRevenge, getCounter, getGouge, getResurface, getRevive, getTouch, isLD, isOmni |
| `battle/data/MaskUnit.java` | `common.battle.data` | 22 | MaskUnit | — |
| `battle/data/Orb.java` | `common.battle.data` | 187 | Orb | read, reverse, traitToOrb, Orb, isRestricted, toString |
| `battle/data/PCoin.java` | `common.battle.data` | 482 | PCoin | read, PCoin, PCoin, update, verify, improve, improve, improve, getAtkMultiplication, getHPMultiplication … (+2) |
| `battle/entity/AbEntity.java` | `common.battle.entity` | 58 | AbEntity | AbEntity, added |
| `battle/entity/Cannon.java` | `common.battle.entity` | 290 | Cannon | Cannon, activate, drawAtk, drawBase, getAbi, getDire, getPos, update, updateAnimation, getBreakerSpawnPoint |
| `battle/entity/EAnimCont.java` | `common.battle.entity` | 44 | EAnimCont | EAnimCont, EAnimCont, done, draw, update |
| `battle/entity/ECastle.java` | `common.battle.entity` | 159 | ECastle | ECastle, ECastle, damaged, getAbi, isBase, postUpdate, traitCompatible, touchable, update, updateAnimation … (+2) |
| `battle/entity/EEnemy.java` | `common.battle.entity` | 256 | EEnemy | EEnemy, getAtk, kill, getDamage, getLim, traitType, damaged, getResistValue, update, processProcs … (+2) |
| `battle/entity/EUnit.java` | `common.battle.entity` | 565 | EUnit, OrbHandler | getEUnit, getOrbAtk, getOrbMassive, getOrbGood, EUnit, processAbilityOrbs, processComboAbilities, getAbi, kill, update … (+14) |
| `battle/entity/EntCont.java` | `common.battle.entity` | 21 | EntCont | EntCont, update |
| `battle/entity/Entity.java` | `common.battle.entity` | 2748 | for, Entity, KillMode, AnimManager, AtkManager, KBManager, PoisonToken, WeakToken, Barrier, ZombX, SummonManager | AnimManager, draw, drawEff, getEff, checkEff, kbAnim, kill, setAnim, cont, update … (+75) |
| `battle/entity/Sniper.java` | `common.battle.entity` | 251 | Sniper | Sniper, drawBase, getAbi, getDire, getPos, getAngle, update, updateAnimation, cancel |
| `battle/entity/SurgeSummoner.java` | `common.battle.entity` | 59 | SurgeSummoner | SurgeSummoner, update |
| `battle/entity/WaprCont.java` | `common.battle.entity` | 53 | WaprCont | WaprCont, draw, update, done |
| `io/BCUException.java` | `common.io` | 11 | BCUException | BCUException |
| `io/Backup.java` | `common.io` | 184 | Backup | createBackup, loadBackups, checkRestore, hasValidFormat, getTimeStamp, Backup, load, safeDelete, delete, getName … (+3) |
| `io/DataIO.java` | `common.io` | 149 | DataIO | fromABP, fromByte, fromDouble, fromFloat, fromInt, fromLong, fromShort, getSignature, readInt, toByte … (+8) |
| `io/ISStream.java` | `common.io` | 146 | ISStream, FileTracer | FileTracer, read, read, seek, close, ISStream, ISStream, end, nextByte, nextDouble … (+11) |
| `io/InStream.java` | `common.io` | 377 | InStream, InStreamDef, InStreamAnim | getIns, nextBytesB, nextBytesI, nextDoubles, nextIntsB, nextIntsBB, nextString, close, InStreamDef, InStreamDef … (+39) |
| `io/OutStream.java` | `common.io` | 449 | OutStream, OutStreamDef, OutStreamAnim | getIns, getAnimIns, writeIntsN, OutStreamDef, OutStreamDef, OutStreamDef, accept, concat, flush, getBytes … (+45) |
| `io/PackLoader.java` | `common.io` | 565 | PackLoader, PatchFile, Preload, Preloader, ZipDesc, FileDesc, FileLoader, FLStream, FileSaver | FileDesc, FileDesc, getImg, getStream, readLine, size, ZipDesc, ZipDesc, delete, getZipFile … (+27) |
| `io/Progress.java` | `common.io` | 46 | Progress | Progress, progressChanged, update |
| `io/WebFileIO.java` | `common.io` | 109 | WebFileIO | download, download, download, read, directRead, direct, impl |
| `io/assets/Admin.java` | `common.io.assets` | 275 | Admin, AdminContext, StaticPermitted, Type | confirmDelete, confirmDelete, getAssetFile, getAuxFile, getLangFile, getUserFile, getWorkspaceFile, getBackupFile, getBCUFolder, getAuthor … (+12) |
| `io/assets/AssetLoader.java` | `common.io.assets` | 274 | AssetLoader, AssetHeader, AssetEntry | AssetEntry, AssetEntry, equals, AssetHeader, add, load, merge, previewAssets, add, getPreload … (+2) |
| `io/assets/MultiStream.java` | `common.io.assets` | 129 | MultiStream, ByteStream, TrueStream, RunExc, SubStream | TrueStream, close, read, SubStream, close, read, getStream, MultiStream, close, access … (+2) |
| `io/assets/UpdateCheck.java` | `common.io.assets` | 330 | UpdateCheck, ContentJson, Downloader, UpdateJson, AssetJson, JarJson, ApkJson | Downloader, run, toString, addRequiredAssets, checkAsset, contains, checkLang, checkNewMusic, checkMusic, checkPCLibs … (+1) |
| `io/json/Dependency.java` | `common.io.json` | 232 | Dependency, DependencyCheck, is, not | collect, DependencyCheck, collect, getInvoker, collect, getMap, getPacks, add |
| `io/json/FieldOrder.java` | `common.io.json` | 56 | FieldOrder, Order | getDeclaredFields, FieldOrder, compareTo |
| `io/json/JsonClass.java` | `common.io.json` | 86 | JsonClass, JCConstructor, can, JCGeneric, JCGetter, JCIdentifier, NoTag, RType, WType, as | — |
| `io/json/JsonDecoder.java` | `common.io.json` | 451 | JsonDecoder, Decoder, OnInjected, not, for, not | decode, decode, getBoolean, getByte, getDouble, getFloat, getGlobal, getInt, getLong, getShort … (+14) |
| `io/json/JsonEncoder.java` | `common.io.json` | 205 | JsonEncoder, not | encode, encode, encodeList, encodeMap, encodeSet, JsonEncoder, encode, getInvoker |
| `io/json/JsonException.java` | `common.io.json` | 18 | JsonException, Type | JsonException |
| `io/json/JsonField.java` | `common.io.json` | 190 | field, field, JsonField, GenType, Handler, IOType, SerType, fields, with | Handler, Handler, add, get, JsonField, alias, annotationType, block, gen, generator … (+6) |
| `pack/Context.java` | `common.pack` | 131 | Context, ErrType, RunExc, SupExc | check, check, delete, renameTo, noticeErr, noticeErr, noticeErr, noticeErr |
| `pack/FixIndexList.java` | `common.pack` | 326 | FixIndexList, FixIndexMap, Itr | hasNext, next, FixIndexMap, clear, expand, getList, iterator, reorder, get, getRaw … (+23) |
| `pack/Identifier.java` | `common.pack` | 211 | Identifier, implementing | get, getOr, tryGet, parseInt, rawParseInt, parseIntRaw, parse, getContainer, Identifier, Identifier … (+7) |
| `pack/IndexContainer.java` | `common.pack` | 122 | IndexContainer, Constructor, ContGetter, Indexable, IndexCont, Reductor, SingleIC | getCont, add, add, getID, getID, getList, getNextID, getNextID, add, add … (+2) |
| `pack/KIdentifier.kt` | `common.pack` | 9 | — | — |
| `pack/PackData.java` | `common.pack` | 659 | PackData, DefPack, PackDesc, UserPack | DefPack, getSID, load, toString, loadCharaGroup, loadEnemies, loadLimit, loadMusic, loadSoul, loadUnits … (+22) |
| `pack/Source.java` | `common.pack` | 824 | Source, AnimLoader, SourceLoader, ResourceLocation, SourceAnimLoader, SourceAnimSaver, Workspace, ZipSource, BasePath | ResourceLocation, ResourceLocation, ResourceLocation, setBase, getAnim, getPath, getReplay, toString, onInjectSource, SourceAnimLoader … (+60) |
| `pack/UserProfile.java` | `common.pack` | 394 | UserProfile, from | canRemove, getAll, getAllPacks, getBCData, getPack, isOlderPack, getPool, getRegister, getStatic, getUserPack … (+18) |
| `system/BasedCopable.java` | `common.system` | 24 | BasedCopable | copy |
| `system/BattleRange.java` | `common.system` | 324 | BattleRange, SNAP | BattleRange, getRangeI, getRangeF, getRangeX, getRangeY, getPureRangeI, getAnimFrame, isFront, hasRandomValue, isXAxis … (+7) |
| `system/Copable.java` | `common.system` | 7 | Copable | — |
| `system/DateComparator.java` | `common.system` | 12 | DateComparator | compare |
| `system/ENode.java` | `common.system` | 48 | ENode | ENode, ENode, getList, getList |
| `system/Node.java` | `common.system` | 138 | Node | deRep, getList, getList, getList, Node, add, adds, len, removes, side … (+3) |
| `system/P.java` | `common.system` | 230 | P | delete, newP, newP, polar, reg, P, abs, atan2, atan2, copy … (+27) |
| `system/SymCoord.java` | `common.system` | 55 | SymCoord | SymCoord, draw, setPos, setSize |
| `system/VImg.java` | `common.system` | 102 | VImg | VImg, VImg, VImg, check, getImg, mark, setCut, setImg, toString, unload … (+1) |
| `system/fake/FakeGraphics.java` | `common.system.fake` | 50 | FakeGraphics | delete |
| `system/fake/FakeImage.java` | `common.system.fake` | 67 | FakeImage, Marker | read, read, read, read, read, write, mark |
| `system/fake/FakeTransform.java` | `common.system.fake` | 7 | FakeTransform | — |
| `system/fake/ImageBuilder.java` | `common.system.fake` | 54 | ImageBuilder | toVImg, toVImg, build, build, build, toVImg |
| `system/files/ByteData.java` | `common.system.files` | 28 | ByteData | getImg, getStream, size |
| `system/files/FDByte.java` | `common.system.files` | 16 | FDByte | FDByte, getBytes |
| `system/files/FDFile.java` | `common.system.files` | 52 | FDFile | FDFile, getBytes, getImg, getStream, size, toString |
| `system/files/FileData.java` | `common.system.files` | 62 | FileData | getBytes, readLine |
| `system/files/VFile.java` | `common.system.files` | 175 | VFile | get, getBCFileTree, getFile, getFile, readLine, VFile, VFile, VFile, compareTo, containsSubDire … (+11) |
| `system/files/VFileRoot.java` | `common.system.files` | 52 | VFileRoot | VFileRoot, build, find |
| `util/AnimGroup.java` | `common.util` | 230 | AnimGroup | readGroupData, writeAnimGroup, resetGroup, renewGroup, parseAnimGroup, parseJson, validateGroupName |
| `util/Animable.java` | `common.util` | 17 | Animable | — |
| `util/BattleObj.java` | `common.util` | 299 | enables, BattleObj, during | hardCopy, checkField, getField, clone, conflict, performDeepCopy, terminate, check, sysCopy |
| `util/BattleStatic.java` | `common.util` | 12 | BattleStatic, from | conflict |
| `util/CopRand.java` | `common.util` | 29 | CopRand | CopRand, irDouble, nextDouble, nextFloat |
| `util/Data.java` | `common.util` | 2050 | Data, Proc, ARMOR, BURROW, IMU, IMUAD, DMGCUT, TYPE, DMGCAP, TYPE, IntType, BitCount, MOVEWAVE, PM, POISON, TYPE, PROB, MULT, ProcItem, PT, PTD, WARP, TIME, REVIVE, TYPE, BARRIER, TYPE, SPEED, STRONG, SPEEDUP, HPREGEN, SUMMON, TYPE, THEME, TYPE, COUNTER, TYPE, VOLC, WAVE, MINIWAVE, WAVEI, CANNI, WEAK, DSHIELD, BSTHUNT, MINIVOLC, BLAST, SPIRIT, BERSERK, LETHARGY, DELAY, ORB | clone, getDeclaredFields, load, toInt, clear, clone, exists, get, getFieldName, getDeclaredFields … (+30) |
| `util/EREnt.java` | `common.util` | 28 | EREnt | copy |
| `util/EntRand.java` | `common.util` | 92 | EntRand, Lock, LockGL, LockLL | updateCopy, getSelection, selector, get, put |
| `util/ImgCore.java` | `common.util` | 187 | ImgCore | set, drawRandom, drawSca, drawImage |
| `util/Res.java` | `common.util` | 450 | Res | getBase, getLv, getCost, getRarity, getMoney, getWorkerLv, readData, getLab, readAbiIcon, readBattle … (+2) |
| `util/anim/AnimCE.java` | `common.util.anim` | 464 | AnimCE, History | History, getAvailable, map, AnimCE, AnimCE, AnimCE, createNew, deletable, delete, getUndo … (+26) |
| `util/anim/AnimCI.java` | `common.util.anim` | 164 | AnimCI, AnimCIKeeper | AnimCIKeeper, getEdi, getIC, getMA, getMM, getName, getNum, getStatus, getUni, setEdi … (+10) |
| `util/anim/AnimD.java` | `common.util.anim` | 121 | AnimD | AnimD, check, getEAnim, getMaAnim, len, names, parts, reorderModel, revert, types … (+2) |
| `util/anim/AnimI.java` | `common.util.anim` | 37 | AnimI, AnimType | translate, AnimI |
| `util/anim/AnimU.java` | `common.util.anim` | 142 | AnimU, EditableType, ImageKeeper, AnimationType, UType | UType, rotate, AnimU, AnimU, getAtkLen, getEAnim, getEdi, getNum, getUni, load … (+2) |
| `util/anim/AnimUD.java` | `common.util.anim` | 169 | AnimUD, DefImgLoader | cantLoadAll, collectInvalidAnimation, DefImgLoader, getEdi, getIC, getMA, getMM, getNum, getUni, unload … (+5) |
| `util/anim/EAnimD.java` | `common.util.anim` | 138 | EAnimD | EAnimD, changeAnim, done, draw, drawBGEffect, getBaseSizeX, getBaseSizeY, removeBasePivot, ind, len … (+5) |
| `util/anim/EAnimI.java` | `common.util.anim` | 87 | EAnimI | sort, EAnimI, anim, organize, performDeepCopy, sort, terminate, getOrder |
| `util/anim/EAnimS.java` | `common.util.anim` | 49 | EAnimS | EAnimS, draw, ind, len, setTime, update |
| `util/anim/EAnimU.java` | `common.util.anim` | 56 | EAnimU | EAnimU, anim, draw |
| `util/anim/EPart.java` | `common.util.anim` | 428 | EPart | isParentValid, EPart, alter, compareTo, getVal, getValRaw, toString, getFa, getSca, getModel … (+11) |
| `util/anim/ImgCut.java` | `common.util.anim` | 140 | ImgCut | newIns, newIns, ImgCut, ImgCut, ImgCut, clone, cut, write, restore, write |
| `util/anim/MaAnim.java` | `common.util.anim` | 175 | MaAnim | newIns, newIns, MaAnim, MaAnim, MaAnim, clone, revert, validate, write, restore … (+2) |
| `util/anim/MaModel.java` | `common.util.anim` | 233 | MaModel | newIns, newIns, MaModel, MaModel, MaModel, check, clearAnim, clone, getChild, reorder … (+6) |
| `util/anim/Part.java` | `common.util.anim` | 223 | Part | Part, Part, Part, Part, check, clone, compareTo, validate, ensureLast, getMax … (+5) |
| `util/lang/AnimTypeLocale.java` | `common.util.lang` | 72 | AnimTypeLocale | read |
| `util/lang/Editors.java` | `common.util.lang` | 824 | Editors, DispItem, EdiField, EditControl, Editor, EditorGroup, EditorSupplier | DispItem, getName, getTooltip, setName, setTooltip, EdiField, EdiField, get, getBoolean, getInt … (+21) |
| `util/lang/Formatter.java` | `common.util.lang` | 694 | Formatter, Context, BoolElem, BoolExp, Code, CodeBlock, Comp, Cont, Elem, IElem, IntExp, RefElem, RefField, RefFunc, RefObj, Root, TextPlain, TextRef | Context, Context, abs, bg, dispTime, dispFruit, entity, toSecond, summonMagnification, shield … (+35) |
| `util/lang/LocaleCenter.java` | `common.util.lang` | 119 | LocaleCenter, Binder, Displayable, DisplayItem, ObjBinder, BinderFunc | getName, getTooltip, setName, setTooltip, ObjBinder, getNameID, getNameValue, getTooltipID, getToolTipValue, refresh … (+2) |
| `util/lang/MultiLangCont.java` | `common.util.lang` | 225 | MultiLangCont, MultiLangStatics | clear, getAnimName, get, get, getGrabbedLocale, getDesc, getStatic, getStageDrop, getStageDrop, getServerDrop … (+8) |
| `util/lang/MultiLangData.java` | `common.util.lang` | 108 | MultiLangData | MultiLangData, MultiLangData, put, remove, toString, getGrabbedLocale, lang |
| `util/lang/ProcLang.java` | `common.util.lang` | 236 | ProcLang, ItemLang, ProcLangStore | ItemLang, get, list, readClass, writeClass, fill, fill, getBinder, getLang, getLang … (+13) |
| `util/pack/AbSoul.java` | `common.util.pack` | 22 | AbSoul | AbSoul, getEAnim |
| `util/pack/Background.java` | `common.util.pack` | 454 | Background, BGWvType | read, Background, Background, Background, check, copy, draw, getEAnim, getID, load … (+8) |
| `util/pack/DemonSoul.java` | `common.util.pack` | 34 | DemonSoul | DemonSoul, getID, toString |
| `util/pack/EffAnim.java` | `common.util.pack` | 763 | EffAnim, ArmorEff, LethEff, BarrierEff, GuardEff, ShieldEff, DmgCap, DefEff, BlastEff, EffAnimStore, EffType, KBEff, SniperEff, SpeedEff, VolcEff, WarpEff, WeakUpEff, ZombieEff | ArmorEff, path, LethEff, BarrierEff, path, GuardEff, path, ShieldEff, path, DmgCap … (+31) |
| `util/pack/NyCastle.java` | `common.util.pack` | 110 | NyCastle, NyType | read, NyCastle, check, getEAnim, load, names, parts, toString, types |
| `util/pack/Soul.java` | `common.util.pack` | 58 | Soul | Soul, Soul, getID, toString, getEAnim |
| `util/pack/WaveAnim.java` | `common.util.pack` | 60 | WaveAnim, WaveType | WaveAnim, check, getEAnim, load, names, parts, types |
| `util/pack/bgeffect/BGEffectAnim.java` | `common.util.pack.bgeffect` | 72 | BGEffectAnim, for, BGEffType | BGEffectAnim, getNum, load, cantLoadAll, collectInvalidAnimation |
| `util/pack/bgeffect/BGEffectHandler.java` | `common.util.pack.bgeffect` | 608 | BGEffectHandler | BGEffectHandler, check, initialize, update, updateAnimation, preDraw, postDraw, checkDestroy, convertP, reInitialize … (+1) |
| `util/pack/bgeffect/BGEffectSegment.java` | `common.util.pack.bgeffect` | 685 | BGEffectSegment, BGFile | BGEffectSegment, getSnap, readRangedJsonObjectI, readRangedJsonObjectI, readRangedJsonObjectD, readRangedJsonObjectD |
| `util/pack/bgeffect/BGEffectSpacer.java` | `common.util.pack.bgeffect` | 68 | BGEffectSpacer | BGEffectSpacer, drawWithSpacer, convertP |
| `util/pack/bgeffect/BackgroundEffect.java` | `common.util.pack.bgeffect` | 174 | BackgroundEffect | read, updateAnimation, release, convertP, revertP |
| `util/pack/bgeffect/BalloonBGEffect.java` | `common.util.pack.bgeffect` | 126 | BalloonBGEffect | check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/BlizzardBGEffect.java` | `common.util.pack.bgeffect` | 143 | BlizzardBGEffect | BlizzardBGEffect, check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/BubbleBGEffect.java` | `common.util.pack.bgeffect` | 98 | BubbleBGEffect | BubbleBGEffect, check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/FallingSnowBGEffect.java` | `common.util.pack.bgeffect` | 106 | FallingSnowBGEffect | FallingSnowBGEffect, check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/JsonBGEffect.java` | `common.util.pack.bgeffect` | 155 | JsonBGEffect | JsonBGEffect, check, preDraw, postDraw, update, updateAnimation, initialize, release |
| `util/pack/bgeffect/MixedBGEffect.java` | `common.util.pack.bgeffect` | 50 | MixedBGEffect | MixedBGEffect, check, preDraw, postDraw, update, updateAnimation, initialize |
| `util/pack/bgeffect/RainBGEffect.java` | `common.util.pack.bgeffect` | 130 | RainBGEffect | RainBGEffect, check, preDraw, postDraw, update, updateAnimation, initialize |
| `util/pack/bgeffect/RockBGEffect.java` | `common.util.pack.bgeffect` | 196 | RockBGEffect | check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/ShiningBGEffect.java` | `common.util.pack.bgeffect` | 98 | ShiningBGEffect | ShiningBGEffect, check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/SnowBGEffect.java` | `common.util.pack.bgeffect` | 125 | SnowBGEffect | SnowBGEffect, check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/SnowStarBGEffect.java` | `common.util.pack.bgeffect` | 37 | SnowStarBGEffect | check, preDraw, postDraw, update, initialize |
| `util/pack/bgeffect/StarBackgroundEffect.java` | `common.util.pack.bgeffect` | 115 | StarBackgroundEffect | check, preDraw, postDraw, update, initialize |
| `util/stage/BattlePreset.java` | `common.util.stage` | 75 | BattlePreset, ActivatedTreasure, LevelObject | toString |
| `util/stage/CastleImg.java` | `common.util.stage` | 124 | CastleImg | loadBossSpawns, CastleImg, CastleImg, getID, onInjected, toString, getStages |
| `util/stage/CastleList.java` | `common.util.stage` | 106 | CastleList, DefCasList, PackCasList | DefCasList, getSID, toString, PackCasList, getSID, toString, defset, from, getList, map … (+2) |
| `util/stage/CharaGroup.java` | `common.util.stage` | 126 | CharaGroup | CharaGroup, CharaGroup, CharaGroup, CharaGroup, CharaGroup, CharaGroup, allow, combine, compareTo, getID … (+2) |
| `util/stage/EStage.java` | `common.util.stage` | 188 | EStage | EStage, allow, assign, base, hasBoss, update, inHealth, delay |
| `util/stage/Limit.java` | `common.util.stage` | 145 | Limit, DefLimit, PackLimit | DefLimit, PackLimit, Limit, clone, combine, unusable, toString |
| `util/stage/LvRestrict.java` | `common.util.stage` | 241 | LvRestrict, GroupRestrict | GroupRestrict, GroupRestrict, GroupRestrict, LvRestrict, LvRestrict, LvRestrict, LvRestrict, combine, getID, isValid … (+5) |
| `util/stage/MapColc.java` | `common.util.stage` | 1667 | MapColc, DefMapColc, PackMapColc, StItr, ClipMapColc | getMap, getMap, read, DefMapColc, DefMapColc, getSID, toString, updateTreasureData, PackMapColc, getSID … (+15) |
| `util/stage/Music.java` | `common.util.stage` | 62 | Music | Music, Music, getID, toString, getStages |
| `util/stage/RandStage.java` | `common.util.stage` | 42 | RandStage | getLU, getStage, getStage, read |
| `util/stage/Replay.java` | `common.util.stage` | 241 | Replay | getMap, read, read, Replay, Replay, clone, getLen, localize, rename, toString … (+4) |
| `util/stage/SCDef.java` | `common.util.stage` | 252 | SCDef, Line | Line, Line, clone, SCDef, SCDef, SCDef, allow, allow, contains, copy … (+7) |
| `util/stage/SCGroup.java` | `common.util.stage` | 80 | SCGroup | zread, SCGroup, SCGroup, copy, getMax, setMax, toString |
| `util/stage/Stage.java` | `common.util.stage` | 388 | Stage, ScoreBonus | ScoreBonus, ScoreBonus, clone, Stage, Stage, Stage, Stage, contains, copy, getID … (+8) |
| `util/stage/StageLimit.java` | `common.util.stage` | 154 | StageLimit, SpeedOverrideMode | isComboBanned, SpeedOverrideMode, getPre, getPost, toString, StageLimit, clone, combine |
| `util/stage/StageMap.java` | `common.util.stage` | 197 | StageMap, StageMapInfo | StageMapInfo, StageMapInfo, getData, injectMaterialDrop, get, StageMap, StageMap, StageMap, StageMap, add … (+5) |
| `util/stage/info/CustomStageInfo.java` | `common.util.stage.info` | 161 | CustomStageInfo | CustomStageInfo, CustomStageInfo, hasExConnection, getExStages, getExChances, getExChance, getExMapId, getExStageIdMin, getExStageIdMax, getStage … (+11) |
| `util/stage/info/DefStageInfo.java` | `common.util.stage.info` | 219 | DefStageInfo | DefStageInfo, setData, hasExConnection, getExStages, getExChances, getExChance, getExMapId, getExStageIdMin, getExStageIdMax, getStage … (+5) |
| `util/stage/info/StageInfo.java` | `common.util.stage.info` | 36 | StageInfo | — |
| `util/unit/AbEnemy.java` | `common.util.unit` | 30 | AbEnemy | compareTo |
| `util/unit/Combo.java` | `common.util.unit` | 231 | Combo | readFile, Combo, Combo, Combo, toString, getID, getName, setType, setLv, addForm … (+3) |
| `util/unit/EForm.java` | `common.util.unit` | 70 | EForm | EForm, EForm, getEntity, invokeEntity, getPrice, getAkuStageLevel, getLevel |
| `util/unit/EneRand.java` | `common.util.unit` | 143 | EneRand | EneRand, EneRand, fillPossible, getEntity, getIcon, getID, getPossible, toString, zread, contains … (+2) |
| `util/unit/Enemy.java` | `common.util.unit` | 255 | Enemy | Enemy, Enemy, Enemy, findApp, findApp, findMap, getEAnim, getEntity, getIcon, getID … (+4) |
| `util/unit/Form.java` | `common.util.unit` | 332 | Form, FormJson | FormJson, FormJson, get, lvString, Form, Form, Form, Form, copy, getDefaultPrice … (+8) |
| `util/unit/Level.java` | `common.util.unit` | 223 | Level | lvList, Level, Level, Level, Level, clone, getLv, getPlusLv, getOrbs, getTalents … (+8) |
| `util/unit/LevelInterface.java` | `common.util.unit` | 4 | LevelInterface | — |
| `util/unit/Magnification.java` | `common.util.unit` | 11 | Magnification | Magnification |
| `util/unit/Trait.java` | `common.util.unit` | 180 | Trait | read, bitmaskToTrait, talentBitmaskToTrait, convertOrb, isUsed, isTargetTraited, Trait, Trait, Trait, toString … (+2) |
| `util/unit/Unit.java` | `common.util.unit` | 240 | Unit, UnitInfo | fillBuy, hasEvolveCost, hasZeroForm, getCatfruitExplanation, getUltraFormEvolveExplanation, Unit, Unit, Unit, Unit, Unit … (+7) |
| `util/unit/UnitLevel.java` | `common.util.unit` | 119 | UnitLevel | UnitLevel, UnitLevel, UnitLevel, equals, getID, getMult, toString, zread |

# Appendix B — PC reference full source inventory

### BCU PC indexed files

| Path | Package | Lines | Classes | Key methods |
|---|---:|---:|---|---|
| `build.gradle.kts` | `—` | 78 | — | — |
| `settings.gradle.kts` | `—` | 13 | — | — |
| `src/main/java/io/BCJSON.java` | `io` | 169 | BCJSON | check, clearList, getLatestJars, getLatestJar |
| `src/main/java/io/BCMusic.java` | `io` | 465 | BCMusic | clear, clickSound, endJingle, flush, play, preload, setBG, setBGVol, setSE, setSE … (+9) |
| `src/main/java/io/BCPlayer.java` | `io` | 116 | BCPlayer | getVol, BCPlayer, BCPlayer, isPlaying, stop, update, release, rewind, setLineListener, setVolume … (+2) |
| `src/main/java/io/BCUReader.java` | `io` | 375 | BCUReader | readBytes, readInfo, readLang, readLines |
| `src/main/java/io/BCUWriter.java` | `io` | 339 | BCUWriter, WriteStream | logClose, logPrepare, logSetup, newFile, writeBytes, writeBytes, writeData, writeGIF, writeImage, writeFile … (+4) |
| `src/main/java/jogl/GLBBB.java` | `jogl` | 38 | GLBBB | getCtrl, getDef, getIconBox, getRply, getViewBox |
| `src/main/java/jogl/GLBBRecd.java` | `jogl` | 45 | GLBBRecd | GLBBRecd, end, info, paint, quit |
| `src/main/java/jogl/GLBattleBox.java` | `jogl` | 63 | GLBattleBox | GLBattleBox, display, getPainter, paint, reset, releaseData, reshape |
| `src/main/java/jogl/GLCstd.java` | `jogl` | 46 | GLCstd | GLCstd, dispose, getScreen, init, reshape |
| `src/main/java/jogl/GLRecorder.java` | `jogl` | 86 | GLRecorder, GLRecdBImg | getIns, GLRecorder, GLRecdBImg, GLRecdBImg, end, quit, remain, start, update |
| `src/main/java/jogl/GLStatic.java` | `jogl` | 24 | GLStatic | — |
| `src/main/java/jogl/GLViewBox.java` | `jogl` | 272 | GLIconBox, GLVBExporter, GLViewBox | GLIconBox, changeType, draw, getClip, getCtrl, setBlank, updateControllerDimension, GLVBExporter, end, getPrev … (+14) |
| `src/main/java/jogl/util/AmbImage.java` | `jogl.util` | 221 | AmbImage | AmbImage, AmbImage, AmbImage, AmbImage, bimg, getHeight, getRGB, getSubimage, getWidth, gl … (+10) |
| `src/main/java/jogl/util/GLGraphics.java` | `jogl.util` | 538 | GLGraphics, GeomG, GLC, GLT, GeoAuto | GeomG, colRect, drawLine, drawOval, drawRect, fillOval, fillRect, gradRect, gradRectAlpha, setColor … (+36) |
| `src/main/java/jogl/util/GLIB.java` | `jogl.util` | 49 | GLIB | build, build, build, build, write |
| `src/main/java/jogl/util/GLImage.java` | `jogl.util` | 194 | GLImage | build, check, GLImage, GLImage, bimg, getHeight, getRect, getRGB, getSubimage, getWidth … (+7) |
| `src/main/java/jogl/util/ResManager.java` | `jogl.util` | 173 | ResManager | get, load, ResManager, dispose, load, setupShader |
| `src/main/java/main/MainBCU.java` | `main` | 430 | MainBCU, AdminContext, AutoSaveTimer | confirmDelete, confirmDelete, getAssetFile, getAuxFile, getLangFile, getUserFile, getWorkspaceFile, getBackupFile, getAuthor, initProfile … (+18) |
| `src/main/java/main/Opts.java` | `main` | 528 | Opts | animErr, backupErr, conf, conf, conf, confLong, dloadErr, ioErr, loadErr, packConf … (+24) |
| `src/main/java/main/Printer.java` | `main` | 37 | Printer | e, p, r, w, print |
| `src/main/java/main/Timer.java` | `main` | 66 | Timer, Inv | manualTick, run, run |
| `src/main/java/page/BackupPage.java` | `page` | 626 | BackupPage | BackupPage, getBackButton, resized, addTree, ini, setBackup, setList, setSele, setT, Basis … (+4) |
| `src/main/java/page/ColorPickPage.java` | `page` | 279 | ColorPickPage | ColorPickPage, getBackButton, resized, ini, listeners, addMouseListener, mousePressed, mouseReleased, addMouseMotionListener, mouseDragged … (+3) |
| `src/main/java/page/ConfigPage.java` | `page` | 574 | ConfigPage | cfg, ConfigPage, getBackButton, renew, resized, callBack, addListeners, ini, setCellRenderer, getListCellRendererComponent … (+2) |
| `src/main/java/page/CustomComp.java` | `page` | 8 | CustomComp | added |
| `src/main/java/page/DefaultPage.java` | `page` | 37 | DefaultPage | DefaultPage, getBackButton, resized, addListeners, ini |
| `src/main/java/page/JBTN.kt` | `page` | 42 | JBTN | constructor, constructor, setLnr, setLnr |
| `src/main/java/page/JCB.kt` | `page` | 31 | JCB | constructor, constructor |
| `src/main/java/page/JL.kt` | `page` | 31 | JL | constructor, constructor |
| `src/main/java/page/JTF.kt` | `page` | 87 | JTF | addKeyListener, keyPressed, setLnr, addFocusListener, focusLost, setTypeLnr, update, insertUpdate, removeUpdate, changedUpdate … (+4) |
| `src/main/java/page/JTG.kt` | `page` | 32 | JTG | constructor, constructor, setLnr |
| `src/main/java/page/KeyHandler.kt` | `page` | 62 | KeyHandler | remove, keyPressed, keyReleased, updateKey |
| `src/main/java/page/LoadPage.kt` | `page` | 63 | LoadPage | Page, accept, resized, onTimer, set, prog, prog |
| `src/main/java/page/LocComp.java` | `page` | 32 | LocComp | added, reLoc, setText |
| `src/main/java/page/LocSubComp.java` | `page` | 160 | LocSubComp, LocBinder, LSCPop | LocBinder, getNameID, getNameValue, getTooltipID, getToolTipValue, refresh, setNameValue, setToolTipValue, LocSubComp, update … (+6) |
| `src/main/java/page/LogPage.java` | `page` | 142 | LogPage | LogPage, resized, ini, addListeners, getBackButton |
| `src/main/java/page/MainFrame.java` | `page` | 244 | MainFrame | changePanel, exitAll, getPanel, timer, resized, setFonts, MainFrame, setIcon, initialize, sizer … (+11) |
| `src/main/java/page/MainLocale.java` | `page` | 209 | MainLocale, TTT | addTTT, getLoc, getLoc, getLoc, getTTT, redefine, setLoc, setTTT, langCode, MainLocale … (+5) |
| `src/main/java/page/MainPage.java` | `page` | 273 | MainPage | MainPage, getBackButton, renew, resized, addListeners, ini, setMemo, refrTips |
| `src/main/java/page/MenuBarHandler.java` | `page` | 73 | MenuBarHandler | getBar, initialize, setFileItems, getFileItem |
| `src/main/java/page/Page.java` | `page` | 327 | Page | get, get, renewLoc, set, size, size, Page, accumulateJTable, add, callBack … (+33) |
| `src/main/java/page/RetFunc.java` | `page` | 7 | RetFunc | — |
| `src/main/java/page/SavePage.java` | `page` | 67 | SavePage | SavePage, SavePage, getBackButton, resized, ini, finishJob |
| `src/main/java/page/SupPage.java` | `page` | 13 | SupPage | getThisPage |
| `src/main/java/page/anim/AbEditPage.java` | `page.anim` | 9 | AbEditPage | — |
| `src/main/java/page/anim/AdvAnimEditPage.java` | `page.anim` | 799 | AdvAnimEditPage | AdvAnimEditPage, getBackButton, callBack, collapse, expand, selectTree, mouseDragged, mousePressed, mouseReleased, mouseWheel … (+14) |
| `src/main/java/page/anim/AnimBox.java` | `page.anim` | 243 | AnimBox, BufferedAnim, GLAnimBox | getInstance, BufferedAnim, draw, paint, getImage, getEntity, setEntity, setSele, update, setSiz … (+12) |
| `src/main/java/page/anim/AnimGroupTree.java` | `page.anim` | 286 | AnimGroupTree | AnimGroupTree, AnimGroupTree, renewNodes, applyNewNodes, handleAnimGroup, findAnimNode, removeGroup, getVeryFirstAnimNode, treeExpanded, treeCollapsed … (+2) |
| `src/main/java/page/anim/DIYViewPage.java` | `page.anim` | 359 | DIYViewPage | DIYViewPage, DIYViewPage, DIYViewPage, getBackButton, setSelection, enabler, keyPressed, renew, resized, onTimer … (+5) |
| `src/main/java/page/anim/EditHead.java` | `page.anim` | 162 | EditHead | EditHead, getBackButton, review, setAnim, resized, addListeners, ini |
| `src/main/java/page/anim/IconBox.java` | `page.anim` | 183 | IconBox, IBConf, IBCtrl | mouseDragged, mousePressed, mouseReleased, postdraw, predraw, synchronizeDimension |
| `src/main/java/page/anim/ImgCutEditPage.java` | `page.anim` | 707 | ImgCutEditPage | ImgCutEditPage, ImgCutEditPage, getBackButton, callBack, setSelection, renew, onTimer, resized, selectAnimNode, addFocusListener … (+5) |
| `src/main/java/page/anim/ImgCutEditTable.java` | `page.anim` | 97 | ImgCutEditTable | ImgCutEditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getValueAt, isCellEditable, setValueAt, setCut |
| `src/main/java/page/anim/MMTree.java` | `page.anim` | 118 | MMTree, TreeCont | MMTree, treeCollapsed, treeExpanded, indexOf, nav, renew, select, setAdjusting |
| `src/main/java/page/anim/MaAnimEditPage.java` | `page.anim` | 780 | MaAnimEditPage | MaAnimEditPage, MaAnimEditPage, getBackButton, callBack, selectAnimNode, setSelection, mouseDragged, mousePressed, mouseReleased, mouseWheel … (+10) |
| `src/main/java/page/anim/MaAnimEditTable.java` | `page.anim` | 170 | MaAnimEditTable | MaAnimEditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getSelected, getValueAt, insert, isCellEditable, reorder … (+2) |
| `src/main/java/page/anim/MaModelEditPage.java` | `page.anim` | 616 | MaModelEditPage, DragType | MaModelEditPage, MaModelEditPage, getBackButton, callBack, selectAnimNode, setSelection, realAngle, mouseDragged, mousePressed, mouseReleased … (+14) |
| `src/main/java/page/anim/MaModelEditTable.java` | `page.anim` | 230 | MaModelEditTable | MaModelEditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getSelected, getValueAt, insert, isCellEditable, reorder … (+2) |
| `src/main/java/page/anim/ModelBox.java` | `page.anim` | 202 | ModelBox, BufferedModel, GLModelBox | getInstance, BufferedModel, getEnt, paint, setEnt, getSiz, setSiz, draw, getImage, getEntity … (+10) |
| `src/main/java/page/anim/PartEditTable.java` | `page.anim` | 169 | PartEditTable | PartEditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getSelected, getValueAt, insert, isCellEditable, reorder … (+2) |
| `src/main/java/page/anim/SpriteBox.java` | `page.anim` | 362 | SpriteBox | paint, setAnim, getImage, isAnimValid, findSprite, inside, getPoint, limit, calculateSize, relativeScaling … (+7) |
| `src/main/java/page/anim/SpriteEditPage.java` | `page.anim` | 104 | SpriteEditPage | SpriteEditPage, getEdit, getBackButton, resized, addListeners, ini, setColor |
| `src/main/java/page/awt/AWTBBB.java` | `page.awt` | 42 | AWTBBB | AWTBBB, getCtrl, getDef, getIconBox, getRply, getViewBox |
| `src/main/java/page/awt/BBBuilder.java` | `page.awt` | 24 | BBBuilder | — |
| `src/main/java/page/awt/BBRecdAWT.java` | `page.awt` | 59 | BBRecdAWT | BBRecdAWT, end, info, quit, getImage |
| `src/main/java/page/awt/BattleBoxDef.java` | `page.awt` | 82 | BattleBoxDef | BattleBoxDef, getPainter, paint, paint, reset, releaseData, getImage |
| `src/main/java/page/awt/IconBoxDef.java` | `page.awt` | 79 | IconBoxDef | IconBoxDef, changeType, draw, getClip, getCtrl, setBlank, updateControllerDimension |
| `src/main/java/page/awt/RecdThread.java` | `page.awt` | 233 | RecdThread, GIFThread, MP4Thread, PNGThread | GIFThread, finish, quit, recd, MP4Thread, finish, quit, recd, PNGThread, finish … (+6) |
| `src/main/java/page/awt/ViewBoxDef.java` | `page.awt` | 161 | ViewBoxDef | ViewBoxDef, ViewBoxDef, draw, end, getCtrl, getEnt, getExp, getPrev, isBlank, paint … (+5) |
| `src/main/java/page/basis/BasisPage.java` | `page.basis` | 721 | BasisPage | BasisPage, BasisPage, getBackButton, callBack, getLub, keyTyped, mouseClicked, renew, resized, onTimer … (+26) |
| `src/main/java/page/basis/ComboListTable.java` | `page.basis` | 190 | ComboListTable | redefine, ComboListTable, setDefaultRenderer, getTableCellRendererComponent, setDefaultRenderer, getTableCellRendererComponent, setDefaultRenderer, getTableCellRendererComponent, clicked, getColumnClass … (+4) |
| `src/main/java/page/basis/LevelEditPage.java` | `page.basis` | 655 | LevelEditPage | LevelEditPage, getBackButton, resized, onTimer, addListeners, addFocusListener, focusLost, generateNames, generateOrb, getGrade … (+10) |
| `src/main/java/page/basis/LineUpBox.java` | `page.basis` | 336 | LineUpBox | LineUpBox, paint, setLU, setLimit, adjForm, click, drag, press, release, select … (+15) |
| `src/main/java/page/basis/LubCont.java` | `page.basis` | 67 | LubCont | LubCont, keyTyped, mouseClicked, mouseDragged, mousePressed, mouseReleased, onTimer |
| `src/main/java/page/basis/ModifierList.java` | `page.basis` | 95 | ModifierList | setCellRenderer, getListCellRendererComponent, reset, setComboList, setBanned, setBasis |
| `src/main/java/page/basis/NyCasBox.java` | `page.basis` | 44 | NyCasBox | NyCasBox, paint, set |
| `src/main/java/page/basis/OrbBox.java` | `page.basis` | 50 | OrbBox | OrbBox, changeOrb, paint |
| `src/main/java/page/basis/UnitFLUPage.java` | `page.basis` | 159 | UnitFLUPage | UnitFLUPage, callBack, getList, getBackButton, getLub, mouseClicked, keyTyped, renew, resized, addListeners … (+2) |
| `src/main/java/page/battle/AbRecdPage.java` | `page.battle` | 183 | AbRecdPage | AbRecdPage, preini, getBackButton, renew, resized, setRecd, addListeners |
| `src/main/java/page/battle/BBCtrl.java` | `page.battle` | 152 | BBCtrl | BBCtrl, click, release, drag, checkDragUpDown, isInDragRange |
| `src/main/java/page/battle/BBRecd.java` | `page.battle` | 11 | BBRecd | — |
| `src/main/java/page/battle/BattleBox.java` | `page.battle` | 1528 | BattleBox, BBPainter, StageNamePainter, OuterBox | drawNyCast, BBPainter, click, draw, getX, calculateSiz, getReulatedSiz, regulate, reset, adjust … (+37) |
| `src/main/java/page/battle/BattleInfoPage.java` | `page.battle` | 571 | BattleInfoPage | redefine, BattleInfoPage, BattleInfoPage, BattleInfoPage, callBack, getSpeed, keyTyped, mouseClicked, mouseDragged, mousePressed … (+8) |
| `src/main/java/page/battle/BattleSetupPage.java` | `page.battle` | 220 | BattleSetupPage | BattleSetupPage, getBackButton, getLub, renew, resized, callBack, mouseClicked, addListeners, ini, getStarLevel |
| `src/main/java/page/battle/ComingTable.java` | `page.battle` | 158 | ComingTable | redefine, ComingTable, getColumnClass, getColumnName, getRowCount, getValueAt, clicked, setData, update |
| `src/main/java/page/battle/EntityTable.java` | `page.battle` | 137 | EntityTable | EntityTable, getColumnClass, compare, get, getID |
| `src/main/java/page/battle/RecdManagePage.java` | `page.battle` | 119 | RecdManagePage | RecdManagePage, getBackButton, getSelection, resized, setList, setRecd, addListeners, ini |
| `src/main/java/page/battle/RecdSavePage.java` | `page.battle` | 86 | RecdSavePage | RecdSavePage, getBackButton, resized, addListeners, addFocusListener, focusLost, ini |
| `src/main/java/page/battle/StRecdPage.java` | `page.battle` | 151 | StRecdPage | StRecdPage, getBackButton, getSelection, renew, resized, setList, setRecd, addListeners, reordered, reordering … (+1) |
| `src/main/java/page/battle/TotalDamageTable.java` | `page.battle` | 94 | TotalDamageTable | redefine, TotalDamageTable, getColumnClass, compare, get, findForm |
| `src/main/java/page/info/ComparePage.java` | `page.info` | 992 | ComparePage | ComparePage, getBackButton, ini, setTraits, addListeners, addFocusListener, focusLost, reset, renew, addStatLabels … (+1) |
| `src/main/java/page/info/EnemyInfoPage.java` | `page.info` | 125 | EnemyInfoPage | EnemyInfoPage, getBackButton, callBack, resized, onTimer, addListeners, ini |
| `src/main/java/page/info/EnemyInfoTable.java` | `page.info` | 392 | EnemyInfoTable | EnemyInfoTable, addMouseListener, mouseClicked, reset, addMouseListener, mouseClicked, getBackButton, resized, addListeners, addFocusListener … (+5) |
| `src/main/java/page/info/EntityAbilities.java` | `page.info` | 101 | EntityAbilities | EntityAbilities, ini, getBackButton, resized, getPWidth, getPHeight |
| `src/main/java/page/info/HeadTable.java` | `page.info` | 238 | HeadTable | redefine, HeadTable, getColumnClass, getColumnCount, getColumnName, getRowCount, getValueAt, hover, clicked, setData … (+1) |
| `src/main/java/page/info/StageFilterPage.java` | `page.info` | 88 | StageFilterPage | StageFilterPage, resized, callBack, addListeners, ini |
| `src/main/java/page/info/StagePage.java` | `page.info` | 123 | StagePage | StagePage, getStage, getBackButton, mouseClicked, resized, setData, addListeners, ini, addMouseMotionListener, mouseMoved |
| `src/main/java/page/info/StageRandPage.java` | `page.info` | 77 | StageRandPage | StageRandPage, getBackButton, resized, addListeners, ini |
| `src/main/java/page/info/StageSearchPage.java` | `page.info` | 416 | StageSearchPage | StageSearchPage, resized, onTimer, setVisibility, searchSubchapter, searchStage, addListeners, renew, ini, startSearch |
| `src/main/java/page/info/StageTable.java` | `page.info` | 205 | StageTable | redefine, StageTable, addMouseMotionListener, mouseMoved, getColumnClass, getColumnName, getRowCount, getToolTipText, getValueAt, hover … (+2) |
| `src/main/java/page/info/StageViewPage.java` | `page.info` | 245 | StageViewPage | StageViewPage, StageViewPage, resized, setData, callBack, addListeners, addListeners2, confirmSearchSM, confirmSearchST, ini … (+1) |
| `src/main/java/page/info/TreaTable.java` | `page.info` | 236 | TreaTable | tos, TreaTable, getBackButton, callBack, hasFocus, resized, close, expand, ini, addFocusListener … (+6) |
| `src/main/java/page/info/UnitInfoPage.java` | `page.info` | 165 | UnitInfoPage | UnitInfoPage, UnitInfoPage, UnitInfoPage, getBackButton, callBack, resized, onTimer, addListeners, ini |
| `src/main/java/page/info/UnitInfoTable.java` | `page.info` | 499 | UnitInfoTable | UnitInfoTable, addMouseListener, mouseClicked, UnitInfoTable, addMouseListener, mouseClicked, addMouseListener, mouseClicked, getBackButton, getH … (+10) |
| `src/main/java/page/info/edit/AdvStEditPage.java` | `page.info.edit` | 414 | AdvStEditPage | AdvStEditPage, getBackButton, resized, ini, setCellRenderer, getListCellRendererComponent, setRenderer, getListCellRendererComponent, setListG, setSCG … (+3) |
| `src/main/java/page/info/edit/AtkEditTable.java` | `page.info.edit` | 269 | AtkEditTable | AtkEditTable, getBackButton, callBack, resized, setData, ini, input, set, set, addFocusListener … (+3) |
| `src/main/java/page/info/edit/EnemyEditPage.java` | `page.info.edit` | 173 | EnemyEditPage | EnemyEditPage, getBackButton, getInput, ini, changeDesc, resized, setData |
| `src/main/java/page/info/edit/EntityEditPage.java` | `page.info.edit` | 850 | EntityEditPage | EntityEditPage, getBackButton, callBack, getMusicSup, getBGSup, getEntitySup, getUnitSup, getAtk, getLvAtk, getDef … (+15) |
| `src/main/java/page/info/edit/FormEditPage.java` | `page.info.edit` | 257 | FormEditPage | FormEditPage, getAtk, getLvAtk, getDef, callBack, getInput, ini, changeDesc, resized, setData … (+1) |
| `src/main/java/page/info/edit/HeadEditTable.java` | `page.info.edit` | 578 | HeadEditTable | HeadEditTable, getBackButton, callBack, renew, resized, setData, abler, addListeners, ini, input … (+6) |
| `src/main/java/page/info/edit/LimitEditPage.java` | `page.info.edit` | 151 | LimitEditPage | LimitEditPage, getBackButton, callBack, renew, resized, ini, setLimit, setListL |
| `src/main/java/page/info/edit/LimitTable.java` | `page.info.edit` | 258 | LimitTable | redefine, LimitTable, abler, getBackButton, renew, resized, setLimit, setStageLimit, addListeners, ini … (+5) |
| `src/main/java/page/info/edit/PCoinEditPage.java` | `page.info.edit` | 142 | PCoinEditPage | PCoinEditPage, getBackButton, resized, addListeners, ini, resetList, setCoins |
| `src/main/java/page/info/edit/PCoinEditTable.java` | `page.info.edit` | 380 | PCoinEditTable, TalentInfo, NPList | TalentInfo, NPList, setListIcons, setCellRenderer, getListCellRendererComponent, PCoinEditTable, resized, ini, addListeners, resetList … (+5) |
| `src/main/java/page/info/edit/ProcTable.java` | `page.info.edit` | 173 | ProcTable, AtkProcTable, MainProcTable | AtkProcTable, getBackButton, resized, MainProcTable, getBackButton, resized, ProcTable, add, updateVisibility, setData … (+1) |
| `src/main/java/page/info/edit/SCGroupEditTable.java` | `page.info.edit` | 152 | SCGroupEditTable | redefine, SCGroupEditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getValueAt, isCellEditable, setValueAt, addLine … (+3) |
| `src/main/java/page/info/edit/StageEditPage.java` | `page.info.edit` | 534 | StageEditPage | redefine, StageEditPage, callBack, getBackButton, mouseClicked, renew, resized, checkPtsm, checkPtst, ini … (+6) |
| `src/main/java/page/info/edit/StageEditTable.java` | `page.info.edit` | 530 | StageEditTable | redefine, StageEditTable, setRenderer, getListCellRendererComponent, getCellEditor, editCellAt, getColumnClass, getColumnName, getRowCount, updateAbEnemy … (+13) |
| `src/main/java/page/info/edit/StageLimitTable.java` | `page.info.edit` | 340 | StageLimitTable | redefine, StageLimitTable, resized, ini, setData, setStageLimit, abler, addFocusListener, focusLost, input … (+4) |
| `src/main/java/page/info/edit/SwingEditor.java` | `page.info.edit` | 293 | SwingEditor, BoolEditor, EditCtrl, Supplier, IdEditor, IntEditor, PageSup, SwingEG | BoolEditor, setVisible, isInvisible, resize, setData, add, edit, EditCtrl, getEditor, setEditorVisibility … (+20) |
| `src/main/java/page/info/filter/AbEnemyFilterBox.java` | `page.info.filter` | 465 | AbEnemyFilterBox, AEFBButton, AEFBList | getNew, getNew, AbEnemyFilterBox, AbEnemyFilterBox, filterName, filterNameDynamic, confirm, AEFBButton, AEFBButton, getBackButton … (+17) |
| `src/main/java/page/info/filter/AbEnemyFindPage.java` | `page.info.filter` | 131 | AbEnemyFindPage | AbEnemyFindPage, AbEnemyFindPage, getBackButton, callBack, getList, getSelected, mouseClicked, resized, addListeners, ini … (+1) |
| `src/main/java/page/info/filter/AbEnemyListTable.java` | `page.info.filter` | 144 | AbEnemyListTable | redefine, AbEnemyListTable, getColumnClass, clicked, compare, get |
| `src/main/java/page/info/filter/AttList.java` | `page.info.filter` | 75 | AttList | btnDealer, AttList, setCellRenderer, getListCellRendererComponent |
| `src/main/java/page/info/filter/EnemyEditBox.java` | `page.info.filter` | 115 | EnemyEditBox | EnemyEditBox, setData, getBackButton, resized, ini, set |
| `src/main/java/page/info/filter/EnemyFilterBox.java` | `page.info.filter` | 456 | EnemyFilterBox, EFBButton, EFBList | getNew, getNew, EnemyFilterBox, EnemyFilterBox, filterName, filterNameDynamic, confirm, EFBButton, EFBButton, getBackButton … (+17) |
| `src/main/java/page/info/filter/EnemyFindPage.java` | `page.info.filter` | 129 | EnemyFindPage | EnemyFindPage, EnemyFindPage, getBackButton, callBack, getList, getSelected, mouseClicked, resized, addListeners, ini … (+1) |
| `src/main/java/page/info/filter/EnemyListTable.java` | `page.info.filter` | 112 | EnemyListTable | redefine, EnemyListTable, getColumnClass, clicked, compare, get |
| `src/main/java/page/info/filter/TraitList.java` | `page.info.filter` | 53 | TraitList | TraitList, setCellRenderer, getListCellRendererComponent, setListData |
| `src/main/java/page/info/filter/UnitEditBox.java` | `page.info.filter` | 111 | UnitEditBox | UnitEditBox, setData, getBackButton, resized, confirm, ini, set |
| `src/main/java/page/info/filter/UnitFilterBox.java` | `page.info.filter` | 482 | UnitFilterBox, UFBButton, UFBList | getNew, getNew, UnitFilterBox, UnitFilterBox, filterName, filterNameDynamic, confirm, UFBButton, UFBButton, getBackButton … (+17) |
| `src/main/java/page/info/filter/UnitFindPage.java` | `page.info.filter` | 122 | UnitFindPage | UnitFindPage, UnitFindPage, callBack, getBackButton, getForm, getList, getSelected, mouseClicked, resized, addListeners … (+2) |
| `src/main/java/page/info/filter/UnitListTable.java` | `page.info.filter` | 121 | UnitListTable | redefine, UnitListTable, clicked, getColumnClass, compare, get |
| `src/main/java/page/pack/BGEditPage.java` | `page.pack` | 445 | BGEditPage | BGEditPage, getBackButton, renew, resized, onTimer, addFocusListener, focusLost, addFocusListener, focusLost, getFile … (+9) |
| `src/main/java/page/pack/CGLREditPage.java` | `page.pack` | 487 | CGLREditPage | CGLREditPage, getBackButton, renew, resized, addListeners, CG, LR, ini, put, set … (+8) |
| `src/main/java/page/pack/CastleEditPage.java` | `page.pack` | 213 | CastleEditPage | CastleEditPage, getBackButton, resized, addListeners, addFocusListener, focusLost, getFile, ini, setList |
| `src/main/java/page/pack/CharaGroupPage.java` | `page.pack` | 147 | CharaGroupPage | CharaGroupPage, CharaGroupPage, CharaGroupPage, getBackButton, resized, addListeners, ini, updateCG, updatePack |
| `src/main/java/page/pack/ComboEditPage.java` | `page.pack` | 408 | ComboEditPage | ComboEditPage, getBackButton, renew, ini, getSelectionModel, valueChanged, mouseReleased, mouseClicked, resized, setPack … (+4) |
| `src/main/java/page/pack/ComboEditTable.java` | `page.pack` | 246 | ComboEditTable | redefine, ComboEditTable, setRenderer, getListCellRendererComponent, setRenderer, getListCellRendererComponent, setDefaultRenderer, getTableCellRendererComponent, setDefaultRenderer, getTableCellRendererComponent … (+13) |
| `src/main/java/page/pack/EREditPage.java` | `page.pack` | 357 | EREditPage | redefine, EREditPage, EREditPage, getBackButton, mouseClicked, renew, resized, addListeners, addFocusListener, focusLost … (+6) |
| `src/main/java/page/pack/EREditTable.java` | `page.pack` | 218 | EREditTable | redefine, EREditTable, editCellAt, getColumnClass, getColumnName, getRowCount, getValueAt, isCellEditable, reorder, setValueAt … (+6) |
| `src/main/java/page/pack/LvRestrictPage.java` | `page.pack` | 195 | LvRestrictPage | LvRestrictPage, LvRestrictPage, LvRestrictPage, getBackButton, resized, addListeners, ini, set, updateCG, updateLR … (+1) |
| `src/main/java/page/pack/MusicEditPage.java` | `page.pack` | 344 | MusicEditPage | MusicEditPage, resized, getBackButton, getFile, stopBG, readMusic, addListeners, ini, toggleButtons, setList … (+4) |
| `src/main/java/page/pack/PackEditPage.java` | `page.pack` | 879 | PackEditPage | PackEditPage, getBackButton, renew, resized, addListeners, addFocusListener, focusLost, checkAddr, ini, setEnemy … (+7) |
| `src/main/java/page/pack/PackValidationPage.java` | `page.pack` | 189 | PackValidationPage | PackValidationPage, resized, getBackButton, initialize, setCellRenderer, getListCellRendererComponent, setPair, findPair |
| `src/main/java/page/pack/RecdPackPage.java` | `page.pack` | 91 | RecdPackPage | RecdPackPage, getSelection, resized, setList, setRecd, addListeners, ini |
| `src/main/java/page/pack/ResourcePage.java` | `page.pack` | 211 | ResourcePage | ResourcePage, getBackButton, resized, addListeners, renderText, addTree, filemove, ini, setSele, setTree |
| `src/main/java/page/pack/SoulEditPage.java` | `page.pack` | 264 | SoulEditPage | SoulEditPage, getBackButton, renew, resized, addListeners, ini, setPack, setSoul |
| `src/main/java/page/pack/TraitEditPage.java` | `page.pack` | 319 | TraitEditPage | TraitEditPage, getBackButton, renew, resized, CG, updateCTL, updateCT, ini, getFile, setIconImage |
| `src/main/java/page/pack/UnitManagePage.java` | `page.pack` | 726 | UnitManagePage | UnitManagePage, getBackButton, renew, resized, addListeners, reordered, reordering, addFocusListener, focusLost, addFocusListener … (+17) |
| `src/main/java/page/support/AbJTable.java` | `page.support` | 105 | AbJTable, TModel | AbJTable, addTableModelListener, getColumnCount, isCellEditable, removeTableModelListener, setValueAt, swap, TModel, getColumn, removeColumn |
| `src/main/java/page/support/AnimLCR.java` | `page.support` | 44 | AnimLCR | getListCellRendererComponent |
| `src/main/java/page/support/AnimTable.java` | `page.support` | 18 | AnimTable | AnimTable |
| `src/main/java/page/support/AnimTableTH.java` | `page.support` | 72 | AnimTableTH | AnimTableTH, canImport, getSourceActions, importData, createTransferable, exportDone |
| `src/main/java/page/support/AnimTransfer.java` | `page.support` | 41 | AnimTransfer | AnimTransfer, getTransferData, getTransferDataFlavors, isDataFlavorSupported |
| `src/main/java/page/support/AnimTreeRenderer.java` | `page.support` | 81 | AnimTreeRenderer | getTreeCellRendererComponent |
| `src/main/java/page/support/AnimTreeTransfer.java` | `page.support` | 251 | AnimTreeTransfer, NodeTransferable | AnimTreeTransfer, canImport, createTransferable, exportDone, getSourceActions, importData, cloneNode, NodeTransferable, getTransferDataFlavors, isDataFlavorSupported … (+1) |
| `src/main/java/page/support/BackgroundLCR.java` | `page.support` | 28 | BackgroundLCR | getListCellRendererComponent |
| `src/main/java/page/support/ColorPicker.java` | `page.support` | 600 | ColorPicker, MODE, DRAGMODE | ColorPicker, updateRgb, updateHsb, setHex, setMode, paintComponent, updateField, updateBar, changeBarPos, changeCirclePos … (+4) |
| `src/main/java/page/support/CrossList.java` | `page.support` | 48 | CrossList | CrossList, setCellRenderer, getListCellRendererComponent, CrossList, setCheck, setList |
| `src/main/java/page/support/EnemyTCR.java` | `page.support` | 39 | EnemyTCR | EnemyTCR, getTableCellRendererComponent |
| `src/main/java/page/support/Exporter.java` | `page.support` | 124 | Exporter | Exporter, Exporter, Exporter, Exporter, getSafeFile |
| `src/main/java/page/support/Importer.java` | `page.support` | 89 | Importer, FileType | FileType, getExt, getDesc, getDir, Importer, exists, getImg, verify |
| `src/main/java/page/support/InListTH.java` | `page.support` | 117 | InListTH | InListTH, InListTH, canImport, getSourceActions, getTransferData, getTransferDataFlavors, importData, isDataFlavorSupported, createTransferable, exportDone |
| `src/main/java/page/support/InTableTH.java` | `page.support` | 95 | InTableTH | InTableTH, canImport, getSourceActions, getTransferData, getTransferDataFlavors, importData, isDataFlavorSupported, createTransferable, exportDone |
| `src/main/java/page/support/ListJtfPolicy.java` | `page.support` | 71 | ListJtfPolicy | add, end, getComponentAfter, getComponentBefore, getDefaultComponent, getFirstComponent, getLastComponent |
| `src/main/java/page/support/RLFIM.java` | `page.support` | 85 | RLFIM | RLFIM, addItem, deleteItem, reordered, reordering, setListData, setListData, setListData |
| `src/main/java/page/support/ReorderList.java` | `page.support` | 100 | ReorderList | ReorderList, ReorderList, ReorderList, ReorderList, add, reorder, setListData, setListData, allowDrag |
| `src/main/java/page/support/ReorderListener.java` | `page.support` | 13 | ReorderListener | add |
| `src/main/java/page/support/Reorderable.java` | `page.support` | 7 | Reorderable | — |
| `src/main/java/page/support/SortTable.java` | `page.support` | 94 | SortTable, Comp | SortTable, getTableHeader, mouseClicked, getColumnName, getRowCount, getValueAt, setList, setHeader, Comp, compare |
| `src/main/java/page/support/SoulLCR.java` | `page.support` | 40 | SoulLCR | getListCellRendererComponent |
| `src/main/java/page/support/TreeNodeExpander.java` | `page.support` | 89 | TreeNodeExpander, NodeDimensionHandler | TreeNodeExpander, prepareForUIInstall, createNodeDimensions, createDefaultCellRenderer, getNodeDimensions |
| `src/main/java/page/support/UnitLCR.java` | `page.support` | 44 | UnitLCR | getListCellRendererComponent |
| `src/main/java/page/support/UnitTCR.java` | `page.support` | 51 | UnitTCR | UnitTCR, UnitTCR, getTableCellRendererComponent |
| `src/main/java/page/view/AbViewPage.java` | `page.view` | 417 | AbViewPage | AbViewPage, AbViewPage, enabler, getBackButton, exit, mouseDragged, mousePressed, mouseReleased, mouseWheel, preini … (+9) |
| `src/main/java/page/view/BGViewPage.java` | `page.view` | 113 | BGViewPage | BGViewPage, BGViewPage, BGViewPage, getBackButton, getSelected, resized, onTimer, addListeners, ini |
| `src/main/java/page/view/CastleViewPage.java` | `page.view` | 125 | CastleViewPage | CastleViewPage, CastleViewPage, CastleViewPage, CastleViewPage, getVal, getBackButton, resized, addListeners, ini |
| `src/main/java/page/view/EffectViewPage.java` | `page.view` | 67 | EffectViewPage | EffectViewPage, resized, updateChoice, addListeners, ini |
| `src/main/java/page/view/EnemyViewPage.java` | `page.view` | 199 | EnemyViewPage | EnemyViewPage, EnemyViewPage, EnemyViewPage, resized, updateChoice, addListeners, ini, copyAnim, copyAnim |
| `src/main/java/page/view/MusicPage.java` | `page.view` | 110 | MusicPage | MusicPage, MusicPage, MusicPage, MusicPage, getSelectedID, exit, resized, getBackButton, addListeners, ini … (+1) |
| `src/main/java/page/view/UnitViewPage.java` | `page.view` | 202 | UnitViewPage | UnitViewPage, UnitViewPage, UnitViewPage, resized, updateChoice, addListeners, ini, copyAnim |
| `src/main/java/page/view/ViewBox.java` | `page.view` | 151 | ViewBox, Conf, Controller, Loader, VBExporter | mouseDragged, mousePressed, mouseReleased, resize, setCont, resetPos, Loader, callBack, finish, getProg … (+8) |
| `src/main/java/res/AnimatedGifEncoder.java` | `res` | 463 | AnimatedGifEncoder | addFrame, finish, setDelay, setDispose, setFrameRate, setQuality, setRepeat, setSize, setTransparent, start … (+12) |
| `src/main/java/res/LZWEncoder.java` | `res` | 281 | LZWEncoder | LZWEncoder, char_out, cl_block, cl_hash, compress, encode, flush_char, MAXCODE, output, nextPixel |
| `src/main/java/res/NeuQuant.java` | `res` | 481 | NeuQuant | NeuQuant, colorMap, inxbuild, learn, map, process, unbiasnet, alterneigh, altersingle, contest |
| `src/main/java/utilpc/Algorithm.java` | `utilpc` | 339 | Algorithm, SRResult, ColorShift, StackRect, Dot | SRResult, mid, inv, seg, proc, shift, Dot, Dot, add, cleanNxt … (+20) |
| `src/main/java/utilpc/Backup.java` | `—` | 0 | — | — |
| `src/main/java/utilpc/ColorSet.java` | `utilpc` | 70 | ColorSet | setTheme |
| `src/main/java/utilpc/Interpret.java` | `utilpc` | 1298 | Interpret, ProcDisplay | loadCannonMax, allRangeSame, comboInfo, base, ProcDisplay, toString, getIcon, getProc, getAbi, getComboFilter … (+24) |
| `src/main/java/utilpc/OggTimeReader.java` | `utilpc` | 181 | OggTimeReader | OggTimeReader, getNextByte, getNextDouble, getNextInt, getNextString, getTime, getTimeWithInfo, skip |
| `src/main/java/utilpc/PP.java` | `utilpc` | 89 | PP | PP, PP, PP, PP, copy, divide, sf, times, times, times … (+6) |
| `src/main/java/utilpc/ReColor.java` | `utilpc` | 52 | ReColor | transcolor, real |
| `src/main/java/utilpc/Theme.java` | `utilpc` | 21 | Theme | — |
| `src/main/java/utilpc/UtilPC.java` | `utilpc` | 277 | UtilPC, PCItr | save, getMusicLength, route, setSE, setSE, setBGM, getBg, getIcon, createIcon, createIcon … (+8) |
| `src/main/java/utilpc/awt/Blender.java` | `utilpc.awt` | 111 | Blender | Blender, compose, createContext, dispose, comp3, comp4 |
| `src/main/java/utilpc/awt/Converter.java` | `utilpc.awt` | 45 | Converter | Converter, compose, createContext, dispose, comp3 |
| `src/main/java/utilpc/awt/FG2D.java` | `utilpc.awt` | 198 | FG2D | FG2D, colRect, drawImage, drawImage, drawLine, drawOval, drawRect, fillOval, fillRect, getTransform … (+15) |
| `src/main/java/utilpc/awt/FIBI.java` | `utilpc.awt` | 94 | FIBI | build, FIBI, bimg, getHeight, getRGB, getSubimage, getWidth, gl, isValid, setRGB … (+3) |
| `src/main/java/utilpc/awt/FTAT.java` | `utilpc.awt` | 20 | FTAT | FTAT, getAT |
| `src/main/java/utilpc/awt/Masker.java` | `utilpc.awt` | 41 | Masker | Masker, createContext, dispose, compose |
| `src/main/java/utilpc/awt/PCIB.java` | `utilpc.awt` | 103 | PCIB | build, build, build, build, write |

# Appendix C — Android reference full source inventory

### BCU Android source files

| Path | Package | Lines | Classes | Key methods |
|---|---:|---:|---|---|
| `app/src/androidTest/java/com/mandarin/bcu/ExampleInstrumentedTest.java` | `com.mandarin.bcu` | 27 | ExampleInstrumentedTest | useAppContext |
| `app/src/debug/java/com/mandarin/bcu/androidutil/supports/LeakCanaryManager.kt` | `com.mandarin.bcu.androidutil.supports` | 19 | LeakCanaryManager | initCanary |
| `app/src/main/java/com/mandarin/bcu/androidutil/AnimatedGifEncoder.java` | `com.mandarin.bcu.androidutil` | 1283 | AnimatedGifEncoder, NeuQuant, LZWEncoder | delay, size, code, setDelay, setDispose, setRepeat, setTransparent, addFrame, setSize, analyzePixels … (+70) |
| `app/src/main/java/com/mandarin/bcu/androidutil/animation/AnimationCView.kt` | `com.mandarin.bcu.androidutil.animation` | 190 | AnimationCView, AnimationType | AnimationCView, IllegalStateException, IllegalStateException, IllegalStateException, IllegalStateException, IllegalStateException, IllegalStateException, if, onAttachedToWindow, onDraw |
| `app/src/main/java/com/mandarin/bcu/androidutil/animation/GifSession.kt` | `com.mandarin.bcu.androidutil.animation` | 213 | GifSession, Watcher | GifSession, startSession, pushFrame, closeSession, initializeAnimation, IllegalStateException, IllegalStateException, IllegalStateException, start, close |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/BattleBox.java` | `com.mandarin.bcu.androidutil.battle` | 1121 | BattleBox, BBPainter, OuterBox | drawNyCast, SymCoord, P, BBPainter, click, draw, if, setSym, setP, getX … (+28) |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/BattleView.kt` | `com.mandarin.bcu.androidutil.battle` | 733 | BattleView, Updater | BattleView, BBCtrl, loadSE, onDraw, while, if, onDetachedFromWindow, getSpeed, callBack, run … (+43) |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/BBCtrl.java` | `com.mandarin.bcu.androidutil.battle` | 161 | BBCtrl | BBCtrl, click, P, P, P, P, P, if, P, P … (+2) |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/RetFunc.java` | `com.mandarin.bcu.androidutil.battle` | 7 | RetFunc | callBack |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/sound/PauseCountDown.java` | `com.mandarin.bcu.androidutil.battle.sound` | 218 | so, PauseCountDown | PauseCountDown, cancel, create, pause, resume, isPaused, isRunning, timeLeft, totalCountdown, timePassed … (+8) |
| `app/src/main/java/com/mandarin/bcu/androidutil/battle/sound/SoundHandler.kt` | `com.mandarin.bcu.androidutil.battle.sound` | 485 | SoundHandler | setSE, if, if, if, check, if, setSE, if, if, check … (+20) |
| `app/src/main/java/com/mandarin/bcu/androidutil/castle/CsListPager.kt` | `com.mandarin.bcu.androidutil.castle` | 130 | CsListPager | newInstance, onCreateView, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/Definer.kt` | `com.mandarin.bcu.androidutil` | 700 | Definer | define, AssetException, LanguageException, if, LanguageException, redefine, handlePacks, if, if, for … (+9) |
| `app/src/main/java/com/mandarin/bcu/androidutil/enemy/adapters/DynamicEmExplanation.kt` | `com.mandarin.bcu.androidutil.enemy.adapters` | 65 | DynamicEmExplanation | DynamicEmExplanation, instantiateItem, if, getCount, isViewFromObject |
| `app/src/main/java/com/mandarin/bcu/androidutil/enemy/adapters/EnemyListAdapter.kt` | `com.mandarin.bcu.androidutil.enemy.adapters` | 82 | EnemyListAdapter, ViewHolder | EnemyListAdapter, ViewHolder, getView, if, if, generateName, if, isEnabled, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/enemy/adapters/EnemyListPager.kt` | `com.mandarin.bcu.androidutil.enemy.adapters` | 153 | EnemyListPager | newInstance, onCreateView, validate, when |
| `app/src/main/java/com/mandarin/bcu/androidutil/enemy/adapters/EnemyRecycle.kt` | `com.mandarin.bcu.androidutil.enemy.adapters` | 710 | EnemyRecycle, ViewHolder | constructor, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, if, if, arrayOf, listeners, if … (+31) |
| `app/src/main/java/com/mandarin/bcu/androidutil/fakeandroid/AndroidKeys.kt` | `com.mandarin.bcu.androidutil.fakeandroid` | 11 | AndroidKeys | pressed, remove |
| `app/src/main/java/com/mandarin/bcu/androidutil/fakeandroid/BMBuilder.kt` | `com.mandarin.bcu.androidutil.fakeandroid` | 53 | BMBuilder | write, if, if, build, FIBM, FIBM, build, FIBM, FIBM, FIBM … (+5) |
| `app/src/main/java/com/mandarin/bcu/androidutil/fakeandroid/CVGraphics.kt` | `com.mandarin.bcu.androidutil.fakeandroid` | 382 | CVGraphics | clear, constructor, setCanvas, drawImage, if, drawImage, if, drawLine, drawOval, drawRect … (+24) |
| `app/src/main/java/com/mandarin/bcu/androidutil/fakeandroid/FIBM.kt` | `com.mandarin.bcu.androidutil.fakeandroid` | 239 | FIBM, Snap | build, constructor, bimg, getHeight, getWidth, getRGB, getSubimage, gl, setRGB, isValid … (+10) |
| `app/src/main/java/com/mandarin/bcu/androidutil/fakeandroid/FTMT.kt` | `com.mandarin.bcu.androidutil.fakeandroid` | 25 | FTMT | constructor, getAT, updateMatrix, setMatrix |
| `app/src/main/java/com/mandarin/bcu/androidutil/filter/FilterEntity.kt` | `com.mandarin.bcu.androidutil.filter` | 475 | FilterEntity | setUnitFilter, ArrayList, if, hasTrait, hasTrait, if, if, getChance, getChance, if … (+26) |
| `app/src/main/java/com/mandarin/bcu/androidutil/filter/FilterStage.kt` | `com.mandarin.bcu.androidutil.filter` | 192 | FilterStage | setFilter, if, containEnemy, if, if, containsAll, hasBoss, for, contains, for … (+2) |
| `app/src/main/java/com/mandarin/bcu/androidutil/filter/KoreanFilter.kt` | `com.mandarin.bcu.androidutil.filter` | 52 | KoreanFilter | isSegments, if, isKorean, isSegment, extractSegment, filter, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/GetStrings.kt` | `com.mandarin.bcu.androidutil` | 1073 | GetStrings | GetStrings, if, getTitle, if, getAtkTime, if, DecimalFormat, getAtkTime, if, DecimalFormat … (+70) |
| `app/src/main/java/com/mandarin/bcu/androidutil/Interpret.kt` | `com.mandarin.bcu.androidutil` | 423 | Interpret | getTrait, getProc, for, for, getProcObject, when, isValidProc, when, getFullExplanationWithAtk, isResist … (+17) |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/AContext.kt` | `com.mandarin.bcu.androidutil.io` | 283 | AContext | check, updateActivity, noticeErr, if, if, if, getWorkspaceFile, File, File, File … (+41) |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/AssetDownloadService.kt` | `com.mandarin.bcu.androidutil.io` | 308 | AssetDownloadService, MessageReceiver | onBind, onCreate, onStartCommand, if, for, if, sendBroadcast, onDestroy, onTaskRemoved, sendBroadcast … (+4) |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/AssetException.kt` | `com.mandarin.bcu.androidutil.io` | 3 | AssetException | AssetException |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/DefferedLoader.kt` | `com.mandarin.bcu.androidutil.io` | 31 | DefferedLoader | clearPending, load |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/DefineItf.kt` | `com.mandarin.bcu.androidutil.io` | 64 | DefineItf | check, save, getMusicLength, route, File, setSE, setSE, setBGM, init |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/drive/DriveUtil.kt` | `com.mandarin.bcu.androidutil.io.drive` | 39 | DriveUtil | upload |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/ErrorLogWriter.kt` | `com.mandarin.bcu.androidutil.io` | 273 | ErrorLogWriter | ErrorLogWriter, uncaughtException, writeToFile, generateMessage, writeDriveLog, writeLog, writeLog, getExistingFileName, upload |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/LangLoader.kt` | `com.mandarin.bcu.androidutil.io` | 362 | LangLoader | readUnitLang, while, while, while, while, if, readEnemyLang, if, if, if … (+8) |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/LanguageException.kt` | `com.mandarin.bcu.androidutil.io` | 3 | LanguageException | LanguageException |
| `app/src/main/java/com/mandarin/bcu/androidutil/io/MediaScanner.kt` | `com.mandarin.bcu.androidutil.io` | 155 | MediaScanner | putImage, if, putImageQ, IOException, IOException, IOException, putImageP, writeGIF, if, writeGIFQ … (+3) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/ComboListAdapter.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 101 | ComboListAdapter, ViewHolder | constructor, ViewHolder, getView, if, getDescription, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/ComboSchListAdapter.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 146 | ComboSchListAdapter, ViewHolder | constructor, ViewHolder, getView, if, for |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/ComboSubSchListAdapter.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 124 | ComboSubSchListAdapter, ViewHolder | constructor, ViewHolder, getView, if, for |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUCastleSetting.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 89 | LUCastleSetting | onCreateView, update, setNyb, if, drawCastle, newInstance, LUCastleSetting |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUCatCombo.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 167 | LUCatCombo | onCreateView, if, if, setVariables, newInstance |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUConstruction.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 274 | LUConstruction | onCreateView, update, listeners, beforeTextChanged, onTextChanged, afterTextChanged, if, setListenerforTextInputLayouts, setListenersFortextInputEditText, for … (+8) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUFoundationDecoration.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 286 | LUFoundationDecoration | newInstances, onCreateView, update, listeners, beforeTextChanged, onTextChanged, afterTextChanged, if, beforeTextChanged, onTextChanged … (+4) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUOrbSetting.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 1203 | LUOrbSetting | newInstance, onCreateView, update, update, update, listeners, onNothingSelected, onItemSelected, generateTraitData, needTraitFiltering … (+70) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUTreasureSetting.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 798 | LUTreasureSetting | newInstance, onCreateView, listeners, update, listeners, for, for, valuesAllSame, setListenerforTextInputLayout, setListenerforTextInputLayouts … (+13) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUUnitList.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 152 | LUUnitList | onCreateView, if, update, sync, if, for, if, alreadyExist, for, if … (+3) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUUnitListAdapter.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 140 | LUUnitListAdapter, ViewHolder | LUUnitListAdapter, ViewHolder, updateComponents, getView, if, isEnabled, if, if, generateID, if … (+1) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/adapters/LUUnitSetting.kt` | `com.mandarin.bcu.androidutil.lineup.adapters` | 619 | LUUnitSetting | newInstance, onCreateView, update, if, if, for, onItemSelected, if, onNothingSelected, onItemSelected … (+31) |
| `app/src/main/java/com/mandarin/bcu/androidutil/lineup/LineUpView.kt` | `com.mandarin.bcu.androidutil.lineup` | 793 | LineUpView | get, constructor, for, onFinish, onTick, onLayout, canDraw, onDraw, attachStageLimit, drawFloatingImage … (+56) |
| `app/src/main/java/com/mandarin/bcu/androidutil/LocaleManager.kt` | `com.mandarin.bcu.androidutil` | 67 | LocaleManager | langChange, if, if, ContextWrapper, setSystemLocaleLegacy, setSystemLocale |
| `app/src/main/java/com/mandarin/bcu/androidutil/medal/adapters/MedalListAdapter.kt` | `com.mandarin.bcu.androidutil.medal.adapters` | 102 | MedalListAdapter, ViewHolder | MedalListAdapter, constructor, getView, if, onSingleClick, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/music/adapters/MusicListAdapter.kt` | `com.mandarin.bcu.androidutil.music.adapters` | 72 | MusicListAdapter, ViewHolder | MusicListAdapter, ViewHolder, getView, if, if, if, generateName, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/music/adapters/MusicListPager.kt` | `com.mandarin.bcu.androidutil.music.adapters` | 79 | MusicListPager | newIntance, onCreateView, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/music/OggDataSource.kt` | `com.mandarin.bcu.androidutil.music` | 34 | OggDataSource | OggDataSource, close, readAt, getSize |
| `app/src/main/java/com/mandarin/bcu/androidutil/pack/adapters/PackManagementAdapter.kt` | `com.mandarin.bcu.androidutil.pack.adapters` | 214 | PackManagementAdapter, ViewHolder | PackManagementAdapter, ViewHolder, getView, if, onSingleClick, getCount, byteToMB, deletePack, for, cantDelete … (+3) |
| `app/src/main/java/com/mandarin/bcu/androidutil/pack/conflict/adapters/PackConfListAdapter.kt` | `com.mandarin.bcu.androidutil.pack.conflict.adapters` | 482 | PackConfListAdapter, ViewHolder | PackConfListAdapter, ViewHolder, getView, if, getView, getDropDownView, isEnabled, isValid, onNothingSelected, onItemSelected … (+19) |
| `app/src/main/java/com/mandarin/bcu/androidutil/pack/conflict/asynchs/PackConfSolver.kt` | `com.mandarin.bcu.androidutil.pack.conflict.asynchs` | 114 | PackConfSolver | PackConfSolver, prepare, doSomething, progressUpdate, finish, if, check, for, if, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/pack/PackConflict.java` | `com.mandarin.bcu.androidutil.pack` | 401 | PackConflict | filterConflict, PackConflict, setAction, solve, File, if, File, File, File, if … (+15) |
| `app/src/main/java/com/mandarin/bcu/androidutil/Revalidater.kt` | `com.mandarin.bcu.androidutil` | 38 | Revalidater | validate |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/CStageListAdapter.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 149 | CStageListAdapter, ViewHolder | CStageListAdapter, ViewHolder, getView, if, getID, if, if, haveSame, for, if … (+7) |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/DropRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 155 | DropRecycle, ViewHolder | DropRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount, handleDrops, for, if, if … (+4) |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/EnemyListRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 73 | EnemyListRecycle, ViewHolder | constructor, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, if, getItemCount |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/ExRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 130 | ExRecycle, ViewHolder | ExRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, onSingleClick, getItemCount, handleChance, handleStage, for … (+1) |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/LimitRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 38 | LimitRecycle, ViewHolder | LimitRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/MapListAdapter.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 101 | MapListAdapter, ViewHolder | MapListAdapter, constructor, getView, if, if, generateStar, withID, if, generateStar |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/MiscRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 31 | MiscRecycle, ViewHolder | MiscRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/ScoreRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 47 | ScoreRecycle, ViewHolder | constructor, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/StageListAdapter.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 121 | StageListAdapter, ViewHolder | StageListAdapter, constructor, getView, if, getid, haveSame, for, if, reverse, getStageName … (+3) |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/StageRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 689 | StageRecycle, ViewHolder | StageRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, if, for, onItemSelected, if, onNothingSelected … (+29) |
| `app/src/main/java/com/mandarin/bcu/androidutil/stage/adapters/StEnListRecycle.kt` | `com.mandarin.bcu.androidutil.stage.adapters` | 196 | StEnListRecycle, ViewHolder | StEnListRecycle, if, onCreateViewHolder, ViewHolder, onBindViewHolder, if, onSingleClick, getItemCount, ViewHolder, reverse |
| `app/src/main/java/com/mandarin/bcu/androidutil/StatFilterElement.kt` | `com.mandarin.bcu.androidutil` | 271 | StatFilterElement | StatFilterElement, performFilter, performFilter, canBeAdded, canBeAdded, canBeAdded, setFilter, performData, performData, performData … (+29) |
| `app/src/main/java/com/mandarin/bcu/androidutil/StaticJava.java` | `com.mandarin.bcu.androidutil` | 73 | StaticJava | generateEAnimD, EAnimD, if, EAnimD, if, if, if, if, EAnimD, if … (+1) |
| `app/src/main/java/com/mandarin/bcu/androidutil/StaticStore.kt` | `com.mandarin.bcu.androidutil` | 1390 | StaticStore | clear, filterReset, resetUserPacks, getResize, getResizeb, empty, getResizeb, empty, empty, empty … (+70) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/AdapterAbil.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 69 | AdapterAbil, ViewHolder | AdapterAbil, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount, ViewHolder |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/AssetListAdapter.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 188 | AssetListAdapter, ViewHolder | AssetListAdapter, ViewHolder, getView, if, if, while, onSingleClick, getFileExtension, isFile, calculateSize … (+1) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/BGListPager.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 97 | BGListPager | newInstance, onCreateView, if, generateName, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/DataResetAdapter.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 71 | DataResetAdapter, ViewHolder | DataResetAdapter, ViewHolder, getView, if, canReset |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/EffListPager.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 175 | EffListPager | newInstance, onCreateView, IllegalStateException, generateEffName, generateEffName, requireContext, generateEffName, requireContext |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/GIFRangeRecycle.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 168 | GIFRangeRecycle, ViewHolder | GIFRangeRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, getItemCount, generateRangeName, getEAnimD, IllegalStateException, IllegalStateException … (+9) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/SearchAbilityAdapter.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 154 | SearchAbilityAdapter, ViewHolder | SearchAbilityAdapter, ViewHolder, onCreateViewHolder, ViewHolder, getItemCount, if, onBindViewHolder, if, getIcon, updateList … (+6) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/SearchTraitAdapter.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 173 | SearchTraitAdapter, ViewHolder | SearchTraitAdapter, ViewHolder, onCreateViewHolder, ViewHolder, getItemCount, if, onBindViewHolder, if, updateList, getIcon … (+8) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/adapter/StatFilterAdapter.kt` | `com.mandarin.bcu.androidutil.supports.adapter` | 129 | StatFilterAdapter, ViewHolder | StatFilterAdapter, ViewHolder, onCreateViewHolder, ViewHolder, getItemCount, onBindViewHolder, afterTextChanged, beforeTextChanged, onTextChanged, fade … (+4) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/AlphaAnimator.kt` | `com.mandarin.bcu.androidutil.supports` | 37 | AlphaAnimator | AlphaAnimator, filter, if, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/AnimatorConst.kt` | `com.mandarin.bcu.androidutil.supports` | 20 | AnimatorConst, Dimension, Accelerator, Axis | — |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/AutoMarquee.kt` | `com.mandarin.bcu.androidutil.supports` | 42 | AutoMarquee | onFocusChanged, onWindowFocusChanged |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/ColorPickerView.kt` | `com.mandarin.bcu.androidutil.supports` | 579 | ColorPickerView, MODE, DRAGMODE | updateBar, updateColorByPos, updateColorByPos, if, updateColorByPos, if, performClick, if, updateBar, updateColorByPos … (+31) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/CoroutineTask.kt` | `com.mandarin.bcu.androidutil.supports` | 104 | CoroutineTask, Status | prepare, doSomething, finish, progressUpdate, publishProgress, execute, IllegalStateException, CoroutineScope, getOut, cancel … (+4) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/CustomAnimator.kt` | `com.mandarin.bcu.androidutil.supports` | 26 | CustomAnimator | CustomAnimator |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/DataResetHandler.kt` | `com.mandarin.bcu.androidutil.supports` | 91 | DataResetHandler, TYPE | DataResetHandler, IllegalStateException, performReset, IllegalStateException |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/MeasureViewPager.kt` | `com.mandarin.bcu.androidutil.supports` | 27 | MeasureViewPager | onMeasure, for, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/PP.java` | `com.mandarin.bcu.androidutil.supports` | 69 | PP | PP, PP, copy, PP, divide, sf, PP, times, times, times … (+6) |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/ScaleAnimator.kt` | `com.mandarin.bcu.androidutil.supports` | 36 | ScaleAnimator | ScaleAnimator, when |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/SingleClick.kt` | `com.mandarin.bcu.androidutil.supports` | 23 | SingleClick | onSingleClick, onClick, if, onSingleClick |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/StageBitmapGenerator.kt` | `com.mandarin.bcu.androidutil.supports` | 122 | StageBitmapGenerator, FONTMODE | StageBitmapGenerator, for, if, intArrayOf, intArrayOf, generateTextImage, if, getTextHeight |
| `app/src/main/java/com/mandarin/bcu/androidutil/supports/TranslationAnimator.kt` | `com.mandarin.bcu.androidutil.supports` | 31 | TranslationAnimator | TranslationAnimator, when |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/DynamicExplanation.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 82 | DynamicExplanation | newInstance, onCreateView, for, if |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/DynamicFruit.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 139 | DynamicFruit | DynamicFruit, instantiateItem, for, getCount, isViewFromObject |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/UnitInfoPager.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 1055 | UnitInfoPager | newInstance, onCreateView, if, arrayOf, for, for, if, listeners, for, listeners … (+40) |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/UnitInfoRecycle.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 981 | UnitInfoRecycle, ViewHolder | UnitInfoRecycle, ViewHolder, onCreateViewHolder, ViewHolder, onBindViewHolder, arrayOf, for, listeners, for, for … (+43) |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/UnitListAdapter.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 68 | UnitListAdapter, ViewHolder | UnitListAdapter, ViewHolder, getView, if, isEnabled |
| `app/src/main/java/com/mandarin/bcu/androidutil/unit/adapters/UnitListPager.kt` | `com.mandarin.bcu.androidutil.unit.adapters` | 138 | UnitListPager | newInstance, onCreateView, validate |
| `app/src/main/java/com/mandarin/bcu/AnimationViewer.kt` | `com.mandarin.bcu` | 295 | AnimationViewer, UnitListTab | onCreate, if, withContext, if, beforeTextChanged, onTextChanged, afterTextChanged, onSingleClick, onSingleClick, handleOnBackPressed … (+10) |
| `app/src/main/java/com/mandarin/bcu/ApkDownload.kt` | `com.mandarin.bcu` | 269 | ApkDownload | onCreate, if, onSingleClick, attachBaseContext, onDestroy, onResume, downloadAndInstall, downloadApk, if, if … (+2) |
| `app/src/main/java/com/mandarin/bcu/AssetBrowser.kt` | `com.mandarin.bcu` | 275 | AssetBrowser | if, if, while, if, onCreate, if, withContext, generateFileList, handleOnBackPressed, generateFileList … (+5) |
| `app/src/main/java/com/mandarin/bcu/BackgroundList.kt` | `com.mandarin.bcu` | 206 | BackgroundList, BGListTab | onCreate, onSingleClick, attachBaseContext, onDestroy, onResume, getExistingBGPack, for, max, getExistingPack, if … (+2) |
| `app/src/main/java/com/mandarin/bcu/BattlePrepare.kt` | `com.mandarin.bcu` | 470 | BattlePrepare | onCreate, if, withContext, if, while, if, onSingleClick, if, onSingleClick, finish … (+13) |
| `app/src/main/java/com/mandarin/bcu/BattleSimulation.kt` | `com.mandarin.bcu` | 1054 | BattleSimulation, ScaleListener | onCreate, if, if, if, if, withContext, intArrayOf, setLayerType, addTarget, addTarget … (+50) |
| `app/src/main/java/com/mandarin/bcu/CastleList.kt` | `com.mandarin.bcu` | 217 | CastleList, CsListTab | onCreate, withContext, attachBaseContext, onDestroy, onResume, getExistingPack, if, getExistingCastle, for, if … (+2) |
| `app/src/main/java/com/mandarin/bcu/CheckUpdateScreen.kt` | `com.mandarin.bcu` | 813 | CheckUpdateScreen, AssetDownloaderConnector, ServiceBroadCastReceiver | onCreate, withContext, if, onSingleClick, if, if, if, startActivity, for, if … (+38) |
| `app/src/main/java/com/mandarin/bcu/ConfigScreen.kt` | `com.mandarin.bcu` | 1064 | ConfigScreen | onCreate, if, onSingleClick, onItemSelected, onNothingSelected, onItemSelected, onNothingSelected, onSingleClick, onProgressChanged, onStartTrackingTouch … (+30) |
| `app/src/main/java/com/mandarin/bcu/DataResetManager.kt` | `com.mandarin.bcu` | 261 | DataResetManager | onCreate, if, onSingleClick, onSingleClick, for, onSingleClick, onSingleClick, if, handleOnBackPressed, attachBaseContext … (+2) |
| `app/src/main/java/com/mandarin/bcu/EffectList.kt` | `com.mandarin.bcu` | 169 | EffectList, EffListTab | onCreate, withContext, TabLayoutMediator, onSingleClick, attachBaseContext, onDestroy, onResume, getItemCount, createFragment, when |
| `app/src/main/java/com/mandarin/bcu/EnemyInfo.kt` | `com.mandarin.bcu` | 245 | EnemyInfo | onCreate, if, if, withContext, onSingleClick, EnemyRecycle, if, finish, handleOnBackPressed, finish … (+3) |
| `app/src/main/java/com/mandarin/bcu/EnemyList.kt` | `com.mandarin.bcu` | 309 | EnemyList, Mode, EnemyListTab | onCreate, if, if, withContext, if, beforeTextChanged, onTextChanged, afterTextChanged, onSingleClick, onSingleClick … (+10) |
| `app/src/main/java/com/mandarin/bcu/EnemySearchFilter.kt` | `com.mandarin.bcu` | 380 | EnemySearchFilter | onCreate, if, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, checker, handleOnBackPressed … (+12) |
| `app/src/main/java/com/mandarin/bcu/ErrorScreen.kt` | `com.mandarin.bcu` | 154 | ErrorScreen | onCreate, if, onSingleClick, onSingleClick, handleOnBackPressed, attachBaseContext, onDestroy, onResume |
| `app/src/main/java/com/mandarin/bcu/FileViewer.kt` | `com.mandarin.bcu` | 154 | FileViewer | onCreate, if, if, loadText, while, onResume, onDestroy, attachBaseContext |
| `app/src/main/java/com/mandarin/bcu/ImageViewer.kt` | `com.mandarin.bcu` | 1495 | ImageViewer, ViewerType, ScaleListener, GifRecorder | onCreate, if, withContext, finish, while, getColorData, getColorData, getColorData, getColorData, while … (+62) |
| `app/src/main/java/com/mandarin/bcu/LineUpScreen.kt` | `com.mandarin.bcu` | 1053 | LineUpScreen, LUTab | onCreate, if, withContext, when, if, onItemSelected, onNothingSelected, onItemSelected, if, onNothingSelected … (+29) |
| `app/src/main/java/com/mandarin/bcu/MainActivity.kt` | `com.mandarin.bcu` | 539 | MainActivity | onCreate, if, if, if, if, if, for, if, onSingleClick, if … (+12) |
| `app/src/main/java/com/mandarin/bcu/MapList.kt` | `com.mandarin.bcu` | 528 | MapList | getView, getDropDownView, onNothingSelected, onItemSelected, for, onCreate, if, withContext, getView, getDropDownView … (+12) |
| `app/src/main/java/com/mandarin/bcu/MedalList.kt` | `com.mandarin.bcu` | 251 | MedalList | onCreate, if, withContext, if, attachBaseContext, onDestroy, onResume, number, when, getMedalWithOrder … (+1) |
| `app/src/main/java/com/mandarin/bcu/MusicList.kt` | `com.mandarin.bcu` | 301 | MusicList, MusicListTab | onCreate, if, withContext, while, if, attachBaseContext, onDestroy, onResume, existingPackNumber, for … (+4) |
| `app/src/main/java/com/mandarin/bcu/MusicPlayer.kt` | `com.mandarin.bcu` | 799 | MusicPlayer, MusicReceiver | reset, onCreate, if, if, withContext, while, if, if, onProgressChanged, onStartTrackingTouch … (+29) |
| `app/src/main/java/com/mandarin/bcu/PackConflictDetail.kt` | `com.mandarin.bcu` | 669 | PackConflictDetail | onCreate, if, if, if, getView, getDropDownView, isEnabled, isValid, when, onNothingSelected … (+32) |
| `app/src/main/java/com/mandarin/bcu/PackConflictSolve.kt` | `com.mandarin.bcu` | 198 | PackConflictSolve | onResult, onCreate, if, onSingleClick, handleOnBackPressed, attachBaseContext, onDestroy, dataChanged, if, onResume |
| `app/src/main/java/com/mandarin/bcu/PackManagement.kt` | `com.mandarin.bcu` | 519 | PackManagement | onCreate, if, withContext, onSingleClick, withContext, handleOnBackPressed, onResume, onDestroy, attachBaseContext, showWritingDialog … (+9) |
| `app/src/main/java/com/mandarin/bcu/SearchFilter.kt` | `com.mandarin.bcu` | 433 | SearchFilter | onCreate, if, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, getResizeDraw, checker, handleOnBackPressed … (+13) |
| `app/src/main/java/com/mandarin/bcu/StageInfo.kt` | `com.mandarin.bcu` | 256 | StageInfo | onCreate, if, onSingleClick, if, withContext, onSingleClick, if, if, if, handleOnBackPressed … (+6) |
| `app/src/main/java/com/mandarin/bcu/StageList.kt` | `com.mandarin.bcu` | 218 | StageList | onCreate, if, if, withContext, onSingleClick, handleOnBackPressed, attachBaseContext, onDestroy, onResume |
| `app/src/main/java/com/mandarin/bcu/StageSearchFilter.kt` | `com.mandarin.bcu` | 571 | StageSearchFilter | if, onCreate, if, for, if, onSingleClick, if, for, onNothingSelected, onItemSelected … (+26) |
| `app/src/main/java/com/mandarin/bcu/StatSearchFilter.kt` | `com.mandarin.bcu` | 677 | StatSearchFilter | onCreate, if, if, onSingleClick, getView, getDropDownView, isEnabled, onNothingSelected, onItemSelected, while … (+33) |
| `app/src/main/java/com/mandarin/bcu/UnitInfo.kt` | `com.mandarin.bcu` | 510 | UnitInfo, TableTab, ExplanationTab | onCreate, if, withContext, getString, if, if, if, finish, onSingleClick, handleOnBackPressed … (+24) |
| `app/src/main/java/main/MainBCU.java` | `main` | 46 | MainBCU | getTime, SimpleDateFormat, CheckMem, validate |
| `app/src/main/java/main/Opts.java` | `main` | 178 | Opts | animErr, backupErr, conf, warning, conf, warning, dloadErr, ioErr, loadErr, PackConflict … (+20) |
| `app/src/release/java/com/mandarin/bcu/androidutil/supports/LeakCanaryManager.kt` | `com.mandarin.bcu.androidutil.supports` | 12 | LeakCanaryManager | initCanary |
| `app/src/test/java/com/mandarin/bcu/ExampleUnitTest.java` | `com.mandarin.bcu` | 17 | ExampleUnitTest | machine, addition_isCorrect |

# Appendix D — Asset pack top counts

| Pack | Files |
|---|---:|
| `000001` | 4,087 |
| `000004` | 2,961 |
| `000005` | 2,691 |
| `000007` | 2,552 |
| `000002` | 2,431 |
| `000006` | 2,391 |
| `000008` | 2,305 |
| `000003` | 1,832 |
| `100503` | 1,656 |
| `100800` | 1,640 |
| `000009` | 1,437 |
| `110704` | 829 |
| `100900` | 673 |
| `140300` | 643 |
| `000010` | 626 |
| `130400` | 523 |
| `100200` | 521 |
| `100000` | 510 |
| `110200` | 495 |
| `100400` | 435 |
| `110500` | 423 |
| `140400` | 410 |
| `110000` | 403 |
| `110900` | 402 |
| `110100` | 392 |
| `130700` | 391 |
| `120700` | 390 |
| `091000` | 385 |
| `140700` | 382 |
| `101000` | 380 |
| `120200` | 380 |
| `110300` | 379 |
| `150300` | 375 |
| `150103` | 367 |
| `150000` | 364 |
| `110700` | 359 |
| `120100` | 354 |
| `130300` | 354 |
| `100600` | 353 |
| `140000` | 351 |

# Appendix E — Historical reconciliation

- `rhgrive2_game_lightweight_analysis_report_2026-05-19.txt` は当時のprototype patch/軽量化監査として有用だが、現行 `Rainforest-2/rhg` はその後boot group再編、loader完了、orphan削除、UI/PWA/custom stage追加、status更新が進んでいる。
- 古いレポートの「未実装」「候補」「重複」は、現行HEADのimport list、current status、checkで再確認するまで現状欠陥として扱わない。
- ただし、wrapper chain破壊、debug object allocation、projectile責務重複、visual acceptance不足という構造的教訓は現在も有効。

# Appendix F — 用語集

| Term | Meaning |
|---|---|
| **BCU** | Battle Cats Ultimate。ファンメイドのBattle Cats emulator/editor群。 |
| **semantic ZIP** | actor/stage/effect等を意味単位でまとめたrhgの正規runtime bundle。 |
| **holder** | ある値/能力/状態を実際に保存するデータfield/source。 |
| **owner** | 状態遷移や副作用を最終的に管理するclass/module。 |
| **proc** | 確率・時間・倍率などを持つ特殊効果dataと発動。 |
| **ability** | bit flagまたはsemantic ability。procと重なるが同一ではない。 |
| **trait** | 赤/浮/黒/メタル/天使/alien/zombie/demon/relic/white等の対象属性。 |
| **TBA** | 攻撃待機。BCU内部変換と表示frameに注意。 |
| **longPre** | 連続攻撃の最後の発生時刻。 |
| **LD** | 遠方範囲。感知位置から別のshort/long区間を攻撃。 |
| **Omni** | 全方位。後方を含むrangeを持てる。 |
| **KB** | knockback。HP boundaryまたはproc/interruptで発生。 |
| **HB** | hitback境界。maxHP/KB数由来のHP threshold。 |
| **capture** | 攻撃発生時点でhit対象を固定する処理。 |
| **excuse/process** | 捕捉したattackをentityへ適用する処理。 |
| **container** | 波動/烈波/爆波など複数frameに跨るdamage runtime。 |
| **effect** | 描画animation。logic containerと別lifetime。 |
| **code-complete-candidate** | source owner、runtime wiring、deterministic checkが揃う候補。visual完了を意味しない。 |
| **human-visual-review-needed** | logicはあるがbrowser見た目が未受け入れ。 |
| **negative-evidence** | BCUソース上、そのowner/holderが存在しないことを根拠に追加しない判断。 |

---

**End of core reference.**