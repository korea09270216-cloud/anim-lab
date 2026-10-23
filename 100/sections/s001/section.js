export default function init(root, ctx) {
  const cv = root.querySelector('.s001__cv');
  const g = cv.getContext('2d');
  const W = 360, H = 468, CX = 180, N = 72, K = 24, TAU = Math.PI * 2;
  if (!g) return;

  // 회전과 무관한 지오메트리는 한 번만 계산
  const P = W * H;
  const reg = new Uint8Array(P);           // 1 뚜껑 2 크림 3 슬리브 4 링
  const alpha = new Uint8Array(P);
  const th = new Float32Array(P), sn = new Float32Array(P), cs = new Float32Array(P);
  const sK = new Float32Array(P), cK = new Float32Array(P);
  const yy = new Uint16Array(P);
  const prof = y => {
    if (y < 36 || y > 442) return 0;
    if (y < 78) { const t = (78 - y) / 42; return 106 * Math.sqrt(Math.max(0, 1 - t * t * .9)); }
    let r = 100 - ((y - 78) / 360) * 22;
    if (y > 424) { const s = (y - 424) / 18; r *= Math.sqrt(Math.max(0, 1 - s * s)) * .92 + .08; }
    return r;
  };
  for (let y = 0; y < H; y++) {
    const r = prof(y);
    for (let x = 0; x < W; x++) {
      const i = y * W + x; yy[i] = y;
      if (r <= 0) continue;
      const d = r - Math.abs(x + .5 - CX);
      if (d <= -.5) continue;
      alpha[i] = Math.max(0, Math.min(1, d + .5)) * 255;
      const dx = Math.max(-1, Math.min(1, (x + .5 - CX) / r));
      const t = Math.asin(dx);
      th[i] = t; sn[i] = dx; cs[i] = Math.cos(t);
      sK[i] = Math.sin(K * t); cK[i] = Math.cos(K * t);
      reg[i] = y < 78 ? 1 : (Math.abs(y - 149) < 2 || Math.abs(y - 330) < 2 || Math.abs(y - 79) < 2) ? 4 : (y > 150 && y < 330) ? 3 : 2;
    }
  }
  const frames = new Array(N);
  const Lx = -.57, Lz = .82, Hx = -.30, Hz = .95;
  function render(f) {
    const rot = (f / N) * TAU;
    const cr = Math.cos(K * rot), sr = Math.sin(K * rot);
    const img = new ImageData(W, H), d = img.data;
    for (let i = 0; i < P; i++) {
      const a = alpha[i]; if (!a) continue;
      const R = reg[i];
      let nx = sn[i], nz = cs[i], r, gg, b, sp = 52, spk = .5;
      if (R === 3) {
        const pert = .34 * (sK[i] * cr + cK[i] * sr);
        nx = sn[i] + pert * cs[i]; nz = cs[i] - pert * sn[i];
        r = 28; gg = 108; b = 104; sp = 70; spk = .75;
        const ph = (((th[i] + rot) % TAU) + TAU) % TAU;
        const dph = ph > Math.PI ? ph - TAU : ph;
        if (Math.abs(dph) < .26) { r = 200; gg = 112; b = 66; }
        else {
          const cy = Math.round((yy[i] - 190) / 34) * 34 + 190, ci = Math.round(ph / (TAU / 16)) * (TAU / 16);
          const dd = Math.hypot((yy[i] - cy) * .9, ((ph - ci + Math.PI) % TAU - Math.PI) * 95 * Math.max(.3, cs[i]));
          if (dd < 4.2 && yy[i] > 160 && yy[i] < 320) { r = 233; gg = 226; b = 208; }
        }
      } else if (R === 1) { r = 38; gg = 42; b = 44; sp = 40; spk = .35; }
      else if (R === 4) { r = 22; gg = 28; b = 28; }
      else { r = 238; gg = 232; b = 218; spk = .55; }
      const df = Math.max(0, nx * Lx + nz * Lz) * .78 + .26;
      const sh = Math.pow(Math.max(0, nx * Hx + nz * Hz), sp) * spk * 255;
      const rim = Math.pow(1 - cs[i], 3) * (sn[i] > 0 ? 70 : 24);
      const ao = .62 + .38 * Math.sqrt(cs[i]);
      const o = i * 4;
      d[o] = Math.min(255, r * df * ao + sh + rim * .5);
      d[o + 1] = Math.min(255, gg * df * ao + sh + rim * .7);
      d[o + 2] = Math.min(255, b * df * ao + sh + rim);
      d[o + 3] = a;
    }
    return img;
  }
  frames[0] = render(0);
  let built = 1, buildTimer = 0;
  const build = () => {
    const t0 = performance.now();
    while (built < N && performance.now() - t0 < 10) { frames[built] = render(built); built++; }
    if (built < N) buildTimer = setTimeout(build, 0);
  };
  build();
  const getF = i => { for (let k = 0; k < N; k++) { const f = frames[((i - k) % N + N) % N]; if (f) return f; } return frames[0]; };

  const el = {
    prog: root.querySelector('.s001__prog i'),
    title: [...root.querySelectorAll('.s001__title span')],
    chap: [...root.querySelectorAll('.s001__chap li')],
    obj: root.querySelector('.s001__obj'),
  };
  let target = 0, cur = 0, last = -1;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const win = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const t0 = performance.now();
  const off = ctx.tick(() => {
    cur += (target - cur) * .12;
    const idle = ctx.reduced ? 0 : ((performance.now() - t0) / 1000) * 2.2;
    const fi = Math.floor(cur * N * 1.75 + idle);
    if (fi !== last) { last = fi; g.putImageData(getF(((fi % N) + N) % N), 0, 0); }
    el.prog.style.transform = `scaleY(${cur})`;
    el.title.forEach((s, i) => { s.style.transform = `translateX(${(cur - .5) * (i - 1) * -26}vw)`; });
    el.obj.style.transform = `translate(-50%,-50%) scale(${.9 + .16 * Math.sin(cur * Math.PI)}) rotate(${Math.sin(cur * 6.28) * 2}deg)`;
    el.chap.forEach((li, i) => {
      const a = .06 + i * .3, b = a + .26;
      const tin = win(cur, a, a + .06), tout = win(cur, b - .06, b);
      const v = tin * (1 - tout), side = li.classList.contains('is-l') ? -1 : 1;
      li.style.opacity = v;
      li.style.transform = `translateY(-50%) translateX(${side * (1 - tin) * -40 + side * tout * -30}px)`;
      li.style.filter = v < 1 ? `blur(${(1 - v) * 6}px)` : 'none';
    });
  });
  return () => { off(); st.kill(); clearTimeout(buildTimer); };
}
