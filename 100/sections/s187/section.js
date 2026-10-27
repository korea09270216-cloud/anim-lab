// Hopf 올다발: S³ ⊂ C² 의 점 (z0,z1) → 기저 S² 의 점 (2 z0 conj(z1), |z0|²−|z1|²). 기저점 (ϑ,ϕ) 의 올 =
// (z0,z1) = (cos(ϑ/2) e^{iψ}, sin(ϑ/2) e^{i(ψ−ϕ)}), ψ∈[0,2π) — 입체투영하면 Villarceau 원이 되고 서로 정확히 한 번씩 엮인다.
const TAU = Math.PI * 2, NP = 96;
const COSP = new Float64Array(NP + 1), SINP = new Float64Array(NP + 1);
for (let j = 0; j <= NP; j++) { COSP[j] = Math.cos(j / NP * TAU); SINP[j] = Math.sin(j / NP * TAU); }

const RINGS = [[.08, 8], [.15, 10], [.22, 12], [.29, 14], [.36, 15], [.43, 16], [.50, 18]];     // [ϑ/π, 개수]
const BASE = [];
for (const [t, n] of RINGS) for (let i = 0; i < n; i++) BASE.push({ th: t * Math.PI, ph: (i + (t * 7 % 1)) / n * TAU });

// 기저점 → 색: 방위각 ϕ = 색상, 위도 ϑ = 명도 (서로 가까운 기저점 = 가까운 색)
function colorOf(th, ph) {
  const h = (((ph / TAU) % 1) + 1) % 1, l = .5 - .13 * Math.cos(th), sat = .78;
  const k = n => (n + h * 12) % 12, a = sat * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))));
  return [f(0), f(8), f(4)];
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s187__cv'), g = cv.getContext('2d');
  if (!g) return;
  let W = 1080, H = 608, res = 1;
  const fit = () => { const b = root.getBoundingClientRect(); W = Math.round(Math.max(320, b.width) * res * .75); H = Math.round(Math.max(300, b.height) * res * .75); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(root);

  // 입력
  let yaw = .35, pitch = -.6, vyaw = 0, vpitch = 0, drag = false, lx = 0, ly = 0;
  const mouse = { on: false, nx: .5, ny: .5, t: 0 };
  const onDown = e => { drag = true; lx = e.clientX; ly = e.clientY; };
  const onMove = e => {
    const b = root.getBoundingClientRect();
    mouse.nx = (e.clientX - b.left) / b.width; mouse.ny = (e.clientY - b.top) / b.height; mouse.on = true; mouse.t = performance.now();
    if (drag) { vyaw = (e.clientX - lx) * .005; vpitch = (e.clientY - ly) * .005; yaw += vyaw; pitch = Math.max(-1.3, Math.min(1.3, pitch + vpitch)); lx = e.clientX; ly = e.clientY; }
  };
  const onUp = () => { drag = false; };
  root.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

  let visible = true, last = performance.now(), acc = 0, t = 0, avg = 20, nf = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  // 강조 올(커서가 고른 기저점) 상태
  let sTh = Math.PI * .5, sPh = 0;
  const PX = new Float64Array(NP + 1), PY = new Float64Array(NP + 1), PS = new Float64Array(NP + 1), OK = new Uint8Array(NP + 1);
  const camD = 6.2;

  function fiber(th, ph, rgb, baseW, alpha, M, F, cx, cy) {
    const c = Math.cos(th / 2), s = Math.sin(th / 2), cp = Math.cos(ph), sp = Math.sin(ph);
    for (let j = 0; j <= NP; j++) {
      const a = COSP[j], b = SINP[j];
      const x1 = c * a, x2 = c * b, x3 = s * (a * cp + b * sp), x4 = s * (b * cp - a * sp);
      const om = 1 - x4;
      if (om < .07) { OK[j] = 0; continue; }                           // 투영점 근처 클램핑
      const k = 1 / om, X = x1 * k, Y = x2 * k, Z = x3 * k;
      const rx = M[0] * X + M[1] * Y + M[2] * Z, ry = M[3] * X + M[4] * Y + M[5] * Z, rz = M[6] * X + M[7] * Y + M[8] * Z;
      const dep = camD - rz;
      if (dep < 1.2 || Math.abs(rx) > 6 || Math.abs(ry) > 6) { OK[j] = 0; continue; }
      const q = F / dep;
      PX[j] = cx + rx * q; PY[j] = cy + ry * q; PS[j] = k * camD / dep; OK[j] = 1;   // 선 굵기는 투영 배율(k)·원근에 비례
    }
    g.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha})`;
    for (let bk = 0; bk < 3; bk++) {
      g.lineWidth = baseW * (bk === 0 ? .55 : bk === 1 ? 1 : 1.8);
      g.beginPath(); let any = false;
      for (let j = 0; j < NP; j++) {
        if (!OK[j] || !OK[j + 1]) continue;
        const sm = (PS[j] + PS[j + 1]) * .5, b2 = sm < .8 ? 0 : sm < 1.5 ? 1 : 2;
        if (b2 !== bk) continue;
        g.moveTo(PX[j], PY[j]); g.lineTo(PX[j + 1], PY[j + 1]); any = true;
      }
      if (any) g.stroke();
    }
  }

  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    acc += now - last; last = now;
    if (acc < 50) return;
    const dt = Math.min(.12, acc / 1000); acc = 0;
    const ts = performance.now();
    t += dt * (ctx.reduced ? .3 : 1);
    if (!drag) { yaw += vyaw; pitch = Math.max(-1.3, Math.min(1.3, pitch + vpitch)); vyaw *= .92; vpitch *= .92; yaw += dt * .12; }

    // 기저점 (ϑ*,ϕ*): 마우스가 있으면 따라가고 없으면 자동 경로
    const active = mouse.on && now - mouse.t < 3500;
    const tTh = active ? Math.PI * (.16 + .3 * mouse.ny) : Math.PI * (.32 + .12 * Math.sin(.42 * t));
    const tPh = active ? TAU * mouse.nx * 1.5 : t * .8;
    sTh += (tTh - sTh) * .12; let dph = tPh - sPh; sPh += dph * .12;

    // 카메라 회전행렬 (yaw 후 pitch)
    const cy_ = Math.cos(yaw), sy = Math.sin(yaw), cx_ = Math.cos(pitch), sx = Math.sin(pitch);
    const M = [cy_, 0, sy, sx * sy, cx_, -sx * cy_, -cx_ * sy, sx, cx_ * cy_];
    const F = .22 * H * camD, cx = W * (W > H * 1.25 ? .64 : .5), cy = H * .5;

    g.clearRect(0, 0, W, H);
    g.lineCap = 'round'; g.lineJoin = 'round';
    const bw = Math.max(1, W / 1080 * 1.5);
    // 배경 올: 같은 기저점들이 토러스를 따라 천천히 돈다 (대각 U(2) 작용 = 기저 구를 z축으로 회전)
    for (let i = 0; i < BASE.length; i++) {
      const b = BASE[i], ph = b.ph + t * .22, col = colorOf(b.th, ph);
      fiber(b.th, ph, col, bw * .8, .46, M, F, cx, cy);
    }
    // 강조 올 + 이웃 올 고리: 기저점 주위 원 위의 올들이 엮여 리본이 된다
    const qx = Math.sin(sTh) * Math.cos(sPh), qy = Math.sin(sTh) * Math.sin(sPh), qz = Math.cos(sTh);
    let ux = -Math.sin(sPh), uy = Math.cos(sPh), uz = 0;                       // 접벡터 u (ϕ 방향)
    const vx = qy * uz - qz * uy, vy = qz * ux - qx * uz, vz = qx * uy - qy * ux; // v = q×u
    const R = 12, del = .42;
    for (let j = 0; j < R; j++) {
      const a = j / R * TAU, ca = Math.cos(a) * Math.sin(del), sa = Math.sin(a) * Math.sin(del), cd = Math.cos(del);
      const x = qx * cd + ux * ca + vx * sa, y = qy * cd + uy * ca + vy * sa, z = qz * cd + uz * ca + vz * sa;
      const th = Math.acos(Math.max(-1, Math.min(1, z))), ph = Math.atan2(y, x);
      fiber(th, ph, colorOf(th, ph), bw * 2.1, .92, M, F, cx, cy);
    }
    fiber(sTh, sPh, [30, 26, 40], bw * 3.4, 1, M, F, cx, cy);

    // 기저 S² 미니 지구본: 점들의 색 = 올의 색
    const gr = Math.min(W, H) * .105, gx = W - gr * 1.9, gy = H - gr * 1.9;
    g.lineWidth = 1.2; g.strokeStyle = 'rgba(34,32,42,.45)'; g.beginPath(); g.arc(gx, gy, gr, 0, TAU); g.stroke();
    const proj = (th, ph) => {
      const x = Math.sin(th) * Math.cos(ph), y = Math.sin(th) * Math.sin(ph), z = Math.cos(th);
      return [gx + x * gr, gy - z * gr, y];                                  // y>0 = 앞면
    };
    for (let i = 0; i < BASE.length; i++) {
      const b = BASE[i], p = proj(b.th, b.ph + t * .22), c = colorOf(b.th, b.ph + t * .22);
      g.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${p[2] > 0 ? .95 : .28})`;
      g.beginPath(); g.arc(p[0], p[1], gr * .055, 0, TAU); g.fill();
    }
    const sp = proj(sTh, sPh);
    g.lineWidth = 2; g.strokeStyle = 'rgb(30,26,40)'; g.beginPath(); g.arc(sp[0], sp[1], gr * .16, 0, TAU); g.stroke();

    const ms = performance.now() - ts; avg = avg * .85 + ms * .15;
    if (++nf % 10 === 0) {
      if (avg > 38 && res > .5) { res = Math.max(.5, res - .15); fit(); }
      else if (avg < 14 && res < 1) { res = Math.min(1, res + .15); fit(); }
    }
  });

  return () => {
    off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    root.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
  };
}
