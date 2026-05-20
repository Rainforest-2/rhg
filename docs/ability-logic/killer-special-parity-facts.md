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
  - `AB_VKILL` exists, but no current unit CSV parse sets it. It can still be honored if a future combo/runtime source sets the bit.
  - no confirmed existing ability bit or parser path is present for beast killer.
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
  - attacker has `AB_VKILL` and target has `villain`: damage x2.5.
  - target has `AB_VKILL` and attacker has `villain`: damage x0.4.
- Witch killer:
  - attacker has `AB_WKILL` and target has `witch`: damage x5.
  - target has `AB_WKILL` and attacker has `witch`: damage x0.1.
- Eva killer:
  - attacker has `AB_EKILL` and target has `eva`: damage x5.
  - target has `AB_EKILL` and attacker has `eva`: damage x0.2.

## Explicitly not implemented

- `超獣特効` damage and attack-nullify are not implemented here because the current parser does not expose a confirmed ability bit/source for the holder. Adding one without a reference-backed CSV column or combo/orb source would be speculation.
- Sage special status resistance and sage-resistance bypass are not implemented here because this pass is limited to damage multipliers.
- Combo/orb enhancement of witch/eva killer is not implemented because no current combo/orb runtime source is wired into the resolver.

## Runtime files changed

- `js/battle/DamageAbilityResolver.js`

## Invariants

- No new random rolls.
- No new debug-heavy per-hit allocations beyond existing `pushStep` details for actually applied damage modifiers.
- No raw asset or renderer change.
- No ability bit is invented.
