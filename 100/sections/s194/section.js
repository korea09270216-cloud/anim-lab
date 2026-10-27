// s194 · 이상한 끌개 밀도 — Clifford / de Jong 끌개를 로그 밀도로 누적, Lyapunov 지수로 카오스 파라미터만 골라 이동
// 알고리즘: ① 두 점을 1e-7 간격으로 굴려 Benettin 방식 Lyapunov 지수 추정 + 점유율 검사 → 고정점/주기궤도로 붕괴하는 파라미터 제외
//          ② 검증된 키프레임들 사이를 직선 보간하되 중간 14지점도 같은 검사를 통과한 간선만 사용
//          ③ 256개 워커가 프레임마다 점을 찍어 Float32 히스토그램에 누적(감쇠 → 잔상), log 톤맵 + 속도 기반 2색 램프
const W = 480, H = 270, N = W * H;

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// type 0 = Clifford, 1 = de Jong
function stepXY(type, p, x, y, o) {
  if (type === 0) {
    o[0] = Math.sin(p[0] * y) + p[2] * Math.cos(p[0] * x);
    o[1] = Math.sin(p[1] * x) + p[3] * Math.cos(p[1] * y);
  } else {
    o[0] = Math.sin(p[0] * y) - Math.cos(p[1] * x);
    o[1] = Math.sin(p[2] * x) - Math.cos(p[3] * y);
  }
}

// Lyapunov 지수(반복당) + 점유율 + 경계. 2300 스텝, 앞 300 은 과도 구간
function chaosProbe(type, p, steps) {
  steps = steps || 2300;
  const eps = 1e-7, o = [0, 0];
  let x = 0.1, y = 0.1, x2 = x + eps, y2 = y, sum = 0, n = 0;
  const px = new Float32Array(steps), py = new Float32Array(steps);
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < steps; i++) {
    stepXY(type, p, x, y, o); x = o[0]; y = o[1];
    stepXY(type, p, x2, y2, o); x2 = o[0]; y2 = o[1];
    const dx = x2 - x, dy = y2 - y, d = Math.sqrt(dx * dx + dy * dy);
    if (!(d > 1e-300) || !isFinite(x) || !isFinite(y)) return { lam: -9, cov: 0, w: 0, h: 0 };
    if (i >= 300) {
      sum += Math.log(d / eps); n++;
      px[i] = x; py[i] = y;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    x2 = x + dx * eps / d; y2 = y + dy * eps / d;
  }
  const w = x1 - x0, h = y1 - y0;
  if (w < 0.3 || h < 0.3) return { lam: sum / n, cov: 0, w, h };
  const G = 36, grid = new Uint8Array(G * G); let occ = 0;
  for (let i = 300; i < steps; i++) {
    const gx = Math.min(G - 1, ((px[i] - x0) / w * G) | 0), gy = Math.min(G - 1, ((py[i] - y0) / h * G) | 0);
    if (!grid[gy * G + gx]) { grid[gy * G + gx] = 1; occ++; }
  }
  return { lam: sum / n, cov: occ / (G * G), w, h, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

function randParams(type, rnd) {
  if (type === 0) return [(rnd() * 2 - 1) * 2.4, (rnd() * 2 - 1) * 2.4, (rnd() * 2 - 1) * 1.6, (rnd() * 2 - 1) * 1.6];
  return [(rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3, (rnd() * 2 - 1) * 3];
}
const goodKey = r => r.lam > 0.12 && r.cov > 0.16 && r.w > 1.0 && r.h > 1.0;
const goodMid = r => r.lam > 0.03 && r.cov > 0.07 && r.w > 0.6 && r.h > 0.6;

// 키프레임 사슬. 각 간선의 직선 보간 14지점이 카오스 검사를 통과해야 채택
function buildChain(type, rnd, count) {
  const keys = []; let guard = 0, tested = 0;
  while (keys.length < count && guard++ < 4000) {
    const p = randParams(type, rnd);
    if (keys.length) {
      const q = keys[keys.length - 1].p;
      let far = 0; for (let k = 0; k < 4; k++) far = Math.max(far, Math.abs(p[k] - q[k]));
      if (far > 1.3 || far < 0.35) continue;
    }
    const r = chaosProbe(type, p); tested++;
    if (!goodKey(r)) continue;
    if (keys.length) {
      const q = keys[keys.length - 1].p; let ok = true;
      for (let s = 1; s < 15 && ok; s++) {
        const u = s / 15, m = [0, 0, 0, 0];
        for (let k = 0; k < 4; k++) m[k] = q[k] + (p[k] - q[k]) * u;
        if (!goodMid(chaosProbe(type, m, 900))) ok = false;
      }
      if (!ok) continue;
    }
    keys.push({ p, lam: r.lam, cx: r.cx, cy: r.cy, w: r.w, h: r.h });
  }
  return { keys, tested };
}

function makeSim() {
  return {
    hist: new Float32Array(N), su: new Float32Array(N),
    wx: new Float32Array(256), wy: new Float32Array(256),
    vx: 0, vy: 0, vs: 1, cx: W / 2, cy: H / 2, mx: 8, total: 0, ptsFrame: 0
  };
}

// 워커 256개 × 짧은 스텝 → 히스토그램 누적. 예산(ms) 안에서 슬라이스 단위로 반복
function accumulate(S, type, p, rnd, budgetMs, now) {
  const hist = S.hist, su = S.su, wx = S.wx, wy = S.wy;
  const a = p[0], b = p[1], c = p[2], d = p[3];
  const vs = S.vs, ox = S.cx - S.vx * vs, oy = S.cy - S.vy * vs;
  const t0 = now(); let pts = 0;
  for (;;) {
    for (let w = 0; w < 256; w++) {
      let x = wx[w], y = wy[w];
      for (let k = 0; k < 48; k++) {
        let nx, ny;
        if (type === 0) { nx = Math.sin(a * y) + c * Math.cos(a * x); ny = Math.sin(b * x) + d * Math.cos(b * y); }
        else { nx = Math.sin(a * y) - Math.cos(b * x); ny = Math.sin(c * x) - Math.cos(d * y); }
        const ix = (nx * vs + ox) | 0, iy = (ny * vs + oy) | 0;
        if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
          const dx = nx - x, dy = ny - y, i = iy * W + ix;
          hist[i] += 1; su[i] += Math.sqrt(dx * dx + dy * dy);
        }
        x = nx; y = ny;
      }
      wx[w] = x; wy[w] = y;
    }
    pts += 256 * 48;
    if (now() - t0 > budgetMs) break;
  }
  S.total += pts; S.ptsFrame = pts;
  // 워커가 발산/NaN 이 되면 재시드(유계 맵이라 거의 없음)
  for (let w = 0; w < 256; w++) if (!(Math.abs(wx[w]) < 50 && Math.abs(wy[w]) < 50)) { wx[w] = rnd() * 2 - 1; wy[w] = rnd() * 2 - 1; }
}

function seedWalkers(S, rnd) { for (let w = 0; w < 256; w++) { S.wx[w] = rnd() * 2 - 1; S.wy[w] = rnd() * 2 - 1; } }

// 램프 두 개(차가움/따뜻함)를 속도 u 로 섞는다. bg → 색 → 밝은 크림
function stopsToLut(stops) {
  const out = new Float32Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255; let k = 0;
    while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
    const s0 = stops[k], s1 = stops[k + 1], f = Math.min(1, Math.max(0, (t - s0[0]) / (s1[0] - s0[0])));
    for (let c = 0; c < 3; c++) out[i * 3 + c] = s0[1][c] + (s1[1][c] - s0[1][c]) * f;
  }
  return out;
}
const BG = [22, 46, 196];
const LUT_COOL = stopsToLut([[0, BG], [0.3, [58, 92, 238]], [0.62, [128, 196, 255]], [1, [244, 252, 255]]]);
const LUT_WARM = stopsToLut([[0, BG], [0.3, [150, 70, 210]], [0.62, [255, 134, 150]], [1, [255, 238, 196]]]);

// 로그 톤맵 + 감쇠. u(평균 스텝 속도)로 램프 선택. 다음 프레임 노출용 최대 밀도 EMA 갱신
function tonemap(S, px32, decay) {
  const hist = S.hist, su = S.su;
  const inv = 1 / Math.log(1 + S.mx * 0.5);
  let mx = 0;
  const bg = (255 << 24) | (BG[2] << 16) | (BG[1] << 8) | BG[0];
  for (let i = 0; i < N; i++) {
    const d = hist[i];
    if (d < 0.02) { px32[i] = bg; hist[i] = 0; su[i] = 0; continue; }
    if (d > mx) mx = d;
    let t = Math.log(1 + d * 0.5) * inv; if (t > 1) t = 1;
    t = Math.sqrt(t) * 0.22 + t * 0.78;
    let u = su[i] / d * 0.55; if (u > 1) u = 1;
    const k = ((t * 255) | 0) * 3, v = 1 - u;
    const r = LUT_COOL[k] * v + LUT_WARM[k] * u, g = LUT_COOL[k + 1] * v + LUT_WARM[k + 1] * u, bl = LUT_COOL[k + 2] * v + LUT_WARM[k + 2] * u;
    px32[i] = (255 << 24) | ((bl | 0) << 16) | ((g | 0) << 8) | (r | 0);
    hist[i] = d * decay; su[i] *= decay;
  }
  if (mx > 0) S.mx += (mx - S.mx) * 0.12;
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s194__cv'), hud = {
    lam: root.querySelector('[data-k="lam"]'), pts: root.querySelector('[data-k="pts"]'), kind: root.querySelector('[data-k="kind"]'),
    par: root.querySelector('[data-k="par"]'), bar: root.querySelector('.s194__lam i'), ok: root.querySelector('[data-k="ok"]')
  };
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-static'); return; }
  cv.width = W; cv.height = H;
  const img = g2.createImageData(W, H), px32 = new Uint32Array(img.data.buffer);
  const rnd = rng32(194), S = makeSim();
  S.cx = innerWidth > 900 ? W * 0.66 : W * 0.5;
  seedWalkers(S, rnd);

  const names = ['CLIFFORD', 'DE JONG'];
  let type = 0, chain = buildChain(type, rnd, 5), seg = 0, tSeg = 0, hold = 0;
  let cur = chain.keys[0].p.slice(), lamLive = chain.keys[0].lam, trans = 0;
  let acc = 0, visible = true, tabOn = !document.hidden, last = 0, clock = 0;
  const bias = [0, 0, 0, 0], SEG = 10.5, HOLD = 2.2;
  S.vx = chain.keys[0].cx; S.vy = chain.keys[0].cy; S.vs = Math.min(H, W) / (Math.max(chain.keys[0].w, chain.keys[0].h) * 1.12);
  let tvx = S.vx, tvy = S.vy, tvs = S.vs;

  function nextChapter() {
    type = 1 - type;
    chain = buildChain(type, rnd, 5);
    if (chain.keys.length < 2) { type = 1 - type; chain = buildChain(type, rnd, 5); }
    seg = 0; tSeg = 0; hold = 0; trans = 1.4;
    cur = chain.keys[0].p.slice();
  }
  const ease = u => u * u * (3 - 2 * u);

  function frame(dt) {
    clock += dt;
    // 파라미터 진행: 키프레임에서 HOLD 초 머문 뒤 SEG 초에 걸쳐 다음 키프레임으로
    const A = chain.keys[seg], B = chain.keys[seg + 1];
    if (!B) { nextChapter(); return; }
    if (hold < HOLD) hold += dt; else tSeg += dt / SEG;
    const u = ease(Math.min(1, tSeg));
    for (let k = 0; k < 4; k++) cur[k] = A.p[k] + (B.p[k] - A.p[k]) * u;
    tvx = A.cx + (B.cx - A.cx) * u; tvy = A.cy + (B.cy - A.cy) * u;
    const sA = Math.min(W, H) / (Math.max(A.w, A.h) * 1.12), sB = Math.min(W, H) / (Math.max(B.w, B.h) * 1.12);
    tvs = sA + (sB - sA) * u;
    if (tSeg >= 1) { seg++; tSeg = 0; hold = 0; if (!chain.keys[seg + 1]) { nextChapter(); return; } }
    // 포인터가 닿으면 파라미터에 약한 오프셋(카오스 판정 통과 시에만)
    if (ctx.fine && !ctx.reduced) {
      const tx = (ctx.mouse.nx - 0.5) * 0.10, ty = (ctx.mouse.ny - 0.5) * 0.10;
      bias[0] += (tx - bias[0]) * 0.05; bias[2] += (ty - bias[2]) * 0.05;
    }
    const p = [cur[0] + bias[0], cur[1], cur[2] + bias[2], cur[3]];
    const pr = chaosProbe(type, p, 700);
    lamLive += (pr.lam - lamLive) * 0.25;
    const use = pr.lam > 0.03 ? p : cur;
    // 뷰는 부드럽게 추종
    S.vx += (tvx - S.vx) * 0.06; S.vy += (tvy - S.vy) * 0.06; S.vs += (tvs - S.vs) * 0.06;
    accumulate(S, type, use, rnd, 12, performance.now.bind(performance));
    // 챕터 전환 직후엔 잔상을 빨리 지운다
    const dec = trans > 0 ? 0.72 : 0.935; if (trans > 0) trans -= dt;
    tonemap(S, px32, dec);
    g2.putImageData(img, 0, 0);
    if (hud.lam) {
      hud.lam.textContent = (lamLive >= 0 ? '+' : '') + lamLive.toFixed(3);
      hud.pts.textContent = (S.total / 1e6).toFixed(1) + 'M';
      hud.kind.textContent = names[type];
      hud.par.textContent = cur.map(v => v.toFixed(2)).join(' · ');
      if (hud.bar) hud.bar.style.transform = 'scaleX(' + Math.max(0, Math.min(1, lamLive / 0.6)).toFixed(3) + ')';
      if (hud.ok) hud.ok.textContent = lamLive > 0.03 ? '카오스' : '수축';
    }
  }

  const off = ctx.tick((time, dtms) => {
    if (!visible || !tabOn) return;
    const dt = Math.min(0.1, (dtms || 16) / 1000);
    acc += dt;
    if (acc < 0.048) return;               // ~20fps 캡
    const step = acc; acc = 0;
    frame(step);
  });
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(root);
  const vis = () => { tabOn = !document.hidden; };
  document.addEventListener('visibilitychange', vis);

  frame(0.05); frame(0.05); frame(0.05);       // 첫 화면: 지금 바로 몇 장 누적
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
