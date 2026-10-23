export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  if (!g) return;
  let W = 0, H = 0, vis = true, t = 0, jumpT = 0;
  const NR = 22, jel = [];
  const defs = [['#ff3b5c', '#ff8fa3', 1], ['#8fd13f', '#d3f59a', 1.05], ['#ff9a1f', '#ffd08a', .95], ['#3c7bff', '#9fc2ff', 1.1]];
  function mkJelly(i, R) {
    const cx = W * (.2 + i * .2), cy = H * .4, pts = [], cs = [];
    for (let k = 0; k < NR; k++) { const a = k / NR * 6.2832; pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R, px: cx + Math.cos(a) * R, py: cy + Math.sin(a) * R }); }
    pts.push({ x: cx, y: cy, px: cx, py: cy });
    const link = (a, b, s) => { const d = Math.hypot(pts[a].x - pts[b].x, pts[a].y - pts[b].y); cs.push([a, b, d, s]); };
    for (let k = 0; k < NR; k++) { link(k, (k + 1) % NR, .9); link(k, (k + 2) % NR, .35); link(k, NR, .22); link(k, (k + NR / 2) % NR, .12); }
    return { pts, cs, R, col: defs[i % 4], face: i };
  }
  function build() { jel.length = 0; const R = Math.max(54, Math.min(110, W * .07)); for (let i = 0; i < 4; i++) jel.push(mkJelly(i, R * defs[i][2])); }
  function fit() { const r = cv.getBoundingClientRect(); const ow = W; W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); if (!ow || Math.abs(ow - W) > 200) build(); }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  let grab = null, mx = -999, my = -999;
  const rel = e => { const r = cv.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; };
  const onDown = e => { rel(e); let best = 1e9; grab = null; for (const j of jel) for (let k = 0; k < NR; k++) { const p = j.pts[k], d = Math.hypot(p.x - mx, p.y - my); if (d < best && d < j.R * 1.6) { best = d; grab = { p, j }; } } };
  const onUp = () => { grab = null; };
  const onMove = e => rel(e);
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
  const floor = () => H - 28;
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .02 * k; jumpT += dt || 16.7;
    if (jumpT > 1700) { jumpT = 0; const j = jel[Math.random() * jel.length | 0], c = j.pts[NR]; for (const p of j.pts) { p.py += 15 + Math.random() * 8; p.px += (Math.random() - .5) * 8; } void c; }
    for (const j of jel) {
      for (const p of j.pts) { const vx = (p.x - p.px) * .992, vy = (p.y - p.py) * .992; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy + .55 * k; }
      if (grab && grab.j === j) { const p = grab.p; p.x += (mx - p.x) * .35; p.y += (my - p.y) * .35; p.px = p.x - (mx - p.x) * .02; p.py = p.y - (my - p.y) * .02; }
      else if (ctx.fine) for (const p of j.pts) { const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy); if (d < 70 && d > 1) { const f = (1 - d / 70) * .9; p.x += dx / d * f; p.y += dy / d * f; } }
      for (let it = 0; it < 7; it++) {
        for (const [a, b, rest, s] of j.cs) {
          const A = j.pts[a], B = j.pts[b]; let dx = B.x - A.x, dy = B.y - A.y; const d = Math.hypot(dx, dy) || 1, diff = (d - rest) / d * .5 * s * 1.9; dx *= diff; dy *= diff; A.x += dx; A.y += dy; B.x -= dx; B.y -= dy;
        }
        for (const p of j.pts) { if (p.y > floor()) { p.y = floor(); p.py = p.y + (p.y - p.py) * .2 * 0 + (p.py - p.y) * .35; } if (p.x < 10) { p.x = 10; p.px = p.x + (p.px - p.x) * .3; } if (p.x > W - 10) { p.x = W - 10; p.px = p.x + (p.px - p.x) * .3; } if (p.y < 10) p.y = 10; }
      }
    }
    for (let a = 0; a < jel.length; a++) for (let b = a + 1; b < jel.length; b++) {
      const A = jel[a], B = jel[b], ca = A.pts[NR], cb = B.pts[NR], dx = cb.x - ca.x, dy = cb.y - ca.y, d = Math.hypot(dx, dy) || 1, m = (A.R + B.R) * .92;
      if (d < m) { const f = (m - d) * .5 * .5, ux = dx / d * f, uy = dy / d * f; for (const p of A.pts) { p.x -= ux; p.y -= uy; } for (const p of B.pts) { p.x += ux; p.y += uy; } }
    }
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(74,15,42,.14)'; for (const j of jel) { const c = j.pts[NR]; g.beginPath(); g.ellipse(c.x, floor() + 6, j.R * .9, 7, 0, 0, 6.283); g.fill(); }
    for (const j of jel) {
      const P = j.pts, c = P[NR];
      g.beginPath(); const mid = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
      let m0 = mid(P[NR - 1], P[0]); g.moveTo(m0[0], m0[1]);
      for (let i = 0; i < NR; i++) { const nx = P[(i + 1) % NR], m = mid(P[i], nx); g.quadraticCurveTo(P[i].x, P[i].y, m[0], m[1]); }
      g.closePath();
      const gr = g.createRadialGradient(c.x - j.R * .3, c.y - j.R * .4, 4, c.x, c.y, j.R * 1.25); gr.addColorStop(0, j.col[1]); gr.addColorStop(.55, j.col[0]); gr.addColorStop(1, j.col[0]);
      g.fillStyle = gr; g.fill(); g.lineWidth = 3; g.strokeStyle = '#4a0f2a'; g.stroke();
      g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(c.x - j.R * .38, c.y - j.R * .42, j.R * .2, j.R * .1, -.6, 0, 6.283); g.fill();
      const vx = c.x - (c.x - (P[0].x + P[NR / 2].x) / 2), ex = j.R * .28, ey = c.y - j.R * .02; void vx;
      g.fillStyle = '#4a0f2a'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(c.x + s * ex, ey, j.R * .075, j.R * .11, 0, 0, 6.283); g.fill(); }
      g.strokeStyle = '#4a0f2a'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.arc(c.x, c.y + j.R * .12, j.R * .13, .15 * Math.PI, .85 * Math.PI); g.stroke();
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
}
