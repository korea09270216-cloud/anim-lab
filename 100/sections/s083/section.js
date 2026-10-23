export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  const P = new Uint8Array(512); for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const sm = t => t * t * (3 - 2 * t), lp = (a, b, t) => a + (b - a) * t;
  const h = (x, y) => P[P[x & 255] + (y & 255)] / 255;
  const noise = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi); return lp(lp(h(xi, yi), h(xi + 1, yi), xf), lp(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf); };
  let W = 0, H = 0, vis = true, t = 0, ps = [];
  const N = 900, S = .6, BG = '13,42,33';
  const cols = ['239,230,207', '217,180,90', '124,184,150', '239,230,207'];
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width * S); H = cv.height = Math.round(r.height * S); g.fillStyle = `rgb(${BG})`; g.fillRect(0, 0, W, H); }
  const reset = p => { p.x = Math.random() * W; p.y = Math.random() * H; p.life = 60 + Math.random() * 140; };
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  for (let i = 0; i < N; i++) { const p = { c: cols[i % 4] }; reset(p); ps.push(p); }
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  let fr = 0;
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .0016 * k; fr++;
    const r = cv.getBoundingClientRect(), mx = (ctx.mouse.x - r.left) * S, my = (ctx.mouse.y - r.top) * S;
    const MR = Math.max(140, W * .15);
    g.fillStyle = `rgba(${BG},${fr % 4 ? .028 : .09})`; g.fillRect(0, 0, W, H);
    g.lineWidth = 1.1; g.lineCap = 'round';
    for (let ci = 0; ci < 4; ci++) {
      g.strokeStyle = `rgba(${cols[ci]},.5)`; g.beginPath();
      for (let i = ci; i < ps.length; i += 4) {
        const p = ps[i]; let a = noise(p.x * .0021 + t, p.y * .0021 - t * .6) * 12.566;
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < MR && ctx.fine) { const f = (1 - d / MR) ** 2; a += (Math.atan2(dy, dx) + 1.57 - a) * f; }
        const nx = p.x + Math.cos(a) * 1.8 * k, ny = p.y + Math.sin(a) * 1.8 * k;
        g.moveTo(p.x, p.y); g.lineTo(nx, ny);
        p.x = nx; p.y = ny; if (--p.life < 0 || p.x < 0 || p.x > W || p.y < 0 || p.y > H) reset(p);
      }
      g.stroke();
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
