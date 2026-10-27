// s182 · Fractal Flame (Draves) — 비선형 변환 IFS 카오스 게임 + 로그 밀도 누적 + 감마/vibrancy 톤매핑
// 알고리즘: 3~4개 변환 = 아핀(극좌표 파라미터 θ,sx,sy,shear,tx,ty) 뒤에 variation 1~3개의 가중합(sinusoidal/spherical/swirl/horseshoe/polar/handkerchief/heart/disc/spiral/julia…)
//          점 하나를 수백만 번 이동시키며 [개수, 색 지표] 히스토그램에 누적(회전 대칭 복제 plot) → 감쇠(잔상)로 파라미터가 흐르는 동안에도 수렴
//          표시: A=log(1+k·a)/log(1+k·amax) → 알파 A^(1/γ), vibrancy 로 채도/밝기 혼합. 종이 위에 잉크를 곱하는(multiply) 톤매핑
const W = 288, H = 288, N = W * H;
const SYMS = [1, 2, 3, 4, 5, 6];
const VARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 20];

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let VX = 0, VY = 0;
// flam3 정의: r=√(x²+y²), θ=atan2(x,y), φ=atan2(y,x)
function addVar(t, x, y, w, rs) {
  const r2 = x * x + y * y + 1e-12, r = Math.sqrt(r2);
  switch (t) {
    case 1: VX += w * Math.sin(x); VY += w * Math.sin(y); break;
    case 2: VX += w * x / r2; VY += w * y / r2; break;
    case 3: { const s = Math.sin(r2), c = Math.cos(r2); VX += w * (x * s - y * c); VY += w * (x * c + y * s); break; }
    case 4: VX += w * (x - y) * (x + y) / r; VY += w * 2 * x * y / r; break;
    case 5: VX += w * Math.atan2(x, y) / Math.PI; VY += w * (r - 1); break;
    case 6: { const th = Math.atan2(x, y); VX += w * r * Math.sin(th + r); VY += w * r * Math.cos(th - r); break; }
    case 7: { const th = Math.atan2(x, y); VX += w * r * Math.sin(th * r); VY -= w * r * Math.cos(th * r); break; }
    case 8: { const th = Math.atan2(x, y) / Math.PI; VX += w * th * Math.sin(Math.PI * r); VY += w * th * Math.cos(Math.PI * r); break; }
    case 9: { const th = Math.atan2(x, y); VX += w * (Math.cos(th) + Math.sin(r)) / r; VY += w * (Math.sin(th) - Math.cos(r)) / r; break; }
    case 10: { const th = Math.atan2(x, y); VX += w * Math.sin(th) / r; VY += w * r * Math.cos(th); break; }
    case 11: { const th = Math.atan2(x, y); VX += w * Math.sin(th) * Math.cos(r); VY += w * Math.cos(th) * Math.sin(r); break; }
    case 12: { const th = Math.atan2(x, y), p0 = Math.sin(th + r), p1 = Math.cos(th - r), a3 = p0 * p0 * p0, b3 = p1 * p1 * p1; VX += w * r * (a3 + b3); VY += w * r * (a3 - b3); break; }
    case 13: { const th = Math.atan2(x, y), om = rs ? Math.PI : 0, sr = Math.sqrt(r); VX += w * sr * Math.cos(th / 2 + om); VY += w * sr * Math.sin(th / 2 + om); break; }
    case 14: { const k = 2 / (r + 1); VX += w * k * y; VY += w * k * x; break; }
    case 15: { const e = Math.exp(Math.min(8, x - 1)); VX += w * e * Math.cos(Math.PI * y); VY += w * e * Math.sin(Math.PI * y); break; }
    case 17: { const k = 4 / (r2 + 4); VX += w * k * x; VY += w * k * y; break; }
    case 20: VX += w * Math.sin(x); VY += w * y; break;
    default: VX += w * x; VY += w * y;
  }
}

// 위상(변환 개수·variation 종류·색)은 topoSeed, 수치(회전·크기·이동·가중)는 coefSeed
function makeGenome(topoSeed, coefSeed) {
  const tr = rng32(topoSeed), cr = rng32(coefSeed);
  const n = 3 + ((tr() * 2) | 0), sym = SYMS[(tr() * SYMS.length) | 0];
  const vt = [], col = [];
  for (let i = 0; i < n; i++) {
    const nv = 1 + ((tr() * 2.4) | 0), a = [];
    while (a.length < nv) { const v = VARS[(tr() * VARS.length) | 0]; if (a.indexOf(v) < 0) a.push(v); }
    vt.push(a); col.push((i + tr() * 0.6) / n);
  }
  const P = new Float64Array(n * 10);
  for (let i = 0; i < n; i++) {
    const o = i * 10;
    P[o] = cr() * Math.PI * 2; P[o + 1] = 0.42 + cr() * 0.42; P[o + 2] = 0.42 + cr() * 0.42; P[o + 3] = (cr() - 0.5) * 0.7;
    P[o + 4] = (cr() - 0.5) * 2; P[o + 5] = (cr() - 0.5) * 2; P[o + 6] = 0.35 + cr() * 0.65;
    let s = 0; for (let k = 0; k < 3; k++) { P[o + 7 + k] = k < vt[i].length ? 0.35 + cr() * 0.65 : 0; s += P[o + 7 + k]; }
    for (let k = 0; k < 3; k++) P[o + 7 + k] /= s;
  }
  return { n, sym, vt, col, P };
}

function lerpP(A, B, u, out) {
  for (let i = 0; i < A.length; i++) {
    if (i % 10 === 0) { let d = B[i] - A[i]; d -= Math.PI * 2 * Math.round(d / (Math.PI * 2)); out[i] = A[i] + d * u; }
    else out[i] = A[i] + (B[i] - A[i]) * u;
  }
  return out;
}

// 극좌표 파라미터 → 반복 루프용 평탄 배열
function compile(G, P) {
  const n = G.n, C = { n, sym: G.sym, A: new Float64Array(n * 6), vt: new Int32Array(n * 3), vw: new Float64Array(n * 3), cw: new Float64Array(n), col: new Float64Array(n) };
  let cum = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 10, th = P[o], c = Math.cos(th), s = Math.sin(th), sx = P[o + 1], sy = P[o + 2], sh = P[o + 3];
    C.A[i * 6] = sx * c; C.A[i * 6 + 1] = -sy * s + sh * c * 0.5; C.A[i * 6 + 2] = P[o + 4];
    C.A[i * 6 + 3] = sx * s; C.A[i * 6 + 4] = sy * c + sh * s * 0.5; C.A[i * 6 + 5] = P[o + 5];
    for (let k = 0; k < 3; k++) { C.vt[i * 3 + k] = k < G.vt[i].length ? G.vt[i][k] : 0; C.vw[i * 3 + k] = P[o + 7 + k]; }
    cum += P[o + 6]; C.cw[i] = cum; C.col[i] = G.col[i];
  }
  return C;
}

// 카오스 게임 한 덩어리를 돌려 hist 에 누적. view=(cx,cy,half). 반환=찍은 점 수
function plotBatch(S, C, count) {
  const hist = S.hist, cs = S.cs, vs = W / (2 * S.half), ox = W / 2 - S.cx * vs, oy = H / 2 - S.cy * vs;
  const sym = C.sym, n = C.n, A = C.A, vt = C.vt, vw = C.vw, cw = C.cw, col = C.col, tot = cw[n - 1];
  let x = S.x, y = S.y, c = S.c, rs = S.rs, sn = S.sn;
  const co = S.symCos, si = S.symSin; let pts = 0;
  for (let it = 0; it < count; it++) {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    const u = ((rs >>> 0) / 4294967296) * tot; let i = 0; while (i < n - 1 && u > cw[i]) i++;
    const ax = A[i * 6] * x + A[i * 6 + 1] * y + A[i * 6 + 2], ay = A[i * 6 + 3] * x + A[i * 6 + 4] * y + A[i * 6 + 5];
    VX = 0; VY = 0;
    for (let k = 0; k < 3; k++) { const w = vw[i * 3 + k]; if (w > 0) addVar(vt[i * 3 + k], ax, ay, w, (rs & 0x100) !== 0); }
    x = VX; y = VY; c = (c + col[i]) * 0.5;
    if (!(x * x + y * y < 1e10)) { rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; x = ((rs >>> 0) / 4294967296 - 0.5) * 2; y = ((rs >>> 8 & 0xffff) / 65536 - 0.5) * 2; continue; }
    if (it < 16) continue;
    if (sn < 2048 && (it & 7) === 0) { S.sxs[sn] = x; S.sys[sn] = y; sn++; }
    for (let k = 0; k < sym; k++) {
      const rx = x * co[k] - y * si[k], ry = x * si[k] + y * co[k];
      const px = (rx * vs + ox) | 0, py = (ry * vs + oy) | 0;
      if (px >= 0 && px < W && py >= 0 && py < H) { const idx = py * W + px; hist[idx] += 1; cs[idx] += c; pts++; }
    }
  }
  S.x = x; S.y = y; S.c = c; S.rs = rs; S.sn = sn;
  return pts;
}

function makeSim(seed) {
  const S = { hist: new Float32Array(N), cs: new Float32Array(N), x: 0.1, y: 0.2, c: 0.5, rs: (seed * 2654435761) | 1, cx: 0, cy: 0, half: 2, mx: 30, total: 0, symCos: new Float64Array(8), symSin: new Float64Array(8), sxs: new Float32Array(2048), sys: new Float32Array(2048), sn: 0 };
  return S;
}
// 이번 프레임에 찍힌 점의 백분위로 뷰를 맞춘다(보간 중 경계가 변해도 따라간다)
function fitView(S, sym, k) {
  const n = S.sn; S.sn = 0; if (n < 256) return;
  let tcx = 0, tcy = 0, th;
  if (sym > 1) {
    const r = new Float32Array(n); for (let i = 0; i < n; i++) r[i] = Math.hypot(S.sxs[i], S.sys[i]);
    r.sort(); th = r[(n * 0.95) | 0] * 1.22;
  } else {
    const a = S.sxs.slice(0, n).sort(), b = S.sys.slice(0, n).sort();
    const x0 = a[(n * 0.03) | 0], x1 = a[(n * 0.97) | 0], y0 = b[(n * 0.03) | 0], y1 = b[(n * 0.97) | 0];
    tcx = (x0 + x1) / 2; tcy = (y0 + y1) / 2; th = Math.max(x1 - x0, y1 - y0) * 0.62;
  }
  th = Math.min(40, Math.max(0.5, th));
  S.cx += (tcx - S.cx) * k; S.cy += (tcy - S.cy) * k; S.half += (th - S.half) * k;
}
function setSym(S, sym) { for (let k = 0; k < sym; k++) { S.symCos[k] = Math.cos(k * Math.PI * 2 / sym); S.symSin[k] = Math.sin(k * Math.PI * 2 / sym); } }

// 유효성 + 뷰 맞춤: 18k 점을 돌려 발산/점유율/경계(백분위)를 잰다
function probe(G, P, seed) {
  const C = compile(G, P), S = makeSim(seed + 7);
  setSym(S, G.sym);
  const xs = new Float32Array(18000), ys = new Float32Array(18000);
  let x = 0.1, y = 0.2, cnt = 0, rs = S.rs, bad = 0;
  for (let it = 0; it < 18000 + 16; it++) {
    rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5;
    const u = ((rs >>> 0) / 4294967296) * C.cw[C.n - 1]; let i = 0; while (i < C.n - 1 && u > C.cw[i]) i++;
    const ax = C.A[i * 6] * x + C.A[i * 6 + 1] * y + C.A[i * 6 + 2], ay = C.A[i * 6 + 3] * x + C.A[i * 6 + 4] * y + C.A[i * 6 + 5];
    VX = 0; VY = 0;
    for (let k = 0; k < 3; k++) { const w = C.vw[i * 3 + k]; if (w > 0) addVar(C.vt[i * 3 + k], ax, ay, w, (rs & 0x100) !== 0); }
    x = VX; y = VY;
    if (!(x * x + y * y < 1e8)) { bad++; x = 0.1; y = 0.2; continue; }
    if (it >= 16) { xs[cnt] = x; ys[cnt] = y; cnt++; }
  }
  if (bad > 40 || cnt < 12000) return { ok: false };
  const sx = xs.slice(0, cnt).sort(), sy = ys.slice(0, cnt).sort();
  const q = (a, f) => a[Math.min(cnt - 1, (cnt * f) | 0)];
  const x0 = q(sx, 0.01), x1 = q(sx, 0.99), y0 = q(sy, 0.01), y1 = q(sy, 0.99);
  const ext = Math.max(x1 - x0, y1 - y0);
  if (!(ext > 0.6) || ext > 60) return { ok: false };
  let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, half = ext * 0.62;
  if (G.sym > 1) { let rm = 0; for (let i = 0; i < cnt; i += 4) { const r = Math.hypot(xs[i], ys[i]); if (r > rm) rm = r; } const rr = Math.max(q(sx, 0.99) - 0, 0); cx = 0; cy = 0; half = Math.max(ext, Math.min(rm, ext * 1.6)) * 0.66; }
  const GG = 40, grid = new Uint8Array(GG * GG); let occ = 0;
  for (let i = 0; i < cnt; i++) {
    const gx = Math.min(GG - 1, Math.max(0, ((xs[i] - x0) / (x1 - x0 + 1e-9) * GG) | 0)), gy = Math.min(GG - 1, Math.max(0, ((ys[i] - y0) / (y1 - y0 + 1e-9) * GG) | 0));
    if (!grid[gy * GG + gx]) { grid[gy * GG + gx] = 1; occ++; }
  }
  const o = occ / (GG * GG);
  return { ok: o > 0.07, occ: o, cx, cy, half };
}

function stopsToLut(stops) {
  const out = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const s0 = stops[k], s1 = stops[k + 1], f = Math.min(1, Math.max(0, (t - s0[0]) / (s1[0] - s0[0])));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = (s0[1][c] + (s1[1][c] - s0[1][c]) * f) / 255;
  }
  return out;
}
// 순환 팔레트(끝=처음): 주홍 → 마젠타 → 남보라 → 청록 → 겨자 → 주홍
const INK = stopsToLut([[0, [214, 40, 24]], [0.2, [176, 14, 96]], [0.4, [38, 30, 138]], [0.6, [0, 112, 128]], [0.8, [214, 140, 4]], [1, [214, 40, 24]]]);
const PAPER = [244, 238, 224];
const GAMLUT = new Float32Array(1025);

function tonemap(S, px32, shift, gamma, vib, gain) {
  gain = gain || 1.4;
  const hist = S.hist, cs = S.cs, ig = 1 / gamma;
  for (let i = 0; i <= 1024; i++) GAMLUT[i] = Math.pow(i / 1024, ig);
  const k = 0.22, inv = 1 / Math.log(1 + S.mx * k);
  let mx = 0, rr = PAPER[0], gg = PAPER[1], bb = PAPER[2];
  const paper = (255 << 24) | (bb << 16) | (gg << 8) | rr;
  for (let i = 0; i < N; i++) {
    const a = hist[i];
    if (a < 0.05) { px32[i] = paper; continue; }
    if (a > mx) mx = a;
    let A = Math.log(1 + a * k) * inv; if (A > 1) A = 1;
    const alpha = Math.min(1, GAMLUT[(A * 1024) | 0] * gain);
    let ci = cs[i] / a + shift; ci -= Math.floor(ci);
    const j = ((ci * 255) | 0) * 3;
    // vibrancy: 색 보존 곱 + 채널별 감마(고밀도 중심이 어둡게 포화)
    const t1 = vib * alpha, t2 = (1 - vib) * alpha;
    const kr = 1 - (t1 + t2 * GAMLUT[(INK[j] * 1024) | 0]) * (1 - INK[j]);
    const kg = 1 - (t1 + t2 * GAMLUT[(INK[j + 1] * 1024) | 0]) * (1 - INK[j + 1]);
    const kb = 1 - (t1 + t2 * GAMLUT[(INK[j + 2] * 1024) | 0]) * (1 - INK[j + 2]);
    px32[i] = (255 << 24) | (((bb * kb) | 0) << 16) | (((gg * kg) | 0) << 8) | ((rr * kr) | 0);
  }
  if (mx > 0) S.mx += (mx - S.mx) * 0.1;
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s182__cv');
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-static'); return; }
  cv.width = W; cv.height = H;
  const img = g2.createImageData(W, H), px32 = new Uint32Array(img.data.buffer);
  const hudSym = root.querySelector('[data-k="sym"]'), hudPts = root.querySelector('[data-k="pts"]'), hudVar = root.querySelector('[data-k="var"]'), hudMorph = root.querySelector('[data-k="morph"]'), bar = root.querySelector('.s182__bar i');

  const SEEDS = { topo: 10, coef: [101, 505, 707, 202] };
  const G = makeGenome(SEEDS.topo, SEEDS.coef[0]);
  const keys = SEEDS.coef.map((cs, i) => { const g = makeGenome(SEEDS.topo, cs); return { P: g.P, v: probe(g, g.P, cs) }; });
  const S = makeSim(182), cur = new Float64Array(G.P.length);
  setSym(S, G.sym); S.cx = keys[0].v.cx; S.cy = keys[0].v.cy; S.half = keys[0].v.half;
  let seg = 0, tt = 0, acc = 0, visible = true, tabOn = !document.hidden, clock = 0, shift = 0;
  const SEG = 24;
  const ease = u => u * u * (3 - 2 * u);
  const nameOf = { 1: '사인파', 2: '구면', 3: '소용돌이', 4: '말굽', 5: '극좌표', 6: '손수건', 7: '하트', 8: '원반', 9: '나선', 10: '쌍곡', 11: '다이아', 12: '엑스', 13: '줄리아', 14: '어안', 15: '지수', 17: '버블', 20: '원통' };

  function frame(dt) {
    clock += dt; tt += dt / SEG;
    if (tt >= 1) { tt = 0; seg = (seg + 1) % keys.length; }
    const A = keys[seg], B = keys[(seg + 1) % keys.length], u = ease(Math.min(1, Math.max(0, (tt - 0.18) / 0.64)));
    lerpP(A.P, B.P, u, cur);
    const C = compile(G, cur);
    fitView(S, G.sym, 0.03);
    // 감쇠 → 새 점 누적(시간 예산)
    const dec = 0.9; for (let i = 0; i < N; i++) { S.hist[i] *= dec; S.cs[i] *= dec; }
    const t0 = performance.now(); let pts = 0;
    do { pts += plotBatch(S, C, 6000); } while (performance.now() - t0 < 13);
    S.total += pts;
    shift += dt * 0.012;
    tonemap(S, px32, shift, 2.2, 0.7);
    g2.putImageData(img, 0, 0);
    if (hudPts) {
      hudPts.textContent = (S.total / 1e6).toFixed(1) + 'M';
      hudSym.textContent = G.sym + '겹 대칭';
      hudVar.textContent = [...new Set(G.vt.flat())].slice(0, 4).map(v => nameOf[v] || v).join(' · ');
      hudMorph.textContent = (seg + 1) + ' / ' + keys.length + ' · ' + Math.round(u * 100) + '%';
      if (bar) bar.style.transform = 'scaleX(' + ((seg + u) / keys.length).toFixed(3) + ')';
    }
  }

  const off = ctx.tick((time, dtms) => {
    if (!visible || !tabOn) return;
    acc += Math.min(0.1, (dtms || 16) / 1000);
    if (acc < 0.048) return;
    const step = acc; acc = 0;
    frame(step);
  });
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(root);
  const vis = () => { tabOn = !document.hidden; };
  document.addEventListener('visibilitychange', vis);
  frame(0.05); frame(0.05);
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
