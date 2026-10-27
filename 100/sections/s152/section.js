// s152 — 격자 볼츠만(D2Q9, BGK) 카르만 소용돌이. 192×(≈108) CPU, 고정 스텝.
// pull-streaming + 충돌 융합 루프. 장애물은 full-way bounce-back, 좌 유입(평형 분포)·우 유출(복사)·상하 자유류.
// 거시량 ρ=Σf, u=Σc f/ρ, 점성 ν=(τ−1/2)/3, 와도 ω=∂uy/∂x−∂ux/∂y. 연기 = 속도장을 따라가는 추적 입자(수치 확산 없음).

export function createLBM(W, H, tau, u0, force) {
  const S = W + 2, N1 = S * (H + 2), om = 1 / tau;
  let A = new Float32Array(9 * N1), B = new Float32Array(9 * N1);
  const ux = new Float32Array(N1), uy = new Float32Array(N1), solid = new Uint8Array(N1);
  const W0 = 4 / 9, W1 = 1 / 9, W2 = 1 / 36, UMAX = 0.3, UM2 = UMAX * UMAX;
  let uin = u0, uiy = 0, steps = 0;

  function feq(i, r, vx, vy) {
    const cx = [0, 1, 0, -1, 0, 1, -1, -1, 1][i], cy = [0, 0, 1, 0, -1, 1, 1, -1, -1][i], w = i === 0 ? W0 : i < 5 ? W1 : W2;
    const e = 3 * (cx * vx + cy * vy);
    return w * r * (1 + e + 0.5 * e * e - 1.5 * (vx * vx + vy * vy));
  }
  function setCell(idx, r, vx, vy) { for (let i = 0; i < 9; i++) A[i * N1 + idx] = feq(i, r, vx, vy); }
  function reset(noise) {
    for (let y = 0; y < H + 2; y++) for (let x = 0; x < S; x++) {
      const idx = y * S + x, h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453, n = (h - Math.floor(h) - 0.5) * (noise || 0);
      setCell(idx, 1, u0, n * u0);
    }
    steps = 0;
  }
  function fillHalo() {
    for (let i = 0; i < 9; i++) {
      const o = i * N1, fi = feq(i, 1, uin, uiy);
      for (let y = 0; y < H + 2; y++) { A[o + y * S] = fi; A[o + y * S + W + 1] = A[o + y * S + W]; }
      for (let x = 0; x < S; x++) { A[o + x] = fi; A[o + (H + 1) * S + x] = fi; }
    }
  }

  function step() {
    uin = u0 * Math.min(1, 0.35 + steps / 240);
    uiy = force ? force.a * Math.exp(-steps / 2200) * Math.sin(steps * force.w) : 0; // 가진은 시동용: 소용돌이 길이 자리 잡으면 사라진다
    fillHalo();
    const n1 = N1, n2 = 2 * N1, n3 = 3 * N1, n4 = 4 * N1, n5 = 5 * N1, n6 = 6 * N1, n7 = 7 * N1, n8 = 8 * N1;
    for (let y = 1; y <= H; y++) {
      let idx = y * S + 1;
      for (let x = 1; x <= W; x++, idx++) {
        const f0 = A[idx], f1 = A[n1 + idx - 1], f2 = A[n2 + idx - S], f3 = A[n3 + idx + 1], f4 = A[n4 + idx + S];
        const f5 = A[n5 + idx - 1 - S], f6 = A[n6 + idx + 1 - S], f7 = A[n7 + idx + 1 + S], f8 = A[n8 + idx - 1 + S];
        if (solid[idx]) {
          B[idx] = f0; B[n1 + idx] = f3; B[n2 + idx] = f4; B[n3 + idx] = f1; B[n4 + idx] = f2;
          B[n5 + idx] = f7; B[n6 + idx] = f8; B[n7 + idx] = f5; B[n8 + idx] = f6; ux[idx] = 0; uy[idx] = 0; continue;
        }
        const r = f0 + f1 + f2 + f3 + f4 + f5 + f6 + f7 + f8, inv = 1 / r;
        let vx = (f1 - f3 + f5 - f6 - f7 + f8) * inv, vy = (f2 - f4 + f5 + f6 - f7 - f8) * inv;
        const sp = vx * vx + vy * vy;
        if (sp > UM2) { const k = UMAX / Math.sqrt(sp); vx *= k; vy *= k; }
        ux[idx] = vx; uy[idx] = vy;
        const us = 1.5 * (vx * vx + vy * vy), r0 = r * W0, r1 = r * W1, r2 = r * W2;
        const e1 = 3 * vx, e2 = 3 * vy, e5 = e1 + e2, e6 = e2 - e1, h1 = 0.5 * e1 * e1 - us, h2 = 0.5 * e2 * e2 - us, h5 = 0.5 * e5 * e5 - us, h6 = 0.5 * e6 * e6 - us;
        B[idx] = f0 + om * (r0 * (1 - us) - f0);
        B[n1 + idx] = f1 + om * (r1 * (1 + e1 + h1) - f1);
        B[n2 + idx] = f2 + om * (r1 * (1 + e2 + h2) - f2);
        B[n3 + idx] = f3 + om * (r1 * (1 - e1 + h1) - f3);
        B[n4 + idx] = f4 + om * (r1 * (1 - e2 + h2) - f4);
        B[n5 + idx] = f5 + om * (r2 * (1 + e5 + h5) - f5);
        B[n6 + idx] = f6 + om * (r2 * (1 + e6 + h6) - f6);
        B[n7 + idx] = f7 + om * (r2 * (1 - e5 + h5) - f7);
        B[n8 + idx] = f8 + om * (r2 * (1 - e6 + h6) - f8);
      }
    }
    const t = A; A = B; B = t; steps++;
  }

  // mask: W×H (0/1). 새로 유체가 된 셀은 정지 평형으로 채운다.
  function setMask(mask) {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const idx = (y + 1) * S + x + 1, m = mask[y * W + x];
      if (solid[idx] && !m) setCell(idx, 1, uin * 0.5, 0);
      solid[idx] = m;
    }
  }
  function stats() {
    let bad = 0, mu = 0, rmin = 9, rmax = 0;
    for (let y = 1; y <= H; y++) for (let x = 1; x <= W; x++) {
      const idx = y * S + x; if (solid[idx]) continue;
      let r = 0; for (let i = 0; i < 9; i++) r += A[i * N1 + idx];
      if (!(r === r) || r < 0.3 || r > 2.5) bad++; else { if (r < rmin) rmin = r; if (r > rmax) rmax = r; }
      const s = Math.hypot(ux[idx], uy[idx]); if (s > mu) mu = s;
    }
    return { bad, maxU: mu, rmin, rmax };
  }
  return { W, H, S, ux, uy, solid, step, reset, setMask, stats, get steps() { return steps; }, tau, u0 };
}

// 컬러맵 LUT (256)
function lut(stops) {
  const o = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255 * (stops.length - 1), k = Math.min(stops.length - 2, t | 0), f = t - k;
    for (let c = 0; c < 3; c++) o[i * 3 + c] = stops[k][c] * (1 - f) + stops[k + 1][c] * f;
  }
  return o;
}
const BG = [9, 16, 36];
export const LUTS = [
  lut([[36, 206, 255], [20, 120, 190], [14, 52, 100], BG, [110, 40, 70], [226, 84, 52], [255, 168, 92]]), // 와도: 시계=청록, 반시계=주황
  lut([[8, 12, 34], [34, 38, 120], [108, 44, 150], [200, 66, 116], [248, 132, 62], [255, 226, 140]]), // 속도
];
export function renderField(L, mode, data) {
  const { W, H, S, ux, uy, solid } = L, u0 = L.u0, lt = LUTS[mode === 1 ? 1 : 0], amp = mode === 2 ? 0.3 : 1;
  const wmax = u0 * 0.3;
  for (let y = 0, o = 0; y < H; y++) for (let x = 0; x < W; x++, o += 4) {
    const idx = (y + 1) * S + x + 1;
    let q;
    if (solid[idx]) { data[o] = BG[0]; data[o + 1] = BG[1]; data[o + 2] = BG[2]; data[o + 3] = 255; continue; }
    if (mode === 1) { q = Math.min(255, Math.max(0, Math.hypot(ux[idx], uy[idx]) / (1.7 * u0) * 255)); }
    else {
      const edge = x < 4 || y < 4 || x > W - 3 || y > H - 4, w = edge ? 0 : (uy[idx + 1] - uy[idx - 1] - (ux[idx + S] - ux[idx - S])) * 0.5 / wmax * amp, t = Math.tanh(w * 1.1);
      q = 127.5 + 127.5 * Math.sign(t) * Math.pow(Math.abs(t), 0.8);
    }
    q = (q + 0.5) | 0; data[o] = lt[q * 3]; data[o + 1] = lt[q * 3 + 1]; data[o + 2] = lt[q * 3 + 2]; data[o + 3] = 255;
  }
}

export default function init(root, ctx) {
  const cF = root.querySelector('.s152__field'), cG = root.querySelector('.s152__glyph'), cS = root.querySelector('.s152__smoke');
  const ring = root.querySelector('.s152__ring'), chips = [...root.querySelectorAll('.s152__chip')];
  const gF = cF.getContext('2d'), gG = cG.getContext('2d'), gS = cS.getContext('2d');
  if (!gF || !gG || !gS) { root.classList.add('is-static'); return; }
  const WORD = '바람', FONT = "900 {S}px 'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const GX = 0.62, GY = 0.5, GS = 0.24;
  const dpr = 1;

  let L = null, img = null, W = 192, H = 108, secW = 1440, secH = 810, cell = 7.5, base = null, mask = null;
  let mode = 0, visible = true, tabOn = true, acc = 0, last = performance.now(), lastUser = -1e9, t = 0, cost = 14, stepsPF = 14, frame = 0;
  const cur = { x: 0.2, y: 0.5, tx: 0.2, ty: 0.5, cx: -1, cy: -1, r: 5 };
  const POOL = 4800, px = new Float32Array(POOL), py = new Float32Array(POOL), qx = new Float32Array(POOL), qy = new Float32Array(POOL), age = new Uint16Array(POOL), kind = new Uint8Array(POOL);
  let live = new Uint8Array(POOL), head = 0, edge = [];

  function drawWord(c, scale) {
    c.font = FONT.replace('{S}', (GS * secH * scale).toFixed(1)); c.textAlign = 'center'; c.textBaseline = 'middle';
    if ('letterSpacing' in c) c.letterSpacing = (-0.03 * GS * secH * scale).toFixed(2) + 'px';
    c.fillText(WORD, GX * secW * scale, GY * secH * scale);
  }
  function build() {
    const r = root.getBoundingClientRect(); secW = Math.max(320, r.width); secH = Math.max(300, r.height);
    H = Math.max(90, Math.min(126, Math.round(192 * secH / secW))); W = 192; cell = secW / W;
    L = createLBM(W, H, 0.54, 0.13, { a: 0.008, w: 0.015 });
    cF.width = W; cF.height = H; img = gF.createImageData(W, H);
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H; const m = mc.getContext('2d', { willReadFrequently: true });
    m.fillStyle = '#000'; drawWord(m, W / secW);
    const d = m.getImageData(0, 0, W, H).data; base = new Uint8Array(W * H); mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) base[i] = d[i * 4 + 3] > 100 ? 1 : 0;
    // 글자 하류 경계 셀(연기 방출점)
    edge = [];
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) if (!base[y * W + x] && (base[y * W + x - 1] || base[(y - 1) * W + x] || base[(y + 1) * W + x])) edge.push(y * W + x);
    cG.width = Math.round(secW * dpr); cG.height = Math.round(secH * dpr); cS.width = cG.width; cS.height = cG.height;
    gG.clearRect(0, 0, cG.width, cG.height);
    const gr = gG.createLinearGradient(0, (GY - GS / 2) * secH * dpr, 0, (GY + GS / 2) * secH * dpr); gr.addColorStop(0, '#f3f6ff'); gr.addColorStop(1, '#b8c6ee');
    gG.fillStyle = gr; drawWord(gG, dpr);
    cur.cx = -1; live.fill(0); head = 0;
    L.reset(0.02);
    mask.set(base); L.setMask(mask);
    for (let i = 0; i < 320; i++) L.step(); // 선행 워밍업: 유입 가속 + 시동 와류
    ring.style.width = ring.style.height = (cur.r * 2 * cell).toFixed(1) + 'px';
  }

  function updateMask() {
    const cx = Math.round(cur.x * W), cy = Math.round(cur.y * H);
    if (cx === cur.cx && cy === cur.cy) return; cur.cx = cx; cur.cy = cy;
    mask.set(base); const R = cur.r, r2 = R * R;
    for (let y = Math.max(1, cy - 6); y <= Math.min(H - 2, cy + 6); y++) for (let x = Math.max(1, cx - 6); x <= Math.min(W - 2, cx + 6); x++)
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r2) mask[y * W + x] = 1;
    L.setMask(mask);
  }

  // 추적 입자: 속도장(양선형)을 RK2 로 따라간다
  function sampleU(x, y, out) {
    const S = L.S; x = x < 0 ? 0 : x > W - 1.001 ? W - 1.001 : x; y = y < 0 ? 0 : y > H - 1.001 ? H - 1.001 : y;
    const i = x | 0, j = y | 0, fx = x - i, fy = y - j, k = (j + 1) * S + i + 1, ux = L.ux, uy = L.uy;
    out[0] = (ux[k] * (1 - fx) + ux[k + 1] * fx) * (1 - fy) + (ux[k + S] * (1 - fx) + ux[k + S + 1] * fx) * fy;
    out[1] = (uy[k] * (1 - fx) + uy[k + 1] * fx) * (1 - fy) + (uy[k + S] * (1 - fx) + uy[k + S + 1] * fx) * fy;
  }
  const tmp = [0, 0];
  function spawn(x, y, k) {
    for (let n = 0; n < 40; n++) { head = (head + 1) % POOL; if (!live[head]) break; }
    px[head] = qx[head] = x; py[head] = qy[head] = y; age[head] = 0; kind[head] = k; live[head] = 1;
  }
  function stepParticles(nst) {
    const S = L.S, solid = L.solid;
    // 유입 연기 선: 8행마다 한 줄
    { const half = 0.5 * nst * 0.13; for (let y = 4; y < H - 3; y += 8) { spawn(0.6, y + 0.5, 0); spawn(0.6 + half, y + 0.5, 0); } }
    // 글자 연기
    if (edge.length) for (let n = 0; n < 6; n++) { const e = edge[(Math.random() * edge.length) | 0]; spawn((e % W) + 0.5 + (Math.random() - 0.5) * 0.6, ((e / W) | 0) + 0.5 + (Math.random() - 0.5) * 0.6, 1); }
    for (let i = 0; i < POOL; i++) {
      if (!live[i]) continue;
      let x = px[i], y = py[i];
      sampleU(x, y, tmp); const xm = x + 0.5 * nst * tmp[0], ym = y + 0.5 * nst * tmp[1];
      sampleU(xm, ym, tmp); qx[i] = x; qy[i] = y; x += nst * tmp[0]; y += nst * tmp[1];
      px[i] = x; py[i] = y; age[i]++;
      if (x < 0 || x > W - 1 || y < 0 || y > H - 1 || age[i] > (kind[i] ? 170 : 420) || solid[((y | 0) + 1) * S + (x | 0) + 1]) live[i] = 0;
    }
  }
  function drawParticles() {
    gS.clearRect(0, 0, cS.width, cS.height);
    const k = cell * dpr;
    gS.lineCap = 'round'; gS.lineWidth = 1.5 * dpr;
    for (let pass = 0; pass < 2; pass++) {
      gS.strokeStyle = pass ? 'rgba(255,190,110,.78)' : 'rgba(226,242,255,.72)';
      gS.beginPath();
      for (let i = 0; i < POOL; i++) { if (!live[i] || kind[i] !== pass) continue; gS.moveTo((qx[i] - (px[i] - qx[i]) * 0.3 + .5) * k, (qy[i] - (py[i] - qy[i]) * 0.3 + .5) * k); gS.lineTo((px[i] + .5) * k + .01, (py[i] + .5) * k); }
      gS.stroke();
    }
  }

  // 포인터 장애물 + 유휴 자동 커서
  const onMove = e => { const r = root.getBoundingClientRect(); cur.tx = Math.min(.96, Math.max(.04, (e.clientX - r.left) / r.width)); cur.ty = Math.min(.96, Math.max(.04, (e.clientY - r.top) / r.height)); lastUser = performance.now(); };
  root.addEventListener('pointermove', onMove);
  const chipOff = chips.map((b, i) => { const f = () => setMode(i); b.addEventListener('click', f); return () => b.removeEventListener('click', f); });
  function setMode(i) { mode = i; chips.forEach((c, j) => c.classList.toggle('is-on', j === i)); root.dataset.mode = i; }
  setMode(0);

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabOn = !document.hidden; last = performance.now(); }; document.addEventListener('visibilitychange', onVis);
  let rt = 0;
  const onRes = () => { clearTimeout(rt); rt = setTimeout(() => { const r = root.getBoundingClientRect(); if (Math.abs(r.width - secW) > 24 || Math.abs(r.height - secH) > 24) build(); }, 250); };
  addEventListener('resize', onRes);

  build();

  const off = ctx.tick(() => {
    if (!visible || !tabOn || !L) return;
    const now = performance.now(); acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (acc < 1 / 20) return; acc = 0;
    const t0 = performance.now(); t += 1 / 20; frame++;
    if (now - lastUser > 2500) { cur.tx = 0.2 + 0.07 * Math.sin(t * 0.7); cur.ty = 0.5 + 0.3 * Math.sin(t * 0.5 + 0.6); }
    const dx = cur.tx - cur.x, dy = cur.ty - cur.y, d = Math.hypot(dx * W, dy * H), mx = 1.6; // 프레임당 최대 1.6셀 이동
    if (d > mx) { cur.x += dx * mx / d; cur.y += dy * mx / d; } else { cur.x = cur.tx; cur.y = cur.ty; }
    updateMask();
    ring.style.transform = `translate(${(cur.x * secW - cur.r * cell).toFixed(1)}px,${(cur.y * secH - cur.r * cell).toFixed(1)}px)`;
    for (let i = 0; i < stepsPF; i++) L.step();
    stepParticles(stepsPF);
    if (frame % 40 === 0) { const s = L.stats(); if (s.bad > 6) { L.reset(0.02); mask.set(base); cur.cx = -1; L.setMask(mask); for (let i = 0; i < 200; i++) L.step(); } }
    renderField(L, mode, img.data); gF.putImageData(img, 0, 0);
    drawParticles();
    root.__s152 = L;
    cost = cost * 0.8 + (performance.now() - t0) * 0.2; // 프레임 비용에 맞춰 스텝 수 조절
    stepsPF = Math.max(8, Math.min(18, Math.round(stepsPF * (24 / Math.max(8, cost)) * 0.5 + stepsPF * 0.5)));
  });

  return () => {
    off(); io.disconnect(); clearTimeout(rt); root.removeEventListener('pointermove', onMove);
    chipOff.forEach(f => f()); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRes);
  };
}
