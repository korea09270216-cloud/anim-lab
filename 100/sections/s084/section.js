export default function init(root, ctx) {
  const cv = root.querySelector('canvas'), g = cv.getContext('2d', { willReadFrequently: true });
  if (!g) return;
  const S = .34; const oc = document.createElement('canvas'), og = oc.getContext('2d', { willReadFrequently: true }); let W = 0, H = 0, vis = true, t = 0, idle = 0, bl = [], lx = null, ly = null;
  function fit() { const r = cv.getBoundingClientRect(); W = cv.width = oc.width = Math.round(r.width * S); H = cv.height = oc.height = Math.round(r.height * S); }
  fit(); const ro = new ResizeObserver(fit); ro.observe(root);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  let moved = false;
  const onMove = () => { moved = true; idle = 0; }; root.addEventListener('pointermove', onMove);
  function stamp(x, y, sp) {
    const r0 = 2.4 + Math.min(6, sp * .2);
    if (bl.length > 520) bl.shift();
    bl.push({ x: x + (Math.random() - .5) * 3, y: y + (Math.random() - .5) * 3, r: r0, gr: .018 + Math.random() * .03, a: .95, da: .0024 + Math.random() * .002 });
    if (sp > 10 && Math.random() < .5) bl.push({ x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10, r: 1.2 + Math.random() * 1.6, gr: .01, a: .9, da: .006 });
  }
  const off = ctx.tick((_, dt) => {
    if (!vis) return;
    const k = Math.min(2, (dt || 16.7) / 16.7); t += .016 * k; idle += dt || 16.7;
    const r = cv.getBoundingClientRect();
    let x, y;
    if (ctx.fine && idle < 1800 && moved) { x = (ctx.mouse.x - r.left) * S; y = (ctx.mouse.y - r.top) * S; }
    else { const u = t * .55; x = W * (.5 + Math.sin(u * 1.1) * .26 + Math.sin(u * .37) * .12); y = H * (.5 + Math.sin(u * 1.7 + 1) * .28 + Math.cos(u * .5) * .08); }
    if (lx !== null) {
      const sp = Math.hypot(x - lx, y - ly) / S, n = Math.max(1, Math.min(8, Math.round(sp / 6)));
      for (let i = 1; i <= n; i++) stamp(lx + (x - lx) * i / n, ly + (y - ly) * i / n, sp);
    }
    lx = x; ly = y;
    og.clearRect(0, 0, W, H);
    for (let i = bl.length - 1; i >= 0; i--) {
      const b = bl[i]; b.r += b.gr * k; b.a -= b.da * k; if (b.a <= 0) { bl.splice(i, 1); continue; }
      const gr = og.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r); const al = Math.min(1, b.a * 1.5);
      gr.addColorStop(0, `rgba(0,0,0,${al})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      og.fillStyle = gr; og.beginPath(); og.arc(b.x, b.y, b.r, 0, 6.283); og.fill();
    }
    const im = og.getImageData(0, 0, W, H), d = im.data;
    for (let i = 3; i < d.length; i += 4) { const a = d[i] / 255, v = Math.min(1, Math.max(0, (a - .3) / .16)); d[i - 3] = 22; d[i - 2] = 20; d[i - 1] = 18; d[i] = v * v * (3 - 2 * v) * 255; }
    g.putImageData(im, 0, 0);
  });
  return () => { off(); io.disconnect(); ro.disconnect(); root.removeEventListener('pointermove', onMove); };
}
