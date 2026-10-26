export default function init(root, ctx) {
  const cv = root.querySelector('.s146__cv');
  const c2 = cv && cv.getContext ? cv.getContext('2d') : null;
  if (!c2) { root.classList.add('is-fallback'); return; }

  const W = 960, H = 600, SW = 240, SH = 150;
  cv.width = W; cv.height = H;
  const CHARS = ' .\'`,:;-~_^"!i|l/()[]{}<>+=*xzo#%&@'.split('');
  const NC = CHARS.length;
  const PAL = ['#cbb99d', '#9c7b5a', '#4a2a17', '#c8431a', '#ff5a1f'];
  const BG = '#f6f0e4';

  // 글리프 2x3 영역 커버리지 벡터 (모양 매칭용)
  const probe = document.createElement('canvas'); probe.width = 8; probe.height = 12;
  const pc = probe.getContext('2d', { willReadFrequently: true });
  const G = new Float32Array(NC * 6);
  pc.font = 'bold 13px monospace'; pc.textAlign = 'center'; pc.textBaseline = 'middle'; pc.fillStyle = '#000';
  let gmax = 0.001;
  for (let c = 0; c < NC; c++) {
    pc.clearRect(0, 0, 8, 12); pc.fillText(CHARS[c], 4, 6.5);
    const d = pc.getImageData(0, 0, 8, 12).data;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      let s = 0;
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) s += d[(((j * 4 + y) * 8) + i * 4 + x) * 4 + 3];
      const v = s / 255 / 16; G[c * 6 + j * 2 + i] = v; if (v > gmax) gmax = v;
    }
  }
  for (let i = 0; i < G.length; i++) G[i] /= gmax;

  // 글리프 아틀라스 (크기 2종 × 색 5단)
  function atlas(cw, chh, fpx) {
    const a = document.createElement('canvas'); a.width = NC * cw; a.height = 5 * chh;
    const x = a.getContext('2d');
    x.font = 'bold ' + fpx + 'px monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    for (let k = 0; k < 5; k++) { x.fillStyle = PAL[k]; for (let c = 1; c < NC; c++) x.fillText(CHARS[c], c * cw + cw / 2, k * chh + chh / 2 + 1); }
    return a;
  }
  const AC = atlas(16, 24, 25), AF = atlas(8, 12, 13);

  // 소스 이미지 (프로시저럴 화로)
  const src = document.createElement('canvas'); src.width = SW; src.height = SH;
  const s = src.getContext('2d', { willReadFrequently: true });
  const L = new Float32Array(SW * SH);
  const st = { ph: 0 };
  function drawSource(t) {
    s.fillStyle = '#000'; s.fillRect(0, 0, SW, SH);
    let g = s.createLinearGradient(0, 118, 0, SH); g.addColorStop(0, '#666'); g.addColorStop(1, '#161616');
    s.fillStyle = g; s.fillRect(0, 118, SW, SH - 118);
    s.lineWidth = 13; s.strokeStyle = '#c4c4c4';
    s.beginPath(); s.ellipse(120, 74, 58, 50, 0, 0, 6.2832); s.stroke();
    g = s.createRadialGradient(120, 74, 0, 120, 74, 42 + Math.sin(t * 2) * 3);
    g.addColorStop(0, '#fff'); g.addColorStop(.55, '#aaa'); g.addColorStop(1, '#000');
    s.fillStyle = g; s.beginPath(); s.arc(120, 74, 46, 0, 6.2832); s.fill();
    const base = t * .7 + st.ph;
    for (let i = 0; i < 3; i++) {
      const a = base + i * 2.0944, x = 120 + Math.cos(a) * 92, y = 76 + Math.sin(a) * 38, r = 12 + i * 2;
      const rg = s.createRadialGradient(x - r * .35, y - r * .35, 1, x, y, r);
      rg.addColorStop(0, '#fff'); rg.addColorStop(1, '#222');
      s.fillStyle = rg; s.beginPath(); s.arc(x, y, r, 0, 6.2832); s.fill();
    }
    // 불꽃 혀
    s.fillStyle = '#ddd';
    for (let i = 0; i < 4; i++) {
      const fx = 96 + i * 16, fh = 16 + Math.sin(t * 5 + i * 1.7) * 7;
      s.beginPath(); s.moveTo(fx - 5, 72); s.quadraticCurveTo(fx, 72 - fh, fx + 5 + Math.sin(t * 4 + i) * 3, 72 - fh - 6); s.quadraticCurveTo(fx + 8, 72 - fh * .4, fx + 5, 72); s.fill();
    }
    const d = s.getImageData(0, 0, SW, SH).data;
    for (let i = 0, n = SW * SH; i < n; i++) L[i] = d[i * 4] / 255;
  }

  const v = new Float32Array(6);
  let bc = 0, bm = 0;
  function match(x0, y0, w, h) {
    const rw = w / 2, rh = h / 3;
    let sum = 0;
    for (let j = 0; j < 3; j++) for (let i = 0; i < 2; i++) {
      let m = 0;
      for (let yy = 0; yy < rh; yy++) { const row = (y0 + j * rh + yy) * SW + x0 + i * rw; for (let xx = 0; xx < rw; xx++) m += L[row + xx]; }
      m /= rw * rh; v[j * 2 + i] = m; sum += m;
    }
    bm = sum / 6; bc = 0;
    if (bm < .035) return;
    for (let k = 0; k < 6; k++) { let q = (v[k] - bm) * 1.5 + bm; v[k] = q < 0 ? 0 : q > 1 ? 1 : q; }
    let best = 1e9;
    for (let c = 1; c < NC; c++) {
      const o = c * 6; let e = 0;
      for (let k = 0; k < 6; k++) { const df = v[k] - G[o + k]; e += df * df; }
      if (e < best) { best = e; bc = c; }
    }
  }
  const lvl = m => m < .22 ? 0 : m < .42 ? 1 : m < .62 ? 2 : m < .82 ? 3 : 4;

  // 렌즈(커서) 상태
  const lens = { x: W / 2, y: H / 2, r: 0, tr: 140 };
  let inside = false, tx = W / 2, ty = H / 2, lastMove = -1e9, vis = true, last = 0;
  const rectOf = () => cv.getBoundingClientRect();
  const onMove = e => {
    const r = rectOf();
    const x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height;
    inside = x >= 0 && y >= 0 && x <= W && y <= H;
    if (inside) { tx = x; ty = y; lastMove = performance.now(); }
  };
  const onLeave = () => { inside = false; };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave);
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(root);

  gsap.fromTo(root.querySelectorAll('.s146__title span'), { yPercent: 110 }, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .12, scrollTrigger: { trigger: root, start: 'top 75%' } });
  const sc = gsap.to(st, { ph: 5, ease: 'none', scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: .6 } });

  function frame(time, dt) {
    if (!vis) return;
    const now = performance.now();
    if (now - last < 42) return; last = now;
    const t = now / 1000;
    const demo = now - lastMove > 2500;
    if (demo) { tx = W / 2 + Math.cos(t * .55) * 290; ty = H / 2 + Math.sin(t * .8) * 150; }
    lens.x += (tx - lens.x) * .18; lens.y += (ty - lens.y) * .18;
    lens.tr = (inside || demo) ? 135 : 0;
    lens.r += (lens.tr - lens.r) * .12;
    drawSource(t);
    c2.fillStyle = BG; c2.fillRect(0, 0, W, H);
    const R2 = lens.r * lens.r;
    for (let gy = 0; gy < 25; gy++) {
      for (let gx = 0; gx < 60; gx++) {
        const px = gx * 16, py = gy * 24;
        const dx = px + 8 - lens.x, dy = py + 12 - lens.y;
        if (lens.r > 2 && dx * dx + dy * dy < R2) {
          for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
            match(gx * 4 + sx * 2, gy * 6 + sy * 3, 2, 3);
            if (bc) c2.drawImage(AF, bc * 8, lvl(bm) * 12, 8, 12, px + sx * 8, py + sy * 12, 8, 12);
          }
        } else {
          match(gx * 4, gy * 6, 4, 6);
          if (bc) c2.drawImage(AC, bc * 16, lvl(bm) * 24, 16, 24, px, py, 16, 24);
        }
      }
    }
    if (lens.r > 2) {
      c2.strokeStyle = 'rgba(224,67,26,.55)'; c2.lineWidth = 1.5; c2.setLineDash([5, 6]);
      c2.beginPath(); c2.arc(lens.x, lens.y, lens.r, 0, 6.2832); c2.stroke(); c2.setLineDash([]);
    }
  }
  const off = ctx.tick(frame);

  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
    sc.scrollTrigger && sc.scrollTrigger.kill(); sc.kill();
  };
}
