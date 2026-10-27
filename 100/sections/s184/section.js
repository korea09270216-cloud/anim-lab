// 쌍곡 타일링 {p,q} — 푸앵카레 원판. 화면 픽셀 → 뫼비우스 변환(SU(1,1)) → 삼각군 거울 접기 → 기본영역 안의 색.
// 거울 3개: A(실수축), B(원점에서 π/p 직선), C(경계에 직교하는 원). 접힌 횟수·순서를 기록해 타일 중심을 역재생으로 복원(타일 색의 고정).
const PALETTE = [ // [바탕 rgb, 포인트 rgb]
  [196, 85, 58, 246, 236, 215],   // 테라코타 / 아이보리
  [31, 111, 107, 232, 178, 60],   // 청록 / 머스터드
  [226, 168, 40, 35, 54, 107],    // 머스터드 / 남색
  [35, 54, 107, 240, 226, 196],   // 남색 / 아이보리
  [244, 236, 218, 196, 85, 58],   // 아이보리 / 테라코타
];
const INK = [42, 33, 24];
const RIM2 = 0.9925 * 0.9925;
const OPS = new Uint8Array(512);

function build(p, q) {
  const a = Math.PI / p, b = Math.PI / q;
  const u = Math.cos(b) / Math.sin(a);                 // 쌍곡 조건 u>1  ⇔ 1/p+1/q<1/2
  const r = 1 / Math.sqrt(u * u - 1), c = u * r;       // 거울 C: 중심 (c,0), 반지름 r, c²−r²=1 (경계 직교)
  const t = c * Math.cos(a) - Math.sqrt(c * c * Math.cos(a) ** 2 - 1);
  const Vx = t * Math.cos(a), Vy = t * Math.sin(a);    // 꼭짓점(q개가 모임)
  const M = c - r;                                     // 변의 중점(실수축)
  const apo = 2 * Math.atanh(M);                       // 중심→변 쌍곡 거리
  return { p, q, sa: Math.sin(a), ca: Math.cos(a), c, r, R2: r * r, Vx, Vy, omV: 1 - t * t, inv: 1 / c,
    rMed: apo * .46, rRing0: apo * .62, rRing1: apo * .72, rDot: apo * .30 };
}

function render(T, cam, W, buf) {
  const { sa, ca, c, r, R2, Vx, Vy, omV, inv, rMed, rRing0, rRing1, rDot } = T;
  const ar = cam[0], ai = cam[1], br = cam[2], bi = cam[3];
  const k = 2 / W, EW = 0.030;
  const ink = (255 << 24) | (INK[2] << 16) | (INK[1] << 8) | INK[0];
  for (let j = 0; j < W; j++) {
    const y = (j + .5) * k - 1;
    for (let i = 0; i < W; i++) {
      const x = (i + .5) * k - 1;
      const r2 = x * x + y * y, o = j * W + i;
      if (r2 >= RIM2) { buf[o] = ink; continue; }
      // 카메라 변환 w=(αz+β)/(β̄z+ᾱ)
      const nr = ar * x - ai * y + br, ni = ar * y + ai * x + bi;
      const dr = br * x + bi * y + ar, di = br * y - bi * x - ai;
      const dd = 1 / (dr * dr + di * di);
      let wx = (nr * dr + ni * di) * dd, wy = (ni * dr - nr * di) * dd;
      // 접기
      let n = 0, it = 0, lastC = -1, d = 0, q = 0, ok = true;
      for (;;) {
        if (++it > 170) { ok = false; break; }
        if (wy < 0) { wy = -wy; OPS[n++] = 0; continue; }
        d = -wx * sa + wy * ca;
        if (d > 0) { wx += 2 * d * sa; wy -= 2 * d * ca; OPS[n++] = 1; continue; }
        const ex = wx - c;
        q = ex * ex + wy * wy;
        if (q < R2) { const s = R2 / q; wx = c + ex * s; wy *= s; lastC = n; OPS[n++] = 2; continue; }
        break;
      }
      const hpx = 4 / (W * (1 - r2));                  // 이 픽셀 한 칸의 쌍곡 길이
      let f = (hpx - 0.06) / 0.55; f = f < 0 ? 0 : f > 1 ? 1 : f;   // 경계 쪽은 평균색(잉크)로 안개
      if (!ok || f >= 1) { buf[o] = ink; continue; }
      // 타일 중심 역재생 → 타일 고정 색
      let px = 0, py = 0;
      if (lastC >= 0) {
        px = inv; py = 0;
        for (let m = lastC - 1; m >= 0; m--) {
          const op = OPS[m];
          if (op === 0) py = -py;
          else if (op === 1) { const dn = -px * sa + py * ca; px += 2 * dn * sa; py -= 2 * dn * ca; }
          else { const ex = px - c, qq = ex * ex + py * py, s = R2 / qq; px = c + ex * s; py *= s; }
        }
      }
      const hh = (Math.imul(Math.round(px * 2048), 0x9E3779B1) ^ Math.imul(Math.round(py * 2048) + 7919, 0x85EBCA77)) >>> 0;
      const P = PALETTE[(hh >>> 11) % 5];
      const om = 1 - (wx * wx + wy * wy), io = 1 / om;
      const dC = (q - R2) / (r * om);                  // sinh(변까지 쌍곡거리)
      const hp = hpx > 0.012 ? hpx : 0.012;
      let R = P[0], G = P[1], B = P[2];
      const sh = 0.86 + 0.14 * Math.min(1, dC * 1.7);
      R *= sh; G *= sh; B *= sh;
      // 중앙 메달리온·링·꼭짓점 점
      const s0 = Math.sqrt((wx * wx + wy * wy) * io), d0 = 2 * s0;
      let m = 0;
      if (d0 < rRing1 + hp) {
        const a1 = .5 + (rMed - d0) / hp;
        const a2 = Math.min(.5 + (d0 - rRing0) / hp, .5 + (rRing1 - d0) / hp);
        m = Math.max(a1 < 0 ? 0 : a1 > 1 ? 1 : a1, a2 < 0 ? 0 : a2 > 1 ? 1 : a2);
      }
      const vx = wx - Vx, vy = wy - Vy;
      const dV = 2 * Math.sqrt((vx * vx + vy * vy) / (om * omV));
      if (m > 0) { R += (P[3] - R) * m; G += (P[4] - G) * m; B += (P[5] - B) * m; }
      let a3 = .5 + (rDot - dV) / hp; a3 = a3 < 0 ? 0 : a3 > 1 ? 1 : a3;   // 꼭짓점 점은 전 타일 공통색 → 온전한 원
      if (a3 > 0) { R += (248 - R) * a3; G += (242 - G) * a3; B += (226 - B) * a3; }
      // 타일 변(잉크선): 쌍곡 폭 일정 → 가장자리로 갈수록 화면에서 가늘어짐
      let e = .5 + (EW - dC) / hp; e = e < 0 ? 0 : e > 1 ? 1 : e;
      const thin = 2 * EW / hp; if (thin < 1) e *= thin;
      if (e > 0) { R += (INK[0] - R) * e; G += (INK[1] - G) * e; B += (INK[2] - B) * e; }
      if (f > 0) { R += (INK[0] - R) * f; G += (INK[1] - G) * f; B += (INK[2] - B) * f; }
      buf[o] = (255 << 24) | ((B | 0) << 16) | ((G | 0) << 8) | (R | 0);
    }
  }
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s184__cv'), stage = root.querySelector('.s184__stage');
  const chips = [...root.querySelectorAll('.s184__chip')];
  const c2 = cv.getContext('2d');
  if (!c2) { stage.style.background = '#2a2118'; return; }

  let W = 224, img = null, buf = null;
  const resize = w => { W = w; cv.width = cv.height = W; img = c2.createImageData(W, W); buf = new Uint32Array(img.data.buffer); };
  resize(W);

  const tilings = chips.map(ch => build(+ch.dataset.p, +ch.dataset.q));
  let cur = 0, T = tilings[0];
  const cam = [1, 0, 0, 0];                      // SU(1,1): α=(ar,ai), β=(br,bi)
  const vel = { x: 0, y: 0 };
  const mouse = { on: false, x: 0, y: 0 };

  function setTiling(i, instant) {
    cur = i; T = tilings[i];
    chips.forEach((c, k) => c.classList.toggle('is-on', k === i));
    if (!instant) gsap.fromTo(cv, { opacity: 0, scale: .94 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'expo.out' });
    lastSwitch = performance.now();
  }
  let lastSwitch = performance.now();
  const onChip = i => () => { setTiling(i); userHold = performance.now(); };
  const chipFns = chips.map((c, i) => { const f = onChip(i); c.addEventListener('click', f); return f; });
  let userHold = 0;

  const onMove = e => {
    const b = stage.getBoundingClientRect();
    const nx = ((e.clientX - b.left) / b.width) * 2 - 1, ny = ((e.clientY - b.top) / b.height) * 2 - 1;
    mouse.x = nx; mouse.y = ny; mouse.on = true; userHold = performance.now();
  };
  const onLeave = () => { mouse.on = false; };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('pointerdown', onMove);

  // 카메라 합성 M ← M∘T(δ) 후 det 정규화 (|α|²−|β|²=1 유지)
  function step(dt, t) {
    let tx, ty;
    if (mouse.on) {
      const L = Math.hypot(mouse.x, mouse.y), s = Math.min(1, L);
      const sp = 1.5 * s * s * (3 - 2 * s);
      tx = L > 1e-4 ? mouse.x / L * sp : 0; ty = L > 1e-4 ? mouse.y / L * sp : 0;
    } else {
      const ang = .55 * t + 1.3 * Math.sin(.31 * t);
      tx = Math.cos(ang) * .55; ty = Math.sin(ang) * .55;
    }
    const kk = 1 - Math.exp(-dt / .32);
    vel.x += (tx - vel.x) * kk; vel.y += (ty - vel.y) * kk;
    const sp = Math.hypot(vel.x, vel.y);
    if (sp > 1e-5) {
      const h = Math.tanh(sp * dt / 2);                     // 쌍곡 이동거리 s → 원판 반지름 tanh(s/2)
      const a = 1 / Math.sqrt(1 - h * h), bR = vel.x / sp * h * a, bI = vel.y / sp * h * a;
      const [ar, ai, br, bi] = cam;
      const nar = ar * a + (br * bR + bi * bI), nai = ai * a + (bi * bR - br * bI);
      const nbr = ar * bR - ai * bI + br * a, nbi = ar * bI + ai * bR + bi * a;
      const det = nar * nar + nai * nai - nbr * nbr - nbi * nbi;
      const nk = 1 / Math.sqrt(det);
      cam[0] = nar * nk; cam[1] = nai * nk; cam[2] = nbr * nk; cam[3] = nbi * nk;
    }
  }

  let visible = true, last = performance.now(), acc = 0, t0 = performance.now(), avg = 40, nAvg = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0.01 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    acc += now - last; last = now;
    if (acc < 48) return;                                  // 약 20fps 캡
    const dt = Math.min(.1, acc / 1000); acc = 0;
    const t = (now - t0) / 1000;
    if (!ctx.reduced) step(dt, t);
    // 자동 문양 순환 (사용자가 만지면 정지)
    if (now - lastSwitch > 15000 && now - userHold > 12000) setTiling((cur + 1) % tilings.length);
    const ts = performance.now();
    render(T, cam, W, buf);
    c2.putImageData(img, 0, 0);
    const ms = performance.now() - ts;
    avg = avg * .8 + ms * .2;
    if (++nAvg % 8 === 0) {                                // 프레임 비용으로 해상도 적응
      if (avg > 42 && W > 160) resize(Math.max(160, W - 16));
      else if (avg < 16 && W < 352) resize(Math.min(352, W + 16));
    }
  });

  return () => {
    off(); io.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    stage.removeEventListener('pointermove', onMove);
    stage.removeEventListener('pointerleave', onLeave);
    stage.removeEventListener('pointerdown', onMove);
    chips.forEach((c, i) => c.removeEventListener('click', chipFns[i]));
    gsap.killTweensOf(cv);
  };
}
