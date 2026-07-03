# Review

更新日: 2026-07-03（完成監査・非runtime台帳同期後）

## Critical

None

## High

None

## Medium

- **戦闘中headless smokeが未完走。** legend / main / event の各ステージで、ロード後に戦闘中フレームまで進めるChromium smokeは、実行環境の空きメモリ約1.3GBでrendererがクラッシュして完走していない。アプリ欠陥の証跡はないが、十分なメモリの環境で再実行して成功を記録する必要がある。

## Low

- **BCU参照に対する手動ブラウザ受け入れが残る。** P_DELAY、burrow、spirit / A_IMUATK、SUMMON entry、full / mini death-surge、非基本キャノン、BASE_WALL、attack effect / wave / surge / knockback / status icon、モバイル操作、音は `bcu-visual-review-checklist.md` の `not-reviewed` を固定fixtureとBCU参照で更新する必要がある。
- **PC版固有の描画互換は条件付き。** PC描画側ソースがこのチェックアウトに無いため、PC固有の見た目互換を主張する場合だけソース追加と照合が必要。Web版の現行主張には含めない。

## Accepted Decisions

- 同フレーム攻撃は、現行の due-hit capture / damage 挙動を維持する。追加キャプチャ監査・ランタイム変更は行わない。
- 実カスタム proc-object SUMMON は loader → `BattleAttackProfile` → immediate/on_hit spawn まで確認済み。残るのは entry見た目の手動受け入れのみ。
- BCUセーブ / 陣形 import-export は out-of-scope。

## Next Codex Task

ランタイムコードを変更しない。十分なメモリの環境で戦闘中headless smokeを実行できる場合のみ、その結果を記録する。そうでなければ、固定BCU参照を用いた手動ブラウザ受け入れの結果だけを visual checklist に記録する。

## Stop Condition

未達。`Medium` のbattle smoke未完走、および visual checklist の `not-reviewed` 項目が残っている。
