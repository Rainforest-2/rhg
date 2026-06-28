# BCU 事実優先の更新手順

`RHgrive/rhg` で BCU パリティを更新する際は、常にこの手順に従います。

## 中核ルール

```text
BCU の事実 -> 現在の JS オーナー監査 -> 最小変更 -> 決定的なチェック -> 集中したドキュメント更新
```

フィールド名、能力名、古い README の主張、見た目の近似だけでゲームプレイを変えないでください。

## 実施順序

1. **最小の対象を定義する**
   - 挙動 / オーナー側 / データソース
   - タイミングと状態遷移
   - 証明したい互換性や見た目の主張

2. **まず BCU の事実を確認する**
   - ローカルの BCU 共通ソース
   - 見た目 / UI 依存ならローカルの BCU Android / PC ソース
   - チェックイン済みの BCU 参照ドキュメント
   - 現行コードが実装主張を確認するまで、過去のドキュメントは参考にしない

3. **編集前に rhg の現在のオーナーを監査する**
   - parser / source loader
   - runtime state owner
   - boot / import / wrapper chain
   - visible なら renderer / UI owner
   - save / lineup 互換が出るなら persistence owner
   - 既存の決定的チェックとフィクスチャ

4. **実際のギャップを分類する**
   - runtime missing
   - runtime はあるが実データ読み込みが未完
   - runtime はあるがブラウザ見た目は未受け入れ
   - source owner / schema が未確認
   - proposed owner が負の根拠で否定されている

5. **最も安全な変更タイプを選ぶ**
   - docs-only
   - test-only
   - loader-fixture
   - runtime-minimal
   - runtime-wrapper
   - visual-acceptance record

6. **既存挙動を保護する**
   - wrapper order と元の呼び出しを維持する
   - CSV インデックス、proc holder、effect alias、save schema を勝手に作らない
   - ルーズな raw-asset runtime fallback を追加しない
   - RNG、targeting、side ownership を静かに変えない
   - 汎用の castle-owned attack owner を作らない
   - source schema 根拠なしでブラウザローカル永続化を BCU 互換と呼ばない

7. **焦点チェックを追加または更新する**
   - positive / negative case
   - timing / order case
   - data-coverage claim には source-loader fixture
   - visible behavior には coordinate / effect trace
   - persistence 変更には blocked / quota storage case

8. **関連する検証を行う**

```bash
node scripts/check-bcu-ability-parity-safe-suite.mjs
```

関連する焦点チェックも実行し、利用できない必須コマンドを見逃さないでください。

9. **最後に既存ドキュメントを更新する**
   - `docs/ability-logic/current-ability-parity-status.md`
   - `docs/ability-logic/bcu-unresolved-evidence-blockers.md`
   - `docs/ability-logic/bcu-visual-review-checklist.md`（実際のブラウザレビュー後のみ）
   - `docs/bcu-migration-status.md`
   - `README.md` と `AGENTS.md`（公開 / エージェント要約が変わる場合）

## 中止条件

次のいずれかに当たる場合は、推測せずにブロッカーとして記録してください。

- BCU holder / source / schema が未確認
- 現行 JS loader が実データを供給できない
- CSV index、effect alias、save format を推測する変更が必要
- wrapper order / caller を監査できない
- 非 BCU 挙動が変わる
- 決定的な negative case を書けない
- 見た目完了を主張するにはまだ手動レビューが必要

## 最終レポート形式

```text
BCU facts taken:
- ...

Existing JS logic audited:
- ...

Gap classification:
- runtime / loader / visual / schema / negative-evidence

Change type:
- docs-only / test-only / loader-fixture / runtime-minimal / runtime-wrapper

Files changed:
- ...

Existing behavior protected:
- ...

Checks run:
- ...

Remaining blockers:
- ...
```