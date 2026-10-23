export default function init(root, ctx) {
  const p = root.querySelector('.s016__text');
  const txt = p.textContent; p.textContent = '';
  const chars = [];
  txt.split(' ').forEach((w, wi, arr) => {
    const ws = document.createElement('span'); ws.className = 's016__w';
    [...w].forEach(c => { const s = document.createElement('span'); s.className = 's016__ch'; s.textContent = c; ws.appendChild(s); chars.push({ el: s, x: 0, y: 0, vx: 0, vy: 0, r: 0, vr: 0, cx: 0, cy: 0 }); });
    p.appendChild(ws); if (wi < arr.length - 1) p.appendChild(document.createTextNode(' '));
  });
  const measure = () => {
    chars.forEach(c => { c.el.style.transform = 'none'; });
    const rr = root.getBoundingClientRect();
    chars.forEach(c => { const r = c.el.getBoundingClientRect(); c.cx = r.left - rr.left + r.width / 2; c.cy = r.top - rr.top + r.height / 2; });
  };
  measure();
  const ro = new ResizeObserver(measure); ro.observe(root);
  document.fonts && document.fonts.ready.then(measure);
  const base = [241, 232, 216], hot = [255, 138, 61];
  let ptr = { x: ctx.mouse.x, y: ctx.mouse.y, vx: 0, vy: 0 }, lx = ctx.mouse.x, ly = ctx.mouse.y, last = performance.now(), visible = true, lt = 0;
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);
  const off = ctx.tick((time) => {
    const dt = Math.min(.033, time - lt); lt = time;
    if (!visible || dt <= 0) return;
    const now = performance.now(), rr = root.getBoundingClientRect();
    if (ctx.mouse.x !== lx || ctx.mouse.y !== ly) { lx = ctx.mouse.x; ly = ctx.mouse.y; last = now; }
    let tx, ty;
    if (now - last > 1600) { tx = rr.left + rr.width * (.5 + .4 * Math.sin(time * .6)); ty = rr.top + rr.height * (.5 + .16 * Math.sin(time * 1.1)); }
    else { tx = ctx.mouse.x; ty = ctx.mouse.y; }
    ptr.vx = (tx - ptr.x); ptr.vy = (ty - ptr.y); ptr.x += ptr.vx * .22; ptr.y += ptr.vy * .22;
    const px = ptr.x - rr.left, py = ptr.y - rr.top, R = Math.max(130, rr.width * .13), sp = Math.min(60, Math.hypot(ptr.vx, ptr.vy));
    chars.forEach(c => {
      const dx = c.cx + c.x - px, dy = c.cy + c.y - py, d = Math.hypot(dx, dy) || 1;
      let ax = -c.x * 85 - c.vx * 9, ay = -c.y * 85 - c.vy * 9, ar = -c.r * 70 - c.vr * 7;
      if (d < R) { const f = Math.pow(1 - d / R, 2); ax += dx / d * f * 14000; ay += dy / d * f * 14000; ar += (dx / d) * f * 2200 * (1 + sp * .04); }
      c.vx += ax * dt; c.vy += ay * dt; c.vr += ar * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt;
      const m = Math.min(1, Math.hypot(c.x, c.y) / 90);
      c.el.style.transform = `translate(${c.x.toFixed(1)}px,${c.y.toFixed(1)}px) rotate(${c.r.toFixed(1)}deg)`;
      c.el.style.color = m < .02 ? '' : `rgb(${base.map((b, i) => Math.round(b + (hot[i] - b) * m)).join(',')})`;
    });
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
