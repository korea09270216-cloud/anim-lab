export default function init(root, ctx) {
  const arena = root.querySelector('.s040__arena');
  const walls = { l: root.querySelector('.s040__wall--l'), r: root.querySelector('.s040__wall--r'), t: root.querySelector('.s040__wall--t'), b: root.querySelector('.s040__wall--b') };
  let W = arena.clientWidth, H = arena.clientHeight;
  const balls = [...arena.querySelectorAll('.s040__ball')].map((el, i) => {
    const d = el.offsetWidth, r = d / 2;
    const a = i * 2.399 + 1, sp = 140 + (i * 53 % 180);
    return { el, r, m: r * r, x: W * (.1 + ((i * 0.37) % .8)), y: H * (.12 + ((i * 0.53) % .72)), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, sx: 1, sy: 1, svx: 0, svy: 0, held: false, last: null };
  });
  InertiaPlugin.track(balls.map(b => b.el), 'x,y');
  const flash = k => gsap.fromTo(walls[k], { opacity: .85 }, { opacity: 0, duration: .7, ease: 'expo.out', overwrite: true });

  const drags = balls.map(b => Draggable.create(b.el, {
    type: 'x,y', bounds: arena, zIndexBoost: true, allowContextMenu: true,
    onPress() { b.held = true; b.vx = b.vy = 0; b.last = null; },
    onDrag() { b.x = this.x; b.y = this.y; },
    onRelease() {
      let vx = InertiaPlugin.getVelocity(b.el, 'x'), vy = InertiaPlugin.getVelocity(b.el, 'y');
      if (!isFinite(vx) || !isFinite(vy)) { vx = vy = 0; }
      const s = Math.hypot(vx, vy), cap = 2600; if (s > cap) { vx *= cap / s; vy *= cap / s; }
      b.vx = vx; b.vy = vy; b.x = this.x; b.y = this.y; b.held = false;
    }
  })[0]);

  let visible = true;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const ro = new ResizeObserver(() => { W = arena.clientWidth; H = arena.clientHeight; drags.forEach(d => d.applyBounds(arena)); }); ro.observe(arena);

  const off = ctx.tick((time, dtms) => {
    if (!visible) return;
    const dt = Math.min(.033, (dtms || 16) / 1000), drag = Math.pow(.42, dt);
    for (const b of balls) {
      if (!b.held) {
        b.x += b.vx * dt; b.y += b.vy * dt;
        const sp = Math.hypot(b.vx, b.vy);
        if (sp > 60) { b.vx *= drag > .99 ? 1 : Math.pow(.62, dt); b.vy *= Math.pow(.62, dt); }
        const sp2 = Math.hypot(b.vx, b.vy);
        if (sp2 < 70) { const k = 70 / (sp2 || 1); b.vx = (b.vx || (Math.random() - .5)) * k; b.vy = (b.vy || (Math.random() - .5)) * k; }
        const d = b.r * 2, R = .86;
        if (b.x < 0) { b.x = 0; b.vx = Math.abs(b.vx) * R; b.svx = Math.min(.32, Math.abs(b.vx) / 2600 + .06); flash('l'); }
        else if (b.x > W - d) { b.x = W - d; b.vx = -Math.abs(b.vx) * R; b.svx = Math.min(.32, Math.abs(b.vx) / 2600 + .06); flash('r'); }
        if (b.y < 0) { b.y = 0; b.vy = Math.abs(b.vy) * R; b.svy = Math.min(.32, Math.abs(b.vy) / 2600 + .06); flash('t'); }
        else if (b.y > H - d) { b.y = H - d; b.vy = -Math.abs(b.vy) * R; b.svy = Math.min(.32, Math.abs(b.vy) / 2600 + .06); flash('b'); }
      }
    }
    for (let i = 0; i < balls.length; i++) for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i], c = balls[j];
      const dx = (c.x + c.r) - (a.x + a.r), dy = (c.y + c.r) - (a.y + a.r), dist = Math.hypot(dx, dy), min = a.r + c.r;
      if (dist >= min || !dist) continue;
      const nx = dx / dist, ny = dy / dist, over = min - dist;
      const ma = a.held ? 1e9 : a.m, mc = c.held ? 1e9 : c.m, tot = ma + mc;
      if (!a.held) { a.x -= nx * over * (mc / tot); a.y -= ny * over * (mc / tot); }
      if (!c.held) { c.x += nx * over * (ma / tot); c.y += ny * over * (ma / tot); }
      const rv = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rv < 0) {
        const jn = -(1 + .9) * rv / (1 / ma + 1 / mc);
        if (!a.held) { a.vx -= jn / ma * nx; a.vy -= jn / ma * ny; }
        if (!c.held) { c.vx += jn / mc * nx; c.vy += jn / mc * ny; }
        const sq = Math.min(.22, -rv / 3000 + .04); a.svx = Math.max(a.svx, sq * Math.abs(nx)); a.svy = Math.max(a.svy, sq * Math.abs(ny)); c.svx = Math.max(c.svx, sq * Math.abs(nx)); c.svy = Math.max(c.svy, sq * Math.abs(ny));
      }
    }
    for (const b of balls) {
      b.sx += (1 - b.svx - b.sx) * .35; b.sy += (1 - b.svy - b.sy) * .35; b.svx *= .82; b.svy *= .82;
      if (!b.held) gsap.set(b.el, { x: b.x, y: b.y, scaleX: 1 + (1 - b.sy) * .6 - (1 - b.sx) * .6, scaleY: 1 + (1 - b.sx) * .6 - (1 - b.sy) * .6 });
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); drags.forEach(d => d.kill()); };
}
