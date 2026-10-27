// s167 — XPBD 사면체 푸딩. 엔진 없이 직접 구현한 솔버:
//  · 4×4×4 격자(64정점) → 큐브당 5-사면체(체커 미러로 면 대각선 일치) = 135 tets
//  · 엣지 거리 제약(compliance>0, 말랑함) + 사면체 부피 제약 C = V − V0 (compliance 0, 부피 보존)
//  · 바닥 마찰, 구(커서) 충돌, 서브스텝 10 × 반복 1, 반전(역전) 사면체 감시·자가 복구
//  · 렌더: 외곽 108 삼각형을 Phong 테셀레이션(16분할)으로 매끈하게 → 뒷면 불투명 + 앞면 반투명 젤리 음영
// createPudding 은 DOM 이 없어 node 에서도 돌린다.


export function createPudding(o = {}) {
  const h = o.h || 100, SUB = o.substeps || 10, STEP = 1 / 60, dt = STEP / SUB, idt = 1 / dt;
  const G = (o.gravity || 30) * h;
  const edgeAlpha = (o.edgeC == null ? 4.5e-3 : o.edgeC) / (dt * dt);
  const volAlpha = (o.volC == null ? 0 : o.volC) / (dt * dt);
  const drag = o.drag == null ? 1.1 : o.drag, mu = o.mu == null ? 0.55 : o.mu;
  const L = 4, cnt = L * L * L, id = (i, j, k) => (k * L + j) * L + i;
  const P = new Float64Array(cnt * 3), Q = new Float64Array(cnt * 3), V = new Float64Array(cnt * 3), R0 = new Float64Array(cnt * 3);
  const restH = new Float64Array(cnt);

  // 큐브 → 둥근 푸딩(구 매핑 일부 블렌딩 + 아래가 넓은 테이퍼)
  const beta = o.round == null ? 0.6 : o.round;
  for (let k = 0; k < L; k++) for (let j = 0; j < L; j++) for (let i = 0; i < L; i++) {
    const u = (i - 1.5) / 1.5, v = (j - 1.5) / 1.5, w = (k - 1.5) / 1.5;
    const r2 = Math.hypot(u, v, w), rinf = Math.max(Math.abs(u), Math.abs(v), Math.abs(w));
    const f = r2 > 1e-9 ? 1 + (rinf / r2 - 1) * beta : 1;
    const qx = u * f, qy = v * f, qz = w * f;
    const tap = 1.14 - 0.36 * (qy + 1) / 2;
    const n = id(i, j, k) * 3;
    R0[n] = qx * 1.5 * h * tap; R0[n + 1] = (qy + 1) * 1.5 * h * 0.95; R0[n + 2] = qz * 1.5 * h * tap;
    restH[id(i, j, k)] = j / (L - 1);
  }

  // ── 사면체 (parity 에 따라 x 미러 → 인접 큐브 면 대각선 일치)
  const A = [[[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 1]], [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1]], [[1, 1, 0], [1, 0, 0], [0, 1, 0], [1, 1, 1]], [[1, 0, 1], [1, 0, 0], [0, 0, 1], [1, 1, 1]], [[0, 1, 1], [0, 1, 0], [0, 0, 1], [1, 1, 1]]];
  const tl = [];
  for (let k = 0; k < L - 1; k++) for (let j = 0; j < L - 1; j++) for (let i = 0; i < L - 1; i++) {
    const mirror = (i + j + k) & 1;
    for (const t of A) tl.push(t.map(([dx, dy, dz]) => id(i + (mirror ? 1 - dx : dx), j + dy, k + dz)));
  }
  const vol6 = (a, b, c, d, X) => {
    const ax = X[b * 3] - X[a * 3], ay = X[b * 3 + 1] - X[a * 3 + 1], az = X[b * 3 + 2] - X[a * 3 + 2];
    const bx = X[c * 3] - X[a * 3], by = X[c * 3 + 1] - X[a * 3 + 1], bz = X[c * 3 + 2] - X[a * 3 + 2];
    const cx = X[d * 3] - X[a * 3], cy = X[d * 3 + 1] - X[a * 3 + 1], cz = X[d * 3 + 2] - X[a * 3 + 2];
    return (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
  };
  for (const t of tl) if (vol6(t[0], t[1], t[2], t[3], R0) < 0) { const x = t[2]; t[2] = t[3]; t[3] = x; }
  const nT = tl.length, TI = new Int32Array(nT * 4), V0 = new Float64Array(nT);
  tl.forEach((t, n) => { TI.set(t, n * 4); V0[n] = vol6(t[0], t[1], t[2], t[3], R0); });
  let totalV0 = 0; for (let n = 0; n < nT; n++) totalV0 += V0[n];

  // 엣지
  const eset = new Map();
  for (const t of tl) for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) {
    const u = Math.min(t[a], t[b]), v = Math.max(t[a], t[b]); eset.set(u * cnt + v, [u, v]);
  }
  const eA = [], eB = [], eL = [];
  for (const [u, v] of eset.values()) { eA.push(u); eB.push(v); eL.push(Math.hypot(R0[u * 3] - R0[v * 3], R0[u * 3 + 1] - R0[v * 3 + 1], R0[u * 3 + 2] - R0[v * 3 + 2])); }
  const nE = eA.length, EA = Int32Array.from(eA), EB = Int32Array.from(eB), EL = Float64Array.from(eL);

  // 외곽 삼각형 (면 개수 1 = 경계). 양의 부피 사면체의 바깥 방향 면: (0,2,1)(0,1,3)(0,3,2)(1,2,3)
  const fmap = new Map();
  for (const t of tl) for (const f of [[0, 2, 1], [0, 1, 3], [0, 3, 2], [1, 2, 3]]) {
    const tri = f.map(q => t[q]), key = [...tri].sort((p, q) => p - q).join(',');
    const e = fmap.get(key); if (e) e.n++; else fmap.set(key, { tri, n: 1 });
  }
  const surf = [...fmap.values()].filter(e => e.n === 1).map(e => e.tri);
  const nS = surf.length, SF = Int32Array.from(surf.flat());
  let internalOK = true; for (const e of fmap.values()) if (e.n > 2) internalOK = false;

  const sph = { x: 0, y: -9999, z: 0, r: 0.58 * h, tx: 0, ty: -9999, tz: 0, px: 0, py: 0, pz: 0 };
  let time = 0, badRun = 0, resets = 0;
  const floorY = 0;

  function reset(drop = true) {
    P.set(R0); V.fill(0);
    // 높이에서 살짝 기울여 떨어뜨림
    const ang = 0.28 * (resets & 1 ? -1 : 1), ca = Math.cos(ang), sa = Math.sin(ang), cyc = 1.3 * h;
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1] - cyc;
      P[i * 3] = x * ca - y * sa; P[i * 3 + 1] = x * sa + y * ca + cyc + (drop ? 2.4 * h : 0);
    }
    Q.set(P); time = 0; badRun = 0; resets++;
  }
  reset();

  function substep(sk) {
    const dm = 1 - drag * dt;
    for (let i = 0; i < cnt; i++) {
      const p = i * 3;
      V[p + 1] -= G * dt; V[p] *= dm; V[p + 1] *= dm; V[p + 2] *= dm;
      Q[p] = P[p]; Q[p + 1] = P[p + 1]; Q[p + 2] = P[p + 2];
      P[p] += V[p] * dt; P[p + 1] += V[p + 1] * dt; P[p + 2] += V[p + 2] * dt;
    }
    // 엣지 거리 (XPBD, α̃ = α/dt²)
    for (let c = 0; c < nE; c++) {
      const a = EA[c] * 3, b = EB[c] * 3;
      const dx = P[a] - P[b], dy = P[a + 1] - P[b + 1], dz = P[a + 2] - P[b + 2];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (l < 1e-9) continue;
      const s = (EL[c] - l) / (l * (2 + edgeAlpha));
      P[a] += s * dx; P[a + 1] += s * dy; P[a + 2] += s * dz; P[b] -= s * dx; P[b + 1] -= s * dy; P[b + 2] -= s * dz;
    }
    // 부피 보존 C = V − V0  (∇ = 면 법선·면적/…)
    for (let n = 0; n < nT; n++) {
      const i0 = TI[n * 4] * 3, i1 = TI[n * 4 + 1] * 3, i2 = TI[n * 4 + 2] * 3, i3 = TI[n * 4 + 3] * 3;
      const ax = P[i1] - P[i0], ay = P[i1 + 1] - P[i0 + 1], az = P[i1 + 2] - P[i0 + 2];
      const bx = P[i2] - P[i0], by = P[i2 + 1] - P[i0 + 1], bz = P[i2 + 2] - P[i0 + 2];
      const cx = P[i3] - P[i0], cy = P[i3 + 1] - P[i0 + 1], cz = P[i3 + 2] - P[i0 + 2];
      // 정점 1·2·3 의 그래디언트 (6V 의 편미분 / 6)
      const g1x = (by * cz - bz * cy) / 6, g1y = (bz * cx - bx * cz) / 6, g1z = (bx * cy - by * cx) / 6;
      const g2x = (cy * az - cz * ay) / 6, g2y = (cz * ax - cx * az) / 6, g2z = (cx * ay - cy * ax) / 6;
      const g3x = (ay * bz - az * by) / 6, g3y = (az * bx - ax * bz) / 6, g3z = (ax * by - ay * bx) / 6;
      const g0x = -(g1x + g2x + g3x), g0y = -(g1y + g2y + g3y), g0z = -(g1z + g2z + g3z);
      const vol = (ax * (by * cz - bz * cy) + ay * (bz * cx - bx * cz) + az * (bx * cy - by * cx)) / 6;
      const sum = g0x * g0x + g0y * g0y + g0z * g0z + g1x * g1x + g1y * g1y + g1z * g1z + g2x * g2x + g2y * g2y + g2z * g2z + g3x * g3x + g3y * g3y + g3z * g3z;
      if (sum < 1e-12) continue;
      const s = -(vol - V0[n]) / (sum + volAlpha);
      P[i0] += s * g0x; P[i0 + 1] += s * g0y; P[i0 + 2] += s * g0z;
      P[i1] += s * g1x; P[i1 + 1] += s * g1y; P[i1 + 2] += s * g1z;
      P[i2] += s * g2x; P[i2 + 1] += s * g2y; P[i2 + 2] += s * g2z;
      P[i3] += s * g3x; P[i3 + 1] += s * g3y; P[i3 + 2] += s * g3z;
    }
    // 충돌: 구(커서, 서브스텝 보간) + 바닥(마찰)
    const k = (sk + 1) / SUB;
    const sx = sph.px + (sph.x - sph.px) * k, sy = sph.py + (sph.y - sph.py) * k, sz = sph.pz + (sph.z - sph.pz) * k;
    const R2 = sph.r * sph.r;
    for (let i = 0; i < cnt; i++) {
      const p = i * 3;
      const dx = P[p] - sx, dy = P[p + 1] - sy, dz = P[p + 2] - sz, d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < R2 && d2 > 1e-9) { const s = sph.r / Math.sqrt(d2); P[p] = sx + dx * s; P[p + 1] = sy + dy * s; P[p + 2] = sz + dz * s; }
      if (P[p + 1] < floorY) { P[p + 1] = floorY; P[p] += (Q[p] - P[p]) * mu; P[p + 2] += (Q[p + 2] - P[p + 2]) * mu; }
    }
    for (let i = 0; i < cnt * 3; i++) V[i] = (P[i] - Q[i]) * idt;
  }

  function health() {
    let minR = 1e9, inv = 0, sumV = 0;
    for (let n = 0; n < nT; n++) {
      const v = vol6(TI[n * 4], TI[n * 4 + 1], TI[n * 4 + 2], TI[n * 4 + 3], P);
      const r = v / V0[n]; if (r < minR) minR = r; if (v < 0) inv++; sumV += v;
    }
    return { minR, inv, volRatio: sumV / totalV0 };
  }

  function step() {
    sph.px = sph.x; sph.py = sph.y; sph.pz = sph.z;
    if (sph.y < -9000) { sph.x = sph.px = sph.tx; sph.y = sph.py = sph.ty; sph.z = sph.pz = sph.tz; }
    else {
      const mx = sph.tx - sph.x, my = sph.ty - sph.y, mz = sph.tz - sph.z, ml = Math.hypot(mx, my, mz), lim = 0.45 * sph.r;
      if (ml > 1e-6) { const s = Math.min(1, lim / ml); sph.x += mx * s; sph.y += my * s; sph.z += mz * s; }
    }
    for (let s = 0; s < SUB; s++) substep(s);
    time += STEP;
    // 자가 복구: 반전/NaN 이 이어지면 다시 떨어뜨린다
    let bad = false;
    for (let i = 0; i < cnt * 3; i += 7) if (!Number.isFinite(P[i])) { bad = true; break; }
    if (!bad) { const hl = health(); if (hl.minR < -0.15) badRun++; else badRun = 0; if (badRun > 40) bad = true; }
    if (bad) reset(true);
  }

  // 위로 튀어 올리며 약간 회전시킨다
  function kick(vy, spin) {
    const cy = 1.1 * h;
    for (let i = 0; i < cnt; i++) {
      const x = P[i * 3], y = P[i * 3 + 1] - cy;
      V[i * 3 + 1] += vy + x * spin; V[i * 3] -= y * spin * 0.6; V[i * 3 + 2] += x * spin * 0.5;
    }
  }

  return { h, cnt, nT, nE, nS, P, V, R0, restH, surf, SF, sph, step, reset, kick, health, internalOK, get resets() { return resets; }, get time() { return time; }, floorY };
}

// ───────────────────────── 렌더 ─────────────────────────
const SUBD = 4; // 외곽 삼각형 1개를 SUBD² 개로 분할

export default function init(root, ctx) {
  const cv = root.querySelector('.s167__cv');
  const g = cv && cv.getContext && cv.getContext('2d');
  if (!g) { root.classList.add('is-static'); return; }
  const stat = root.querySelector('.s167__stat');
  const RS = ctx.reduced ? 0.5 : 0.62;
  const PIT = 0.4, F = 1900, cP = Math.cos(PIT), sP = Math.sin(PIT);
  let yaw = 0, cY = 1, sY = 0;
  const Lraw = [-0.45, 0.8, 0.55], Ll = Math.hypot(...Lraw), L = Lraw.map(v => v / Ll);
  const Hraw = [L[0], L[1], L[2] + 1], Hl = Math.hypot(...Hraw), Hv = Hraw.map(v => v / Hl);

  let sim, W = 0, H = 0, S = RS, cx = 0, cy = 0, hh = 0;
  let nSub = 0, nV = 0, subTri, bw, subH, subA, SXs, SYs, SZs, NXs, NYs, NZs, key, idxB, idxF, VNx, VNy, VNz, PX, PY, PZ;
  let userAt = -1e9, pressed = false, vis = true, alive = true, last = performance.now(), cyc = 0, kickAt = 4.2;

  // 서브 정점 가중치 (정점 i, j 에서 u=i/N, v=j/N, w=1-u-v)
  const sv = [];
  for (let i = 0; i <= SUBD; i++) for (let j = 0; j <= SUBD - i; j++) sv.push([1 - (i + j) / SUBD, i / SUBD, j / SUBD]);
  const svId = (i, j) => { let n = 0; for (let a = 0; a < i; a++) n += SUBD - a + 1; return n + j; };
  const stris = [];
  for (let i = 0; i < SUBD; i++) for (let j = 0; j < SUBD - i; j++) {
    stris.push([svId(i, j), svId(i + 1, j), svId(i, j + 1)]);
    if (j < SUBD - i - 1) stris.push([svId(i + 1, j), svId(i + 1, j + 1), svId(i, j + 1)]);
  }
  const NSV = sv.length, NST = stris.length;

  function build() {
    W = root.clientWidth; H = root.clientHeight;
    cv.width = Math.round(W * RS); cv.height = Math.round(H * RS); S = cv.width / W;
    const narrow = W < 820;
    hh = Math.min(H * 0.15, W * (narrow ? 0.2 : 0.1));
    cx = narrow ? W * 0.5 : W * 0.7; cy = H * (narrow ? 0.72 : 0.66);
    sim = createPudding({ h: hh });
    sim.sph.r = 0.58 * hh;
    nSub = sim.nS * NSV;
    PX = new Float64Array(nSub); PY = new Float64Array(nSub); PZ = new Float64Array(nSub);
    NXs = new Float64Array(nSub); NYs = new Float64Array(nSub); NZs = new Float64Array(nSub);
    SXs = new Float64Array(nSub); SYs = new Float64Array(nSub); SZs = new Float64Array(nSub);
    subH = new Float64Array(nSub); subA = new Float64Array(nSub);
    // 정적 재질 값: 서브 정점의 휴지 높이(0~1)와 휴지 방위각(캐러멜 가장자리 흘러내림용)
    for (let t = 0; t < sim.nS; t++) {
      const a = sim.SF[t * 3], b = sim.SF[t * 3 + 1], c = sim.SF[t * 3 + 2];
      for (let s = 0; s < NSV; s++) {
        const w = sv[s];
        subH[t * NSV + s] = w[0] * sim.restH[a] + w[1] * sim.restH[b] + w[2] * sim.restH[c];
        const rx = w[0] * sim.R0[a * 3] + w[1] * sim.R0[b * 3] + w[2] * sim.R0[c * 3], rz = w[0] * sim.R0[a * 3 + 2] + w[1] * sim.R0[b * 3 + 2] + w[2] * sim.R0[c * 3 + 2];
        subA[t * NSV + s] = Math.atan2(rz, rx);
      }
    }
    key = new Float64Array(sim.nS * NST); idxB = []; idxF = [];
    VNx = new Float64Array(sim.cnt); VNy = new Float64Array(sim.cnt); VNz = new Float64Array(sim.cnt);
    cyc = 0; kickAt = 4.2;
  }

  const setYaw = t => { yaw = 0.5 * Math.sin(t * 0.42); cY = Math.cos(yaw); sY = Math.sin(yaw); };
  // 월드(x,y 위, z 앞) → 화면
  const proj = (x, y, z) => {
    const xr = x * cY + z * sY, zr = -x * sY + z * cY, yv = y * cP - zr * sP, zz = zr * cP + y * sP, f = F / (F - zz);
    return [(cx + xr * f) * S, (cy - yv * f) * S, f, zz];
  };
  const unproject = (sx, sy, z) => {
    const xr = sx - cx, yv = cy - sy;
    const x = (xr - z * sY) / cY, zr = -x * sY + z * cY;
    return [x, (yv + zr * sP) / cP];
  };

  function surfaceUpdate() {
    const P = sim.P, SF = sim.SF, cnt = sim.cnt;
    VNx.fill(0); VNy.fill(0); VNz.fill(0);
    for (let t = 0; t < sim.nS; t++) {
      const a = SF[t * 3], b = SF[t * 3 + 1], c = SF[t * 3 + 2], pa = a * 3, pb = b * 3, pc = c * 3;
      const e1x = P[pb] - P[pa], e1y = P[pb + 1] - P[pa + 1], e1z = P[pb + 2] - P[pa + 2];
      const e2x = P[pc] - P[pa], e2y = P[pc + 1] - P[pa + 1], e2z = P[pc + 2] - P[pa + 2];
      const nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      VNx[a] += nx; VNy[a] += ny; VNz[a] += nz; VNx[b] += nx; VNy[b] += ny; VNz[b] += nz; VNx[c] += nx; VNy[c] += ny; VNz[c] += nz;
    }
    for (let i = 0; i < cnt; i++) { const l = Math.hypot(VNx[i], VNy[i], VNz[i]) || 1; VNx[i] /= l; VNy[i] /= l; VNz[i] /= l; }
    const alpha = 0.72;
    for (let t = 0; t < sim.nS; t++) {
      const v = [SF[t * 3], SF[t * 3 + 1], SF[t * 3 + 2]];
      for (let s = 0; s < NSV; s++) {
        const w = sv[s];
        let lx = 0, ly = 0, lz = 0, nx = 0, ny = 0, nz = 0;
        for (let q = 0; q < 3; q++) { const p = v[q] * 3; lx += w[q] * P[p]; ly += w[q] * P[p + 1]; lz += w[q] * P[p + 2]; nx += w[q] * VNx[v[q]]; ny += w[q] * VNy[v[q]]; nz += w[q] * VNz[v[q]]; }
        let qx = 0, qy = 0, qz = 0;
        for (let q = 0; q < 3; q++) {
          const p = v[q] * 3, d = (lx - P[p]) * VNx[v[q]] + (ly - P[p + 1]) * VNy[v[q]] + (lz - P[p + 2]) * VNz[v[q]];
          qx += w[q] * (lx - d * VNx[v[q]]); qy += w[q] * (ly - d * VNy[v[q]]); qz += w[q] * (lz - d * VNz[v[q]]);
        }
        const o = t * NSV + s, nl = Math.hypot(nx, ny, nz) || 1;
        PX[o] = lx + (qx - lx) * alpha; PY[o] = ly + (qy - ly) * alpha; PZ[o] = lz + (qz - lz) * alpha;
        NXs[o] = nx / nl; NYs[o] = ny / nl; NZs[o] = nz / nl;
      }
    }
    for (let o = 0; o < nSub; o++) {
      const p = proj(PX[o], PY[o], PZ[o]);
      SXs[o] = p[0]; SYs[o] = p[1]; SZs[o] = p[3];
    }
  }

  const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

  function draw() {
    const w = cv.width, hgt = cv.height;
    g.clearRect(0, 0, w, hgt);
    const R = 1.5 * hh;
    // 접시 + 그림자 (바닥 y=0 의 원 → 타원)
    const c0 = proj(0, 0, 0), rr = R * 1.75 * c0[2] * S;
    const ry = rr * Math.abs(Math.sin(PIT));
    g.fillStyle = 'rgba(120,52,40,.10)'; g.beginPath(); g.ellipse(c0[0], c0[1] + hh * 0.16 * S, rr * 1.12, ry * 1.12, 0, 0, 6.2832); g.fill();
    g.fillStyle = 'rgba(120,52,40,.12)'; g.beginPath(); g.ellipse(c0[0], c0[1] + hh * 0.1 * S, rr * 1.04, ry * 1.04, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#e9d6cc'; g.beginPath(); g.ellipse(c0[0], c0[1] + hh * 0.07 * S, rr, ry, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#fffaf4'; g.beginPath(); g.ellipse(c0[0], c0[1], rr, ry, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#f4e8de'; g.beginPath(); g.ellipse(c0[0], c0[1], rr * 0.74, ry * 0.74, 0, 0, 6.2832); g.fill();
    g.fillStyle = '#fffdf9'; g.beginPath(); g.ellipse(c0[0], c0[1] - hh * 0.01 * S, rr * 0.68, ry * 0.68, 0, 0, 6.2832); g.fill();
    // 푸딩 그림자 (높이에 따라 옅어짐)
    let minY = 1e9, cxm = 0; for (let i = 0; i < sim.cnt; i++) { if (sim.P[i * 3 + 1] < minY) minY = sim.P[i * 3 + 1]; cxm += sim.P[i * 3]; }
    cxm /= sim.cnt;
    const air = Math.max(0.15, 1 - minY / (2.5 * hh));
    g.fillStyle = `rgba(150,80,40,${0.2 * air})`;
    const sc = proj(cxm, 0, 0); g.beginPath(); g.ellipse(sc[0], sc[1], R * 1.05 * S * sc[2], R * 1.05 * S * sc[2] * Math.abs(sP), 0, 0, 6.2832); g.fill();

    surfaceUpdate();
    const nTot = sim.nS * NST;
    idxB.length = 0; idxF.length = 0;
    for (let t = 0; t < sim.nS; t++) for (let q = 0; q < NST; q++) {
      const st = stris[q], a = t * NSV + st[0], b = t * NSV + st[1], c = t * NSV + st[2];
      const ti = t * NST + q;
      key[ti] = SZs[a] + SZs[b] + SZs[c];
      // 뷰 공간 법선 z 로 앞/뒤 판정
      const nx = NXs[a] + NXs[b] + NXs[c], ny = NYs[a] + NYs[b] + NYs[c], nz = NZs[a] + NZs[b] + NZs[c];
      const xr = nx * cY + nz * sY, zr = -nx * sY + nz * cY, nzv = zr * cP + ny * sP;
      (nzv > 0 ? idxF : idxB).push(ti);
    }
    idxB.sort((a, b) => key[a] - key[b]); idxF.sort((a, b) => key[a] - key[b]);

    const paint = (ti, front) => {
      const t = (ti / NST) | 0, q = ti - t * NST, st = stris[q];
      const a = t * NSV + st[0], b = t * NSV + st[1], c = t * NSV + st[2];
      let nx = NXs[a] + NXs[b] + NXs[c], ny = NYs[a] + NYs[b] + NYs[c], nz = NZs[a] + NZs[b] + NZs[c];
      const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      // 뷰 공간으로 회전 (조명은 카메라에 고정)
      const xr = nx * cY + nz * sY, zr = -nx * sY + nz * cY, yv = ny * cP - zr * sP, zv = zr * cP + ny * sP;
      const hgt = (subH[a] + subH[b] + subH[c]) / 3, ang = (subA[a] + subA[b] + subA[c]) / 3;
      // 캐러멜: 윗면 전체 + 옆면으로 흘러내린 불규칙한 경계
      const edge = 0.86 + 0.07 * Math.sin(ang * 5 + 1.3) + 0.05 * Math.sin(ang * 11 + 0.4);
      const car = sstep(edge - 0.045, edge + 0.02, hgt);
      const d = Math.max(0, xr * L[0] + yv * L[1] + zv * L[2]);
      const fz = Math.abs(zv);
      const rim = Math.pow(1 - fz, 2.2);
      const sp = Math.pow(Math.max(0, xr * Hv[0] + yv * Hv[1] + zv * Hv[2]), car > 0.5 ? 46 : 22);
      let r, gg, bb;
      // 커스터드 본체: 아래로 갈수록 연한 노랑, 두께 큰 곳은 진하게
      const cr = 255, cg = 212 + 26 * hgt, cb = 112 + 46 * hgt;
      const lum = 0.74 + 0.4 * d;
      r = cr * lum; gg = cg * lum; bb = cb * lum;
      if (car > 0) { const cl = 0.5 + 0.8 * d; r += (172 * cl - r) * car; gg += (80 * cl - gg) * car; bb += (26 * cl - bb) * car; }
      // 림(가장자리로 빛이 투과되는 느낌) + 하이라이트
      r += 36 * rim; gg += 24 * rim; bb += 8 * rim;
      const hl = sp * (car > 0.5 ? 0.95 : 0.38);
      r += 255 * hl; gg += 245 * hl; bb += 225 * hl;
      if (!front) { r *= 0.92; gg *= 0.76; bb *= 0.55; }
      g.fillStyle = front ? `rgba(${Math.min(255, r) | 0},${Math.min(255, gg) | 0},${Math.min(255, bb) | 0},${(0.9 + 0.1 * car).toFixed(2)})`
        : `rgb(${Math.min(255, r) | 0},${Math.min(255, gg) | 0},${Math.min(255, bb) | 0})`;
      g.strokeStyle = g.fillStyle;
      let x0 = SXs[a], y0 = SYs[a], x1 = SXs[b], y1 = SYs[b], x2 = SXs[c], y2 = SYs[c];
      if (!front) {
        const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3, e = 0.7;
        let dx = x0 - mx, dy = y0 - my, l = Math.hypot(dx, dy) || 1; x0 += dx / l * e; y0 += dy / l * e;
        dx = x1 - mx; dy = y1 - my; l = Math.hypot(dx, dy) || 1; x1 += dx / l * e; y1 += dy / l * e;
        dx = x2 - mx; dy = y2 - my; l = Math.hypot(dx, dy) || 1; x2 += dx / l * e; y2 += dy / l * e;
      }
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill(); if (front) g.stroke();
    };
    g.lineWidth = 0.8; g.lineJoin = 'round';
    for (const ti of idxB) paint(ti, false);
    for (const ti of idxF) paint(ti, true);

    // 숟가락 (커서 구 = 숟가락 머리)
    if (sim.sph.y > -9000) {
      const sp = proj(sim.sph.x, sim.sph.y, sim.sph.z), r = sim.sph.r * sp[2] * S;
      const dx = 0.85, dy = -0.53, nx = -dy, ny = dx; // 손잡이 방향·법선
      const x0 = sp[0] + dx * r * 0.8, y0 = sp[1] + dy * r * 0.8, x1 = sp[0] + dx * r * 4.6, y1 = sp[1] + dy * r * 4.6;
      g.fillStyle = '#b8b1a6'; g.beginPath();
      g.moveTo(x0 + nx * r * 0.13, y0 + ny * r * 0.13); g.lineTo(x1 + nx * r * 0.24, y1 + ny * r * 0.24); g.lineTo(x1 - nx * r * 0.24, y1 - ny * r * 0.24); g.lineTo(x0 - nx * r * 0.13, y0 - ny * r * 0.13); g.closePath(); g.fill();
      g.fillStyle = '#f4efe8'; g.beginPath();
      g.moveTo(x0 + nx * r * 0.04, y0 + ny * r * 0.04); g.lineTo(x1 + nx * r * 0.1, y1 + ny * r * 0.1); g.lineTo(x1 - nx * r * 0.02, y1 - ny * r * 0.02); g.lineTo(x0 - nx * r * 0.02, y0 - ny * r * 0.02); g.closePath(); g.fill();
      const gr = g.createRadialGradient(sp[0] - r * 0.35, sp[1] - r * 0.4, r * 0.08, sp[0], sp[1], r);
      gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#d9d4cc'); gr.addColorStop(1, '#8e8780');
      g.fillStyle = gr; g.beginPath(); g.ellipse(sp[0], sp[1], r, r * 0.84, -0.55, 0, 6.2832); g.fill();
    }
  }

  // ── 입력 / 시나리오
  const onMove = e => { const r = root.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) userAt = performance.now(); };
  const onDown = e => { const r = root.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) { pressed = true; userAt = performance.now(); } };
  const onUp = () => { pressed = false; };
  addEventListener('pointermove', onMove, { passive: true }); addEventListener('pointerdown', onDown); addEventListener('pointerup', onUp);
  const btnKick = root.querySelector('[data-act="kick"]');
  const doKick = () => sim.kick(1200 * (hh / 100) ** 0.5 * 0.9, (Math.random() - 0.5) * 6);
  btnKick && btnKick.addEventListener('click', doKick);

  function controller() {
    cyc += 1 / 60;
    setYaw(cyc);
    const real = performance.now() - userAt < 2500;
    let px, py;
    if (real) { const r = root.getBoundingClientRect(); px = ctx.mouse.x - r.left; py = ctx.mouse.y - r.top; }
    else {
      const ph = cyc * 0.8;
      px = cx + Math.sin(ph) * hh * 2.1; py = cy - hh * (1.15 + 0.55 * Math.sin(ph * 1.7 + 0.6));
    }
    const zc = 1.5 * hh + 0.5 * sim.sph.r - (pressed ? 0.7 * sim.sph.r : 0);
    const [wx, wy] = unproject(px, py, zc);
    sim.sph.tx = wx; sim.sph.ty = Math.max(sim.sph.r * 0.5, wy); sim.sph.tz = zc;
    if (cyc > kickAt && !ctx.reduced) { doKick(); kickAt = cyc + 5.2; }
  }

  // ── 루프
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  let ro = null, rt = 0, lastW = 0;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - lastW) < 2) return;
      clearTimeout(rt); rt = setTimeout(() => { if (alive) { build(); lastW = root.clientWidth; } }, 200);
    });
    ro.observe(root);
  }
  build(); lastW = root.clientWidth;
  let acc = 0, lastDraw = 0, hudAt = 0;
  const off = ctx.tick(() => {
    if (!vis || document.hidden) { last = performance.now(); return; }
    const now = performance.now();
    acc += Math.min(100, now - last); last = now;
    if (now - lastDraw < 38) return;
    lastDraw = now;
    let k = 0;
    while (acc >= 16.667 && k < 4) { controller(); sim.step(); acc -= 16.667; k++; }
    if (acc > 50) acc = 0;
    draw();
    if (stat && now - hudAt > 600) {
      hudAt = now;
      const hl = sim.health();
      stat.textContent = `정점 ${sim.cnt} · 사면체 ${sim.nT} · 부피 보존 ${(hl.volRatio * 100).toFixed(1)}% · 반전 ${hl.inv}`;
    }
  });

  return () => {
    alive = false; off(); io.disconnect(); ro && ro.disconnect(); clearTimeout(rt);
    removeEventListener('pointermove', onMove); removeEventListener('pointerdown', onDown); removeEventListener('pointerup', onUp);
    document.removeEventListener('visibilitychange', onVis);
    btnKick && btnKick.removeEventListener('click', doKick);
  };
}
