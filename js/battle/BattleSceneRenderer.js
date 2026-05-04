export class BattleSceneRenderer {
  render(previewRenderer, scene) {
    const c = previewRenderer.ctx; const w = previewRenderer.logicalW; const h = previewRenderer.logicalH; const groundY = scene?.groundY || 590;
    c.clearRect(0, 0, w, h);

    if (scene?.stage?.backgroundImageAsset) this.drawBackgroundCover(c, scene.stage.backgroundImageAsset, w, h);
    else this.drawFallbackBackground(c, w, h, groundY);

    c.strokeStyle = '#ffffff44'; c.lineWidth = 1; c.beginPath(); c.moveTo(0, groundY + 0.5); c.lineTo(w, groundY + 0.5); c.stroke();
    this.drawCastle(c, scene?.castle, groundY);

    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawActor(c, actor);
    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawHpBar(c, actor);
    for (const actor of (scene?.actors || [])) if (actor.isAlive()) this.drawActorDebug(c, actor);

    this.drawHud(c, scene);
    if (scene?.loadFailed) { c.fillStyle = '#000b'; c.fillRect(w * 0.22, h * 0.42, w * 0.56, 120); c.fillStyle = '#fecaca'; c.font = '28px ui-monospace, monospace'; c.fillText('BattleScene load failed', w * 0.31, h * 0.49); c.font = '14px ui-monospace, monospace'; c.fillText(scene.failureReason || '-', w * 0.24, h * 0.55); }
  }

  drawBackgroundCover(c, img, w, h) {
    const scale = Math.max(w / img.width, h / img.height);
    const dw = img.width * scale, dh = img.height * scale;
    const dx = (w - dw) * 0.5, dy = (h - dh) * 0.5;
    c.drawImage(img, dx, dy, dw, dh);
  }

  drawFallbackBackground(c, w, h, groundY) {
    const sky = c.createLinearGradient(0, 0, 0, groundY); sky.addColorStop(0, '#7dc7ff'); sky.addColorStop(1, '#d9f0ff'); c.fillStyle = sky; c.fillRect(0, 0, w, groundY);
    c.fillStyle = '#c9b78f'; c.fillRect(0, groundY, w, h - groundY);
  }

  drawHud(c, scene) {
    const dog = scene?.actors?.find((a) => a.side === 'dog-player'); const cat = scene?.actors?.find((a) => a.side === 'cat-enemy');
    c.fillStyle = '#0008'; c.fillRect(14, 14, 560, 118); c.fillStyle = '#f8fafc'; c.font = '20px ui-sans-serif, system-ui'; c.fillText('Wanko Battle v0.2', 24, 40); c.font = '14px ui-monospace, monospace';
    c.fillText('bg:bg000.png', 24, 60); c.fillText(`dog HP/state: ${dog?.hp ?? '-'} / ${dog?.state ?? '-'}`, 24, 80); c.fillText(`cat HP/state: ${cat?.hp ?? '-'} / ${cat?.state ?? '-'}`, 24, 100); c.fillText('mode:battle', 24, 120);
  }

  drawCastle(c, castle, groundY) { if (!castle?.layers?.length) return; const order = ['bottom', 'middle', 'top']; const ordered = order.map((id) => castle.layers.find((x) => x.id === id)).filter(Boolean); for (const layer of ordered) { const scale = castle.scale || 1; const x = castle.x + (layer.offsetX || 0) * scale - layer.image.width * 0.5 * scale; const y = castle.y + (layer.offsetY || 0) * scale - layer.image.height * scale; c.drawImage(layer.image, x, y, layer.image.width * scale, layer.image.height * scale); } c.strokeStyle = '#313e52'; c.strokeRect(castle.x - 6, groundY - 6, 12, 12); }

  drawHpBar(c, actor) {
    const x = actor.x - 40, y = actor.y - 194, w = 80, h = 8;
    const ratio = Math.max(0, Math.min(1, actor.hp / Math.max(1, actor.maxHp)));
    c.fillStyle = '#111827'; c.fillRect(x, y, w, h);
    c.fillStyle = '#22c55e'; c.fillRect(x, y, w * ratio, h);
    c.strokeStyle = '#e5e7eb'; c.strokeRect(x, y, w, h);
  }

  drawActorDebug(c, actor) {
    const src = actor.rawStats?.source || {}; const fileName = (src.file || '-').split('/').slice(-2).join('/');
    const lines = [
      `${actor.assetDef?.label || '-'} side:${actor.side}`,
      `x:${actor.x.toFixed(1)} facing:${actor.facing} direction:${actor.direction} renderFlipX:${actor.renderFlipX}`,
      `state:${actor.state} hp:${actor.hp}/${actor.maxHp} dmg:${actor.damage}`,
      `speedRaw:${actor.rawStats?.speed ?? '-'} moveSpeed:${actor.moveSpeed.toFixed(1)}px/s`,
      `detectRangeRaw:${actor.rawStats?.detectionRange ?? '-'} detectRangePx:${actor.detectionRangePx.toFixed(1)}`,
      `atkWaitF:${actor.attackWaitFrames} atkStartupF:${actor.attackStartupFrames} atkType:${actor.attackType}`,
      `attackElapsedMs:${actor.attackElapsedMs.toFixed(1)} hitAtMs:${actor.hitAtMs.toFixed(1)} attackCycleMs:${actor.attackCycleMs.toFixed(1)} hitDone:${actor.hasHitInCurrentAttack}`,
      `src:${fileName} row:${src.row ?? '-'} provisional:${src.provisional ? 'yes' : 'no'}`
    ];
    c.fillStyle = '#0009'; c.fillRect(actor.x - 170, actor.y - 180, 430, 122); c.fillStyle = '#f8fafc'; c.font = '12px ui-monospace, monospace'; lines.forEach((line, i) => c.fillText(line, actor.x - 164, actor.y - 166 + i * 14));
  }

  drawActor(c, actor) {
    if (!actor?.sprite || !actor?.model) return;
    const baseAngle = actor.model.baseAngle || 3600;
    c.save(); c.translate(actor.x, actor.y);
    if (actor.renderFlipX) c.scale(-1, 1);
    for (const p of actor.model.getDrawList()) {
      const w = p.world; const partIndex = p.current?.partIndex ?? p.partIndex; const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue; if ((imgcutIndex ?? 0) < 0) continue; if (!w || (w.o ?? 1) <= 0) continue;
      const part = actor.sprite?.imgcut?.parts?.[partIndex]; if (!part || part.w <= 0 || part.h <= 0) continue;
      c.save(); c.translate(w.x * actor.scale, w.y * actor.scale); c.rotate((w.a / baseAngle) * Math.PI * 2); c.globalAlpha = w.o ?? 1;
      const sx = w.sx * actor.scale; const sy = w.sy * actor.scale;
      actor.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy }); c.restore();
    }
    c.restore();
  }
}
