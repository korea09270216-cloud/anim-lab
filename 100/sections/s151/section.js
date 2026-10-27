// s151 — Stable Fluids (Stam 1999) CPU 구현, MAC 스태거드 격자. 속도 W×H(128 폭) · 염료 1.5배 해상도.
// 외력 → 와도 구속 → 이류(RK2 semi-Lagrangian) → 발산 → Jacobi 압력(20회, warm start) → ∇p 제거 → 염료 이류.
// 장애물(글자 "결" + 카피 카드)은 solid 마스크: 면 속도 0 + 압력 Neumann(고체 이웃은 제외하고 평균).

export function createFluid(W, H, DW, DH) {
  const N = W * H, DN = DW * DH, UW = W + 1;
  let U = new Float32Array(UW * H), V = new Float32Array(W * (H + 1)), Ut = new Float32Array(UW * H), Vt = new Float32Array(W * (H + 1));
  let p = new Float32Array(N), pt = new Float32Array(N);
  const dv = new Float32Array(N), cu = new Float32Array(N), cv = new Float32Array(N), cr = new Float32Array(N), ffx = new Float32Array(N), ffy = new Float32Array(N);
  const solid = new Uint8Array(N), nf = new Uint8Array(N), dsolid = new Uint8Array(DN);
  let dye = new Float32Array(DN * 3), dyet = new Float32Array(DN * 3);
  const P = { eps: 0.35, iters: 20, damp: 0.996, fade: 0.9984, umax: 2.8, dmax: 2.8 };
  const kx = DW / W, ky = DH / H;

  function zeroSolidFaces() {
    for (let j = 0; j < H; j++) for (let i = 0; i < UW; i++) {
      const l = i > 0 ? solid[j * W + i - 1] : 1, r = i < W ? solid[j * W + i] : 1;
      if (l || r) U[j * UW + i] = 0;
    }
    for (let j = 0; j <= H; j++) for (let i = 0; i < W; i++) {
      const b = j > 0 ? solid[(j - 1) * W + i] : 1, t = j < H ? solid[j * W + i] : 1;
      if (b || t) V[j * W + i] = 0;
    }
  }
  function setSolid(mask) {
    solid.set(mask);
    for (let i = 0; i < W; i++) { solid[i] = 1; solid[(H - 1) * W + i] = 1; }
    for (let j = 0; j < H; j++) { solid[j * W] = 1; solid[j * W + W - 1] = 1; }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i; nf[k] = solid[k] ? 0 : 4 - solid[k - 1] - solid[k + 1] - solid[k - W] - solid[k + W];
    }
    for (let j = 0; j < DH; j++) {
      const sj = Math.min(H - 1, ((j + 0.5) / ky) | 0);
      for (let i = 0; i < DW; i++) dsolid[j * DW + i] = solid[sj * W + Math.min(W - 1, ((i + 0.5) / kx) | 0)];
    }
    for (let k = 0; k < N; k++) if (solid[k]) p[k] = 0;
    for (let k = 0; k < DN; k++) if (dsolid[k]) { dye[k * 3] = dye[k * 3 + 1] = dye[k * 3 + 2] = 0; }
    zeroSolidFaces();
  }

  const sU = (x, y) => {
    let gx = x, gy = y - 0.5; gx = gx < 0 ? 0 : gx > W - 0.001 ? W - 0.001 : gx; gy = gy < 0 ? 0 : gy > H - 1.001 ? H - 1.001 : gy;
    const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, k = j * UW + i;
    return (U[k] * (1 - fx) + U[k + 1] * fx) * (1 - fy) + (U[k + UW] * (1 - fx) + U[k + UW + 1] * fx) * fy;
  };
  const sV = (x, y) => {
    let gx = x - 0.5, gy = y; gx = gx < 0 ? 0 : gx > W - 1.001 ? W - 1.001 : gx; gy = gy < 0 ? 0 : gy > H - 0.001 ? H - 0.001 : gy;
    const i = gx | 0, j = gy | 0, fx = gx - i, fy = gy - j, k = j * W + i;
    return (V[k] * (1 - fx) + V[k + 1] * fx) * (1 - fy) + (V[k + W] * (1 - fx) + V[k + W + 1] * fx) * fy;
  };

  // 가우시안 외력. x,y = 셀 좌표(셀 중심 = i+.5), 속도는 셀/스텝
  function splatVel(x, y, fx, fy, sig) {
    const R = Math.ceil(sig * 3), s2 = 1 / (2 * sig * sig);
    const x0 = Math.max(1, (x - R) | 0), x1 = Math.min(W - 1, (x + R + 1) | 0);
    const y0 = Math.max(1, (y - R) | 0), y1 = Math.min(H - 2, (y + R + 1) | 0);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const k = j * W + i;
      if (!solid[k] && !solid[k - 1]) { const g = Math.exp(-((i - x) * (i - x) + (j + 0.5 - y) * (j + 0.5 - y)) * s2); U[j * UW + i] += fx * g; }
      if (!solid[k] && !solid[k - W]) { const g = Math.exp(-((i + 0.5 - x) * (i + 0.5 - x) + (j - y) * (j - y)) * s2); V[j * W + i] += fy * g; }
    }
  }
  function splatDye(x, y, a, b, c, sig) {
    const dx = x * kx - 0.5, dy = y * ky - 0.5, ds = sig * kx;
    const R = Math.ceil(ds * 3), s2 = 1 / (2 * ds * ds), M = P.dmax;
    const x0 = Math.max(0, (dx - R) | 0), x1 = Math.min(DW - 1, (dx + R) | 0);
    const y0 = Math.max(0, (dy - R) | 0), y1 = Math.min(DH - 1, (dy + R) | 0);
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const k = j * DW + i; if (dsolid[k]) continue;
      const g = Math.exp(-((i - dx) * (i - dx) + (j - dy) * (j - dy)) * s2), q = k * 3;
      dye[q] = Math.min(M, dye[q] + a * g); dye[q + 1] = Math.min(M, dye[q + 1] + b * g); dye[q + 2] = Math.min(M, dye[q + 2] + c * g);
    }
  }

  function centerVel() {
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i; cu[k] = 0.5 * (U[j * UW + i] + U[j * UW + i + 1]); cv[k] = 0.5 * (V[j * W + i] + V[(j + 1) * W + i]);
    }
  }
  function confine(eps) {
    centerVel();
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i; cr[k] = (cv[k + 1] - cv[k - 1] - (cu[k + W] - cu[k - W])) * 0.5; ffx[k] = ffy[k] = 0;
    }
    for (let j = 2; j < H - 2; j++) for (let i = 2; i < W - 2; i++) {
      const k = j * W + i;
      if (solid[k] || solid[k - 1] || solid[k + 1] || solid[k - W] || solid[k + W]) continue;
      const gx = (Math.abs(cr[k + 1]) - Math.abs(cr[k - 1])) * 0.5, gy = (Math.abs(cr[k + W]) - Math.abs(cr[k - W])) * 0.5;
      const w = cr[k] * eps / (Math.sqrt(gx * gx + gy * gy) + 1e-5);
      ffx[k] = gy * w; ffy[k] = -gx * w;
    }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!solid[k] && !solid[k - 1]) U[j * UW + i] += 0.5 * (ffx[k - 1] + ffx[k]);
      if (!solid[k] && !solid[k - W]) V[j * W + i] += 0.5 * (ffy[k - W] + ffy[k]);
    }
  }

  function advectVel() {
    const dm = P.damp;
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!solid[k] && !solid[k - 1]) { // u 면: (i, j+.5)
        const x = i, y = j + 0.5, u0 = U[j * UW + i], v0 = sV(x, y);
        const xm = x - 0.5 * u0, ym = y - 0.5 * v0;
        Ut[j * UW + i] = sU(x - sU(xm, ym), y - sV(xm, ym)) * dm;
      } else Ut[j * UW + i] = 0;
      if (!solid[k] && !solid[k - W]) { // v 면: (i+.5, j)
        const x = i + 0.5, y = j, u0 = sU(x, y), v0 = V[j * W + i];
        const xm = x - 0.5 * u0, ym = y - 0.5 * v0;
        Vt[j * W + i] = sV(x - sU(xm, ym), y - sV(xm, ym)) * dm;
      } else Vt[j * W + i] = 0;
    }
    let s = U; U = Ut; Ut = s; s = V; V = Vt; Vt = s;
  }

  function computeDiv() {
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i; dv[k] = solid[k] ? 0 : U[j * UW + i + 1] - U[j * UW + i] + V[(j + 1) * W + i] - V[j * W + i];
    }
  }
  function project() {
    computeDiv();
    for (let it = 0; it < P.iters; it++) {
      for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
        const k = j * W + i;
        if (solid[k]) { pt[k] = 0; continue; }
        pt[k] = ((solid[k - 1] ? 0 : p[k - 1]) + (solid[k + 1] ? 0 : p[k + 1]) + (solid[k - W] ? 0 : p[k - W]) + (solid[k + W] ? 0 : p[k + W]) - dv[k]) / nf[k];
      }
      const s = p; p = pt; pt = s;
    }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!solid[k] && !solid[k - 1]) U[j * UW + i] -= p[k] - p[k - 1];
      if (!solid[k] && !solid[k - W]) V[j * W + i] -= p[k] - p[k - W];
    }
  }

  function advectDye() {
    const mdx = DW - 1.001, mdy = DH - 1.001, f = P.fade;
    for (let j = 0; j < DH; j++) {
      const y = (j + 0.5) / ky;
      for (let i = 0; i < DW; i++) {
        const dk = j * DW + i, q3 = dk * 3;
        if (dsolid[dk]) { dyet[q3] = dyet[q3 + 1] = dyet[q3 + 2] = 0; continue; }
        const x = (i + 0.5) / kx, ux = sU(x, y), vy = sV(x, y);
        let sx = (x - ux) * kx - 0.5, sy = (y - vy) * ky - 0.5;
        sx = sx < 0 ? 0 : sx > mdx ? mdx : sx; sy = sy < 0 ? 0 : sy > mdy ? mdy : sy;
        const ix = sx | 0, iy = sy | 0, ax = sx - ix, ay = sy - iy, a = (iy * DW + ix) * 3, b = a + DW * 3;
        const w00 = (1 - ax) * (1 - ay) * f, w10 = ax * (1 - ay) * f, w01 = (1 - ax) * ay * f, w11 = ax * ay * f;
        dyet[q3] = dye[a] * w00 + dye[a + 3] * w10 + dye[b] * w01 + dye[b + 3] * w11;
        dyet[q3 + 1] = dye[a + 1] * w00 + dye[a + 4] * w10 + dye[b + 1] * w01 + dye[b + 4] * w11;
        dyet[q3 + 2] = dye[a + 2] * w00 + dye[a + 5] * w10 + dye[b + 2] * w01 + dye[b + 5] * w11;
      }
    }
    const s = dye; dye = dyet; dyet = s;
  }

  function step() {
    const um = P.umax; // 속도 clamp (안전장치)
    for (let k = 0; k < U.length; k++) { const a = U[k]; if (a > um) U[k] = um; else if (a < -um) U[k] = -um; }
    for (let k = 0; k < V.length; k++) { const a = V[k]; if (a > um) V[k] = um; else if (a < -um) V[k] = -um; }
    confine(P.eps);
    advectVel();
    project();
    advectDye();
  }

  // 진단: 유체 셀 최대 |∇·u| (투영 전/후), 운동에너지, NaN 개수
  function maxDiv() { computeDiv(); let m = 0; for (let k = 0; k < N; k++) { const d = Math.abs(dv[k]); if (d > m) m = d; } return m; }
  function stats() {
    centerVel(); let e = 0, bad = 0;
    for (let k = 0; k < N; k++) { e += cu[k] * cu[k] + cv[k] * cv[k]; if (!(cu[k] === cu[k]) || !(cv[k] === cv[k])) bad++; }
    return { maxDiv: maxDiv(), energy: e, bad };
  }

  return {
    W, H, DW, DH, P, setSolid, splatVel, splatDye, step, stats, maxDiv,
    get dye() { return dye; }, get dsolid() { return dsolid; }, get solid() { return solid; },
  };
}

// 염료 = 흡광도(R,G,B). 종이색 × exp(-흡광) 으로 감산 혼합.
const INKS = [
  { n: '인디고', a: [1.95, 1.45, 0.42], css: '#243b8c' },
  { n: '주홍', a: [0.1, 1.55, 2.35], css: '#d8361a' },
  { n: '샤프란', a: [0.04, 0.5, 2.3], css: '#e69a1a' },
  { n: '청록', a: [1.55, 0.3, 0.6], css: '#2fa07e' },
];
const PAPER = [244, 238, 224];

export default function init(root, ctx) {
  const cv = root.querySelector('.s151__fluid'), ov = root.querySelector('.s151__over'), card = root.querySelector('.s151__card');
  const sw = [...root.querySelectorAll('.s151__sw')];
  const g2 = cv.getContext('2d');
  if (!g2) { root.classList.add('is-static'); return; }
  const FONT = "900 {S}px 'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const GLYPH = '결', GX = 0.66, GY = 0.52, GS = 0.7; // 중심(섹션 비율), 글자 크기(섹션 높이 비율)

  let fl = null, img = null, secW = 1, secH = 1, visible = true, tabOn = true, pending = [];
  let inkSel = 0, lastUser = -1e9, acc = 0, last = performance.now(), simT = 0, jetT = 1.2, jets = [], wan = { x: .66, y: .5 }, autoInk = 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);

  function drawGlyph(c, scale, sx, sy, strokeW) {
    c.font = FONT.replace('{S}', (GS * secH * scale).toFixed(1)); c.textAlign = 'center'; c.textBaseline = 'middle';
    if (strokeW) { c.lineWidth = strokeW; c.lineJoin = 'round'; c.strokeText(GLYPH, GX * secW * scale + sx, GY * secH * scale + sy); }
    c.fillText(GLYPH, GX * secW * scale + sx, GY * secH * scale + sy);
  }

  function build() {
    const r = root.getBoundingClientRect(); secW = Math.max(320, r.width); secH = Math.max(300, r.height);
    const W = 128, H = Math.max(48, Math.min(96, Math.round(W * secH / secW))), DW = Math.round(W * 1.75), DH = Math.round(H * 1.75);
    fl = createFluid(W, H, DW, DH);
    cv.width = DW; cv.height = DH; img = g2.createImageData(DW, DH);
    // 마스크: 글자 + 카드(둥근 사각형)
    const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
    const m = mc.getContext('2d', { willReadFrequently: true });
    m.fillStyle = '#000'; drawGlyph(m, W / secW, 0, 0, 0);
    const cr = card.getBoundingClientRect(), k = W / secW, pad = 0.5;
    m.fillRect((cr.left - r.left) * k - pad, (cr.top - r.top) * k - pad, cr.width * k + pad * 2, cr.height * k + pad * 2);
    const d = m.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = d[i * 4 + 3] > 96 ? 1 : 0;
    fl.setSolid(mask);
    // 오버레이: 종이 결 + 선명한 글자
    ov.width = Math.round(secW * dpr); ov.height = Math.round(secH * dpr);
    const o = ov.getContext('2d'); o.clearRect(0, 0, ov.width, ov.height);
    const gr = o.createLinearGradient(0, (GY - GS / 2) * secH * dpr, 0, (GY + GS / 2) * secH * dpr);
    gr.addColorStop(0, '#2a2118'); gr.addColorStop(1, '#0f0c09');
    o.strokeStyle = 'rgba(244,238,224,.95)'; o.fillStyle = gr; drawGlyph(o, dpr, 0, 0, 13 * dpr);
    const t = document.createElement('canvas'); t.width = t.height = 160; const tc = t.getContext('2d'), td = tc.createImageData(160, 160);
    for (let i = 0; i < td.data.length; i += 4) { const n = Math.random(); td.data[i] = td.data[i + 1] = td.data[i + 2] = n > .5 ? 255 : 60; td.data[i + 3] = Math.abs(n - .5) * 26; }
    tc.putImageData(td, 0, 0);
    o.globalCompositeOperation = 'source-over'; o.fillStyle = o.createPattern(t, 'repeat'); o.fillRect(0, 0, ov.width, ov.height);
    warm();
  }

  function inkSplat(nx, ny, fx, fy, ink, amt, sig) {
    const W = fl.W, H = fl.H, x = nx * W, y = ny * H, a = INKS[ink].a;
    fl.splatVel(x, y, fx, fy, sig);
    if (amt > 0) fl.splatDye(x, y, a[0] * amt, a[1] * amt, a[2] * amt, sig);
  }
  function burst(nx, ny, ink, amt) { // 방사형 방울: 바깥으로 밀어내는 속도 + 염료
    const W = fl.W, H = fl.H, x = nx * W, y = ny * H, a = INKS[ink].a;
    for (let q = 0; q < 10; q++) {
      const t = q / 10 * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
      fl.splatVel(x + c * 2.4, y + s * 2.4, c * 0.9, s * 0.9, 2.1);
    }
    fl.splatDye(x, y, a[0] * amt, a[1] * amt, a[2] * amt, 3.2);
  }

  function warm() { // 첫 화면부터 소용돌이가 보이게 제트 3발 + 시뮬 선행
    pending = []; jets = [];
    const seeds = [[.5, .3, .9, .5, 0], [.82, .74, -.8, -.5, 1], [.46, .72, .8, -.7, 2]];
    seeds.forEach(s => jets.push({ nx: s[0], ny: s[1], fx: s[2] * 2.2, fy: s[3] * 2.2, ink: s[4], n: 7 }));
    for (let f = 0; f < 42; f++) { applyJets(); autoBrush(1 / 30); applyPending(); fl.step(); }
  }

  function applyJets() {
    for (let i = jets.length - 1; i >= 0; i--) {
      const j = jets[i]; inkSplat(j.nx, j.ny, j.fx, j.fy, j.ink, 0.85, 2.3);
      if (--j.n <= 0) jets.splice(i, 1);
    }
  }
  function applyPending() { for (const s of pending) inkSplat(s.nx, s.ny, s.fx, s.fy, s.ink, s.amt, s.sig); pending.length = 0; }

  function autoBrush(dt) {
    simT += dt;
    const nx = 0.66 + 0.26 * Math.sin(simT * 0.52) * Math.cos(simT * 0.19), ny = 0.5 + 0.34 * Math.sin(simT * 0.83 + 1.1);
    const vx = (nx - wan.x) * fl.W * 1.3, vy = (ny - wan.y) * fl.H * 1.3; wan.x = nx; wan.y = ny;
    if ((simT * 0.45 | 0) !== ((simT - dt) * 0.45 | 0)) autoInk = (autoInk + 1) % INKS.length;
    inkSplat(nx, ny, vx, vy, autoInk, 0.62, 2.4);
    jetT -= dt;
    if (jetT <= 0) {
      jetT = 2.3 + Math.random() * 1.2;
      const a = Math.random() * 6.283, nx2 = .42 + Math.random() * .5, ny2 = .18 + Math.random() * .64;
      jets.push({ nx: nx2, ny: ny2, fx: Math.cos(a) * 2.2, fy: Math.sin(a) * 2.2, ink: (autoInk + 2) % INKS.length, n: 6 });
    }
  }

  function render() {
    const d = img.data, dye = fl.dye, n = fl.DW * fl.DH;
    for (let k = 0, j = 0, q = 0; k < n; k++, j += 4, q += 3) {
      d[j] = PAPER[0] * Math.exp(-dye[q]); d[j + 1] = PAPER[1] * Math.exp(-dye[q + 1]); d[j + 2] = PAPER[2] * Math.exp(-dye[q + 2]); d[j + 3] = 255;
    }
    g2.putImageData(img, 0, 0);
  }

  // 포인터
  let prev = null;
  const toN = e => { const r = root.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
  const onMove = e => {
    if (!fl) return; const p = toN(e); lastUser = performance.now();
    if (prev) {
      const dx = (p.x - prev.x) * fl.W, dy = (p.y - prev.y) * fl.H, L = Math.hypot(dx, dy), n = Math.max(1, Math.ceil(L / 1.4));
      for (let i = 1; i <= n; i++) { const t = i / n; pending.push({ nx: prev.x + (p.x - prev.x) * t, ny: prev.y + (p.y - prev.y) * t, fx: dx / n * 1.1, fy: dy / n * 1.1, ink: inkSel, amt: 0.6, sig: 2.5 }); }
      if (pending.length > 80) pending.splice(0, pending.length - 80);
    }
    prev = p;
  };
  const onLeave = () => { prev = null; };
  const onDown = e => { if (!fl || e.target.closest('a,button')) return; const p = toN(e); lastUser = performance.now(); burst(p.x, p.y, inkSel, 1.0); };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave); root.addEventListener('pointerdown', onDown);
  const swOff = sw.map((b, i) => {
    const f = () => { inkSel = i; sw.forEach((s, j) => s.classList.toggle('is-on', j === i)); burst(.5 + .1 * i, .5, i, .8); };
    b.addEventListener('click', f); return () => b.removeEventListener('click', f);
  });
  sw.forEach((b, i) => { b.style.setProperty('--ink', INKS[i].css); b.setAttribute('aria-label', INKS[i].n + ' 잉크'); b.title = INKS[i].n; });
  sw[0] && sw[0].classList.add('is-on');

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabOn = !document.hidden; last = performance.now(); }; document.addEventListener('visibilitychange', onVis);
  let rt = 0;
  const onRes = () => { clearTimeout(rt); rt = setTimeout(() => { const r = root.getBoundingClientRect(); if (Math.abs(r.width - secW) > 24 || Math.abs(r.height - secH) > 24) build(); }, 250); };
  addEventListener('resize', onRes);

  build();

  const off = ctx.tick(() => {
    if (!visible || !tabOn || !fl) return;
    const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000); acc += dt; last = now;
    if (acc < 1 / 28) return; acc = 0;
    if (now - lastUser > 2200) { applyJets(); autoBrush(1 / 28); } else { applyJets(); simT += 1 / 28; }
    applyPending();
    fl.step();
    render();
    root.__s151 = fl;
  });
  render();

  return () => {
    off(); io.disconnect(); clearTimeout(rt);
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave); root.removeEventListener('pointerdown', onDown);
    swOff.forEach(f => f()); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRes);
  };
}
