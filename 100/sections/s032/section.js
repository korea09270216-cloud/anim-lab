export default function init(root, ctx) {
  const field = root.querySelector('.s032__field');
  const chips = [...root.querySelectorAll('.s032__chip')].map((el, i) => ({
    el, x: 0, y: 0, vx: 0, vy: 0, s: 1, vs: 0, r: 0, vr: 0,
    intro: 1, mass: .6 + (i * 37 % 10) / 14, w: el.offsetWidth
  }));
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y;
  const t0 = performance.now();
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const R = 340;
  function tick() {
    if (!visible) return;
    const now = performance.now(), rect = field.getBoundingClientRect();
    if (Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly) > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let mx, my;
    if (now - lastMove < 2000) { mx = ctx.mouse.x - rect.left; my = ctx.mouse.y - rect.top; }
    else { const t = (now - t0) / 1000; mx = rect.width * (.5 + .38 * Math.sin(t * .55)); my = rect.height * (.5 + .32 * Math.sin(t * .83 + 2)); }
    for (const c of chips) {
      const cx = c.el.offsetLeft + c.w / 2 + c.x, cy = c.el.offsetTop + c.w / 2 + c.y;
      const hx = c.el.offsetLeft + c.w / 2, hy = c.el.offsetTop + c.w / 2;
      const dx = mx - hx, dy = my - hy, d = Math.hypot(dx, dy) || 1;
      const f = Math.max(0, 1 - d / R);
      const pull = f * f * (d - c.w * .35 > 0 ? Math.min(d - c.w * .35, 260) : 0) * (.55 / c.mass);
      const tx = dx / d * pull, ty = dy / d * pull;
      c.vx += (tx - c.x) * .09 / c.mass; c.vy += (ty - c.y) * .09 / c.mass;
      c.vx *= .82; c.vy *= .82; c.x += c.vx; c.y += c.vy;
      const ts = 1 + f * f * .55, tr = (tx / 260) * 26;
      c.vs += (ts - c.s) * .12; c.vs *= .8; c.s += c.vs;
      c.vr += (tr - c.r) * .1; c.vr *= .8; c.r += c.vr;
      c.el.style.transform = `translate3d(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px,0) rotate(${c.r.toFixed(1)}deg) scale(${(c.s * c.intro).toFixed(3)})`;
      c.el.style.zIndex = Math.round(f * 10);
    }
  }
  const off = ctx.tick(tick);
  gsap.from(chips, { intro: 0, duration: 1.3, ease: 'elastic.out(1,.55)', stagger: { each: .07, from: 'center' }, scrollTrigger: { trigger: root, start: 'top 70%' } });
  return () => { off(); io.disconnect(); };
}
