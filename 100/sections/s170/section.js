/* ============================================================
   s170 — 스택야드: 강체 스택 솔버 3종 비교 (엔진 호출 없이 전부 직접 구현)
   박스-박스 SAT + 참조/입사면 클리핑 매니폴드(최대 2점) + 마찰 + 누적 임펄스 클램프
   A 위치만 보정 / B PGS+Baumgarte / C Soft Step(서브스텝·warm start·soft constraint·relax)
   ============================================================ */

const DT = 1 / 60, GRAV = -9.8;
const BW = 1.0, BH = 0.6, ROWS = 5, MU = 0.6, BOX_MASS = 12;
const VIEW_W = 9.0, WALL_X = 4.3;
export const BOX_COUNT = ROWS * (ROWS + 1) / 2;

// PGS + Baumgarte
export const TUNE = { iters: 5, beta: 0.2, slop: 0.005 };
// Soft Step
const SUB = 4, CONTACT_HZ = 30, DAMP_RATIO = 10, PUSHOUT = 3, SOFT_SLOP = 0.003, SPEC = 0.08;

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function mk(id, x, y, hx, hy, mass, a) {
  const b = {
    id, x, y, a: a || 0, c: 1, s: 0, vx: 0, vy: 0, w: 0, hx, hy, im: 0, ii: 0,
    dpx: 0, dpy: 0, da: 0, dqc: 1, dqs: 0, rad: Math.hypot(hx, hy), pen: 0, rx: x, ry: y, kind: 0
  };
  if (mass > 0) { b.im = 1 / mass; b.ii = 12 / (mass * (4 * hx * hx + 4 * hy * hy)); }
  b.c = Math.cos(b.a); b.s = Math.sin(b.a);
  return b;
}

/* ---------- 박스-박스 충돌: SAT(면 4축) → 참조면/입사 엣지 클리핑 ---------- */
const CX = [-1, 1, 1, -1], CY = [-1, -1, 1, 1];

function clipSeg(a, b, nx, ny, off, pid) {
  const d0 = nx * a.x + ny * a.y - off, d1 = nx * b.x + ny * b.y - off, out = [];
  if (d0 <= 0) out.push(a);
  if (d1 <= 0) out.push(b);
  if (d0 * d1 < 0) { const t = d0 / (d0 - d1); out.push({ x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y), id: 4 + pid }); }
  return out;
}

// 반환: null | {nx,ny (A→B), pts:[{x,y,sep,uid}]}
function boxBox(A, B, margin) {
  const dpx = B.x - A.x, dpy = B.y - A.y;
  const dAx = A.c * dpx + A.s * dpy, dAy = -A.s * dpx + A.c * dpy;
  const dBx = B.c * dpx + B.s * dpy, dBy = -B.s * dpx + B.c * dpy;
  const ac = Math.abs(A.c * B.c + A.s * B.s), as = Math.abs(A.c * B.s - A.s * B.c);
  const fAx = Math.abs(dAx) - A.hx - (ac * B.hx + as * B.hy);
  const fAy = Math.abs(dAy) - A.hy - (as * B.hx + ac * B.hy);
  if (fAx > margin || fAy > margin) return null;
  const fBx = Math.abs(dBx) - (ac * A.hx + as * A.hy) - B.hx;
  const fBy = Math.abs(dBy) - (as * A.hx + ac * A.hy) - B.hy;
  if (fBx > margin || fBy > margin) return null;

  // 최소 침투 축 선택(A면에 약간 유리한 히스테리시스)
  let axis = 0, sep = fAx, neg = dAx > 0 ? 0 : 1;
  let nx = dAx > 0 ? A.c : -A.c, ny = dAx > 0 ? A.s : -A.s;
  if (fAy > 0.95 * sep + 0.01 * A.hy) { axis = 1; sep = fAy; neg = dAy > 0 ? 0 : 1; nx = dAy > 0 ? -A.s : A.s; ny = dAy > 0 ? A.c : -A.c; }
  if (fBx > 0.95 * sep + 0.01 * B.hx) { axis = 2; sep = fBx; neg = dBx > 0 ? 0 : 1; nx = dBx > 0 ? B.c : -B.c; ny = dBx > 0 ? B.s : -B.s; }
  if (fBy > 0.95 * sep + 0.01 * B.hy) { axis = 3; sep = fBy; neg = dBy > 0 ? 0 : 1; nx = dBy > 0 ? -B.s : B.s; ny = dBy > 0 ? B.c : -B.c; }

  let ref, inc, fnx, fny;
  if (axis < 2) { ref = A; inc = B; fnx = nx; fny = ny; } else { ref = B; inc = A; fnx = -nx; fny = -ny; }
  const alongX = axis === 0 || axis === 2;
  const hFace = alongX ? ref.hx : ref.hy, hSide = alongX ? ref.hy : ref.hx;
  const sdx = -fny, sdy = fnx;
  const front = ref.x * fnx + ref.y * fny + hFace;
  const side = ref.x * sdx + ref.y * sdy;

  // 입사 엣지: 참조 법선과 가장 반대를 보는 면
  const lnx = -(inc.c * fnx + inc.s * fny), lny = -(-inc.s * fnx + inc.c * fny);
  let i0, i1;
  if (Math.abs(lnx) > Math.abs(lny)) { if (lnx > 0) { i0 = 1; i1 = 2; } else { i0 = 3; i1 = 0; } }
  else { if (lny > 0) { i0 = 2; i1 = 3; } else { i0 = 0; i1 = 1; } }
  const vtx = i => {
    const lx = CX[i] * inc.hx, ly = CY[i] * inc.hy;
    return { x: inc.x + inc.c * lx - inc.s * ly, y: inc.y + inc.s * lx + inc.c * ly, id: i };
  };
  let seg = clipSeg(vtx(i0), vtx(i1), -sdx, -sdy, -side + hSide, 0);
  if (seg.length < 2) return null;
  seg = clipSeg(seg[0], seg[1], sdx, sdy, side + hSide, 1);
  if (seg.length < 2) return null;

  const pts = [];
  for (let k = 0; k < 2; k++) {
    const p = seg[k], s = fnx * p.x + fny * p.y - front;
    if (s <= margin) pts.push({ x: p.x - fnx * s * 0.5, y: p.y - fny * s * 0.5, sep: s, uid: (axis * 2 + neg) * 8 + p.id });
  }
  if (!pts.length) return null;
  return { nx, ny, pts };
}

function collide(w, margin) {
  const bs = w.bodies, out = [];
  for (let i = 0; i < bs.length; i++) {
    const A = bs[i];
    for (let j = i + 1; j < bs.length; j++) {
      const B = bs[j];
      if (A.im === 0 && B.im === 0) continue;
      const dx = B.x - A.x, dy = B.y - A.y, rr = A.rad + B.rad + margin;
      if (dx * dx + dy * dy > rr * rr) continue;
      const m = boxBox(A, B, margin);
      if (!m) continue;
      m.A = A; m.B = B; m.fr = MU;
      for (const p of m.pts) {
        p.rax = p.x - A.x; p.ray = p.y - A.y; p.rbx = p.x - B.x; p.rby = p.y - B.y;
        p.jn = 0; p.jt = 0; p.nm = 0; p.tm = 0; p.bias = 0; p.adj = 0;
      }
      out.push(m);
    }
  }
  return out;
}

function prep(m) {
  const A = m.A, B = m.B, nx = m.nx, ny = m.ny, tx = ny, ty = -nx;
  for (const p of m.pts) {
    const rnA = p.rax * ny - p.ray * nx, rnB = p.rbx * ny - p.rby * nx;
    const rtA = p.rax * ty - p.ray * tx, rtB = p.rbx * ty - p.rby * tx;
    p.nm = 1 / (A.im + B.im + A.ii * rnA * rnA + B.ii * rnB * rnB);
    p.tm = 1 / (A.im + B.im + A.ii * rtA * rtA + B.ii * rtB * rtB);
  }
}

// 접촉점에서 B 에 +P, A 에 -P
function applyP(A, B, p, px, py) {
  A.vx -= A.im * px; A.vy -= A.im * py; A.w -= A.ii * (p.rax * py - p.ray * px);
  B.vx += B.im * px; B.vy += B.im * py; B.w += B.ii * (p.rbx * py - p.rby * px);
}

function syncRot(b) { b.c = Math.cos(b.a); b.s = Math.sin(b.a); }

/* ---------- A. 나이브: 겹친 만큼 위치만 밀어내고 속도 법선성분 제거, 마찰은 단순 감쇠 ---------- */
function stepNaive(w) {
  for (const b of w.dyn) {
    b.vy += GRAV * DT;
    b.x += b.vx * DT; b.y += b.vy * DT; b.a += b.w * DT; syncRot(b);
  }
  const ms = collide(w, 0);
  for (const m of ms) {
    const A = m.A, B = m.B, nx = m.nx, ny = m.ny;
    for (const p of m.pts) {
      if (p.sep >= 0) continue;
      const d = -p.sep;
      const rnA = p.rax * ny - p.ray * nx, rnB = p.rbx * ny - p.rby * nx;
      const lam = d / (A.im + B.im + A.ii * rnA * rnA + B.ii * rnB * rnB);
      A.x -= nx * lam * A.im; A.y -= ny * lam * A.im; A.a -= A.ii * rnA * lam;
      B.x += nx * lam * B.im; B.y += ny * lam * B.im; B.a += B.ii * rnB * lam;
    }
    // 속도: 질점 기준으로 접근 성분만 제거 + 쿨롱 한도의 단순 마찰
    const im = A.im + B.im;
    let jsum = 0;
    for (const p of m.pts) {
      if (p.sep >= 0) continue;
      const vn = (B.vx - A.vx) * nx + (B.vy - A.vy) * ny;
      if (vn < 0) { const j = -vn / im; A.vx -= nx * j * A.im; A.vy -= ny * j * A.im; B.vx += nx * j * B.im; B.vy += ny * j * B.im; jsum += j; }
    }
    if (jsum > 0) {
      const tx = ny, ty = -nx, vt = (B.vx - A.vx) * tx + (B.vy - A.vy) * ty;
      let j = -vt / im; const mx = MU * jsum; j = Math.max(-mx, Math.min(mx, j));
      A.vx -= tx * j * A.im; A.vy -= ty * j * A.im; B.vx += tx * j * B.im; B.vy += ty * j * B.im;
    }
  }
  for (const b of w.dyn) syncRot(b);
}

/* ---------- B. PGS + Baumgarte: dt 한 스텝, 반복 N, 누적 임펄스 클램프, warm start 없음 ---------- */
function stepPGS(w) {
  const dyn = w.dyn;
  for (const b of dyn) b.vy += GRAV * DT;
  const ms = collide(w, 0);
  for (const m of ms) {
    prep(m);
    for (const p of m.pts) p.bias = -TUNE.beta / DT * Math.min(0, p.sep + TUNE.slop);
  }
  for (let it = 0; it < TUNE.iters; it++) {
    for (const m of ms) {
      const A = m.A, B = m.B, nx = m.nx, ny = m.ny, tx = ny, ty = -nx;
      for (const p of m.pts) {
        let dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        const vn = dvx * nx + dvy * ny;
        let dP = p.nm * (-vn + p.bias);
        const P0 = p.jn; p.jn = Math.max(P0 + dP, 0); dP = p.jn - P0;
        applyP(A, B, p, dP * nx, dP * ny);
        dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray; dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
        const vt = dvx * tx + dvy * ty;
        let dT = p.tm * -vt; const mx = m.fr * p.jn, T0 = p.jt;
        p.jt = Math.max(-mx, Math.min(mx, T0 + dT)); dT = p.jt - T0;
        applyP(A, B, p, dT * tx, dT * ty);
      }
    }
  }
  for (const b of dyn) { b.x += b.vx * DT; b.y += b.vy * DT; b.a += b.w * DT; syncRot(b); }
}

/* ---------- C. Soft Step (Solver2D / Box2D 3.0 방식) ---------- */
function makeSoft(hz, zeta, h) {
  const omega = 2 * Math.PI * hz, a1 = 2 * zeta + h * omega, a2 = h * omega * a1, a3 = 1 / (1 + a2);
  return { biasRate: omega / a1, massScale: a2 * a3, impulseScale: a3 };
}

function solveSoft(ms, useBias, invH) {
  for (const m of ms) {
    const A = m.A, B = m.B, nx = m.nx, ny = m.ny, tx = ny, ty = -nx, soft = m.soft;
    // 마찰 먼저(비침투가 더 중요하므로 마지막에 푼다)
    for (const p of m.pts) {
      const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
      const mx = m.fr * p.jn;
      const nj = Math.max(-mx, Math.min(mx, p.jt - p.tm * (dvx * tx + dvy * ty)));
      const imp = nj - p.jt; p.jt = nj;
      applyP(A, B, p, imp * tx, imp * ty);
    }
    for (const p of m.pts) {
      // 앵커 상대 변위로 현재 분리거리 재계산
      const aC = A.dqc, aS = A.dqs, bC = B.dqc, bS = B.dqs;
      const prAx = aC * p.rax - aS * p.ray, prAy = aS * p.rax + aC * p.ray;
      const prBx = bC * p.rbx - bS * p.rby, prBy = bS * p.rbx + bC * p.rby;
      const s = ((B.dpx - A.dpx) + (prBx - prAx)) * nx + ((B.dpy - A.dpy) + (prBy - prAy)) * ny + p.adj;
      let bias = 0, massScale = 1, impulseScale = 0;
      if (s > 0) bias = s * invH;
      else if (useBias) {
        bias = Math.max(soft.biasRate * Math.min(0, s + SOFT_SLOP), -PUSHOUT);
        massScale = soft.massScale; impulseScale = soft.impulseScale;
      }
      const dvx = B.vx - B.w * p.rby - A.vx + A.w * p.ray, dvy = B.vy + B.w * p.rbx - A.vy - A.w * p.rax;
      const vn = dvx * nx + dvy * ny;
      let imp = -p.nm * massScale * (vn + bias) - impulseScale * p.jn;
      const nj = Math.max(p.jn + imp, 0); imp = nj - p.jn; p.jn = nj;
      applyP(A, B, p, imp * nx, imp * ny);
    }
  }
}

const pkey = (m, p) => (m.A.id * 128 + m.B.id) * 64 + p.uid;

function stepSoft(w) {
  const dyn = w.dyn, h = DT / SUB, invH = 1 / h;
  const hz = Math.min(CONTACT_HZ, 0.25 * SUB / DT);
  const cSoft = makeSoft(hz, DAMP_RATIO, h), sSoft = makeSoft(2 * hz, DAMP_RATIO, h);
  const ms = collide(w, SPEC);
  for (const b of dyn) { b.dpx = 0; b.dpy = 0; b.da = 0; b.dqc = 1; b.dqs = 0; }
  for (const m of ms) {
    prep(m);
    m.soft = (m.A.im === 0 || m.B.im === 0) ? sSoft : cSoft;
    for (const p of m.pts) {
      const old = w.prev.get(pkey(m, p));
      if (old) { p.jn = old[0]; p.jt = old[1]; }
      p.adj = p.sep - ((p.rbx - p.rax) * m.nx + (p.rby - p.ray) * m.ny);
    }
  }
  for (let sub = 0; sub < SUB; sub++) {
    for (const b of dyn) b.vy += GRAV * h;
    for (const m of ms) {
      const tx = m.ny, ty = -m.nx;
      for (const p of m.pts) applyP(m.A, m.B, p, p.jn * m.nx + p.jt * tx, p.jn * m.ny + p.jt * ty);
    }
    solveSoft(ms, true, invH);
    for (const b of dyn) {
      b.dpx += b.vx * h; b.dpy += b.vy * h; b.da += b.w * h;
      b.dqc = Math.cos(b.da); b.dqs = Math.sin(b.da);
    }
    solveSoft(ms, false, invH);
  }
  for (const b of dyn) { b.x += b.dpx; b.y += b.dpy; b.a += b.da; syncRot(b); }
  const prev = new Map();
  for (const m of ms) for (const p of m.pts) if (p.jn > 0 || p.jt !== 0) prev.set(pkey(m, p), [p.jn, p.jt]);
  w.prev = prev;
}

/* ---------- 월드 ---------- */
export function createWorld(mode, seed) {
  const rnd = rng(seed);
  const ground = mk(0, 0, -0.5, 6, 0.5, 0, 0);
  const wl = mk(1, -(WALL_X + 0.5), 4, 0.5, 5, 0, 0), wr = mk(2, WALL_X + 0.5, 4, 0.5, 5, 0, 0);
  const bodies = [ground, wl, wr], boxes = [];
  let id = 3;
  for (let r = 0; r < ROWS; r++) {
    const n = ROWS - r;
    for (let j = 0; j < n; j++) {
      const rx = (j - (n - 1) / 2) * (BW + 0.05), ry = BH / 2 + r * BH;
      const b = mk(id++, rx + (rnd() - 0.5) * 0.04, ry + 0.3 + r * 0.22, BW / 2, BH / 2, BOX_MASS, (rnd() - 0.5) * 0.03);
      b.rx = rx; b.ry = ry; bodies.push(b); boxes.push(b);
    }
  }
  const world = { mode, bodies, boxes, dyn: bodies.slice(3), prev: new Map(), imps: [], nextImp: 24, t: 0 };
  const stepFn = mode === 'naive' ? stepNaive : mode === 'pgs' ? stepPGS : stepSoft;
  world.step = () => { stepFn(world); world.t += DT; };
  // 충격체: 무거운 정사각 추. 최대 2개 유지
  world.shoot = (x, y, vx, vy, mass) => {
    const b = mk(world.nextImp, x, y, 0.4, 0.4, mass || 30, 0);
    world.nextImp = world.nextImp >= 27 ? 24 : world.nextImp + 1;
    b.vx = vx; b.vy = vy; b.kind = 1;
    world.imps.push(b); world.bodies.push(b); world.dyn.push(b);
    if (world.imps.length > 2) {
      const o = world.imps.shift();
      world.bodies.splice(world.bodies.indexOf(o), 1); world.dyn.splice(world.dyn.indexOf(o), 1);
    }
    return b;
  };
  world.measure = () => measure(world);
  return world;
}

export function measure(w) {
  const ms = collide(w, 0);
  for (const b of w.bodies) b.pen = 0;
  let pen = 0;
  const pts = [];
  for (const m of ms) for (const p of m.pts) if (p.sep < 0) {
    const d = -p.sep; if (d > pen) pen = d;
    if (d > m.A.pen) m.A.pen = d; if (d > m.B.pen) m.B.pen = d;
    pts.push(p);
  }
  let collapsed = 0, ke = 0, top = 0, ok = true;
  for (const b of w.boxes) {
    if (!isFinite(b.x) || !isFinite(b.y) || !isFinite(b.a) || Math.abs(b.x) > 30 || b.y < -3 || b.y > 40) ok = false;
    const landed = w.t > 3.5;
    if (Math.abs(b.x - b.rx) > 0.5 || Math.abs(Math.sin(b.a)) > 0.35 || (landed && (b.y < b.ry - 0.3 || b.y > b.ry + 0.4))) collapsed++;
    ke += 0.5 * (b.vx * b.vx + b.vy * b.vy) / b.im + 0.5 * b.w * b.w / b.ii;
    const ext = b.y + Math.abs(b.s) * b.hx + Math.abs(b.c) * b.hy;
    if (ext > top) top = ext;
  }
  return { pen, collapsed, ke, top, sag: Math.max(0, ROWS * BH - top), ok, pts };
}

/* ============================================================
   렌더 / UI
   ============================================================ */
const MODES = ['naive', 'pgs', 'soft'];
const BASE = { naive: [232, 116, 59], pgs: [62, 111, 217], soft: [19, 154, 119] };
const RED = [224, 36, 58], INK = '#14233a';
const CYCLE = 15, SHOT_T = 6.5, FALL_T = 1.6, FRAME_MS = 47;
const CW = 400, CH = 302, PXM = CW / VIEW_W, YMIN = -0.7, VIEW_H = CH / PXM;
const cx = x => CW / 2 + x * PXM, cy = y => CH - (y - YMIN) * PXM;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const mix = (a, b, t) => `rgb(${(a[0] + (b[0] - a[0]) * t) | 0},${(a[1] + (b[1] - a[1]) * t) | 0},${(a[2] + (b[2] - a[2]) * t) | 0})`;

// 박스 채움색 캐시: 침투가 클수록 붉게(8단계)
const FILLS = {}, STROKES = {};
for (const m of MODES) {
  const tint = BASE[m].map(v => v + (255 - v) * 0.62);
  FILLS[m] = []; STROKES[m] = [];
  for (let k = 0; k <= 8; k++) {
    FILLS[m].push(mix(tint, [240, 120, 130], k / 8));
    STROKES[m].push(mix(BASE[m].map(v => v * 0.72), [168, 16, 36], k / 8));
  }
}

function buildStatic() {
  const c = document.createElement('canvas'); c.width = CW; c.height = CH;
  const g = c.getContext('2d'); if (!g) return null;
  g.fillStyle = '#f4efe2'; g.fillRect(0, 0, CW, CH);
  // 블루프린트 격자
  g.lineWidth = 1;
  for (let m = -4.5; m <= 4.51; m += 0.5) {
    g.strokeStyle = Math.abs(m % 1) < 0.01 ? 'rgba(36,72,124,.13)' : 'rgba(36,72,124,.06)';
    const x = Math.round(cx(m)) + 0.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, CH); g.stroke();
  }
  for (let m = 0; m <= 6.1; m += 0.5) {
    g.strokeStyle = Math.abs(m % 1) < 0.01 ? 'rgba(36,72,124,.13)' : 'rgba(36,72,124,.06)';
    const y = Math.round(cy(m)) + 0.5; g.beginPath(); g.moveTo(0, y); g.lineTo(CW, y); g.stroke();
  }
  // 목표 적재 형상(점선)
  const ref = createWorld('soft', 1);
  g.setLineDash([4, 3]); g.strokeStyle = 'rgba(20,35,58,.34)'; g.lineWidth = 1;
  for (const b of ref.boxes) g.strokeRect(Math.round(cx(b.rx - BW / 2)) + 0.5, Math.round(cy(b.ry + BH / 2)) + 0.5, BW * PXM, BH * PXM);
  g.setLineDash([]);
  // 높이 눈금
  g.fillStyle = 'rgba(20,35,58,.62)'; g.font = '700 10px system-ui,sans-serif'; g.textBaseline = 'alphabetic';
  for (let m = 1; m <= 5; m++) { g.fillText(m + 'm', cx(-WALL_X) + 5, cy(m) - 3); g.fillRect(cx(-WALL_X), Math.round(cy(m)), 6, 1); }
  // 바닥·벽
  g.fillStyle = '#d6cdb4';
  g.fillRect(0, cy(0), CW, CH - cy(0));
  g.fillRect(0, 0, cx(-WALL_X), CH); g.fillRect(cx(WALL_X), 0, CW - cx(WALL_X), CH);
  g.strokeStyle = 'rgba(20,35,58,.2)'; g.lineWidth = 1; g.beginPath();
  for (let k = -CH; k < CW + CH; k += 11) { g.moveTo(k, CH); g.lineTo(k + 40, CH - 40); }
  g.stroke();
  g.fillStyle = INK; g.fillRect(0, cy(0) - 1, CW, 3);
  g.fillRect(cx(-WALL_X) - 2, 0, 3, cy(0)); g.fillRect(cx(WALL_X) - 1, 0, 3, cy(0));
  return c;
}

function drawBox(g, b, mode, level) {
  const hx = b.hx, hy = b.hy, ax = b.c * hx, ay = b.s * hx, bx = -b.s * hy, by = b.c * hy;
  const x0 = cx(b.x - ax - bx), y0 = cy(b.y - ay - by), x1 = cx(b.x + ax - bx), y1 = cy(b.y + ay - by);
  const x2 = cx(b.x + ax + bx), y2 = cy(b.y + ay + by), x3 = cx(b.x - ax + bx), y3 = cy(b.y - ay + by);
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath();
  g.fillStyle = FILLS[mode][level]; g.fill();
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x2, y2); g.moveTo(x1, y1); g.lineTo(x3, y3);
  g.strokeStyle = 'rgba(20,35,58,.16)'; g.lineWidth = 1; g.stroke();
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.closePath();
  g.strokeStyle = STROKES[mode][level]; g.lineWidth = 1.6; g.stroke();
}

function drawImpactor(g, b) {
  const hx = b.hx, ax = b.c * hx, ay = b.s * hx, bx = -b.s * hx, by = b.c * hx;
  const p = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([i, j]) => [cx(b.x + i * ax + j * bx), cy(b.y + i * ay + j * by)]);
  g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) g.lineTo(p[k][0], p[k][1]); g.closePath();
  g.fillStyle = '#1d2b45'; g.fill();
  g.beginPath(); g.moveTo(p[0][0], p[0][1]); g.lineTo(p[2][0], p[2][1]); g.moveTo(p[1][0], p[1][1]); g.lineTo(p[3][0], p[3][1]);
  g.strokeStyle = 'rgba(244,239,226,.35)'; g.lineWidth = 1; g.stroke();
  g.strokeStyle = '#0a1220'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let k = 1; k < 4; k++) g.lineTo(p[k][0], p[k][1]); g.closePath(); g.stroke();
}

function stateOf(m, t) {
  if (t < FALL_T) return ['fall', '낙하 중'];
  if (m.collapsed >= 7) return ['bad', '붕괴'];
  if (m.collapsed >= 1) return ['bad', '일부 무너짐'];
  if (m.pen > 0.02) return ['bad', '파고드는 중'];
  if (m.pen > 0.009 || m.sag > 0.06) return ['warn', '내려앉는 중'];
  return ['ok', '안정'];
}

export default function init(root, ctx) {
  const panels = [...root.querySelectorAll('.s170__panel')];
  const cvs = panels.map(p => p.querySelector('canvas'));
  const gs = cvs.map(c => { try { return c.getContext('2d', { alpha: false }); } catch (e) { return null; } });
  const STATIC = gs.every(Boolean) ? buildStatic() : null;
  if (!STATIC) { root.classList.add('s170--off'); return () => {}; }
  cvs.forEach(c => { c.width = CW; c.height = CH; });

  const els = panels.map(p => ({
    chip: p.querySelector('.s170__chip'), chipT: p.querySelector('.s170__chip b'),
    pen: p.querySelector('[data-m="pen"]'), sag: p.querySelector('[data-m="sag"]'),
    col: p.querySelector('[data-m="col"]'), ke: p.querySelector('[data-m="ke"]')
  }));
  const runEl = root.querySelector('.s170__run'), cdEl = root.querySelector('.s170__cdt'), barEl = root.querySelector('.s170__bar i');
  const btn = root.querySelector('.s170__btn');

  let worlds = [], cycle = 0, simT = 0, shotDone = false, acc = 0, last = 0, raf = 0, visible = true, running = false;
  let aim = null, paintAt = 0, lastSec = -1;
  const peak = [0, 0, 0];
  const stats = [null, null, null];

  function reset() {
    cycle++;
    const seed = cycle * 7919;
    worlds = MODES.map(m => createWorld(m, seed));
    simT = 0; acc = 0; shotDone = false; peak[0] = peak[1] = peak[2] = 0; lastSec = -1;
    if (runEl) runEl.textContent = String(cycle).padStart(2, '0');
  }

  function fire(x0, y0, x1, y1) {
    let dx = x1 - x0, dy = y1 - y0; const len = Math.hypot(dx, dy), click = len < 0.25;
    let sx = clamp(x0, -3.9, 3.9), sy = clamp(y0, 0.5, 5.8), vx, vy;
    if (click) { vx = sx < 0 ? 7 : -7; vy = 1.2; }
    else { const sp = clamp(3 + len * 2.2, 4.5, 13); vx = dx / len * sp; vy = dy / len * sp; }
    if (Math.abs(sx) < 3.3 && sy < 3.6) {          // 더미 한가운데 → 옆에서 던진다
      const left = vx > 0 || (click && sx < 0);
      sx = left ? -3.8 : 3.8; vx = Math.abs(vx) * (left ? 1 : -1);
    }
    for (const w of worlds) w.shoot(sx, sy, vx, vy, 30);
    shotDone = true;
  }

  function stepAll() {
    for (const w of worlds) w.step();
    simT += DT;
    if (!shotDone && simT >= SHOT_T) { worlds.forEach(w => w.shoot(-3.7, 1.5, 7, 0.4, 30)); shotDone = true; }
    if (simT >= CYCLE) reset();
  }

  function render(now) {
    let bad = false;
    for (let i = 0; i < 3; i++) {
      const w = worlds[i], m = measure(w), g = gs[i];
      if (!m.ok) bad = true;
      stats[i] = m;
      if (m.pen > peak[i]) peak[i] = m.pen;
      g.drawImage(STATIC, 0, 0);
      for (const b of w.boxes) drawBox(g, b, w.mode, Math.min(8, Math.max(0, Math.round((b.pen * 1000 - 5) / 3))));
      for (const b of w.imps) drawImpactor(g, b);
      for (const p of m.pts) {
        g.fillStyle = p.sep > -0.006 ? '#0f8a69' : p.sep > -0.015 ? '#e0a21a' : '#e0243a';
        g.fillRect(cx(p.x) - 2, cy(p.y) - 2, 4, 4);
      }
      if (aim && aim.cv === cvs[i]) {
        const x0 = cx(aim.x0), y0 = cy(aim.y0), x1 = cx(aim.x1), y1 = cy(aim.y1);
        g.strokeStyle = '#e0243a'; g.fillStyle = '#e0243a'; g.lineWidth = 2; g.setLineDash([5, 4]);
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]);
        g.fillRect(x0 - 5, y0 - 5, 10, 10);
        const ang = Math.atan2(y1 - y0, x1 - x0);
        g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 9 * Math.cos(ang - 0.45), y1 - 9 * Math.sin(ang - 0.45)); g.lineTo(x1 - 9 * Math.cos(ang + 0.45), y1 - 9 * Math.sin(ang + 0.45)); g.closePath(); g.fill();
      }
    }
    if (bad) { reset(); return; }
    // DOM 지표는 ~5Hz 로만 갱신
    if (now - paintAt > 200) {
      paintAt = now;
      for (let i = 0; i < 3; i++) {
        const m = stats[i], e = els[i], pm = peak[i] * 1000;
        const st = stateOf({ collapsed: m.collapsed, sag: m.sag, pen: peak[i] }, simT);
        e.pen.textContent = pm.toFixed(1); e.pen.dataset.lv = pm > 20 ? 'bad' : pm > 9 ? 'warn' : 'ok';
        e.sag.textContent = simT < FALL_T ? '0' : Math.round(m.sag * 1000); e.sag.dataset.lv = m.sag > 0.12 ? 'bad' : m.sag > 0.05 ? 'warn' : 'ok';
        e.col.textContent = m.collapsed; e.col.dataset.lv = m.collapsed > 0 ? 'bad' : 'ok';
        e.ke.textContent = m.ke.toFixed(2); e.ke.dataset.lv = m.ke > 1 ? 'bad' : m.ke > 0.08 ? 'warn' : 'ok';
        e.chipT.textContent = st[1]; e.chip.dataset.st = st[0];
        peak[i] = 0;
      }
    }
    const sec = Math.ceil(CYCLE - simT);
    if (sec !== lastSec) { lastSec = sec; if (cdEl) cdEl.textContent = sec + '초 뒤 다시 낙하'; }
    if (barEl) barEl.style.transform = 'scaleX(' + (simT / CYCLE).toFixed(3) + ')';
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!last) last = now;
    const el = now - last;
    if (el < FRAME_MS) return;
    last = now;
    acc += Math.min(el, 250) / 1000;
    let n = 0;
    while (acc >= DT && n < 4) { stepAll(); acc -= DT; n++; }
    if (acc > DT) acc = 0;                       // 스파이럴 방지: 밀린 시간은 버린다
    render(now);
  }
  function start() { if (running || !visible || document.hidden) return; running = true; last = 0; raf = requestAnimationFrame(frame); }
  function stop() { running = false; cancelAnimationFrame(raf); }
  const onVis = () => (document.hidden ? stop() : start());
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: 0.02 });

  // 포인터: 클릭 = 기본 충격체, 드래그 = 방향·세기 지정. 세 패널에 같은 충격이 간다.
  const toWorld = (cv, e) => { const r = cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width - 0.5) * VIEW_W, YMIN + (1 - (e.clientY - r.top) / r.height) * VIEW_H]; };
  const offs = cvs.map(cv => {
    const down = e => { if (e.button > 0) return; const [x, y] = toWorld(cv, e); aim = { cv, x0: x, y0: y, x1: x, y1: y }; try { cv.setPointerCapture(e.pointerId); } catch (_) {} };
    const move = e => { if (aim && aim.cv === cv) { const [x, y] = toWorld(cv, e); aim.x1 = x; aim.y1 = y; } };
    const up = e => { if (aim && aim.cv === cv) { const a = aim; aim = null; fire(a.x0, a.y0, a.x1, a.y1); } };
    const cancel = () => { aim = null; };
    cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', cancel);
    return () => { cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', cancel); };
  });
  const onBtn = () => reset();
  btn && btn.addEventListener('click', onBtn);

  reset();
  render(0);
  io.observe(root);
  document.addEventListener('visibilitychange', onVis);
  start();

  return () => {
    stop(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    btn && btn.removeEventListener('click', onBtn);
    offs.forEach(f => f());
  };
}
