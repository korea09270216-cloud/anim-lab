// s174 — 시계 탈진기 + 인벌류트 기어 트레인. 이벤트 구동 앵커 탈진기(진자 에너지 전달) · 정수 박동 카운터로 기어 위상 클램프
const TAU = Math.PI * 2, PI = Math.PI;

// ───────────────────────── 탈진기 상태기계 (직접 출처 없음 — 간단한 모델링) ─────────────────────────
// 앵커 각 φ(=진자 각). 엔트리 팔레트가 이빨을 잡고 있다가(0) φ 가 -a 를 넘으면 임펄스 면을 타고(1) 진자를 밀어 준 뒤 φ>a 에서 떨어져(2 드롭)
// 반대쪽 엑시트 팔레트에 잡히고(3), 같은 일이 거울상으로 반복된다(4,5). 한 박동 = 휠이 반 피치.
export const A_UNLOCK = 0.06, KAPPA = 0.45, TDROP = 0.06, K_IMP = 0.35, ZETA = 0.05;
export function makeEsc(w0, n0) {
  const odd = n0 & 1;
  return { w0, K: K_IMP, zeta: ZETA, phi: odd ? .14 : -.14, om: 0, st: odd ? 3 : 0, n: n0, td: 0, f: 0, bounce: 0, t: 0, tickT: [], tick: 0 };
}
function accel(E, phi, om) {
  const F = E.st === 1 ? E.K : E.st === 4 ? -E.K : 0;
  return -E.w0 * E.w0 * Math.sin(phi) - 2 * E.zeta * E.w0 * om + F;
}
function rk4(E, h) {
  const p = E.phi, o = E.om;
  const k1p = o, k1o = accel(E, p, o);
  const k2p = o + .5 * h * k1o, k2o = accel(E, p + .5 * h * k1p, o + .5 * h * k1o);
  const k3p = o + .5 * h * k2o, k3o = accel(E, p + .5 * h * k2p, o + .5 * h * k2o);
  const k4p = o + h * k3o, k4o = accel(E, p + h * k3p, o + h * k3o);
  E.phi = p + h / 6 * (k1p + 2 * k2p + 2 * k3p + k4p); E.om = o + h / 6 * (k1o + 2 * k2o + 2 * k3o + k4o);
}
// 현재 상태에서 임계를 넘었으면 다음 상태 번호, 아니면 -1
function crossed(E) {
  const a = A_UNLOCK;
  switch (E.st) {
    case 0: return E.phi >= -a ? 1 : -1;
    case 1: return E.phi > a ? 2 : E.phi < -a ? 0 : -1;
    case 3: return E.phi <= a ? 4 : -1;
    case 4: return E.phi < -a ? 5 : E.phi > a ? 3 : -1;
    default: return -1;
  }
}
export function escStep(E, dt) {
  // 스텝 안에서 임계를 넘으면 이분법으로 정확한 시각을 찾아 거기서 상태를 바꾸고 남은 시간을 이어 적분 → 박동 소실/영구 정지 방지
  let left = dt, guard = 0;
  while (left > 1e-12 && guard++ < 8) {
    if (E.st === 2 || E.st === 5) {
      const h = Math.min(left, TDROP - E.td); rk4(E, h); E.td += h; E.t += h; left -= h;
      E.f = KAPPA + (1 - KAPPA) * Math.pow(Math.min(1, E.td / TDROP), 2);
      if (E.td >= TDROP - 1e-12) { E.n++; E.tickT.push(E.t); E.tick++; E.td = 0; E.st = E.st === 2 ? 3 : 0; E.f = 0; E.bounce = 0; }
      continue;
    }
    const p0 = E.phi, o0 = E.om, s0 = E.st;
    rk4(E, left);
    if (crossed(E) < 0) { E.t += left; left = 0; break; }
    let lo = 0, hi = left;
    for (let it = 0; it < 26; it++) { const mid = .5 * (lo + hi); E.phi = p0; E.om = o0; E.st = s0; rk4(E, mid); if (crossed(E) >= 0) hi = mid; else lo = mid; }
    E.phi = p0; E.om = o0; E.st = s0; rk4(E, hi); E.t += hi; left -= hi;
    E.st = crossed(E); if (E.st === 2 || E.st === 5) E.td = 0;
  }
  const a = A_UNLOCK;
  if (E.st === 1) E.f = KAPPA * Math.max(0, Math.min(1, (E.phi + a) / (2 * a)));
  else if (E.st === 4) E.f = KAPPA * Math.max(0, Math.min(1, (a - E.phi) / (2 * a)));
  else if (E.st === 0 || E.st === 3) E.f = 0;
  if (E.st !== 2 && E.st !== 5) E.bounce += dt;
}
// 박동 주기가 1.000초가 되도록 비틀림 상수(ω0) 보정 — 시계의 '속도 조절'
export function calibrate() {
  let w0 = PI;
  for (let it = 0; it < 4; it++) {
    const E = makeEsc(w0, 0), h = 1 / 500; for (let i = 0; i < 45 / h; i++) escStep(E, h);
    const T = (E.tickT[E.tickT.length - 1] - E.tickT[10]) / (E.tickT.length - 11); w0 *= T;
  }
  return w0;
}

// ───────────────────────── 인벌류트 기어 ─────────────────────────
const inv = a => Math.tan(a) - a;
// 모듈 m, 잇수 z, 압력각 20°. 이 0번 이빨은 각도 0 방향에 중심이 온다. 반환: [[x,y],...] 외곽
export function gearOutline(z, m) {
  const al = 20 * PI / 180, rp = m * z / 2, rb = rp * Math.cos(al), ra = rp + m, rf = rp - 1.25 * m, ip = inv(al);
  const half = r => { const ar = Math.acos(Math.min(1, rb / Math.max(r, rb))); return PI / (2 * z) + ip - inv(ar); };
  const pts = [], P = (r, a) => pts.push([r * Math.cos(a), r * Math.sin(a)]);
  for (let k = 0; k < z; k++) {
    const c = k * TAU / z, rs = Math.max(rf, 0.2 * rp), n = 7;
    P(rs, c - half(rb));
    for (let i = 0; i <= n; i++) { const r = Math.max(rb, rs) + (ra - Math.max(rb, rs)) * i / n; P(r, c - half(r)); }
    P(ra, c); // 이끝
    for (let i = n; i >= 0; i--) { const r = Math.max(rb, rs) + (ra - Math.max(rb, rs)) * i / n; P(r, c + half(r)); }
    P(rs, c + half(rb));
    P(rs, c + TAU / z / 2);
  }
  return pts;
}
// 기어 → 스프라이트(황동 질감). 창(lightening window) 수 win, 허브 반경비 hub
function gearSprite(z, m, S, win, hub) {
  const ra = (z / 2 + 1) * m * S, size = Math.ceil(ra * 2 + 6), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), cx = size / 2;
  const sil = document.createElement('canvas'); sil.width = sil.height = size;
  const path = new Path2D(); gearOutline(z, m).forEach((p, i) => i ? path.lineTo(cx + p[0] * S, cx + p[1] * S) : path.moveTo(cx + p[0] * S, cx + p[1] * S)); path.closePath();
  const rr = (z / 2 - 1.25) * m * S - 2.4 * m * S, rh = hub * ra;
  if (win) for (let i = 0; i < win; i++) {
    const a0 = i * TAU / win + .13, a1 = (i + 1) * TAU / win - .13;
    path.moveTo(cx + Math.cos(a0) * rr, cx + Math.sin(a0) * rr); path.arc(cx, cx, rr, a0, a1); path.lineTo(cx + Math.cos(a1) * rh, cx + Math.sin(a1) * rh); path.arc(cx, cx, rh, a1, a0, true); path.closePath();
  }
  const sg = sil.getContext('2d'); sg.fillStyle = '#000'; sg.fill(path, 'evenodd');
  const grad = g.createRadialGradient(cx - ra * .35, cx - ra * .4, ra * .05, cx, cx, ra * 1.05);
  grad.addColorStop(0, '#f6e0a0'); grad.addColorStop(.45, '#cfa24a'); grad.addColorStop(1, '#85601f');
  g.fillStyle = grad; g.fill(path, 'evenodd'); g.strokeStyle = 'rgba(70,45,10,.9)'; g.lineWidth = 1; g.stroke(path);
  g.strokeStyle = 'rgba(255,240,190,.28)'; g.lineWidth = .7; for (let r = rh * .35; r < rh; r += Math.max(2.6, ra * .05)) { g.beginPath(); g.arc(cx, cx, r, 0, TAU); g.stroke(); }
  g.fillStyle = '#4b3510'; g.beginPath(); g.arc(cx, cx, Math.max(1.8, ra * .09), 0, TAU); g.fill();
  return { cv, sil, r: size / 2 };
}
// 탈진 휠(래칫 이빨 30개)
export const R_E = 16;
function escapeSprite(S) {
  const R = R_E, rr = R - 3.2, size = Math.ceil((R + 1) * 2 * S + 6), cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'), cx = size / 2, N = 30, p = TAU / N;
  const path = new Path2D(), P = (r, a, mv) => { const x = cx + r * S * Math.cos(a), y = cx + r * S * Math.sin(a); mv ? path.moveTo(x, y) : path.lineTo(x, y); };
  for (let k = 0; k < N; k++) {
    const t = k * p; // 이빨 끝(접촉점)이 각 t, 완만한 등이 뒤쪽(작은 각), 가파른 앞면이 앞쪽(큰 각)
    P(rr, t - .62 * p, k === 0); P(rr + (R - rr) * .55, t - .3 * p); P(R, t); P(R - .55, t + .1 * p); P(rr, t + .16 * p);
  }
  path.closePath();
  const ri = rr - 2.2, rh = 3.6;
  for (let i = 0; i < 5; i++) { const a0 = i * TAU / 5 + .2, a1 = (i + 1) * TAU / 5 - .2; path.moveTo(cx + Math.cos(a0) * ri * S, cx + Math.sin(a0) * ri * S); path.arc(cx, cx, ri * S, a0, a1); path.lineTo(cx + Math.cos(a1) * rh * S, cx + Math.sin(a1) * rh * S); path.arc(cx, cx, rh * S, a1, a0, true); path.closePath(); }
  const sil = document.createElement('canvas'); sil.width = sil.height = size; const sg = sil.getContext('2d'); sg.fillStyle = '#000'; sg.fill(path, 'evenodd');
  const grad = g.createRadialGradient(cx - R * S * .35, cx - R * S * .4, R * S * .05, cx, cx, R * S * 1.05);
  grad.addColorStop(0, '#fbeab4'); grad.addColorStop(.5, '#dcb455'); grad.addColorStop(1, '#8e6a22');
  g.fillStyle = grad; g.fill(path, 'evenodd'); g.strokeStyle = 'rgba(70,45,10,.9)'; g.lineWidth = 1; g.stroke(path);
  return { cv, sil, r: size / 2 };
}

// ───────────────────────── 앵커 기하: 팔레트 면 = 이빨 끝이 앵커 좌표계에서 그리는 자취 ─────────────────────────
const NT = 30, PITCH = TAU / NT, BETA = 3.75 * PITCH, DANC = R_E / Math.cos(BETA); // 앵커 피벗 높이
const TAU_E = -PI / 2 - BETA, TAU_X = -PI / 2 + BETA;
function toAnchor(tau, phi) { // 휠 중심 원점, 이빨 끝 각 tau → 앵커(피벗 A=(0,-D)) 좌표계(앵커가 phi 만큼 돈 상태를 되돌림)
  const x = R_E * Math.cos(tau), y = R_E * Math.sin(tau) + DANC, c = Math.cos(-phi), s = Math.sin(-phi);
  return [x * c - y * s, x * s + y * c];
}
const clamp01 = v => Math.max(0, Math.min(1, v));
export function palletFaces(phiMax = .24, n = 36) {
  const a = A_UNLOCK, fE = [], fX = [];
  for (let i = 0; i <= n; i++) { // 엔트리: φ -phiMax → a
    const ph = -phiMax + (a + phiMax) * i / n, off = clamp01((ph + a) / (2 * a)) * KAPPA * PITCH / 2;
    fE.push({ ph, p: toAnchor(TAU_E + off, ph), tau: TAU_E + off });
  }
  for (let i = 0; i <= n; i++) { // 엑시트: φ -a → phiMax
    const ph = -a + (a + phiMax) * i / n, off = clamp01((a - ph) / (2 * a)) * KAPPA * PITCH / 2;
    fX.push({ ph, p: toAnchor(TAU_X + off, ph), tau: TAU_X + off });
  }
  return { fE, fX };
}
// 팔레트 돌: 면 곡선 + 이빨 진행(시계 방향 접선) 쪽으로 두께 tw 만큼 민 곡선으로 만든 쐐기
function wedge(face, tw, ext) {
  const out = face.map(({ p, tau, ph }) => {
    const tx = -Math.sin(tau), ty = Math.cos(tau), rx = Math.cos(tau), ry = Math.sin(tau), c = Math.cos(-ph), s = Math.sin(-ph);
    const T = [tx * c - ty * s, tx * s + ty * c], Rr = [rx * c - ry * s, rx * s + ry * c];
    return [p[0] + T[0] * tw + Rr[0] * ext, p[1] + T[1] * tw + Rr[1] * ext];
  });
  return face.map(f => f.p).concat(out.reverse());
}
export function palletPolys() { const { fE, fX } = palletFaces(); return { E: wedge(fE, 1.5, 3.2), X: wedge(fX, 1.5, 3.2), fE, fX }; }

// ───────────────────────── 기어 열 배치 + 맞물림 위상 ─────────────────────────
const DEG = PI / 180;
const POS = {}; POS.E = [0, 0];
POS.W4 = [POS.E[0] + 24 * Math.cos(170 * DEG), POS.E[1] + 24 * Math.sin(170 * DEG)];
POS.W3 = [POS.W4[0] + 30 * Math.cos(140 * DEG), POS.W4[1] + 30 * Math.sin(140 * DEG)];
POS.C = [POS.W3[0] + 36 * Math.cos(160 * DEG), POS.W3[1] + 36 * Math.sin(160 * DEG)];
const DELTA = { E4: 170 * DEG, W43: 140 * DEG, W3C: 160 * DEG };
// 맞물림 조건: z1(T1-δ) + z2(T2-δ-π) ≡ π (mod 2π)
export const meshAngle = (T1, d, z1, z2) => d + PI + (PI - z1 * (T1 - d)) / z2;
export const meshError = (T1, T2, d, z1, z2) => { const e = (z1 * (T1 - d) + z2 * (T2 - d - PI) - PI) / TAU; return Math.abs(e - Math.round(e)) * TAU; };
// 정수 박동 카운터 n + 소수부 f → 각 축의 회전각 (모듈로를 정수로 먼저 줄여 부동소수 누적 없음)
const REV = { E: 60, W4: 180, W3: 720, C: 3600, H: 43200 };
const SGN = { E: 1, W4: -1, W3: 1, C: -1 };
export function arbor(key, n, f) { return SGN[key] * TAU * (((n % REV[key]) + REV[key]) % REV[key] + f) / REV[key]; }
// 초기 위상 오프셋(상수): 이후 매 프레임 T = arbor(n, f) + c
export function trainOffsets(n0) {
  const c = { E: 0 }, T = k => arbor(k, n0, 0) + c[k];
  c.W4 = meshAngle(T('E'), DELTA.E4, 12, 36) - arbor('W4', n0, 0);
  c.W3 = meshAngle(T('W4'), DELTA.W43, 12, 48) - arbor('W3', n0, 0);
  c.C = meshAngle(T('W3'), DELTA.W3C, 12, 60) - arbor('C', n0, 0);
  return c;
}
export const trainAngles = (n, f, c) => ({ E: arbor('E', n, f) + c.E, W4: arbor('W4', n, f) + c.W4, W3: arbor('W3', n, f) + c.W3, C: arbor('C', n, f) + c.C });

// ───────────────────────── 렌더 ─────────────────────────
export default function init(root, ctx) {
  const cv = root.querySelector('.s174__cv'), c = cv.getContext('2d');
  if (!c) return;
  const W0 = calibrate();
  const now = new Date(), n0 = (now.getHours() % 12) * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const E = makeEsc(W0, n0), off = trainOffsets(n0), faces = palletPolys();
  let W = 0, H = 0, S = 1, ox = 0, oy = 0, sprites = null, bg = null, warp = 1, warpT = 1, tickFlash = 0, tickWord = '', tickWordT = 0, bobKick = 0;
  const dial = { x: 0, y: 0, r: 0 };

  function resize() {
    const r = cv.getBoundingClientRect(), sc = .8;
    W = Math.max(360, Math.round(r.width * sc)); H = Math.max(260, Math.round(r.height * sc)); cv.width = W; cv.height = H;
    S = H / 140; ox = W * .83; oy = H * .26;
    sprites = {
      E: escapeSprite(S), PE: gearSprite(12, 1, S, 0, .3), W4: gearSprite(36, 1, S, 5, .22), P4: gearSprite(12, 1, S, 0, .3),
      W3: gearSprite(48, 1, S, 6, .2), P3: gearSprite(12, 1, S, 0, .3), C: gearSprite(60, 1, S, 6, .18)
    };
    dial.r = Math.min(H * .17, W * .12); dial.x = Math.max(dial.r + 40, W * .2); dial.y = H * .74;
    bg = document.createElement('canvas'); bg.width = W; bg.height = H;
    const g = bg.getContext('2d');
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2a1d14'); gr.addColorStop(1, '#130d09'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // 무브먼트 판(plate) + 나사
    const px = ox + POS.C[0] * S - 38 * S, py = oy - 32 * S, pw = W * .985 - px, ph = (oy + (POS.C[1] + 33) * S) - py;
    g.fillStyle = '#3a2a1c'; g.beginPath(); g.roundRect(px, py, pw, ph + 14 * S, 22 * S); g.fill();
    const g2 = g.createLinearGradient(px, py, px + pw, py + ph); g2.addColorStop(0, 'rgba(255,220,150,.10)'); g2.addColorStop(1, 'rgba(0,0,0,.25)'); g.fillStyle = g2; g.fill();
    g.strokeStyle = 'rgba(255,220,150,.22)'; g.lineWidth = 1.5; g.stroke();
    for (const [sx, sy] of [[px + 14 * S, py + 14 * S], [px + pw - 14 * S, py + 14 * S], [px + 14 * S, py + ph], [px + pw - 14 * S, py + ph]]) {
      g.fillStyle = '#8b6a2e'; g.beginPath(); g.arc(sx, sy, 3.4 * S, 0, TAU); g.fill(); g.strokeStyle = '#2a1c0c'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(sx - 2.6 * S, sy - 1 * S); g.lineTo(sx + 2.6 * S, sy + 1 * S); g.stroke();
    }
  }
  resize(); const ro = new ResizeObserver(resize); ro.observe(cv);

  const X = u => ox + u * S, Y = u => oy + u * S;
  function gear(sp, cx, cy, ang, shadow) {
    c.save(); c.translate(cx, cy); c.rotate(ang);
    if (shadow) { c.globalAlpha = .38; c.drawImage(sp.sil, -sp.r + 2.2, -sp.r + 3, sp.cv.width, sp.cv.width); c.globalAlpha = 1; }
    c.drawImage(sp.cv, -sp.r, -sp.r); c.restore();
  }
  function jewel(cx, cy, rr) {
    c.fillStyle = '#f0cd72'; c.beginPath(); c.arc(cx, cy, rr * 1.7, 0, TAU); c.fill(); c.strokeStyle = '#5a3d10'; c.lineWidth = 1; c.stroke();
    const jg = c.createRadialGradient(cx - rr * .3, cy - rr * .3, 0, cx, cy, rr * 1.1); jg.addColorStop(0, '#ff9a9a'); jg.addColorStop(.5, '#d0202c'); jg.addColorStop(1, '#6e0710');
    c.fillStyle = jg; c.beginPath(); c.arc(cx, cy, rr, 0, TAU); c.fill();
  }
  function draw() {
    c.drawImage(bg, 0, 0);
    const T = trainAngles(E.n, E.f, off);
    // 진자 막대 + 추 (가장 뒤)
    const ax = X(0), ay = Y(-DANC), Lp = H * .72, ph = E.phi, bx = ax - Math.sin(ph) * Lp, by = ay + Math.cos(ph) * Lp;
    c.strokeStyle = '#9aa0a8'; c.lineWidth = 3.2; c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(ax - 1, ay); c.lineTo(bx - 1, by); c.stroke();
    c.save(); c.translate(bx, by); c.rotate(-ph);
    const bobG = c.createRadialGradient(-S * 3, -S * 3, 2, 0, 0, S * 12); bobG.addColorStop(0, '#fbeab4'); bobG.addColorStop(.55, '#d7ad50'); bobG.addColorStop(1, '#7c5a1c');
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(S * 1.5, S * 2.5, S * 10.5, S * 4.2, 0, 0, TAU); c.fill();
    c.fillStyle = bobG; c.beginPath(); c.ellipse(0, 0, S * 10.5, S * 4.2, 0, 0, TAU); c.fill(); c.strokeStyle = '#5a3d10'; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#7c5a1c'; c.beginPath(); c.arc(0, -S * 7.5, S * 1.8, 0, TAU); c.fill(); // 조속 너트
    c.restore();
    // 기어 열: 뒤 → 앞
    gear(sprites.C, X(POS.C[0]), Y(POS.C[1]), T.C, true); gear(sprites.P3, X(POS.W3[0]), Y(POS.W3[1]), T.W3, true);
    gear(sprites.W3, X(POS.W3[0]), Y(POS.W3[1]), T.W3, true); gear(sprites.P4, X(POS.W4[0]), Y(POS.W4[1]), T.W4, true);
    gear(sprites.W4, X(POS.W4[0]), Y(POS.W4[1]), T.W4, true); gear(sprites.PE, X(0), Y(0), T.E, true);
    // 탈진 휠: 스프라이트는 이빨 0 의 끝이 각 0 에 있다 → 회전각 = 엔트리 위치 τ_e + 휠 위상 ψ=(n+f)·π/30
    gear(sprites.E, X(0), Y(0), TAU_E + T.E, true);
    // 앵커 (피벗 A 에서 φ 만큼 회전)
    c.save(); c.translate(ax, ay); c.rotate(ph); c.scale(S, S);
    const hubG = c.createRadialGradient(-.8, -.8, .1, 0, 0, 3.2); hubG.addColorStop(0, '#f6e0a0'); hubG.addColorStop(1, '#85601f');
    const mid = poly => { let sx = 0, sy = 0; for (const q of poly) { sx += q[0]; sy += q[1]; } return [sx / poly.length, sy / poly.length]; };
    const mE = mid(faces.E), mX = mid(faces.X);
    // 초승달 모양 팔: 허브에서 바깥으로 휘었다가 팔레트로 내려온다
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [col, w] of [['#4b3510', 2.2], ['#c9a04a', 1.5], ['#f3dc96', .45]]) {
      c.strokeStyle = col; c.lineWidth = w; c.beginPath();
      for (const m of [mE, mX]) { c.moveTo(0, 0); c.quadraticCurveTo(m[0] * 1.32, m[1] * .08 - 1.5, m[0], m[1]); }
      c.stroke();
    }
    // 루비 팔레트 (이빨 끝이 그리는 면 위에 놓인 돌)
    const ruby = c.createLinearGradient(-12, 0, 12, 0); ruby.addColorStop(0, '#ff6b78'); ruby.addColorStop(.5, '#d0202c'); ruby.addColorStop(1, '#7a0d18');
    c.fillStyle = ruby; c.strokeStyle = '#3d0509'; c.lineWidth = .3;
    for (const poly of [faces.E, faces.X]) {
      c.beginPath(); poly.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); c.closePath(); c.fill(); c.stroke();
    }
    c.fillStyle = hubG; c.beginPath(); c.arc(0, 0, 2.5, 0, TAU); c.fill(); c.strokeStyle = '#4b3510'; c.lineWidth = .35; c.stroke();
    c.restore();
    // 보석 베어링
    for (const q of [POS.C, POS.W3, POS.W4]) jewel(X(q[0]), Y(q[1]), S * .85); jewel(X(0), Y(0), S * .85); jewel(ax, ay, S * .75);
    // 똑딱 반짝임
    if (tickFlash > 0) {
      const side = (E.n & 1) ? 1 : -1; // 방금 이빨이 떨어져 닿은 팔레트
      c.fillStyle = `rgba(255,236,170,${tickFlash * .9})`; c.beginPath(); c.arc(X(side * 11.3), Y(-11.3), S * (1.2 + (1 - tickFlash) * 4), 0, TAU); c.fill();
    }
    if (tickWordT > 0) { c.font = `900 ${Math.round(S * 5.4)}px Pretendard, sans-serif`; c.textAlign = 'center'; c.fillStyle = `rgba(255,224,150,${Math.min(1, tickWordT * 1.4)})`; c.fillText(tickWord, X((E.n & 1) ? 24 : -24), Y(-22) - (1 - tickWordT) * S * 4); }
    drawDial();
    if (warp > 1.6) { c.font = `800 ${Math.round(S * 4.2)}px Pretendard, sans-serif`; c.textAlign = 'right'; c.fillStyle = '#ffd98a'; c.fillText(`빨리감기 ×${Math.round(warp)}`, W - 24, H - 24); }
  }
  function drawDial() {
    const { x, y, r } = dial, n = E.n, f = E.f;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.4)'; c.beginPath(); c.arc(x + 5, y + 8, r * 1.08, 0, TAU); c.fill();
    const rim = c.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r * 1.1); rim.addColorStop(0, '#f6e0a0'); rim.addColorStop(1, '#85601f');
    c.fillStyle = rim; c.beginPath(); c.arc(x, y, r * 1.08, 0, TAU); c.fill();
    c.fillStyle = '#f4ecd8'; c.beginPath(); c.arc(x, y, r * .98, 0, TAU); c.fill();
    c.strokeStyle = '#2a1d14';
    for (let i = 0; i < 60; i++) { const a = i / 60 * TAU, big = i % 5 === 0; c.lineWidth = big ? 2.2 : 1; c.beginPath(); c.moveTo(x + Math.sin(a) * r * (big ? .83 : .9), y - Math.cos(a) * r * (big ? .83 : .9)); c.lineTo(x + Math.sin(a) * r * .95, y - Math.cos(a) * r * .95); c.stroke(); }
    c.fillStyle = '#2a1d14'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `700 ${Math.round(r * .2)}px Georgia, serif`;
    for (let i = 1; i <= 12; i++) { const a = i / 12 * TAU; c.fillText(String(i), x + Math.sin(a) * r * .68, y - Math.cos(a) * r * .68); }
    c.font = `800 ${Math.round(r * .105)}px Pretendard, sans-serif`; c.fillStyle = '#7a1f14'; c.fillText('정각제과', x, y - r * .3); c.font = `600 ${Math.round(r * .075)}px Pretendard, sans-serif`; c.fillStyle = '#5b4a3a'; c.fillText('매 정각 갓 구운 빵', x, y + r * .36);
    const hand = (a, len, tail, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - Math.sin(a) * tail, y + Math.cos(a) * tail); c.lineTo(x + Math.sin(a) * len, y - Math.cos(a) * len); c.stroke(); };
    const sec = TAU * ((((n % 60) + 60) % 60) + f) / 60, min = TAU * ((((n % 3600) + 3600) % 3600) + f) / 3600, hr = TAU * ((((n % 43200) + 43200) % 43200) + f) / 43200;
    hand(hr, r * .5, r * .08, r * .055, '#2a1d14'); hand(min, r * .78, r * .1, r * .038, '#2a1d14'); hand(sec, r * .86, r * .18, r * .014, '#c0281c');
    c.fillStyle = '#c0281c'; c.beginPath(); c.arc(x, y, r * .035, 0, TAU); c.fill();
    c.restore();
  }

  // ── 루프: 고정 dt 시뮬 (실시간 × warp), 프레임 캡 ≈24fps ──
  let vis = true, tabVis = !document.hidden, last = performance.now(), acc = 0, lastTick = E.tick, stuckT = 0, ampWin = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabVis = !document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const FRAME = 1 / 24, H_ = 1 / 500;
  const off_ = ctx.tick(() => {
    if (!vis || !tabVis) return;
    const t = performance.now(); acc += Math.min(.1, (t - last) / 1000); last = t;
    if (acc < FRAME) return;
    const real = Math.min(acc, .12); acc = 0;
    // 스크롤 속도가 시간을 빨리 감는다 (탈진기는 그대로 이벤트로 돌아가고 감기만 한다)
    const v = ctx.lenis ? Math.abs(ctx.lenis.velocity || 0) : 0; warpT = 1 + Math.min(39, v * 1.4); warp += (warpT - warp) * .25;
    let simT = real * warp, steps = Math.min(4000, Math.ceil(simT / H_)); const h = simT / steps;
    let maxAmp = 0;
    for (let i = 0; i < steps; i++) { escStep(E, h); if (Math.abs(E.phi) > maxAmp) maxAmp = Math.abs(E.phi); }
    // 자가 복구: 진폭이 해제 각보다 작아 멈추려 하면(조용한 정지) 살짝 건드려 다시 시동
    ampWin = Math.max(ampWin * .9, maxAmp); stuckT = ampWin < A_UNLOCK * 1.25 ? stuckT + real : 0;
    if (stuckT > 1.2) { E.om += (E.st >= 3 ? -1 : 1) * 1.6; stuckT = 0; }
    if (E.tick !== lastTick) { lastTick = E.tick; if (warp < 3) { tickFlash = 1; tickWord = (E.n & 1) ? '딱' : '똑'; tickWordT = 1; } }
    tickFlash = Math.max(0, tickFlash - real * 5); tickWordT = Math.max(0, tickWordT - real * 1.6);
    draw();
  });
  const click = e => { const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H; if (y > H * .35 && x > W * .55) E.om += (Math.random() < .5 ? -1 : 1) * 0.8; };
  root.addEventListener('pointerdown', click);
  return () => { off_(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); root.removeEventListener('pointerdown', click); };
}
