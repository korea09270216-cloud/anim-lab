export default function init(root, ctx) {
  const cv = root.querySelector('.s037__cv'), c = cv.getContext('2d');
  if (!c) return;
  const CELL = 56;
  let W = 0, H = 0, cols = 0, rows = 0, cover, trig, p, hold, active = 0;
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y, prev = null;
  const t0 = performance.now();

  function buildCover() {
    cover = document.createElement('canvas'); cover.width = W; cover.height = H;
    const g = cover.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#eef4fa'); gr.addColorStop(1, '#cfe0ee');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = '#9fb9cf'; g.font = '800 13px sans-serif'; g.textBaseline = 'top';
    g.fillText('눈  꽃  연  구  소', W * .05, H * .06);
    g.textAlign = 'right'; g.fillText('SINCE 2016 · 서울', W * .95, H * .06);
    g.textAlign = 'left'; g.fillStyle = '#16314d';
    const fs = Math.min(W * .15, 270); g.font = `900 ${fs}px 'Pretendard','Malgun Gothic',sans-serif`; g.textBaseline = 'alphabetic';
    g.fillText('첫 눈꽃,', W * .05, H * .5); g.fillText('한 입', W * .05, H * .5 + fs * .92);
    g.fillStyle = '#5b7a97'; g.font = `500 16px 'Pretendard','Malgun Gothic',sans-serif`; g.textBaseline = 'top';
    g.fillText('우유를 통째로 얼려 깎은 가장 가벼운 겨울.', W * .05, H * .93 - 8);
    g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { g.globalAlpha = .5; g.beginPath(); g.arc((Math.sin(i * 12.9) * .5 + .5) * W, (Math.sin(i * 78.2) * .5 + .5) * H, 2 + (i % 4), 0, 6.3); g.fill(); }
    g.globalAlpha = 1;
  }
  function resize() {
    W = cv.width = root.clientWidth; H = cv.height = root.clientHeight;
    cols = Math.ceil(W / CELL); rows = Math.ceil(H / CELL);
    trig = new Float32Array(cols * rows).fill(-1); p = new Float32Array(cols * rows); hold = new Float32Array(cols * rows);
    buildCover(); draw(true);
  }
  const ease = x => 1 - Math.pow(1 - x, 4);
  function draw(force) {
    if (!active && !force) return;
    c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, H); c.drawImage(cover, 0, 0);
    c.globalCompositeOperation = 'destination-out';
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const v = p[j * cols + i]; if (v <= .001) continue;
      const s = CELL * ease(Math.min(1, v)) + .5, ox = i * CELL + (CELL - s) / 2, oy = j * CELL + (CELL - s) / 2;
      c.fillRect(ox, oy, s, s);
    }
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(root);
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);

  function brush(x, y, now) {
    const R = 150, i0 = Math.max(0, ((x - R) / CELL) | 0), i1 = Math.min(cols - 1, ((x + R) / CELL) | 0), j0 = Math.max(0, ((y - R) / CELL) | 0), j1 = Math.min(rows - 1, ((y + R) / CELL) | 0);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const cx = i * CELL + CELL / 2, cy = j * CELL + CELL / 2;
      if (Math.hypot(cx - x, cy - y) > R) continue;
      const k = j * cols + i, par = (i + j) & 1;
      hold[k] = now + 1500 + par * 300;
      if (trig[k] < 0 || p[k] <= 0) trig[k] = now + par * 130;
    }
  }
  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now(), rect = root.getBoundingClientRect();
    if (Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly) > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let x, y;
    if (now - lastMove < 2200) { x = ctx.mouse.x - rect.left; y = ctx.mouse.y - rect.top; }
    else { const t = (now - t0) / 1000; x = W * (.5 + .4 * Math.sin(t * .9)); y = H * (.5 + .32 * Math.sin(t * 1.37 + 1)); }
    if (y > -200 && y < H + 200) {
      if (prev) { const n = Math.ceil(Math.hypot(x - prev.x, y - prev.y) / 60); for (let s = 1; s <= n; s++) brush(prev.x + (x - prev.x) * s / n, prev.y + (y - prev.y) * s / n, now); }
      else brush(x, y, now);
      prev = { x, y };
    }
    active = 0;
    for (let k = 0; k < p.length; k++) {
      if (trig[k] < 0 && p[k] <= 0) continue;
      active++;
      if (now >= trig[k] && now < hold[k]) p[k] = Math.min(1, p[k] + .075);
      else if (now >= hold[k]) { p[k] -= .045; if (p[k] <= 0) { p[k] = 0; trig[k] = -1; } }
    }
    draw();
  });
  return () => { off(); ro.disconnect(); io.disconnect(); };
}
