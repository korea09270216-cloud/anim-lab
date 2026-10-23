export default function init(root, ctx) {
  const cv = root.querySelector('.s031__cv');
  const c = cv.getContext('2d');
  if (!c) return;
  const GAP = 30, R = 170, K = 0.085, DAMP = 0.86;
  let W = 0, H = 0, cols = 0, rows = 0, px, py, vx, vy;
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y, t0 = performance.now();
  const COOL = [43, 28, 18], HOT = [232, 71, 43];

  function resize() {
    W = cv.width = root.clientWidth; H = cv.height = root.clientHeight;
    cols = Math.ceil(W / GAP) + 1; rows = Math.ceil(H / GAP) + 1;
    const n = cols * rows;
    px = new Float32Array(n); py = new Float32Array(n); vx = new Float32Array(n); vy = new Float32Array(n);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(root);
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);

  const ptr = { x: -999, y: -999, vx: 0, vy: 0 };
  function tick() {
    if (!visible) return;
    const now = performance.now();
    const rect = root.getBoundingClientRect();
    if (Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly) > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let tx, ty;
    if (now - lastMove < 1800) { tx = ctx.mouse.x - rect.left; ty = ctx.mouse.y - rect.top; }
    else { const t = (now - t0) / 1000; tx = W * (.5 + .36 * Math.sin(t * .7)); ty = H * (.5 + .3 * Math.sin(t * 1.13 + 1)); }
    ptr.vx += (tx - ptr.x - ptr.vx) * .12; ptr.vy += (ty - ptr.y - ptr.vy) * .12;
    const pvx = tx - ptr.x, pvy = ty - ptr.y; ptr.x = tx; ptr.y = ty;
    const speed = Math.min(1, Math.hypot(pvx, pvy) / 30);
    c.clearRect(0, 0, W, H);
    const push = 16 + speed * 20, R2 = R * R;
    c.fillStyle = 'rgba(43,28,18,.32)';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const k = j * cols + i, hx = i * GAP, hy = j * GAP;
      const dx0 = hx + px[k] - ptr.x, dy0 = hy + py[k] - ptr.y;
      const near = dx0 * dx0 + dy0 * dy0 < R2;
      if (!near && px[k] * px[k] + py[k] * py[k] + vx[k] * vx[k] + vy[k] * vy[k] < .01) { px[k] = py[k] = vx[k] = vy[k] = 0; c.fillRect(hx - 1.5, hy - 1.5, 3, 3); continue; }
      if (near) {
        const d = Math.sqrt(dx0 * dx0 + dy0 * dy0) || 1, f = (1 - d / R), s = f * f * push;
        vx[k] += dx0 / d * s + pvx * f * .06; vy[k] += dy0 / d * s + pvy * f * .06;
      }
      vx[k] = (vx[k] - px[k] * K) * DAMP; vy[k] = (vy[k] - py[k] * K) * DAMP;
      px[k] += vx[k]; py[k] += vy[k];
      const x = hx + px[k], y = hy + py[k];
      const disp = Math.min(1, Math.hypot(px[k], py[k]) / 60);
      const r = 1.5 + disp * 3.6;
      c.fillStyle = `rgba(${(COOL[0] + (HOT[0] - COOL[0]) * disp) | 0},${(COOL[1] + (HOT[1] - COOL[1]) * disp) | 0},${(COOL[2] + (HOT[2] - COOL[2]) * disp) | 0},${.32 + disp * .68})`;
      c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(43,28,18,.32)';
    }
  }
  const off = ctx.tick(tick);
  gsap.from(root.querySelectorAll('.s031__copy > *, .s031__stats li'), { y: 40, opacity: 0, duration: 1.4, ease: 'expo.out', stagger: .09, scrollTrigger: { trigger: root, start: 'top 75%' } });
  return () => { off(); ro.disconnect(); io.disconnect(); };
}
