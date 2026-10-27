// s173 — 얀센 링크(11막대) 해석 풀이 + 분기 연속성 + 4다리 위상차 보행 도면
const TAU = Math.PI * 2;
// 얀센의 'holy numbers'
const A = 38.0, B = 41.5, C = 39.3, D = 40.1, E = 55.8, F = 39.4, G = 36.7, Hh = 65.7, I = 49.0, J = 50.0, K = 61.9, L = 7.8, M = 15.0;
// 관절 = [이름, 기준1, 거리1, 기준2, 거리2] (좌표계: y 위쪽, 고정 피벗 O 가 원점)
const SPEC = [['K1', 'Q', J, 'O', B], ['K2', 'O', D, 'K1', E], ['K3', 'O', C, 'Q', K], ['K4', 'K2', F, 'K3', G], ['F', 'K4', Hh, 'K3', I]];
const BRANCH0 = [0, 1, 0, 0, 0]; // 크랭크 0° 에서 조립 가능한 교점 선택
const NAMES = ['O', 'C', 'Q', 'K1', 'K2', 'K3', 'K4', 'F'];
export const RODS = [['K1', 'Q', 'j', J], ['K1', 'O', 'b', B], ['K2', 'O', 'd', D], ['K2', 'K1', 'e', E], ['K3', 'O', 'c', C], ['K3', 'Q', 'k', K], ['K4', 'K2', 'f', F], ['K4', 'K3', 'g', G], ['F', 'K4', 'h', Hh], ['F', 'K3', 'i', I], ['Q', 'C', 'm', M]];

// 두 원의 교점. 없으면 null (조립 불가)
function circles(p0, r0, p1, r1) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1], d = Math.hypot(dx, dy);
  if (d > r0 + r1 || d < Math.abs(r0 - r1) || d === 0) return null;
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, r0 * r0 - a * a));
  const mx = p0[0] + a * dx / d, my = p0[1] + a * dy / d;
  return [[mx + h * dy / d, my - h * dx / d], [mx - h * dy / d, my + h * dx / d]];
}
// 크랭크 각도 → 모든 관절. prev 가 있으면 각 관절에서 이전 프레임에 가까운 교점을 골라 가지를 이어 간다.
export function solveLeg(th, prev) {
  const P = { O: [0, 0], C: [A, L] };
  P.Q = [A + M * Math.cos(th), L + M * Math.sin(th)];
  for (let n = 0; n < SPEC.length; n++) {
    const [nm, n0, r0, n1, r1] = SPEC[n], ci = circles(P[n0], r0, P[n1], r1);
    if (!ci) return prev || null; // 조립 불가 → 직전 자세 유지(콘솔 에러 없이)
    if (prev) { const q = prev[nm]; P[nm] = Math.hypot(ci[0][0] - q[0], ci[0][1] - q[1]) <= Math.hypot(ci[1][0] - q[0], ci[1][1] - q[1]) ? ci[0] : ci[1]; }
    else P[nm] = BRANCH0[n] ? ci[1] : ci[0];
  }
  return P;
}
// 한 바퀴 궤적 + 지면 접촉(평평한 구간) 분석
export function analyse(steps = 720) {
  let P = solveLeg(0, null); const tr = [];
  for (let s = 0; s <= steps; s++) { P = solveLeg(s / steps * TAU, P); tr.push([P.F[0], P.F[1]]); }
  let ymin = 1e9; for (const q of tr) ymin = Math.min(ymin, q[1]);
  const flat = []; for (let s = 0; s < steps; s++) if (tr[s][1] < ymin + 0.6) flat.push(s);
  // 시작점이 평평 구간 한가운데일 수 있어 원형으로 이어 붙여 가장 긴 연속 구간을 찾는다
  let best = [], cur = []; const set = new Set(flat);
  for (let s = 0; s < steps * 2; s++) { const k = s % steps; if (set.has(k)) cur.push(s); else { if (cur.length > best.length) best = cur; cur = []; } }
  if (cur.length > best.length) best = cur;
  const s0 = best[0], s1 = best[best.length - 1];
  const x0 = tr[s0 % steps][0], x1 = tr[s1 % steps][0], dth = (s1 - s0) / steps * TAU;
  return { tr, ymin, stanceFrac: best.length / steps, vx: (x1 - x0) / dth, stride: Math.abs(x1 - x0), lift: Math.max(...tr.map(q => q[1])) - ymin, s0: s0 % steps, s1: s1 % steps };
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s173__cv'), c = cv.getContext('2d');
  if (!c) return;
  const info = analyse(720), TR = info.tr;
  const LEGS = [{ x: -66, ph: 0, far: 0 }, { x: -22, ph: Math.PI / 2, far: 1 }, { x: 22, ph: Math.PI, far: 0 }, { x: 66, ph: Math.PI * 1.5, far: 1 }];
  const legs = LEGS.map(l => ({ ...l, P: solveLeg(l.ph, null) }));
  const det = { P: solveLeg(0, null) };
  let theta = 0, omega = 1.15, worldX = 0, W = 0, H = 0, S = 1, grid = null, hold = 0;

  function resize() {
    const r = cv.getBoundingClientRect(), sc = .8;
    W = Math.max(320, Math.round(r.width * sc)); H = Math.max(240, Math.round(r.height * sc)); cv.width = W; cv.height = H;
    S = Math.min(W / 1280, H / 720) * 2.25;
    grid = document.createElement('canvas'); grid.width = W; grid.height = H;
    const g = grid.getContext('2d'); g.fillStyle = '#143d9c'; g.fillRect(0, 0, W, H);
    const gs = Math.round(24 * W / 1280 * 1.1);
    for (let x = 0; x <= W; x += gs) { g.strokeStyle = x % (gs * 5) === 0 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.055)'; g.beginPath(); g.moveTo(x + .5, 0); g.lineTo(x + .5, H); g.stroke(); }
    for (let y = 0; y <= H; y += gs) { g.strokeStyle = y % (gs * 5) === 0 ? 'rgba(255,255,255,.13)' : 'rgba(255,255,255,.055)'; g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
    const v = g.createRadialGradient(W * .55, H * .45, H * .2, W * .55, H * .45, H * 1.1); v.addColorStop(0, 'rgba(20,61,156,0)'); v.addColorStop(1, 'rgba(6,22,70,.55)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(cv);

  // 로컬(y 위쪽, 고정피벗 원점) → 화면. x 를 뒤집어 몸통이 오른쪽으로 걷게 한다.
  const X = (o, x, s) => o.x - x * s, Y = (o, y, s) => o.y - y * s;
  const bar = (ax, ay, bx, by, al) => {
    c.lineCap = 'round';
    c.strokeStyle = `rgba(255,255,255,${.16 * al})`; c.lineWidth = 6; c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
    c.strokeStyle = `rgba(255,255,255,${.95 * al})`; c.lineWidth = 1.7; c.stroke();
  };
  const pin = (x, y, r, al, fixed) => {
    c.fillStyle = `rgba(20,61,156,${al})`; c.strokeStyle = `rgba(255,255,255,${al})`; c.lineWidth = 1.6;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.stroke();
    if (fixed) { c.beginPath(); c.moveTo(x - r * 1.7, y); c.lineTo(x + r * 1.7, y); c.moveTo(x, y - r * 1.7); c.lineTo(x, y + r * 1.7); c.stroke(); }
    else { c.fillStyle = `rgba(255,210,74,${al})`; c.beginPath(); c.arc(x, y, r * .32, 0, TAU); c.fill(); }
  };
  function drawLeg(P, o, s, al, labels) {
    const pt = n => [X(o, P[n][0], s), Y(o, P[n][1], s)];
    // 강체 삼각형 (b·d·e 벨크랭크, g·h·i 발)
    for (const tri of [['O', 'K1', 'K2'], ['K3', 'K4', 'F']]) {
      c.fillStyle = `rgba(255,255,255,${.07 * al})`; c.beginPath();
      tri.forEach((n, k) => { const p = pt(n); k ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); }); c.closePath(); c.fill();
    }
    for (const [a, b] of RODS) { const p = pt(a), q = pt(b); bar(p[0], p[1], q[0], q[1], al); }
    if (labels) {
      c.font = `italic 700 ${Math.round(13 * W / 1280 + 3)}px Georgia, serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const [a, b, nm, len] of RODS) {
        const p = pt(a), q = pt(b), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, dx = q[0] - p[0], dy = q[1] - p[1], dl = Math.hypot(dx, dy) || 1;
        c.fillStyle = '#ffd24a'; c.fillText(nm, mx + dy / dl * 13, my - dx / dl * 13);
      }
    }
    for (const n of ['K1', 'K2', 'K3', 'K4', 'Q']) { const p = pt(n); pin(p[0], p[1], 3.6 * Math.max(.8, s / 2.2), al, false); }
    const c0 = pt('C'); pin(c0[0], c0[1], 5.2 * Math.max(.8, s / 2.2), al, true);
    const o0 = pt('O'); pin(o0[0], o0[1], 5.2 * Math.max(.8, s / 2.2), al, true);
    const f = pt('F'); c.fillStyle = `rgba(255,210,74,${al})`; c.beginPath(); c.arc(f[0], f[1], 4.2 * Math.max(.8, s / 2.2), 0, TAU); c.fill();
    return f;
  }
  function trace(o, s, al, w, dash) {
    c.strokeStyle = `rgba(255,210,74,${al})`; c.lineWidth = w; c.setLineDash(dash || []); c.beginPath();
    for (let i = 0; i < TR.length; i++) { const x = X(o, TR[i][0], s), y = Y(o, TR[i][1], s); i ? c.lineTo(x, y) : c.moveTo(x, y); }
    c.stroke(); c.setLineDash([]);
  }

  function draw() {
    c.drawImage(grid, 0, 0);
    const body = { x: W * .34 }, OY = H * .60, gy = OY + 84 * S;
    // 지면: 줄자 눈금(월드 좌표에 고정 → 지면에 닿은 발은 눈금 위에서 안 미끄러진다)
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, gy); c.lineTo(W, gy); c.stroke();
    c.font = `600 ${Math.round(10 * W / 1280 + 2)}px ui-monospace, Consolas, monospace`; c.textAlign = 'center'; c.fillStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
    const sc = W / 1280;
    for (let n = Math.floor(worldX / 40 - body.x / S / 40) - 1, px = 0; px < W + 40 * S; n++) {
      px = body.x + (40 * n - worldX) * S;
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(px, gy); c.lineTo(px, gy + 12 * sc); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.28)'; c.beginPath(); for (let q = 1; q < 4; q++) { c.moveTo(px + q * 10 * S, gy); c.lineTo(px + q * 10 * S, gy + 6 * sc); } c.stroke();
      if (n % 5 === 0) c.fillText(String(40 * n), px, gy + 26 * sc);
    }
    // 빗금 지반
    c.strokeStyle = 'rgba(255,255,255,.16)'; c.beginPath();
    const hp = 18 * W / 1280, ho = ((-worldX * S) % hp + hp) % hp;
    for (let px = -ho - hp; px < W + hp; px += hp) { c.moveTo(px, gy + 26 * W / 1280); c.lineTo(px - 16 * W / 1280, gy + 44 * W / 1280); }
    c.stroke();

    // 몸통 빔
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.moveTo(body.x - 112 * S, OY - 3 * S); c.lineTo(body.x + 112 * S, OY - 3 * S); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1; c.beginPath(); c.moveTo(body.x - 112 * S, OY + 3 * S); c.lineTo(body.x + 112 * S, OY + 3 * S); c.stroke();
    // 먼 쪽(어두운) 다리 먼저
    const order = [...legs].sort((a, b) => b.far - a.far);
    for (const lg of order) {
      const o = { x: body.x + lg.x * S, y: OY }, al = lg.far ? .42 : 1;
      trace(o, S, lg.far ? .25 : .5, 1.2, [3, 4]);
      drawLeg(lg.P, o, S, al, false);
    }
    // 상세도 (우측, 큰 척도) — 0° 위상 다리 한 개를 확대해 막대 이름과 발 궤적을 보여준다
    const S2 = S * 1.45, od = { x: W * .79, y: H * .3 };
    c.strokeStyle = 'rgba(255,255,255,.22)'; c.lineWidth = 1; c.setLineDash([2, 5]);
    c.strokeRect(W * .60, H * .06, W * .37, H * .70); c.setLineDash([]);
    trace(od, S2, .95, 2, null);
    drawLeg(det.P, od, S2, 1, true);
    c.fillStyle = '#ffd24a'; c.font = `700 ${Math.round(12 * W / 1280 + 2)}px Pretendard, sans-serif`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
    c.fillText('다리 하나 확대 · 노란 곡선은 발끝이 그리는 한 바퀴', W * .615, H * .052);
    // 치수선: 보폭
    const fy = Y(od, info.ymin, S2) + 16, fx0 = X(od, TR[info.s0][0], S2), fx1 = X(od, TR[info.s1][0], S2);
    c.strokeStyle = '#ffd24a'; c.lineWidth = 1; c.beginPath(); c.moveTo(fx0, fy); c.lineTo(fx1, fy); c.moveTo(fx0, fy - 5); c.lineTo(fx0, fy + 5); c.moveTo(fx1, fy - 5); c.lineTo(fx1, fy + 5); c.stroke();
    c.textAlign = 'center'; c.fillText(`평평한 보폭 ${info.stride.toFixed(1)}`, (fx0 + fx1) / 2, fy + 18);
    // 타이틀 블록
    const bw = 372 * W / 1280, bh = 64 * W / 1280, bx = W - bw - 30, by = H - bh - 24 - 80 * H / 720;
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.2; c.strokeRect(bx, by, bw, bh); c.beginPath(); c.moveTo(bx, by + bh * .5); c.lineTo(bx + bw, by + bh * .5); c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `700 ${Math.round(11 * W / 1280 + 3)}px Pretendard, sans-serif`;
    c.fillText('도면 173 · 열한 막대 보행 기구', bx + 12, by + bh * .34);
    c.font = `500 ${Math.round(10 * W / 1280 + 3)}px ui-monospace, Consolas, monospace`; c.fillStyle = '#c5d4f5';
    c.fillText(`크랭크 ${(theta * 180 / Math.PI % 360 + 360) % 360 | 0}°  ·  ${omega.toFixed(2)} rad/s  ·  발 ${legs.filter(l => l.P.F[1] < info.ymin + .5).length}/4 접지`, bx + 12, by + bh * .82);
  }

  // ── 루프 ──
  let vis = true, tabVis = !document.hidden, last = performance.now(), acc = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabVis = !document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const FRAME = 1 / 30, DT = 1 / 120;
  const off_ = ctx.tick(() => {
    if (!vis || !tabVis) return;
    const now = performance.now(); acc += Math.min(.1, (now - last) / 1000); last = now;
    if (acc < FRAME) return;
    let t = Math.min(acc, .12); acc = 0;
    // 속도: 커서가 오른쪽일수록 빠르게 (왼쪽 끝은 거의 정지). 입력이 없으면 일정한 느린 걸음.
    const tgt = ctx.mouse.moved ? .25 + 2.1 * ctx.mouse.nx : 1.15;
    while (t > 0) {
      const h = Math.min(DT, t); t -= h;
      omega += (tgt - omega) * Math.min(1, 2.2 * h);
      theta += omega * h; worldX += info.vx * omega * h;
      for (const lg of legs) lg.P = solveLeg(lg.ph + theta, lg.P);
      det.P = solveLeg(theta, det.P);
    }
    draw();
  });
  const mv = () => { ctx.mouse.moved = true; };
  addEventListener('pointermove', mv, { passive: true });
  draw();
  return () => { off_(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', mv); };
}
