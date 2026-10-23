export default function init(root, ctx) {
  const { Engine, Bodies, Body, Composite } = Matter;
  const holder = root.querySelector('.s015__tiles');
  const engine = Engine.create({ gravity: { y: 1.5 } });
  const chars = [...'달달상회OPEN오늘도열었습니다'];
  const palette = [['#151515', '#ffd23f'], ['#ff4a1c', '#fff'], ['#fff', '#151515'], ['#2438ff', '#fff'], ['#151515', '#fff']];
  const items = []; // {body, el}
  let W = root.offsetWidth, H = root.offsetHeight, S = 100;
  let walls = [];
  const buildWalls = () => {
    walls.forEach(w => Composite.remove(engine.world, w));
    const t = 200;
    walls = [Bodies.rectangle(W / 2, H + t / 2 - 6, W * 3, t, { isStatic: true }), Bodies.rectangle(-t / 2, H / 2 - 400, t, H * 3, { isStatic: true }), Bodies.rectangle(W + t / 2, H / 2 - 400, t, H * 3, { isStatic: true })];
    Composite.add(engine.world, walls);
  };
  const size = () => { W = root.offsetWidth; H = root.offsetHeight; S = Math.max(64, Math.min(150, W * .085)); buildWalls(); };
  size();
  const ro = new ResizeObserver(size); ro.observe(root);
  let n = 0;
  const spawn = () => {
    const c = chars[n % chars.length], p = palette[n % palette.length]; n++;
    const el = document.createElement('div'); el.className = 's015__tile'; el.textContent = c;
    el.style.width = el.style.height = S + 'px'; el.style.fontSize = S * .58 + 'px'; el.style.background = p[0]; el.style.color = p[1];
    holder.appendChild(el);
    const body = Bodies.rectangle(S * .6 + Math.random() * (W - S * 1.2), -S, S, S, { chamfer: { radius: S * .2 }, restitution: .45, friction: .25, frictionAir: .004, angle: (Math.random() - .5) * 1.2 });
    Body.setAngularVelocity(body, (Math.random() - .5) * .2);
    Composite.add(engine.world, body);
    items.push({ body, el, s: S });
  };
  let visible = false, started = false, spawnTimer = null, shakeTimer = null;
  const startDrop = () => {
    started = true; let k = 0;
    spawnTimer = setInterval(() => { if (!visible) return; spawn(); if (++k >= 22) { clearInterval(spawnTimer); spawnTimer = null; } }, 230);
    // 가끔 바닥을 쳐서 쌓인 글자가 다시 튀어오른다
    shakeTimer = setInterval(() => {
      if (!visible || items.length < 10) return;
      items.forEach(it => Body.applyForce(it.body, it.body.position, { x: (Math.random() - .5) * .04 * it.body.mass, y: -(.05 + Math.random() * .05) * it.body.mass }));
    }, 6500);
  };
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; if (visible && !started) startDrop(); }); io.observe(root);
  let ptr = { x: ctx.mouse.x, y: ctx.mouse.y, vx: 0, vy: 0 }, lx = ctx.mouse.x, ly = ctx.mouse.y, last = performance.now();
  const off = ctx.tick((time, dtms) => {
    if (!visible) return;
    const now = performance.now(), rr = root.getBoundingClientRect();
    if (ctx.mouse.x !== lx || ctx.mouse.y !== ly) { lx = ctx.mouse.x; ly = ctx.mouse.y; last = now; }
    let tx, ty;
    if (now - last > 1800) { tx = rr.left + rr.width * (.5 + .45 * Math.sin(time * .5)); ty = rr.top + rr.height * (.8 + .1 * Math.sin(time * 1.3)); }
    else { tx = ctx.mouse.x; ty = ctx.mouse.y; }
    const nx = ptr.x + (tx - ptr.x) * .2, ny = ptr.y + (ty - ptr.y) * .2;
    ptr.vx = nx - ptr.x; ptr.vy = ny - ptr.y; ptr.x = nx; ptr.y = ny;
    const px = ptr.x - rr.left, py = ptr.y - rr.top, R = Math.max(110, W * .1);
    items.forEach(it => {
      const b = it.body, dx = b.position.x - px, dy = b.position.y - py, d = Math.hypot(dx, dy);
      if (d < R + it.s * .5) {
        const f = (1 - d / (R + it.s * .5));
        const k = b.mass * (.012 * f + .0018 * Math.min(40, Math.hypot(ptr.vx, ptr.vy)) * f);
        Body.applyForce(b, b.position, { x: (dx / (d || 1)) * k + ptr.vx * b.mass * .0009 * f, y: (dy / (d || 1)) * k - .006 * b.mass * f + ptr.vy * b.mass * .0009 * f });
      }
    });
    Engine.update(engine, 1000 / 60);
    items.forEach(it => { const p = it.body.position; it.el.style.transform = `translate(${(p.x - it.s / 2).toFixed(1)}px,${(p.y - it.s / 2).toFixed(1)}px) rotate(${it.body.angle.toFixed(3)}rad)`; });
  });
  const click = e => { const r = root.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top; items.forEach(it => { const dx = it.body.position.x - x, dy = it.body.position.y - y, d = Math.hypot(dx, dy) || 1; if (d < 400) Body.applyForce(it.body, it.body.position, { x: dx / d * .05 * it.body.mass, y: dy / d * .05 * it.body.mass - .03 * it.body.mass }); }); };
  root.addEventListener('pointerdown', click);
  return () => { off(); io.disconnect(); ro.disconnect(); clearInterval(spawnTimer); clearInterval(shakeTimer); root.removeEventListener('pointerdown', click); Composite.clear(engine.world, false); Engine.clear(engine); };
}
