// s195 — 4점 호모그래피 DOM 변형.
// 단위 정사각형 -> 목표 4점 호모그래피를 8x8 선형계(h33=1)로 세워 부분 피벗 가우스 소거로 직접 풀고,
// 4x4 CSS matrix3d(열 우선, z 통과 행)로 옮겨 살아 있는 DOM 카드에 건다. 퇴화/비볼록/소실선 교차는 거부한다.
export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => Array.from(r.querySelectorAll(s));
  const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

  const stage = $('.s195__stage'), card = $('.s195__card'), cv = $('.s195__grid');
  const poly = $('.s195__outline polygon');
  const hs = $$('.s195__h');
  const cells = $$('.s195__mat i');
  const vpU = $('[data-vp="u"]'), vpV = $('[data-vp="v"]'), stateEl = $('.s195__state');
  let g2 = null;
  try { g2 = cv.getContext('2d'); } catch (e) { g2 = null; }

  const RED = !!ctx.reduced;
  const CW = 360, CH = 480;          // 카드 레이아웃 크기(CSS px)
  const PAD = 30;                    // 모서리가 스테이지 가장자리에서 떨어져야 하는 거리
  const KS = 170, KD = 16;           // 스프링 강성/감쇠 (ζ≈0.61, 살짝 출렁)
  const DT = 1 / 120;                // 고정 타임스텝

  // ───────────────────────── 호모그래피 솔버 ─────────────────────────
  // 코너 순서: 0=TL 1=TR 2=BR 3=BL, 소스는 단위 정사각형
  const SRC = [0, 0, 1, 0, 1, 1, 0, 1];
  const A = Array.from({ length: 8 }, () => new Float64Array(9));
  const hbuf = new Float64Array(8);

  // 반환: h[0..7] = [h11,h12,h13,h21,h22,h23,h31,h32] (h33=1, 단위공간). 특이/비정상이면 null.
  function solveH(P, out) {
    for (let i = 0; i < 4; i++) {
      const x = SRC[2 * i], y = SRC[2 * i + 1], X = P[2 * i], Y = P[2 * i + 1];
      const r0 = A[2 * i], r1 = A[2 * i + 1];
      r0[0] = x; r0[1] = y; r0[2] = 1; r0[3] = 0; r0[4] = 0; r0[5] = 0; r0[6] = -X * x; r0[7] = -X * y; r0[8] = X;
      r1[0] = 0; r1[1] = 0; r1[2] = 0; r1[3] = x; r1[4] = y; r1[5] = 1; r1[6] = -Y * x; r1[7] = -Y * y; r1[8] = Y;
    }
    for (let c = 0; c < 8; c++) {                     // 전진 소거 + 부분 피벗
      let p = c, m = Math.abs(A[c][c]);
      for (let r = c + 1; r < 8; r++) { const v = Math.abs(A[r][c]); if (v > m) { m = v; p = r; } }
      if (m < 1e-9) return null;                      // 특이
      if (p !== c) { const t = A[p]; A[p] = A[c]; A[c] = t; }
      const rc = A[c];
      for (let r = c + 1; r < 8; r++) {
        const rr = A[r], f = rr[c] / rc[c];
        if (f !== 0) for (let k = c; k < 9; k++) rr[k] -= f * rc[k];
      }
    }
    for (let r = 7; r >= 0; r--) {                    // 후진 대입
      let s = A[r][8];
      for (let k = r + 1; k < 8; k++) s -= A[r][k] * out[k];
      out[r] = s / A[r][r];
    }
    for (let i = 0; i < 8; i++) if (!isFinite(out[i])) return null;
    // 분모 w(u,v)=h31 u+h32 v+1 은 (u,v)에 대해 선형 -> 네 꼭짓점이 모두 양수면 카드 전체에서 w>0
    const d1 = 1 + out[6], d2 = 1 + out[6] + out[7], d3 = 1 + out[7];
    if (d1 < .06 || d2 < .06 || d3 < .06) return null;
    return out;
  }

  let MIN_AREA = 20000;
  // 볼록 + 최소변 + 최소각 + 최소면적. 모든 외적이 같은 부호(양수)라야 볼록 단순 사각형.
  function quadOK(P) {
    let area2 = 0;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) & 3, k = (i + 2) & 3;
      const e1x = P[2 * j] - P[2 * i], e1y = P[2 * j + 1] - P[2 * i + 1];
      const e2x = P[2 * k] - P[2 * j], e2y = P[2 * k + 1] - P[2 * j + 1];
      const l1 = Math.hypot(e1x, e1y), l2 = Math.hypot(e2x, e2y);
      if (l1 < 40) return false;                      // 점이 너무 가까움
      const cr = e1x * e2y - e1y * e2x;
      if (cr <= 0 || cr < .12 * l1 * l2) return false; // 비볼록/반전 또는 꼭짓점이 거의 일직선(≈7°)
      area2 += P[2 * i] * P[2 * j + 1] - P[2 * j] * P[2 * i + 1];
    }
    return area2 * .5 >= MIN_AREA;
  }
  const validate = (P, out) => (quadOK(P) ? solveH(P, out || hbuf) : null);

  // 단위공간 h -> CSS matrix3d (열 우선: [h11 h21 0 h31 | h12 h22 0 h32 | 0 0 1 0 | h13 h23 0 h33])
  const f9 = v => v.toFixed(9), f12 = v => v.toFixed(12);
  function matrixStr(h) {
    const a = h[0] / CW, b = h[1] / CH, c = h[2], d = h[3] / CW, e = h[4] / CH, f = h[5], g = h[6] / CW, k = h[7] / CH;
    return 'matrix3d(' + f9(a) + ',' + f9(d) + ',0,' + f12(g) + ',' + f9(b) + ',' + f9(e) + ',0,' + f12(k) + ',0,0,1,0,' + f9(c) + ',' + f9(f) + ',0,1)';
  }

  // ───────────────────────── 상태 ─────────────────────────
  let SW = 0, SH = 0, K = 1, DIST = 900;
  const pos = new Float64Array(8), vel = new Float64Array(8), tgt = new Float64Array(8);
  const hold = new Float64Array(8), rest = new Float64Array(8);
  const tmp = new Float64Array(8), cand = new Float64Array(8), np = new Float64Array(8), nv = new Float64Array(8), scr = new Float64Array(8);
  const curH = new Float64Array(8);
  let curOk = false;

  function layout() {
    const nw = stage.clientWidth, nh = stage.clientHeight;
    if (!nw || !nh || (nw === SW && nh === SH)) return;
    const first = !SW, rx = SW ? nw / SW : 1, ry = SH ? nh / SH : 1;
    SW = nw; SH = nh;
    cv.width = nw; cv.height = nh;
    K = Math.max(.45, Math.min(1.2, (nw - 70) / CW, ((nh - 110) / CH) * .96));
    DIST = 900 * K + 200;
    const hw = CW * K / 2, hh = CH * K / 2, cx = nw / 2, cy = nh / 2;
    rest.set([cx - hw, cy - hh, cx + hw, cy - hh, cx + hw, cy + hh, cx - hw, cy + hh]);
    MIN_AREA = .1 * (CW * K) * (CH * K);
    if (first) {
      demo(0, tmp); clampStage(tmp); makeValid(tmp);
      tgt.set(tmp); hold.set(tmp);
      let s = .42;                                    // 모인 상태에서 펼쳐지며 등장
      for (let t = 0; t < 6; t++, s += .1) {
        for (let i = 0; i < 4; i++) { pos[2 * i] = cx + (tmp[2 * i] - cx) * s; pos[2 * i + 1] = cy + (tmp[2 * i + 1] - cy) * s; }
        if (validate(pos, curH)) break;
      }
      if (!validate(pos, curH)) { pos.set(rest); validate(pos, curH); }
      vel.fill(0);
    } else {
      for (let i = 0; i < 4; i++) {
        pos[2 * i] *= rx; pos[2 * i + 1] *= ry; tgt[2 * i] *= rx; tgt[2 * i + 1] *= ry;
        hold[2 * i] *= rx; hold[2 * i + 1] *= ry;
      }
      if (!validate(pos, curH)) { pos.set(rest); tgt.set(rest); hold.set(rest); vel.fill(0); validate(pos, curH); }
    }
    curOk = true;
  }

  function clampStage(T) {
    for (let i = 0; i < 4; i++) { T[2 * i] = cl(T[2 * i], PAD, SW - PAD); T[2 * i + 1] = cl(T[2 * i + 1], PAD, SH - PAD); }
  }
  // 무효 목표면 rest 쪽으로 편차를 줄여(75%씩) 유효해질 때까지 후퇴
  const T0 = new Float64Array(8);
  function makeValid(T) {
    if (validate(T, scr)) return;
    T0.set(T);
    let f = 1;
    for (let k = 0; k < 7; k++) {
      f *= .75;
      for (let i = 0; i < 8; i++) T[i] = rest[i] + (T0[i] - rest[i]) * f;
      if (validate(T, scr)) return;
    }
    T.set(rest);
  }

  // ───────────────────────── 자동 데모 (3D 회전 투영 + 모서리별 리사주) ─────────────────────────
  const WF = [[.9, 1.3], [1.1, .8], [.7, 1.2], [1.25, .95]];
  const PH = [[0, 1.7], [2.1, .4], [3.3, 2.6], [4.4, 5.1]];
  const SX = [-1, 1, 1, -1], SY = [-1, -1, 1, 1];
  function demo(t, out) {
    const env0 = .5 + .5 * Math.sin(t * .36 - .05);
    const A_ = Math.min(SW, SH) * .13 * (.14 + .86 * env0 * env0) * (RED ? .5 : 1);
    const yaw = .5 * Math.sin(t * .47) + .14 * Math.sin(t * 1.13 + 1.1);
    const pit = .34 * Math.sin(t * .33 + .8) + .09 * Math.sin(t * .91);
    const rol = .09 * Math.sin(t * .29 + 2);
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit), cr = Math.cos(rol), sr = Math.sin(rol);
    const hw = CW * K / 2, hh = CH * K / 2, cx = SW / 2, cy = SH / 2;
    for (let i = 0; i < 4; i++) {
      const x = SX[i] * hw, y = SY[i] * hh;
      const x1 = x * cyw, z1 = -x * syw;
      const y2 = y * cp - z1 * sp, z2 = y * sp + z1 * cp;
      const x3 = x1 * cr - y2 * sr, y3 = x1 * sr + y2 * cr;
      const s = DIST / (DIST + z2);
      out[2 * i] = cx + x3 * s + A_ * Math.sin(t * WF[i][0] + PH[i][0]);
      out[2 * i + 1] = cy + y3 * s + A_ * Math.cos(t * WF[i][1] + PH[i][1]);
    }
  }

  // ───────────────────────── 스프링 물리 ─────────────────────────
  // 각 스텝 후보가 유효하지 않으면 스텝을 반씩 줄여 보고, 그래도 안 되면 정지(불변식: pos 는 항상 유효)
  function step(dt) {
    for (let i = 0; i < 8; i++) {
      const a = KS * (tgt[i] - pos[i]) - KD * vel[i];
      nv[i] = vel[i] + a * dt;
      np[i] = pos[i] + nv[i] * dt;
    }
    let f = 1;
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 8; i++) cand[i] = pos[i] + (np[i] - pos[i]) * f;
      if (validate(cand, hbuf)) {
        pos.set(cand); vel.set(nv); curH.set(hbuf);
        if (k) for (let i = 0; i < 8; i++) vel[i] *= .6;
        return;
      }
      f *= .5;
    }
    for (let i = 0; i < 8; i++) vel[i] *= .2;
  }

  // ───────────────────────── 입력 모드 (데모 <-> 사용자) ─────────────────────────
  let mode = 'demo', waitLeft = 0, blend = 1, demoT = 0, ts = 1;
  let hover = false, focusIn = false, drag = null, rejectAt = -1e9;
  const REST_WAIT = 5;

  function freeze() {
    if (mode === 'demo' || mode === 'blend') { hold.set(pos); tgt.set(pos); }
    mode = 'user';
  }
  function release() {
    mode = 'wait'; waitLeft = REST_WAIT; hold.set(tgt);
  }
  // 모서리 i 의 목표를 (x,y)로. 무효면 마지막 유효 목표에서 (x,y) 쪽으로 이분 탐색해 가장 먼 유효점까지만.
  function tryTarget(i, x, y) {
    scr.set(tgt); scr[2 * i] = x; scr[2 * i + 1] = y;
    if (validate(scr, hbuf)) { tgt[2 * i] = x; tgt[2 * i + 1] = y; return true; }
    const x0 = tgt[2 * i], y0 = tgt[2 * i + 1];
    let lo = 0, hi = 1;
    for (let k = 0; k < 10; k++) {
      const m = (lo + hi) / 2;
      scr[2 * i] = x0 + (x - x0) * m; scr[2 * i + 1] = y0 + (y - y0) * m;
      if (validate(scr, hbuf)) lo = m; else hi = m;
    }
    tgt[2 * i] = x0 + (x - x0) * lo; tgt[2 * i + 1] = y0 + (y - y0) * lo;
    return false;
  }

  const offs = [];
  const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); offs.push(() => el.removeEventListener(ev, fn, o)); };

  hs.forEach((h, i) => {
    const pt = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    on(h, 'pointerdown', e => {
      if (e.button) return;
      e.preventDefault();
      try { h.setPointerCapture(e.pointerId); } catch (_) {}
      const [px, py] = pt(e);
      freeze();
      drag = { i, id: e.pointerId, dx: pos[2 * i] - px, dy: pos[2 * i + 1] - py };
      h.classList.add('is-drag');
    });
    on(h, 'pointermove', e => {
      if (!drag || drag.i !== i || drag.id !== e.pointerId) return;
      const [px, py] = pt(e);
      const ok = tryTarget(i, cl(px + drag.dx, PAD, SW - PAD), cl(py + drag.dy, PAD, SH - PAD));
      h.classList.toggle('is-bad', !ok);
      if (!ok) rejectAt = performance.now();
    });
    const end = e => {
      if (!drag || drag.i !== i || (e && e.pointerId !== undefined && drag.id !== e.pointerId)) return;
      drag = null;
      h.classList.remove('is-drag', 'is-bad');
      release();
    };
    on(h, 'pointerup', end); on(h, 'pointercancel', end); on(h, 'lostpointercapture', end);
    on(h, 'keydown', e => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!m) return;
      e.preventDefault();
      if (mode === 'demo' || mode === 'blend') { hold.set(pos); tgt.set(pos); }
      const s = e.shiftKey ? 36 : 12;
      const ok = tryTarget(i, cl(tgt[2 * i] + m[0] * s, PAD, SW - PAD), cl(tgt[2 * i + 1] + m[1] * s, PAD, SH - PAD));
      if (!ok) rejectAt = performance.now();
      mode = 'wait'; waitLeft = REST_WAIT; hold.set(tgt);
    });
  });

  // 카드 위 상호작용 중에는 데모가 거의 멈춰 클릭/입력이 쉬움
  on(card, 'pointerover', e => { hover = !!(e.target.closest && e.target.closest('button,a,input,label')); });
  on(card, 'pointerleave', () => { hover = false; });
  on(card, 'focusin', () => { focusIn = true; });
  on(card, 'focusout', () => { focusIn = false; });

  // ───────────────────────── 렌더 ─────────────────────────
  const fmtN = v => {
    const a = Math.abs(v);
    if (a >= 1000) return v.toFixed(0);
    if (a >= 100) return v.toFixed(1);
    if (a < .01 && a > 0) return v.toExponential(1);
    return v.toFixed(3);
  };
  const fmtP = (x, y) => (!isFinite(x) || !isFinite(y) || Math.abs(x) > 99999 || Math.abs(y) > 99999) ? '∞'
    : '(' + Math.round(x) + ', ' + Math.round(y) + ')';
  function updatePanel(h) {
    const a = [h[0] / CW, h[1] / CH, h[2], h[3] / CW, h[4] / CH, h[5], h[6] / CW, h[7] / CH, 1];
    for (let i = 0; i < 9; i++) if (cells[i]) cells[i].textContent = fmtN(a[i]);
    if (vpU) vpU.textContent = Math.abs(a[6]) > 1e-7 ? fmtP(a[0] / a[6], a[3] / a[6]) : '∞';
    if (vpV) vpV.textContent = Math.abs(a[7]) > 1e-7 ? fmtP(a[1] / a[7], a[4] / a[7]) : '∞';
    if (stateEl) {
      const bad = performance.now() - rejectAt < 500;
      stateEl.textContent = bad ? '더는 못 당겨요 (퇴화 거부)' : '유효한 사각형';
      stateEl.classList.toggle('is-bad', bad);
    }
  }

  function lineX(ax, ay, bx, by, cx, cy, dx, dy) {
    const r1x = bx - ax, r1y = by - ay, r2x = dx - cx, r2y = dy - cy;
    const den = r1x * r2y - r1y * r2x;
    if (Math.abs(den) < 1.5e-3 * Math.hypot(r1x, r1y) * Math.hypot(r2x, r2y)) return null;
    const t = ((cx - ax) * r2y - (cy - ay) * r2x) / den;
    const X = ax + r1x * t, Y = ay + r1y * t;
    return (Math.abs(X) > 2e4 || Math.abs(Y) > 2e4) ? null : [X, Y];
  }

  function drawGrid(h) {
    const g = g2;
    if (!g) return;
    g.clearRect(0, 0, SW, SH);
    const a = h[0] / CW, b = h[1] / CH, c = h[2], d = h[3] / CW, e = h[4] / CH, f = h[5], gg = h[6] / CW, kk = h[7] / CH;
    const EPS = .16, G = 40, R = 22;
    const x0 = -R * G, x1 = CW + R * G, y0 = -R * G, y1 = CH + R * G;
    // 평면 선분을 동차좌표에서 w>EPS 로 근평면 클리핑해 그린다(소실선 너머는 버림)
    function seg(ax, ay, bx, by) {
      let X0 = a * ax + b * ay + c, Y0 = d * ax + e * ay + f, W0 = gg * ax + kk * ay + 1;
      let X1 = a * bx + b * by + c, Y1 = d * bx + e * by + f, W1 = gg * bx + kk * by + 1;
      if (W0 < EPS && W1 < EPS) return;
      if (W0 < EPS) { const t = (EPS - W0) / (W1 - W0); X0 += (X1 - X0) * t; Y0 += (Y1 - Y0) * t; W0 = EPS; }
      else if (W1 < EPS) { const t = (EPS - W1) / (W0 - W1); X1 += (X0 - X1) * t; Y1 += (Y0 - Y1) * t; W1 = EPS; }
      g.moveTo(X0 / W0, Y0 / W0); g.lineTo(X1 / W1, Y1 / W1);
    }
    const nI = Math.round(CW / G) + R, nJ = Math.round(CH / G) + R;
    g.lineWidth = 1; g.strokeStyle = 'rgba(29,27,58,.13)'; g.beginPath();
    for (let i = -R; i <= nI; i++) if (i % 3) seg(i * G, y0, i * G, y1);
    for (let j = -R; j <= nJ; j++) if (j % 3) seg(x0, j * G, x1, j * G);
    g.stroke();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(29,27,58,.30)'; g.beginPath();
    for (let i = -R; i <= nI; i++) if (!(i % 3)) seg(i * G, y0, i * G, y1);
    for (let j = -R; j <= nJ; j++) if (!(j % 3)) seg(x0, j * G, x1, j * G);
    g.stroke();

    // 같은 H 로 평면 위에 드리운 그림자 (카드 사각형을 평면에서 밀어 투영)
    function plane(ox, oy, grow, col) {
      const q = [[ox - grow, oy - grow], [CW + ox + grow, oy - grow], [CW + ox + grow, CH + oy + grow], [ox - grow, CH + oy + grow]];
      g.fillStyle = col; g.beginPath();
      for (let i = 0; i < 4; i++) {
        const X = a * q[i][0] + b * q[i][1] + c, Y = d * q[i][0] + e * q[i][1] + f, W = gg * q[i][0] + kk * q[i][1] + 1;
        if (W < EPS) return;
        if (i) g.lineTo(X / W, Y / W); else g.moveTo(X / W, Y / W);
      }
      g.closePath(); g.fill();
    }
    plane(34, 44, 10, 'rgba(29,27,58,.08)');
    plane(18, 26, 0, 'rgba(29,27,58,.17)');

    // 평행한 변이 만나는 소실점과 수평선
    const P = pos;
    const vu = lineX(P[0], P[1], P[2], P[3], P[6], P[7], P[4], P[5]);   // 윗변 ∩ 아랫변
    const vv = lineX(P[0], P[1], P[6], P[7], P[2], P[3], P[4], P[5]);   // 왼변 ∩ 오른변
    function toVP(ax, ay, bx, by, v) {
      const da = Math.hypot(ax - v[0], ay - v[1]), db = Math.hypot(bx - v[0], by - v[1]);
      if (da < db) { g.moveTo(ax, ay); } else { g.moveTo(bx, by); }
      g.lineTo(v[0], v[1]);
    }
    g.setLineDash([5, 6]); g.lineWidth = 1.6;
    if (vu) { g.strokeStyle = 'rgba(255,77,46,.9)'; g.beginPath(); toVP(P[0], P[1], P[2], P[3], vu); toVP(P[6], P[7], P[4], P[5], vu); g.stroke(); }
    if (vv) { g.strokeStyle = 'rgba(91,60,255,.9)'; g.beginPath(); toVP(P[0], P[1], P[6], P[7], vv); toVP(P[2], P[3], P[4], P[5], vv); g.stroke(); }
    if (vu && vv) {
      const dx = vv[0] - vu[0], dy = vv[1] - vu[1], L = Math.hypot(dx, dy);
      if (L > 2) {
        g.setLineDash([2, 7]); g.lineWidth = 1.2; g.strokeStyle = 'rgba(29,27,58,.4)';
        g.beginPath(); g.moveTo(vu[0] - dx / L * 4000, vu[1] - dy / L * 4000); g.lineTo(vv[0] + dx / L * 4000, vv[1] + dy / L * 4000); g.stroke();
      }
    }
    g.setLineDash([]);
    [[vu, '#ff4d2e'], [vv, '#5b3cff']].forEach(([v, col]) => {
      if (!v || v[0] < -20 || v[0] > SW + 20 || v[1] < -20 || v[1] > SH + 20) return;
      g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = 2.5;
      g.beginPath(); g.arc(v[0], v[1], 6, 0, 6.2832); g.fill(); g.stroke();
    });
  }

  let lastM = '', lastPanel = 0, shown = false;
  function render(now) {
    if (!curOk) return;
    const m = matrixStr(curH);
    if (m !== lastM) { card.style.transform = m; lastM = m; }
    let pts = '';
    for (let i = 0; i < 4; i++) {
      const x = pos[2 * i].toFixed(1), y = pos[2 * i + 1].toFixed(1);
      hs[i].style.transform = 'translate(' + x + 'px,' + y + 'px)';
      pts += x + ',' + y + ' ';
    }
    poly.setAttribute('points', pts);
    drawGrid(curH);
    if (now - lastPanel > 120) { lastPanel = now; updatePanel(curH); }
    if (!shown) { shown = true; root.classList.add('is-ready'); }
  }

  // ───────────────────────── 메인 루프 (30fps 캡) ─────────────────────────
  let acc = 0, frameAcc = 0, last = performance.now(), offTick = null, inView = true;
  function update(dt) {
    const tsT = focusIn ? 0 : hover ? .1 : 1;
    ts += (tsT - ts) * Math.min(1, dt * 7);
    if (mode === 'wait') { waitLeft -= dt; if (waitLeft <= 0) { mode = 'blend'; blend = 0; } }
    if (mode === 'blend') { blend += dt / 2.4; if (blend >= 1) { blend = 1; mode = 'demo'; } }
    if (mode === 'demo' || mode === 'blend') {
      demoT += dt * ts * (RED ? .45 : 1);
      demo(demoT, tmp);
      if (mode === 'blend') {
        const e = blend * blend * (3 - 2 * blend);
        for (let i = 0; i < 8; i++) tmp[i] = hold[i] + (tmp[i] - hold[i]) * e;
      }
      clampStage(tmp); makeValid(tmp); tgt.set(tmp);
    }
    acc += dt;
    let n = 0;
    while (acc >= DT && n < 8) { step(DT); acc -= DT; n++; }
    if (acc > DT) acc = 0;
  }
  function loop() {
    const now = performance.now();
    frameAcc += Math.min(.1, (now - last) / 1000); last = now;
    if (frameAcc < 1 / 30 - .002) return;
    const dt = frameAcc; frameAcc = 0;
    update(dt);
    render(now);
  }
  function sync() {
    const run = inView && !document.hidden;
    if (run && !offTick) { last = performance.now(); offTick = ctx.tick(loop); }
    else if (!run && offTick) { offTick(); offTick = null; }
  }
  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; sync(); }, { threshold: 0 });
  io.observe(root);
  on(document, 'visibilitychange', sync);
  const ro = new ResizeObserver(() => { layout(); });
  ro.observe(stage);

  layout();
  update(1 / 60); render(performance.now());
  sync();

  // ───────────────────────── 카드 안의 살아 있는 UI ─────────────────────────
  const fmt = n => n.toLocaleString('ko-KR');
  // 탭
  const tabs = $$('.c-tab'), panes = $$('.c-pane'), ink = $('.c-ink');
  tabs.forEach((t, i) => on(t, 'click', () => {
    tabs.forEach((x, j) => { x.classList.toggle('is-on', i === j); x.setAttribute('aria-selected', i === j ? 'true' : 'false'); });
    panes.forEach((p, j) => { p.hidden = i !== j; });
    ink.style.transform = 'translateX(' + (i * 100) + '%)';
  }));
  // 수량/합계
  const rows = $$('.c-menu li'), totalEl = $('.c-total b'), order = $('.c-order');
  const total = () => rows.reduce((s, li) => s + (+li.dataset.price) * (+$('output', li).textContent), 0);
  const paint = () => { totalEl.textContent = '₩' + fmt(total()); };
  rows.forEach(li => on(li, 'click', e => {
    const b = e.target.closest('button[data-d]');
    if (!b) return;
    const o = $('output', li);
    o.textContent = cl((+o.textContent) + (+b.dataset.d), 0, 9);
    paint();
  }));
  // 맵기 슬라이더
  const range = $('.c-spice input'), spiceOut = $('.c-spice output');
  const SP = ['순한맛', '보통맛', '매운맛', '불맛'];
  const spice = () => { spiceOut.textContent = SP[+range.value]; range.style.setProperty('--p', (+range.value / 3 * 100) + '%'); };
  on(range, 'input', spice); spice();
  // 주문 버튼
  let orderTimer = 0;
  on(order, 'click', () => {
    clearTimeout(orderTimer);
    const t = total();
    order.classList.remove('is-shake', 'is-done');
    if (!t) {
      void order.offsetWidth; order.classList.add('is-shake'); order.textContent = '메뉴를 담아 주세요';
      orderTimer = setTimeout(() => { order.classList.remove('is-shake'); order.textContent = '주문하기'; }, 1500);
      return;
    }
    order.classList.add('is-done'); order.textContent = '접수 완료 ✓';
    orderTimer = setTimeout(() => { order.classList.remove('is-done'); order.textContent = '주문하기'; }, 2000);
  });
  // 가맹 상담 폼
  const form = $('form.c-pane'), msg = $('.c-msg'), nameI = $('input[name="name"]'), telI = $('input[name="tel"]');
  on(telI, 'input', () => {
    const d = telI.value.replace(/\D/g, '').slice(0, 11);
    telI.value = d.length > 7 ? d.slice(0, 3) + '-' + d.slice(3, d.length - 4) + '-' + d.slice(-4)
      : d.length > 3 ? d.slice(0, 3) + '-' + d.slice(3) : d;
  });
  on(form, 'submit', e => {
    e.preventDefault();
    const n = nameI.value.trim(), d = telI.value.replace(/\D/g, '');
    msg.classList.remove('is-err', 'is-ok');
    if (!n) { msg.textContent = '성함을 적어 주세요.'; msg.classList.add('is-err'); nameI.focus(); return; }
    if (d.length < 9) { msg.textContent = '연락처를 다시 확인해 주세요.'; msg.classList.add('is-err'); telI.focus(); return; }
    msg.textContent = n + '님, 신청이 접수됐어요. 영업일 기준 1일 안에 연락드릴게요.'; msg.classList.add('is-ok');
  });
  // 링크(데모라 이동하지 않음)
  on(root, 'click', e => { const a = e.target.closest('a[href^="#"]'); if (a) e.preventDefault(); });
  // 카운트다운
  const clock = $('.c-clock');
  let endAt = Date.now() + (14 * 60 + 32) * 1000;
  const tickClock = () => {
    let s = Math.round((endAt - Date.now()) / 1000);
    if (s <= 0) { endAt = Date.now() + 15 * 60 * 1000; s = 15 * 60; }
    const p = v => String(v).padStart(2, '0');
    clock.textContent = p(s / 3600 | 0) + ':' + p((s % 3600) / 60 | 0) + ':' + p(s % 60);
  };
  tickClock();
  const clockTimer = setInterval(tickClock, 500);

  return () => {
    if (offTick) offTick();
    io.disconnect(); ro.disconnect();
    clearInterval(clockTimer); clearTimeout(orderTimer);
    offs.forEach(f => f());
  };
}
