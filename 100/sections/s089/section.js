export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  const P = new Uint8Array(512); for (let i = 0; i < 256; i++) P[i] = i; for (let i = 255; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [P[i], P[j]] = [P[j], P[i]]; } for (let i = 0; i < 256; i++) P[i + 256] = P[i];
  const sm = t => t * t * (3 - 2 * t), lp = (a, b, t) => a + (b - a) * t, h = (x, y) => P[P[x & 255] + (y & 255)] / 255;
  const n2 = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi); return lp(lp(h(xi, yi), h(xi + 1, yi), xf), lp(h(xi, yi + 1), h(xi + 1, yi + 1), xf), yf); };
  const fbm = (x, y) => n2(x, y) * .62 + n2(x * 2.1 + 5, y * 2.1 + 9) * .27 + n2(x * 4.3 + 11, y * 4.3 + 3) * .11;
  let W = 0, H = 0, vis = true, t = 0, bump = { x: 0, y: 0 };
  const ROWS = 34, BG = '#c9482b';
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .0042 * k;
    const r = cv.getBoundingClientRect(); let mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top;
    if (!ctx.fine || mx < 0 || my < 0 || mx > W || my > H) { mx = W * (.5 + Math.sin(t * 5) * .32); my = H * (.65 + Math.cos(t * 3.4) * .18); }
    bump.x += (mx - bump.x) * .08 * k; bump.y += (my - bump.y) * .08 * k;
    const top = H * .34, bot = H * .94, amp = H * .2, STEP = 9, NP = Math.ceil(W / STEP) + 1, sig = W * .1;
    g.clearRect(0, 0, W, H);
    g.lineJoin = 'round'; g.lineWidth = 1.6;
    for (let row = 0; row < ROWS; row++) {
      const u = row / (ROWS - 1), by = top + (bot - top) * u, ry = row * .17;
      g.beginPath();
      for (let i = 0; i < NP; i++) {
        const x = i * STEP, nx = x / W, env = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, nx))), 1.2) * (.45 + .55 * u);
        let y = by - (fbm(x * .0042 + t * 3, ry + t) - .32) * amp * 1.6 * env;
        const dx = x - bump.x, dy = by - bump.y, gs = sig * (.6 + u * .6);
        y -= Math.exp(-(dx * dx) / (2 * gs * gs) - (dy * dy) / (2 * (H * .12) ** 2)) * H * .17 * (ctx.fine ? 1 : .6);
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(W, H + 4); g.lineTo(0, H + 4); g.closePath();
      g.fillStyle = BG; g.fill();
      g.strokeStyle = `rgba(251,238,219,${.45 + u * .55})`;
      g.beginPath(); { let first = true; for (let i = 0; i < NP; i++) { const x = i * STEP, nx = x / W, env = Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, nx))), 1.2) * (.45 + .55 * u); let y = by - (fbm(x * .0042 + t * 3, ry + t) - .32) * amp * 1.6 * env; const dx = x - bump.x, dy = by - bump.y, gs = sig * (.6 + u * .6); y -= Math.exp(-(dx * dx) / (2 * gs * gs) - (dy * dy) / (2 * (H * .12) ** 2)) * H * .17 * (ctx.fine ? 1 : .6); if (first) { g.moveTo(x, y); first = false; } else g.lineTo(x, y); } }
      g.stroke();
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); };
}
