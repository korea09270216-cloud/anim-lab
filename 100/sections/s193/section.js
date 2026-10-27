// s193 · Hashlife — 쿼드트리 해시 컨스 + 2^j 세대 점프로 Conway's Life 를 수천조 세대까지 건너뛰며 무한 줌
// 노드: 레벨 k = 2^k × 2^k 영역. 같은 내용의 노드는 해시 테이블(오픈 어드레싱)로 하나만 존재(hash-consing → DAG).
// step(n, j) : 레벨 k 노드의 "중앙 레벨 k-1 영역" 이 2^j 세대(j ≤ k-2) 뒤에 어떻게 되는지를 캐시와 함께 반환.
//   j = k-2 : 9개 겹침 서브노드를 k-3 만큼 전진 → 4개 조합을 다시 k-3 전진 (총 2^(k-2))
//   j < k-2 : 9개 서브노드의 무전진 중앙 영역으로 조합 → 4개를 step(., j)
// 좌표: 루트(레벨 k)는 원점 중심 [-2^(k-1), 2^(k-1)). 레벨 ≤ 52 로 제한해 모든 좌표를 double 로 정확히 다룬다.
const MAXLVL = 52;
const RLE = {
  gun: '24bo$22bobo$12b2o6b2o12b2o$11bo3bo4b2o12b2o$2o8bo5bo3b2o$2o8bo3bob2o4bobo$10bo5bo7bo$11bo3bo$12b2o!'
};

function parseRLE(s) {
  const cells = []; let x = 0, y = 0, run = 0, w = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c >= '0' && c <= '9') { run = run * 10 + (c.charCodeAt(0) - 48); continue; }
    const r = run || 1; run = 0;
    if (c === 'b') x += r;
    else if (c === 'o') { for (let k = 0; k < r; k++) cells.push([x + k, y]); x += r; }
    else if (c === '$') { if (x > w) w = x; x = 0; y += r; }
    else if (c === '!') break;
  }
  return cells;
}

function makeUniverse(cap) {
  let ts = 1; while (ts < cap * 2) ts <<= 1;
  const U = {
    cap, n: 2, nw: new Int32Array(cap), ne: new Int32Array(cap), sw: new Int32Array(cap), se: new Int32Array(cap),
    lvl: new Uint8Array(cap), pop: new Float64Array(cap), res: new Int32Array(cap).fill(-1), resJ: new Int8Array(cap),
    tab: new Int32Array(ts).fill(-1), mask: ts - 1, emp: [0], root: 0, hits: 0, looks: 0, gcs: 0,
    bb: new Float32Array(cap * 4), bbOk: new Uint8Array(cap)
  };
  U.pop[1] = 1;          // 0 = 죽은 셀, 1 = 산 셀 (레벨 0 리프)
  return U;
}

function hash4(a, b, c, d) {
  let h = Math.imul(a, 0x9E3779B1) ^ Math.imul(b, 0x85EBCA77) ^ Math.imul(c, 0xC2B2AE3D) ^ Math.imul(d, 0x27D4EB2F);
  h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D); h ^= h >>> 12;
  return h;
}

function mk(U, a, b, c, d) {
  U.looks++;
  let i = hash4(a, b, c, d) & U.mask;
  for (;;) {
    const id = U.tab[i];
    if (id < 0) break;
    if (U.nw[id] === a && U.ne[id] === b && U.sw[id] === c && U.se[id] === d) { U.hits++; return id; }
    i = (i + 1) & U.mask;
  }
  if (U.n >= U.cap) throw new Error('FULL');
  const id = U.n++;
  U.nw[id] = a; U.ne[id] = b; U.sw[id] = c; U.se[id] = d;
  U.lvl[id] = U.lvl[a] + 1; U.pop[id] = U.pop[a] + U.pop[b] + U.pop[c] + U.pop[d];
  U.res[id] = -1; U.bbOk[id] = 0;
  U.tab[i] = id;
  return id;
}

function emptyNode(U, k) {
  while (U.emp.length <= k) { const e = U.emp[U.emp.length - 1]; U.emp.push(mk(U, e, e, e, e)); }
  return U.emp[k];
}

// 4×4 노드의 중앙 2×2 가 1세대 뒤 어떻게 되는지(직접 계산)
function base4(U, n) {
  const a = U.nw[n], b = U.ne[n], c = U.sw[n], d = U.se[n];
  const g = [U.nw[a], U.ne[a], U.nw[b], U.ne[b], U.sw[a], U.se[a], U.sw[b], U.se[b], U.nw[c], U.ne[c], U.nw[d], U.ne[d], U.sw[c], U.se[c], U.sw[d], U.se[d]];
  const cell = (x, y) => {
    let s = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) s += g[(y + dy) * 4 + x + dx];
    return s === 3 || (s === 2 && g[y * 4 + x]) ? 1 : 0;
  };
  return mk(U, cell(1, 1), cell(2, 1), cell(1, 2), cell(2, 2));
}

// 레벨 k-1 노드 m 의 무전진 중앙(레벨 k-2)
function centerOf(U, m) { return mk(U, U.se[U.nw[m]], U.sw[U.ne[m]], U.ne[U.sw[m]], U.nw[U.se[m]]); }

function step(U, n, j) {
  if (U.res[n] >= 0 && U.resJ[n] === j) return U.res[n];
  const k = U.lvl[n];
  let r;
  if (U.pop[n] === 0) r = emptyNode(U, k - 1);
  else if (k === 2) r = base4(U, n);
  else {
    const nw = U.nw[n], ne = U.ne[n], sw = U.sw[n], se = U.se[n];
    const n01 = mk(U, U.ne[nw], U.nw[ne], U.se[nw], U.sw[ne]);
    const n10 = mk(U, U.sw[nw], U.se[nw], U.nw[sw], U.ne[sw]);
    const n11 = mk(U, U.se[nw], U.sw[ne], U.ne[sw], U.nw[se]);
    const n12 = mk(U, U.sw[ne], U.se[ne], U.nw[se], U.ne[se]);
    const n21 = mk(U, U.ne[sw], U.nw[se], U.se[sw], U.sw[se]);
    let a, b, c, d, e, f, g, h, i;
    if (j === k - 2) {
      const s = k - 3;
      a = step(U, nw, s); b = step(U, n01, s); c = step(U, ne, s);
      d = step(U, n10, s); e = step(U, n11, s); f = step(U, n12, s);
      g = step(U, sw, s); h = step(U, n21, s); i = step(U, se, s);
      const s2 = k - 3;
      r = mk(U, step(U, mk(U, a, b, d, e), s2), step(U, mk(U, b, c, e, f), s2), step(U, mk(U, d, e, g, h), s2), step(U, mk(U, e, f, h, i), s2));
    } else {
      a = centerOf(U, nw); b = centerOf(U, n01); c = centerOf(U, ne);
      d = centerOf(U, n10); e = centerOf(U, n11); f = centerOf(U, n12);
      g = centerOf(U, sw); h = centerOf(U, n21); i = centerOf(U, se);
      r = mk(U, step(U, mk(U, a, b, d, e), j), step(U, mk(U, b, c, e, f), j), step(U, mk(U, d, e, g, h), j), step(U, mk(U, e, f, h, i), j));
    }
  }
  U.res[n] = r; U.resJ[n] = j;
  return r;
}

// 루트를 한 단계 키운다(좌표 유지: 옛 루트가 새 루트의 중앙 절반이 된다)
function expand(U, r) {
  const k = U.lvl[r], e = emptyNode(U, k - 1);
  return mk(U, mk(U, e, e, e, U.nw[r]), mk(U, e, e, U.ne[r], e), mk(U, e, U.sw[r], e, e), mk(U, U.se[r], e, e, e));
}
// 모든 산 셀이 루트의 중앙 절반 안에 있나
function inCenter(U, r) {
  const A = U.nw[r], B = U.ne[r], C = U.sw[r], D = U.se[r];
  return !(U.pop[U.nw[A]] || U.pop[U.ne[A]] || U.pop[U.sw[A]] ||
           U.pop[U.nw[B]] || U.pop[U.ne[B]] || U.pop[U.se[B]] ||
           U.pop[U.nw[C]] || U.pop[U.sw[C]] || U.pop[U.se[C]] ||
           U.pop[U.ne[D]] || U.pop[U.sw[D]] || U.pop[U.se[D]]);
}

// 루트를 2^j 세대 전진. 반환 false = 레벨 한도 초과(전진 못 함)
function advance(U, j) {
  let r = U.root;
  while (U.lvl[r] < j + 2 || !inCenter(U, r)) { if (U.lvl[r] >= MAXLVL - 1) return false; r = expand(U, r); }
  if (U.lvl[r] >= MAXLVL) return false;
  r = expand(U, r);
  U.root = step(U, r, j);
  return true;
}

// 셀 하나 세팅(경로 복사). 좌표는 루트 중심 원점 기준 정수
function setCell(U, n, k, x, y) {     // x,y ∈ [0, 2^k)
  if (k === 0) return 1;
  const h = Math.pow(2, k - 1), qx = x >= h ? 1 : 0, qy = y >= h ? 1 : 0;
  const nx = x - qx * h, ny = y - qy * h;
  const ch = [U.nw[n], U.ne[n], U.sw[n], U.se[n]];
  ch[qy * 2 + qx] = setCell(U, ch[qy * 2 + qx], k - 1, nx, ny);
  return mk(U, ch[0], ch[1], ch[2], ch[3]);
}
function buildRoot(U, cells, level) {
  let r = emptyNode(U, level); const half = Math.pow(2, level - 1);
  for (const [x, y] of cells) r = setCell(U, r, level, x + half, y + half);
  return r;
}
function readCells(U, n, k, ox, oy, out, lim) {
  if (out.length > lim || U.pop[n] === 0) return out;
  if (k === 0) { out.push([ox, oy]); return out; }
  const h = Math.pow(2, k - 1);
  readCells(U, U.nw[n], k - 1, ox, oy, out, lim); readCells(U, U.ne[n], k - 1, ox + h, oy, out, lim);
  readCells(U, U.sw[n], k - 1, ox, oy + h, out, lim); readCells(U, U.se[n], k - 1, ox + h, oy + h, out, lim);
  return out;
}

// 산 셀의 경계 상자(노드 로컬 좌표 [0,size)) — 노드별 메모
function bboxOf(U, n) {
  if (U.bbOk[n]) return n;
  const k = U.lvl[n], o = n * 4;
  if (U.pop[n] === 0) { U.bb[o] = 1e30; U.bb[o + 1] = 1e30; U.bb[o + 2] = -1e30; U.bb[o + 3] = -1e30; U.bbOk[n] = 1; return n; }
  if (k === 0) { U.bb[o] = 0; U.bb[o + 1] = 0; U.bb[o + 2] = 1; U.bb[o + 3] = 1; U.bbOk[n] = 1; return n; }
  const h = Math.pow(2, k - 1), ch = [U.nw[n], U.ne[n], U.sw[n], U.se[n]];
  let x0 = 1e30, y0 = 1e30, x1 = -1e30, y1 = -1e30;
  for (let q = 0; q < 4; q++) {
    const c = ch[q]; if (U.pop[c] === 0) continue;
    bboxOf(U, c); const p = c * 4, dx = (q & 1) * h, dy = (q >> 1) * h;
    if (U.bb[p] + dx < x0) x0 = U.bb[p] + dx; if (U.bb[p + 1] + dy < y0) y0 = U.bb[p + 1] + dy;
    if (U.bb[p + 2] + dx > x1) x1 = U.bb[p + 2] + dx; if (U.bb[p + 3] + dy > y1) y1 = U.bb[p + 3] + dy;
  }
  U.bb[o] = x0; U.bb[o + 1] = y0; U.bb[o + 2] = x1; U.bb[o + 3] = y1; U.bbOk[n] = 1;
  return n;
}
function rootBox(U) {
  const r = U.root; bboxOf(U, r); const o = r * 4, h = Math.pow(2, U.lvl[r] - 1);
  return { x0: U.bb[o] - h, y0: U.bb[o + 1] - h, x1: U.bb[o + 2] - h, y1: U.bb[o + 3] - h };
}

// 메모리 상한: 루트에서 도달 가능한 노드만 새 풀로 복사(해시 컨스 재구축). 캐시는 버린다
function compact(U) {
  const old = { nw: U.nw, ne: U.ne, sw: U.sw, se: U.se, lvl: U.lvl, pop: U.pop, n: U.n };
  const V = makeUniverse(U.cap), memo = new Int32Array(old.n).fill(-1);
  memo[0] = 0; memo[1] = 1;
  const cp = (id) => {
    if (memo[id] >= 0) return memo[id];
    const r = mk(V, cp(old.nw[id]), cp(old.ne[id]), cp(old.sw[id]), cp(old.se[id]));
    memo[id] = r; return r;
  };
  const root = cp(U.root);
  const gcs = U.gcs + 1, hits = U.hits, looks = U.looks;
  Object.assign(U, V); U.root = root; U.gcs = gcs; U.hits = hits; U.looks = looks;
}

// ── 시작 패턴: 가장 흔한 Gosper 글라이더 건 8개를 위로 갈라지는 쐐기(Λ)로 배치 (서로 파괴하지 않는 간격 16, 두 배열은 서로 멀어지는 방향)
function startCells() {
  const g = parseRLE(RLE.gun);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const c of g) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; }
  const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2), base = g.map(c => [c[0] - cx, c[1] - cy]), out = [];
  for (let i = 0; i < 4; i++) for (const c of base) { out.push([c[0] + 70 + 16 * i, c[1] - 16 * i + 24]); out.push([-c[0] - 70 - 16 * i, c[1] - 16 * i + 24]); }
  return out;
}
const GUN_A = [86, 8];   // 오른쪽 배열 두 번째 건 중심(월드 셀 좌표) — 마지막 줌인 목표

// ── 렌더: 루트에서 재귀. 노드 크기×scale ≤ 1px 이면 인구수를 밀도로 한 픽셀에 합산(현재 레벨 렌더), 2px 이상 셀은 사각형
const CW = 480, CH = 270, CN = CW * CH;
const PAPER = (255 << 24) | (226 << 16) | (238 << 8) | 243, INKC = [20, 33, 61];
const ACC = [[255, 90, 31], [10, 163, 155], [209, 48, 122], [91, 70, 214], [224, 161, 0]];
const POW2 = []; for (let i = 0; i <= 60; i++) POW2.push(Math.pow(2, i));

function renderUniverse(U, cx, cy, scale, px, dens, boxes) {
  px.fill(PAPER); dens.fill(0); boxes.length = 0;
  const ix = Math.floor(cx), iy = Math.floor(cy), fx = cx - ix, fy = cy - iy, hw = CW / 2, hh = CH / 2;
  const inkU = (255 << 24) | (INKC[2] << 16) | (INKC[1] << 8) | INKC[0];
  const boxLv = Math.max(2, Math.floor(Math.log2(60 / scale)));
  if (scale >= 7) {
    const line = (255 << 24) | (212 << 16) | (221 << 8) | 228;
    for (let i = Math.floor(-hw / scale - fx) - 1; i <= hw / scale; i++) { const x = Math.round((i - fx) * scale + hw); if (x >= 0 && x < CW) for (let y = 0; y < CH; y++) px[y * CW + x] = line; }
    for (let i = Math.floor(-hh / scale - fy) - 1; i <= hh / scale; i++) { const y = Math.round((i - fy) * scale + hh); if (y >= 0 && y < CH) px.fill(line, y * CW, y * CW + CW); }
  }
  const gap = scale >= 7 ? 1 : 0;
  let visited = 0;
  (function rec(n, lv, rx, ry) {
    const s = POW2[lv] * scale, sx = (rx - fx) * scale + hw, sy = (ry - fy) * scale + hh;
    if (sx >= CW || sy >= CH || sx + s <= 0 || sy + s <= 0 || U.pop[n] === 0) return;
    visited++;
    if (lv === 0 && s >= 2) {
      const x0 = Math.max(0, Math.round(sx) + gap), x1 = Math.min(CW, Math.round(sx + s)), y0 = Math.max(0, Math.round(sy) + gap), y1 = Math.min(CH, Math.round(sy + s));
      for (let y = y0; y < y1; y++) px.fill(inkU, y * CW + x0, y * CW + Math.max(x0, x1));
      return;
    }
    if (lv === 0 || s <= 1) {
      const X = sx | 0, Y = sy | 0; if (X >= 0 && X < CW && Y >= 0 && Y < CH) dens[Y * CW + X] += U.pop[n];
      return;
    }
    if (lv === boxLv && boxes.length < 80 && s >= 24) boxes.push([sx, sy, s, n]);
    const h = POW2[lv - 1];
    rec(U.nw[n], lv - 1, rx, ry); rec(U.ne[n], lv - 1, rx + h, ry); rec(U.sw[n], lv - 1, rx, ry + h); rec(U.se[n], lv - 1, rx + h, ry + h);
  })(U.root, U.lvl[U.root], -POW2[U.lvl[U.root] - 1] - ix, -POW2[U.lvl[U.root] - 1] - iy);
  const sc2 = scale * scale;
  for (let i = 0; i < CN; i++) {
    const d = dens[i]; if (d === 0) continue;
    let a = 0.4 + d * sc2 * 1.5; if (a > 1) a = 1;
    px[i] = (255 << 24) | (((226 + (INKC[2] - 226) * a) | 0) << 16) | (((238 + (INKC[1] - 238) * a) | 0) << 8) | ((243 + (INKC[0] - 243) * a) | 0);
  }
  // 같은 노드(= 해시 컨스로 공유되는 노드)는 같은 색 테두리·틴트 → DAG 공유가 눈에 보인다
  for (const b of boxes) {
    const c = ACC[(Math.imul(b[3], 2654435761) >>> 28) % ACC.length];
    const x0 = Math.max(0, Math.round(b[0])), y0 = Math.max(0, Math.round(b[1])), x1 = Math.min(CW, Math.round(b[0] + b[2])), y1 = Math.min(CH, Math.round(b[1] + b[2]));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const k = y * CW + x, edge = (x === x0 || y === y0 || x === x1 - 1 || y === y1 - 1) ? 0.9 : 0.1, p = px[k];
      const r = (p & 255) + (c[0] - (p & 255)) * edge, g = ((p >> 8) & 255) + (c[1] - ((p >> 8) & 255)) * edge, bl = ((p >> 16) & 255) + (c[2] - ((p >> 16) & 255)) * edge;
      px[k] = (255 << 24) | (bl << 16) | (g << 8) | r;
    }
  }
  return { boxLv, visited };
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s193__cv');
  const q = k => root.querySelector('[data-k="' + k + '"]');
  const hud = { gen: q('gen'), jump: q('jump'), lvl: q('lvl'), unit: q('unit'), nodes: q('nodes'), hit: q('hit'), gc: q('gc'), pop: q('pop'), bar: root.querySelector('.s193__bar i'), phase: q('phase') };
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-static'); return; }
  cv.width = CW; cv.height = CH;
  const img = g2.createImageData(CW, CH), px = new Uint32Array(img.data.buffer), dens = new Float32Array(CN), boxes = [];
  const CAP = 450000, JMAX = 47, LN6 = Math.log(6), now = () => performance.now();
  const U = makeUniverse(CAP);
  const D = {};
  function reset() {
    U.n = 2; U.tab.fill(-1); U.res.fill(-1); U.bbOk.fill(0); U.emp = [0]; U.hits = 0; U.looks = 0;
    U.root = buildRoot(U, startCells(), 9);
    Object.assign(D, { phase: 'life', t: 0, acc: 0, beat: 0, j: 1, gen: 0n, cx: GUN_A[0], cy: GUN_A[1], ls: LN6, fit: { cx: 0, cy: 0, ls: Math.log(1.5) }, dive: null, hold: 0, lastJ: 0 });
    refit();
  }
  function refit() {
    const b = rootBox(U), hx = Math.max(Math.abs(b.x0), Math.abs(b.x1), 8), hy = Math.max((b.y1 - b.y0) / 2, 8);
    D.fit = { cx: (b.x0 + b.x1) / 2, cy: (b.y0 + b.y1) / 2, ls: Math.min(Math.log(8), Math.log(Math.min(CW * 0.44 / hx, CH * 0.44 / hy))) };
  }
  function adv(j) {
    let ok;
    try { ok = advance(U, j); } catch (e) { compact(U); D.gcFlash = 1; try { ok = advance(U, j); } catch (e2) { ok = false; } }
    if (ok) D.gen += 1n << BigInt(j);
    if (U.n > CAP * 0.8) { compact(U); D.gcFlash = 1; }
    return ok;
  }
  const ease = f => f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;

  function frame(dt) {
    D.t += dt;
    if (D.phase === 'life') {
      D.acc += dt;
      while (D.acc > 0.07) { D.acc -= 0.07; adv(0); D.lastJ = 0; }
      if (D.t > 2.6) { D.phase = 'jump'; D.acc = 0.45; }
    } else if (D.phase === 'jump') {
      D.acc += dt;
      if (D.acc >= 0.45) {
        D.acc = 0; D.beat++;
        const j = Math.min(JMAX, 1 + D.beat);
        if (!adv(j) || j >= JMAX) { D.phase = 'wait'; D.t = 0; }
        D.lastJ = j; refit();
      }
    } else if (D.phase === 'wait') {
      if (D.t > 1.1) {
        const sc = Math.exp(D.ls), a = GUN_A;
        D.dive = { t: 0, ls0: D.ls, ox: (a[0] - D.cx) * sc, oy: (a[1] - D.cy) * sc };
        D.phase = 'dive';
      }
    } else if (D.phase === 'dive') {
      D.dive.t += dt;
      const f = Math.min(1, D.dive.t / 16), e = ease(f), V = D.dive;
      D.ls = V.ls0 + (LN6 - V.ls0) * e;
      const sc = Math.exp(D.ls);
      D.cx = GUN_A[0] - V.ox * (1 - e) / sc; D.cy = GUN_A[1] - V.oy * (1 - e) / sc;
      if (f >= 1) { D.phase = 'hold'; D.t = 0; D.acc = 0; }
    } else if (D.phase === 'hold') {
      D.acc += dt;
      while (D.acc > 0.07) { D.acc -= 0.07; adv(0); D.lastJ = 0; }
      if (D.t > 5) reset();
    }
    if (D.phase === 'life' || D.phase === 'jump' || D.phase === 'wait') {
      const k = D.phase === 'life' ? 0.05 : 0.11;
      D.cx += (D.fit.cx - D.cx) * k; D.cy += (D.fit.cy - D.cy) * k; D.ls += (D.fit.ls - D.ls) * k;
    }
    const scale = Math.exp(D.ls);
    const info = renderUniverse(U, D.cx, D.cy, scale, px, dens, boxes);
    g2.putImageData(img, 0, 0);
    if (hud.gen) {
      hud.gen.textContent = D.gen.toLocaleString('ko-KR');
      hud.jump.textContent = D.lastJ ? '2^' + D.lastJ + ' 세대' : '1 세대';
      hud.lvl.textContent = 'L' + U.lvl[U.root];
      hud.unit.textContent = '2^' + info.boxLv + ' 칸';
      hud.nodes.textContent = U.n.toLocaleString('ko-KR');
      hud.hit.textContent = (U.looks ? (U.hits / U.looks * 100).toFixed(1) : '0.0') + '%';
      hud.gc.textContent = U.gcs + '회';
      const p = U.pop[U.root]; hud.pop.textContent = p < 1e6 ? p.toLocaleString('ko-KR') : p.toExponential(2).replace('e+', '×10^');
      if (hud.phase) hud.phase.textContent = { life: '한 세대씩', jump: '2배씩 점프', wait: '최대 점프', dive: '확대 중', hold: '세포 단위' }[D.phase];
      if (hud.bar) hud.bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, D.lastJ / JMAX)).toFixed(3) + ')';
    }
  }

  let acc = 0, visible = true, tabOn = !document.hidden;
  const off = ctx.tick((time, dtms) => {
    if (!visible || !tabOn) return;
    acc += Math.min(0.1, (dtms || 16) / 1000);
    if (acc < 0.05) return;
    const st = acc; acc = 0;
    frame(st);
  });
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(root);
  const vis = () => { tabOn = !document.hidden; };
  document.addEventListener('visibilitychange', vis);
  reset(); frame(0.05);
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
