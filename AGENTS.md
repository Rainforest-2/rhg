# AGENTS.md — BCU asset / name database 実装指示書 for `rhgrive2/game`

このリポジトリで作業するエージェントは、BCU 由来のキャラ・敵・ステージ・背景・城・言語名を、起動時に一つのゲーム用 asset database として構築すること。以後、戦闘・UI・プレビュー・デバッグ表示は、個別 loader がその場で CSV / lang / asset path を fetch して推測するのではなく、この database を唯一の参照元として使う。

この文書は実装仕様であり、方針メモではない。ここに書かれた構造・命名・検証条件を満たすまで完了扱いにしない。

---

## 0. 最終ゴール

ゲーム起動時に、`public/assets` 以下の BCU 資産から次を一括で索引化する。

- 味方ユニット
- 敵
- ステージ
- 背景
- 敵城画像
- 味方城 / にゃんこ城パーツ
- エフェクト
- アニメーション構成
- ステータス CSV
- `assets/lang/<locale>/` 配下の名前・説明・表示名

そのうえで、すべての表示名は次のように解決できなければならない。

```js
const db = getBcuAssetDatabase();

db.names.unitForm(0, 0, 'jp');       // ネコなど
db.names.enemy(0, 'jp');             // ワンコなど
db.names.stage('0-0-0', 'jp');       // ステージ名
db.names.background(bgId, 'jp');     // 背景名。lang にあれば表示、なければ安全 fallback
db.names.enemyCastle(castleId, 'jp'); // 城名。lang にあれば表示、なければ安全 fallback
```

**重要:** `PlayableCharacterRegistry.js` のような固定 `label: 'ネコ'` / `label: 'ワンコ'` は最終状態では禁止。固定値は migration 中の fallback としてのみ許可し、source に `fallback-hardcoded-label` を明示する。

---

## 1. BCU で参考にするロジック

BCU Java 側の考え方を JS に移植する。完全な Java 移植ではなく、構造と責務分離を合わせる。

### 1.1 `PackData.DefPack.load()` 相当

BCU common は pack load 時に、おおむね次の順でデータを読む。

```text
Res.readData()
Trait.read()
loadEnemies()
loadUnits()
EffAnim.read()
Background.read()
BackgroundEffect.read()
NyCastle.read()
loadSoul()
DefMapColc.read()
RandStage.read()
loadCharaGroup()
loadLimit()
CastleImg.loadBossSpawns()
Combo.readFile()
PCoin.read()
```

JS 側でも、単発 loader の集合ではなく、起動時に `BcuBootLoader` が順序を制御する。

最低限の順序は次にする。

```text
1. manifest 読み込み
2. pack 一覧確定
3. lang root 探索
4. raw text CSV 読み込み
5. 敵 repository 構築
6. ユニット repository 構築
7. 背景 repository 構築
8. 城 repository 構築
9. ステージ repository 構築
10. 名前 repository 構築
11. asset path / animation catalog 構築
12. diagnostics 確定
13. PreviewApp / BattleScene 起動
```

### 1.2 `BCUReader.readLang()` 相当

BCU PC は `<BCUFolder>/assets/lang/<locale>/` を読み、少なくとも次のファイルを処理する。

```text
StageName.txt
UnitName.txt
UnitExplanation.txt
EnemyName.txt
EnemyExplanation.txt
ComboName.txt
RewardName.txt
proc.json
animation_type.json
CatFruitExplanation.txt
```

JS 側はこの固定リストだけに依存しない。`lang` フォルダに背景名・城名など追加ファイルが存在する可能性を前提に、次を必ず実装する。

1. BCU 標準ファイル名を優先処理する。
2. 未知の `*Name.txt` も読み、known parser に渡せるものは処理する。
3. `BackgroundName.txt`, `BGName.txt`, `CastleName.txt`, `CastleImgName.txt`, `EnemyCastleName.txt`, `NyCastleName.txt` を公式に対応 parser として用意する。
4. 未知ファイルを黙って捨てない。`db.diagnostics.lang.unknownFiles` に残す。
5. 名前が無い場合だけ、ID 由来 fallback を使う。

### 1.3 `MultiLangCont` 相当

BCU は `MultiLangCont` に object key で名前を入れる。

JS では object reference key だけにすると再構築時に壊れやすいので、**canonical key** を使う。

```text
unitForm:      unit:<unitId>:form:<formIndex>
enemy:         enemy:<enemyId>
stage:         stage:<mapColcId>-<mapId>-<stageId>
stageMap:      stageMap:<mapColcId>-<mapId>
mapColc:       mapColc:<mapColcId>
background:    background:<bgId>
enemyCastle:   enemyCastle:<castleNumericId>
nyCastle:      nyCastle:<partId or compositeId>
combo:         combo:<comboId or comboName>
reward:        reward:<rewardId>
```

`names.resolve(kind, key, locale)` は常に次の情報を返す。

```ts
type LocalizedNameResult = {
  value: string;
  locale: string;
  requestedLocale: string;
  source: 'lang' | 'fallback-id' | 'fallback-hardcoded-label' | 'missing';
  file?: string;
  key: string;
  warnings: string[];
};
```

---

## 2. 現コードの問題点と修正対象

### 2.1 起動経路

現状の `js/main.js` は `BattleSceneStageRuntimeWiring.js` を import してから `PreviewApp` を開始している。

実装後は、`PreviewApp` より前に BCU database を構築する。

```js
async function boot() {
  try {
    await import('./battle/BattleSceneStageRuntimeWiring.js');
    const { BcuBootLoader, setBcuAssetDatabase } = await import('./bcu/BcuBootLoader.js');
    const db = await BcuBootLoader.loadGame({
      assetRoot: './public/assets',
      bcuRoot: './public/assets/bcu',
      locale: 'jp',
      preloadMode: 'metadata-and-current-battle'
    });
    setBcuAssetDatabase(db);

    const { PreviewApp } = await import('./preview/PreviewApp.js');
    await new PreviewApp({ bcuDb: db }).start();
  } catch (error) {
    console.error('[main] boot failed', error);
    globalThis.__WAN_BOOT_ERROR__?.(error);
    throw error;
  }
}
```

### 2.2 `BattleStatsLoader.js`

現状は `loadUnitStats()` が `./public/assets/bcu/000004/org/unit/...` を直接 fetch し、`loadEnemyStats()` が `./public/assets/bcu/000001/org/data/t_unit.csv` を直接 fetch している。

修正後は、`BattleStatsLoader` は fetch しない。

```js
class BattleStatsLoader {
  constructor({ bcuDb }) {
    this.db = bcuDb;
  }

  loadUnitStats(unitId, form = 'f', formRow = 0) {
    return this.db.units.getFormStats(unitId, form, formRow);
  }

  loadEnemyStats(enemyId) {
    return this.db.enemies.getStats(enemyId);
  }
}
```

既存の `normalizeUnitStats()` / `normalizeEnemyStats()` は使ってよい。ただし raw CSV fetch と path 決定は `BcuAssetDatabase` 側へ移す。

### 2.3 `BcuAssetLoader.js`

現状は asset set 単位の lazy cache で、画像 / imgcut / model / animation を必要時に個別 load する。

修正後は次を分ける。

- `BcuAssetDatabase`: どの asset が存在するか、どの ID に対応するか、名前は何かを知っている。
- `BcuAssetLoader`: database が渡した asset descriptor を実際に画像 / animation として decode する。

`BcuAssetLoader` は path 推測をしない。必ず `db.assets.resolveAssetSet(...)` から得た descriptor を読む。

### 2.4 `PlayableCharacterRegistry.js`

現状は `DOG_PLAYABLE_SPECS` / `CAT_PLAYABLE_SPECS` に ID と日本語 label が固定されている。

修正後は、registry は ID と gameplay slot だけを持ち、名前は DB から取る。

禁止例:

```js
{ unitId: 0, characterId: 'cat-basic', label: 'ネコ' }
```

許可例:

```js
{ unitId: 0, characterId: 'cat-basic', nameKey: 'unit:0:form:0' }
```

roster build 時:

```js
const name = db.names.unitForm(spec.unitId, formIndex, locale);
return {
  ...,
  label: name.value,
  labelSource: name.source,
  labelWarnings: name.warnings
};
```

### 2.5 `StageDefinitionLoader.js`

現状でも stage CSV から `castleId`, `bgId`, `stageLen`, `enemyBaseHp`, `enemyRows` を読んでいる。

修正後は、stage CSV parser は stage の raw model を作るだけにする。

禁止:

- stage loader 内で background path を決める。
- stage loader 内で castle path を決める。
- stage loader 内で日本語名を決める。

許可:

- BCU の `SCDef.Line` 相当の enemy row model を作る。
- `bgId` / `castleId` / `mapId` / `stageId` を canonical identifier として持つ。
- `db.stages.hydrateStageDefinition(parsed)` で背景・城・名前・敵情報を後付けする。

### 2.6 `StageBackgroundLoader.js` / `StageBackgroundResolver.js`

現状は stage load 時に `bg.csv` を読んで、`bgId` から画像 candidate と imgcut candidate を作っている。

修正後は `bg.csv` は boot 時に一度だけ読む。

```js
const bg = db.backgrounds.get(bgId);
```

`bg` は次を持つ。

```ts
type BcuBackground = {
  id: number;
  key: `background:${number}`;
  name: LocalizedNameResult;
  csv: {
    skyTop: RGB;
    skyBottom: RGB;
    groundTop: RGB;
    groundBottom: RGB;
    imgcutId: number;
    showUpper: boolean;
    imageReferenceId: number | null;
    raw: string[];
    sourceFile: string;
  };
  assets: {
    imagePath: string;
    imgcutPath: string;
    imageCandidates: string[];
    imgcutCandidates: string[];
  };
};
```

`StageBackgroundLoader` は `bg.assets` を読むだけにする。

### 2.7 `CastleAssetResolver.js` / `BcuCastleAssetLoader.js`

現状の敵城 ID 解決は `['rc', 'ec', 'wc', 'sc']` と `castleId / 1000` で group を決めている。

このルールは維持する。ただし database に寄せる。

```ts
type BcuEnemyCastle = {
  numericId: number;
  key: `enemyCastle:${number}`;
  groupIndex: number;
  groupName: 'rc' | 'ec' | 'wc' | 'sc';
  localCastleId: number;
  name: LocalizedNameResult;
  assets: {
    imagePath: string;
    imageCandidates: string[];
    usesImgcut: false;
  };
};
```

`BcuCastleAssetLoader.load(castleId)` は内部で `resolveEnemyCastleAssetCandidates()` を呼ばず、次にする。

```js
const castle = db.castles.enemy.get(castleId);
```

fallback した場合は `castle.name.source` と `castle.diagnostics` に残す。

---

## 3. 新規追加するファイル

最低限、次のファイルを追加する。

```text
js/bcu/BcuBootLoader.js
js/bcu/BcuAssetDatabase.js
js/bcu/BcuManifestLoader.js
js/bcu/BcuIdentifier.js
js/bcu/BcuPathResolver.js
js/bcu/BcuLangStore.js
js/bcu/BcuUnitRepository.js
js/bcu/BcuEnemyRepository.js
js/bcu/BcuStageRepository.js
js/bcu/BcuBackgroundRepository.js
js/bcu/BcuCastleRepository.js
js/bcu/BcuDiagnostics.js
scripts/build-bcu-manifest.mjs
scripts/check-bcu-database.mjs
```

TypeScript 化していない現状に合わせて `.js` / `.mjs` でよい。JSDoc typedef は必ず書く。

---

## 4. Manifest 仕様

ブラウザでは directory listing ができないため、起動時に assets を「完全に」把握するには manifest が必要。

### 4.1 生成スクリプト

`scripts/build-bcu-manifest.mjs` を作る。

入力:

```text
public/assets/
```

出力:

```text
public/assets/bcu-manifest.json
```

生成内容:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-05-10T00:00:00.000Z",
  "assetRoot": "public/assets",
  "bcuRoot": "public/assets/bcu",
  "files": ["public/assets/bcu/000001/org/data/t_unit.csv"],
  "packs": {
    "000001": {
      "root": "public/assets/bcu/000001",
      "info": "public/assets/bcu/000001/info.json",
      "files": [],
      "org": {
        "data": [],
        "enemy": [],
        "unit": [],
        "battle": [],
        "img": []
      }
    }
  },
  "langRoots": [
    "public/assets/lang/jp",
    "public/assets/bcu/assets/lang/jp",
    "public/assets/bcu/000001/assets/lang/jp"
  ],
  "langFiles": {
    "jp": [
      "public/assets/lang/jp/UnitName.txt",
      "public/assets/lang/jp/EnemyName.txt"
    ]
  },
  "indexes": {
    "unitIds": [0, 1, 2],
    "enemyIds": [0, 1, 2],
    "backgroundIds": [0, 1, 2],
    "enemyCastleIds": [0, 1, 1000, 1001]
  }
}
```

### 4.2 manifest に含めるべき index

必須:

- `files`: 全ファイル path
- `packs`: pack ID ごとのファイル一覧
- `langFiles`: locale ごとの lang file path
- `unitIds`: `org/unit/<000>/` から抽出
- `enemyIds`: `org/enemy/<000>/` から抽出
- `backgroundIds`: `org/battle/bg/bg.csv` と `org/img/bg/bgXXX.png` から抽出
- `enemyCastleIds`: `org/img/rc/rcXXX.png`, `ec/ecXXX.png`, `wc/wcXXX.png`, `sc/scXXX.png` から抽出
- `stageCsvFiles`: stage CSV 候補
- `animations`: png/imgcut/mamodel/maanim の対応候補

任意だが推奨:

- `missingPairs`: png はあるが imgcut がない、model はあるが anim がない等
- `duplicateIds`: 複数 pack で同じ ID がある場合
- `caseConflicts`: 大文字小文字違い

---

## 5. `BcuAssetDatabase` の公開 API

### 5.1 singleton

```js
let activeBcuAssetDatabase = null;

export function setBcuAssetDatabase(db) {
  activeBcuAssetDatabase = db;
}

export function getBcuAssetDatabase() {
  if (!activeBcuAssetDatabase) {
    throw new Error('BCU asset database is not loaded. Call BcuBootLoader.loadGame() before accessing assets.');
  }
  return activeBcuAssetDatabase;
}
```

### 5.2 root object

```ts
type BcuAssetDatabase = {
  ready: true;
  locale: string;
  manifest: BcuManifest;
  packs: BcuPackRepository;
  names: BcuLangStore;
  units: BcuUnitRepository;
  enemies: BcuEnemyRepository;
  stages: BcuStageRepository;
  backgrounds: BcuBackgroundRepository;
  castles: BcuCastleRepository;
  assets: BcuAssetSetRepository;
  diagnostics: BcuDiagnostics;
};
```

### 5.3 repository API

```js
db.units.get(unitId)
db.units.getForm(unitId, formIndexOrCode)
db.units.getFormStats(unitId, formIndexOrCode)
db.units.list()

db.enemies.get(enemyId)
db.enemies.getStats(enemyId)
db.enemies.fromStageRawId(rawEnemyId) // BCU stage CSV の敵 ID 補正をここに集約

db.backgrounds.get(bgId)
db.backgrounds.list()

db.castles.enemy.get(castleId)
db.castles.enemy.list()
db.castles.nyanko.get(partId)

db.stages.get(stageKey)
db.stages.hydrateStageDefinition(stageDefinition)

db.assets.resolveUnitAsset(unitId, form)
db.assets.resolveEnemyAsset(enemyId)
db.assets.resolveBackgroundAsset(bgId)
db.assets.resolveEnemyCastleAsset(castleId)
```

---

## 6. ID 正規化ルール

### 6.1 基本

```js
pad3(0) === '000'
pad2(0) === '00'
```

数値 ID と表示 key を混ぜない。

```ts
type BcuNumericId = number;
type BcuId3 = string; // '000'
type CanonicalKey = string;
```

### 6.2 Unit

- folder: `org/unit/<unitId3>/`
- stats: `org/unit/<unitId3>/unit<unitId3>.csv`
- form code: `f`, `c`, `s`, `u` など。現コードは主に `f`。
- form row: CSV row index。通常 `0` が第1形態。
- name key: `unit:<unitId>:form:<formIndex>`

UnitName parser:

```text
<unitId>\t<form0Name>\t<form1Name>\t<form2Name>...
```

### 6.3 Enemy

- folder: `org/enemy/<enemyId3>/`
- stats: `org/data/t_unit.csv`
- BCU stage CSV の raw enemy ID は現コードで `rawEnemyId - 2` されている。これは `db.enemies.fromStageRawId(rawEnemyId)` に集約する。
- name key: `enemy:<enemyId>`

EnemyName parser:

```text
<enemyId>\t<enemyName>
```

### 6.4 Stage

StageName parser:

```text
<mapColcId>\t<map collection name>
<mapColcId>-<mapId>\t<stage map name>
<mapColcId>-<mapId>-<stageId>\t<stage name>
```

保存 key:

```text
mapColc:<mapColcId>
stageMap:<mapColcId>-<mapId>
stage:<mapColcId>-<mapId>-<stageId>
```

### 6.5 Background

BCU common の `Background.read()` 相当では `org/battle/bg/bg.csv` を読む。現コードの parser では次を使っている。

- `cols[0]`: bg ID
- `cols[1..3]`: sky top RGB
- `cols[4..6]`: sky bottom RGB
- `cols[7..9]`: ground top RGB
- `cols[10..12]`: ground bottom RGB
- `cols[13]`: imgcut ID
- `cols[14]`: upper 表示 flag
- `cols[15]`: image reference ID

これを repository に保存する。

Background name parser は次を許可する。

```text
<bgId>\t<name>
background:<bgId>\t<name>
bg:<bgId>\t<name>
<packId>/<bgId>\t<name>
```

対象ファイル名:

```text
BackgroundName.txt
BGName.txt
BgName.txt
```

### 6.6 Enemy Castle

現コードの敵城 group は維持する。

```js
['rc', 'ec', 'wc', 'sc']
```

numeric ID:

```text
castleNumericId = groupIndex * 1000 + localCastleId
```

path:

```text
org/img/<groupName>/<groupName><localCastleId3>.png
```

Castle name parser は次を許可する。

```text
<castleNumericId>\t<name>
enemyCastle:<castleNumericId>\t<name>
castle:<castleNumericId>\t<name>
<groupName>/<localCastleId>\t<name>
<groupName><localCastleId3>\t<name>
```

対象ファイル名:

```text
CastleName.txt
CastleImgName.txt
EnemyCastleName.txt
```

### 6.7 Nyanko Castle

味方城 / にゃんこ城パーツは敵城とは分ける。

現コードの `previewAssets.js` には `org/castle/000`, `002`, `003` の合成城と `001` の砲エフェクトがある。これは敵城ではない。

名前 key:

```text
nyCastle:<partId>
nyCastleComposite:<compositeId>
```

対象ファイル名:

```text
NyCastleName.txt
CatCastleName.txt
CastlePartName.txt
```

---

## 7. Lang parser の実装詳細

### 7.1 delimiter

BCU lang は TSV が基本。JS parser は次の順で解釈する。

1. `\t` が含まれていれば TSV。
2. `\t` が無く、`,` が含まれていれば CSV-like として読む。
3. どちらも無ければ invalid line として diagnostics に入れる。

コメント処理:

```js
line.replace(/^\uFEFF/, '').split('//')[0].trim()
```

空行は無視。

### 7.2 locale fallback

名前解決の優先順位:

```text
1. requested locale
2. jp
3. en
4. first available locale
5. generated ID fallback
```

ただし、fallback したことを必ず `source` と `warnings` に残す。

### 7.3 unknown `*Name.txt`

未知の `*Name.txt` は捨てない。

```js
diagnostics.lang.unknownNameFiles.push({ locale, file, lineCount });
```

さらに、1列目 key prefix から推定できる場合は generic table に保持する。

```js
db.names.generic.set(`${file}:${key}`, value)
```

---

## 8. Boot loader の preload 方針

ユーザー要求は「ゲーム読み込み時に assets をまとめて読み込み」。ただし PNG / maanim まで全 decode すると、初回起動とメモリが重くなる可能性がある。

したがって実装は 3 段階の mode を持つ。

```ts
type BcuPreloadMode =
  | 'metadata-only'
  | 'metadata-and-current-battle'
  | 'all-decodable-assets';
```

デフォルトは `metadata-and-current-battle`。

必ず起動時に読むもの:

- manifest
- all lang text
- unit stats CSV
- enemy stats CSV
- bg.csv
- stage metadata CSV / current stage CSV
- asset path index

必要に応じて読むもの:

- current roster の unit/enemy png/imgcut/model/anim
- current stage の background image/imgcut
- current stage の enemy castle image
- battle common effects

`all-decodable-assets` は debug / verification 専用。通常起動で強制しない。

---

## 9. Diagnostics は必須

fallback を隠さない。これが最重要。

`db.diagnostics` に最低限これを持たせる。

```ts
type BcuDiagnostics = {
  manifest: {
    missingFiles: string[];
    duplicateFiles: string[];
    caseConflicts: string[];
  };
  lang: {
    loadedLocales: string[];
    loadedFiles: string[];
    unknownFiles: object[];
    invalidLines: object[];
    missingNames: object[];
  };
  units: {
    missingStats: object[];
    missingAssets: object[];
    missingNames: object[];
  };
  enemies: {
    missingStats: object[];
    missingAssets: object[];
    missingNames: object[];
  };
  backgrounds: {
    missingRows: object[];
    missingAssets: object[];
    missingNames: object[];
  };
  castles: {
    missingAssets: object[];
    missingNames: object[];
    fallbackIds: object[];
  };
  stages: {
    missingNames: object[];
    unresolvedEnemies: object[];
    unresolvedBackgrounds: object[];
    unresolvedCastles: object[];
  };
};
```

UI debug panel には `db.getSummary()` を表示できるようにする。

```js
db.getSummary() // counts, locale, missing counts, fallback counts
```

---

## 10. Refactor 手順

### Phase 1: manifest 生成

1. `scripts/build-bcu-manifest.mjs` を追加。
2. `public/assets/bcu-manifest.json` を生成。
3. `scripts/check-bcu-database.mjs` を追加し、manifest の最低限検証を行う。

完了条件:

```bash
node scripts/build-bcu-manifest.mjs
node scripts/check-bcu-database.mjs
```

が成功する。

### Phase 2: language store

1. `BcuLangStore.js` を追加。
2. `UnitName.txt`, `EnemyName.txt`, `StageName.txt` parser を作る。
3. `BackgroundName.txt` / `BGName.txt` parser を作る。
4. `CastleName.txt` / `CastleImgName.txt` / `EnemyCastleName.txt` parser を作る。
5. `names.resolve()` を実装。

完了条件:

```js
db.names.unitForm(0, 0, 'jp').value
// 空でない。無ければ fallback-id だが diagnostics に出る。
```

### Phase 3: repositories

1. `BcuUnitRepository` で unit CSV を boot 時に読み normalize。
2. `BcuEnemyRepository` で `t_unit.csv` を boot 時に読み normalize。
3. `BcuBackgroundRepository` で `bg.csv` を boot 時に読み、名前と asset path を結合。
4. `BcuCastleRepository` で敵城 image path と名前を結合。
5. `BcuStageRepository` で stage definition と名前を結合。

### Phase 4: existing loader の DB 化

1. `BattleStatsLoader` から fetch を除去。
2. `StageBackgroundLoader` から bg.csv fetch と bg path 推測を除去。
3. `BcuCastleAssetLoader` から castle path 推測を除去。
4. `BcuAssetLoader` は descriptor decode 専用にする。
5. `PlayableCharacterRegistry` の日本語 label を除去。

### Phase 5: boot integration

1. `main.js` で `BcuBootLoader.loadGame()` を呼ぶ。
2. `PreviewApp` constructor に `bcuDb` を渡す。
3. `BattleScene` / `BattleActorFactory` / UI に DB を流す。
4. 既存 constructor が多すぎる場合は context object にまとめる。

```js
const appContext = {
  bcuDb,
  locale: bcuDb.locale,
  log
};
```

---

## 11. 実装時の禁止事項

- 新しい日本語名を JS に直書きしない。
- `fetch('./public/assets/...')` を各 loader に増やさない。
- `bgId` や `castleId` が不正なときに無言で `0` へ落とさない。
- `enemyId + 2` / `rawEnemyId - 2` のような補正を複数ファイルに散らさない。
- `000001`, `000002`, `000004`, `000010` など pack version を loader ごとに直書きしない。manifest / config に寄せる。
- 背景と敵城とにゃんこ城を同じ `castle` として扱わない。
- `lang` に存在するファイルを BCJSON の固定リスト外だからという理由で無視しない。
- fallback を成功扱いにしない。fallback は動作継続であって完全解決ではない。

---

## 12. 受け入れ条件

### 12.1 名前解決

- UnitName がある unit は UI に UnitName の値が出る。
- EnemyName がある enemy は UI に EnemyName の値が出る。
- StageName がある stage は UI に StageName の値が出る。
- BackgroundName / BGName がある場合は背景名が出る。
- CastleName / CastleImgName / EnemyCastleName がある場合は敵城名が出る。
- lang file が無い背景・城は `background:<id>` / `enemyCastle:<id>` のような明示 fallback になり、diagnostics に出る。

### 12.2 fetch 統制

- battle 中に stats CSV を fetch しない。
- stage background 切替時に bg.csv を再 fetch しない。
- castle 表示時に path 推測を毎回行わない。
- 同じ image / imgcut / mamodel / maanim の decode は cache hit する。

### 12.3 ID 解決

- stage CSV の `bgId` から `db.backgrounds.get(bgId)` が引ける。
- stage CSV の `castleId` から `db.castles.enemy.get(castleId)` が引ける。
- stage CSV の raw enemy ID から `db.enemies.fromStageRawId(rawEnemyId)` が引ける。
- 不正 ID は fallback しても diagnostics に残る。

### 12.4 画面表示

- 生産 UI のキャラ名が DB 由来になる。
- 敵 preview / spawn preview の敵名が DB 由来になる。
- stage 情報 panel に stage name / bg name / castle name が表示できる。
- debug panel に `nameSource` と `fallback` が表示できる。

---

## 13. テスト項目

### 13.1 Node script test

`scripts/check-bcu-database.mjs` で以下を検証する。

```js
assert(db.ready === true);
assert(db.names.loadedLocales.length > 0);
assert(db.units.list().length > 0);
assert(db.enemies.list().length > 0);
assert(db.backgrounds.list().length > 0);
assert(db.castles.enemy.list().length > 0);
```

名前検証:

```js
for (const unit of db.units.list()) {
  for (const form of unit.forms) {
    const n = db.names.unitForm(unit.id, form.index, 'jp');
    assert(n.value && typeof n.value === 'string');
  }
}

for (const enemy of db.enemies.list()) {
  const n = db.names.enemy(enemy.id, 'jp');
  assert(n.value && typeof n.value === 'string');
}
```

背景・城は lang が無い場合も許可。ただし source を見る。

```js
const bgName = db.names.background(bg.id, 'jp');
assert(bgName.source === 'lang' || bgName.source === 'fallback-id');

const castleName = db.names.enemyCastle(castle.numericId, 'jp');
assert(castleName.source === 'lang' || castleName.source === 'fallback-id');
```

### 13.2 Browser smoke test

dev console で次が通ること。

```js
const db = window.__BCU_DB__;
db.ready;
db.getSummary();
db.names.unitForm(0, 0, 'jp');
db.names.enemy(0, 'jp');
db.backgrounds.get(0);
db.castles.enemy.get(0);
```

### 13.3 Regression

- 既存の stage が起動する。
- 背景が表示される。
- 敵城が表示される。
- 味方 / 敵のステータスが以前と一致する。
- 攻撃・移動・KB の runtime が壊れない。

---

## 14. 推奨データ構造サンプル

### 14.1 Unit

```js
{
  id: 0,
  id3: '000',
  key: 'unit:0',
  sourcePack: '000004',
  folder: './public/assets/bcu/000004/org/unit/000/',
  forms: [
    {
      index: 0,
      code: 'f',
      key: 'unit:0:form:0',
      name: { value: 'ネコ', source: 'lang', locale: 'jp' },
      stats: {},
      asset: {
        image: './public/assets/bcu/000004/org/unit/000/f/000_f.png',
        imgcut: './public/assets/bcu/000004/org/unit/000/f/000_f.imgcut',
        model: './public/assets/bcu/000004/org/unit/000/f/000_f.mamodel',
        animations: []
      }
    }
  ]
}
```

### 14.2 Enemy

```js
{
  id: 0,
  id3: '000',
  key: 'enemy:0',
  sourcePack: '000001',
  name: { value: 'ワンコ', source: 'lang', locale: 'jp' },
  stats: {},
  asset: {
    image: './public/assets/bcu/000002/org/enemy/000/000_e.png',
    imgcut: './public/assets/bcu/000002/org/enemy/000/000_e.imgcut',
    model: './public/assets/bcu/000002/org/enemy/000/000_e.mamodel',
    animations: []
  }
}
```

### 14.3 Background

```js
{
  id: 0,
  key: 'background:0',
  name: { value: 'background:0', source: 'fallback-id', locale: 'jp' },
  csv: {
    imgcutId: 1,
    imageReferenceId: null,
    showUpper: true,
    sourceFile: './public/assets/bcu/000001/org/battle/bg/bg.csv'
  },
  assets: {
    imagePath: './public/assets/bcu/000001/org/img/bg/bg000.png',
    imgcutPath: './public/assets/bcu/000001/org/battle/bg/bg01.imgcut'
  }
}
```

### 14.4 Enemy Castle

```js
{
  numericId: 1002,
  key: 'enemyCastle:1002',
  groupIndex: 1,
  groupName: 'ec',
  localCastleId: 2,
  name: { value: 'enemyCastle:1002', source: 'fallback-id', locale: 'jp' },
  assets: {
    imagePath: './public/assets/bcu/000001/org/img/ec/ec002.png',
    usesImgcut: false
  }
}
```

---

## 15. UI 側の名前取得ルール

UI は object の `.label` を信用しない。必ず DB の name resolver を通す。

```js
function getDisplayName(entity, db, locale) {
  if (entity.kind === 'unit') return db.names.unitForm(entity.unitId, entity.formIndex ?? 0, locale).value;
  if (entity.kind === 'enemy') return db.names.enemy(entity.enemyId, locale).value;
  if (entity.kind === 'background') return db.names.background(entity.bgId, locale).value;
  if (entity.kind === 'enemyCastle') return db.names.enemyCastle(entity.castleId, locale).value;
  return entity.id ?? 'unknown';
}
```

`label` を保持する場合も、必ず次を一緒に持つ。

```js
{
  label,
  labelSource,
  labelLocale,
  labelKey
}
```

---

## 16. ログ文言

fallback は warning として出す。

```text
[BCU DB] missing UnitName locale=jp unit=000 form=0 fallback=unit:0:form:0
[BCU DB] missing BackgroundName locale=jp bg=12 fallback=background:12
[BCU DB] enemy castle id fallback requested=9999 resolved=0 reason=castle-group-out-of-range-fallback-rc
[BCU DB] unknown lang name file locale=jp file=SomeName.txt stored=generic
```

大量に出る場合は集約する。

```text
[BCU DB] missing names: unitForms=12 enemies=0 backgrounds=45 castles=8
```

---

## 17. 実装の優先順位

最初に完成させる順番:

1. manifest
2. lang store
3. enemy/unit stats DB
4. background/castle DB
5. existing loaders の DB 参照化
6. UI label の DB 参照化
7. diagnostics UI

戦闘挙動改善や proc 完全再現はこのタスクの主目的ではない。まず asset / name / ID 解決を完全にする。

---

## 18. 完了報告に必ず含めるもの

作業完了時は、次を報告する。

```text
- 追加したファイル
- 変更した既存ファイル
- DB に移した fetch / path resolver
- 対応した lang ファイル一覧
- Unit / Enemy / Stage / Background / Castle の name 解決結果サンプル
- diagnostics summary
- 実行したテストコマンド
- 未解決 fallback の件数
```

未解決 fallback が 0 でない場合、それは失敗ではない。ただし「なぜ fallback か」を diagnostics で説明できること。

---

## 19. 最重要ルール

**ID → asset path → object → localized name の結合は、必ず BCU database で一度だけ行う。**

battle runtime、preview UI、production UI、stage loader、background loader、castle loader が、それぞれ勝手に ID や名前を解決してはいけない。

BCU の `PackData` が asset model を作り、`BCUReader.readLang()` が `MultiLangCont` に名前を入れるのと同じ考え方で、`rhgrive2/game` では `BcuBootLoader` が `BcuAssetDatabase` を作り、全コードがそこを見る。
