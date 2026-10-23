export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  let W = 0, H = 0, vis = true, t = 0, cx = 0, cy = 0, C = 0, R = 0, gx = [], gy = [];
  const GAP = 38;
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); C = Math.ceil(W / GAP) + 2; R = Math.ceil(H / GAP) + 2; gx = new Float32Array(C * R); gy = new Float32Array(C * R); if (!cx) { cx = W * .7; cy = H * .4; } }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .012 * k;
    const r = cv.getBoundingClientRect(); let tx = ctx.mouse.x - r.left, ty = ctx.mouse.y - r.top;
    if (!ctx.fine || tx < 0 || ty < 0 || tx > W || ty > H) { tx = W * (.5 + Math.sin(t * .7) * .3); ty = H * (.45 + Math.cos(t * .9) * .25); }
    cx += (tx - cx) * .09 * k; cy += (ty - cy) * .09 * k;
    const m2x = W * .5 + Math.cos(t * 1.1 + 2) * W * .34, m2y = H * .5 + Math.sin(t * 1.5) * H * .3;
    const L1 = Math.max(190, W * .16), L2 = L1 * .55;
    for (let j = 0; j < R; j++) for (let i = 0; i < C; i++) {
      const x = i * GAP - GAP * .5, y = j * GAP - GAP * .5; let dx = 0, dy = 0;
      let ax = cx - x, ay = cy - y, d2 = ax * ax + ay * ay, f = L1 * L1 / (d2 + L1 * L1 * .55) * .62; f = Math.min(f, .93); dx += ax * f; dy += ay * f;
      ax = m2x - x; ay = m2y - y; d2 = ax * ax + ay * ay; f = Math.min(L2 * L2 / (d2 + L2 * L2 * .55) * .5, .9); dx += ax * f * .6; dy += ay * f * .6;
      gx[j * C + i] = x + dx * (L1 * L1 / (L1 * L1 + 4 * ((x - cx) ** 2 + (y - cy) ** 2) / 9)); gy[j * C + i] = y + dy * (L1 * L1 / (L1 * L1 + 4 * ((x - cx) ** 2 + (y - cy) ** 2) / 9));
    }
    g.clearRect(0, 0, W, H);
    g.lineWidth = 1; g.strokeStyle = 'rgba(20,19,15,.55)'; g.beginPath();
    for (let j = 0; j < R; j++) { g.moveTo(gx[j * C], gy[j * C]); for (let i = 1; i < C; i++) g.lineTo(gx[j * C + i], gy[j * C + i]); }
    for (let i = 0; i < C; i++) { g.moveTo(gx[i], gy[i]); for (let j = 1; j < R; j++) g.lineTo(gx[j * C + i], gy[j * C + i]); }
    g.stroke();
    g.fillStyle = '#e5471f';
    for (let j = 0; j < R; j += 1) for (let i = 0; i < C; i += 1) {
      const x = i * GAP - GAP * .5, y = j * GAP - GAP * .5, dd = Math.hypot(gx[j * C + i] - x, gy[j * C + i] - y);
      if (dd > 14) { g.globalAlpha = Math.min(1, dd / 90); g.beginPath(); g.arc(gx[j * C + i], gy[j * C + i], 1.6 + Math.min(2.4, dd / 50), 0, 6.283); g.fill(); }
    }
    g.globalAlpha = 1;
    g.fillStyle = '#14130f'; g.beginPath(); g.arc(cx, cy, 5, 0, 6.283); g.fill(); g.beginPath(); g.arc(m2x, m2y, 3, 0, 6.283); g.fill();
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
