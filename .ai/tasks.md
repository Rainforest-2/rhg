# AI Task Tracker

更新日: 2026-07-03

## 完了

- [x] import graph 全域監査、孤立コード・重複実装・未使用 verifier の整理
- [x] `npm ci` / `npm run build` / `npm run verify` / `npm run check` / `npm test` と全 `check-*.mjs` の監査・失敗解消
- [x] 実カスタム proc-object SUMMON の loader → `BattleAttackProfile` → immediate/on_hit spawn 経路の確認
- [x] 同フレーム攻撃は現行 due-hit capture / damage 挙動を維持する判断を記録
- [x] 状態台帳・blocker・visual checklist・migration status の同期

## 現在の残タスク

- [ ] BCU参照との手動ブラウザ比較を台帳へ記録する: P_DELAY、burrow、spirit / A_IMUATK、SUMMON entry、full / mini death-surge、非基本キャノン、BASE_WALL、attack effect / wave / surge / knockback / status icon、モバイル操作、音。
- [ ] メモリに余裕のある環境で、legend / main / event の戦闘中フレームまでのheadless smokeを完走させる。

## 条件付き・対象外

- [ ] PC版固有の描画互換を主張する場合のみ、BCU PC描画側ソースを追加して照合する。
- [x] BCUセーブ / 陣形 import-export は対象外。追加する場合のみ、BCU側シリアライズオーナーとround-trip fixtureを先に整備する。
