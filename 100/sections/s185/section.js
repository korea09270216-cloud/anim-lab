// Penrose 타일링 — Robinson 삼각형 분할(인플레이션). 모든 꼭짓점은 Z[ζ5] 정수 4-벡터(a0+a1ζ+a2ζ²+a3ζ³)로 정확히 들고 다니며
// 1/φ 배는 정수 연산 (a1−a0−a3, a2−a3, a1−a0, a2−a0−a3)으로 계산 → 반올림 틈·중복 꼭짓점이 생기지 않는다.
// 세대 사이는 새 꼭짓점이 부모 변에서 미끄러져 나오는 연속 보간(s: 0→1), 중심은 2세대마다 180° 회전한 자기유사라 무한 줌 루프가 이음매 없다.
const PHI = (1 + Math.sqrt(5)) / 2, TAU = Math.PI * 2;
const C1 = Math.cos(TAU / 5), C2 = Math.cos(2 * TAU / 5), C3 = Math.cos(3 * TAU / 5);
const S1 = Math.sin(TAU / 5), S2 = Math.sin(2 * TAU / 5), S3 = Math.sin(3 * TAU / 5);

const ZP = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [-1, -1, -1, -1]];   // ζ^0..ζ^4
const z10 = k => { k = ((k % 10) + 10) % 10; return k % 2 === 0 ? ZP[k / 2] : ZP[((k + 5) / 2) % 5].map(v => -v); };   // e^{2πik/10}
const ROOT = new Int32Array(120);
for (let i = 0; i < 10; i++) {
  let B = z10(i), C = z10(i + 1);
  if (i % 2 === 0) [B, C] = [C, B];
  ROOT.set(B, i * 12 + 4); ROOT.set(C, i * 12 + 8);          // A = 원점(0,0,0,0)
}
const V = new Int32Array(40 * 36), LS = new Int32Array(36);   // 깊이별 자식 슬롯 / 잎 확장 스크래치

let T0 = 0, T1 = 0, T2 = 0, T3 = 0;
function divphi(a0, a1, a2, a3) { T0 = a1 - a0 - a3; T1 = a2 - a3; T2 = a1 - a0; T3 = a2 - a0 - a3; }
// 자식 정확 생성. 반환: 자식 수. 슬롯 o = dst 오프셋(12정수 × 자식)
function sub(ty, s, so, d, dof) {
  const A0 = s[so], A1 = s[so + 1], A2 = s[so + 2], A3 = s[so + 3];
  const B0 = s[so + 4], B1 = s[so + 5], B2 = s[so + 6], B3 = s[so + 7];
  const C0 = s[so + 8], C1_ = s[so + 9], C2_ = s[so + 10], C3_ = s[so + 11];
  if (ty === 0) {                                              // 좁은(36-72-72): P=A+(B−A)/φ → (0,C,P,B), (1,P,C,A)
    divphi(B0 - A0, B1 - A1, B2 - A2, B3 - A3);
    const P0 = A0 + T0, P1 = A1 + T1, P2 = A2 + T2, P3 = A3 + T3;
    d.set([C0, C1_, C2_, C3_, P0, P1, P2, P3, B0, B1, B2, B3], dof);
    d.set([P0, P1, P2, P3, C0, C1_, C2_, C3_, A0, A1, A2, A3], dof + 12);
    return 2;
  }
  divphi(A0 - B0, A1 - B1, A2 - B2, A3 - B3);                  // 넓은(108-36-36): Q=B+(A−B)/φ, R=B+(C−B)/φ
  const Q0 = B0 + T0, Q1 = B1 + T1, Q2 = B2 + T2, Q3 = B3 + T3;
  divphi(C0 - B0, C1_ - B1, C2_ - B2, C3_ - B3);
  const R0 = B0 + T0, R1 = B1 + T1, R2 = B2 + T2, R3 = B3 + T3;
  d.set([R0, R1, R2, R3, C0, C1_, C2_, C3_, A0, A1, A2, A3], dof);          // (1,R,C,A)
  d.set([Q0, Q1, Q2, Q3, R0, R1, R2, R3, B0, B1, B2, B3], dof + 12);        // (1,Q,R,B)
  d.set([R0, R1, R2, R3, Q0, Q1, Q2, Q3, A0, A1, A2, A3], dof + 24);        // (0,R,Q,A)
  return 3;
}
const CT = [[0, 1], [1, 1, 0]];                                             // 부모 종류별 자식 종류
const START = [[[2, 0, 1], [0, 2, 0]], [[1, 2, 0], [1, 1, 1], [1, 1, 0]]];  // 자식 꼭짓점이 출발하는 부모 꼭짓점 인덱스(0=A,1=B,2=C)
const ESTART = [[[0, 1, 0], [0, 1, 1]], [[0, 1, 0], [0, 0, 1], [0, 1, 0]]]; // 자식 변(AB,BC,CA)이 부모에서 물려받는 선 강도 (최종 규칙 = 1,0,1)

const COL = [  // [종류][방향 클래스 0~4] — 0=좁은(따뜻), 1=넓은(차가움)
  [[240, 138, 75], [236, 106, 82], [246, 178, 86], [232, 132, 118], [250, 206, 140]],
  [[24, 52, 98], [31, 95, 139], [38, 125, 150], [59, 148, 166], [62, 86, 160]],
];
const LINE = 'rgb(247,241,230)';

export default function init(root, ctx) {
  const cv = root.querySelector('.s185__cv'), pin = root.querySelector('.s185__pin'), genEl = root.querySelector('[data-gen]');
  const g = cv.getContext('2d');
  if (!g) return;
  let W = 960, H = 540;
  const fit = () => { const b = pin.getBoundingClientRect(); W = 960; H = Math.max(360, Math.round(W * (b.height || 540) / (b.width || 960))); cv.width = W; cv.height = H; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(pin);

  // 프레임 변수
  let M0 = 0, M1 = 0, M2 = 0, M3 = 0, TX = 0, TY = 0, PX = 0, PY = 0, dFloor = 0, s = 0, mx = -999, my = -999, lights = 0;
  let paths = [], nTri = 0;
  const sc = (b, o) => {
    const x = b[o] + b[o + 1] * C1 + b[o + 2] * C2 + b[o + 3] * C3, y = b[o + 1] * S1 + b[o + 2] * S2 + b[o + 3] * S3;
    PX = M0 * x + M1 * y + TX; PY = M2 * x + M3 * y + TY;
  };
  const klass = (b, o) => {                                                  // 마름모 방향 클래스: 밑변 BC 의 방향(mod π)을 36° 단위로
    const bx = b[o + 4] + b[o + 5] * C1 + b[o + 6] * C2 + b[o + 7] * C3, by = b[o + 5] * S1 + b[o + 6] * S2 + b[o + 7] * S3;
    const cx = b[o + 8] + b[o + 9] * C1 + b[o + 10] * C2 + b[o + 11] * C3, cy = b[o + 9] * S1 + b[o + 10] * S2 + b[o + 11] * S3;
    let th = Math.atan2(cy - by, cx - bx); if (th < 0) th += Math.PI;
    return Math.round(th / (Math.PI / 5)) % 5;
  };
  const SX = new Float64Array(6), SY_ = new Float64Array(6), FX = new Float64Array(3), FY = new Float64Array(3);

  function leaf(b, o, ty) {
    sc(b, o); SX[0] = PX; SY_[0] = PY; sc(b, o + 4); SX[1] = PX; SY_[1] = PY; sc(b, o + 8); SX[2] = PX; SY_[2] = PY;
    const pc = COL[ty][klass(b, o)];
    const n = sub(ty, b, o, LS, 0);
    for (let i = 0; i < n; i++) {
      const co = i * 12, cty = CT[ty][i], st = START[ty][i], es = ESTART[ty][i];
      sc(LS, co); FX[0] = PX; FY[0] = PY; sc(LS, co + 4); FX[1] = PX; FY[1] = PY; sc(LS, co + 8); FX[2] = PX; FY[2] = PY;
      const x0 = SX[st[0]] + (FX[0] - SX[st[0]]) * s, y0 = SY_[st[0]] + (FY[0] - SY_[st[0]]) * s;
      const x1 = SX[st[1]] + (FX[1] - SX[st[1]]) * s, y1 = SY_[st[1]] + (FY[1] - SY_[st[1]]) * s;
      const x2 = SX[st[2]] + (FX[2] - SX[st[2]]) * s, y2 = SY_[st[2]] + (FY[2] - SY_[st[2]]) * s;
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      const flat = area < 1.5 && area > -1.5;                                // 막 태어난 퇴화 삼각형: 면은 생략, 선은 유지
      const cx = (x0 + x1 + x2) / 3, cy = (y0 + y1 + y2) / 3;
      const cc = COL[cty][klass(LS, co)];
      let r = pc[0] + (cc[0] - pc[0]) * s, gg = pc[1] + (cc[1] - pc[1]) * s, bb = pc[2] + (cc[2] - pc[2]) * s;
      const dx = cx - mx, dy = cy - my, dd = dx * dx + dy * dy;               // 커서 조명
      let lit = 0.30 * Math.sin(Math.PI * s);
      if (dd < 90000) { const q = 1 - dd / 90000; lit += .38 * q * q; }
      if (lit > 0) { r += (255 - r) * lit; gg += (255 - gg) * lit; bb += (255 - bb) * lit; }
      // 이음새 방지: 가장 긴 변이 1.1px 바깥으로 가도록 중심 기준 확대 (같은 마름모의 대각선은 같은 색이라 보이지 않음)
      let ax = x0, ay = y0, bx = x1, by = y1, qx = x2, qy = y2;
      if (!flat) {
        const Lm = Math.max(Math.hypot(x1 - x0, y1 - y0), Math.hypot(x2 - x1, y2 - y1), Math.hypot(x0 - x2, y0 - y2));
        let kk = 1 + 1.1 * 3 * Lm / Math.abs(area); if (kk > 1.06 || Math.abs(area) < 40) kk = Math.abs(area) < 40 ? 1 : 1.06;
        ax = cx + (x0 - cx) * kk; ay = cy + (y0 - cy) * kk; bx = cx + (x1 - cx) * kk; by = cy + (y1 - cy) * kk; qx = cx + (x2 - cx) * kk; qy = cy + (y2 - cy) * kk;
      }
      if (!flat) {
        g.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.lineTo(qx, qy); g.closePath(); g.fill();
        nTri++;
      }
      // 변 선: 최종 규칙 AB=1, BC=0, CA=1 로 부모 강도에서 보간. 4단계 버킷 Path2D 로 모아 한 번에 stroke
      const aAB = es[0] + (1 - es[0]) * s, aBC = es[1] * (1 - s), aCA = es[2] + (1 - es[2]) * s;
      let k = Math.round(aAB * 4); if (k > 0) { const p = paths[k - 1]; p.moveTo(x0, y0); p.lineTo(x1, y1); }
      k = Math.round(aBC * 4); if (k > 0) { const p = paths[k - 1]; p.moveTo(x1, y1); p.lineTo(x2, y2); }
      k = Math.round(aCA * 4); if (k > 0) { const p = paths[k - 1]; p.moveTo(x2, y2); p.lineTo(x0, y0); }
    }
  }

  function visit(d, b, o, ty) {
    sc(b, o); let x = PX, y = PY, minX = x, maxX = x, minY = y, maxY = y;
    sc(b, o + 4); x = PX; y = PY; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    sc(b, o + 8); x = PX; y = PY; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (maxX < -6 || minX > W + 6 || maxY < -6 || minY > H + 6) return;
    if (d >= dFloor) { leaf(b, o, ty); return; }
    const base = (d + 1) * 36;
    const n = sub(ty, b, o, V, base);
    const ct = CT[ty];
    for (let i = 0; i < n; i++) visit(d + 1, V, base + i * 12, ct[i]);
  }

  // 시간·스크롤 상태
  const Dlo = 7, Lmax = 56;
  let tAuto = 0, rot = 0, rotT = 0, panX = 0, panY = 0, visible = true, last = performance.now(), acc = 0, avg = 20, lastGen = -1;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const onMove = e => { const b = cv.getBoundingClientRect(); mx = (e.clientX - b.left) / b.width * W; my = (e.clientY - b.top) / b.height * H; };
  const onLeave = () => { mx = my = -999; };
  pin.addEventListener('pointermove', onMove); pin.addEventListener('pointerleave', onLeave);

  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    acc += now - last; last = now;
    if (acc < 50) return;
    const dt = Math.min(.12, acc / 1000); acc = 0;
    const ts = performance.now();
    tAuto += dt * (ctx.reduced ? .05 : .2);                    // 초당 0.2 세대 확대
    const rc = root.getBoundingClientRect(), tot = Math.max(1, rc.height - innerHeight);
    const p = Math.min(1, Math.max(0, -rc.top / tot));
    const Dtot = Dlo + tAuto + 3.0 * p;
    const wraps = Math.floor((Dtot - Dlo) / 2), Dm = Dlo + (Dtot - Dlo - 2 * wraps);
    dFloor = Math.floor(Dm); const f = Dm - dFloor;
    { const u = Math.min(1, Math.max(0, (f - .28) / .44)); s = u * u * (3 - 2 * u); }   // 한 세대 안에서 정지 → 꽃피움 → 정지
    // 중심 2세대 자기유사: 한 번 감길 때마다 180° 회전해 이음매 제거
    const pnx = mx > -900 ? (mx / W - .5) : 0, pny = mx > -900 ? (my / H - .5) : 0;
    rotT += (pnx * .5 - rotT) * .08; panX += (pnx * 70 - panX) * .08; panY += (pny * 50 - panY) * .08;
    rot += dt * .06;
    const th = rot + rotT + wraps * Math.PI, S = Lmax * Math.pow(PHI, Dm);
    M0 = S * Math.cos(th); M1 = -S * Math.sin(th); M2 = S * Math.sin(th); M3 = S * Math.cos(th);
    TX = W / 2 - panX; TY = H / 2 - panY;

    g.fillStyle = '#f4ede0'; g.fillRect(0, 0, W, H);
    paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D()]; nTri = 0;
    for (let i = 0; i < 10; i++) visit(0, ROOT, i * 12, 0);
    g.lineWidth = 1.7; g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = LINE;
    for (let k = 0; k < 4; k++) { g.globalAlpha = (k + 1) / 4; g.stroke(paths[k]); }
    g.globalAlpha = 1;
    const gen = Math.floor(Dtot) + 1;
    if (gen !== lastGen) { lastGen = gen; if (genEl) genEl.textContent = gen; }
    avg = avg * .85 + (performance.now() - ts) * .15;
  });

  return () => {
    off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    pin.removeEventListener('pointermove', onMove); pin.removeEventListener('pointerleave', onLeave);
  };
}
