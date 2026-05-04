# BCU unit stat flow と現在コードでの対応

## A. BCUでの味方ユニットstats読み取り経路
- **Unit.java**
  - `./org/unit/NNN/unitNNN.csv` を読む。
  - 各formのCSV行を `Form` に渡す。
- **Form.java**
  - CSV行から `DataUnit` を作る。
  - `DataUnit` は `MaskUnit` として戦闘側へ渡る。
- **DataUnit.java**
  - unit CSV専用indexでstatsを読む。
  - enemy CSVとはindexが異なる。

## B. BCU unit CSVの主要index
- hp = ints[0]
- knockbacks/hb = ints[1]
- speed = ints[2]
- atk0 = ints[3]
- tba = ints[4]
- range = ints[5]
- price = ints[6]
- respawn = ints[7] * 2
- width = ints[9]
- isrange = ints[12] === 1
- pre = ints[13]
- front = ints[14]
- back = ints[15]
- lds0 = ints[44]
- ldr0 = ints[45]
- atk1 = ints[59]
- atk2 = ints[60]
- pre1 = ints[61]
- pre2 = ints[62]
- abi0 = ints[63]
- abi1 = ints[64]
- abi2 = ints[65]
- hit1/hit2個別LD override = `99 + (i - 1) * 3`

## C. BCU内での使われ方
- **ELineUp**
  - priceは `MaskUnit.getPrice()` 由来。
  - cooldownは `MaskUnit.getRespawn()` 由来。
  - stage limit / combo / orb で補正される。
- **EUnit**
  - `MaskUnit` を受け取り、level / talent / PCoin / treasure / combo補正つきで戦闘entity化。
  - front/back から spawnLayer/currentLayer を決定。
  - speedは updateMove で使用。
  - damage/defense/proc は攻撃・被弾処理で使用。
- **AtkModelEntity / AttackSimple**
  - attack range / width / LD / omni / isRange から攻撃box・対象捕捉を作る。

## D. 現在のワンコ大戦争での対応（重要）
- BCU unit stats は現在、主に `BATTLE_CONFIG.rosters.catEnemy` の `statsType:'unit'` で使用。
- BCU enemy stats は現在、主に `BATTLE_CONFIG.rosters.dogPlayer` の `statsType:'enemy'` で使用。
- これは「ゲーム内side」と「BCU asset分類」が反転しているため。
- `dog-player` はプレイヤー側だが BCU enemy assets を使う。
- `cat-enemy` は敵側だが BCU unit assets を使う。

## E. 現在コードでのstats使用箇所
- **BattleStatsLoader**
  - unit/enemy CSVを読み、`normalizeUnitStats` / `normalizeEnemyStats` でstats化。
- **BattleActorFactory.preloadTemplate**
  - `unitDef.statsType` で `loadUnitStats` / `loadEnemyStats` を切り替え。
- **BattleActorFactory.createActor**
  - `stats.speed -> actor.moveSpeed`
  - `stats.detectionRange -> actor.detectionRangePx`
  - `refreshAttackProfile()` を呼ぶ。
- **BattleActor constructor**
  - `stats.hp -> maxHp/hp`
  - `stats.damage -> damage`
  - `stats.attackWaitFrames -> attackWaitMs`
  - `stats.attackStartupFrames -> attackStartupMs`
  - `stats.attackType -> attackType`
  - `stats.attackHits` は `rawStats` として `BattleAttackProfile` に渡る。
- **BattleAttackProfile**
  - `stats.attackHits / stats.isRange / stats.width / LD/omni` からevents生成。
- **BattleAttackResolver**
  - `event.targetMode / attackKind / interval` でcapture。
- **BattleScene**
  - `moveSpeed / detectionRangePx / attackProfile / damage / HP` を戦闘進行で使用。

## F. 今後の注意
- BCU unit stats を dog-player へ直接使うとは限らない。
- 現在は **dog-player = BCU enemy**, **cat-enemy = BCU unit**。
- side名だけで `loadUnitStats/loadEnemyStats` を決めない。
- 必ず `roster.statsType` を source of truth にする。
- unit/enemy CSVのindexを共通化しない。
- BCU unitのprice/respawnは将来production system連携候補だが、今回は未接続。
