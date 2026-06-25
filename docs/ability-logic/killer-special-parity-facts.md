# Fact-only killer / special-target parity scope

## Objective

Implement only killer/special-target damage multipliers that are explicitly documented in local references and already represented by existing JS ability bits and target traits.

## References inspected

- `references/bcu/キャラクターの特殊性能_全文_リンク削除.md`
  - `超生命体特効`: documents damage dealt x1.6 and damage received x0.7 against super life / colossus targets.
  - `超獣特効`: documents damage dealt x2.5 and damage received x0.6 against behemoth targets, plus attack-nullify behavior.
  - `超賢者特効`: documents damage dealt x1.2, damage received x0.5, and 70% status-effect reduction against sage targets.
  - `怪人特効`: documents damage dealt x2.5 and damage received x0.4 against villain targets.
  - `魔女キラー`: documents damage dealt x5 and damage received x0.1 against witch targets.
  - `使徒キラー`: documents damage dealt x5 and damage received x0.2 against eva/angel targets.
- `js/battle/BcuCombatModel.js`
  - target traits already include `baron`, `beast`, `sage`, `villain`, `witch`, and `eva`.
  - unit ability bits already include `AB_BAKILL` for colossus, `AB_SKILL` for sage, `AB_WKILL` for witch, and `AB_EKILL` for eva.
  - `AB_VKILL` is not a normal unit CSV bit; BCU `EUnit.getAbi()` grants it from a positive `C_VKILL` combo increment.
  - beast hunter is `P_BSTHUNT`, not an `AB_*` bit.
- `js/battle/DamageAbilityResolver.js`
  - existing resolver already applies colossus attack-side multiplier but used the wrong holder check for the defense-side branch.

## Implemented in this pass

- Colossus / super life special:
  - attacker has `AB_BAKILL` and target has `baron`: damage x1.6.
  - target has `AB_BAKILL` and attacker has `baron`: damage x0.7.
- Sage special:
  - attacker has `AB_SKILL` and target has `sage`: damage x1.2.
  - target has `AB_SKILL` and attacker has `sage`: damage x0.5.
- Villain special:
  - active `C_VKILL` combo increment synthesizes `AB_VKILL` for damage resolution.
  - attacker has synthesized or explicit `AB_VKILL` and target has `villain`: damage x2.5.
  - target has synthesized or explicit `AB_VKILL` and attacker has `villain`: damage x0.4.
- Witch killer:
  - attacker has `AB_WKILL` and target has `witch`: damage x5.
  - target has `AB_WKILL` and attacker has `witch`: damage x0.1.
- Eva killer:
  - attacker has `AB_EKILL` and target has `eva`: damage x5.
  - target has `AB_EKILL` and attacker has `eva`: damage x0.2.

## Explicitly not implemented

- None for the rows above after the 2026-06-25 audit. Remaining boundaries are visual acceptance and future source-proven holders, not these damage multipliers.

## Runtime files changed

- `js/battle/DamageAbilityResolver.js`

## Invariants

- No new random rolls.
- No new debug-heavy per-hit allocations beyond existing `pushStep` details for actually applied damage modifiers.
- No raw asset or renderer change.
- No ability bit is invented.
