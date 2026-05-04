export class BattleSceneRenderer {
  render(previewRenderer, scene) {
    const c = previewRenderer.ctx; const w = previewRenderer.logicalW; const h = previewRenderer.logicalH; const groundY = scene?.groundY || 590;
    c.clearRect(0, 0, w, h);

    if (scene?.stage?.background?.image && scene?.stage?.background?.crop) this.drawBackgroundCropCover(c, scene.stage.background, w, h);
    else this.drawFallbackBackground(c, w, h, groundY);

    c.strokeStyle = '#ffffff33'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, groundY + 0.5); c.lineTo(w, groundY + 0.5); c.stroke();
    this.drawCastle(c, scene?.castle, groundY);
    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawActor(c, actor);
    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawHpBar(c, actor);
    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawActorDebug(c, actor, scene?.battleState || 'running');
    this.drawHud(c, scene);

    if (scene?.battleState && scene.battleState !== 'running') {
      c.fillStyle = '#0008'; c.fillRect(w * 0.3, h * 0.42, w * 0.4, 90); c.fillStyle = '#fef9c3'; c.font = '36px ui-sans-serif';
      const msg = scene.battleState === 'dog-win' ? 'DOG PLAYER WIN' : scene.battleState === 'cat-win' ? 'CAT ENEMY WIN' : 'DRAW';
      c.fillText(msg, w * 0.34, h * 0.5);
    }

    if (scene?.loadFailed) { c.fillStyle = '#000b'; c.fillRect(w * 0.22, h * 0.42, w * 0.56, 120); c.fillStyle = '#fecaca'; c.font = '28px ui-monospace, monospace'; c.fillText('BattleScene load failed', w * 0.31, h * 0.49); c.font = '14px ui-monospace, monospace'; c.fillText(scene.failureReason || '-', w * 0.24, h * 0.55); }
  }

  drawBackgroundCropCover(c, bg, w, h) {
    const { image, crop } = bg;
    const scale = Math.max(w / crop.w, h / crop.h);
    const dw = crop.w * scale, dh = crop.h * scale;
    const dx = (w - dw) * 0.5, dy = (h - dh) * 0.5;
    c.drawImage(image, crop.x, crop.y, crop.w, crop.h, dx, dy, dw, dh);
  }

  drawFallbackBackground(c, w, h, groundY) { const sky = c.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, '#7dc7ff'); sky.addColorStop(1, '#d9f0ff'); c.fillStyle = sky; c.fillRect(0, 0, w, groundY); c.fillStyle = '#c9b78f'; c.fillRect(0, groundY, w, h - groundY); }
  drawCastle(c, castle, groundY) { if (!castle?.layers?.length) return; const order = ['bottom', 'middle', 'top']; const ordered = order.map((id) => castle.layers.find((x) => x.id === id)).filter(Boolean); for (const layer of ordered) { const scale = castle.scale || 1; const x = castle.x + (layer.offsetX || 0) * scale - layer.image.width * 0.5 * scale; const y = castle.y + (layer.offsetY || 0) * scale - layer.image.height * scale; c.drawImage(layer.image, x, y, layer.image.width * scale, layer.image.height * scale); } c.strokeStyle = '#313e52'; c.strokeRect(castle.x - 6, groundY - 6, 12, 12); }

  drawHud(c, scene) {
    const dog = scene?.actors?.find((a) => a.side === 'dog-player'); const cat = scene?.actors?.find((a) => a.side === 'cat-enemy');
    const cropName = scene?.stage?.background?.crop?.name || '-';
    c.fillStyle = '#0008'; c.fillRect(14, 14, 600, 132); c.fillStyle = '#f8fafc'; c.font = '20px ui-sans-serif, system-ui'; c.fillText('Wanko Battle v0.3', 24, 40); c.font = '14px ui-monospace, monospace';
    c.fillText(`bg:bg000.png crop:${cropName}`, 24, 60); c.fillText(`dog HP/state: ${dog?.hp ?? '-'} / ${dog?.state ?? '-'}`, 24, 80); c.fillText(`cat HP/state: ${cat?.hp ?? '-'} / ${cat?.state ?? '-'}`, 24, 100); c.fillText(`mode:battle battleState:${scene?.battleState || '-'}`, 24, 120);
  }

  drawHpBar(c, actor) { const x = actor.x - 40, y = actor.y - 194, w = 80, h = 8; const ratio = Math.max(0, Math.min(1, actor.hp / Math.max(1, actor.maxHp))); c.fillStyle = '#111827'; c.fillRect(x, y, w, h); c.fillStyle = '#22c55e'; c.fillRect(x, y, w * ratio, h); c.strokeStyle = '#e5e7eb'; c.strokeRect(x, y, w, h); }

  drawActorDebug(c, actor, battleState) {
    const src = actor.rawStats?.source || {}; const fileName = (src.file || '-').split('/').slice(-2).join('/');
    const lines = [
      `${actor.assetDef?.label || '-'} side:${actor.side} battleState:${battleState}`,
      `x:${actor.x.toFixed(1)} facing:${actor.facing} direction:${actor.direction} renderFlipX:${actor.renderFlipX}`,
      `state:${actor.state} hp:${actor.hp}/${actor.maxHp} dmg:${actor.damage}`,
      `kb:${actor.knockbacks} kbCount:${actor.knockbackCount} nextKbHp:${actor.nextKnockbackHp.toFixed(1)}`,
      `isKb:${actor.isKnockbacking} kbElapsedMs:${actor.knockbackElapsedMs.toFixed(1)}`,
      `speedRaw:${actor.rawStats?.speed ?? '-'} moveSpeed:${actor.moveSpeed.toFixed(1)}px/s`,
      `attackElapsedMs:${actor.attackElapsedMs.toFixed(1)} hitAtMs:${actor.hitAtMs.toFixed(1)} attackCycleMs:${actor.attackCycleMs.toFixed(1)}`,
      `src:${fileName} row:${src.row ?? '-'} provisional:${src.provisional ? 'yes' : 'no'}`
    ];
    c.fillStyle = '#0008'; c.fillRect(actor.x - 170, actor.y - 190, 440, 122); c.fillStyle = '#f8fafc'; c.font = '12px ui-monospace, monospace'; lines.forEach((line, i) => c.fillText(line, actor.x - 164, actor.y - 176 + i * 14));
  }

  drawActor(c, actor) {
    if (!actor?.sprite || !actor?.model || !actor.isAlive()) return;
    const baseAngle = actor.model.baseAngle || 3600; c.save(); c.translate(actor.x, actor.y); if (actor.renderFlipX) c.scale(-1, 1);
    for (const p of actor.model.getDrawList()) {
      const w = p.world; const partIndex = p.current?.partIndex ?? p.partIndex; const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue; if ((imgcutIndex ?? 0) < 0) continue; if (!w || (w.o ?? 1) <= 0) continue;
      const part = actor.sprite?.imgcut?.parts?.[partIndex]; if (!part || part.w <= 0 || part.h <= 0) continue;
      c.save(); c.translate(w.x * actor.scale, w.y * actor.scale); c.rotate((w.a / baseAngle) * Math.PI * 2); c.globalAlpha = w.o ?? 1; const sx = w.sx * actor.scale; const sy = w.sy * actor.scale;
      actor.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy }); c.restore();
    }
    c.restore();
  }
}
