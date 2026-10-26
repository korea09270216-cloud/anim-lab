export default function init(root, ctx) {
  const cv = root.querySelector('.s147__cv');
  const c2 = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!c2) { root.classList.add('is-fallback'); return; }

  const W = 960, H = 600, SW = 120, SH = 75, S = 14;
  cv.width = W; cv.height = H;
  const src = document.createElement('canvas'); src.width = SW; src.height = SH;
  const s = src.getContext('2d', { willReadFrequently: true });
  const CH = [
    { a: 15, col: '#14b4e8', f: 'c' },
    { a: 75, col: '#ee3f8f', f: 'm' },
    { a: 0, col: '#ffd400', f: 'y' },
    { a: 45, col: '#2a2230', f: 'k' },
  ].map(o => ({ ...o, cos: Math.cos(o.a * Math.PI / 180), sin: Math.sin(o.a * Math.PI / 180) }));

  function drawSource(t) {
    let g = s.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#ffb3c7'); g.addColorStop(.55, '#ff9e5e'); g.addColorStop(1, '#ffd36b');
    s.fillStyle = g; s.fillRect(0, 0, SW, SH);
    // 물결 띠 (보라)
    s.fillStyle = '#7b3fa8';
    for (let i = 0; i < 3; i++) {
      s.beginPath(); s.moveTo(0, 52 + i * 8);
      for (let x = 0; x <= SW; x += 6) s.lineTo(x, 52 + i * 8 + Math.sin(x * .09 + t * 1.2 + i) * 3.5);
      s.lineTo(SW, SH); s.lineTo(0, SH); s.fill();
      s.fillStyle = i === 0 ? '#c0356f' : '#3d1d63';
    }
    // 자몽 단면
    const cx = 58 + Math.sin(t * .7) * 5, cy = 36 + Math.cos(t * .9) * 3;
    s.fillStyle = '#fff4e0'; s.beginPath(); s.arc(cx, cy, 25, 0, 6.2832); s.fill();
    g = s.createRadialGradient(cx, cy, 2, cx, cy, 22); g.addColorStop(0, '#ff7a8a'); g.addColorStop(1, '#e8344e');
    s.fillStyle = g; s.beginPath(); s.arc(cx, cy, 21.5, 0, 6.2832); s.fill();
    s.strokeStyle = '#fff4e0'; s.lineWidth = 1.4;
    for (let i = 0; i < 8; i++) { const a = i * .7854 + t * .15; s.beginPath(); s.moveTo(cx, cy); s.lineTo(cx + Math.cos(a) * 21, cy + Math.sin(a) * 21); s.stroke(); }
    // 베리
    const b = [[96, 24, 8, '#b01c5b'], [105, 38, 6, '#7a1648'], [14, 22, 7, '#6a2a8c']];
    b.forEach(([x, y, r, c], i) => { s.fillStyle = c; s.beginPath(); s.arc(x, y + Math.sin(t * 1.6 + i) * 2, r, 0, 6.2832); s.fill(); });
  }

  const lens = { x: W / 2, y: H / 2, r: 0 };
  const st = { p: 0 };
  let inside = false, tx = W / 2, ty = H / 2, lastMove = -1e9, vis = true, last = 0;
  const onMove = e => {
    const r = cv.getBoundingClientRect();
    const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    inside = x >= 0 && y >= 0 && x <= W && y <= H;
    if (inside) { tx = x; ty = y; lastMove = performance.now(); }
  };
  const onLeave = () => { inside = false; };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(root);
  const sc = gsap.to(st, { p: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top 85%', end: 'bottom 35%', scrub: .6 } });
  gsap.from(root.querySelector('.s147__title'), { yPercent: 40, opacity: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });

  const D = Math.hypot(W, H), NMAX = Math.ceil(D / S / 2) + 1;
  function frame() {
    if (!vis) return;
    const now = performance.now();
    if (now - last < 55) return; last = now;
    const t = now / 1000;
    const demo = now - lastMove > 2500;
    if (demo) { tx = W / 2 + Math.cos(t * .5) * 300; ty = H / 2 + Math.sin(t * .75) * 150; }
    lens.x += (tx - lens.x) * .15; lens.y += (ty - lens.y) * .15;
    const tr = (inside || demo) ? 190 : 80;
    lens.r += (tr - lens.r) * .1;
    drawSource(t);
    const d = s.getImageData(0, 0, SW, SH).data;
    const base = .16 + .5 * st.p + .08 * Math.sin(t * 1.3);
    c2.globalCompositeOperation = 'source-over';
    c2.fillStyle = '#f9f4ec'; c2.fillRect(0, 0, W, H);
    c2.globalCompositeOperation = 'multiply';
    const inv2 = 1 / (lens.r * lens.r);
    for (let ci = 0; ci < 4; ci++) {
      const ch = CH[ci];
      c2.fillStyle = ch.col; c2.beginPath();
      for (let j = -NMAX; j <= NMAX; j++) for (let i = -NMAX; i <= NMAX; i++) {
        const gx = i * S, gy = j * S;
        const x = W / 2 + gx * ch.cos - gy * ch.sin, y = H / 2 + gx * ch.sin + gy * ch.cos;
        if (x < -S || y < -S || x > W + S || y > H + S) continue;
        const sx = Math.min(SW - 1, Math.max(0, (x / W * SW) | 0)), sy = Math.min(SH - 1, Math.max(0, (y / H * SH) | 0));
        const o = (sy * SW + sx) * 4;
        const R = d[o] / 255, G = d[o + 1] / 255, B = d[o + 2] / 255;
        const k = 1 - Math.max(R, G, B);
        let amt;
        if (ch.f === 'k') amt = Math.max(0, (k - .35) / .65);
        else {
          const kk = k > .35 ? .35 : k, dn = 1 - kk || 1;
          amt = ch.f === 'c' ? (1 - R - kk) / dn : ch.f === 'm' ? (1 - G - kk) / dn : (1 - B - kk) / dn;
        }
        if (amt <= .02) continue;
        const dx = x - lens.x, dy = y - lens.y;
        const rev = base + (1.18 - base) * Math.exp(-(dx * dx + dy * dy) * inv2 * 1.6);
        const rad = Math.sqrt(amt) * S * .74 * rev;
        if (rad < .6) continue;
        c2.moveTo(x + rad, y); c2.arc(x, y, rad, 0, 6.2832);
      }
      c2.fill();
    }
    c2.globalCompositeOperation = 'source-over';
    c2.strokeStyle = '#251a3a'; c2.lineWidth = 2;
    c2.beginPath(); c2.arc(lens.x, lens.y, 10, 0, 6.2832); c2.stroke();
  }
  const off = ctx.tick(frame);

  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
    sc.scrollTrigger && sc.scrollTrigger.kill(); sc.kill();
  };
}
