# BCU unresolved evidence blockers

This file lists evidence that could not be fully resolved after the 2026-06-12 docs refresh.

Rows here are blockers for `fully-complete` or broader implementation claims. They are not necessarily blockers for deterministic runtime checks. If a runtime is implemented but still lacks browser/manual visual acceptance, the row must say that explicitly instead of marking the JS owner as missing.

| Area | Current blocker | Required next step |
|---|---|---|
| BCU PC draw-side source | PC zip/source is not available in this checkout, so PC-only draw helpers cannot be cited. | Add PC zip to `references/bcu/` before any claim that depends on PC-only draw helpers. |
| Enemy `IMUPOIATK` direct CSV holder | Direct `DataEnemy` raw index for toxic immunity/resistance is not proven. `DataUnit` index 90 maps `IMUPOIATK`; inspected `DataEnemy` fields only prove `P_POIATK`. | Inspect `CustomEntity` / proc serialization before adding an enemy CSV parser index. |
| Normal CSV summon holder | Standard BC unit/enemy CSV constructor evidence does not prove a direct `Proc.SUMMON` holder. | Keep normal CSV parser unchanged; map BCU custom/proc-object data before any `code-complete` summon claim. |
| BCU custom/proc-object summon loader | Explicit JS summon runtime exists, but automatic source loading for custom/proc-object attack data is not implemented. | Load custom/proc-object `SUMMON` data into per-hit attack events. |
| Summon stage allow/group and entry visuals | Runtime has side limit/layer/delay/bond support, but source-backed stage `allow` group semantics and exact entry appearance are not fixture-backed. | Add stage fixture for summoned enemy allow/group rules; record human review before `fully-complete`. |
| Full `Trait.targetForms` fixture source | BCU branch is identified, but local JS fixture data for special target forms is not proven. | Add minimal source-backed targetForms fixtures before changing compatibility behavior. |
| Bounty/money visual | Economy math is source-backed, but battle visual owner/effect alias is not proven. | Keep visual row partial; add PC source or exhaustive negative visual search. |
| Zombie revive browser visual acceptance and extra/custom revive interactions | Standard deterministic zombie revive/soulstrike visual trace exists, but human browser acceptance and extra/custom variants are not recorded. | Record browser review for DOWN/REVIVE phases; add extra/custom fixtures before broader `fully-complete` claims. |
| Mini-death-surge holder and edge cleanup | Standard timing path is tested, but mini holder and extra/custom cleanup variants are not fully proven in JS. | Add loader-backed/custom holder proof and end-to-end extra/custom lifecycle tests before behavior edits. |
| External combo/orb/treasure/talent/PCoin modifiers | Source paths are known, but JS data loaders and exact fixtures are missing for affected families. | Implement fixtures first; then wire resolver with source-backed battle basis state. |
| Castle/base guard browser visual acceptance | JS owner is no longer missing: `BcuCastleGuardRuntime` / `BattleSceneBcuCastleGuardPatch` implement active/hold/break behavior and `scripts/check-bcu-castle-guard-parity.mjs` covers it. Remaining evidence gap is manual browser appearance only. | Record browser review for guard hold/break appearance before any `fully-complete` visual claim. |
