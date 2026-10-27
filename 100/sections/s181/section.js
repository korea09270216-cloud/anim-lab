// s181 · Mandelbrot 섭동(perturbation) 딥줌 — BigInt 고정소수점 참조 궤도 + double 델타 재귀 + 재기준(rebasing)
// 참조점 c* 의 궤도 Z_m 을 BigInt 고정소수점(F비트, 깊이에 따라 증가)으로 한 번만 계산하고,
// 각 픽셀은 δ = c − c* 만 double 로 들고 ε_{m+1} = 2·Z_m·ε_m + ε_m² + δ 를 돈다(진짜 z = Z_m + ε_m).
// 글리치(|Z_m+ε| < |ε|, 또는 참조 궤도 끝)에서는 ε ← Z_m+ε, m ← 0 으로 재기준(Z_0 = 0, Z_1 = c* 라 식이 그대로 이어진다).
const CRE = '-0.743643889793070846423067202292840421615872243992987118932031';
const CIM = '0.131825899805491085798251503203155290008394120291097009912154';
const SPAN0 = 3.0, BAIL = 1e6;

function parseFixed(s, F) {
  const neg = s[0] === '-'; if (neg) s = s.slice(1);
  const parts = s.split('.'), fp = parts[1] || '';
  let v = (BigInt(parts[0] + fp) << BigInt(F)) / (10n ** BigInt(fp.length));
  return neg ? -v : v;
}
function bitsFor(e) { return Math.max(96, Math.ceil(3.3219 * (e + 3)) + 64); }
function iterFor(e) { return Math.round(500 + 285 * e); }

// 참조 궤도: Z_0=0, Z_{m+1}=Z_m²+c*. |Z|²>4 이면 중단(그 값까지 저장). 반환 len = 저장된 Z 개수
function refOrbit(cr, ci, F, maxN) {
  const f = BigInt(F), four = 4n << f, sc = Math.pow(2, -F);
  const Zr = new Float64Array(maxN + 2), Zi = new Float64Array(maxN + 2);
  let x = 0n, y = 0n, m = 0, esc = false;
  while (m < maxN) {
    const x2 = (x * x) >> f, y2 = (y * y) >> f;
    const xy = (x * y) >> f;
    y = 2n * xy + ci; x = x2 - y2 + cr; m++;
    Zr[m] = Number(x) * sc; Zi[m] = Number(y) * sc;
    if (Zr[m] * Zr[m] + Zi[m] * Zi[m] > 4) { esc = true; break; }
  }
  return { Zr, Zi, len: m + 1, esc, bits: F };
}

// 한 픽셀: δ=(dr,di). 반환 mu(스무스 반복수), 내부면 -1. 통계는 st[0]=재기준 횟수
function pixelMu(dr, di, R, maxIter, st) {
  const Zr = R.Zr, Zi = R.Zi, last = R.len - 1;
  let er = 0, ei = 0, m = 0, n = 0;
  while (n < maxIter) {
    const zr = Zr[m], zi = Zi[m];
    const nr = 2 * (zr * er - zi * ei) + (er * er - ei * ei) + dr;
    const ni = 2 * (zr * ei + zi * er) + 2 * er * ei + di;
    er = nr; ei = ni; m++; n++;
    const wr = Zr[m] + er, wi = Zi[m] + ei, w2 = wr * wr + wi * wi;
    if (w2 > BAIL) return n + 1 - Math.log2(0.5 * Math.log(w2));
    if (w2 < er * er + ei * ei || m >= last) { er = wr; ei = wi; m = 0; st[0]++; }
  }
  return -1;
}

// 패스(해상도 w×h)의 행 구간을 계산해 mu 버퍼에 채운다
function renderRows(P, y0, y1, st) {
  const span = SPAN0 * (P.fov || 1) / Math.pow(10, P.e), w = P.w, h = P.h, ct = Math.cos(P.theta), sn = Math.sin(P.theta), mu = P.mu;
  for (let y = y0; y < y1; y++) {
    const v = (0.5 - (y + 0.5) / h) * span * h / w;
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w - 0.5) * span;
      mu[y * w + x] = pixelMu(u * ct - v * sn, u * sn + v * ct, P.R, P.maxIter, st);
    }
  }
}


// 팔레트: 남색 → 보라 → 분홍 → 호박 → 크림 → 남색 (순환 LUT)
const PAL = (function () {
  const st = [[0, 8, 14, 60], [0.22, 76, 34, 190], [0.46, 232, 64, 124], [0.7, 255, 176, 70], [0.86, 255, 240, 206], [1, 8, 14, 60]], n = 1024, out = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / n; let k = 0; while (k < st.length - 2 && t > st[k + 1][0]) k++;
    const a = st[k], b = st[k + 1], f = (t - a[0]) / (b[0] - a[0]), sm = f * f * (3 - 2 * f);
    out[i] = (255 << 24) | (((a[3] + (b[3] - a[3]) * sm) | 0) << 16) | (((a[2] + (b[2] - a[2]) * sm) | 0) << 8) | ((a[1] + (b[1] - a[1]) * sm) | 0);
  }
  return out;
})();
const INSIDE = (255 << 24) | (16 << 16) | (8 << 8) | 5;

// mu → 색. freq=반복수당 색 주기, phase=색 순환, 이웃 mu 차이로 가벼운 엠보스
function colorize(P, px32, phase) {
  const w = P.w, h = P.h, mu = P.mu, freq = P.freq;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, m = mu[i];
    if (m < 0) { px32[i] = INSIDE; continue; }
    let t = m * freq + phase; t -= Math.floor(t);
    const c = PAL[(t * 1024) | 0];
    const mr = mu[y * w + (x + 1 < w ? x + 1 : x)], mb = mu[(y + 1 < h ? y + 1 : y) * w + x];
    let sh = 1;
    if (mr >= 0 && mb >= 0) { const d = ((mr - m) + (mb - m)) / (m * 0.02 + 6); sh = 1 + (d > 1 ? 1 : d < -1 ? -1 : d) * 0.22; }
    const r = (c & 255) * sh, g = ((c >> 8) & 255) * sh, b = ((c >> 16) & 255) * sh;
    px32[i] = (255 << 24) | ((b > 255 ? 255 : b) << 16) | ((g > 255 ? 255 : g) << 8) | (r > 255 ? 255 : r);
  }
}

// ── 시간표: 정지(정밀화) ↔ 이동(저해상 연속 줌) 구간의 반복. e = log10(zoom)
const RES = [[80, 45], [160, 90], [240, 135], [320, 180]], EMAX = 30;
const moveRes = (e, k) => { const b = e < 6 ? [128, 72] : e < 15 ? [104, 58] : [88, 50]; return [Math.max(40, Math.round(b[0] * k)), Math.max(24, Math.round(b[1] * k))]; };
function buildTimeline() {
  const seg = []; let t = 0, e = 0;
  const add = (d, e1, ease) => { seg.push({ t0: t, t1: t + d, e0: e, e1, ease }); t += d; e = e1; };
  add(0.8, 0, 0);
  for (let k = 0; k < 10; k++) { add(k < 3 ? 2.6 : k < 6 ? 3.1 : 3.6, 3 * (k + 1), 1); add(k < 3 ? 3.2 : 3.9, 3 * (k + 1), 0); }
  add(5, EMAX, 0); add(3.4, 0, 1);
  return { seg, total: t };
}
function eAt(TL, t) {
  t = t % TL.total;
  for (const s of TL.seg) if (t < s.t1) {
    if (!s.ease) return s.e1 === s.e0 ? s.e0 : s.e1;
    const f = (t - s.t0) / (s.t1 - s.t0), g = f < 0.5 ? 4 * f * f * f : 1 - Math.pow(-2 * f + 2, 3) / 2;
    return s.e0 + (s.e1 - s.e0) * g;
  }
  return 0;
}
const thetaOf = e => e * 0.18, freqOf = e => 0.05 - 0.03 * Math.min(1, e / 8);

export default function init(root, ctx) {
  const cv = root.querySelector('.s181__cv');
  const q = k => root.querySelector('[data-k="' + k + '"]');
  const hud = { zoom: q('zoom'), bits: q('bits'), iter: q('iter'), ref: q('ref'), reb: q('reb'), res: q('res'), bar: root.querySelector('.s181__bar i') };
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-static'); return; }
  const CW = 480, CH = 270; cv.width = CW; cv.height = CH;
  const TL = buildTimeline(), now = () => performance.now();
  const S = { mscale: 1, t: 0, e: 0, ref: null, refE: -1, shown: null, work: null, est: 0.08, clock: 0, reb: 0 };
  const store = {};            // 해상도별 오프스크린 캔버스
  function offscreen(w, h) {
    const k = w + 'x' + h;
    if (!store[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); store[k] = { c, x, img: x.createImageData(w, h) }; store[k].px = new Uint32Array(store[k].img.data.buffer); }
    return store[k];
  }
  function ensureRef(eNeed) {
    if (S.refE >= eNeed) return;
    const e = Math.min(EMAX + 0.6, eNeed), F = bitsFor(e), N = iterFor(e) + 10;
    const f = BigInt(F);
    S.ref = refOrbit(parseFixed(CRE, F), parseFixed(CIM, F), F, N); S.refE = e;
  }
  function startPass(w, h, e, idx, fov) {
    const R = S.ref;
    S.work = { P: { w, h, e, fov: fov || 1, theta: thetaOf(e), R, maxIter: iterFor(e), mu: new Float32Array(w * h), freq: freqOf(e) }, y: 0, idx, t0: now(), st: [0] };
  }
  function nextPass(moving, vel) {
    if (moving) { const e = Math.max(0, eAt(TL, S.t + S.est + 0.03)), r = moveRes(e, S.mscale); startPass(r[0], r[1], e, -1, 1.4); return; }
    const sh = S.shown, e = eAt(TL, S.t);
    let idx = 0;
    if (sh && Math.abs(sh.P.e - e) < 1e-6) idx = sh.idx + 1; else if (sh && sh.idx >= 0 && Math.abs(sh.P.e - e) < 0.02) idx = sh.idx + 1;
    if (idx >= RES.length) return;
    startPass(RES[idx][0], RES[idx][1], e, idx);
  }
  function stepWork(budget) {
    const W0 = S.work; if (!W0) return;
    const t0 = now();
    while (W0.y < W0.P.h && now() - t0 < budget) { renderRows(W0.P, W0.y, W0.y + 1, W0.st); W0.y++; }
    if (W0.y >= W0.P.h) {
      const dur = (now() - W0.t0) / 1000; if (W0.idx < 0) { S.est += (Math.min(0.5, dur) - S.est) * 0.3; S.mscale = Math.min(1.5, Math.max(0.55, S.mscale * (dur > 0.22 ? 0.9 : dur < 0.09 ? 1.08 : 1))); }
      S.reb = W0.st[0]; W0.o = offscreen(W0.P.w, W0.P.h); S.shown = W0; S.work = null;
    }
  }
  function draw(phase) {
    const sh = S.shown; if (!sh) return;
    colorize(sh.P, sh.o.px, phase); sh.o.x.putImageData(sh.o.img, 0, 0);
    const k = Math.pow(10, S.e - sh.P.e), dth = thetaOf(S.e) - sh.P.theta;
    g2.setTransform(1, 0, 0, 1, 0, 0); g2.fillStyle = '#05060f'; g2.fillRect(0, 0, CW, CH);
    g2.imageSmoothingEnabled = true;
    g2.translate(CW / 2, CH / 2); g2.rotate(-dth); g2.scale(k * sh.P.fov, k * sh.P.fov);
    g2.drawImage(sh.o.c, -CW / 2, -CH / 2, CW, CH);
  }

  function frame(dt) {
    S.t += dt; S.clock += dt;
    S.e = eAt(TL, S.t);
    const vel = Math.abs(eAt(TL, S.t + 0.1) - S.e) / 0.1, moving = vel > 0.02;
    ensureRef(Math.min(EMAX + 0.6, eAt(TL, S.t + 3.2) + 0.6));
    if (!S.work) nextPass(moving, vel);
    else if (moving && S.work.idx >= 0) { S.work = null; nextPass(true, vel); }   // 이동이 시작되면 정밀 패스는 버리고 저해상으로
    stepWork(moving ? 16 : 30);
    draw(S.clock * 0.035 + (ctx.fine ? (ctx.mouse.nx - 0.5) * 0.25 : 0));
    if (hud.zoom) {
      hud.zoom.textContent = '10^' + S.e.toFixed(1);
      hud.bits.textContent = S.ref.bits + ' bit';
      hud.iter.textContent = iterFor(S.e).toLocaleString('ko-KR');
      hud.ref.textContent = S.ref.len.toLocaleString('ko-KR');
      hud.reb.textContent = S.reb.toLocaleString('ko-KR');
      hud.res.textContent = S.shown ? S.shown.P.w + '×' + S.shown.P.h : '—';
      if (hud.bar) hud.bar.style.transform = 'scaleX(' + (S.e / EMAX).toFixed(3) + ')';
    }
  }

  let acc = 0, visible = true, tabOn = !document.hidden;
  const off = ctx.tick((time, dtms) => {
    if (!visible || !tabOn) return;
    acc += Math.min(0.1, (dtms || 16) / 1000);
    if (acc < 0.05) return;
    const st = acc; acc = 0; frame(st);
  });
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(root);
  const vis = () => { tabOn = !document.hidden; };
  document.addEventListener('visibilitychange', vis);
  ensureRef(3.6);
  startPass(120, 68, 0, -1, 1.4); stepWork(1e9); startPass(RES[0][0], RES[0][1], 0, 0); stepWork(1e9);   // 첫 화면: 즉시 오버뷰 2패스
  frame(0.02);
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
