export default function init(root, ctx) {
  const lines = [...root.querySelectorAll('[data-split]')].map(l => {
    const t = l.textContent; l.textContent = '';
    const cs = [...t].map(c => { const s = document.createElement('span'); s.className = 's020__ch'; s.textContent = c === ' ' ? ' ' : c; l.appendChild(s); return { el: s, y: 0, v: 0, cx: 0, cy: 0 }; });
    return { cs };
  });
  const measure = () => {
    const rr = root.getBoundingClientRect();
    lines.forEach(L => L.cs.forEach(c => { c.el.style.transform = 'none'; const r = c.el.getBoundingClientRect(); c.cx = r.left - rr.left + r.width / 2; c.cy = r.top - rr.top + r.height / 2; }));
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(root);
  document.fonts && document.fonts.ready.then(measure);
  let ptr = { x: ctx.mouse.x, y: ctx.mouse.y }, lx = ctx.mouse.x, ly = ctx.mouse.y, last = performance.now(), visible = true, lt = 0;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const off = ctx.tick((time) => {
    const dt = Math.min(.033, time - lt); lt = time;
    if (!visible || dt <= 0) return;
    const now = performance.now(), rr = root.getBoundingClientRect();
    if (ctx.mouse.x !== lx || ctx.mouse.y !== ly) { lx = ctx.mouse.x; ly = ctx.mouse.y; last = now; }
    let tx, ty;
    if (now - last > 1500) { tx = rr.left + rr.width * (.5 + .45 * Math.sin(time * .75)); ty = rr.top + rr.height * (.5 + .22 * Math.sin(time * 1.9)); }
    else { tx = ctx.mouse.x; ty = ctx.mouse.y; }
    const nx = ptr.x + (tx - ptr.x) * .3, ny = ptr.y + (ty - ptr.y) * .3;
    const speed = Math.hypot(nx - ptr.x, ny - ptr.y); ptr.x = nx; ptr.y = ny;
    const px = ptr.x - rr.left, py = ptr.y - rr.top, Rx = Math.max(120, rr.width * .1), Ry = Math.max(260, rr.height * .55);
    lines.forEach(L => {
      const cs = L.cs, n = cs.length;
      for (let sub = 0; sub < 2; sub++) { // 서브스텝으로 안정화
        const h = dt / 2;
        cs.forEach((c, i) => {
          const dx = c.cx - px, dy = py - (c.cy + c.y);
          const g = Math.exp(-(dx * dx) / (Rx * Rx)) * Math.exp(-(dy * dy) / (Ry * Ry));
          // 커서가 지나간 궤적이 변위로 주입되고 이웃 결합으로 파동이 번진다
          let a = -c.y * 120 - c.v * 7 + g * dy * (140 + speed * 9);
          const l = cs[i - 1] ? cs[i - 1].y : c.y, r = cs[i + 1] ? cs[i + 1].y : c.y;
          a += (l + r - 2 * c.y) * 900;
          c.v += a * h;
        });
        cs.forEach(c => { c.y += c.v * h; });
      }
      cs.forEach((c, i) => {
        const rot = Math.max(-25, Math.min(25, c.v * .05));
        c.el.style.transform = `translateY(${c.y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scaleY(${(1 + Math.min(.35, Math.abs(c.v) * .0007)).toFixed(3)})`;
      });
    });
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
