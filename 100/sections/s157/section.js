// s157 — Physarum polycephalum (점균류) 수송망 시뮬레이션
// Jones(2010) 에이전트 모델: 감지(3센서) → 회전 → 이동 → 침적, 맵은 3×3 확산 + 감쇠. 먹이(글자 골격점)는 화학유인물질을 방출.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 마스크(W×H, 0/255) → 골격에 가까운 먹이점. 거리변환으로 획 중심선 근처만 후보로 삼고 최소간격 푸아송 샘플링.
export function sampleFood(mask, W, H, minDist, rand) {
  const INF = 1e9, d = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) d[i] = mask[i] > 127 ? INF : 0;
  const R2 = Math.SQRT2;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x; if (!d[i]) continue; let v = d[i];
    if (x > 0) v = Math.min(v, d[i - 1] + 1); if (y > 0) { v = Math.min(v, d[i - W] + 1); if (x > 0) v = Math.min(v, d[i - W - 1] + R2); if (x < W - 1) v = Math.min(v, d[i - W + 1] + R2); }
    d[i] = v;
  }
  for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) {
    const i = y * W + x; if (!d[i]) continue; let v = d[i];
    if (x < W - 1) v = Math.min(v, d[i + 1] + 1); if (y < H - 1) { v = Math.min(v, d[i + W] + 1); if (x < W - 1) v = Math.min(v, d[i + W + 1] + R2); if (x > 0) v = Math.min(v, d[i + W - 1] + R2); }
    d[i] = v;
  }
  let mx = 0; for (let i = 0; i < W * H; i++) if (d[i] < INF && d[i] > mx) mx = d[i];
  const thr = Math.max(1.5, mx * 0.55), cand = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[y * W + x] >= thr && d[y * W + x] < INF) cand.push(y * W + x);
  for (let i = cand.length - 1; i > 0; i--) { const j = (rand() * (i + 1)) | 0; const t = cand[i]; cand[i] = cand[j]; cand[j] = t; }
  const pts = [], m2 = minDist * minDist;
  for (const c of cand) {
    const x = c % W, y = (c / W) | 0; let ok = true;
    for (const p of pts) { const dx = p[0] - x, dy = p[1] - y; if (dx * dx + dy * dy < m2) { ok = false; break; } }
    if (ok) pts.push([x, y]);
  }
  return pts;
}

export class Physarum {
  constructor(W, H, N, seed = 11) {
    this.W = W; this.H = H; this.N = N; this.rand = rng(seed);
    this.t = new Float32Array(W * H); this.tmp = new Float32Array(W * H);
    this.x = new Float32Array(N); this.y = new Float32Array(N); this.hx = new Float32Array(N); this.hy = new Float32Array(N);
    // 프리셋(좁은 창 — 스윕으로 확정): 센서각 40°, 회전 20°, 센서거리 4, 보폭 1, 침적 5(상한 40), 확산 0.2, 감쇠 0.9, 먹이 레벨 80.
    // 침적 상한(cap)이 없으면 양성 피드백으로 에이전트가 굵은 간선 한두 개로 몰려 망이 붕괴한다.
    this.SA = 0.7; this.RA = 0.35; this.SO = 4; this.speed = 1; this.dep = 5; this.dw = 0.2; this.decay = 0.9; this.foodLevel = 80; this.cap = 40;
    this.cSA = Math.cos(this.SA); this.sSA = Math.sin(this.SA); this.cRA = Math.cos(this.RA); this.sRA = Math.sin(this.RA);
    this.food = []; this.frame = 0; this.pulse = 0;
    this.dmap = new Float32Array(W * H).fill(0.9); this.R = 2; this.rw = W * 2; this.rh = H * 2;
    // 렌더 LUT (잉크가 번지는 한지): 배경 → 연한 황토 → 적갈 → 먹
    const stops = [[0, [239, 230, 210]], [0.18, [222, 196, 150]], [0.45, [176, 112, 70]], [0.72, [102, 40, 24]], [1, [46, 16, 12]]];
    this.lut = new Uint8ClampedArray(1024 * 3);
    for (let i = 0; i < 1024; i++) {
      let u = 1 - Math.exp(-i / 105); u = clamp((u - 0.08) / 0.77, 0, 1); u = u * u * (3 - 2 * u); let k = 0; while (k < stops.length - 2 && u > stops[k + 1][0]) k++;
      const a = stops[k], b = stops[k + 1], f = clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
      for (let c = 0; c < 3; c++) this.lut[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * f;
    }
  }

  // 먹이가 바뀌면 감쇠 지도도 갱신: 글자 근처는 천천히, 멀수록 빨리 지워 망이 글자 주변에 모이게 한다
  setFood(pts) {
    this.food = pts.map(p => [p[0], p[1]]);
    const { W, H, dmap, decay } = this;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      let m = 1e9; for (const f of this.food) { const dx = f[0] - i, dy = f[1] - j, d = dx * dx + dy * dy; if (d < m) m = d; }
      const d = Math.sqrt(m), k = clamp((d - 12) / 26, 0, 1);
      dmap[j * W + i] = decay - 0.12 * k * k;
    }
  }

  // 에이전트를 먹이점 근처에서 방사형으로 시작시켜 "자라나는" 느낌을 준다
  inoculate(spread = 2.2) {
    const { N, W, H, rand, food } = this;
    for (let i = 0; i < N; i++) {
      const f = food.length ? food[(rand() * food.length) | 0] : [W / 2, H / 2];
      const a = rand() * 6.2831853, r = rand() * spread;
      this.x[i] = clamp(f[0] + Math.cos(a) * r, 2, W - 3); this.y[i] = clamp(f[1] + Math.sin(a) * r, 2, H - 3);
      const b = rand() * 6.2831853; this.hx[i] = Math.cos(b); this.hy[i] = Math.sin(b);
    }
  }

  step() {
    const { W, H, N, t, tmp, x, y, hx, hy, SO, speed, dep, cSA, sSA, cRA, sRA, rand, cap } = this;
    // 1. 에이전트: 감지 → 회전 → 이동 → 침적
    for (let i = 0; i < N; i++) {
      let ux = hx[i], uy = hy[i];
      const px = x[i], py = y[i];
      const fxs = px + ux * SO, fys = py + uy * SO;
      const lx = ux * cSA - uy * sSA, ly = ux * sSA + uy * cSA;           // +SA
      const rx = ux * cSA + uy * sSA, ry = -ux * sSA + uy * cSA;          // -SA
      const F = this.sample(fxs, fys), L = this.sample(px + lx * SO, py + ly * SO), Rr = this.sample(px + rx * SO, py + ry * SO);
      if (F > L && F > Rr) { /* 직진 */ }
      else if (F < L && F < Rr) { const s = rand() < 0.5 ? 1 : -1; const nx = ux * cRA - s * uy * sRA, ny = s * ux * sRA + uy * cRA; ux = nx; uy = ny; }
      else if (L < Rr) { const nx = ux * cRA + uy * sRA, ny = -ux * sRA + uy * cRA; ux = nx; uy = ny; }   // 오른쪽으로
      else if (Rr < L) { const nx = ux * cRA - uy * sRA, ny = ux * sRA + uy * cRA; ux = nx; uy = ny; }   // 왼쪽으로
      const inv = 1 / Math.sqrt(ux * ux + uy * uy + 1e-12); ux *= inv; uy *= inv;
      let nx = px + ux * speed, ny = py + uy * speed;
      if (nx < 1 || nx > W - 2 || ny < 1 || ny > H - 2) {                 // 벽: 반사 후 임의 방향
        nx = clamp(nx, 1, W - 2); ny = clamp(ny, 1, H - 2);
        const a = rand() * 6.2831853; ux = Math.cos(a); uy = Math.sin(a);
      }
      x[i] = nx; y[i] = ny; hx[i] = ux; hy[i] = uy;
      { const o = ((ny | 0) * W) + (nx | 0); const v = t[o] + dep; t[o] = v > cap ? cap : v; }
    }
    // 2. 먹이 방출(상한 유지)
    const lv = this.foodLevel;
    for (let k = 0; k < this.food.length; k++) {
      const fx = this.food[k][0] | 0, fy = this.food[k][1] | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const o = (fy + dy) * W + fx + dx; if (t[o] < lv) t[o] = lv;
      }
    }
    // 3. 확산(분리형 3×3 평균) + 감쇠
    const dw = this.dw, keep = 1 - dw, dm = this.dmap;
    for (let j = 0; j < H; j++) {
      const r = j * W;
      tmp[r] = (t[r] * 2 + t[r + 1]) / 3;
      for (let i = 1; i < W - 1; i++) tmp[r + i] = (t[r + i - 1] + t[r + i] + t[r + i + 1]) * 0.3333333;
      tmp[r + W - 1] = (t[r + W - 1] * 2 + t[r + W - 2]) / 3;
    }
    for (let j = 0; j < H; j++) {
      const r = j * W, up = j > 0 ? r - W : r, dn = j < H - 1 ? r + W : r;
      for (let i = 0; i < W; i++) t[r + i] = (t[r + i] * keep + (tmp[up + i] + tmp[r + i] + tmp[dn + i]) * 0.3333333 * dw) * dm[r + i];
    }
    this.frame++;
  }

  sample(fx, fy) {
    const W = this.W, H = this.H;
    const ix = fx < 0 ? 0 : fx >= W ? W - 1 : fx | 0, iy = fy < 0 ? 0 : fy >= H ? H - 1 : fy | 0;
    return this.t[iy * W + ix];
  }

  // 커서: feed = 유인원 추가, cut = 해당 반경 트레일을 지움(가위)
  poke(px, py, r, mode) {
    const { W, H, t } = this, r2 = r * r;
    for (let j = Math.max(1, (py - r) | 0); j < Math.min(H - 1, py + r + 1); j++) for (let i = Math.max(1, (px - r) | 0); i < Math.min(W - 1, px + r + 1); i++) {
      const dx = i - px, dy = j - py, d2 = dx * dx + dy * dy; if (d2 > r2) continue;
      const w = 1 - d2 / r2, o = j * W + i;
      if (mode === 'feed') { const v = 36 * w; if (t[o] < v) t[o] = v; } else t[o] *= 1 - 0.85 * w;
    }
  }

  stats() {
    let s = 0; const t = this.t; for (let i = 0; i < t.length; i += 7) s += t[i];
    // 에이전트 분산(한 점으로 뭉쳤는지)
    let mx = 0, my = 0; for (let i = 0; i < this.N; i += 5) { mx += this.x[i]; my += this.y[i]; } const n = this.N / 5; mx /= n; my /= n;
    let v = 0; for (let i = 0; i < this.N; i += 5) { v += (this.x[i] - mx) ** 2 + (this.y[i] - my) ** 2; }
    return { energy: s / (t.length / 7), spread: Math.sqrt(v / n) };
  }

  // 트레일을 2배 해상도로 쌍선형 보간한 뒤 램프를 입힌다(잉크가 번지는 매끈한 선)
  render(out, time = 0) {
    const { W, H, t, lut, rw, rh, R } = this;
    for (let Y = 0; Y < rh; Y++) {
      const fy = (Y + 0.5) / R - 0.5, y0 = Math.floor(fy), wy = fy - y0, ya = clamp(y0, 0, H - 1) * W, yb = clamp(y0 + 1, 0, H - 1) * W;
      for (let X = 0; X < rw; X++) {
        const fx = (X + 0.5) / R - 0.5, x0 = Math.floor(fx), wx = fx - x0, xa = clamp(x0, 0, W - 1), xb = clamp(x0 + 1, 0, W - 1);
        const v = ((t[ya + xa] * (1 - wx) + t[ya + xb] * wx) * (1 - wy) + (t[yb + xa] * (1 - wx) + t[yb + xb] * wx) * wy) * 5;
        const k = (v > 1023 ? 1023 : v | 0) * 3, o = (Y * rw + X) * 4;
        out[o] = lut[k]; out[o + 1] = lut[k + 1]; out[o + 2] = lut[k + 2]; out[o + 3] = 255;
      }
    }
    for (let k = 0; k < this.food.length; k++) {
      const fx = (this.food[k][0] + 0.5) * R, fy = (this.food[k][1] + 0.5) * R, r = (1.7 + 0.55 * Math.sin(time * 2.4 + k * 1.7)) * R;
      const Rr = Math.ceil(r + 2), cx = fx | 0, cy = fy | 0;
      for (let dy = -Rr; dy <= Rr; dy++) for (let dx = -Rr; dx <= Rr; dx++) {
        const d = Math.sqrt((cx + dx - fx) ** 2 + (cy + dy - fy) ** 2), a = clamp(r + 0.8 - d, 0, 1); if (a <= 0) continue;
        const X = cx + dx, Y = cy + dy; if (X < 0 || Y < 0 || X >= rw || Y >= rh) continue;
        const o = (Y * rw + X) * 4;
        out[o] += (229 - out[o]) * a; out[o + 1] += (72 - out[o + 1]) * a; out[o + 2] += (43 - out[o + 2]) * a;
      }
    }
  }
}

const WORDS = ['이음', '국수', '한그릇'];

export default function init(root, ctx) {
  const cv = root.querySelector('.s157__cv');
  const c2d = cv.getContext('2d');
  if (!c2d) { root.classList.add('is-static'); return; }
  const btns = [...root.querySelectorAll('.s157__word')];
  const W = 240, H = 135, N = 5200;
  const sim = new Physarum(W, H, N);
  cv.width = sim.rw; cv.height = sim.rh;
  const img = c2d.createImageData(sim.rw, sim.rh);
  const mc = document.createElement('canvas'); mc.width = W; mc.height = H;
  const m2 = mc.getContext('2d', { willReadFrequently: true });

  let wordIdx = 0, wordT = 0, userLock = false;
  function foodFor(word) {
    m2.clearRect(0, 0, W, H); m2.fillStyle = '#000'; m2.fillRect(0, 0, W, H);
    m2.fillStyle = '#fff'; m2.textAlign = 'center'; m2.textBaseline = 'middle';
    const size = word.length > 2 ? H * 0.46 : H * 0.56;
    m2.font = `900 ${size}px 'Pretendard','Apple SD Gothic Neo','Malgun Gothic',sans-serif`;
    m2.fillText(word, W / 2, H * 0.45 + size * 0.04);
    const d = m2.getImageData(0, 0, W, H).data, mask = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) mask[i] = d[i * 4];
    const pts = sampleFood(mask, W, H, 6.2, sim.rand);
    if (pts.length < 8) { for (let k = 0; k < 28; k++) { const a = k / 28 * 6.2832; pts.push([W / 2 + Math.cos(a) * 34, H * 0.45 + Math.sin(a) * 34]); } }
    return pts;
  }
  function setWord(i, grow) {
    wordIdx = i; wordT = 0;
    sim.setFood(foodFor(WORDS[i]));
    if (grow) sim.inoculate(2.5);
    btns.forEach((b, k) => b.classList.toggle('is-on', k === i));
  }
  btns.forEach((b, k) => b.addEventListener('click', () => { userLock = true; setWord(k, false); }));

  setWord(0, true);
  for (let k = 0; k < 140; k++) sim.step();           // 워밍업: 첫 화면에 이미 자란 망이 보이도록
  sim.render(img.data, 0); c2d.putImageData(img, 0, 0);

  // 포인터: 이동 = 먹이, 누른 채 = 가위(트레일 절단)
  const P = { x: 0, y: 0, on: false, down: false, last: -1e9 };
  const toGrid = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const onMove = (e) => { const g = toGrid(e); P.on = g[0] > 0 && g[0] < W && g[1] > 0 && g[1] < H; P.x = g[0]; P.y = g[1]; P.last = performance.now(); };
  const onDown = (e) => { if (e.target.closest('button')) return; onMove(e); P.down = P.on; };
  const onUp = () => { P.down = false; };
  const onLeave = () => { P.on = false; P.down = false; };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerdown', onDown);
  addEventListener('pointerup', onUp); root.addEventListener('pointerleave', onLeave);

  let vis = true, lastT = 0, acc = 0, steps = 3, clock = 0, since = 0;
  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const SWAP = 26;

  const off = ctx.tick(() => {
    if (!vis || document.hidden) { lastT = 0; return; }
    const now = performance.now(); if (!lastT) lastT = now;
    acc += now - lastT; lastT = now; if (acc < 48) return;
    const dt = Math.min(acc, 200) / 1000; acc = 0; clock += dt; wordT += dt;
    const t0 = performance.now();

    if (!userLock && wordT > SWAP) setWord((wordIdx + 1) % WORDS.length, false);
    // 입력이 없으면 가상 먹이가 글자 사이를 천천히 순회(자동 시나리오)
    const real = P.on && now - P.last < 2500;
    if (real) { sim.poke(P.x, P.y, P.down ? 7 : 4.5, P.down ? 'cut' : 'feed'); }
    else { const a = clock * 0.35; sim.poke(W * (0.5 + 0.3 * Math.sin(a)), H * (0.5 + 0.3 * Math.sin(a * 1.7 + 1)), 3.6, 'feed'); }

    for (let k = 0; k < steps; k++) sim.step();
    since += dt;
    if (since > 1.5) {                                // 자가복구: 소멸·뭉침 감지 시 재접종
      since = 0; const s = sim.stats();
      if (s.energy < 0.6 || s.spread < 12) sim.inoculate(3);
    }
    sim.render(img.data, clock); c2d.putImageData(img, 0, 0);
    const cost = performance.now() - t0;
    if (cost > 34 && steps > 1) steps--; else if (cost < 14 && steps < 4) steps++;
  });

  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerdown', onDown);
    removeEventListener('pointerup', onUp); root.removeEventListener('pointerleave', onLeave);
  };
}
