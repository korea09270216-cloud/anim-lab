// s160 — 호리병 속 다재료 낙사: Margolus 2×2 블록 셀룰러 오토마타(질량 보존, 교환만 한다)
// 병이 돌면 중력 방향이 g=(sinθ, cosθ) 로 회전한다. 격자는 병 좌표계에 고정하고, 블록마다 확률적으로 "중력 축"(±x/±y)을 고른 뒤
// 블록을 그 축이 아래가 되게 회전해 같은 낙하 규칙을 적용한다 → 임의 각도 중력이 4방향 규칙의 시간평균으로 나온다.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const MAT = { EMPTY: 0, GLASS: 1, SALT: 2, CHILI: 3, SOY: 4, OIL: 5, CORK: 6, VOID: 7 };
// 밀도(무거울수록 아래), 이동 가능, 액체 여부
const DENS = new Float32Array([0, 99, 4.2, 3.2, 2, 1, 99, 99]);
const MOV = new Uint8Array([1, 0, 1, 1, 1, 1, 0, 0]);
const LIQ = new Uint8Array([0, 0, 0, 0, 1, 1, 0, 0]);
const POW = new Uint8Array([0, 0, 1, 1, 0, 0, 0, 0]);
// 낙하 교환 확률 [위][아래]: 빈칸 1, 가루→액체 0.55(침강이 느림), 액체↔액체 0.5, 가루↔가루 0.4
const PF = new Float32Array(64);
for (let a = 0; a < 8; a++) for (let b = 0; b < 8; b++) {
  PF[a * 8 + b] = b === 0 ? 1 : (POW[a] && LIQ[b]) ? 0.55 : (LIQ[a] && LIQ[b]) ? 0.5 : (POW[a] && POW[b]) ? 0.4 : 0.5;
}
const P_SLIDE = new Float32Array([0, 0, 0.5, 0.42, 0.95, 0.95, 0, 0]);   // 대각 미끄러짐(모래 안식각 ↔ 액체)
const P_LAT = 0.8;                                                        // 액체 가로 확산
// 중력 축별 블록 인덱스 매핑: [t0,t1,b0,b1] 에 대응하는 [TL,TR,BL,BR] 인덱스
const MAPS = [[0, 1, 2, 3], [2, 3, 0, 1], [0, 2, 1, 3], [1, 3, 0, 2]];     // 아래, 위, 오른쪽, 왼쪽

export class SandBottle {
  constructor(N = 160, seed = 9) {
    this.N = N; this.c = new Uint8Array(N * N); this.mask = new Uint8Array(N * N); this.rs = (seed * 2654435761) >>> 0 || 1;
    this.phase = 0; this.build(); this.fill();
  }
  rnd() { let x = this.rs; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; this.rs = x; return x / 4294967296; }

  // 호리병 마스크: 두 원의 부드러운 합집합(smooth-min) → 잘록한 목
  build() {
    const N = this.N, cx = N / 2, mask = this.mask, c = this.c;
    const lx = cx, ly = cx + 34, lr = 38, ux = cx, uy = cx - 36, ur = 28, k = 10;
    const sd = (x, y) => {
      const a = Math.hypot(x - lx, y - ly) - lr, b = Math.hypot(x - ux, y - uy) - ur;
      const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25;
    };
    this.sd = sd;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) mask[y * N + x] = sd(x + 0.5, y + 0.5) < 0 ? 1 : 0;
    // 병 바깥 = VOID, 유리벽 = 안쪽 경계에서 2.4 이내, 코르크 = 위쪽 마개
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x; if (mask[i]) { c[i] = MAT.EMPTY; continue; }
      const d = sd(x + 0.5, y + 0.5);
      c[i] = d < 2.6 ? MAT.GLASS : MAT.VOID;
    }
    for (let y = uy - ur - 9; y <= uy - ur + 1; y++) for (let x = cx - 7; x <= cx + 7; x++) { const i = y * N + x; if (c[i] !== MAT.EMPTY) c[i] = MAT.CORK; }
    this.interior = mask;
  }

  // 아래(큰 구)에서부터 소금 → 고춧가루 → 간장 → 참기름 순으로 층층이 채움
  fill() {
    const N = this.N, c = this.c, order = [[MAT.SALT, 560], [MAT.CHILI, 380], [MAT.SOY, 520], [MAT.OIL, 340]];
    let oi = 0, left = order[0][1];
    for (let y = N - 1; y >= 0 && oi < order.length; y--) for (let x = 0; x < N && oi < order.length; x++) {
      const i = y * N + x; if (c[i] !== MAT.EMPTY || !this.interior[i]) continue;
      c[i] = order[oi][0] | (((this.rnd() * 31) | 0) << 3);
      if (--left === 0) { oi++; if (oi < order.length) left = order[oi][1]; }
    }
  }

  count(m) { const c = this.c; let n = 0; for (let i = 0; i < c.length; i++) if ((c[i] & 7) === m) n++; return n; }

  // 반 스텝: 블록 분할 오프셋 (ox,oy), 중력 g (병 좌표계)
  half(ox, oy, gx, gy) {
    const N = this.N, c = this.c, ax = Math.abs(gx), ay = Math.abs(gy), pv = ay / (ax + ay + 1e-9);
    const dirV = gy > 0 ? 0 : 1, dirH = gx > 0 ? 2 : 3;
    const idx = [0, 0, 0, 0];
    for (let y = oy; y < N - 1; y += 2) {
      for (let x = ox; x < N - 1; x += 2) {
        const i0 = y * N + x;
        if ((c[i0] | c[i0 + 1] | c[i0 + N] | c[i0 + N + 1]) === 0) continue;
        idx[0] = i0; idx[1] = i0 + 1; idx[2] = i0 + N; idx[3] = i0 + N + 1;
        const m = MAPS[this.rnd() < pv ? dirV : dirH];
        const ti0 = idx[m[0]], ti1 = idx[m[1]], bi0 = idx[m[2]], bi1 = idx[m[3]];
        let t0 = c[ti0], t1 = c[ti1], b0 = c[bi0], b1 = c[bi1], tmp;
        let T0 = t0 & 7, T1 = t1 & 7, B0 = b0 & 7, B1 = b1 & 7;
        // ① 낙하(밀도 정렬): 열마다 위가 더 무거우면 교환
        if (MOV[T0] && MOV[B0] && DENS[T0] > DENS[B0] && this.rnd() < PF[T0 * 8 + B0]) { tmp = t0; t0 = b0; b0 = tmp; T0 = t0 & 7; B0 = b0 & 7; }
        if (MOV[T1] && MOV[B1] && DENS[T1] > DENS[B1] && this.rnd() < PF[T1 * 8 + B1]) { tmp = t1; t1 = b1; b1 = tmp; T1 = t1 & 7; B1 = b1 & 7; }
        // ② 대각 미끄러짐: 바로 아래가 막혀 있고 대각 아래가 더 가벼우면 비스듬히 이동(순서 무작위)
        const flip = this.rnd() < 0.5;
        for (let s = 0; s < 2; s++) {
          if ((s === 0) === flip) {
            if (MOV[T0] && MOV[B1] && DENS[T0] > DENS[B1] && !(MOV[B0] && DENS[T0] > DENS[B0]) && this.rnd() < P_SLIDE[T0]) { tmp = t0; t0 = b1; b1 = tmp; T0 = t0 & 7; B1 = b1 & 7; }
          } else {
            if (MOV[T1] && MOV[B0] && DENS[T1] > DENS[B0] && !(MOV[B1] && DENS[T1] > DENS[B1]) && this.rnd() < P_SLIDE[T1]) { tmp = t1; t1 = b0; b0 = tmp; T1 = t1 & 7; B0 = b0 & 7; }
          }
        }
        // ③ 액체 가로 확산: 아래 줄 우선, 받쳐진 윗줄은 약하게
        if (MOV[B0] && MOV[B1] && B0 !== B1 && ((LIQ[B0] && DENS[B0] > DENS[B1]) || (LIQ[B1] && DENS[B1] > DENS[B0])) && this.rnd() < P_LAT) { tmp = b0; b0 = b1; b1 = tmp; }
        else if (T0 !== T1 && MOV[T0] && MOV[T1] && ((LIQ[T0] && DENS[T0] > DENS[T1]) || (LIQ[T1] && DENS[T1] > DENS[T0])) && B0 !== 0 && B1 !== 0 && this.rnd() < 0.4) { tmp = t0; t0 = t1; t1 = tmp; }
        c[ti0] = t0; c[ti1] = t1; c[bi0] = b0; c[bi1] = b1;
      }
    }
  }

  // Margolus 분할 (0,0) ↔ (1,1) 교번 — 낙하가 매 스텝 1칸씩 전파된다
  step(gx, gy) {
    const ph = this.phase++ & 1;
    this.half(ph, ph, gx, gy);
  }
}

const COL = {
  salt: [[246, 244, 236], [226, 228, 232], [255, 255, 250]],
  chili: [[196, 36, 22], [226, 62, 28], [150, 22, 16]],
  soy: [[70, 38, 20], [52, 28, 14], [96, 56, 30]],
  oil: [[236, 172, 30], [248, 196, 52], [214, 150, 20]]
};

export default function init(root, ctx) {
  const cv = root.querySelector('.s160__cv');
  const c2d = cv.getContext('2d');
  if (!c2d) { root.classList.add('is-static'); return; }
  const flipBtn = root.querySelector('.s160__flip');
  const N = 160, B = new SandBottle(N);
  const off = document.createElement('canvas'); off.width = N; off.height = N;
  const o2d = off.getContext('2d'); const img = o2d.createImageData(N, N); const px = img.data;
  const SIZE = 720; cv.width = SIZE; cv.height = SIZE;

  let theta = 0, thetaT = 0, vis = true, lastT = 0, acc = 0, clock = 0, since = 1.2, drag = null, lastTouch = -1e9, steps = 8;

  function renderLattice(gx, gy) {
    const c = B.c, ox = Math.round(-gx), oy = Math.round(-gy);          // 중력 반대 방향 이웃 = 위(표면 판정)
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = y * N + x, v = c[i], m = v & 7, o = i * 4;
      let r = 0, g = 0, b = 0, a = 0;
      if (m === MAT.VOID) { px[o + 3] = 0; continue; }
      if (m === MAT.EMPTY) { r = 255; g = 255; b = 255; a = 40; }
      else if (m === MAT.GLASS) { r = 232; g = 246; b = 255; a = 150 - ((x * 7 + y * 13) % 3) * 8; }
      else if (m === MAT.CORK) { r = 168 + ((x + y) % 3) * 8; g = 116; b = 70; a = 255; }
      else {
        const sh = v >> 3, pal = m === MAT.SALT ? COL.salt : m === MAT.CHILI ? COL.chili : m === MAT.SOY ? COL.soy : COL.oil;
        const k = sh < 10 ? 0 : sh < 21 ? 1 : 2, cc = pal[k]; r = cc[0]; g = cc[1]; b = cc[2]; a = 255;
        if (LIQ[m]) {                                                    // 액체: 표면(위가 빈칸)이면 하이라이트
          const nx = x + ox, ny = y + oy;
          if (nx >= 0 && ny >= 0 && nx < N && ny < N && (c[ny * N + nx] & 7) === 0) { r = Math.min(255, r + 70); g = Math.min(255, g + 62); b = Math.min(255, b + 40); }
          else { r *= 0.92 + (sh & 3) * 0.02; g *= 0.92 + (sh & 3) * 0.02; }
        }
      }
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a;
    }
    o2d.putImageData(img, 0, 0);
  }

  function draw() {
    const gx = Math.sin(theta), gy = Math.cos(theta);
    renderLattice(gx, gy);
    c2d.clearRect(0, 0, SIZE, SIZE);
    c2d.save(); c2d.translate(SIZE / 2, SIZE / 2); c2d.rotate(theta);
    c2d.imageSmoothingEnabled = false;
    const s = SIZE / N; c2d.drawImage(off, -SIZE / 2, -SIZE / 2, N * s, N * s);
    c2d.restore();
  }

  const flip = () => { thetaT = Math.round(thetaT / Math.PI) * Math.PI + Math.PI; since = 0; };
  if (flipBtn) flipBtn.addEventListener('click', () => { lastTouch = performance.now(); flip(); });

  // 병을 잡고 돌리기: 포인터 각도 변화량만큼 회전
  const center = () => { const r = cv.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2, r]; };
  const onDown = (e) => {
    const [cx, cy, r] = center(), d = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (d > r.width * 0.5) return;
    drag = { a0: Math.atan2(e.clientY - cy, e.clientX - cx), t0: thetaT }; lastTouch = performance.now();
  };
  const onMove = (e) => {
    if (!drag) return; const [cx, cy] = center();
    thetaT = drag.t0 + (Math.atan2(e.clientY - cy, e.clientX - cx) - drag.a0); lastTouch = performance.now();
  };
  const onUp = () => { drag = null; since = 0; };
  cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

  const io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  draw();

  const off1 = ctx.tick(() => {
    if (!vis || document.hidden) { lastT = 0; return; }
    const now = performance.now(); if (!lastT) lastT = now;
    acc += now - lastT; lastT = now; if (acc < 48) return;
    const dt = Math.min(acc, 200) / 1000; acc = 0; clock += dt;
    const t0 = performance.now();

    // 자동 뒤집기: 사용자가 만지지 않으면 일정 간격으로 180° 회전
    if (!drag && performance.now() - lastTouch > 3500) { since += dt; if (since > (clock < 3 ? 1.4 : 7.5)) flip(); }
    const k = drag ? 0.5 : 1 - Math.exp(-dt * 2.6);                      // 지수 접근 → 빠르게 출발해 부드럽게 멈춤
    theta += (thetaT - theta) * k;
    const gx = Math.sin(theta), gy = Math.cos(theta);
    for (let s = 0; s < steps; s++) B.step(gx, gy);
    draw();

    const cost = performance.now() - t0;
    if (cost > 30 && steps > 4) steps--; else if (cost < 12 && steps < 10) steps++;
  });

  return () => { off1(); io.disconnect(); cv.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); };
}
