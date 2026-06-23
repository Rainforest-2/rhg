const { readFile } = await import('node'+':fs'+'/promises');

async function read(path) { return readFile(new URL(path, import.meta.url), 'utf8'); }

export async function verifyAttackWaitAnimationWhenCooldownTargetAppears() {
  const s = await read('./BattleScene.js');
  const checks = [s.includes('enterAttackWait(actor'), s.includes("'cooldown-target-in-range'"), s.includes("setAnimation(actor.idleAnimId||actor.moveAnimId,'attack-wait'"), s.includes('isActorAttackCooldownReady(actor)')];
  const ok = checks.every(Boolean);
  return { ok, checks, errors: ok ? [] : ['attack-wait animation transition under cooldown not implemented'] };
}

export async function verifyAttackCooldownStillActorScopedAcrossTargetDeath() {
  const s = await read('./BattleScene.js');
  const checks = [s.includes('this.timeMs >= (actor?.attackCooldownUntilMs||0)'), s.includes('startActorAttack(actor,target,targetType)'), !s.includes('attackCooldownUntilMs = 0')];
  const ok = checks.every(Boolean);
  return { ok, checks, errors: ok ? [] : ['cooldown is not actor-scoped or may reset on target changes'] };
}
