export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d');
  if (!g) return;
  let W = 0, H = 0, vis = true, t = 0, ns = [];
  const LINK = 140;
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width); H = cv.height = Math.round(r.height); }
  const mk = (x, y) => ({ x, y, vx: (Math.random() - .5) * .35, vy: (Math.random() - .5) * .35, r: .8 + Math.random() * 1.8, p: Math.random() * 6.28, gold: Math.random() < .22 });
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const N = Math.round(Math.min(130, Math.max(60, W * H / 8000)));
  for (let i = 0; i < N; i++) ns.push(mk(Math.random() * W, Math.random() * H));
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onDown = e => { const r = cv.getBoundingClientRect(); for (let i = 0; i < 6; i++) { const n = mk(e.clientX - r.left, e.clientY - r.top); const a = Math.random() * 6.28; n.vx = Math.cos(a) * 1.6; n.vy = Math.sin(a) * 1.6; n.gold = true; ns.push(n); } while (ns.length > N + 24) ns.splice(Math.random() * N | 0, 1); };
  root.addEventListener('pointerdown', onDown);
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .02 * k;
    const r = cv.getBoundingClientRect(); let mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top;
    const MR = 220, hasM = ctx.fine && mx > 0 && my > 0 && mx < W && my < H;
    g.clearRect(0, 0, W, H);
    for (const n of ns) {
      n.vx *= .995; n.vy *= .995;
      if (Math.hypot(n.vx, n.vy) < .12) { n.vx += (Math.random() - .5) * .02; n.vy += (Math.random() - .5) * .02; }
      if (hasM) { const dx = mx - n.x, dy = my - n.y, d = Math.hypot(dx, dy); if (d < MR && d > 30) { const f = (1 - d / MR) * .045 * k; n.vx += dx / d * f; n.vy += dy / d * f; } }
      n.x += n.vx * k; n.y += n.vy * k;
      if (n.x < -10) n.x = W + 10; if (n.x > W + 10) n.x = -10; if (n.y < -10) n.y = H + 10; if (n.y > H + 10) n.y = -10;
    }
    g.lineWidth = 1;
    for (let i = 0; i < ns.length; i++) {
      const a = ns[i];
      for (let j = i + 1; j < ns.length; j++) {
        const b = ns[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
        if (d2 < LINK * LINK) { const al = (1 - Math.sqrt(d2) / LINK); g.strokeStyle = `rgba(${a.gold || b.gold ? '242,199,92' : '170,190,255'},${al * .5})`; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke(); }
      }
      if (hasM) { const dx = a.x - mx, dy = a.y - my, d = Math.hypot(dx, dy); if (d < MR) { g.strokeStyle = `rgba(255,236,170,${(1 - d / MR) * .85})`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(mx, my); g.stroke(); g.lineWidth = 1; } }
    }
    for (const n of ns) {
      const tw = .55 + .45 * Math.sin(t * 1.4 + n.p), rr = n.r * (n.gold ? 1.3 : 1);
      g.fillStyle = n.gold ? `rgba(255,224,130,${tw})` : `rgba(235,240,255,${tw})`;
      g.beginPath(); g.arc(n.x, n.y, rr, 0, 6.283); g.fill();
      if (n.gold) { g.fillStyle = `rgba(255,224,130,${tw * .12})`; g.beginPath(); g.arc(n.x, n.y, rr * 5, 0, 6.283); g.fill(); }
    }
    if (hasM) {
      const gr = g.createRadialGradient(mx, my, 0, mx, my, 46); gr.addColorStop(0, 'rgba(255,240,190,.9)'); gr.addColorStop(1, 'rgba(255,240,190,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(mx, my, 46, 0, 6.283); g.fill();
    }
  });
  return () => { off(); io.disconnect(); ro.disconnect(); root.removeEventListener('pointerdown', onDown); };
}
