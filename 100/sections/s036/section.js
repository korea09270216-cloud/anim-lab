export default function init(root, ctx) {
  const cards = [...root.querySelectorAll('.s036__card')].map((el, i) => ({
    el, i, rx: 0, ry: 0, px: 50, py: 50, lift: 0, trx: 0, try_: 0, tpx: 50, tpy: 50, tl: 0
  }));
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y;
  const t0 = performance.now();
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now(), t = (now - t0) / 1000;
    if (Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly) > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    const real = now - lastMove < 2200;
    for (const c of cards) {
      const r = c.el.getBoundingClientRect();
      let nx, ny, hover;
      if (real) {
        const dx = ctx.mouse.x - (r.left + r.width / 2), dy = ctx.mouse.y - (r.top + r.height / 2);
        hover = dx > -r.width / 2 && dx < r.width / 2 && dy > -r.height / 2 && dy < r.height / 2;
        nx = gsap.utils.clamp(-1, 1, dx / (r.width * (hover ? .5 : 1.6)));
        ny = gsap.utils.clamp(-1, 1, dy / (r.height * (hover ? .5 : 1.6)));
        c.tl = hover ? 1 : .22;
      } else {
        nx = Math.sin(t * .9 + c.i * 1.7) * .9; ny = Math.cos(t * .7 + c.i * 2.3) * .8; c.tl = .55 + .3 * Math.sin(t * .8 + c.i);
      }
      c.trx = -ny * 20; c.try_ = nx * 24; c.tpx = 50 + nx * 50; c.tpy = 50 + ny * 50;
      const k = .09;
      c.rx += (c.trx - c.rx) * k; c.ry += (c.try_ - c.ry) * k; c.px += (c.tpx - c.px) * .12; c.py += (c.tpy - c.py) * .12; c.lift += (c.tl - c.lift) * .08;
      const s = c.el.style;
      s.setProperty('--rx', c.rx.toFixed(2) + 'deg'); s.setProperty('--ry', c.ry.toFixed(2) + 'deg');
      s.setProperty('--px', c.px.toFixed(1) + '%'); s.setProperty('--py', c.py.toFixed(1) + '%'); s.setProperty('--lift', c.lift.toFixed(3));
    }
  });
  return () => { off(); io.disconnect(); };
}
