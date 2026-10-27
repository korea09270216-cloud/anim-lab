// s166 — XPBD 천. 엔진 없이 직접 구현한 솔버:
//  · 서브스텝 8 × 반복 1 (Small Steps), 신축 compliance 0(하드), 굽힘 compliance > 0 (대향 정점 거리)
//  · 커서 구 충돌, 바닥(마찰), 공간 해시 자기충돌(두께 0.8h), 속도 상한 clamp
//  · 삼각형 면 법선 기반 바람(상대속도 투영), 핀 고정(고리) / 풀기
// 시뮬 코어(createCloth)는 DOM 이 없어 node 에서도 돌린다.

export function createCloth(o = {}) {
  const N = o.n || 20, h = o.h || 22, SUB = o.substeps || 8;
  const STEP = 1 / 60, dt = STEP / SUB, idt = 1 / dt;
  const cnt = N * N;
  const G = (o.gravity || 110) * h;
  const th = h * (o.thick || 0.8), th2 = th * th;
  const maxV = 0.25 * th / dt;
  const alphaB = (o.bend == null ? 3e-5 : o.bend) / (dt * dt);
  const drag = o.drag == null ? 0.5 : o.drag;
  const CW = o.windGain == null ? 1.4 : o.windGain;
  const ox = o.ox || 0, oy = o.oy || 0;
  const floorY = o.floorY == null ? oy + 26 * h : o.floorY;

  const P = new Float64Array(cnt * 3), Q = new Float64Array(cnt * 3), V = new Float64Array(cnt * 3);
  const P0 = new Float64Array(cnt * 3), PF = new Float64Array(cnt * 3), W = new Float64Array(cnt);
  const pins = o.pins || [0, 4, 8, 11, 15, 19];
  const gather = o.gather == null ? 0.74 : o.gather, pleatA = (o.pleat == null ? 1.1 : o.pleat) * h;
  // PF = 휴지(평면) 배치 → 제약 길이, P0 = 시작 배치(고리 간격을 좁혀 주름이 잡힌 커튼)
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (j * N + i) * 3;
    PF[k] = ox + (i - (N - 1) / 2) * h; PF[k + 1] = oy + j * h; PF[k + 2] = 0;
    let z = Math.sin(i * 1.31 + j * 0.77) * 0.03 * h;
    for (let q = 0; q < pins.length - 1; q++) if (i >= pins[q] && i <= pins[q + 1]) {
      z += (q & 1 ? -1 : 1) * Math.sin(Math.PI * (i - pins[q]) / (pins[q + 1] - pins[q])) * pleatA * (1 - 0.4 * j / (N - 1));
    }
    P0[k] = ox + (i - (N - 1) / 2) * h * gather; P0[k + 1] = oy + j * h; P0[k + 2] = z;
  }

  // ── 메시: 체커보드 대각선(등방성 ↑), 삼각형 (a,b,c) 는 평면 상태에서 +z 법선
  const triL = [];
  for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
    const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
    if ((i + j) & 1) triL.push(a, b, d, a, d, c); else triL.push(a, b, c, b, d, c);
  }
  const tri = Uint16Array.from(triL), nTri = tri.length / 3;
  const edges = new Map();
  const addE = (u, v, opp) => {
    const a = Math.min(u, v), b = Math.max(u, v), key = a * cnt + b;
    let e = edges.get(key);
    if (!e) { e = { a, b, opp: [] }; edges.set(key, e); }
    e.opp.push(opp);
  };
  for (let t = 0; t < tri.length; t += 3) {
    addE(tri[t], tri[t + 1], tri[t + 2]); addE(tri[t + 1], tri[t + 2], tri[t]); addE(tri[t + 2], tri[t], tri[t + 1]);
  }
  const sA = [], sB = [], sL = [], bA = [], bB = [], bL = [];
  const dist0 = (u, v) => Math.hypot(PF[u * 3] - PF[v * 3], PF[u * 3 + 1] - PF[v * 3 + 1], PF[u * 3 + 2] - PF[v * 3 + 2]);
  for (const e of edges.values()) {
    sA.push(e.a); sB.push(e.b); sL.push(dist0(e.a, e.b));
    if (e.opp.length === 2) { bA.push(e.opp[0]); bB.push(e.opp[1]); bL.push(dist0(e.opp[0], e.opp[1])); }
  }
  const nS = sA.length, nB = bA.length;
  const SA = Int32Array.from(sA), SB = Int32Array.from(sB), SL = Float64Array.from(sL);
  const BA = Int32Array.from(bA), BB = Int32Array.from(bB), BL = Float64Array.from(bL);

  // ── 공간 해시 (카운팅 정렬)
  const TS = 1031, cs = new Int32Array(TS + 2), fp = new Int32Array(TS + 2), ent = new Int32Array(cnt), hi = new Int32Array(cnt);
  const hashC = (x, y, z) => ((Math.imul(x, 92837111) ^ Math.imul(y, 689287499) ^ Math.imul(z, 283923481)) >>> 0) % TS;

  const sph = { x: 0, y: -9999, z: 0, r: 3.2 * h, tx: 0, ty: -9999, tz: 0, px: 0, py: 0, pz: 0 };
  const wind = { amp: 0 };
  let time = 0, released = false, contacts = 0, windOn = 1;

  function reset() {
    P.set(P0); Q.set(P0); V.fill(0); W.fill(1); released = false; time = 0;
    for (const c of pins) W[c] = 0;
  }
  function release() { // 위쪽이 앞으로 넘어가며 접혀 떨어지도록 초기 회전 임펄스
    W.fill(1); released = true;
    for (let i = 0; i < cnt; i++) { const j = (i / N) | 0; V[i * 3] = 0; V[i * 3 + 2] = 560 * (1 - j / (N - 1)) * (h / 22) + Math.sin(i * 2.3) * 60; }
  }
  reset();

  function applyWind() {
    const ws = wind.amp * h * 70 * windOn;
    if (ws === 0) return;
    const k = CW * STEP / (3 * h * h), ih = 1 / h;
    for (let t = 0; t < tri.length; t += 3) {
      const a = tri[t] * 3, b = tri[t + 1] * 3, c = tri[t + 2] * 3;
      const e1x = P[b] - P[a], e1y = P[b + 1] - P[a + 1], e1z = P[b + 2] - P[a + 2];
      const e2x = P[c] - P[a], e2y = P[c + 1] - P[a + 1], e2z = P[c + 2] - P[a + 2];
      let nx = e1y * e2z - e1z * e2y, ny = e1z * e2x - e1x * e2z, nz = e1x * e2y - e1y * e2x;
      const l = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (l < 1e-9) continue;
      nx /= l; ny /= l; nz /= l;
      const cx = (P[a] + P[b] + P[c]) * ih / 3, cy = (P[a + 1] + P[b + 1] + P[c + 1]) * ih / 3;
      const wz = ws * (0.55 + 0.45 * Math.sin(cx * 0.28 + time * 1.9) * Math.cos(cy * 0.2 - time * 1.1));
      const wx = ws * 0.55 * Math.sin(time * 0.8 + cy * 0.3), wy = -ws * 0.06;
      const vx = (V[a] + V[b] + V[c]) / 3, vy = (V[a + 1] + V[b + 1] + V[c + 1]) / 3, vz = (V[a + 2] + V[b + 2] + V[c + 2]) / 3;
      const rel = nx * (wx - vx) + ny * (wy - vy) + nz * (wz - vz);
      const f = rel * k * (l * 0.5);
      for (const q of [a, b, c]) {
        if (W[q / 3] === 0) continue;
        V[q] += nx * f; V[q + 1] += ny * f; V[q + 2] += nz * f;
      }
    }
  }

  function selfCollide() {
    cs.fill(0);
    const inv = 1 / th;
    for (let i = 0; i < cnt; i++) {
      const p = i * 3;
      const hv = hashC(Math.floor(P[p] * inv), Math.floor(P[p + 1] * inv), Math.floor(P[p + 2] * inv));
      hi[i] = hv; cs[hv + 1]++;
    }
    for (let k = 0; k <= TS; k++) cs[k + 1] += cs[k];
    fp.set(cs);
    for (let i = 0; i < cnt; i++) ent[fp[hi[i]]++] = i;
    for (let i = 0; i < cnt; i++) {
      const pi = i * 3, ix = Math.floor(P[pi] * inv), iy = Math.floor(P[pi + 1] * inv), iz = Math.floor(P[pi + 2] * inv);
      const wi = W[i], gi = i % N, gj = (i / N) | 0;
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const hv = hashC(ix + dx, iy + dy, iz + dz);
        for (let e = cs[hv], end = cs[hv + 1]; e < end; e++) {
          const j = ent[e];
          if (j <= i) continue;
          const wj = W[j];
          if (wi + wj === 0) continue;
          const pj = j * 3;
          const ddx = P[pj] - P[pi], ddy = P[pj + 1] - P[pi + 1], ddz = P[pj + 2] - P[pi + 2];
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 >= th2) continue;
          const ri = (j % N) - gi, rj = ((j / N) | 0) - gj;
          const rest2 = h * h * (ri * ri + rj * rj);
          let minD = th;
          if (rest2 < th2) { if (d2 > rest2) continue; minD = Math.sqrt(rest2); }
          const dist = Math.sqrt(d2);
          let nx, ny, nz;
          if (dist < 1e-9) { nx = 0; ny = 0; nz = 1; } else { nx = ddx / dist; ny = ddy / dist; nz = ddz / dist; }
          const corr = (minD - dist) / (wi + wj);
          P[pi] -= nx * corr * wi; P[pi + 1] -= ny * corr * wi; P[pi + 2] -= nz * corr * wi;
          P[pj] += nx * corr * wj; P[pj + 1] += ny * corr * wj; P[pj + 2] += nz * corr * wj;
          contacts++;
        }
      }
    }
  }

  function substep(sk) {
    const mv2 = maxV * maxV, dm = 1 - drag * dt;
    for (let i = 0; i < cnt; i++) {
      if (W[i] === 0) continue;
      const p = i * 3;
      V[p + 1] += G * dt;
      V[p] *= dm; V[p + 1] *= dm; V[p + 2] *= dm;
      if (released) { V[p + 2] -= P[p + 2] * 4 * dt; V[p + 2] *= 1 - 3 * dt; } // 떨어진 천이 화면 밖(깊이 방향)으로 흘러가지 않게
      const v2 = V[p] * V[p] + V[p + 1] * V[p + 1] + V[p + 2] * V[p + 2];
      if (v2 > mv2) { const s = maxV / Math.sqrt(v2); V[p] *= s; V[p + 1] *= s; V[p + 2] *= s; }
      Q[p] = P[p]; Q[p + 1] = P[p + 1]; Q[p + 2] = P[p + 2];
      P[p] += V[p] * dt; P[p + 1] += V[p + 1] * dt; P[p + 2] += V[p + 2] * dt;
    }
    // 신축 (compliance 0 = 하드) — 한 서브스텝에 2회 스윕(돌풍 때 고무처럼 늘어나는 것 억제)
    for (let c = 0, nn = nS * 2; c < nn; c++) {
      const ci = c < nS ? c : nS * 2 - 1 - c; // 정방향 → 역방향 스윕(방향 편향 상쇄)
      const a = SA[ci], b = SB[ci], pa = a * 3, pb = b * 3;
      const dx = P[pa] - P[pb], dy = P[pa + 1] - P[pb + 1], dz = P[pa + 2] - P[pb + 2];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (l < 1e-9) continue;
      const wa = W[a], wb = W[b], ws = wa + wb;
      if (ws === 0) continue;
      const s = (SL[ci] - l) / (l * ws);
      P[pa] += wa * s * dx; P[pa + 1] += wa * s * dy; P[pa + 2] += wa * s * dz;
      P[pb] -= wb * s * dx; P[pb + 1] -= wb * s * dy; P[pb + 2] -= wb * s * dz;
    }
    // 굽힘 (compliance > 0, α̃ = α/dt²)
    for (let c = 0; c < nB; c++) {
      const a = BA[c], b = BB[c], pa = a * 3, pb = b * 3;
      const dx = P[pa] - P[pb], dy = P[pa + 1] - P[pb + 1], dz = P[pa + 2] - P[pb + 2];
      const l = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (l < 1e-9) continue;
      const wa = W[a], wb = W[b], ws = wa + wb;
      if (ws === 0) continue;
      const s = (BL[c] - l) / (l * (ws + alphaB));
      P[pa] += wa * s * dx; P[pa + 1] += wa * s * dy; P[pa + 2] += wa * s * dz;
      P[pb] -= wb * s * dx; P[pb + 1] -= wb * s * dy; P[pb + 2] -= wb * s * dz;
    }
    selfCollide();
    // 커서 구 (키네마틱, 서브스텝마다 보간 이동)
    const k = (sk + 1) / SUB;
    const sx = sph.px + (sph.x - sph.px) * k, sy = sph.py + (sph.y - sph.py) * k, sz = sph.pz + (sph.z - sph.pz) * k;
    const Re = sph.r + 0.5 * th, Re2 = Re * Re;
    const fy = floorY - 0.5 * th;
    for (let i = 0; i < cnt; i++) {
      if (W[i] === 0) continue;
      const p = i * 3;
      const dx = P[p] - sx, dy = P[p + 1] - sy, dz = P[p + 2] - sz;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < Re2) {
        if (d2 < 1e-9) { P[p + 2] = sz + Re; } else { const s = Re / Math.sqrt(d2); P[p] = sx + dx * s; P[p + 1] = sy + dy * s; P[p + 2] = sz + dz * s; }
      }
      if (P[p + 1] > fy) { P[p + 1] = fy; P[p] += (Q[p] - P[p]) * 0.6; P[p + 2] += (Q[p + 2] - P[p + 2]) * 0.6; }
    }
    for (let i = 0; i < cnt; i++) {
      if (W[i] === 0) continue;
      const p = i * 3;
      V[p] = (P[p] - Q[p]) * idt; V[p + 1] = (P[p + 1] - Q[p + 1]) * idt; V[p + 2] = (P[p + 2] - Q[p + 2]) * idt;
    }
  }

  function step() {
    contacts = 0;
    // 구 목표로 이동 (스텝당 이동량 제한 → 터널링 방지)
    sph.px = sph.x; sph.py = sph.y; sph.pz = sph.z;
    let mx = sph.tx - sph.x, my = sph.ty - sph.y, mz = sph.tz - sph.z;
    const ml = Math.hypot(mx, my, mz), lim = 0.5 * sph.r;
    if (sph.y < -9000) { sph.px = sph.tx; sph.py = sph.ty; sph.pz = sph.tz; sph.x = sph.tx; sph.y = sph.ty; sph.z = sph.tz; }
    else if (ml > 1e-6) { const s = Math.min(1, lim / ml); sph.x += mx * s; sph.y += my * s; sph.z += mz * s; }
    applyWind();
    for (let s = 0; s < SUB; s++) substep(s);
    time += STEP;
  }

  function stats() {
    let ms = 0, sum = 0;
    for (let c = 0; c < nS; c++) {
      const pa = SA[c] * 3, pb = SB[c] * 3;
      const l = Math.hypot(P[pa] - P[pb], P[pa + 1] - P[pb + 1], P[pa + 2] - P[pb + 2]);
      const e = Math.abs(l / SL[c] - 1); sum += e; if (e > ms) ms = e;
    }
    let bad = 0, vmax = 0;
    for (let i = 0; i < cnt * 3; i++) { if (!Number.isFinite(P[i])) bad++; }
    for (let i = 0; i < cnt; i++) { const p = i * 3; const v = Math.hypot(V[p], V[p + 1], V[p + 2]); if (v > vmax) vmax = v; }
    return { maxStretch: ms, meanStretch: sum / nS, nan: bad, vmax, contacts, nS, nB, floorY };
  }

  return {
    N, h, cnt, P, V, W, tri, nTri, sph, wind, th, floorY, step, reset, release, stats,
    get released() { return released; }, get time() { return time; },
    setWindOn(v) { windOn = v; }, pins,
  };
}

// ───────────────────────── 렌더 / 시나리오 ─────────────────────────
const COL = { top: [214, 64, 46], bot: [148, 26, 38], gold: [232, 180, 74], pocket: [100, 18, 28] };
const SUBD = 2; // 렌더 메시 = 시뮬 격자를 Catmull-Rom 반스텝으로 2배 세분(39×39)

export default function init(root, ctx) {
  const cv = root.querySelector('.s166__cv');
  const g = cv && cv.getContext && cv.getContext('2d');
  if (!g) { root.classList.add('is-static'); return; }
  const stat = root.querySelector('.s166__stat');
  const btns = [...root.querySelectorAll('[data-act]')];
  const RS = ctx.reduced ? 0.5 : 0.62;
  const YAW = -0.5, PIT = 0.3, F = 1700;
  const cY = Math.cos(YAW), sY = Math.sin(YAW), cP = Math.cos(PIT), sP = Math.sin(PIT);
  const Lraw = [-0.42, -0.62, 0.66], Ll = Math.hypot(...Lraw), L = Lraw.map(v => v / Ll);
  const Hraw = [L[0], L[1], L[2] + 1], Hl = Math.hypot(...Hraw), Hv = Hraw.map(v => v / Hl);

  let sim, W = 0, H = 0, S = RS, pvx = 0, pvy = 0, M = 0, nF = 0, nT = 0;
  let ftri, baseR, baseG, baseB, idx, key, FP, FX, FY, FZ, FN;
  let fade = 0, cyc = 0, manualGust = 0, userAt = -1e9, vis = true, alive = true, last = performance.now();
  const virt = { x: 0, y: 0 };

  function build() {
    W = root.clientWidth; H = root.clientHeight;
    cv.width = Math.round(W * RS); cv.height = Math.round(H * RS); S = cv.width / W;
    const narrow = W < 820;
    const h = Math.min(H * (narrow ? 0.022 : 0.0285), W * (narrow ? 0.8 : 0.62) / 20);
    const cx = narrow ? W * 0.5 : W * 0.7, top = H * (narrow ? 0.42 : 0.15);
    sim = createCloth({ n: 20, h, ox: cx, oy: top, floorY: top + 19 * h + 4.4 * h });
    pvx = cx; pvy = top + 9.5 * h;
    const n = sim.N;
    M = (n - 1) * SUBD + 1; nF = M * M;
    // 렌더 삼각형 (체커 대각선) + 휴지 UV 기반 색
    const tl = [];
    for (let j = 0; j < M - 1; j++) for (let i = 0; i < M - 1; i++) {
      const a = j * M + i, b = a + 1, c = a + M, d = c + 1;
      if ((i + j) & 1) tl.push(a, b, d, a, d, c); else tl.push(a, b, c, b, d, c);
    }
    ftri = Uint16Array.from(tl); nT = ftri.length / 3;
    baseR = new Float32Array(nT); baseG = new Float32Array(nT); baseB = new Float32Array(nT);
    for (let t = 0; t < nT; t++) {
      let gi = 0, gj = 0;
      for (let q = 0; q < 3; q++) { const v = ftri[t * 3 + q]; gi += (v % M) / SUBD; gj += ((v / M) | 0) / SUBD; }
      gi /= 3; gj /= 3;
      const v = gj / (n - 1);
      let col;
      if (gj < 1.15) col = COL.pocket;
      else if (gj > n - 3.1) col = gj < n - 2.45 ? [150, 30, 36] : COL.gold;
      else {
        const m = Math.max(0, (v - 0.06) / 0.8);
        col = [0, 1, 2].map(k => COL.top[k] + (COL.bot[k] - COL.top[k]) * m);
      }
      baseR[t] = col[0]; baseG[t] = col[1]; baseB[t] = col[2];
    }
    FP = new Float64Array(nF * 3); FX = new Float64Array(nF); FY = new Float64Array(nF); FZ = new Float64Array(nF); FN = new Float64Array(nF * 3);
    idx = Array.from({ length: nT }, (_, i) => i); key = new Float64Array(nT);
    sim.sph.r = 3.2 * h;
    cyc = 0; fade = 0;
    for (let i = 0; i < 70; i++) { sim.wind.amp = 0.3; sim.step(); }
  }

  // 화면 좌표 → 월드(구 z 평면)
  const unproject = (sx, sy, z) => {
    const xr = sx - pvx, yr = sy - pvy;
    const x = (xr - z * sY) / cY, zr = -x * sY + z * cY;
    return [x + pvx, (yr - zr * sP) / cP + pvy];
  };

  function controller() {
    const t = cyc;
    const base = sim.released ? 0.05 : 0.4 + 0.14 * Math.sin(t * 0.9);
    const gs = (a, d) => (t > a && t < a + d ? Math.pow(Math.sin(Math.PI * (t - a) / d), 2) : 0);
    const gust = 1.1 * gs(3.2, 2.4) + 1.3 * gs(8.4, 2.6);
    manualGust *= 0.985;
    sim.wind.amp = (base + gust + manualGust) * (ctx.reduced ? 0.4 : 1);
    // 가상 포인터 (사용자가 만지면 양보)
    const real = performance.now() - userAt < 2500;
    let px, py;
    if (real) { const r = root.getBoundingClientRect(); px = ctx.mouse.x - r.left; py = ctx.mouse.y - r.top; }
    else {
      const ph = t * 0.75;
      px = pvx + Math.cos(ph) * sim.h * 8.5; py = pvy + Math.sin(ph * 1.37 + 1) * sim.h * 6.5 + (sim.released ? sim.h * 3 : 0);
    }
    const sz = -0.45 * sim.sph.r;
    const [wx, wy] = unproject(px, py, sz);
    sim.sph.tx = wx; sim.sph.ty = wy; sim.sph.tz = sz;
    // 낙하 → 쌓임 → 다시 걸기
    if (!sim.released && t > 12.6 && !ctx.reduced) sim.release();
    if (t > 19.4 && fade === 0) fade = 1;
    if (fade === 1 && t > 19.9) build();
  }

  function simStep() { cyc += 1 / 60; controller(); sim.step(); }

  // ── 그리기: 시뮬 격자 → 세분 메시 → 투영 → 법선 → 깊이 정렬 → 삼각형 채우기
  const half = (a, b, c, d) => (-a + 9 * b + 9 * c - d) * 0.0625;
  function refine() {
    const P = sim.P, n = sim.N;
    const cl = v => (v < 0 ? 0 : v > n - 1 ? n - 1 : v);
    for (let fj = 0; fj < M; fj++) for (let fi = 0; fi < M; fi++) {
      const o = (fj * M + fi) * 3, i0 = fi >> 1, j0 = fj >> 1, oi = fi & 1, oj = fj & 1;
      for (let c = 0; c < 3; c++) {
        const at = (i, j) => P[(cl(j) * n + cl(i)) * 3 + c];
        let v;
        if (!oi && !oj) v = at(i0, j0);
        else if (oi && !oj) v = half(at(i0 - 1, j0), at(i0, j0), at(i0 + 1, j0), at(i0 + 2, j0));
        else if (!oi && oj) v = half(at(i0, j0 - 1), at(i0, j0), at(i0, j0 + 1), at(i0, j0 + 2));
        else {
          const r = k => half(at(i0 - 1, k), at(i0, k), at(i0 + 1, k), at(i0 + 2, k));
          v = half(r(j0 - 1), r(j0), r(j0 + 1), r(j0 + 2));
        }
        FP[o + c] = v;
      }
    }
  }
  const proj3 = (x, y, z) => {
    x -= pvx; y -= pvy;
    const xr = x * cY + z * sY, zr = -x * sY + z * cY, yr = y * cP + zr * sP, zz = zr * cP - y * sP, f = F / (F - zz);
    return [(pvx + xr * f) * S, (pvy + yr * f) * S, f, zz];
  };
  function projectAndNormals() {
    for (let i = 0; i < nF; i++) {
      const p = i * 3, x = FP[p] - pvx, y = FP[p + 1] - pvy, z = FP[p + 2];
      const xr = x * cY + z * sY, zr = -x * sY + z * cY, yr = y * cP + zr * sP, zz = zr * cP - y * sP, f = F / (F - zz);
      FX[i] = (pvx + xr * f) * S; FY[i] = (pvy + yr * f) * S; FZ[i] = zz;
    }
    // 격자 중심차분 접선의 외적 = 부드러운 정점 법선
    for (let j = 0; j < M; j++) for (let i = 0; i < M; i++) {
      const a = (j * M + (i > 0 ? i - 1 : 0)) * 3, b = (j * M + (i < M - 1 ? i + 1 : i)) * 3;
      const c = ((j > 0 ? j - 1 : 0) * M + i) * 3, d = ((j < M - 1 ? j + 1 : j) * M + i) * 3;
      const ux = FP[b] - FP[a], uy = FP[b + 1] - FP[a + 1], uz = FP[b + 2] - FP[a + 2];
      const vx = FP[d] - FP[c], vy = FP[d + 1] - FP[c + 1], vz = FP[d + 2] - FP[c + 2];
      const o = (j * M + i) * 3;
      FN[o] = uy * vz - uz * vy; FN[o + 1] = uz * vx - ux * vz; FN[o + 2] = ux * vy - uy * vx;
    }
  }

  function draw() {
    const w = cv.width, hh = cv.height;
    g.clearRect(0, 0, w, hh);
    const P = sim.P, n = sim.N, hs = sim.h;
    // 바닥 + 그림자
    const fl = proj3(pvx, sim.floorY, 0);
    g.fillStyle = 'rgba(120,88,52,.10)'; g.fillRect(0, fl[1], w, hh - fl[1]);
    g.fillStyle = 'rgba(120,88,52,.28)'; g.fillRect(0, fl[1], w, Math.max(1, S * 1.5));
    let minX = 1e9, maxX = -1e9, maxY = -1e9;
    for (let i = 0; i < sim.cnt; i++) { const p = i * 3; if (P[p] < minX) minX = P[p]; if (P[p] > maxX) maxX = P[p]; if (P[p + 1] > maxY) maxY = P[p + 1]; }
    const air = Math.max(0, 1 - (sim.floorY - maxY) / (9 * hs));
    if (air > 0.02) {
      const ex = (maxX + minX) / 2, rx = Math.max(hs * 3, (maxX - minX) / 2) * S;
      for (let k = 0; k < 3; k++) {
        g.fillStyle = `rgba(70,38,20,${0.05 * air})`;
        g.beginPath(); g.ellipse(proj3(ex, sim.floorY, 0)[0], fl[1] + S * hs * 0.5, rx * (1.05 - k * 0.2), rx * 0.13 * (1.05 - k * 0.2), 0, 0, 6.2832); g.fill();
      }
    }
    // 봉
    const rodY = P[1] - hs * 0.55;
    const rod0 = proj3(pvx - 9.5 * hs * 0.74 - hs * 2.2, rodY, 0), rod1 = proj3(pvx + 9.5 * hs * 0.74 + hs * 2.2, rodY, 0);
    g.lineCap = 'round';
    g.strokeStyle = '#6d5530'; g.lineWidth = hs * 0.5 * S; g.beginPath(); g.moveTo(rod0[0], rod0[1]); g.lineTo(rod1[0], rod1[1]); g.stroke();
    g.strokeStyle = '#d8b66a'; g.lineWidth = hs * 0.2 * S; g.beginPath(); g.moveTo(rod0[0], rod0[1] - hs * 0.1 * S); g.lineTo(rod1[0], rod1[1] - hs * 0.1 * S); g.stroke();

    refine(); projectAndNormals();
    for (let t = 0; t < nT; t++) key[t] = FZ[ftri[t * 3]] + FZ[ftri[t * 3 + 1]] + FZ[ftri[t * 3 + 2]];
    idx.sort((a, b) => key[a] - key[b]);
    const sphP = proj3(sim.sph.x, sim.sph.y, sim.sph.z), sphKey = sphP[3] * 3;
    let sphDone = sim.sph.y < -9000;
    const drawSphere = () => {
      sphDone = true;
      const r = sim.sph.r * sphP[2] * S;
      const gr = g.createRadialGradient(sphP[0] - r * 0.35, sphP[1] - r * 0.4, r * 0.1, sphP[0], sphP[1], r);
      gr.addColorStop(0, '#fbf6ea'); gr.addColorStop(0.55, '#d9cdb2'); gr.addColorStop(1, '#8c7c5e');
      g.fillStyle = gr; g.beginPath(); g.arc(sphP[0], sphP[1], r, 0, 6.2832); g.fill();
    };
    const ex = 0.55; // 이음새 틈을 가리는 삼각형 확장(px)
    for (let q = 0; q < nT; q++) {
      const t = idx[q];
      if (!sphDone && key[t] > sphKey) drawSphere();
      const a = ftri[t * 3], b = ftri[t * 3 + 1], c = ftri[t * 3 + 2];
      let x0 = FX[a], y0 = FY[a], x1 = FX[b], y1 = FY[b], x2 = FX[c], y2 = FY[c];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      const a3 = a * 3, b3 = b * 3, c3 = c * 3;
      let nx = FN[a3] + FN[b3] + FN[c3], ny = FN[a3 + 1] + FN[b3 + 1] + FN[c3 + 1], nz = FN[a3 + 2] + FN[b3 + 2] + FN[c3 + 2];
      const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      const d = Math.abs(nx * L[0] + ny * L[1] + nz * L[2]);
      const sp = Math.pow(Math.abs(nx * Hv[0] + ny * Hv[1] + nz * Hv[2]), 20) * 0.4;
      let lum = 0.4 + 0.7 * d;
      if (area < 0) lum *= 0.82;
      g.fillStyle = `rgb(${Math.min(255, baseR[t] * lum + 180 * sp) | 0},${Math.min(255, baseG[t] * lum + 160 * sp) | 0},${Math.min(255, baseB[t] * lum + 140 * sp) | 0})`;
      const mx = (x0 + x1 + x2) / 3, my = (y0 + y1 + y2) / 3;
      let dx = x0 - mx, dy = y0 - my, l = Math.hypot(dx, dy) || 1; x0 += dx / l * ex; y0 += dy / l * ex;
      dx = x1 - mx; dy = y1 - my; l = Math.hypot(dx, dy) || 1; x1 += dx / l * ex; y1 += dy / l * ex;
      dx = x2 - mx; dy = y2 - my; l = Math.hypot(dx, dy) || 1; x2 += dx / l * ex; y2 += dy / l * ex;
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.closePath(); g.fill();
    }
    if (!sphDone) drawSphere();
    // 고리(핀)
    if (!sim.released) {
      g.strokeStyle = '#e9cf8a'; g.lineWidth = hs * 0.16 * S;
      for (const c of sim.pins) {
        const p = proj3(P[c * 3], P[c * 3 + 1] - hs * 0.1, P[c * 3 + 2]);
        g.beginPath(); g.arc(p[0], p[1], hs * 0.42 * S * p[2], 0, 6.2832); g.stroke();
      }
    }
  }

  // ── 입력
  const onMove = e => { const r = root.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) userAt = performance.now(); };
  addEventListener('pointermove', onMove, { passive: true });
  const act = {
    gust: () => { manualGust = 1.1; },
    drop: () => { if (!sim.released) { sim.release(); cyc = Math.max(cyc, 12.7); } },
    reset: () => { if (fade === 0) { fade = 1; cyc = Math.max(cyc, 19.4); } },
  };
  const clicks = btns.map(b => { const f = () => act[b.dataset.act] && act[b.dataset.act](); b.addEventListener('click', f); return () => b.removeEventListener('click', f); });

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
    while (acc >= 16.667 && k < 4) { simStep(); acc -= 16.667; k++; }
    if (acc > 50) acc = 0;
    draw();
    cv.style.opacity = fade === 1 ? Math.max(0, 1 - (cyc - 19.4) / 0.5).toFixed(2) : cyc < 0.4 ? Math.min(1, cyc / 0.4).toFixed(2) : '1';
    if (stat && now - hudAt > 600) {
      hudAt = now;
      const s = sim.stats();
      stat.textContent = `입자 ${sim.cnt} · 서브스텝 8 · 제약 ${s.nS + s.nB} · 평균 신축 오차 ${(s.meanStretch * 100).toFixed(2)}% · 자기충돌 ${s.contacts}쌍`;
    }
  });

  return () => {
    alive = false; off(); io.disconnect(); ro && ro.disconnect(); clearTimeout(rt);
    removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
    clicks.forEach(f => f());
  };
}
