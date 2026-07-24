# RHG ドキュメント索引

更新日: 2026-07-25  
対象: `Rainforest-2/rhg`  
確認した `main`: `6b8d2cb45ee7b6dd45c390c71012cd071381d91f`

## 目的

`docs/` の各ファイルに一つの責務を与え、同じ status・優先順位・チェック一覧を複数箇所で持たないための索引です。

## 最初に読むもの

| 順序 | 文書 | 責務 |
|---:|---|---|
| 1 | [`../README.md`](../README.md) | 公開向け概要と現在の主要リスク |
| 2 | [`bcu-migration-status.md`](bcu-migration-status.md) | 現在の高水準 status、active correctness 項目、完了済み領域、次の順序 |
| 3 | [`RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`](RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md) | architecture、owner、data flow、単位、検証境界 |
| 4 | 対象領域の focused document | ability、evidence、visual、character modification、community stage など |

## Current documents

現行コード、merged PR、active Issue と同期して更新する文書です。

| 文書 | 所有する情報 | 所有しない情報 |
|---|---|---|
| [`bcu-migration-status.md`](bcu-migration-status.md) | 高水準 status、active correctness 項目、現在の完了/未完了 | 詳細な BCU source inventory、個別 visual capture |
| [`ability-logic/current-ability-parity-status.md`](ability-logic/current-ability-parity-status.md) | ability / proc / lifecycle の状態行 | project 全体 roadmap、古い監査履歴 |
| [`ability-logic/bcu-unresolved-evidence-blockers.md`](ability-logic/bcu-unresolved-evidence-blockers.md) | source/evidence 不足、互換性境界、negative evidence | 確認済みコード defect の重複一覧 |
| [`ability-logic/bcu-visual-review-checklist.md`](ability-logic/bcu-visual-review-checklist.md) | 実ブラウザ/実機比較の ledger | headless check の結果だけによる accepted |
| [`ability-logic/bcu-parity-codex-workplan.md`](ability-logic/bcu-parity-codex-workplan.md) | active correctness 項目の実行順と完了条件 | status の再掲、解決済み作業の長い履歴 |
| [`RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md`](RHG_CHARACTER_MODIFICATION_ARCHITECTURE_ADDENDUM_2026-07-23.md) | character modification の現行 schema / owner / cache / import 境界 | BCU parity status 全体 |

## Reference documents

頻繁に変えず、source fact と architecture を保持します。

| 文書 | 用途 |
|---|---|
| [`RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md`](RHG_BCU_CORE_ARCHITECTURE_AND_LOGIC_REFERENCE_2026-07-23.md) | 中核 architecture と BCU/RHG owner 対応。作成時 HEAD の snapshot であり、current defect ledger ではない |
| [`RHG_COMMUNITY_STAGE_PLATFORM_COMPLETE_DESIGN_2026-07-24_FINAL.md`](RHG_COMMUNITY_STAGE_PLATFORM_COMPLETE_DESIGN_2026-07-24_FINAL.md) | 「みんなのステージ」の製品仕様、data contract、Phase順、受入条件。current implementation statusではない |
| [`ability-logic/bcu-ability-source-evidence.md`](ability-logic/bcu-ability-source-evidence.md) | BCU file/class/method/field の根拠一覧 |
| [`ability-logic/bcu-fact-first-update-procedure.md`](ability-logic/bcu-fact-first-update-procedure.md) | source fact から実装・検証・docs 更新へ進む手順 |

## Historical documents

- `RHG_CHARACTER_MODIFICATION_IMPLEMENTATION_PLAN_2026-07-23.md` は実装前の設計履歴です。現行の責務境界は architecture addendum を優先します。
- 削除済みの個別 `*-current-status.md` や過去監査は Git 履歴から参照できます。
- 古いレポートの「未実装」「候補」「完全」は、現行コード・merged PR・active Issue・check で再確認するまで current status に戻しません。

## Agent documents

- [`../AGENTS.md`](../AGENTS.md): 最小の必須規則
- [`agent/README.md`](agent/README.md): agent 補助文書の索引
- [`agent/community-stage/README.md`](agent/community-stage/README.md): Community Stage Phase 3〜11の実装契約とTerra向け入口
- `agent/bcu-parity-rules.md`: 根拠階層と guardrail
- `agent/checks-and-verification.md`: check 選択と検証規則
- `agent/report-format.md`: 実装レポート形式
- `agent/md-maintenance-rules.md`: Markdown 保守規則

## 更新規則

1. コード defect は GitHub Issue で追跡し、`bcu-migration-status.md` に分類だけを記載する。
2. merged PR がIssueを修正した場合、Issue stateが遅れていても現行コードと回帰チェックを優先してstatusを更新する。
3. ability の状態変更は `current-ability-parity-status.md` の該当行だけを更新する。
4. source/evidence 不足は `bcu-unresolved-evidence-blockers.md` に記録する。確認済み実装バグを重複記載しない。
5. visual ledger は実ブラウザ/実機比較後だけ更新する。
6. roadmap はactive correctness項目と一致させ、解決済み項目を active work として残さない。
7. architecture の高水準契約が変わった場合だけ、中核参照書または subsystem architecture を更新する。
8. 同じ目的の新しい status 文書を作らない。既存 SSOT に追記または置換する。
9. 日付だけを更新せず、確認した commit SHA と変更理由を記録する。
10. `agent/community-stage/*` は実装補助であり、Phase完了statusを重複管理しない。
