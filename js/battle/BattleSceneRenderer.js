export class BattleSceneRenderer {
  render(previewRenderer, scene) {
    const c = previewRenderer.ctx;
    const w = previewRenderer.logicalW;
    const h = previewRenderer.logicalH;
    const groundY = scene?.groundY || 590;

    c.clearRect(0, 0, w, h);
    const sky = c.createLinearGradient(0, 0, 0, groundY);
    sky.addColorStop(0, '#7dc7ff');
    sky.addColorStop(1, '#d9f0ff');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, groundY);

    c.fillStyle = '#c9b78f';
    c.fillRect(0, groundY, w, h - groundY);
    c.strokeStyle = '#7c6643';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, groundY + 0.5);
    c.lineTo(w, groundY + 0.5);
    c.stroke();

    this.drawCastle(c, scene?.castle, groundY);
    for (const actor of (scene?.actors || [])) this.drawActor(c, actor);

    c.fillStyle = '#0008';
    c.fillRect(14, 14, 360, 84);
    c.fillStyle = '#f8fafc';
    c.font = '20px ui-sans-serif, system-ui';
    c.fillText('Wanko Battle v0', 24, 40);
    c.font = '14px ui-monospace, monospace';
    c.fillText('dog-player: ワンコ (enemy-000)', 24, 62);
    c.fillText('cat-enemy: ネコ (unit-000-f) / mode:battle', 24, 82);

    if (scene?.loadFailed) {
      c.fillStyle = '#000b';
      c.fillRect(w * 0.22, h * 0.42, w * 0.56, 120);
      c.fillStyle = '#fecaca';
      c.font = '28px ui-monospace, monospace';
      c.fillText('BattleScene load failed', w * 0.31, h * 0.49);
      c.font = '14px ui-monospace, monospace';
      c.fillText(scene.failureReason || '-', w * 0.24, h * 0.55);
    }
  }

  drawCastle(c, castle, groundY) {
    if (!castle?.layers?.length) return;
    const order = ['bottom', 'middle', 'top'];
    const ordered = order.map((id) => castle.layers.find((x) => x.id === id)).filter(Boolean);
    for (const layer of ordered) {
      const scale = castle.scale || 1;
      const x = castle.x + (layer.offsetX || 0) * scale - layer.image.width * 0.5 * scale;
      const y = castle.y + (layer.offsetY || 0) * scale - layer.image.height * scale;
      c.drawImage(layer.image, x, y, layer.image.width * scale, layer.image.height * scale);
    }
    c.strokeStyle = '#313e52';
    c.strokeRect(castle.x - 6, groundY - 6, 12, 12);
  }

  drawActor(c, actor) {
    if (!actor?.sprite || !actor?.model) return;
    const baseAngle = actor.model.baseAngle || 3600;
    c.save();
    c.translate(actor.x, actor.y);
    if (actor.facing < 0) c.scale(-1, 1);

    for (const p of actor.model.getDrawList()) {
      const w = p.world;
      const partIndex = p.current?.partIndex ?? p.partIndex;
      const imgcutIndex = p.current?.imgcutIndex ?? p.imgcutIndex;
      if (!Number.isInteger(partIndex) || partIndex < 0) continue;
      if ((imgcutIndex ?? 0) < 0) continue;
      if (!w || (w.o ?? 1) <= 0) continue;
      const part = actor.sprite?.imgcut?.parts?.[partIndex];
      if (!part || part.w <= 0 || part.h <= 0) continue;

      c.save();
      c.translate(w.x * actor.scale, w.y * actor.scale);
      c.rotate((w.a / baseAngle) * Math.PI * 2);
      c.globalAlpha = w.o ?? 1;
      const sx = w.sx * actor.scale;
      const sy = w.sy * actor.scale;
      actor.sprite.drawPart(c, partIndex, -part.w * 0.5 * sx, -part.h * 0.5 * sy, { scaleX: sx, scaleY: sy });
      c.restore();
    }

    c.restore();
  }
}
