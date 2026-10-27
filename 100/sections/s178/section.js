// s178 — 오리가미 시뮬레이터 (bar-and-hinge)
// 삼각 메시의 노드를 질점으로, 제약 3종(축 스프링 · 면 비틀림(평평 유지) · 접기선 비틀림(목표 이면각 ρ·t))을 명시적 적분으로 푼다.
// 모든 접기선이 동시에 목표각으로 당겨지고, 에너지가 가장 낮은 (거의 강체인) 접힘이 창발한다. 렌더 = 면 법선 음영 Canvas2D 페인터.
/* ===== Origami bar-and-hinge core (pure JS, no DOM) ===== */
// 삼각 메시 + 3종 제약(축 스프링·면 비틀림 스프링(평평 유지)·접기선 비틀림 스프링(목표 이면각))을 명시적 적분으로 푼다.
function buildMesh(P, T, creaseFn, faceOf) {
  const N = P.length;
  const x0 = new Float64Array(N * 3);
  for (let i = 0; i < N; i++) { x0[i * 3] = P[i][0]; x0[i * 3 + 1] = P[i][1]; }
  const emap = new Map();
  T.forEach((t, ti) => {
    for (let k = 0; k < 3; k++) {
      const u = t[k], v = t[(k + 1) % 3], w = t[(k + 2) % 3];
      const key = u < v ? u * 65536 + v : v * 65536 + u;
      let e = emap.get(key); if (!e) { e = { u: Math.min(u, v), v: Math.max(u, v), dir: [] }; emap.set(key, e); }
      e.dir.push({ ti, a: u, b: v, w });
    }
  });
  const edges = [], hinges = [], bnd = [];
  for (const e of emap.values()) {
    edges.push(e.u, e.v);
    if (e.dir.length === 1) bnd.push(e.u, e.v);
    if (e.dir.length === 2) {
      const A = e.dir[0], B = e.dir[1];
      // A 삼각형의 유향 변 a→b 를 기준으로: x1=a, x2=b, x3=A.w, x4=B.w
      const c = creaseFn(A.a, A.b, A.ti, B.ti);
      hinges.push({ i: [A.a, A.b, A.w, B.w], s: c ? c.s : 0, max: c ? c.max : 0, crease: !!c });
    }
  }
  // 고정점: 가운데 삼각형 하나(강체 이동·회전 제거)
  let cx = 0, cy = 0; for (const p of P) { cx += p[0]; cy += p[1]; } cx /= N; cy /= N;
  let best = 0, bd = 1e18;
  T.forEach((t, ti) => { const mx = (P[t[0]][0] + P[t[1]][0] + P[t[2]][0]) / 3 - cx, my = (P[t[0]][1] + P[t[1]][1] + P[t[2]][1]) / 3 - cy; const d = mx * mx + my * my; if (d < bd) { bd = d; best = ti; } });
  return { N, x0, T, edges: Int32Array.from(edges), bnd, hinges, pins: T[best].slice(), cx, cy };
}

function gridMesh(W, Hh, posFn, diagFn) {
  // 격자 (W+1)x(Hh+1) 노드, 서브셀마다 삼각형 2개
  const id = (I, J) => I * (Hh + 1) + J, P = [], T = [];
  for (let I = 0; I <= W; I++) for (let J = 0; J <= Hh; J++) P.push(posFn(I, J));
  for (let I = 0; I < W; I++) for (let J = 0; J < Hh; J++) {
    const A = id(I, J), B = id(I + 1, J), C = id(I + 1, J + 1), D = id(I, J + 1);
    if (diagFn(I, J)) { T.push([A, B, C], [A, C, D]); } else { T.push([A, B, D], [B, C, D]); }
  }
  return { P, T, id, lat: (n) => [Math.floor(n / (Hh + 1)), n % (Hh + 1)] };
}

function miuraMesh(sig1, sig2, nx = 6, ny = 6, n = 3, maxA = Math.PI * .6) {
  const a = n, b = n, d = n * .38;
  const V = (i, j) => [i * a + ((j & 1) ? d : 0), j * b];
  const pos = (I, J) => {
    const i = Math.min(Math.floor(I / n), nx - 1), j = Math.min(Math.floor(J / n), ny - 1), u = (I - i * n) / n, v = (J - j * n) / n;
    const p00 = V(i, j), p10 = V(i + 1, j), p11 = V(i + 1, j + 1), p01 = V(i, j + 1);
    return [(1 - u) * (1 - v) * p00[0] + u * (1 - v) * p10[0] + u * v * p11[0] + (1 - u) * v * p01[0], (1 - u) * (1 - v) * p00[1] + u * (1 - v) * p10[1] + u * v * p11[1] + (1 - u) * v * p01[1]];
  };
  const g = gridMesh(nx * n, ny * n, pos, (I, J) => ((I + J) & 1) === 0);
  const creaseFn = (u, v) => {
    const [I1, J1] = g.lat(u), [I2, J2] = g.lat(v);
    if (I1 === I2 && I1 % n === 0 && I1 > 0 && I1 < nx * n) return { s: sig1 * (((I1 / n) & 1) ? -1 : 1), max: maxA };
    if (J1 === J2 && J1 % n === 0 && J1 > 0 && J1 < ny * n) { const i = Math.floor(Math.min(I1, I2) / n), r = J1 / n; return { s: sig2 * (((r + i) & 1) ? -1 : 1), max: maxA }; }
    return null;
  };
  const m = buildMesh(g.P, g.T, creaseFn);
  m.lines = [];
  return m;
}

function cubeMesh(m = 5, sqOpt) {
  // 십자 전개도: 가운데 행 4칸(cx 0..3, cy 0) + 위(1,1) + 아래(1,-1)
  const sq = sqOpt || [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [1, -1]];
  const key = (X, Y) => X * 4096 + (Y + 1024), idOf = new Map(), P = [], T = [], face = [];
  const node = (X, Y) => { const k = key(X, Y); let i = idOf.get(k); if (i === undefined) { i = P.length; idOf.set(k, i); P.push([X / m * 4, Y / m * 4]); } return i; };
  sq.forEach(([cx, cy], si) => {
    for (let p = 0; p < m; p++) for (let q = 0; q < m; q++) {
      const X = cx * m + p, Y = cy * m + q;
      const A = node(X, Y), B = node(X + 1, Y), C = node(X + 1, Y + 1), D = node(X, Y + 1);
      if (((p + q) & 1) === 0) { T.push([A, B, C], [A, C, D]); face.push(si, si); } else { T.push([A, B, D], [B, C, D]); face.push(si, si); }
    }
  });
  const creaseFn = (u, v, ta, tb) => (face[ta] !== face[tb] ? { s: 1, max: Math.PI / 2 } : null);
  return buildMesh(P, T, creaseFn);
}

function baseMesh(m, sd, sm, maxA = Math.PI * .7) {
  // 정사각형 한 장: 두 대각선(sd) + 두 중앙선(sm). 격자 2m x 2m, 대각선이 메시 변과 일치하도록 사분면별 대각 방향을 고른다.
  const M = 2 * m, sc = 8 / M;
  const g = gridMesh(M, M, (I, J) => [(I - m) * sc, (J - m) * sc], (I, J) => (I < m) === (J < m));
  const creaseFn = (u, v) => {
    const [I1, J1] = g.lat(u), [I2, J2] = g.lat(v);
    if (I1 === I2 && I1 === m) return { s: sm, max: maxA };
    if (J1 === J2 && J1 === m) return { s: sm, max: maxA };
    if (I1 - J1 === 0 && I2 - J2 === 0) return { s: sd, max: maxA };
    if (I1 + J1 === M && I2 + J2 === M) return { s: sd, max: maxA };
    return null;
  };
  return buildMesh(g.P, g.T, creaseFn);
}

const SIM = { kA: 60, kC: 12, kF: 24, damp: .25, dt: .03, rmin: .62, kR: 5 };

class Sim {
  constructor(mesh) {
    this.mesh = mesh; const N = this.N = mesh.N;
    this.x = Float64Array.from(mesh.x0); this.v = new Float64Array(N * 3); this.f = new Float64Array(N * 3);
    this.E = mesh.edges; this.nE = this.E.length / 2; this.L0 = new Float64Array(this.nE);
    for (let e = 0; e < this.nE; e++) { const i = this.E[2 * e], j = this.E[2 * e + 1]; this.L0[e] = Math.hypot(mesh.x0[3 * i] - mesh.x0[3 * j], mesh.x0[3 * i + 1] - mesh.x0[3 * j + 1]); }
    const H = mesh.hinges; this.nH = H.length; this.hI = new Int32Array(this.nH * 4); this.hS = new Float64Array(this.nH); this.hM = new Float64Array(this.nH); this.hK = new Float64Array(this.nH);
    H.forEach((h, k) => { this.hI.set(h.i, k * 4); this.hS[k] = h.s; this.hM[k] = h.max; this.hK[k] = h.crease ? SIM.kC : SIM.kF; });
    this.pin = new Uint8Array(N); for (const p of mesh.pins) this.pin[p] = 1;
    // 반발 제외: 그래프 거리 3 이내
    const adj = Array.from({ length: N }, () => new Set());
    for (let e = 0; e < this.nE; e++) { const i = this.E[2 * e], j = this.E[2 * e + 1]; adj[i].add(j); adj[j].add(i); }
    this.excl = adj.map((s, i) => { const out = new Set([i]); let fr = [i]; for (let d = 0; d < 3; d++) { const nf = []; for (const a of fr) for (const b of adj[a]) if (!out.has(b)) { out.add(b); nf.push(b); } fr = nf; } return out; });
    this.t = 0; this.rho = new Float64Array(this.nH);
  }
  reset() { this.x.set(this.mesh.x0); this.v.fill(0); this.t = 0; }
  // 이면각 ρ (밸리 +, 마운틴 −) 와 그 기울기 g1..g4 를 계산
  hingeGrad(k, g) {
    const x = this.x, I = this.hI; const a = I[4 * k] * 3, b = I[4 * k + 1] * 3, c = I[4 * k + 2] * 3, d = I[4 * k + 3] * 3;
    const ex = x[b] - x[a], ey = x[b + 1] - x[a + 1], ez = x[b + 2] - x[a + 2];
    const le2 = ex * ex + ey * ey + ez * ez, le = Math.sqrt(le2) || 1e-9;
    const cx = x[c] - x[a], cy = x[c + 1] - x[a + 1], cz = x[c + 2] - x[a + 2];
    const dx = x[d] - x[a], dy = x[d + 1] - x[a + 1], dz = x[d + 2] - x[a + 2];
    // nA = e × c , nB = d × e
    const nax = ey * cz - ez * cy, nay = ez * cx - ex * cz, naz = ex * cy - ey * cx;
    const nbx = dy * ez - dz * ey, nby = dz * ex - dx * ez, nbz = dx * ey - dy * ex;
    const na2 = nax * nax + nay * nay + naz * naz + 1e-12, nb2 = nbx * nbx + nby * nby + nbz * nbz + 1e-12;
    const dot = nax * nbx + nay * nby + naz * nbz;
    // (nA × nB)·ê
    const cxn = nay * nbz - naz * nby, cyn = naz * nbx - nax * nbz, czn = nax * nby - nay * nbx;
    const sinp = -(cxn * ex + cyn * ey + czn * ez) / le;
    const rho = Math.atan2(sinp, dot);
    if (g) {
      const sA = le / na2, sB = le / nb2;
      const g3x = nax * sA, g3y = nay * sA, g3z = naz * sA, g4x = nbx * sB, g4y = nby * sB, g4z = nbz * sB;
      const u3 = (cx * ex + cy * ey + cz * ez) / le2, u4 = (dx * ex + dy * ey + dz * ez) / le2;
      g[6] = g3x; g[7] = g3y; g[8] = g3z; g[9] = g4x; g[10] = g4y; g[11] = g4z;
      g[0] = -(1 - u3) * g3x - (1 - u4) * g4x; g[1] = -(1 - u3) * g3y - (1 - u4) * g4y; g[2] = -(1 - u3) * g3z - (1 - u4) * g4z;
      g[3] = -u3 * g3x - u4 * g4x; g[4] = -u3 * g3y - u4 * g4y; g[5] = -u3 * g3z - u4 * g4z;
    }
    return rho;
  }
  // 명시적(semi-implicit Euler) 한 스텝. t = 접기 진행률 0..1
  step(t, dt = SIM.dt, rep = true) {
    const N = this.N, x = this.x, v = this.v, f = this.f, g = this._g || (this._g = new Float64Array(12));
    f.fill(0);
    // 1) 축(엣지 길이) 스프링 + 엣지 방향 감쇠
    for (let e = 0; e < this.nE; e++) {
      const i = this.E[2 * e] * 3, j = this.E[2 * e + 1] * 3;
      const dx = x[j] - x[i], dy = x[j + 1] - x[i + 1], dz = x[j + 2] - x[i + 2], L = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
      const c = SIM.kA * (L - this.L0[e]) / L;
      f[i] += c * dx; f[i + 1] += c * dy; f[i + 2] += c * dz; f[j] -= c * dx; f[j + 1] -= c * dy; f[j + 2] -= c * dz;
    }
    // 2) 힌지: 접기선(목표 ρ = s·max·t) + 면(목표 0)
    for (let k = 0; k < this.nH; k++) {
      const rho = this.hingeGrad(k, g); this.rho[k] = rho;
      let dlt = rho - this.hS[k] * this.hM[k] * t;
      if (dlt > Math.PI) dlt -= 2 * Math.PI; else if (dlt < -Math.PI) dlt += 2 * Math.PI;
      const I = this.hI, n0 = I[4 * k] * 3, n1 = I[4 * k + 1] * 3, n2 = I[4 * k + 2] * 3, n3 = I[4 * k + 3] * 3;
      const tau = -this.hK[k] * dlt;
      f[n0] += tau * g[0]; f[n0 + 1] += tau * g[1]; f[n0 + 2] += tau * g[2]; f[n1] += tau * g[3]; f[n1 + 1] += tau * g[4]; f[n1 + 2] += tau * g[5];
      f[n2] += tau * g[6]; f[n2 + 1] += tau * g[7]; f[n2 + 2] += tau * g[8]; f[n3] += tau * g[9]; f[n3 + 1] += tau * g[10]; f[n3 + 2] += tau * g[11];
    }
    // 3) 자기교차 방지(최소): 먼 노드끼리 rmin 안으로 들어오면 밀어낸다
    if (rep && (this.cnt = (this.cnt | 0) + 1) % 3 === 0) this.repel();
    // 4) 적분
    const dm = Math.max(0, 1 - SIM.damp * dt);
    for (let n = 0; n < N; n++) {
      if (this.pin[n]) { v[3 * n] = v[3 * n + 1] = v[3 * n + 2] = 0; continue; }
      for (let c = 0; c < 3; c++) { const q = 3 * n + c; v[q] = (v[q] + f[q] * dt) * dm; x[q] += v[q] * dt; }
    }
    this.t = t;
  }
  repel() {
    const N = this.N, x = this.x, f = this.f, r2 = SIM.rmin * SIM.rmin, ex = this.excl;
    for (let i = 0; i < N; i++) {
      const xi = x[3 * i], yi = x[3 * i + 1], zi = x[3 * i + 2], exi = ex[i];
      for (let j = i + 1; j < N; j++) {
        const dx = xi - x[3 * j]; if (dx > SIM.rmin || dx < -SIM.rmin) continue;
        const dy = yi - x[3 * j + 1]; if (dy > SIM.rmin || dy < -SIM.rmin) continue;
        const dz = zi - x[3 * j + 2]; if (dz > SIM.rmin || dz < -SIM.rmin) continue;
        const d2 = dx * dx + dy * dy + dz * dz; if (d2 >= r2 || exi.has(j)) continue;
        const d = Math.sqrt(d2) || 1e-6, c = 3 * SIM.kR * (SIM.rmin - d) / d;
        f[3 * i] += c * dx; f[3 * i + 1] += c * dy; f[3 * i + 2] += c * dz; f[3 * j] -= c * dx; f[3 * j + 1] -= c * dy; f[3 * j + 2] -= c * dz;
      }
    }
  }
  stats() {
    let maxStrain = 0, mean = 0; const x = this.x;
    for (let e = 0; e < this.nE; e++) { const i = this.E[2 * e] * 3, j = this.E[2 * e + 1] * 3; const L = Math.hypot(x[j] - x[i], x[j + 1] - x[i + 1], x[j + 2] - x[i + 2]); const s = Math.abs(L / this.L0[e] - 1); mean += s; if (s > maxStrain) maxStrain = s; }
    let ke = 0; for (let q = 0; q < this.v.length; q++) ke += this.v[q] * this.v[q];
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let n = 0; n < this.N; n++) { x0 = Math.min(x0, x[3 * n]); x1 = Math.max(x1, x[3 * n]); y0 = Math.min(y0, x[3 * n + 1]); y1 = Math.max(y1, x[3 * n + 1]); z0 = Math.min(z0, x[3 * n + 2]); z1 = Math.max(z1, x[3 * n + 2]); }
    let nan = false; for (let q = 0; q < x.length; q++) if (!isFinite(x[q])) { nan = true; break; }
    // 접기선 이면각 평균 (밸리 +)
    return { maxStrain, meanStrain: mean / this.nE, ke, size: [x1 - x0, y1 - y0, z1 - z0], nan };
  }
}

/* ===== UI / 렌더 ===== */
export default function init(root, ctx) {
  const cv = root.querySelector('[data-cv]'), g = cv.getContext('2d');
  if (!g) return;
  const slider = root.querySelector('[data-slider]'), pctEl = root.querySelector('[data-pct]'), playBtn = root.querySelector('[data-play]');
  const chips = [...root.querySelectorAll('[data-pat]')], titleEl = root.querySelector('[data-title]'), leadEl = root.querySelector('[data-lead]'), statEl = root.querySelector('[data-stat]');
  const stage = root.querySelector('[data-stage]');
  const PATS = [
    { name: '미우라 접기', title: '한 번 당기면<br>한꺼번에 접혀요', lead: '모든 주름이 동시에 움직이는 미우라 접기. 한 장이 가로세로로 함께 줄어들어 부피가 1/4 이하로 접힙니다.', build: () => miuraMesh(1, -1), rep: true, hold: 1.8, front: [238, 92, 58], back: [20, 118, 120], R: 15.2, cz: 1.8 },
    { name: '큐브 상자', title: '납작한 십자가<br>상자가 되는 순간', lead: '십자 모양 전개도 한 장이 다섯 개의 접기선을 따라 90°씩 접혀 속이 빈 상자가 됩니다. 가장자리가 맞닿으며 멈춥니다.', build: () => cubeMesh(5), rep: false, hold: 2.2, front: [244, 168, 40], back: [30, 96, 140], R: 11.8, cz: 1.4 },
    { name: '물폭탄 베이스', title: '네 귀퉁이가<br>한곳으로 모여요', lead: '정사각형 한 장에 대각선 두 개, 중앙선 두 개. 학과 풍선의 출발점인 물폭탄 베이스가 네 모서리를 한꺼번에 끌어올립니다.', build: () => baseMesh(6, 1, -1, Math.PI * .72), rep: true, hold: 2.0, front: [38, 150, 140], back: [246, 226, 188], R: 8.6, cz: 1.8 },
  ];
  const lut = PATS.map(p => [p.front, p.back].map(c => Array.from({ length: 64 }, (_, i) => { const k = .5 + .62 * i / 63; return `rgb(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0})`; })));
  const TAU = Math.PI * 2, FPS_STEP = 1000 / 24;
  let W = 0, H = 0, pi = 0, mesh, sim, tCur = 0, tSlider = 0, manualUntil = 0, auto = true, phase = 0, phaseT = 0;
  const cam = { x: 0, y: 0, s: 1 };
  let visible = false, alive = true, lastT = 0, acc = 0, simT = 0, nSub = 44, yawDrag = 0, pitchDrag = 0, drag = null, tri = null, flags = null;
  const L = (() => { const v = [-.38, .72, .58], m = Math.hypot(...v); return v.map(a => a / m); })();

  function resize() {
    const r = stage.getBoundingClientRect(); const w = Math.max(320, Math.round(Math.min(r.width, 1200) * .8)), h = Math.max(220, Math.round(w * r.height / Math.max(1, r.width)));
    if (Math.abs(w - W) < 4 && Math.abs(h - H) < 4) return; W = cv.width = w; H = cv.height = h;
  }
  function load(i) {
    pi = i; const p = PATS[i]; mesh = p.build(); sim = new Sim(mesh); tCur = 0; phase = 0; phaseT = 0; cam.x = 0; cam.y = 0; cam.s = 1;
    // 삼각형별 접기선 변 플래그
    const T = mesh.T, ck = new Set(); mesh.hinges.forEach(h => { if (h.crease) { const a = h.i[0], b = h.i[1]; ck.add(a < b ? a * 65536 + b : b * 65536 + a); } });
    flags = T.map(t => [0, 1, 2].map(k => { const a = t[k], b = t[(k + 1) % 3]; return ck.has(a < b ? a * 65536 + b : b * 65536 + a); }));
    tri = { order: Array.from({ length: T.length }, (_, k) => k), depth: new Float32Array(T.length) };
    titleEl.innerHTML = p.title; leadEl.textContent = p.lead;
    chips.forEach((c, k) => c.classList.toggle('is-on', k === i));
  }

  const nodeX = [], nodeY = [], nodeW = [], shX = [], shY = [];
  function render(time) {
    g.clearRect(0, 0, W, H);
    const N = mesh.N, x = sim.x, p = PATS[pi];
    const yaw = .62 + .5 * Math.sin(time * .22) + (ctx.mouse.nx - .5) * .5 + yawDrag, E = Math.max(.35, Math.min(1.35, .95 + (ctx.mouse.ny - .5) * -.2 + pitchDrag));
    const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cE = Math.cos(E), sE = Math.sin(E);
    const R = p.R, D = R * 3.1, F = Math.min(W * .5, H * .62) / R * D * .98 * cam.s;
    const cx0 = mesh.cx, cy0 = mesh.cy, cz0 = p.cz, ox = W * .5 + cam.x, oy = H * .53 + cam.y;
    const zg = -1.4, lx = .42, ly = .28;
    for (let n = 0; n < N; n++) {
      const px = x[3 * n] - cx0, py = x[3 * n + 1] - cy0, pz = x[3 * n + 2] - cz0;
      const x1 = px * cy_ - py * sy_, y1 = px * sy_ + py * cy_;
      const w = -y1 * cE + pz * sE, s = F / (D - w);
      nodeX[n] = ox + x1 * s; nodeY[n] = oy - (y1 * sE + pz * cE) * s; nodeW[n] = w;
      // 바닥 그림자: 광원 방향으로 z=zg 평면에 투영
      const h = x[3 * n + 2] - zg, qx = px + h * lx, qy = py + h * ly, qz = zg - cz0;
      const q1 = qx * cy_ - qy * sy_, q2 = qx * sy_ + qy * cy_, qw = -q2 * cE + qz * sE, qs = F / (D - qw);
      shX[n] = ox + q1 * qs; shY[n] = oy - (q2 * sE + qz * cE) * qs;
    }
    // 카메라 자동 프레이밍: 투영된 노드의 경계 상자를 부드럽게 화면 중앙·적정 크기로 맞춘다
    { let a = 1e9, b = -1e9, c = 1e9, d = -1e9; for (let n2 = 0; n2 < N; n2++) { const X2 = nodeX[n2], Y2 = nodeY[n2]; if (X2 < a) a = X2; if (X2 > b) b = X2; if (Y2 < c) c = Y2; if (Y2 > d) d = Y2; }
      cam.x += (W * .5 - (a + b) / 2) * .08; cam.y += (H * .5 - (c + d) / 2) * .08;
      const f = Math.min(W * .72 / Math.max(1, b - a), H * .74 / Math.max(1, d - c)); cam.s = Math.max(.45, Math.min(1.7, cam.s * (1 + (f - 1) * .05))); }
    const T = mesh.T, nT = T.length, dep = tri.depth, ord = tri.order;
    const sh = new Path2D();
    for (let k = 0; k < nT; k++) { const t = T[k]; sh.moveTo(shX[t[0]], shY[t[0]]); sh.lineTo(shX[t[1]], shY[t[1]]); sh.lineTo(shX[t[2]], shY[t[2]]); sh.closePath(); dep[k] = (nodeW[t[0]] + nodeW[t[1]] + nodeW[t[2]]) / 3; }
    g.fillStyle = 'rgba(70,48,26,.2)'; g.fill(sh);
    ord.sort((a, b) => dep[a] - dep[b]);
    g.lineJoin = 'round'; g.lineWidth = .9;
    for (let oi = 0; oi < nT; oi++) {
      const k = ord[oi], t = T[k], a = t[0] * 3, b = t[1] * 3, c = t[2] * 3;
      const ux = x[b] - x[a], uy = x[b + 1] - x[a + 1], uz = x[b + 2] - x[a + 2], vx = x[c] - x[a], vy = x[c + 1] - x[a + 1], vz = x[c + 2] - x[a + 2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
      const n1 = nx * cy_ - ny * sy_, n2 = nx * sy_ + ny * cy_;
      let vr = n1, vu = n2 * sE + nz * cE, vt = -n2 * cE + nz * sE;
      const front = vt > 0; if (!front) { vr = -vr; vu = -vu; vt = -vt; }
      const lam = Math.max(0, vr * L[0] + vu * L[1] + vt * L[2]);
      const col = lut[pi][front ? 0 : 1][(lam * 63) | 0];
      g.fillStyle = col; g.strokeStyle = col;
      g.beginPath(); g.moveTo(nodeX[t[0]], nodeY[t[0]]); g.lineTo(nodeX[t[1]], nodeY[t[1]]); g.lineTo(nodeX[t[2]], nodeY[t[2]]); g.closePath(); g.fill(); g.stroke();
      const fl = flags[k];
      if (fl[0] || fl[1] || fl[2]) {
        g.strokeStyle = 'rgba(32,16,6,.34)'; g.lineWidth = 1.1; g.beginPath();
        for (let e = 0; e < 3; e++) if (fl[e]) { const u = t[e], v = t[(e + 1) % 3]; g.moveTo(nodeX[u], nodeY[u]); g.lineTo(nodeX[v], nodeY[v]); }
        g.stroke(); g.lineWidth = .9;
      }
    }
    drawInset();
  }

  // 접기선 패턴(평면): 밸리=점선(청록), 마운틴=실선(주황)
  function drawInset() {
    const S = Math.round(Math.min(H * .27, 150)), px = 22, py = H - S - 22, x0 = mesh.x0, N = mesh.N;
    let mnx = 1e9, mxx = -1e9, mny = 1e9, mxy = -1e9; for (let n = 0; n < N; n++) { mnx = Math.min(mnx, x0[3 * n]); mxx = Math.max(mxx, x0[3 * n]); mny = Math.min(mny, x0[3 * n + 1]); mxy = Math.max(mxy, x0[3 * n + 1]); }
    const sc = (S - 18) / Math.max(mxx - mnx, mxy - mny), offx = px + (S - (mxx - mnx) * sc) / 2, offy = py + (S + (mxy - mny) * sc) / 2;
    g.save(); g.fillStyle = 'rgba(250,246,236,.86)'; g.strokeStyle = 'rgba(40,28,16,.25)'; g.lineWidth = 1; g.beginPath(); g.roundRect(px, py, S, S, 10); g.fill(); g.stroke();
    const mt = new Path2D(), vl = new Path2D(), ol = new Path2D();
    for (let q = 0; q < mesh.bnd.length; q += 2) { const u = mesh.bnd[q], v = mesh.bnd[q + 1]; ol.moveTo(offx + (x0[3 * u] - mnx) * sc, offy - (x0[3 * u + 1] - mny) * sc); ol.lineTo(offx + (x0[3 * v] - mnx) * sc, offy - (x0[3 * v + 1] - mny) * sc); }
    for (const h of mesh.hinges) if (h.crease) { const u = h.i[0], v = h.i[1], P = h.s > 0 ? vl : mt; P.moveTo(offx + (x0[3 * u] - mnx) * sc, offy - (x0[3 * u + 1] - mny) * sc); P.lineTo(offx + (x0[3 * v] - mnx) * sc, offy - (x0[3 * v + 1] - mny) * sc); }
    g.lineWidth = 1.4; g.strokeStyle = 'rgba(40,28,16,.55)'; g.stroke(ol); g.lineWidth = 1.2; g.strokeStyle = '#e8553a'; g.stroke(mt); g.strokeStyle = '#17797a'; g.setLineDash([3, 2.5]); g.stroke(vl); g.setLineDash([]);
    g.fillStyle = 'rgba(40,28,16,.7)'; g.font = `700 10px "Pretendard","Malgun Gothic",sans-serif`; g.fillText('접기선 패턴', px + 8, py + 13);
    g.restore();
  }

  /* ---------- 접기 진행률(자동/수동) ---------- */
  function autoTarget(dt) {
    const p = PATS[pi]; phaseT += dt;
    const seg = [.7, 4.4, p.hold, 3.0], d = seg[phase];
    if (phaseT >= d) { phaseT = 0; phase = (phase + 1) % 4; if (phase === 0) load((pi + 1) % PATS.length); return 0; }
    const u = phaseT / d, ease = u < .5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    return phase === 0 ? 0 : phase === 1 ? ease : phase === 2 ? 1 : 1 - ease;
  }
  function step(dt) {
    simT += dt;
    let target;
    if (!auto || simT < manualUntil) { target = tSlider; } else target = autoTarget(dt);
    const t0 = performance.now();
    const dTarget = target - tCur; const lim = 1.6 * dt; tCur += Math.max(-lim, Math.min(lim, dTarget));
    for (let i = 0; i < nSub; i++) sim.step(tCur, SIM.dt, PATS[pi].rep);
    // 발산 자가복구
    if (!isFinite(sim.x[0]) || !isFinite(sim.x[sim.x.length - 1])) { sim.reset(); }
    const el = performance.now() - t0; if (el > 20 && nSub > 14) nSub -= 6; else if (el < 8 && nSub < 80) nSub += 2;
    if (auto && simT >= manualUntil) { slider.value = Math.round(tCur * 100); }
    pctEl.textContent = Math.round(tCur * 100) + '%';
    render(simT);
    if ((simT * 24 | 0) % 12 === 0) {
      let m = 0, c = 0; mesh.hinges.forEach((h, k) => { if (h.crease) { m += Math.abs(sim.rho[k]); c++; } });
      statEl.textContent = `노드 ${mesh.N} · 면 ${mesh.T.length} · 접기선 ${c} · 평균 이면각 ${(m / c * 180 / Math.PI) | 0}° · 서브스텝 ${nSub}/프레임`;
    }
  }

  /* ---------- 입력 / 라이프사이클 ---------- */
  const onSlider = () => { tSlider = slider.value / 100; auto = false; playBtn.classList.remove('is-on'); playBtn.textContent = '자동 재생 ▶'; };
  const onPlay = () => { auto = !auto; if (auto) { phase = tCur > .5 ? 2 : 0; phaseT = 0; } playBtn.classList.toggle('is-on', auto); playBtn.textContent = auto ? '자동 재생 ■' : '자동 재생 ▶'; if (!auto) tSlider = tCur; };
  slider.addEventListener('input', onSlider); playBtn.addEventListener('click', onPlay);
  const chipFns = chips.map((c, k) => { const f = () => { load(k); }; c.addEventListener('click', f); return f; });
  const onDown = e => { drag = { x: e.clientX, y: e.clientY, yaw: yawDrag, pitch: pitchDrag }; cv.setPointerCapture && cv.setPointerCapture(e.pointerId); };
  const onMove = e => { if (!drag) return; yawDrag = drag.yaw + (e.clientX - drag.x) * .008; pitchDrag = drag.pitch + (e.clientY - drag.y) * .004; };
  const onUp = () => { drag = null; };
  cv.addEventListener('pointerdown', onDown); cv.addEventListener('pointermove', onMove); cv.addEventListener('pointerup', onUp); cv.addEventListener('pointercancel', onUp);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) lastT = performance.now(); }, { threshold: .1 });
  io.observe(root);
  const onVis = () => { if (!document.hidden) lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => resize()); ro.observe(stage);

  resize(); load(0); playBtn.classList.add('is-on');
  // 첫 프레임: 이미 살짝 접힌 상태에서 시작해 정지 화면이 비지 않게 워밍업
  tCur = .0; for (let i = 0; i < 20; i++) sim.step(0, SIM.dt, false); render(0);
  const off = ctx.tick(() => {
    if (!alive || !visible || document.hidden) return;
    const now = performance.now(); acc += now - lastT; lastT = now;
    if (acc < FPS_STEP) return; const dt = Math.min(.08, acc / 1000); acc = 0;
    step(dt);
  });
  root._dbg178 = { load, get t() { return tCur; }, set manual(v) { auto = !v; if (v) { tSlider = v === true ? tCur : v; } }, setT(v) { auto = false; tSlider = v; }, get sim() { return sim; }, get pi() { return pi; } };
  return () => {
    alive = false; off(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
    slider.removeEventListener('input', onSlider); playBtn.removeEventListener('click', onPlay);
    chips.forEach((c, k) => c.removeEventListener('click', chipFns[k]));
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove); cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
  };
}
