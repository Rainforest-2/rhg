# BCU の未解決根拠・互換性ブロッカー

更新日: 2026-07-24

この文書は、**コード defect ではなく**、source/evidence/fixture/visual/互換性の不足だけを管理します。確認済みの実装バグは GitHub Issue と `../bcu-migration-status.md` で追跡し、ここへ重複記載しません。

## Active blockers

| 種別 | 領域 | 現在の境界 | 次の条件 |
|---|---|---|---|
| Browser boundary | streaming semantic asset | BCU は必要 asset がメモリ上にある前提だが、RHG は staged load を行う。長尾の読み込み遅延は spawn/attack/effect を遅延させ得る。 | 固定 fixture で実際の差分が観測された場合だけ、critical-path preload または explicit failure policy を変更する。 |
| Visual evidence | P_DELAY / burrow / spirit / SUMMON / death-surge | logic owner/check はあるが、timing/position/scale/layer/cleanup の固定 capture が不足する。 | BCU reference、RHG fixture、browser/device、scale、frame/result を ledger に記録する。 |
| Visual evidence | non-basic cannon / BASE_WALL | runtime と asset alias はあるが、extend/waved/sweep/travel/entry の frame-level acceptance が不足する。 | 固定 cannon fixture で BCU と比較する。 |
| Device evidence | mobile input / keyboard / safe-area / audio | headless viewport check は物理端末の software keyboard、orientation change、touch gesture、BGM/SE 多重を証明しない。 | iPhone/iPad/Android の実機記録を visual ledger に追加する。 |
| Compatibility | BCU save / lineup import-export | BCU serializer owner と round-trip fixture が project scope にない。 | 実装する場合は BCU format/version owner と round-trip fixture を先に確定する。 |
| Negative evidence | normal CSV SUMMON holder | 調査済み BCU source では通常 unit/enemy CSV の直接 holder を確認できない。 | 新しい source fact が出るまで parser field を捏造しない。 |
| Negative evidence | generic castle-owned attack | 通常 `ECastle` は汎用 attack owner ではない。 | 特殊攻撃拠点は `EEnemy` owner と stage spawn condition を使う。 |

## Visual acceptance queue

結果は `bcu-visual-review-checklist.md` にだけ記録します。

- P_DELAY
- burrow DOWN / underground / UP
- spirit actor / A_IMUATK / ready-card flash
- SUMMON entry / placement / layer / cleanup
- full / mini death-surge
- non-basic cannon / BASE_WALL
- attack effect / wave / surge / KB / status icon
- mobile production / drag / slide / pause / camera
- BGM/SE/boss transition on physical devices
- character modification editor の safe-area / software keyboard / orientation change

## 解決済み項目の扱い

SUMMON proc-object loader、`Trait.targetForms` の loader 接続、combo/orb/treasure/talent/PCoin 実データ、extra/custom revive source-range、storage failure visibility などは、source loading の不足としては解決済みです。ただし、現在の runtime に別の correctness Issue がある場合は GitHub Issue を優先します。

## 更新規則

- confirmed code defect をここに追加しない。Issue を作成し migration status へ分類する。
- source/fixture が揃った行は削除する。長い「解決済み一覧」を増やさない。
- visual result はこの文書ではなく ledger に記録する。
- out-of-scope を欠陥として表現しない。
