// s175 — 이중 진자 + flip-time 지도. 라그랑주 운동방정식 · RK4(고정 dt) · 96² 점진 계산 · 에너지 감시
const G = 9.81, H = 0.005, TMAX = 12, N = 96, PI = Math.PI;
const EPS_E = 1e-6;

// ── 핵심 수치부 (m1=m2=l1=l2=1) ───────────────────────────────────────────
let AX = 0, AY = 0;
function acc(a, b, c, d) {
  const dl = a - b, s = Math.sin(dl), co = Math.cos(dl), den = 3 - Math.cos(2 * dl);
  AX = (-3 * G * Math.sin(a) - G * Math.sin(a - 2 * b) - 2 * s * (d * d + c * c * co)) / den;
  AY = (2 * s * (2 * c * c + 2 * G * Math.cos(a) + d * d * co)) / den;
}
export function step(S, h) {
  const a = S[0], b = S[1], c = S[2], d = S[3], h2 = h * .5;
  acc(a, b, c, d); const k1a = AX, k1b = AY;
  const c2 = c + h2 * k1a, d2 = d + h2 * k1b;
  acc(a + h2 * c, b + h2 * d, c2, d2); const k2a = AX, k2b = AY;
  const c3 = c + h2 * k2a, d3 = d + h2 * k2b;
  acc(a + h2 * c2, b + h2 * d2, c3, d3); const k3a = AX, k3b = AY;
  const c4 = c + h * k3a, d4 = d + h * k3b;
  acc(a + h * c3, b + h * d3, c4, d4); const k4a = AX, k4b = AY;
  S[0] = a + h / 6 * (c + 2 * c2 + 2 * c3 + c4);
  S[1] = b + h / 6 * (d + 2 * d2 + 2 * d3 + d4);
  S[2] = c + h / 6 * (k1a + 2 * k2a + 2 * k3a + k4a);
  S[3] = d + h / 6 * (k1b + 2 * k2b + 2 * k3b + k4b);
}
export const energy = S => S[2] * S[2] + .5 * S[3] * S[3] + S[2] * S[3] * Math.cos(S[0] - S[1]) - G * (2 * Math.cos(S[0]) + Math.cos(S[1]));
// 정지 출발 에너지가 (θ2=π, θ1=0) 의 위치에너지 -g 보다 낮으면 바깥 팔은 절대 못 뒤집는다 → 시뮬 생략(정확한 해석 경계)
export function flipTime(t1, t2) {
  const S = new Float64Array([t1, t2, 0, 0]);
  if (energy(S) < -G - EPS_E) return -1;
  const n = (TMAX / H) | 0;
  for (let k = 1; k <= n; k++) { step(S, H); if (S[1] > PI || S[1] < -PI) return k * H; }
  return Infinity;
}
const px2ang = (i, N_) => -PI + (i + .5) / N_ * 2 * PI;

// ── 컬러맵 ───────────────────────────────────────────────────────────────
const STOPS = [[0, 11, 16, 48], [.22, 74, 22, 122], [.45, 196, 40, 112], [.66, 255, 112, 32], [.84, 255, 206, 64], [1, 255, 244, 200]];
const LUT = new Uint8Array(256 * 3);
for (let k = 0; k < 256; k++) {
  const f = k / 255; let i = 0; while (i < STOPS.length - 2 && f > STOPS[i + 1][0]) i++;
  const A = STOPS[i], B = STOPS[i + 1], u = Math.max(0, Math.min(1, (f - A[0]) / (B[0] - A[0])));
  for (let c = 0; c < 3; c++) LUT[k * 3 + c] = A[1 + c] + (B[1 + c] - A[1 + c]) * u;
}
const lutIdx = t => Math.max(0, Math.min(255, Math.round(255 * Math.log(1 + t / .35) / Math.log(1 + TMAX / .35))));
const NEVER = [214, 226, 218], NOFLIP = [244, 241, 232];

const CACHE_KEY = 's175-map-v2';
let MEM = null; // 모듈 수준 캐시 (같은 페이지에서 재마운트 시 즉시 재사용)

function loadCache() {
  if (MEM) return MEM;
  try {
    const raw = localStorage.getItem(CACHE_KEY); if (!raw) return null;
    const bin = atob(raw); if (bin.length !== N * N * 2) return null;
    const u = new Uint16Array(N * N); for (let k = 0; k < N * N; k++) u[k] = bin.charCodeAt(2 * k) | (bin.charCodeAt(2 * k + 1) << 8);
    const m = new Float32Array(N * N); for (let k = 0; k < N * N; k++) m[k] = u[k] === 0 ? -1 : u[k] === 65535 ? Infinity : u[k] / 1000 - .001;
    return (MEM = m);
  } catch (e) { return null; }
}
function saveCache(m) {
  MEM = m;
  try {
    let s = ''; for (let k = 0; k < N * N; k++) { const v = m[k] < 0 ? 0 : m[k] === Infinity ? 65535 : Math.min(65534, Math.round((m[k] + .001) * 1000)); s += String.fromCharCode(v & 255, v >> 8); }
    localStorage.setItem(CACHE_KEY, btoa(s));
  } catch (e) { /* 저장 불가 환경은 무시 */ }
}

export default function init(root, ctx) {
  const sim = root.querySelector('.s175__sim'), map = root.querySelector('.s175__map');
  const sc = sim.getContext('2d'), mc = map.getContext('2d');
  const out = { pred: root.querySelector('[data-r=pred]'), now: root.querySelector('[data-r=now]'), err: root.querySelector('[data-r=err]') };
  if (!sc || !mc) return;

  // ── 지도 (오프스크린 96²) ──
  const off = document.createElement('canvas'); off.width = off.height = N;
  const oc = off.getContext('2d'), img = oc.createImageData(N, N);
  for (let k = 0; k < N * N; k++) { img.data[k * 4] = 232; img.data[k * 4 + 1] = 228; img.data[k * 4 + 2] = 214; img.data[k * 4 + 3] = 255; }
  let flips = new Float32Array(N * N), done = 0, mapReady = false;
  // 거칠게 → 촘촘하게: 8, 4, 2, 1 간격 순으로 처리 순서를 만든다
  const order = []; {
    const seen = new Uint8Array(N * N);
    for (const s of [8, 4, 2, 1]) for (let r = 0; r < N; r += s) for (let i = 0; i < N; i += s) { const k = r * N + i; if (!seen[k]) { seen[k] = 1; order.push(k | (s << 16)); } }
  }
  const paint = (k, s) => {
    const f = flips[k], i = k % N, r = (k / N) | 0; let rgb;
    if (f < 0) rgb = NEVER; else if (f === Infinity) rgb = NOFLIP; else { const li = lutIdx(f) * 3; rgb = [LUT[li], LUT[li + 1], LUT[li + 2]]; }
    for (let y = r; y < Math.min(N, r + s); y++) for (let x = i; x < Math.min(N, i + s); x++) {
      const o = (y * N + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2];
    }
  };
  const cached = loadCache();
  if (cached) { flips = cached; for (let k = 0; k < N * N; k++) paint(k, 1); done = order.length; mapReady = true; oc.putImageData(img, 0, 0); }
  const computeSlice = budgetMs => {
    const t0 = performance.now();
    while (done < order.length && performance.now() - t0 < budgetMs) {
      const e = order[done++], k = e & 0xffff, s = e >> 16;
      const i = k % N, r = (k / N) | 0;
      flips[k] = flipTime(px2ang(i, N), PI - (r + .5) / N * 2 * PI);
      paint(k, s);
    }
    oc.putImageData(img, 0, 0);
    if (done >= order.length && !mapReady) { mapReady = true; saveCache(flips); }
  };
  const lookup = (t1, t2) => {
    const i = Math.max(0, Math.min(N - 1, Math.floor((t1 + PI) / (2 * PI) * N)));
    const r = Math.max(0, Math.min(N - 1, Math.floor((PI - t2) / (2 * PI) * N)));
    return flips[r * N + i];
  };

  // ── 라이브 진자 ──
  const S = new Float64Array(4), Sg = new Float64Array(4);
  let E0 = 1, simT = 0, accT = 0, pred = null, init0 = [2.2, 2.7], flipAt = -1, flash = 0, lastErr = 0;
  const TR = 420, tx = new Float32Array(TR), ty = new Float32Array(TR), gx = new Float32Array(TR), gy = new Float32Array(TR);
  let tn = 0, mark = { a: init0[0], b: init0[1] }, userUntil = 0, autoAt = 0, rnd = 12345;
  const rand = () => (rnd = (rnd * 1664525 + 1013904223) >>> 0) / 4294967296;
  // 지도의 한 칸 = 칸 중심에서 출발한 하나의 시뮬 → 출발점을 칸 중심으로 맞춰야 예측과 실측이 정확히 같은 시뮬이 된다
  const snap = (t1, t2) => [px2ang(Math.max(0, Math.min(N - 1, Math.floor((t1 + PI) / (2 * PI) * N))), N), PI - (Math.max(0, Math.min(N - 1, Math.floor((PI - t2) / (2 * PI) * N))) + .5) / N * 2 * PI];
  function restart(a, b) {
    const [t1, t2] = snap(a, b);
    S[0] = Sg[0] = t1; S[1] = t2; Sg[1] = t2; S[2] = S[3] = Sg[2] = Sg[3] = 0; Sg[0] = t1 + 1e-4; // ghost: 0.0001 rad
    E0 = energy(S); simT = 0; accT = 0; tn = 0; flipAt = -1; flash = 0; lastErr = 0; mark = { a: t1, b: t2 };
    const f = mapReady ? lookup(t1, t2) : null; pred = f;
    out.pred.textContent = f === null ? '계산 중' : f < 0 ? '뒤집히지 않음' : f === Infinity ? TMAX + '초 이상' : f.toFixed(2) + '초';
  }
  restart(init0[0], init0[1]);
  const pickAuto = () => {
    for (let n = 0; n < 60; n++) {
      const t1 = (rand() * 2 - 1) * PI * .92, t2 = (rand() * 2 - 1) * PI * .92, f = mapReady ? lookup(...snap(t1, t2)) : 3;
      if (f > 1.4 && f < 8) { restart(t1, t2); return; }
    }
    restart((rand() * 2 - 1) * 2.6, (rand() * 2 - 1) * 2.6);
  };

  // ── 그리기 ──
  const C = 220, L = 90;
  function drawSim() {
    sc.clearRect(0, 0, 440, 440);
    sc.fillStyle = '#fbfaf5'; sc.fillRect(0, 0, 440, 440);
    // 눈금: 도달 반경과 '뒤집힘선'(위)
    sc.strokeStyle = '#14213d18'; sc.lineWidth = 1; sc.beginPath(); sc.arc(C, C, 2 * L, 0, 2 * PI); sc.stroke();
    sc.beginPath(); sc.arc(C, C, L, 0, 2 * PI); sc.stroke();
    sc.strokeStyle = '#ff6b2c88'; sc.setLineDash([4, 5]); sc.beginPath(); sc.moveTo(C, C - 2 * L - 16); sc.lineTo(C, C - 2 * L + 8); sc.stroke(); sc.setLineDash([]);
    sc.fillStyle = '#ff6b2c'; sc.font = '700 12px Pretendard, sans-serif'; sc.textAlign = 'center'; sc.fillText('뒤집힘선', C, C - 2 * L - 22);
    // 궤적 (유령 → 본체)
    const trail = (xs, ys, rgb, w) => {
      const n = Math.min(tn, TR); if (n < 2) return;
      for (let g = 0; g < n - 1; g += 6) {
        const e = Math.min(n - 1, g + 7), u = g / n;
        sc.strokeStyle = `rgba(${rgb},${(.1 + .85 * u * u).toFixed(3)})`; sc.lineWidth = w * (.5 + 1 * u);
        sc.beginPath(); const i0 = (tn - n + g) % TR; sc.moveTo(xs[i0], ys[i0]);
        for (let q = g + 1; q <= e; q++) { const ii = (tn - n + q) % TR; sc.lineTo(xs[ii], ys[ii]); }
        sc.stroke();
      }
    };
    sc.lineCap = 'round'; sc.lineJoin = 'round';
    trail(gx, gy, '255,107,44', 2); trail(tx, ty, '20,33,61', 2.4);
    const arm = (s, col, fill, r2) => {
      const x1 = C + L * Math.sin(s[0]), y1 = C + L * Math.cos(s[0]), x2 = x1 + L * Math.sin(s[1]), y2 = y1 + L * Math.cos(s[1]);
      sc.strokeStyle = col; sc.lineWidth = 3; sc.beginPath(); sc.moveTo(C, C); sc.lineTo(x1, y1); sc.lineTo(x2, y2); sc.stroke();
      sc.fillStyle = fill; sc.beginPath(); sc.arc(x1, y1, 9, 0, 2 * PI); sc.fill(); sc.beginPath(); sc.arc(x2, y2, r2, 0, 2 * PI); sc.fill();
      return [x2, y2];
    };
    arm(Sg, '#ff6b2c88', '#ff6b2c', 8);
    const [bx, by] = arm(S, '#14213d', '#14213d', 11);
    sc.fillStyle = '#fbfaf5'; sc.beginPath(); sc.arc(bx - 3, by - 3, 3, 0, 2 * PI); sc.fill();
    sc.fillStyle = '#14213d'; sc.beginPath(); sc.arc(C, C, 6, 0, 2 * PI); sc.fill();
    if (flash > 0) { sc.strokeStyle = `rgba(255,107,44,${flash})`; sc.lineWidth = 3; sc.beginPath(); sc.arc(bx, by, 14 + (1 - flash) * 46, 0, 2 * PI); sc.stroke(); sc.fillStyle = `rgba(255,107,44,${Math.min(1, flash * 1.6)})`; sc.font = '800 16px Pretendard, sans-serif'; sc.fillText('뒤집혔다!', bx, by - 26); }
  }
  let hover = null;
  const MS = 480;
  function drawMap() {
    mc.imageSmoothingEnabled = true; mc.imageSmoothingQuality = 'high';
    mc.drawImage(off, 0, 0, MS, MS);
    // 해석 경계: -2cosθ1 - cosθ2 = -1 (그 안은 바깥 팔이 절대 못 뒤집는 구역)
    mc.strokeStyle = '#14213dcc'; mc.lineWidth = 1.4; mc.setLineDash([5, 4]); mc.beginPath();
    const X = a => (a + PI) / (2 * PI) * MS, Y = b => (PI - b) / (2 * PI) * MS;
    const bd = th1 => Math.acos(Math.max(-1, Math.min(1, 1 - 2 * Math.cos(th1))));
    for (let q = 0; q <= 90; q++) { const th1 = -PI / 2 + PI * q / 90; q ? mc.lineTo(X(th1), Y(bd(th1))) : mc.moveTo(X(th1), Y(bd(th1))); }
    for (let q = 90; q >= 0; q--) { const th1 = -PI / 2 + PI * q / 90; mc.lineTo(X(th1), Y(-bd(th1))); }
    mc.closePath(); mc.stroke(); mc.setLineDash([]);
    // 축
    mc.fillStyle = '#14213d'; mc.font = '700 11px Pretendard, sans-serif'; mc.textAlign = 'left';
    mc.fillText('θ₂ ↑', 8, 16); mc.textAlign = 'right'; mc.fillText('θ₁ →', MS - 8, MS - 8);
    // 진행률
    if (!mapReady) { mc.fillStyle = '#14213d'; mc.fillRect(0, MS - 5, MS * done / order.length, 5); }
    // 현재 출발점
    const mx = X(mark.a), my = Y(mark.b);
    mc.strokeStyle = '#fff'; mc.lineWidth = 4; mc.beginPath(); mc.arc(mx, my, 9, 0, 2 * PI); mc.stroke();
    mc.strokeStyle = '#14213d'; mc.lineWidth = 2; mc.beginPath(); mc.arc(mx, my, 9, 0, 2 * PI); mc.moveTo(mx - 15, my); mc.lineTo(mx + 15, my); mc.moveTo(mx, my - 15); mc.lineTo(mx, my + 15); mc.stroke();
    if (hover) {
      const f = mapReady ? lookup(hover.a, hover.b) : 0, s = !mapReady ? '계산 중' : f < 0 ? '뒤집히지 않음' : f === Infinity ? '12초 이상' : f.toFixed(1) + '초 후 뒤집힘';
      mc.font = '800 12px Pretendard, sans-serif'; const w = mc.measureText(s).width + 18;
      const hx = Math.min(MS - w - 4, Math.max(4, X(hover.a) + 12)), hy = Math.max(26, Y(hover.b) - 14);
      mc.fillStyle = '#14213d'; mc.fillRect(hx, hy - 18, w, 24); mc.fillStyle = '#fff'; mc.textAlign = 'left'; mc.fillText(s, hx + 9, hy - 2);
    }
  }

  // ── 입력 ──
  let down = false;
  const toAng = e => {
    const r = map.getBoundingClientRect();
    return { a: Math.max(-PI * .995, Math.min(PI * .995, ((e.clientX - r.left) / r.width * 2 - 1) * PI)), b: Math.max(-PI * .995, Math.min(PI * .995, (1 - (e.clientY - r.top) / r.height * 2) * PI)) };
  };
  const pd = e => { down = true; map.setPointerCapture && map.setPointerCapture(e.pointerId); const p = toAng(e); userUntil = performance.now() + 14000; restart(p.a, p.b); };
  const pm = e => { const p = toAng(e); hover = p; if (down) { userUntil = performance.now() + 14000; restart(p.a, p.b); } };
  const pu = () => { down = false; };
  const pl = () => { hover = null; down = false; };
  map.addEventListener('pointerdown', pd); map.addEventListener('pointermove', pm); map.addEventListener('pointerup', pu); map.addEventListener('pointerleave', pl);

  // ── 루프 ──
  let vis = true, tabVis = !document.hidden, lastT = performance.now(), frameAcc = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabVis = !document.hidden; lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const FRAME = 1 / 24;
  const off_ = ctx.tick(() => {
    if (done < order.length && tabVis) computeSlice(14); // 지도 계산은 화면 밖에서도 예산 안에서 미리 진행
    if (!vis || !tabVis) return;
    const now = performance.now(); let dt = Math.min(.1, (now - lastT) / 1000); lastT = now; frameAcc += dt;
    if (frameAcc < FRAME) return;
    const adv = Math.min(frameAcc, .12); frameAcc = 0;
    // 고정 dt 누적 적분 (지도와 같은 H · 같은 연산 순서 → 예측과 실측이 같은 값)
    accT += adv;
    while (accT >= H) {
      accT -= H; step(S, H); step(Sg, H); simT += H;
      if (flipAt < 0 && (S[1] > PI || S[1] < -PI)) { flipAt = simT; flash = 1; }
    }
    const k = tn % TR;
    tx[k] = C + L * Math.sin(S[0]) + L * Math.sin(S[1]); ty[k] = C + L * Math.cos(S[0]) + L * Math.cos(S[1]);
    gx[k] = C + L * Math.sin(Sg[0]) + L * Math.sin(Sg[1]); gy[k] = C + L * Math.cos(Sg[0]) + L * Math.cos(Sg[1]); tn++;
    lastErr = Math.abs((energy(S) - E0) / Math.max(1, Math.abs(E0)));
    if (flash > 0) flash = Math.max(0, flash - adv * 1.2);
    out.now.textContent = (flipAt >= 0 ? flipAt : simT).toFixed(2) + '초' + (flipAt >= 0 ? ' · 뒤집힘' : '');
    out.err.textContent = lastErr < 1e-12 ? '< 1e-12' : lastErr.toExponential(1);
    // 자동 시나리오: 사용자가 만지지 않으면 지도에서 흥미로운 출발점을 골라 반복
    const tnow = performance.now();
    if (tnow > userUntil && (simT > 13 || (flipAt >= 0 && simT > flipAt + 3.2) || (pred !== null && pred < 0 && simT > 6) || (pred !== null && pred === Infinity && simT > 12))) pickAuto();
    else if (simT > 24 || lastErr > 5e-3) restart(mark.a, mark.b);
    if (pred === null && mapReady) { pred = lookup(mark.a, mark.b); out.pred.textContent = pred < 0 ? '뒤집히지 않음' : pred === Infinity ? TMAX + '초 이상' : pred.toFixed(2) + '초'; }
    drawSim(); drawMap();
  });
  return () => {
    off_(); io.disconnect(); document.removeEventListener('visibilitychange', onVis);
    map.removeEventListener('pointerdown', pd); map.removeEventListener('pointermove', pm); map.removeEventListener('pointerup', pu); map.removeEventListener('pointerleave', pl);
  };
}
