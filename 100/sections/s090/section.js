export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  const S = .75, BG = '18,10,36';
  let W = 0, H = 0, vis = true, fr = 0, nextT = 400, rockets = [], ps = [];
  const pal = [[255, 207, 92], [255, 120, 170], [90, 220, 255], [255, 255, 255], [160, 255, 170], [255, 150, 80]];
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = Math.round(r.width * S); H = cv.height = Math.round(r.height * S); g.fillStyle = `rgb(${BG})`; g.fillRect(0, 0, W, H); }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  function launch(tx, ty) { rockets.push({ x: tx + (Math.random() - .5) * W * .1, y: H, tx, ty, vy: -(H - ty) / 46, vx: 0, c: pal[Math.random() * pal.length | 0] }); rockets[rockets.length - 1].vx = (tx - rockets[rockets.length - 1].x) / 46; }
  function burst(x, y, c) {
    const type = Math.random() < .35 ? 'ring' : 'sphere', n = ctx.reduced ? 40 : 90, sp = 2.2 + Math.random() * 2.2, c2 = pal[Math.random() * pal.length | 0];
    for (let i = 0; i < n && ps.length < 1100; i++) {
      const a = i / n * 6.2832 + Math.random() * .1, v = type === 'ring' ? sp : sp * (.25 + Math.random() * .85);
      ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, dec: .008 + Math.random() * .009, c: i % 3 ? c : c2, tw: Math.random() * 6 });
    }
  }
  const onDown = e => { const r = cv.getBoundingClientRect(); launch((e.clientX - r.left) * S, (e.clientY - r.top) * S * .9); };
  root.addEventListener('pointerdown', onDown);
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); fr++; nextT -= dt || 16.7;
    if (nextT < 0) { nextT = 650 + Math.random() * 900; launch(W * (.12 + Math.random() * .76), H * (.12 + Math.random() * .36)); if (Math.random() < .35) launch(W * (.12 + Math.random() * .76), H * (.15 + Math.random() * .3)); }
    g.globalCompositeOperation = 'source-over'; g.fillStyle = `rgba(${BG},${fr % 5 ? .2 : .45})`; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = rockets.length - 1; i >= 0; i--) {
      const r = rockets[i]; r.x += r.vx * k; r.y += r.vy * k; r.vy *= .992;
      g.fillStyle = `rgb(${r.c})`; g.beginPath(); g.arc(r.x, r.y, 2, 0, 6.283); g.fill();
      g.fillStyle = `rgba(${r.c},.35)`; g.beginPath(); g.arc(r.x - r.vx * 2, r.y - r.vy * 2, 1.6, 0, 6.283); g.fill();
      if (r.y <= r.ty) { burst(r.x, r.y, r.c); rockets.splice(i, 1); }
    }
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.vx *= .985; p.vy = p.vy * .985 + .035 * k; p.x += p.vx * k; p.y += p.vy * k; p.life -= p.dec * k;
      if (p.life <= 0) { ps.splice(i, 1); continue; }
      const tw = .6 + .4 * Math.sin(fr * .5 + p.tw), a = p.life * tw;
      g.fillStyle = `rgba(${p.c},${a})`; g.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4);
    }
    g.globalCompositeOperation = 'source-over';
  });
  return () => { off(); io.disconnect(); ro.disconnect(); root.removeEventListener('pointerdown', onDown); };
}
