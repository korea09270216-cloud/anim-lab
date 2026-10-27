// s156 — MLS-MPM 2D (액체·젤리·눈). 격자 64×H, 입자 ~3천, 고정 dt=1(격자 단위계), CPU 단일 스레드.
// P2G(질량·운동량+응력) → 격자 연산(중력·경계·커서) → G2P(속도·C 복원, F 갱신, 소성/경화) 를 직접 구현.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const MAT = { LIQUID: 0, JELLY: 1, SNOW: 2 };

export class MPM {
  constructor(W, H, N) {
    this.W = W; this.H = H; this.N = N; this.cap = N;
    const G = W * H;
    this.gm = new Float32Array(G); this.gx = new Float32Array(G); this.gy = new Float32Array(G);
    const f = () => new Float32Array(N);
    this.x = f(); this.y = f(); this.vx = f(); this.vy = f();
    this.a00 = f(); this.a01 = f(); this.a10 = f(); this.a11 = f();      // affine = -dt*τ + m*C (다음 P2G 용)
    this.f00 = f(); this.f01 = f(); this.f10 = f(); this.f11 = f();      // 변형구배 F
    this.jp = f();                                                        // 액체: J, 눈: 소성 압축비 Jp
    this.mat = 0; this.rand = rng(7);
    this.gravity = 6e-4;
    this.vmax = 0.42;
    this.lam = [0.09, 0.12, 0.07];
    this.mu = [0, 0.10, 0.05];
    this.ptr = { on: false, grab: false, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, r: 4.2 };
    this.wx = new Float32Array(3); this.wy = new Float32Array(3);
    this.S = 5; this.M0 = 3.2; this.rw = Math.round((W - 2 * this.M0) * this.S); this.rh = Math.round((H - 2 * this.M0) * this.S);
    this.D = new Float32Array(this.rw * this.rh); this.SP = new Float32Array(this.rw * this.rh);
    this.hgt = new Float32Array(this.rw * this.rh); this.SP2 = new Float32Array(this.rw * this.rh);
    const R = 4.2, K = 9; this.ker = new Float32Array(K * K);
    for (let j = 0; j < K; j++) for (let i = 0; i < K; i++) { const r2 = ((i - 4) ** 2 + (j - 4) ** 2) / (R * R); this.ker[j * K + i] = r2 < 1 ? (1 - r2) * (1 - r2) : 0; }
    this.frame = 0;
  }

  // 0.5 간격 격자점으로 채운 타원/반타원 — 점 개수를 count 에 맞춰 크기를 이분탐색
  shapePts(count, ratio, half) {
    const gen = (ry) => {
      const rx = ry * ratio, pts = [];
      for (let j = half ? 0 : -ry; j <= ry; j += 0.5) for (let i = -rx; i <= rx; i += 0.5) {
        const u = i / rx, v = j / ry, d = u * u + v * v;
        if (d <= 1) pts.push([i, j, d]);
      }
      return pts;
    };
    let lo = 1, hi = 30, pts = gen(8);
    for (let k = 0; k < 14; k++) { const mid = (lo + hi) / 2; pts = gen(mid); if (pts.length < count) lo = mid; else hi = mid; }
    pts = gen(hi); pts.sort((a, b) => a[2] - b[2]);
    return pts.slice(0, count);
  }

  put(k0, count, cx, cy, ratio, half, vx, vy) {
    const pts = this.shapePts(count, ratio, half), r = this.rand;
    for (let k = 0; k < count; k++) {
      const p = k0 + k, q = pts[k % pts.length];
      this.x[p] = cx + q[0] + (r() - 0.5) * 0.14; this.y[p] = cy + q[1] + (r() - 0.5) * 0.14;
      this.vx[p] = vx; this.vy[p] = vy;
    }
  }

  seed(mat) {
    this.mat = mat;
    const { W, H, rand } = this;
    const N = this.N = mat === 0 ? this.cap : mat === 1 ? Math.min(3600, this.cap) : Math.min(4000, this.cap);
    if (mat === 0) {
      // 액체: 얕은 웅덩이 + 떨어지는 방울
      const pw = W - 8, perRow = pw * 2;
      const rows = Math.floor(N * 0.8 / perRow), nPool = rows * perRow;
      for (let k = 0; k < nPool; k++) {
        const c = k % perRow, r = (k / perRow) | 0;
        this.x[k] = 4 + (c + 0.5) * 0.5 + (rand() - 0.5) * 0.18;
        this.y[k] = 3.3 + (r + 0.5) * 0.5 + (rand() - 0.5) * 0.18;
        this.vx[k] = 0; this.vy[k] = 0;
      }
      const nb = N - nPool, rad = Math.sqrt(nb / (Math.PI * 4)), top = 3.3 + rows * 0.5;
      this.put(nPool, nb, W * 0.62, Math.max(top + 7 + rad, H - 6 - rad), 1, false, -0.02, -0.06);
    } else if (mat === 1) {
      // 젤리: 납작한 푸딩(바닥) + 떨어지는 두 덩어리
      this.put(0, 1200, W * 0.33, 3.4, 1.9, true, 0, 0);
      this.put(1200, 1300, W * 0.76, H * 0.5, 1, false, -0.03, -0.1);
      this.put(2500, N - 2500, W * 0.42, H - 11, 1, false, 0.02, -0.06);
    } else {
      // 눈: 쌓인 눈더미 + 날아와 부서지는 눈덩이 둘
      this.put(0, 1700, W * 0.42, 3.3, 2.1, true, 0, 0);
      this.put(1700, 1300, W * 0.78, H * 0.5, 1, false, -0.1, -0.1);
      this.put(3000, N - 3000, W * 0.2, H * 0.66, 1, false, 0.08, -0.04);
    }
    for (let p = 0; p < N; p++) {
      this.a00[p] = this.a01[p] = this.a10[p] = this.a11[p] = 0;
      this.f00[p] = 1; this.f01[p] = 0; this.f10[p] = 0; this.f11[p] = 1; this.jp[p] = 1;
    }
  }

  // 커서 목표를 설정: (tx,ty)=격자 좌표(y 위쪽 +), steps=이번 프레임 서브스텝 수
  setPointer(tx, ty, on, grab, steps) {
    const p = this.ptr;
    if (on && !p.on) { p.x = tx; p.y = ty; p.vx = p.vy = 0; }
    const dvx = (tx - p.x) / steps, dvy = (ty - p.y) / steps;
    p.vx = p.vx * 0.5 + dvx * 0.5; p.vy = p.vy * 0.5 + dvy * 0.5;
    const s = Math.hypot(p.vx, p.vy), cap = 0.3;
    if (s > cap) { p.vx *= cap / s; p.vy *= cap / s; }
    p.tx = tx; p.ty = ty; p.on = on; p.grab = grab;
  }

  substeps(n) {
    const p = this.ptr, x0 = p.x, y0 = p.y;
    for (let s = 0; s < n; s++) {
      if (p.on) { p.x = x0 + (p.tx - x0) * (s + 1) / n; p.y = y0 + (p.ty - y0) * (s + 1) / n; }
      this.step();
    }
    if (p.on) { p.x = p.tx; p.y = p.ty; }
    this.frame++;
  }

  step() {
    const W = this.W, H = this.H, N = this.N, gm = this.gm, gx = this.gx, gy = this.gy,
      X = this.x, Y = this.y, VX = this.vx, VY = this.vy,
      A00 = this.a00, A01 = this.a01, A10 = this.a10, A11 = this.a11,
      F00 = this.f00, F01 = this.f01, F10 = this.f10, F11 = this.f11, JP = this.jp,
      wx = this.wx, wy = this.wy, mat = this.mat, M = 0.25;
    gm.fill(0); gx.fill(0); gy.fill(0);

    // ── P2G ──
    for (let p = 0; p < N; p++) {
      const x = X[p], y = Y[p];
      const bx = (x - 0.5) | 0, by = (y - 0.5) | 0, fx = x - bx, fy = y - by;
      let u = 1.5 - fx, v = fx - 1, t = fx - 0.5;
      wx[0] = 0.5 * u * u; wx[1] = 0.75 - v * v; wx[2] = 0.5 * t * t;
      u = 1.5 - fy; v = fy - 1; t = fy - 0.5;
      wy[0] = 0.5 * u * u; wy[1] = 0.75 - v * v; wy[2] = 0.5 * t * t;
      const a00 = A00[p], a01 = A01[p], a10 = A10[p], a11 = A11[p], mvx = M * VX[p], mvy = M * VY[p];
      for (let j = 0; j < 3; j++) {
        const dy = j - fy, wj = wy[j];
        let idx = (by + j) * W + bx;
        for (let i = 0; i < 3; i++, idx++) {
          const dx = i - fx, w = wx[i] * wj;
          gm[idx] += w * M;
          gx[idx] += w * (mvx + a00 * dx + a01 * dy);
          gy[idx] += w * (mvy + a10 * dx + a11 * dy);
        }
      }
    }

    // ── 격자 연산: 속도 복원 · 중력 · 감쇠 · 경계 ──
    const g = this.gravity, damp = mat === 0 ? 0.9975 : mat === 1 ? 0.9992 : 0.9985, fric = mat === 2 ? 0.80 : mat === 1 ? 0.93 : 1;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < W; i++) {
        const idx = j * W + i, m = gm[idx];
        if (m > 1e-6) {
          const inv = damp / m;
          let vx = gx[idx] * inv, vy = gy[idx] * inv - g;
          if (i < 3 && vx < 0) vx = 0; else if (i > W - 4 && vx > 0) vx = 0;
          if (j < 3) { if (vy < 0) { vy = 0; vx *= fric; } } else if (j > H - 4 && vy > 0) vy = 0;
          gx[idx] = vx; gy[idx] = vy;
        }
      }
    }
    // 커서: 밀기(충격량 가산) / 쥐기(속도를 커서 쪽으로 이완 → 놓으면 그 속도로 던져짐)
    const q = this.ptr;
    if (q.on) {
      const r = q.r, r2 = r * r, i0 = Math.max(0, Math.floor(q.x - r)), i1 = Math.min(W - 1, Math.ceil(q.x + r));
      const j0 = Math.max(0, Math.floor(q.y - r)), j1 = Math.min(H - 1, Math.ceil(q.y + r));
      const sp = Math.hypot(q.vx, q.vy);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const dx = i - q.x, dy = j - q.y, d2 = dx * dx + dy * dy;
        if (d2 >= r2) continue;
        const idx = j * W + i; if (gm[idx] <= 1e-6) continue;
        let w = 1 - d2 / r2; w *= w;
        if (q.grab) {
          const tvx = q.vx - dx * 0.035, tvy = q.vy - dy * 0.035, k = 0.45 * w;
          gx[idx] += (tvx - gx[idx]) * k; gy[idx] += (tvy - gy[idx]) * k;
        } else if (sp > 0.004) {
          gx[idx] += q.vx * 0.14 * w; gy[idx] += q.vy * 0.14 * w;
        }
      }
    }

    // ── G2P ──
    const vmax2 = this.vmax * this.vmax, mu0 = this.mu[mat], la0 = this.lam[mat];
    for (let p = 0; p < N; p++) {
      const x = X[p], y = Y[p];
      const bx = (x - 0.5) | 0, by = (y - 0.5) | 0, fx = x - bx, fy = y - by;
      let u = 1.5 - fx, v = fx - 1, t = fx - 0.5;
      wx[0] = 0.5 * u * u; wx[1] = 0.75 - v * v; wx[2] = 0.5 * t * t;
      u = 1.5 - fy; v = fy - 1; t = fy - 0.5;
      wy[0] = 0.5 * u * u; wy[1] = 0.75 - v * v; wy[2] = 0.5 * t * t;
      let nvx = 0, nvy = 0, c00 = 0, c01 = 0, c10 = 0, c11 = 0;
      for (let j = 0; j < 3; j++) {
        const dy = j - fy, wj = wy[j];
        let idx = (by + j) * W + bx;
        for (let i = 0; i < 3; i++, idx++) {
          const dx = i - fx, w = wx[i] * wj, w4 = 4 * w, gvx = gx[idx], gvy = gy[idx];
          nvx += w * gvx; nvy += w * gvy;
          c00 += w4 * gvx * dx; c01 += w4 * gvx * dy; c10 += w4 * gvy * dx; c11 += w4 * gvy * dy;
        }
      }
      const s2 = nvx * nvx + nvy * nvy;
      if (s2 > vmax2) { const k = this.vmax / Math.sqrt(s2); nvx *= k; nvy *= k; }
      if (!(s2 < 1e6)) { nvx = 0; nvy = 0; c00 = c01 = c10 = c11 = 0; }
      const lim = 0.9;
      c00 = clamp(c00, -lim, lim); c01 = clamp(c01, -lim, lim); c10 = clamp(c10, -lim, lim); c11 = clamp(c11, -lim, lim);
      VX[p] = nvx; VY[p] = nvy;
      X[p] = clamp(x + nvx, 2, W - 2.52); Y[p] = clamp(y + nvy, 2, H - 2.52);

      if (mat === 0) {
        // 액체: J *= 1+tr(C); 압력 = λ(1-J)
        const J = clamp(JP[p] * (1 + c00 + c11), 0.5, 1.0);
        JP[p] = J;
        const s = -la0 * (J - 1);
        A00[p] = s + M * c00; A01[p] = M * c01; A10[p] = M * c10; A11[p] = s + M * c11;
        continue;
      }
      // F ← (I + C) F
      let n00 = (1 + c00) * F00[p] + c01 * F10[p], n01 = (1 + c00) * F01[p] + c01 * F11[p];
      let n10 = c10 * F00[p] + (1 + c11) * F10[p], n11 = c10 * F01[p] + (1 + c11) * F11[p];
      if (mat === 1) {
        // Neo-Hookean: τ = μ(FFᵀ−I) + λ ln J · I
        let J = n00 * n11 - n01 * n10;
        if (!(J > 0.22)) { n00 = 1; n01 = 0; n10 = 0; n11 = 1; J = 1; }
        F00[p] = n00; F01[p] = n01; F10[p] = n10; F11[p] = n11;
        const lj = la0 * Math.log(J);
        const t00 = mu0 * (n00 * n00 + n01 * n01 - 1) + lj, t01 = mu0 * (n00 * n10 + n01 * n11), t11 = mu0 * (n10 * n10 + n11 * n11 - 1) + lj;
        A00[p] = -t00 + M * c00; A01[p] = -t01 + M * c01; A10[p] = -t01 + M * c10; A11[p] = -t11 + M * c11;
      } else {
        // 눈: F = R·S 극분해 → S 의 고유값을 [1-θc, 1+θs] 로 클램프(소성), 압축되면 경화
        const xr = n00 + n11, yr = n10 - n01;
        let r = Math.sqrt(xr * xr + yr * yr); if (r < 1e-8) r = 1e-8;
        const cr = xr / r, sr = yr / r;
        const s11 = cr * n00 + sr * n10, s22 = -sr * n01 + cr * n11, sh = 0.5 * ((cr * n01 + sr * n11) + (-sr * n00 + cr * n10));
        const avg = 0.5 * (s11 + s22), dif = 0.5 * (s11 - s22), rad = Math.sqrt(dif * dif + sh * sh);
        let sg1 = avg + rad, sg2 = avg - rad;
        if (sg2 < 0.3) sg2 = 0.3; if (sg1 < 0.3) sg1 = 0.3;
        const m1 = clamp(sg1, 0.975, 1.0045), m2 = clamp(sg2, 0.975, 1.0045);
        const jpn = clamp(JP[p] * (sg1 * sg2) / (m1 * m2), 0.55, 1.6);
        JP[p] = jpn;
        const c2 = rad > 1e-7 ? dif / rad : 1, s2n = rad > 1e-7 ? sh / rad : 0;
        const aa = 0.5 * (m1 + m2), rr = 0.5 * (m1 - m2);
        const S00 = aa + rr * c2, S01 = rr * s2n, S11 = aa - rr * c2;
        const q00 = cr * S00 - sr * S01, q01 = cr * S01 - sr * S11, q10 = sr * S00 + cr * S01, q11 = sr * S01 + cr * S11;
        F00[p] = q00; F01[p] = q01; F10[p] = q10; F11[p] = q11;
        const J = m1 * m2, h = clamp(Math.exp(10 * (1 - jpn)), 0.4, 3.0);
        const e00 = q00 - cr, e01 = q01 + sr, e10 = q10 - sr, e11 = q11 - cr;
        const m00 = e00 * q00 + e01 * q01, m01 = e00 * q10 + e01 * q11, m10 = e10 * q00 + e11 * q01, m11 = e10 * q10 + e11 * q11;
        const mh = 2 * mu0 * h, lh = la0 * h * J * (J - 1);
        A00[p] = -(mh * m00 + lh) + M * c00; A01[p] = -(mh * m01) + M * c01;
        A10[p] = -(mh * m10) + M * c10; A11[p] = -(mh * m11 + lh) + M * c11;
      }
    }
  }

  healthy() {
    const { N, x, y, vx } = this;
    for (let k = 0; k < N; k += 37) if (!(x[k] === x[k]) || !(y[k] === y[k]) || !(vx[k] === vx[k])) return false;
    // 폭발: 평균 속도가 한계 근처로 지속
    let s = 0; for (let k = 0; k < N; k += 11) s += Math.abs(vx[k]) + Math.abs(this.vy[k]);
    return s / (N / 11) < 0.33;
  }

  // 입자 → 5배 해상도 밀도장(스플랫) → 높이장 법선 셰이딩. out=Uint8ClampedArray(rw*rh*4), 투명 배경
  render(out, fade = 1) {
    const { rw, rh, S, N, D, SP, hgt, ker, SP2 } = this;
    const mat = this.mat;
    D.fill(0); SP.fill(0);
    const X = this.x, Y = this.y, VX = this.vx, VY = this.vy;
    for (let p = 0; p < N; p++) {
      const cx = Math.round((X[p] - this.M0) * S), cy = Math.round((this.H - this.M0 - Y[p]) * S);
      if (cx < 4 || cy < 4 || cx >= rw - 4 || cy >= rh - 4) continue;
      const sp = Math.min(1, Math.hypot(VX[p], VY[p]) * 5);
      for (let j = 0; j < 9; j++) {
        let o = (cy - 4 + j) * rw + cx - 4;
        for (let i = 0; i < 9; i++, o++) { const k = ker[j * 9 + i]; if (k > 0) { D[o] += k; SP[o] += k * sp; } }
      }
    }
    for (let k = 0; k < D.length; k++) hgt[k] = sstep(0.4, 2.6, D[k]);
    for (let j = 1; j < rh - 1; j++) for (let i = 1; i < rw - 1; i++) { const o = j * rw + i; SP2[o] = (hgt[o - 1] + 2 * hgt[o] + hgt[o + 1]) * 0.25; }
    for (let j = 1; j < rh - 1; j++) for (let i = 1; i < rw - 1; i++) { const o = j * rw + i; hgt[o] = (SP2[o - rw] + 2 * SP2[o] + SP2[o + rw]) * 0.25; }
    for (let j = 1; j < rh - 1; j++) for (let i = 1; i < rw - 1; i++) { const o = j * rw + i; SP2[o] = (hgt[o - 1] + 2 * hgt[o] + hgt[o + 1]) * 0.25; }
    for (let j = 1; j < rh - 1; j++) for (let i = 1; i < rw - 1; i++) { const o = j * rw + i; hgt[o] = (SP2[o - rw] + 2 * SP2[o] + SP2[o + rw]) * 0.25; }
    const fr = this.frame;
    const Lx = -0.52, Ly = -0.62, Lz = 0.58;
    for (let j = 0; j < rh; j++) {
      for (let i = 0; i < rw; i++) {
        const idx = j * rw + i, o = idx * 4, d = D[idx];
        if (d < 0.4) { out[o + 3] = 0; continue; }
        const a = sstep(0.45, 1.0, d);
        const il = i > 2 ? idx - 3 : idx, ir = i < rw - 3 ? idx + 3 : idx, iu = j > 2 ? idx - 3 * rw : idx, id = j < rh - 3 ? idx + 3 * rw : idx;
        let nx = (hgt[il] - hgt[ir]) * 2.4, ny = (hgt[iu] - hgt[id]) * 2.4, nz = 1;
        const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz); nx *= nl; ny *= nl; nz *= nl;
        const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz) / 0.58;
        const hx = Lx, hy = Ly, hz = Lz + 1, hl = 1 / Math.sqrt(hx * hx + hy * hy + hz * hz);
        const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) * hl), mat === 0 ? 34 : mat === 1 ? 46 : 12);
        const th = hgt[idx], spd = Math.min(1, SP[idx] / d);
        let r, g, b, al = a * fade;
        if (mat === 0) {            // 카라멜 시럽
          const k = 0.55 + 0.5 * diff;
          r = (150 + 80 * th) * k + 95 * spd; g = (72 + 62 * th) * k + 70 * spd; b = (16 + 24 * th) * k + 18 * spd;
          const rim = 1 - sstep(0.4, 1.4, d); r = r * (1 - 0.35 * rim); g = g * (1 - 0.4 * rim);
          r += spec * 255 * 0.9; g += spec * 255 * 0.85; b += spec * 255 * 0.7;
        } else if (mat === 1) {     // 딸기 푸딩 젤리 — 얇은 가장자리는 투명하게 밝고, 두꺼운 속은 진하게
          const k = 0.7 + 0.42 * diff, core = sstep(0.7, 2.0, d);
          r = (255 - 52 * core) * k + 24 * spd; g = (150 - 112 * core) * k + 20 * spd; b = (172 - 78 * core) * k + 14 * spd;
          r += spec * 255; g += spec * 255; b += spec * 255;
          al *= 0.94;
        } else {                    // 눈꽃
          const k = 0.7 + 0.34 * diff, rim = 1 - sstep(0.6, 1.8, d);
          const hs = (Math.imul(idx ^ 0x9e3779b1, 2654435761) >>> 24) / 255;
          const mott = 0.93 + 0.1 * hs;
          r = (222 - 70 * rim) * k * mott + 8; g = (234 - 56 * rim) * k * mott + 8; b = (250 - 24 * rim) * k * mott;
          const sp2 = (Math.imul(idx ^ (fr >> 2), 2246822519) >>> 24) / 255;
          if (sp2 > 0.992 && th > 0.5) { r = g = b = 255; }
          r += spec * 60; g += spec * 60; b += spec * 60;
        }
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = al * 255;
      }
    }
  }
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s156__cv');
  const chips = [...root.querySelectorAll('.s156__chip')];
  const hint = root.querySelector('.s156__hint');
  const c2d = cv.getContext('2d');
  if (!c2d) { root.classList.add('is-static'); return; }
  const W = 64;
  let sim = null, img = null, off = null, offCtx = null;

  function build() {
    const r = cv.getBoundingClientRect();
    const H = clamp(Math.round(6.4 + (W - 6.4) * (r.height || 700) / (r.width || 830)), 36, 64);
    sim = new MPM(W, H, 4600);
    cv.width = sim.rw; cv.height = sim.rh;
    img = c2d.createImageData(sim.rw, sim.rh);
    sim.seed(0);
  }
  build();

  const scene = { mat: 0, t: 0, lock: false, fade: 1, pending: -1, since: 0 };
  const names = ['liquid', 'jelly', 'snow'];
  const setMat = (m, byUser) => {
    if (byUser) { scene.lock = true; }
    scene.pending = m;
  };
  const applyChips = () => chips.forEach((c, i) => c.classList.toggle('is-on', i === scene.mat));
  chips.forEach((c, i) => c.addEventListener('click', () => setMat(i, true)));

  // ── 포인터 ──
  const P = { x: 0, y: 0, on: false, grab: false, last: -1e9 };
  const toGrid = (e) => {
    const r = cv.getBoundingClientRect(), m = sim.M0;
    return [m + (e.clientX - r.left) / r.width * (sim.W - 2 * m), m + (1 - (e.clientY - r.top) / r.height) * (sim.H - 2 * m)];
  };
  const onMove = (e) => {
    const g = toGrid(e), inside = g[0] > -2 && g[0] < sim.W + 2 && g[1] > -2 && g[1] < sim.H + 2;
    if (!inside) { P.on = false; return; }
    P.x = g[0]; P.y = g[1]; P.on = true; P.last = performance.now();
  };
  const onDown = (e) => { if (e.target.closest('.s156__chip')) return; onMove(e); if (P.on) P.grab = true; };
  const onUp = () => { P.grab = false; };
  const onLeave = () => { P.on = false; P.grab = false; };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp); root.addEventListener('pointerleave', onLeave);

  // ── 루프(20fps 캡, 화면 밖/탭 숨김 정지) ──
  let vis = true, lastT = 0, acc = 0, subs = 8, sceneT = 0, autoP = { x: 0, y: 0, on: false };
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const SCENE_LEN = 11.5;

  const off1 = ctx.tick(() => {
    if (!vis || document.hidden) { lastT = 0; return; }
    const now = performance.now();
    if (!lastT) lastT = now;
    acc += now - lastT; lastT = now;
    if (acc < 48) return;
    const dt = Math.min(acc, 200) / 1000; acc = 0;
    const t0 = performance.now();

    // 장면 전환 상태기계: 페이드아웃 → 재시드 → 페이드인
    sceneT += dt;
    if (scene.pending < 0 && sceneT > SCENE_LEN) { scene.pending = scene.lock ? scene.mat : (scene.mat + 1) % 3; }
    if (scene.pending >= 0) {
      scene.fade -= dt / 0.35;
      if (scene.fade <= 0) {
        scene.fade = 0; scene.mat = scene.pending; scene.pending = -1; sceneT = 0;
        sim.seed(scene.mat); root.dataset.mat = names[scene.mat]; applyChips();
      }
    } else if (scene.fade < 1) scene.fade = Math.min(1, scene.fade + dt / 0.45);

    // 포인터: 실제 입력이 있으면 그것, 없으면 가상 포인터가 풀을 가로지르며 휘젓는다
    const real = P.on && now - P.last < 2500;
    let tx, ty, on, grab;
    if (real) { tx = P.x; ty = P.y; on = true; grab = P.grab; }
    else if (sceneT > 3.2 && sceneT < SCENE_LEN - 1.8) {
      const u = sceneT - 3.2;
      tx = sim.W * (0.5 + 0.34 * Math.sin(u * 1.15)); ty = 9.5 + 3.2 * Math.sin(u * 2.3 + 0.8);
      on = true; grab = false;
    } else { tx = autoP.x; ty = autoP.y; on = false; grab = false; }
    autoP.x = tx; autoP.y = ty;
    sim.setPointer(tx, ty, on, grab, subs);

    sim.substeps(subs);
    if (!sim.healthy()) { sim.seed(scene.mat); sceneT = 0; }
    sim.render(img.data, scene.fade);
    c2d.putImageData(img, 0, 0);

    const cost = performance.now() - t0;
    if (cost > 36 && subs > 4) subs--; else if (cost < 16 && subs < 9) subs++;
  });

  let rt = 0;
  const onResize = () => { clearTimeout(rt); rt = setTimeout(() => { const r = cv.getBoundingClientRect(); const H = clamp(Math.round(6.4 + (W - 6.4) * r.height / r.width), 36, 64); if (H !== sim.H) { build(); sim.seed(scene.mat); } }, 250); };
  addEventListener('resize', onResize);

  root.dataset.mat = names[0]; applyChips();
  // 첫 화면: 공이 떨어지기 전 일부 워밍업(풀이 안정되게)
  sim.substeps(12);
  sim.render(img.data, 1); c2d.putImageData(img, 0, 0);

  return () => {
    off1(); io.disconnect(); clearTimeout(rt);
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp); root.removeEventListener('pointerleave', onLeave);
    removeEventListener('resize', onResize);
  };
}
