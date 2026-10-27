// s155 — 수채화 번짐. Curtis 외(1997) 3층 모델의 축소 구현 + Kubelka–Munk 안료 합성.
//  ① 얕은 물 층: 수심 h, 속도 (u,v). 압력 p = G·h + Gp·종이높이 − η·M·(1−M′)  (M′=젖음 마스크 블러 → 가장자리 압력 감소 = edge darkening)
//     보존형 풍상 플럭스(음수 수심 방지 리미터) + 안료 농도 c 는 수심 가중 semi-Lagrangian 이류
//  ② 안료 전이: 물 속 안료 m=c·h → 종이 침전 D (종이 골 granulation 가중), 젖은 곳에서 재용해(lift) → 덧칠 역류(backrun)
//  ③ 종이 모세관 층: 포화도 s — 표면 물 흡수·증발, s 확산으로 젖은 전선이 번지고, s>임계인 셀로만 표면 물이 흐른다
//  합성: 안료별 흡수 K·산란 S (RGB) 를 침전량+용해량 가중합으로 섞고 KM 식으로 흰 종이 R0 위 반사율 계산 (감산 혼합)

const NP = 4;
// 안료: 흡수 K, 산란 S (채널별). S/K 비율은 목표 R∞ 색에서 역산: K/S=(1−R)²/(2R)
const SS = 0.9;
export const PIG = [
  { n: '로즈', K: [0.02, 1.24, 0.54], css: '#d4416a' },     // 퀴나크리돈 로즈
  { n: '코발트', K: [1.98, 0.74, 0.06], css: '#2a58b8' },    // 코발트 블루
  { n: '레몬', K: [0.001, 0.03, 2.17], css: '#f2c91b' },     // 카드뮴 레몬
  { n: '비리디안', K: [3.6, 0.17, 0.36], css: '#1d8c6e' },   // 비리디안
];
const R0 = [0.965, 0.945, 0.9];

function hash(x, y, s) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
export function paperField(w, h, scale, seed) { // 종이 결(높이장) 0..1 — 프로시저럴 fBm
  const o = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    let a = 0.5, f = scale, t = 0, n = 0;
    for (let k = 0; k < 4; k++) { t += a * vnoise(i * f / 16, j * f / 16, seed + k); n += a; a *= 0.5; f *= 2.1; }
    o[j * w + i] = t / n;
  }
  return o;
}

export function createWC(W, H) {
  const N = W * H;
  let h = new Float32Array(N), hN = new Float32Array(N), u = new Float32Array(N), v = new Float32Array(N);
  let s = new Float32Array(N), sN = new Float32Array(N);
  const p = new Float32Array(N), act = new Uint8Array(N), fa = new Uint8Array(N), wetM = new Float32Array(N), mb = new Float32Array(N);
  const hp = paperField(W, H, 3.2, 11), hq = paperField(W, H, 9, 23); for (let k = 0; k < W * H; k++) hp[k] = 0.9 * hp[k] + 0.1 * hq[k];
  const c = [], c2 = [], D = [];
  for (let k = 0; k < NP; k++) { c.push(new Float32Array(N)); c2.push(new Float32Array(N)); D.push(new Float32Array(N)); }
  const Fx = new Float32Array(N), Fy = new Float32Array(N), sc = new Float32Array(N);
  const P = { G: 0.25, Gp: 0.15, eta: 1.6, dtP: 0.26, damp: 0.82, umax: 0.34, cdiff: 0.35, edgeBoost: 3, evap: 0.0007, ab: 0.0016, kd: 0.003, kl: 0.0015, gran: 0.3, sdiff: 0.2, sthr: 0.15, hmin: 0.01 };
  let T = 0;

  function reset() { h.fill(0); u.fill(0); v.fill(0); s.fill(0); for (let k = 0; k < NP; k++) { c[k].fill(0); D[k].fill(0); } T = 0; }

  // 붓 찍기: 반경 R(셀), 물 깊이 water, 안료 농도 conc[4], 진행 방향 (dx,dy)
  function stamp(x, y, R, water, conc, dx, dy) {
    const x0 = Math.max(1, Math.floor(x - R)), x1 = Math.min(W - 2, Math.ceil(x + R)), y0 = Math.max(1, Math.floor(y - R)), y1 = Math.min(H - 2, Math.ceil(y + R));
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
      const d2 = ((i - x) * (i - x) + (j - y) * (j - y)) / (R * R); if (d2 >= 1) continue;
      const f = (1 - d2) * (1 - d2), k = j * W + i, nh = Math.max(h[k], water * f), dl = nh - h[k], ld = 0.86 + 0.28 * vnoise(i * 0.13, j * 0.13, 3);
      if (dl > 0) { for (let q = 0; q < NP; q++) c[q][k] = (c[q][k] * h[k] + conc[q] * ld * dl) / nh; h[k] = nh; }
      if (s[k] < 0.55 * f) s[k] = 0.55 * f;
      u[k] += dx * 0.12 * f; v[k] += dy * 0.12 * f;
    }
  }

  function step() {
    const { G, Gp, eta, dtP, damp, umax, evap, ab, kd, kl, gran, sdiff, sthr, hmin } = P;
    T++;
    // 활성(젖은) 셀과 블러 마스크
    for (let k = 0; k < N; k++) { act[k] = (h[k] > hmin || s[k] > sthr * (0.55 + 0.9 * hp[k])) ? 1 : 0; wetM[k] = h[k] > hmin ? 1 : 0; }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      mb[k] = (wetM[k - W - 1] + wetM[k - W] + wetM[k - W + 1] + wetM[k - 1] + wetM[k] + wetM[k + 1] + wetM[k + W - 1] + wetM[k + W] + wetM[k + W + 1]) / 9;
    }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; fa[k] = (act[k] || wetM[k - 1] || wetM[k + 1] || wetM[k - W] || wetM[k + W]) ? 1 : 0; }
    for (let k = 0; k < N; k++) p[k] = G * h[k] + Gp * hp[k] * (fa[k] ? 1 : 0) - (wetM[k] ? eta * (1 - mb[k]) : 0);
    // 속도: 압력 기울기(활성 이웃만) + 점성 감쇠
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (!fa[k]) { u[k] = 0; v[k] = 0; continue; }
      const pc = p[k], pl = fa[k - 1] ? p[k - 1] : pc, pr = fa[k + 1] ? p[k + 1] : pc, pu = fa[k - W] ? p[k - W] : pc, pd = fa[k + W] ? p[k + W] : pc;
      let a = (u[k] - dtP * (pr - pl) * 0.5) * damp, b = (v[k] - dtP * (pd - pu) * 0.5) * damp;
      a = a > umax ? umax : a < -umax ? -umax : a; b = b > umax ? umax : b < -umax ? -umax : b;
      u[k] = a; v[k] = b;
    }
    // 보존형 풍상 플럭스 + 리미터
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (fa[k] && fa[k - 1]) { const uf = 0.5 * (u[k] + u[k - 1]); Fx[k] = uf * (uf > 0 ? h[k - 1] : h[k]); } else Fx[k] = 0;
      if (fa[k] && fa[k - W]) { const vf = 0.5 * (v[k] + v[k - W]); Fy[k] = vf * (vf > 0 ? h[k - W] : h[k]); } else Fy[k] = 0;
    }
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      const out = Math.max(0, Fx[k + 1]) + Math.max(0, -Fx[k]) + Math.max(0, Fy[k + W]) + Math.max(0, -Fy[k]);
      sc[k] = out > h[k] * 0.9 ? h[k] * 0.9 / out : 1;
    }
    hN.set(h);
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      let d = 0, f = Fx[k]; if (f > 0) d += f * sc[k - 1]; else d += f * sc[k];
      f = Fx[k + 1]; if (f > 0) d -= f * sc[k]; else d -= f * sc[k + 1];
      f = Fy[k]; if (f > 0) d += f * sc[k - W]; else d += f * sc[k];
      f = Fy[k + W]; if (f > 0) d -= f * sc[k]; else d -= f * sc[k + W];
      hN[k] = h[k] + d;
    }
    // 안료 농도: 수심 가중 semi-Lagrangian
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i;
      if (hN[k] <= 1e-5) { for (let q = 0; q < NP; q++) c2[q][k] = 0; continue; }
      let x = i - u[k], y = j - v[k]; x = x < 0 ? 0 : x > W - 1.001 ? W - 1.001 : x; y = y < 0 ? 0 : y > H - 1.001 ? H - 1.001 : y;
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, q0 = y0 * W + x0;
      const w00 = (1 - fx) * (1 - fy) * h[q0], w10 = fx * (1 - fy) * h[q0 + 1], w01 = (1 - fx) * fy * h[q0 + W], w11 = fx * fy * h[q0 + W + 1], ws = w00 + w10 + w01 + w11;
      if (ws < 1e-9) { for (let q = 0; q < NP; q++) c2[q][k] = c[q][k]; continue; }
      for (let q = 0; q < NP; q++) { const cq = c[q]; c2[q][k] = (cq[q0] * w00 + cq[q0 + 1] * w10 + cq[q0 + W] * w01 + cq[q0 + W + 1] * w11) / ws; }
    }
    // 안료 농도 확산(젖은 이웃끼리) — 번짐·혼색
    { const cd = P.cdiff; for (let q = 0; q < NP; q++) { const a = c2[q], b = c[q]; for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) { const k = j * W + i; if (hN[k] <= hmin) { b[k] = a[k]; continue; } let sum = 0, n = 0; if (hN[k - 1] > hmin) { sum += a[k - 1]; n++; } if (hN[k + 1] > hmin) { sum += a[k + 1]; n++; } if (hN[k - W] > hmin) { sum += a[k - W]; n++; } if (hN[k + W] > hmin) { sum += a[k + W]; n++; } b[k] = n ? a[k] + cd * (sum - n * a[k]) * 0.5 : a[k]; } } for (let q = 0; q < NP; q++) { const x = c[q]; c[q] = c2[q]; c2[q] = x; } }
    // 증발·흡수·모세관·침전·재용해
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i; let hh = hN[k];
      if (hh <= 0) { hh = 0; }
      if (hh > 0) {
        const dh = Math.min(hh, evap + ab * (1 - s[k])), hNew = hh - dh, concK = hh / Math.max(hNew, 1e-4);
        s[k] = Math.min(1, s[k] + dh * 0.85);
        if (hNew < hmin) { // 말랐다: 남은 안료 전부 침전
          for (let q = 0; q < NP; q++) { D[q][k] += c2[q][k] * hh; c2[q][k] = 0; }
          hh = 0; s[k] = Math.min(1, s[k] + hNew);
        } else {
          hh = hNew;
          const gf = (1 + gran * (0.5 - hp[k]) * 2) * (1 + P.edgeBoost * Math.max(0, 0.8 - mb[k]) * 1.25);
          for (let q = 0; q < NP; q++) {
            let cq = Math.min(4, c2[q][k] * concK), m = cq * hh;
            const dep = Math.max(0, Math.min(m, m * kd * gf)), lift = D[q][k] * kl * Math.min(1, hh);
            m = m - dep + lift; D[q][k] += dep - lift; c2[q][k] = m / hh;
          }
        }
      } else for (let q = 0; q < NP; q++) c2[q][k] = 0;
      hN[k] = hh;
    }
    // 모세관 확산 (젖은 쪽에서 마른 쪽으로)
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = j * W + i, sc0 = s[k]; let a = 0;
      const n1 = s[k - 1], n2 = s[k + 1], n3 = s[k - W], n4 = s[k + W];
      if (Math.max(sc0, n1) > 0.12) a += n1 - sc0; if (Math.max(sc0, n2) > 0.12) a += n2 - sc0;
      if (Math.max(sc0, n3) > 0.12) a += n3 - sc0; if (Math.max(sc0, n4) > 0.12) a += n4 - sc0;
      sN[k] = sc0 + sdiff * a * (0.7 + 0.6 * hp[k]);
      sN[k] *= 0.9992;
    }
    let t = h; h = hN; hN = t; t = s; s = sN; sN = t;
    for (let q = 0; q < NP; q++) { const x = c[q]; c[q] = c2[q]; c2[q] = x; }
  }

  // KM 합성 (시뮬 해상도): col = [r,g,b,density] × N
  function compose(col) {
    for (let k = 0; k < N; k++) {
      const hh = h[k]; let e0 = 0, e1 = 0, e2 = 0, e3 = 0;
      e0 = D[0][k] + 0.9 * c[0][k] * hh; e1 = D[1][k] + 0.9 * c[1][k] * hh; e2 = D[2][k] + 0.9 * c[2][k] * hh; e3 = D[3][k] + 0.9 * c[3][k] * hh;
      const tot = e0 + e1 + e2 + e3, o = k * 4, wet = 1 - 0.06 * Math.min(1, hh * 2);
      if (tot < 1e-4) { col[o] = R0[0] * wet; col[o + 1] = R0[1] * wet; col[o + 2] = R0[2] * wet; col[o + 3] = 0; continue; }
      for (let ch = 0; ch < 3; ch++) {
        const K = e0 * PIG[0].K[ch] + e1 * PIG[1].K[ch] + e2 * PIG[2].K[ch] + e3 * PIG[3].K[ch], S = tot * SS;
        const a = 1 + K / S, b = Math.sqrt(a * a - 1), z = b * S;
        let R;
        if (z < 1e-3) R = R0[ch]; else { const ex = Math.exp(2 * z), bc = b * (ex + 1) / (ex - 1); R = (1 - R0[ch] * (a - bc)) / (a - R0[ch] + bc); }
        col[o + ch] = Math.max(0, Math.min(1, R)) * wet;
      }
      col[o + 3] = Math.min(1, tot * 0.9);
    }
    blurCol(col);
  }
  const tmpc = new Float32Array(N * 4);
  function blurCol(col) { // 3×3 가우시안 — 셀 단위 얼룩을 눌러 번진 수채 톤으로
    tmpc.set(col);
    for (let j = 1; j < H - 1; j++) for (let i = 1; i < W - 1; i++) {
      const k = (j * W + i) * 4, a = k - 4, b = k + 4, u = k - W * 4, d = k + W * 4;
      for (let c = 0; c < 4; c++) col[k + c] = (tmpc[k + c] * 4 + (tmpc[a + c] + tmpc[b + c] + tmpc[u + c] + tmpc[d + c]) * 2 + tmpc[a - W * 4 + c] + tmpc[b - W * 4 + c] + tmpc[a + W * 4 + c] + tmpc[b + W * 4 + c]) / 16;
    }
  }
  function stats() {
    let hs = 0, hm = 0, ds = 0, dm = 0, bad = 0, wet = 0;
    for (let k = 0; k < N; k++) { hs += h[k]; if (h[k] > hm) hm = h[k]; if (!(h[k] === h[k])) bad++; if (h[k] > P.hmin) wet++; for (let q = 0; q < NP; q++) { ds += D[q][k] + c[q][k] * h[k]; if (D[q][k] > dm) dm = D[q][k]; if (!(D[q][k] === D[q][k])) bad++; } }
    return { water: hs, maxDepth: hm, pigment: ds, maxDep: dm, wetCells: wet, bad };
  }
  return { W, H, N, P, stamp, step, reset, compose, stats, hp, get T() { return T; }, h: () => h, s: () => s };
}

// 출력: 시뮬 해상도 색을 k배로 쌍선형 업샘플 — 표본 위치를 종이 결 노이즈로 살짝 흔들어(domain warp) 계단 대신 번진 가장자리를 만들고,
// 침전 밀도 × 종이 높이로 입상감을 곱한다.
export function renderOut(col, W, H, k, OW, OH, hpOut, wx, wy, data) {
  const A = 0.85;
  for (let j = 0, o = 0, q = 0; j < OH; j++) {
    for (let i = 0; i < OW; i++, o += 4, q++) {
      let x = (i + 0.5) / k - 0.5 + (wx[q] - 0.5) * A, y = (j + 0.5) / k - 0.5 + (wy[q] - 0.5) * A;
      x = x < 0 ? 0 : x > W - 1.001 ? W - 1.001 : x; y = y < 0 ? 0 : y > H - 1.001 ? H - 1.001 : y;
      const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, a = (y0 * W + x0) * 4, b = a + W * 4;
      const w00 = (1 - fx) * (1 - fy), w10 = fx * (1 - fy), w01 = (1 - fx) * fy, w11 = fx * fy;
      const dens = col[a + 3] * w00 + col[a + 7] * w10 + col[b + 3] * w01 + col[b + 7] * w11;
      const g = hpOut[q], gr = 1 + (0.5 - g) * (0.05 + 0.30 * dens), paper = 0.965 + 0.05 * g;
      for (let ch = 0; ch < 3; ch++) {
        const r = col[a + ch] * w00 + col[a + 4 + ch] * w10 + col[b + ch] * w01 + col[b + 4 + ch] * w11;
        data[o + ch] = r * gr * paper * 255;
      }
      data[o + 3] = 255;
    }
  }
}

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const concOf = (q, amt) => { const o = [0, 0, 0, 0]; if (q >= 0) o[q] = amt; return o; };

// 한 장의 자동 연출: 로즈 붓 → 코발트 겹침(보라) → 레몬 겹침(초록) → 맑은 물 번짐 → 비리디안 점 → 마무리
export function makeStrokes(seed) {
  const r = mulberry(seed), S = [], rx = (a, b) => a + (b - a) * r();
  let t = 0.2;
  const path = (x0, y0, x1, y1, bend) => ({ x0, y0, x1, y1, cx: (x0 + x1) / 2 + bend * (y1 - y0), cy: (y0 + y1) / 2 - bend * (x1 - x0) });
  S.push({ t, p: path(rx(.4, .5), rx(.18, .3), rx(.88, .96), rx(.5, .66), rx(-.3, .3)), R: 10.5, q: 0, amt: 0.65, w: 1.2, dur: 1.7 }); t += 2.0;
  S.push({ t, p: path(rx(.42, .54), rx(.6, .8), rx(.9, .97), rx(.2, .36), rx(-.3, .3)), R: 10, q: 1, amt: 0.65, w: 1.2, dur: 1.7 }); t += 2.1;
  S.push({ t, p: path(rx(.36, .46), rx(.45, .58), rx(.78, .92), rx(.72, .86), rx(-.3, .3)), R: 9.5, q: 2, amt: 0.65, w: 1.2, dur: 1.5 }); t += 2.3;
  S.push({ t, p: path(rx(.5, .6), rx(.35, .45), rx(.7, .8), rx(.5, .6), 0.1), R: 8, q: -1, amt: 0, w: 1.4, dur: 1.2 }); t += 1.8;
  for (let i = 0; i < 3; i++) { const x = rx(.45, .92), y = rx(.15, .85); S.push({ t, p: path(x, y, x + rx(-.05, .05), y + rx(-.05, .05), 0), R: rx(3.5, 5), q: 3, amt: 0.72, w: 1.2, dur: .5 }); t += 0.9; }
  S.push({ t, p: path(rx(.62, .72), rx(.82, .92), rx(.92, .97), rx(.8, .9), -.2), R: 5.5, q: 0, amt: 0.65, w: 1.1, dur: 1.2 }); t += 1.4;
  return { strokes: S, end: t + 9 };
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s155__cv'), snap = root.querySelector('.s155__snap'), sws = [...root.querySelectorAll('.s155__sw')];
  const g = cv.getContext('2d'), gs = snap.getContext('2d');
  if (!g || !gs) { root.classList.add('is-static'); return; }
  const K = 3; // 출력 배율
  let sim = null, col = null, hpOut = null, wxA = null, wyA = null, img = null, W = 192, H = 108, OW = 0, OH = 0, sheet = 0, plan = null, pt = 0, pi = 0, cur = null;
  let visible = true, tabOn = true, acc = 0, last = performance.now(), lastUser = -1e9, sel = 0, down = null, cost = 12, sub = 4, frame = 0;

  function build() {
    const r = root.getBoundingClientRect(); const asp = Math.max(0.8, r.width / Math.max(300, r.height));
    W = 192; H = Math.max(70, Math.min(126, Math.round(W / asp))); OW = W * K; OH = H * K;
    sim = createWC(W, H); col = new Float32Array(W * H * 4); cv.width = snap.width = OW; cv.height = snap.height = OH; img = g.createImageData(OW, OH);
    hpOut = paperField(OW, OH, 4.5, 5); wxA = paperField(OW, OH, 3.6, 77); wyA = paperField(OW, OH, 3.6, 91); sheet = 0; startSheet(true);
  }
  function startSheet(first) {
    if (!first) { gs.drawImage(cv, 0, 0); snap.style.transition = 'none'; snap.style.opacity = '1'; void snap.offsetWidth; snap.style.transition = 'opacity 2s ease'; snap.style.opacity = '0'; }
    sim.reset(); plan = makeStrokes(21 + sheet * 7); sheet++; pt = 0; pi = 0; cur = null;
    if (first) { for (let f = 0; f < 120; f++) tickPaint(0.05, 4); }
  }
  const bez = (p, t) => { const u = 1 - t; return [u * u * p.x0 + 2 * u * t * p.cx + t * t * p.x1, u * u * p.y0 + 2 * u * t * p.cy + t * t * p.y1]; };
  function tickPaint(dt, n) {
    pt += dt;
    while (pi < plan.strokes.length && plan.strokes[pi].t <= pt) { cur = Object.assign({ s: 0 }, plan.strokes[pi++]); cur.last = null; }
    if (cur) {
      cur.s = Math.min(1, cur.s + dt / cur.dur); const e = cur.s * cur.s * (3 - 2 * cur.s), p = bez(cur.p, e), x = p[0] * W, y = p[1] * H, tp = cur.dur > 0.8 ? 0.6 + 0.4 * Math.pow(Math.sin(Math.PI * Math.min(1, cur.s)), 0.5) : 1;
      if (cur.last) { const dx = x - cur.last[0], dy = y - cur.last[1], L = Math.hypot(dx, dy), m = Math.max(1, Math.ceil(L / (cur.R * 0.5))); for (let i = 1; i <= m; i++) sim.stamp(cur.last[0] + dx * i / m, cur.last[1] + dy * i / m, cur.R * tp, cur.w, concOf(cur.q, cur.amt * (0.75 + 0.25 * tp)), dx / (L + 1e-3), dy / (L + 1e-3)); }
      else sim.stamp(x, y, cur.R * tp, cur.w, concOf(cur.q, cur.amt), 0, 0);
      cur.last = [x, y]; if (cur.s >= 1) cur = null;
    }
    for (let i = 0; i < n; i++) sim.step();
    if (pt > plan.end) startSheet(false);
  }

  // 포인터: 누른 채 이동 = 선택한 안료(마지막 칩 = 맑은 물)로 칠하기
  const toSim = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const onDown = e => { if (e.button > 0) return; lastUser = performance.now(); down = toSim(e); try { cv.setPointerCapture(e.pointerId); } catch (_) { } paintAt(down, down); };
  const onMove = e => { if (!down) return; lastUser = performance.now(); const p = toSim(e); paintAt(down, p); down = p; };
  const onUp = e => { down = null; try { cv.releasePointerCapture(e.pointerId); } catch (_) { } };
  function paintAt(a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy), m = Math.max(1, Math.ceil(L / 3)), q = sel < NP ? sel : -1;
    for (let i = 1; i <= m; i++) sim.stamp(a[0] + dx * i / m, a[1] + dy * i / m, 6.5, 1.15, concOf(q, 1.1), dx / (L + 1e-3), dy / (L + 1e-3));
  }
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
  sws.forEach((b, i) => { if (i < NP) { b.style.setProperty('--pig', PIG[i].css); b.setAttribute('aria-label', PIG[i].n); } else b.setAttribute('aria-label', '맑은 물'); });
  const swOff = sws.map((b, i) => { const f = () => { sel = i; sws.forEach((x, j) => x.classList.toggle('is-on', j === i)); }; b.addEventListener('click', f); return () => b.removeEventListener('click', f); });
  sws[0] && sws[0].classList.add('is-on');

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabOn = !document.hidden; last = performance.now(); }; document.addEventListener('visibilitychange', onVis);
  let rt = 0; const onRes = () => { clearTimeout(rt); rt = setTimeout(() => { const r = root.getBoundingClientRect(); const a = r.width / r.height; if (Math.abs(OW / OH - a) > 0.15) build(); }, 250); };
  addEventListener('resize', onRes);

  build();

  const off = ctx.tick(() => {
    if (!visible || !tabOn || !sim) return;
    const now = performance.now(); acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (acc < 1 / 20) return; const dt = acc; acc = 0; frame++;
    const t0 = performance.now();
    if (now - lastUser > 6000) tickPaint(dt, sub); else for (let i = 0; i < sub; i++) sim.step();
    if (frame % 60 === 0) { const st = sim.stats(); if (st.bad > 0 || st.maxDepth > 6) startSheet(false); }
    sim.compose(col); renderOut(col, W, H, K, OW, OH, hpOut, wxA, wyA, img.data); g.putImageData(img, 0, 0);
    cost = cost * 0.8 + (performance.now() - t0) * 0.2; sub = cost > 36 ? 3 : cost < 22 ? 4 : sub;
    root.__s155 = sim;
  });

  return () => {
    off(); io.disconnect(); clearTimeout(rt); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRes);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
    swOff.forEach(f => f());
  };
}
