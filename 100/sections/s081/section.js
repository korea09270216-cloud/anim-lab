export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  if (!g || !window.Matter) return;
  const { Engine, Bodies, Body, Composite } = Matter;
  const engine = Engine.create({ gravity: { x: 0, y: 1.15 } });
  const words = ['소금빵', '크루아상', '단팥빵', '얼그레이 스콘', '바닐라 푸딩', '휘낭시에', '마들렌', '크림치즈 베이글', '에그타르트', '앙버터', '깜빠뉴', 'NEW', '오늘의 빵', '버터바', '쑥 카스텔라'];
  const pal = [['#e8552d', '#fff6e8'], ['#2a1d12', '#f3e8d4'], ['#f3b63f', '#2a1d12'], ['#6f9560', '#fff6e8'], ['#fffaf0', '#2a1d12'], ['#d9a98b', '#2a1d12']];
  let W = 0, H = 0, walls = [], items = [], vis = true, last = 0, spawnT = 0, mp = { x: -999, y: -999, vx: 0, vy: 0 }, seed = 0;
  const MAX = 38;
  function fit() {
    const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height);
    Composite.remove(engine.world, walls);
    walls = [Bodies.rectangle(W / 2, H + 40, W * 3, 100, { isStatic: true }), Bodies.rectangle(-40, H / 2, 100, H * 4, { isStatic: true }), Bodies.rectangle(W + 40, H / 2, 100, H * 4, { isStatic: true })];
    Composite.add(engine.world, walls);
  }
  function spawn() {
    const k = seed++, w = words[k % words.length], c = pal[(k * 7 + (k >> 2)) % pal.length];
    const fs = Math.max(18, Math.min(34, W * .022));
    g.font = `800 ${fs}px Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    const bw = g.measureText(w).width + fs * 1.5, bh = fs * 2.1;
    const b = Bodies.rectangle(W * (.12 + Math.random() * .76), -bh, bw, bh, { chamfer: { radius: bh / 2 - 1 }, restitution: .35, friction: .3, frictionAir: .004, density: .0012 });
    Body.setAngle(b, (Math.random() - .5) * 1.2); Body.setAngularVelocity(b, (Math.random() - .5) * .08);
    items.push({ b, w, bw, bh, fs, c }); Composite.add(engine.world, b);
  }
  function onMove(e) { mp.x = e.clientX; mp.y = e.clientY; }
  root.addEventListener('pointermove', onMove);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  let px = 0, py = 0;
  const off = ctx.tick((t, dt) => {
    if (!vis) return;
    const r = cv.getBoundingClientRect(), mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top;
    const sp = Math.min(60, Math.hypot(mx - px, my - py)); px = mx; py = my;
    spawnT += dt / 1000; if (spawnT > (ctx.reduced ? .9 : .38)) { spawnT = 0; if (items.length >= MAX) { const o = items.shift(); Composite.remove(engine.world, o.b); } spawn(); }
    const R = Math.max(120, W * .1);
    for (const it of items) {
      const b = it.b, dx = b.position.x - mx, dy = b.position.y - my, d = Math.hypot(dx, dy);
      if (d < R && ctx.fine) { const f = (1 - d / R) * b.mass * (.0035 + sp * .00012); Body.applyForce(b, b.position, { x: dx / (d || 1) * f, y: dy / (d || 1) * f - f * .35 }); }
    }
    Engine.update(engine, Math.min(33, dt || 16.7));
    g.clearRect(0, 0, W, H);
    for (const it of items) {
      const { b, bw, bh, fs, w, c } = it;
      g.save(); g.translate(b.position.x, b.position.y); g.rotate(b.angle);
      g.beginPath(); g.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); g.fillStyle = c[0]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#2a1d12'; g.stroke();
      g.fillStyle = c[1]; g.font = `800 ${fs}px Pretendard,'Apple SD Gothic Neo','Malgun Gothic',sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(w, 0, 1);
      g.restore();
    }
  });
  for (let i = 0; i < 6; i++) spawn();
  return () => { off(); io.disconnect(); ro.disconnect(); root.removeEventListener('pointermove', onMove); Composite.clear(engine.world, false); Engine.clear(engine); };
}
