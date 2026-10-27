// s183 · Buddhabrot / Nebulabrot — 탈출한 궤적의 모든 점을 +1 해서 쌓는 장노출 성운
// 알고리즘: c 를 균일 난수(시드 고정)로 뽑고 z→z²+c 를 반복. 탈출한 샘플만 궤적의 모든 z 를 픽셀 칸에 가산(켤레 대칭으로 2배),
//          반복 한도 3종(R=900·G=110·B=14)을 채널에 배정 → 한도 안에 탈출한 샘플만 해당 채널에 기록(Nebulabrot)
//          메인 카디오이드/주기2 구근은 해석적으로 제외, 프레임 예산(ms) 안에서 배치를 돌리는 점진 누적, log 톤매핑
const W = 256, H = 296, N = W * H;
const RE0 = -2.1, RE1 = 1.25, IM = 1.45;      // 세로축=실수부, 가로축=허수부(90° 회전해야 앉은 부처)
const LIM = [900, 110, 14];

function rng32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeSim(seed) {
  return { cnt: new Float32Array(N * 3), orb: new Float64Array(LIM[0] * 2 + 4), rs: (seed * 2246822519) | 1, samples: 0, hits: 0, mx: [1, 1, 1], flip: false };
}

// 시간 예산(ms) 안에서 샘플 배치를 반복. 반환=이번에 처리한 샘플 수
function runBatches(S, budgetMs, now) {
  const cnt = S.cnt, orb = S.orb, L0 = LIM[0], L1 = LIM[1], L2 = LIM[2];
  const sy = H / (RE1 - RE0), sx = W / (2 * IM);
  let rs = S.rs, done = 0, hits = 0;
  const t0 = now();
  do {
    for (let b = 0; b < 400; b++) {
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; const u1 = (rs >>> 0) / 4294967296;
      rs ^= rs << 13; rs ^= rs >>> 17; rs ^= rs << 5; const u2 = (rs >>> 0) / 4294967296;
      const cr = RE0 + u1 * (RE1 - RE0), ci = u2 * IM;
      done++;
      // 메인 카디오이드 / 주기 2 구근 = 영원히 안 탈출 → 비용 없이 제외
      const q = (cr - 0.25) * (cr - 0.25) + ci * ci;
      if (q * (q + (cr - 0.25)) < 0.25 * ci * ci) continue;
      if ((cr + 1) * (cr + 1) + ci * ci < 0.0625) continue;
      let zr = 0, zi = 0, n = 0;
      while (n < L0) {
        const zr2 = zr * zr, zi2 = zi * zi;
        if (zr2 + zi2 > 4) break;
        zi = 2 * zr * zi + ci; zr = zr2 - zi2 + cr;
        orb[n * 2] = zr; orb[n * 2 + 1] = zi; n++;
      }
      if (n >= L0) continue;               // 탈출 못 함 → 버림
      hits++;
      const ch = n <= L2 ? 0 : n <= L1 ? 1 : 2;   // 이 샘플이 기록될 채널 집합: ch=0 → R,G,B / 1 → R,G / 2 → R
      for (let i = 1; i < n; i++) {
        const py = ((orb[i * 2] - RE0) * sy) | 0, pxa = ((orb[i * 2 + 1] + IM) * sx) | 0;
        if (py < 0 || py >= H) continue;
        const x1 = pxa, x2 = W - 1 - pxa;
        if (x1 >= 0 && x1 < W) { const k = (py * W + x1) * 3; cnt[k] += 1; if (ch < 2) cnt[k + 1] += 1; if (ch < 1) cnt[k + 2] += 1; }
        if (x2 >= 0 && x2 < W) { const k = (py * W + x2) * 3; cnt[k] += 1; if (ch < 2) cnt[k + 1] += 1; if (ch < 1) cnt[k + 2] += 1; }
      }
    }
  } while (now() - t0 < budgetMs);
  S.rs = rs; S.samples += done; S.hits += hits;
  return done;
}

const LUTN = 4096;
const LUT = [new Float32Array(LUTN + 1), new Float32Array(LUTN + 1), new Float32Array(LUTN + 1)];
const QS = new Float32Array(Math.ceil(N / 7));

// 채널별 레벨 보정(안개 = 하위 분위수, 흰점 = 상위 분위수) → 감마 → 색상환 회전 → 어두운 남색 바탕에 합성
function tonemap(S, px32, hue, gain) {
  const cnt = S.cnt;
  for (let c = 0; c < 3; c++) {
    let m = 0; for (let i = 0, p = c; i < N; i += 7, p += 21) QS[m++] = cnt[p];
    const a = QS.subarray(0, m).sort();
    const lo = a[(m * 0.12) | 0], hi = Math.max(lo + 4, a[(m * 0.997) | 0]);
    S.mx[c] = hi;
    const inv = 1 / (hi - lo);
    for (let v = 0; v <= LUTN; v++) { let x = (v - lo) * inv; x = x < 0 ? 0 : x > 1 ? 1 : x; LUT[c][v] = Math.pow(x, 0.8) * gain; }
  }
  const ch = Math.cos(hue), sh = Math.sin(hue);
  // 휘도 보존 색상환 회전(Rodrigues, 축 (1,1,1)/√3)
  const a = ch + (1 - ch) / 3, b = (1 - ch) / 3 - sh * 0.57735, c = (1 - ch) / 3 + sh * 0.57735;
  const LR = LUT[0], LG = LUT[1], LB = LUT[2];
  for (let i = 0, p = 0; i < N; i++, p += 3) {
    const r0 = cnt[p], g0 = cnt[p + 1], b0 = cnt[p + 2];
    const v0 = LR[r0 > LUTN ? LUTN : r0 | 0], v1 = LG[g0 > LUTN ? LUTN : g0 | 0], v2 = LB[b0 > LUTN ? LUTN : b0 | 0];
    let r = a * v0 + c * v1 + b * v2, g = b * v0 + a * v1 + c * v2, bl = c * v0 + b * v1 + a * v2;
    r = r * 255 + 5; g = g * 255 + 6; bl = bl * 255 + 14;
    px32[i] = (255 << 24) | ((bl > 255 ? 255 : bl < 0 ? 0 : bl | 0) << 16) | ((g > 255 ? 255 : g < 0 ? 0 : g | 0) << 8) | (r > 255 ? 255 : r < 0 ? 0 : r | 0);
  }
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s183__cv');
  const hud = { t: root.querySelector('[data-k="time"]'), n: root.querySelector('[data-k="orb"]'), p: root.querySelector('[data-k="pct"]'), bar: root.querySelector('.s183__prog i'), st: root.querySelector('[data-k="state"]') };
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-static'); return; }
  cv.width = W; cv.height = H;
  const img = g2.createImageData(W, H), px32 = new Uint32Array(img.data.buffer);
  const TARGET = 36e6;                    // 이 샘플 수에서 노출 종료(동결)
  let S = makeSim(183), acc = 0, visible = true, tabOn = !document.hidden, clock = 0, hue = 0, hold = 0, tmap = 0;
  const now = () => performance.now();

  function paint() {
    const p = Math.min(1, S.samples / TARGET), ex = 0.3 + 0.7 * Math.min(1, Math.sqrt(p * 5));   // 노출이 쌓이며 밝아지는 연출
    tonemap(S, px32, hue + (ctx.fine ? (ctx.mouse.nx - 0.5) * 0.9 : 0), ex); g2.putImageData(img, 0, 0);
  }
  function hudUpdate(done) {
    if (!hud.t) return;
    const pct = Math.min(1, S.samples / TARGET), sec = Math.floor(pct * 240);
    hud.t.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    hud.n.textContent = (S.hits / 1e3 | 0).toLocaleString('ko-KR') + 'K';
    hud.p.textContent = Math.round(pct * 100) + '%';
    if (hud.bar) hud.bar.style.transform = 'scaleX(' + pct.toFixed(3) + ')';
    if (hud.st) hud.st.textContent = done ? '노출 완료' : '노출 중';
  }

  function frame(dt) {
    clock += dt;
    const done = S.samples >= TARGET;
    if (!done) runBatches(S, 18, now);
    else { hold += dt; hue += dt * 0.09; if (hold > 16) { S = makeSim(183); hold = 0; hue = 0; } }
    if (!done) hue += dt * 0.012;
    paint(); hudUpdate(done);
  }

  const off = ctx.tick((time, dtms) => {
    if (!visible || !tabOn) return;
    acc += Math.min(0.1, (dtms || 16) / 1000);
    if (acc < 0.05) return;
    const step = acc; acc = 0;
    frame(step);
  });
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0.02 });
  io.observe(root);
  const vis = () => { tabOn = !document.hidden; };
  document.addEventListener('visibilitychange', vis);

  runBatches(S, 220, now); paint(); hudUpdate(false);   // 첫 화면: 0.2초 선노출
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
