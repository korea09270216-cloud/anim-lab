export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d'), cnt = root.querySelector('[data-count]');
  if (!g || !window.Matter) return;
  const { Engine, Bodies, Body, Composite } = Matter;
  const engine = Engine.create({ gravity: { x: 0, y: 1.2 } });
  const TOTAL = 60, chars = ['밥', '국', '김', '전', '찜', '탕', '면', '쌈', '장', '나물', '구이', '조림'];
  const pal = [['#fffaf0', '#1d1a14'], ['#e63b1f', '#fffaf0'], ['#1d1a14', '#ffd23f'], ['#2f8f5b', '#fffaf0'], ['#ff8a3d', '#1d1a14'], ['#f6e3c0', '#1d1a14']];
  let W = 0, H = 0, vis = true, walls = [], items = [], prog = 0, seed = 0, shown = 0, px = 0, py = 0;
  function fit() {
    const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height);
    Composite.remove(engine.world, walls);
    walls = [Bodies.rectangle(W / 2, H + 40, W * 3, 100, { isStatic: true }), Bodies.rectangle(-40, H / 2, 100, H * 4, { isStatic: true }), Bodies.rectangle(W + 40, H / 2, 100, H * 4, { isStatic: true })];
    Composite.add(engine.world, walls);
  }
  function spawn() {
    const k = seed++, c = pal[(k * 5 + (k >> 1)) % pal.length], ch = chars[k % chars.length], s = Math.max(46, Math.min(86, W * .052)) * (.85 + (k * 37 % 10) / 28), type = k % 3;
    const x = W * (.1 + Math.random() * .8), y = -s;
    const opt = { restitution: .3, friction: .35, frictionAir: .003, density: .0012 };
    const b = type === 0 ? Bodies.circle(x, y, s / 2, opt) : type === 1 ? Bodies.rectangle(x, y, s, s, { ...opt, chamfer: { radius: s * .24 } }) : Bodies.rectangle(x, y, s * 1.5, s * .8, { ...opt, chamfer: { radius: s * .4 } });
    Body.setAngle(b, Math.random() * 3); Body.setAngularVelocity(b, (Math.random() - .5) * .15);
    items.push({ b, c, ch, s, type }); Composite.add(engine.world, b);
  }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { prog = s.progress; } });
  let idleT = 0;
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const target = Math.min(TOTAL, Math.round(prog * (TOTAL + 4)));
    let guard = 0;
    while (items.length < target && guard++ < 2) spawn();
    guard = 0;
    while (items.length > target && guard++ < 2) { const o = items.pop(); Composite.remove(engine.world, o.b); }
    idleT += dt || 16.7; if (idleT > 1400 && items.length < 10) { idleT = 0; spawn(); }
    const r = cv.getBoundingClientRect(), mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top, sp = Math.min(60, Math.hypot(mx - px, my - py)); px = mx; py = my;
    const R = Math.max(110, W * .08);
    if (ctx.fine) for (const it of items) { const b = it.b, dx = b.position.x - mx, dy = b.position.y - my, d = Math.hypot(dx, dy); if (d < R) { const f = (1 - d / R) * b.mass * (.003 + sp * .0001); Body.applyForce(b, b.position, { x: dx / (d || 1) * f, y: dy / (d || 1) * f - f * .3 }); } }
    Engine.update(engine, Math.min(33, dt || 16.7));
    if (items.length !== shown) { shown = items.length; cnt.textContent = String(shown).padStart(2, '0'); }
    g.clearRect(0, 0, W, H);
    for (const it of items) {
      const { b, c, ch, s, type } = it; g.save(); g.translate(b.position.x, b.position.y); g.rotate(b.angle);
      g.beginPath(); if (type === 0) g.arc(0, 0, s / 2, 0, 6.283); else if (type === 1) g.roundRect(-s / 2, -s / 2, s, s, s * .24); else g.roundRect(-s * .75, -s * .4, s * 1.5, s * .8, s * .4);
      g.fillStyle = c[0]; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#1d1a14'; g.stroke();
      g.fillStyle = c[1]; g.font = `900 ${s * .44}px Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, 1); g.restore();
    }
  });
  return () => { off(); st.kill(); io.disconnect(); ro.disconnect(); Composite.clear(engine.world, false); Engine.clear(engine); };
}
