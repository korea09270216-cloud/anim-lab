// s159 — Lenia (연속 셀룰러 오토마타): A ← clip₀¹( A + dt·G(K∗A) ),  G(u)=2·exp(−(u−μ)²/2σ²)−1
// 128×72 격자, 커널 반경 R=13(비제로 탭 432개) 링 커널을 래핑 패딩 버퍼 위 직접 컨볼루션으로 계산. 글라이더 Orbium(μ=0.15, σ=0.015, T=10).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Orbium (Chan 2019, R=13 기준 20×20) — Node 검증에서 단일 개체는 3천 스텝 이상 질량 71 로 보존·글라이딩, 충돌 시 소멸하는 것을 확인.
const ORB = [[0,0,0,0,0,0,0.1,0.14,0.1,0,0,0.03,0.03,0,0,0.3,0,0,0,0],[0,0,0,0,0,0.08,0.24,0.3,0.3,0.18,0.14,0.15,0.16,0.15,0.09,0.2,0,0,0,0],[0,0,0,0,0,0.15,0.34,0.44,0.46,0.38,0.18,0.14,0.11,0.13,0.19,0.18,0.45,0,0,0],[0,0,0,0,0.06,0.13,0.39,0.5,0.5,0.37,0.06,0,0,0,0.02,0.16,0.68,0,0,0],[0,0,0,0.11,0.17,0.17,0.33,0.4,0.38,0.28,0.14,0,0,0,0,0,0.18,0.42,0,0],[0,0,0.09,0.18,0.13,0.06,0.08,0.26,0.32,0.32,0.27,0,0,0,0,0,0,0.82,0,0],[0.27,0,0.16,0.12,0,0,0,0.25,0.38,0.44,0.45,0.34,0,0,0,0,0,0.22,0.17,0],[0,0.07,0.2,0.02,0,0,0,0.31,0.48,0.57,0.6,0.57,0,0,0,0,0,0,0.49,0],[0,0.59,0.19,0,0,0,0,0.2,0.57,0.69,0.76,0.76,0.49,0,0,0,0,0,0.36,0],[0,0.58,0.19,0,0,0,0,0,0.67,0.83,0.9,0.92,0.87,0.12,0,0,0,0,0.22,0.07],[0,0,0.46,0,0,0,0,0,0.7,0.93,1,1,1,0.61,0,0,0,0,0.18,0.11],[0,0,0.82,0,0,0,0,0,0.47,1,1,0.98,1,0.96,0.27,0,0,0,0.19,0.1],[0,0,0.46,0,0,0,0,0,0.25,1,1,0.84,0.92,0.97,0.54,0.14,0.04,0.1,0.21,0.05],[0,0,0,0.4,0,0,0,0,0.09,0.8,1,0.82,0.8,0.85,0.63,0.31,0.18,0.19,0.2,0.01],[0,0,0,0.36,0.1,0,0,0,0.05,0.54,0.86,0.79,0.74,0.72,0.6,0.39,0.28,0.24,0.13,0],[0,0,0,0.01,0.3,0.07,0,0,0.08,0.36,0.64,0.7,0.64,0.6,0.51,0.39,0.29,0.19,0.04,0],[0,0,0,0,0.1,0.24,0.14,0.1,0.15,0.29,0.45,0.53,0.52,0.46,0.4,0.31,0.21,0.08,0,0],[0,0,0,0,0,0.08,0.21,0.21,0.22,0.29,0.36,0.38,0.35,0.31,0.26,0.18,0.09,0.01,0,0],[0,0,0,0,0,0,0.03,0.13,0.19,0.22,0.24,0.24,0.23,0.18,0.13,0.05,0,0,0,0],[0,0,0,0,0,0,0,0,0.02,0.06,0.08,0.09,0.07,0.03,0,0,0,0,0,0]];

export class Lenia {
  constructor(W, H, R = 13, seed = 3) {
    this.W = W; this.H = H; this.R = R; this.rand = rng(seed);
    this.mu = 0.15; this.sigma = 0.015; this.dt = 0.1;
    this.PW = W + 2 * R; this.PH = H + 2 * R;
    this.A = new Float32Array(W * H); this.U = new Float32Array(W * H); this.T = new Float32Array(W * H); this.Ap = new Float32Array(this.PW * this.PH);
    // 링 커널: K(r)=exp(4−1/(r(1−r))), r=거리/R ∈ (0,1) — 합 1 정규화, 무시 가능한 탭 제거
    const offs = [], wts = []; let sum = 0;
    for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
      const r = Math.hypot(dx, dy) / R; if (r <= 0 || r >= 1) continue;
      const k = Math.exp(4 - 1 / (r * (1 - r))); if (k < 1e-4) continue;
      offs.push(dy * this.PW + dx); wts.push(k); sum += k;
    }
    this.off = Int32Array.from(offs); this.wt = Float32Array.from(wts.map(w => w / sum)); this.taps = offs.length;
    // 시드 리샘플 (20×20 → n×n, n = round(20·R/13))
    const n = Math.round(20 * R / 13), sc = R / 13; this.sn = n; this.seed = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const fx = i / sc, fy = j / sc, x0 = Math.min(18, fx | 0), y0 = Math.min(18, fy | 0), tx = fx - x0, ty = fy - y0;
      this.seed[j * n + i] = ORB[y0][x0] * (1 - tx) * (1 - ty) + ORB[y0][x0 + 1] * tx * (1 - ty) + ORB[y0 + 1][x0] * (1 - tx) * ty + ORB[y0 + 1][x0 + 1] * tx * ty;
    }
    this.orbMass = 0; for (let i = 0; i < n * n; i++) this.orbMass += this.seed[i];
  }

  step() {
    const { W, H, R, PW, A, U, Ap, off, wt, taps, mu, sigma, dt } = this;
    // 래핑 패딩 복사
    for (let y = 0; y < this.PH; y++) {
      const sy = ((y - R) % H + H) % H * W, row = y * PW;
      for (let x = 0; x < PW; x++) Ap[row + x] = A[sy + (((x - R) % W) + W) % W];
    }
    const inv2s = 1 / (2 * sigma * sigma);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const base = (y + R) * PW + x + R;
        let u = 0;
        for (let t = 0; t < taps; t++) u += wt[t] * Ap[base + off[t]];
        const i = y * W + x; U[i] = u;
        const d = u - mu, g = 2 * Math.exp(-d * d * inv2s) - 1;
        const a = A[i] + dt * g;
        A[i] = a < 0 ? 0 : a > 1 ? 1 : a;
      }
    }
    const T = this.T; for (let i = 0; i < T.length; i++) { const v = T[i] * 0.985; T[i] = A[i] > v ? A[i] : v; }   // 잔광(이동 궤적)
  }

  // 현재 질량이 가장 적은 자리(새 개체를 띄울 빈 곳)
  freeSpot() {
    const { W, H, A } = this; let best = null, bm = 1e9;
    for (let n = 0; n < 14; n++) {
      const x = this.rand() * W, y = this.rand() * H; let m = 0;
      for (let dy = -16; dy <= 16; dy += 4) for (let dx = -16; dx <= 16; dx += 4) m += A[((((y + dy) | 0) + H * 4) % H) * W + ((((x + dx) | 0) + W * 4) % W)];
      if (m < bm) { bm = m; best = [x, y]; }
    }
    return best;
  }

  // 개체 투입: 8가지 대칭(4회전×미러) 중 하나로 (cx,cy) 중심에 찍는다
  stamp(cx, cy, variant) {
    const { W, H, A, seed, sn } = this, v = variant == null ? (this.rand() * 8) | 0 : variant;
    for (let j = 0; j < sn; j++) for (let i = 0; i < sn; i++) {
      let a = i, b = j;
      if (v & 4) a = sn - 1 - a;                       // 미러
      for (let r = 0; r < (v & 3); r++) { const t = a; a = sn - 1 - b; b = t; }   // 90° 회전
      const val = seed[b * sn + a]; if (val <= 0) continue;
      const x = (((Math.round(cx) + i - (sn >> 1)) % W) + W) % W, y = (((Math.round(cy) + j - (sn >> 1)) % H) + H) % H;
      const o = y * W + x; if (val > A[o]) A[o] = val;
    }
  }

  mass() { const A = this.A; let m = 0; for (let i = 0; i < A.length; i++) m += A[i]; return m; }
  healthy() { const A = this.A; for (let i = 0; i < A.length; i += 53) if (!(A[i] === A[i])) return false; return true; }
  clear() { this.A.fill(0); }

  // A → 3배 해상도 쌍선형 보간, 램프 + U 후광. out = RGBA(rw*rh)
  render(out, S = 3) {
    const { W, H, A, U, T } = this, rw = W * S, rh = H * S;
    for (let Y = 0; Y < rh; Y++) {
      const fy = (Y + 0.5) / S - 0.5, y0 = Math.floor(fy), wy = fy - y0, ya = clamp(y0, 0, H - 1) * W, yb = clamp(y0 + 1, 0, H - 1) * W;
      for (let X = 0; X < rw; X++) {
        const fx = (X + 0.5) / S - 0.5, x0 = Math.floor(fx), wx = fx - x0, xa = clamp(x0, 0, W - 1), xb = clamp(x0 + 1, 0, W - 1);
        const w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy), w01 = (1 - wx) * wy, w11 = wx * wy;
        const a = A[ya + xa] * w00 + A[ya + xb] * w10 + A[yb + xa] * w01 + A[yb + xb] * w11;
        const u = U[ya + xa] * w00 + U[ya + xb] * w10 + U[yb + xa] * w01 + U[yb + xb] * w11;
        const tr = T[ya + xa] * w00 + T[ya + xb] * w10 + T[yb + xa] * w01 + T[yb + xb] * w11;
        // 배경(심해) → 청록 → 민트 → 흰색
        let r, g, b;
        if (a < 0.35) { const t = a / 0.35; r = 4 + 12 * t; g = 20 + 120 * t; b = 27 + 125 * t; }
        else if (a < 0.7) { const t = (a - 0.35) / 0.35; r = 16 + 100 * t; g = 140 + 95 * t; b = 152 + 60 * t; }
        else { const t = (a - 0.7) / 0.3; r = 116 + 139 * t; g = 235 + 20 * t; b = 212 + 33 * t; }
        const halo = sm(0.02, 0.16, u) * (1 - Math.min(1, a * 2.2)) * 0.5;       // 포텐셜 U 의 보라 후광
        const gl = (1 - Math.min(1, a * 2.5)) * sm(0.02, 0.5, tr) * 0.55;       // 이동 궤적 잔광
        r += halo * 120 + gl * 20; g += halo * 40 + gl * 110; b += halo * 150 + gl * 130;
        const o = (Y * rw + X) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      }
    }
  }
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s159__cv');
  const c2d = cv.getContext('2d');
  if (!c2d) { root.classList.add('is-static'); return; }
  const W = 128, H = 72, S = 3;
  const L = new Lenia(W, H, 13);
  cv.width = W * S; cv.height = H * S;
  const img = c2d.createImageData(W * S, H * S);
  const countEl = root.querySelector('.s159__count');

  function populate() {
    L.clear();
    L.T.fill(0); L.stamp(W * 0.18, H * 0.3, 0); L.stamp(W * 0.55, H * 0.76, 5); L.stamp(W * 0.86, H * 0.28, 2);
  }
  populate();
  for (let k = 0; k < 40; k++) L.step();          // 첫 프레임 전에 약간 진행
  L.render(img.data, S); c2d.putImageData(img, 0, 0);

  const P = { x: 0, y: 0, on: false };
  const toGrid = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const onDown = (e) => { if (e.target.closest('a,button')) return; const g = toGrid(e); if (g[0] >= 0 && g[0] < W && g[1] >= 0 && g[1] < H) { L.stamp(g[0], g[1]); } };
  const onMove = (e) => { const g = toGrid(e); P.x = g[0]; P.y = g[1]; P.on = true; };
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove);

  let vis = true, lastT = 0, acc = 0, steps = 2, clock = 0, check = 0, spawnCd = 0;
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);

  const off = ctx.tick(() => {
    if (!vis || document.hidden) { lastT = 0; return; }
    const now = performance.now(); if (!lastT) lastT = now;
    acc += now - lastT; lastT = now; if (acc < 48) return;
    const dt = Math.min(acc, 200) / 1000; acc = 0; clock += dt; check += dt; spawnCd -= dt;
    const t0 = performance.now();
    for (let k = 0; k < steps; k++) L.step();

    if (check > 0.8) {                                 // 개체 수(질량/기준질량) 감시: 멸종 방지·폭주 억제
      check = 0;
      const m = L.mass(), n = m / L.orbMass;
      if (!L.healthy() || n > 4.4) populate();       // 충돌 뒤 군체가 번지는 폭주(실측: 1/8 확률로 N=27 까지) → 재시드
      else if (n < 2.2 && spawnCd <= 0) {              // 빈 자리에 새 개체 투입
        spawnCd = 2.2; const p = L.freeSpot(); L.stamp(p[0], p[1]);
      }
      if (countEl) countEl.textContent = Math.max(1, Math.round(n));
    }
    L.render(img.data, S); c2d.putImageData(img, 0, 0);
    const cost = performance.now() - t0;
    if (cost > 38 && steps > 1) steps--; else if (cost < 15 && steps < 3) steps++;
  });

  return () => { off(); io.disconnect(); root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove); };
}
