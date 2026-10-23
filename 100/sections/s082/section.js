export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  if (!g) return;
  let W = 0, H = 0, vis = true, t = 0;
  const N = 240, TR = 9, bs = [];
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.283, x = Math.random() * W, y = Math.random() * H;
    bs.push({ x, y, vx: Math.cos(a) * 2, vy: Math.sin(a) * 2, o: Math.random() < .12, h: Array.from({ length: TR }, () => [x, y]) });
  }
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .008 * k;
    const r = cv.getBoundingClientRect(), mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top;
    const ax = W * (.62 + Math.sin(t * 1.3) * .3), ay = H * (.42 + Math.sin(t * 1.9 + 1) * .28);
    const VR = 70, SR = 26, MR = Math.max(140, W * .11), MAXV = 3.6 * Math.max(.7, W / 1440);
    g.clearRect(0, 0, W, H);
    for (let i = 0; i < N; i++) {
      const b = bs[i]; let sx = 0, sy = 0, avx = 0, avy = 0, cx = 0, cy = 0, n = 0;
      for (let j = 0; j < N; j++) {
        if (j === i) continue; const o = bs[j], dx = o.x - b.x, dy = o.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < VR * VR) { n++; avx += o.vx; avy += o.vy; cx += o.x; cy += o.y; if (d2 < SR * SR) { sx -= dx; sy -= dy; } }
      }
      if (n) { b.vx += ((avx / n - b.vx) * .06 + (cx / n - b.x) * .0016 + sx * .012) * k; b.vy += ((avy / n - b.vy) * .06 + (cy / n - b.y) * .0016 + sy * .012) * k; }
      b.vx += (ax - b.x) * .00012 * k; b.vy += (ay - b.y) * .00012 * k;
      const dx = b.x - mx, dy = b.y - my, d = Math.hypot(dx, dy);
      if (d < MR && ctx.fine) { const f = (1 - d / MR) ** 1.5 * 1.1 * k; b.vx += dx / d * f; b.vy += dy / d * f; }
      const m = 80; if (b.x < m) b.vx += .12 * k; if (b.x > W - m) b.vx -= .12 * k; if (b.y < m) b.vy += .12 * k; if (b.y > H - m) b.vy -= .12 * k;
      const sp = Math.hypot(b.vx, b.vy) || 1, lim = d < MR ? MAXV * 1.9 : MAXV;
      if (sp > lim) { b.vx *= lim / sp; b.vy *= lim / sp; } else if (sp < 1.6) { b.vx *= 1.6 / sp; b.vy *= 1.6 / sp; }
      b.x += b.vx * k; b.y += b.vy * k;
      b.h.pop(); b.h.unshift([b.x, b.y]);
    }
    g.lineCap = 'round';
    for (const b of bs) {
      g.strokeStyle = b.o ? 'rgba(245,124,31,.35)' : 'rgba(12,58,53,.22)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(b.h[0][0], b.h[0][1]); for (let i = 1; i < TR; i++) g.lineTo(b.h[i][0], b.h[i][1]); g.stroke();
      const a = Math.atan2(b.vy, b.vx), s = b.o ? 9 : 7.5;
      g.save(); g.translate(b.x, b.y); g.rotate(a); g.fillStyle = b.o ? '#f57c1f' : '#0c3a35';
      g.beginPath(); g.moveTo(s * 1.5, 0); g.lineTo(-s, s * .62); g.lineTo(-s * .45, 0); g.lineTo(-s, -s * .62); g.closePath(); g.fill(); g.restore();
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
