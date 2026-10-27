// s158 — Gray-Scott 반응확산: 스크롤이 (f,k) 를 옮겨 점 → 줄무늬 → 산호 → 미로로 변태한다.
//   ∂U/∂t = Du∇²U − UV² + f(1−U),  ∂V/∂t = Dv∇²V + UV² − (f+k)V   (Du=0.62, Dv=0.31 — 확산계수를 줄여 무늬 파장을 ×0.8 로 촘촘하게, dt=1, 9점 라플라시안 0.2/0.05/−1)
// 격자 192×108, Float32Array 이중 버퍼(8비트 텍스처 금지 — 무늬 영역이 초승달 모양의 좁은 띠라 양자화하면 패턴이 죽는다).
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 스크롤 경로(웨이포인트): 점(분열) → 줄무늬(벌레) → 산호(지문) → 미로. 사이 구간도 모두 패턴 영역을 지나도록 스윕으로 확정.
export const PATH = [[0.0367, 0.0649], [0.046, 0.063], [0.055, 0.062], [0.035, 0.060]];
export function fkAt(p) {
  const n = PATH.length - 1, q = clamp(p, 0, 1) * n, i = Math.min(n - 1, q | 0), t = q - i;
  return [PATH[i][0] + (PATH[i + 1][0] - PATH[i][0]) * t, PATH[i][1] + (PATH[i + 1][1] - PATH[i][1]) * t];
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const PALS = [
  { bg: hex('#fff0e6'), mid: hex('#ff9aa8'), fg: hex('#c4163f') },   // 점
  { bg: hex('#fff5cf'), mid: hex('#f2b64a'), fg: hex('#a8570c') },   // 줄무늬
  { bg: hex('#d6f3ee'), mid: hex('#ff9d7e'), fg: hex('#e2452b') },   // 산호
  { bg: hex('#ebe5ff'), mid: hex('#8f7bff'), fg: hex('#25176e') }    // 미로
];
export function palAt(p) {
  const q = clamp(p, 0, 1) * 3, i = Math.min(2, q | 0), t = sm(0, 1, q - i), a = PALS[i], b = PALS[i + 1], o = {};
  for (const k of ['bg', 'mid', 'fg']) o[k] = [0, 1, 2].map(c => a[k][c] + (b[k][c] - a[k][c]) * t);
  return o;
}

export class GrayScott {
  constructor(W, H, seed = 5) {
    this.W = W; this.H = H; this.R = 2; this.rw = W * 2; this.rh = H * 2;
    this.U = new Float32Array(W * H); this.V = new Float32Array(W * H);
    this.U2 = new Float32Array(W * H); this.V2 = new Float32Array(W * H);
    this.E = new Float32Array(W * H);
    this.xm = new Int32Array(W); this.xp = new Int32Array(W);
    for (let x = 0; x < W; x++) { this.xm[x] = (x + W - 1) % W; this.xp[x] = (x + 1) % W; }
    this.f = PATH[0][0]; this.k = PATH[0][1]; this.rand = rng(seed);
    this.reset();
  }

  reset() {
    this.U.fill(1); this.V.fill(0);
    for (let n = 0; n < 46; n++) this.drop(8 + this.rand() * (this.W - 16), 8 + this.rand() * (this.H - 16), 2);
  }

  drop(cx, cy, r) {
    const { W, H, U, V, rand } = this, r2 = r * r + 0.5;
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r2) continue;
      const i = ((((cy | 0) + y + H) % H) * W) + (((cx | 0) + x + W) % W);
      U[i] = 0.5; V[i] = 0.25 + (rand() - 0.5) * 0.1;
    }
  }

  step(n) {
    const { W, H, xm, xp, f, k } = this;
    const Du = 0.62, Dv = 0.31, fk = f + k;
    for (let it = 0; it < n; it++) {
      const U = this.U, V = this.V, U2 = this.U2, V2 = this.V2;
      for (let y = 0; y < H; y++) {
        const ym = (y === 0 ? H - 1 : y - 1) * W, y0 = y * W, yp = (y === H - 1 ? 0 : y + 1) * W;
        for (let x = 0; x < W; x++) {
          const a = xm[x], b = xp[x], i = y0 + x, u = U[i], v = V[i];
          const lu = 0.2 * (U[y0 + a] + U[y0 + b] + U[ym + x] + U[yp + x]) + 0.05 * (U[ym + a] + U[ym + b] + U[yp + a] + U[yp + b]) - u;
          const lv = 0.2 * (V[y0 + a] + V[y0 + b] + V[ym + x] + V[yp + x]) + 0.05 * (V[ym + a] + V[ym + b] + V[yp + a] + V[yp + b]) - v;
          const uvv = u * v * v;
          U2[i] = u + Du * lu - uvv + f * (1 - u);
          V2[i] = v + Dv * lv + uvv - fk * v;
        }
      }
      this.U = U2; this.U2 = U; this.V = V2; this.V2 = V;
    }
  }

  mean() { const V = this.V; let s = 0; for (let i = 0; i < V.length; i += 3) s += V[i]; return s / (V.length / 3); }
  healthy() { const V = this.V; for (let i = 0; i < V.length; i += 97) if (!(V[i] === V[i]) || V[i] > 1.5) return false; return true; }

  // V → 2배 해상도 쌍선형 보간 + 3색 램프 + 엠보스(왼쪽 위 광원). fadeX = 왼쪽 가장자리를 배경색으로 녹여 글자 가독성 확보
  render(out, pal, fadeA = 0.2, fadeB = 0.46) {
    const { W, H, V, E, R, rw, rh } = this;
    for (let y = 0; y < H; y++) {
      const ym = y > 0 ? y - 1 : y, yp = y < H - 1 ? y + 1 : y;
      for (let x = 0; x < W; x++) {
        const xl = x > 0 ? x - 1 : x, xr = x < W - 1 ? x + 1 : x;
        E[y * W + x] = (V[yp * W + xr] - V[ym * W + xl]) * 0.75 + (V[yp * W + xl] - V[ym * W + xr]) * 0.25;
      }
    }
    const bg = pal.bg, mid = pal.mid, fg = pal.fg;
    for (let Y = 0; Y < rh; Y++) {
      const fy = (Y + 0.5) / R - 0.5, y0 = Math.floor(fy), wy = fy - y0, ya = clamp(y0, 0, H - 1) * W, yb = clamp(y0 + 1, 0, H - 1) * W;
      for (let X = 0; X < rw; X++) {
        const fx = (X + 0.5) / R - 0.5, x0 = Math.floor(fx), wx = fx - x0, xa = clamp(x0, 0, W - 1), xb = clamp(x0 + 1, 0, W - 1);
        const w00 = (1 - wx) * (1 - wy), w10 = wx * (1 - wy), w01 = (1 - wx) * wy, w11 = wx * wy;
        const v = V[ya + xa] * w00 + V[ya + xb] * w10 + V[yb + xa] * w01 + V[yb + xb] * w11;
        const e = E[ya + xa] * w00 + E[ya + xb] * w10 + E[yb + xa] * w01 + E[yb + xb] * w11;
        const a = sm(0.05, 0.15, v), u = sm(0.15, 0.4, v), t = a;
        let r = mid[0] + (fg[0] - mid[0]) * u, g = mid[1] + (fg[1] - mid[1]) * u, b = mid[2] + (fg[2] - mid[2]) * u;
        r = bg[0] + (r - bg[0]) * a; g = bg[1] + (g - bg[1]) * a; b = bg[2] + (b - bg[2]) * a;
        const sh = 1 + e * 1.5 * t, hl = Math.max(0, e - 0.07) * t * 150;
        r = r * sh + hl; g = g * sh + hl; b = b * sh + hl;
        const m = sm(fadeA, fadeB, X / rw);
        const o = (Y * rw + X) * 4;
        out[o] = bg[0] + (r - bg[0]) * m; out[o + 1] = bg[1] + (g - bg[1]) * m; out[o + 2] = bg[2] + (b - bg[2]) * m; out[o + 3] = 255;
      }
    }
  }
}

export default function init(root, ctx) {
  const stage = root.querySelector('.s158__stage');
  const cv = root.querySelector('.s158__cv');
  const c2d = cv.getContext('2d');
  if (!c2d) { root.classList.add('is-static'); return; }
  const names = [...root.querySelectorAll('.s158__item')];
  const items = [...root.querySelectorAll('.s158__card [data-i]')];
  const thumb = root.querySelector('.s158__thumb');
  const num = root.querySelector('.s158__num');
  const W = 192, H = 108;
  const gs = new GrayScott(W, H);
  cv.width = gs.rw; cv.height = gs.rh;
  const img = c2d.createImageData(gs.rw, gs.rh);
  gs.step(900);                                              // 첫 화면: 이미 자라기 시작한 점들

  let pT = 0, pS = 0, stageI = -1, lastBg = '', vis = true, lastT = 0, acc = 0, clock = 0, drop = 1.2;
  const palRender = () => { const pal = palAt(pS); gs.render(img.data, pal); c2d.putImageData(img, 0, 0); const bgc = `rgb(${pal.bg.map(Math.round).join(',')})`; if (bgc !== lastBg) { root.style.backgroundColor = bgc; lastBg = bgc; } };
  palRender();

  function scrollProgress() {
    const r = root.getBoundingClientRect(), span = r.height - innerHeight;
    return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
  }
  function setStage(i) {
    if (i === stageI) return; stageI = i;
    items.forEach(el => el.classList.toggle('is-on', +el.dataset.i === i));
    names.forEach((el, k) => el.classList.toggle('is-on', k === i));
    if (num) num.textContent = '0' + (i + 1);
  }
  names.forEach((el, k) => el.addEventListener('click', () => {
    const r = root.getBoundingClientRect(), y = scrollY + r.top + (r.height - innerHeight) * (k / 3);
    if (ctx.lenis && ctx.lenis.scrollTo) ctx.lenis.scrollTo(y, { duration: 1.4 }); else scrollTo({ top: y, behavior: 'smooth' });
  }));

  // 포인터: 지나간 자리에 V 를 심는다(새 점/가지가 자란다)
  const P = { x: 0, y: 0, on: false, last: -1e9 };
  const onMove = (e) => {
    const r = cv.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    P.on = x >= 0 && x < W && y >= 0 && y < H; P.x = x; P.y = y; P.last = performance.now();
  };
  const onLeave = () => { P.on = false; };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave);

  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);

  const off = ctx.tick(() => {
    if (!vis || document.hidden) { lastT = 0; return; }
    const now = performance.now(); if (!lastT) lastT = now;
    acc += now - lastT; lastT = now; if (acc < 48) return;
    const dt = Math.min(acc, 200) / 1000; acc = 0; clock += dt;
    const t0 = performance.now();

    pT = scrollProgress();
    pS += (pT - pS) * Math.min(1, dt * 4.5);                 // 스크롤 목표를 부드럽게 추종
    const breathe = 0.018 * Math.sin(clock * 0.55);          // 정지해 있어도 무늬가 숨 쉬듯 미세하게 이동
    const [f, k] = fkAt(clamp(pS + breathe, 0, 1));
    gs.f = f; gs.k = k;
    setStage(Math.min(3, Math.round(pS * 3)));
    if (thumb) thumb.style.setProperty('--p', pS.toFixed(4));

    drop -= dt;
    if (drop <= 0) { drop = 2.4; gs.drop(8 + gs.rand() * (W - 16), 8 + gs.rand() * (H - 16), 2); }   // 주기적 씨앗 — 포화돼도 계속 자란다
    if (P.on && now - P.last < 400) gs.drop(P.x, P.y, 2);

    // 시간 예산(≈18ms) 안에서 가능한 만큼 스텝 — 스크롤이 빠를수록 목표 (f,k) 를 따라잡도록 최소 스텝을 늘린다
    const minSteps = 6 + Math.min(14, Math.abs(pT - pS) * 90 | 0);
    let n = 0; while (n < 30 && (n < minSteps || performance.now() - t0 < 16)) { gs.step(2); n += 2; }
    if (!gs.healthy()) gs.reset();
    else if (gs.mean() < 0.012) { for (let n = 0; n < 10; n++) gs.drop(10 + gs.rand() * (W - 20), 10 + gs.rand() * (H - 20), 3); }
    palRender();
  });

  setStage(0);
  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
    root.style.backgroundColor = '';
  };
}
