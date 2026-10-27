// s180 — 자기 진자 프랙탈. 3자석 끌개 · Beeman 적분 · 128² 점진 계산 · 경계 2×2 부표본 + dt/2 민감도 판별
const W = 2.6, DT = 0.03, MAXN = 3000, N = 128, SUB = 2, IM = N * SUB, TAU = Math.PI * 2;
const K0 = 0.5, MU = 0.2, HH = 0.35 * 0.35, R0 = 1;
const MX = [0, 1, 2].map(i => Math.cos(Math.PI / 2 + i * TAU / 3) * R0);
const MY = [0, 1, 2].map(i => Math.sin(Math.PI / 2 + i * TAU / 3) * R0);
const STOP2 = 0.15 * 0.15;

let AX = 0, AY = 0;
// a = -k r - μ v + Σ (m - r) / (|m - r|² + h²)^{3/2}
function force(x, y, vx, vy) {
  let ax = -K0 * x - MU * vx, ay = -K0 * y - MU * vy;
  for (let m = 0; m < 3; m++) {
    const dx = MX[m] - x, dy = MY[m] - y, d2 = dx * dx + dy * dy + HH, inv = 1 / (d2 * Math.sqrt(d2));
    ax += dx * inv; ay += dy * inv;
  }
  AX = ax; AY = ay;
}
const settled = (x, y, vx, vy) => {
  if (vx * vx + vy * vy >= STOP2) return -1;
  for (let m = 0; m < 3; m++) { const dx = x - MX[m], dy = y - MY[m]; if (dx * dx + dy * dy < STOP2) return m; }
  return -1;
};
const nearest = (x, y) => { let b = 0, bd = 1e9; for (let m = 0; m < 3; m++) { const dx = x - MX[m], dy = y - MY[m], d = dx * dx + dy * dy; if (d < bd) { bd = d; b = m; } } return b; };
// Beeman: x' = x + v dt + (2/3 a - 1/6 a_prev) dt², v' = v + (1/3 a' + 5/6 a - 1/6 a_prev) dt, 마찰항 때문에 a' 는 예측 속도로 평가
export function beeman(st, dt) {
  let x = st[0], y = st[1], vx = st[2], vy = st[3], ax = st[4], ay = st[5], pax = st[6], pay = st[7];
  const nx = x + vx * dt + (2 / 3 * ax - 1 / 6 * pax) * dt * dt, ny = y + vy * dt + (2 / 3 * ay - 1 / 6 * pay) * dt * dt;
  const pvx = vx + (1.5 * ax - .5 * pax) * dt, pvy = vy + (1.5 * ay - .5 * pay) * dt;
  force(nx, ny, pvx, pvy);
  const nax = AX, nay = AY;
  st[2] = vx + (nax / 3 + 5 / 6 * ax - pax / 6) * dt; st[3] = vy + (nay / 3 + 5 / 6 * ay - pay / 6) * dt;
  st[6] = ax; st[7] = ay; st[4] = nax; st[5] = nay; st[0] = nx; st[1] = ny;
}
export function initState(st, x, y) { force(x, y, 0, 0); st[0] = x; st[1] = y; st[2] = st[3] = 0; st[4] = st[6] = AX; st[5] = st[7] = AY; }
// 정착 자석과 걸린 스텝을 돌려준다: m*100000 + n (정지 조건은 8스텝마다 검사)
const ST = new Float64Array(8);
export function run(x, y, dt, maxSteps) {
  initState(ST, x, y);
  for (let n = 1; n <= maxSteps; n++) {
    beeman(ST, dt);
    if (n > 20 && (n & 7) === 0) { const m = settled(ST[0], ST[1], ST[2], ST[3]); if (m >= 0) return m * 100000 + n; }
  }
  return nearest(ST[0], ST[1]) * 100000 + maxSteps;
}

const BASE = [[238, 75, 43], [246, 185, 59], [31, 181, 165]];
function shade(m, n, out, o) {
  const t = Math.min(1, n / 1800), b = 1.12 - .52 * Math.pow(t, .55), c = BASE[m];
  out[o] = Math.min(255, c[0] * b); out[o + 1] = Math.min(255, c[1] * b); out[o + 2] = Math.min(255, c[2] * b); out[o + 3] = 255;
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s180__cv'), c2 = cv.getContext('2d');
  const note = root.querySelector('[data-r=note]'), pctEl = [0, 1, 2].map(i => root.querySelector(`[data-pct="${i}"]`));
  if (!c2) return;
  const CS = 560, off = document.createElement('canvas'); off.width = off.height = IM;
  const oc = off.getContext('2d'), img = oc.createImageData(IM, IM);
  for (let k = 0; k < IM * IM; k++) { img.data[k * 4] = 20; img.data[k * 4 + 1] = 26; img.data[k * 4 + 2] = 62; img.data[k * 4 + 3] = 255; }
  const lab = new Int8Array(N * N).fill(-1), nn = new Uint16Array(N * N);
  const order = [], seen = new Uint8Array(N * N);
  for (const s of [8, 4, 2, 1]) for (let r = 0; r < N; r += s) for (let i = 0; i < N; i += s) { const k = r * N + i; if (!seen[k]) { seen[k] = 1; order.push(k | (s << 16)); } }
  let doneA = 0, bnd = null, doneB = 0, sens = 0, phase = 0, dirty = true;
  const pxX = (i, f) => ((i + f) / N * 2 - 1) * W, pxY = (r, f) => (1 - (r + f) / N * 2) * W;
  const paintBlock = (k, s, m, n) => {
    const i = k % N, r = (k / N) | 0;
    for (let y = r * SUB; y < Math.min(IM, (r + s) * SUB); y++) for (let x = i * SUB; x < Math.min(IM, (i + s) * SUB); x++) shade(m, n, img.data, (y * IM + x) * 4);
  };
  const stepA = budget => {
    const t0 = performance.now();
    while (doneA < order.length && performance.now() - t0 < budget) {
      const e = order[doneA++], k = e & 0xffff, s = e >> 16, i = k % N, r = (k / N) | 0;
      const q = run(pxX(i, .5), pxY(r, .5), DT, MAXN), m = (q / 100000) | 0, n = q % 100000;
      lab[k] = m; nn[k] = n; paintBlock(k, s, m, n);
    }
    dirty = true;
    if (doneA >= order.length) {
      const cnt = [0, 0, 0]; for (let k = 0; k < N * N; k++) cnt[lab[k]]++;
      pctEl.forEach((el, i) => { if (el) el.textContent = (cnt[i] / (N * N) * 100).toFixed(1) + '%'; });
      bnd = []; for (let r = 0; r < N; r++) for (let i = 0; i < N; i++) { const k = r * N + i, m = lab[k];
        if ((i > 0 && lab[k - 1] !== m) || (i < N - 1 && lab[k + 1] !== m) || (r > 0 && lab[k - N] !== m) || (r < N - 1 && lab[k + N] !== m)) bnd.push(k); }
      phase = 1; if (note) note.textContent = `경계 픽셀 ${bnd.length.toLocaleString('ko-KR')}개를 2×2 로 다시 풀고 있습니다`;
    }
  };
  const stepB = budget => {
    const t0 = performance.now();
    while (doneB < bnd.length && performance.now() - t0 < budget) {
      const k = bnd[doneB++], i = k % N, r = (k / N) | 0;
      // 중심을 dt 와 dt/2 로 두 번 풀어 갈리면 '수치적으로 결정 불가' 경계
      const qa = run(pxX(i, .5), pxY(r, .5), DT, MAXN), qb = run(pxX(i, .5), pxY(r, .5), DT / 2, MAXN * 2);
      const ma = (qa / 100000) | 0, mb = (qb / 100000) | 0;
      if (ma !== mb) {
        sens++;
        for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) shade((sx + sy) & 1 ? mb : ma, 900, img.data, ((r * SUB + sy) * IM + i * SUB + sx) * 4);
      } else {
        for (let sy = 0; sy < SUB; sy++) for (let sx = 0; sx < SUB; sx++) {
          const q = run(pxX(i, .25 + .5 * sx), pxY(r, .25 + .5 * sy), DT, MAXN), m = (q / 100000) | 0;
          shade(m, q % 100000, img.data, ((r * SUB + sy) * IM + i * SUB + sx) * 4);
        }
      }
    }
    dirty = true;
    if (doneB >= bnd.length) { phase = 2; if (note) note.textContent = `경계 ${bnd.length.toLocaleString('ko-KR')}개 중 수치적으로 결정할 수 없는 곳 ${sens}개 (${(sens / (N * N) * 100).toFixed(2)}%) — 그레인으로 표시`; }
  };

  // ── 진자 ──
  const pst = new Float64Array(8), TR = 900, trx = new Float32Array(TR), try_ = new Float32Array(TR);
  let clock = 0, tn = 0, simAcc = 0, stepN = 0, final = -1, holdT = 0, predM = -1, startX = 0, startY = 0, userUntil = 0, pulse = 0, rnd = 7;
  const rand = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;
  const NAMES = ['청양 고추장', '유자 간장', '와사비 마요'];
  function release(x, y) {
    initState(pst, x, y); tn = 0; simAcc = 0; stepN = 0; final = -1; holdT = 0; pulse = 0; startX = x; startY = y;
    predM = (run(x, y, DT, MAXN) / 100000) | 0; // 같은 적분기를 끝까지 한 번 돌려 둔 '예고'
    if (note && phase === 2) note.textContent = `예고: ${NAMES[predM]} — 이제 숟가락이 직접 굴러갑니다`;
    trx[0] = x; try_[0] = y; tn = 1;
  }
  const autoPick = () => {
    for (let q = 0; q < 40; q++) {
      const a = rand() * TAU, d = Math.sqrt(rand()) * 2.3, x = Math.cos(a) * d, y = Math.sin(a) * d;
      if (Math.min(...[0, 1, 2].map(m => Math.hypot(x - MX[m], y - MY[m]))) > .45) { release(x, y); return; }
    }
    release(1.7, -1.1);
  };
  release(1.65, -1.25);

  // ── 그리기 ──
  const sx = x => (x / W + 1) * .5 * CS, sy = y => (1 - y / W) * .5 * CS;
  let hover = null;
  const COL = ['#ee4b2b', '#f6b93b', '#1fb5a5'];
  function draw() {
    if (dirty) { oc.putImageData(img, 0, 0); dirty = false; }
    c2.imageSmoothingEnabled = true; c2.imageSmoothingQuality = 'high';
    c2.drawImage(off, 0, 0, CS, CS);
    // 자석: 숨쉬듯 번지는 후광(시간 변화)
    for (let m = 0; m < 3; m++) {
      const x = sx(MX[m]), y = sy(MY[m]), ph = (clock * .55 + m / 3) % 1;
      c2.strokeStyle = COL[m]; c2.globalAlpha = .6 * (1 - ph); c2.lineWidth = 3; c2.beginPath(); c2.arc(x, y, 16 + ph * 44, 0, TAU); c2.stroke(); c2.globalAlpha = 1;
      c2.fillStyle = '#0d1230'; c2.beginPath(); c2.arc(x, y, 15, 0, TAU); c2.fill();
      c2.fillStyle = COL[m]; c2.beginPath(); c2.arc(x, y, 9.5, 0, TAU); c2.fill();
      c2.strokeStyle = '#fff'; c2.lineWidth = 2; c2.beginPath(); c2.arc(x, y, 15, 0, TAU); c2.stroke();
    }
    // 궤적
    const n = Math.min(tn, TR);
    c2.lineCap = 'butt'; c2.lineJoin = 'round';
    for (let g = 0; g < n - 1; g += 8) {
      const e = Math.min(n - 1, g + 9), u = g / n;
      c2.strokeStyle = `rgba(255,255,255,${(.18 + .72 * u).toFixed(3)})`; c2.lineWidth = .8 + 1.8 * u;
      c2.beginPath(); c2.moveTo(sx(trx[(tn - n + g) % TR]), sy(try_[(tn - n + g) % TR]));
      for (let q = g + 1; q <= e; q++) c2.lineTo(sx(trx[(tn - n + q) % TR]), sy(try_[(tn - n + q) % TR]));
      c2.stroke();
    }
    // 출발점 / 숟가락
    c2.strokeStyle = '#ffffffcc'; c2.lineWidth = 1.5; c2.setLineDash([3, 4]); c2.beginPath(); c2.arc(sx(startX), sy(startY), 10, 0, TAU); c2.stroke(); c2.setLineDash([]);
    const bx = sx(pst[0]), by = sy(pst[1]);
    c2.fillStyle = '#00000055'; c2.beginPath(); c2.arc(bx + 3, by + 4, 9, 0, TAU); c2.fill();
    c2.fillStyle = '#fff'; c2.beginPath(); c2.arc(bx, by, 9, 0, TAU); c2.fill();
    c2.fillStyle = final >= 0 ? COL[final] : '#0d1230'; c2.beginPath(); c2.arc(bx, by, 5, 0, TAU); c2.fill();
    if (pulse > 0 && final >= 0) { c2.strokeStyle = COL[final]; c2.globalAlpha = pulse; c2.lineWidth = 4; c2.beginPath(); c2.arc(bx, by, 14 + (1 - pulse) * 60, 0, TAU); c2.stroke(); c2.globalAlpha = 1; }
    if (hover) {
      const i = Math.min(N - 1, Math.max(0, Math.floor((hover.x / W + 1) / 2 * N))), r = Math.min(N - 1, Math.max(0, Math.floor((1 - hover.y / W) / 2 * N)));
      const m = lab[r * N + i], hx = sx(hover.x), hy = sy(hover.y);
      c2.strokeStyle = '#fff'; c2.lineWidth = 2; c2.beginPath(); c2.arc(hx, hy, 12, 0, TAU); c2.stroke();
      if (m >= 0) { c2.fillStyle = COL[m]; c2.beginPath(); c2.arc(hx, hy, 6, 0, TAU); c2.fill(); }
    }
    if (phase < 2) { c2.fillStyle = '#ffffffcc'; const tot = order.length + (bnd ? bnd.length : 0); c2.fillRect(0, CS - 5, CS * (doneA + doneB) / Math.max(1, tot), 5); }
  }

  // ── 입력 ──
  const toW = e => { const r = cv.getBoundingClientRect(); return { x: ((e.clientX - r.left) / r.width * 2 - 1) * W, y: (1 - (e.clientY - r.top) / r.height * 2) * W }; };
  const pd = e => { const p = toW(e); userUntil = performance.now() + 12000; release(p.x, p.y); };
  const pm = e => { hover = toW(e); dirty = true; };
  const pl = () => { hover = null; dirty = true; };
  cv.addEventListener('pointerdown', pd); cv.addEventListener('pointermove', pm); cv.addEventListener('pointerleave', pl);

  // ── 루프 (프레임 캡 ≈24fps · 화면 밖/탭 숨김 정지) ──
  let vis = true, tabVis = !document.hidden, lastT = performance.now(), acc = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabVis = !document.hidden; lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const SPEED = 2.8, FRAME = 1 / 24;
  const off_ = ctx.tick(() => {
    if (tabVis) { if (phase === 0) stepA(14); else if (phase === 1) stepB(14); } // 지도 계산은 화면 밖에서도 예산 안에서 미리 진행
    if (!vis || !tabVis) return;
    const now = performance.now(); acc += Math.min(.1, (now - lastT) / 1000); lastT = now;
    if (acc < FRAME) return; const adv = Math.min(acc, .12); acc = 0; clock += adv;
    if (final < 0) {
      simAcc += adv * SPEED;
      while (simAcc >= DT && final < 0) {
        simAcc -= DT; beeman(pst, DT); stepN++;
        trx[tn % TR] = pst[0]; try_[tn % TR] = pst[1]; tn++;
        if (stepN > 20 && (stepN & 7) === 0) { const m = settled(pst[0], pst[1], pst[2], pst[3]); if (m >= 0) { final = m; pulse = 1; } }
        if (stepN >= MAXN) { final = nearest(pst[0], pst[1]); pulse = 1; }
      }
      if (final >= 0 && note && phase === 2) note.textContent = `${NAMES[final]}에 정착 · 예고 ${NAMES[predM]} ${final === predM ? '적중' : '불일치'} (${stepN}스텝)`;
    } else {
      holdT += adv; if (pulse > 0) pulse = Math.max(0, pulse - adv * .9);
      if (holdT > 1.5 && performance.now() > userUntil) autoPick();
      else if (holdT > 30) autoPick();
    }
    draw();
  });
  return () => {
    off_(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
    cv.removeEventListener('pointerdown', pd); cv.removeEventListener('pointermove', pm); cv.removeEventListener('pointerleave', pl);
  };
}
