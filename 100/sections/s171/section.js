// ── 핵심: 절차적 보행 ────────────────────────────────────────────────────────
const TAU = Math.PI * 2;
const L1 = 52, L2 = 78, HIPH = 30;                       // 대퇴·경골 길이, 엉덩이 높이 (U=1 기준)
const HIP = [[12, 10], [4, 11], [-4, 11], [-12, 9]];      // [전방, 좌우] 엉덩이 위치
const HOME = [[70, 58], [32, 76], [-12, 76], [-58, 60]];  // 몸통 기준 발의 홈 포인트
const R_STEP = 24, R_EMG = 44, VMAX = 120, TURN = 4.2, LOCK = .22;
const grp = i => (i < 4 ? i : i - 3) & 1;
const wrap = a => { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; };
const ease = t => t * t * (3 - 2 * t);
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function makeSpider(U, x, y) {
  const sp = { U, x, y, phi: 0, vx: 0, vy: 0, om: 0, z: HIPH * U, legs: [], steps: 0, land: [], now: 0, lastG: 1 };
  for (const s of [1, -1]) for (let k = 0; k < 4; k++) {
    sp.legs.push({ s, k, hip: [HIP[k][0] * U, s * HIP[k][1] * U], home: [HOME[k][0] * U, s * HOME[k][1] * U], fx: 0, fy: 0, st: 0, t: 0, t0: -9, dur: .2, ax: 0, ay: 0, bx: 0, by: 0, lift: 0 });
  }
  const cs = Math.cos(sp.phi), sn = Math.sin(sp.phi);
  for (const lg of sp.legs) { lg.fx = x + lg.home[0] * cs - lg.home[1] * sn; lg.fy = y + lg.home[0] * sn + lg.home[1] * cs; }
  // 이웃: 같은 쪽 앞뒤 다리 + 반대쪽 같은 줄 다리 (인접 다리 동시 이륙 금지)
  sp.legs.forEach((lg, i) => { const side = i < 4 ? 0 : 4; lg.nb = []; if (lg.k > 0) lg.nb.push(side + lg.k - 1); if (lg.k < 3) lg.nb.push(side + lg.k + 1); lg.nb.push((i + 4) % 8); });
  return sp;
}
const homeAt = (lg, bx, by, phi, out) => { const c = Math.cos(phi), s = Math.sin(phi); out[0] = bx + lg.home[0] * c - lg.home[1] * s; out[1] = by + lg.home[0] * s + lg.home[1] * c; };
const hipWorld = (sp, lg, out) => { const c = Math.cos(sp.phi), s = Math.sin(sp.phi); out[0] = sp.x + lg.hip[0] * c - lg.hip[1] * s; out[1] = sp.y + lg.hip[0] * s + lg.hip[1] * c; };
const H2 = [0, 0], T2 = [0, 0];

export function stepSpider(sp, dt, tx, ty) {
  const U = sp.U, legs = sp.legs; sp.now += dt;
  // 1) 속도 조절기: 접지한 발이 홈에서 멀어질수록 몸통을 감속 (발이 닿는 곳이 곧 몸이 갈 수 있는 곳)
  let maxD = 0;
  for (const lg of legs) if (!lg.st) { homeAt(lg, sp.x, sp.y, sp.phi, H2); maxD = Math.max(maxD, Math.hypot(lg.fx - H2[0], lg.fy - H2[1])); }
  const g = Math.max(.04, 1 - sstep(R_STEP * 1.1 * U, R_EMG * .95 * U, maxD));
  // 2) 몸통: 목표를 향한 감쇠 추종
  const dx = tx - sp.x, dy = ty - sp.y, dist = Math.hypot(dx, dy), stop = 90 * U;
  const want = dist > stop ? Math.min(VMAX * U * g, (dist - stop) * 2.2 + 30 * U) * g : 0;
  const k = Math.min(1, 7 * dt), ux = dist > 1e-6 ? dx / dist : 0, uy = dist > 1e-6 ? dy / dist : 0;
  sp.vx += (ux * want - sp.vx) * k; sp.vy += (uy * want - sp.vy) * k;
  const phiOld = sp.phi, ang = dist > 30 * U ? Math.atan2(dy, dx) : sp.phi;
  sp.phi += Math.max(-TURN * dt, Math.min(TURN * dt, wrap(ang - sp.phi) * 6 * dt + 0));
  sp.om += ((sp.phi - phiOld) / dt - sp.om) * Math.min(1, 10 * dt);
  sp.x += sp.vx * dt; sp.y += sp.vy * dt;
  const sp_ = Math.hypot(sp.vx, sp.vy);
  // 3) 스윙 중인 발 전진
  let swinging = 0;
  for (const lg of legs) if (lg.st) {
    lg.t += dt / lg.dur;
    if (lg.t >= 1) { lg.st = 0; lg.t = 0; lg.fx = lg.bx; lg.fy = lg.by; lg.lift = 0; sp.steps++; sp.land.push(lg.bx, lg.by); }
    else { const e = ease(lg.t); lg.fx = lg.ax + (lg.bx - lg.ax) * e; lg.fy = lg.ay + (lg.by - lg.ay) * e; lg.lift = Math.sin(Math.PI * lg.t); swinging++; }
  }
  // 4) 스텝 트리거: 홈에서 임계(R_STEP)를 넘은 발이 생기면 그 발의 '조'(교대 사지 보행: 대각선 4다리)가 함께 이륙한다.
  //    직전에 움직인 조는 상대 조가 곧 차례가 될 때(r>.8) 양보 → 두 조가 번갈아 걷는다. 인접 다리(같은 쪽 앞뒤·반대쪽 같은 줄)는 서로 다른 조라
  //    동시에 뜨지 않으며, 인접 다리가 스윙 중이거나 막 이륙했으면(LOCK) 대기한다.
  const rr = [0, 0, 0, 0, 0, 0, 0, 0];
  let lead = -1, lr = 1;
  for (let i = 0; i < 8; i++) { const lg = legs[i]; if (lg.st) { rr[i] = 0; continue; } homeAt(lg, sp.x, sp.y, sp.phi, H2); const d = Math.hypot(lg.fx - H2[0], lg.fy - H2[1]); rr[i] = d / (R_STEP * U); if (rr[i] > lr) { lr = rr[i]; lead = i; } }
  if (lead >= 0) {
    let g = grp(lead), otherDue = false;
    for (let j = 0; j < 8; j++) if (grp(j) !== g && rr[j] > .8) otherDue = true;
    if (g === sp.lastG && otherDue && lr < 1.35) { g = 1 - g; lead = -1; }
    for (let i = 0; i < 8; i++) {
      const lg = legs[i];
      if (grp(i) !== g || lg.st || swinging >= 4 || !(i === lead || rr[i] > .5)) continue;
      let blocked = false;
      for (const j of lg.nb) if (legs[j].st || (rr[i] < 1.45 && sp.now - legs[j].t0 < LOCK)) { blocked = true; break; }
      if (blocked) continue;
      // 착지 목표 = 스텝이 끝날 때의 홈 자세(몸통 예상 위치) + 진행 방향 오버슛
      homeAt(lg, sp.x, sp.y, sp.phi, H2);
      const dur = Math.max(.14, Math.min(.24, .15 + Math.hypot(lg.fx - H2[0], lg.fy - H2[1]) / (900 * U)));
      homeAt(lg, sp.x + sp.vx * dur, sp.y + sp.vy * dur, sp.phi + sp.om * dur, T2);
      const over = Math.min(R_STEP * .55 * U, sp_ * .1);
      if (sp_ > 1) { T2[0] += sp.vx / sp_ * over; T2[1] += sp.vy / sp_ * over; }
      lg.st = 1; lg.t = 0; lg.t0 = sp.now; lg.dur = dur; lg.ax = lg.fx; lg.ay = lg.fy; lg.bx = T2[0]; lg.by = T2[1]; swinging++; sp.lastG = g;
    }
  }
  sp.z += ((HIPH - 2.4 * swinging) * U - sp.z) * Math.min(1, 12 * dt);
  sp.swing = swinging;
}

// 3D 2-본 IK (코사인 법칙): 엉덩이(몸통 위 h) → 무릎(위쪽으로 굽힘) → 발(지면/스윙 높이 f)
export function legIK(sp, lg, out) {
  const U = sp.U; hipWorld(sp, lg, H2);
  const hx = H2[0], hy = H2[1], hz = sp.z, fz = lg.lift * 26 * U;
  let dx = lg.fx - hx, dy = lg.fy - hy, dz = fz - hz, D = Math.hypot(dx, dy, dz);
  const l1 = L1 * U, l2 = L2 * U, reach = l1 + l2;
  const ex = D > reach * .999;                        // 닿지 않으면 팔을 쭉 편다 (정상 운용에선 조절기가 막는다)
  const Dc = ex ? reach * .999 : D, a = (l1 * l1 - l2 * l2 + Dc * Dc) / (2 * Dc), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const ux = dx / D, uy = dy / D, uz = dz / D;
  // 위쪽(0,0,1) 에서 u 방향 성분을 뺀 벡터 = 굽힘 평면 법선
  let nx = -uz * ux, ny = -uz * uy, nz = 1 - uz * uz; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
  out.hx = hx; out.hy = hy; out.hz = hz;
  out.kx = hx + ux * a + nx * h; out.ky = hy + uy * a + ny * h; out.kz = hz + uz * a + nz * h;
  out.fx = hx + ux * Dc; out.fy = hy + uy * Dc; out.fz = hz + uz * Dc; out.ratio = D / reach; out.ex = ex;
  return out;
}

// ── 렌더 + 루프 ─────────────────────────────────────────────────────────────
export default function init(root, ctx) {
  const cv = root.querySelector('.s171__cv'), c = cv.getContext('2d');
  if (!c) return;
  const INK = '#1d1814', RED = '#d6382b', PAPER = '#efe6d2';
  let W = 0, H = 0, U = 1, paper = null, sp = null;
  const KZ = .0011;
  const marks = [];                                  // 발자국 {x,y,age}
  const target = { x: 0, y: 0 };
  let userAt = -99, clock = 0;

  function build() {
    const r = cv.getBoundingClientRect(), sc = .75;
    const ox = sp ? sp.x / (W || 1) : .6, oy = sp ? sp.y / (H || 1) : .62;
    W = Math.max(320, Math.round(r.width * sc)); H = Math.max(240, Math.round(r.height * sc)); cv.width = W; cv.height = H; U = H / 520;
    paper = document.createElement('canvas'); paper.width = W; paper.height = H;
    const g = paper.getContext('2d'); g.fillStyle = PAPER; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(80,60,30,.13)'; const gs = Math.round(34 * U);
    for (let y = gs / 2; y < H; y += gs) for (let x = gs / 2; x < W; x += gs) { g.beginPath(); g.arc(x, y, 1.1, 0, TAU); g.fill(); }
    const v = g.createRadialGradient(W * .6, H * .5, H * .3, W * .6, H * .5, H * 1.05); v.addColorStop(0, 'rgba(255,250,235,.55)'); v.addColorStop(1, 'rgba(120,90,50,.16)'); g.fillStyle = v; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(214,56,43,.11)'; g.lineWidth = 2 * U; g.beginPath(); g.arc(W * .66, H * .56, H * .43, 0, TAU); g.stroke(); g.beginPath(); g.arc(W * .66, H * .56, H * .35, 0, TAU); g.stroke();
    sp = makeSpider(U, ox * W, oy * H); marks.length = 0;
    target.x = sp.x; target.y = sp.y;
  }
  build();
  const ro = new ResizeObserver(() => build()); ro.observe(cv);

  const P = (x, y, z) => { const k = 1 + KZ * z; return [W / 2 + (x - W / 2) * k, H / 2 + (y - H / 2) * k]; };
  const ik = {};
  const seg = (p, q, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(q[0], q[1]); c.stroke(); };

  function draw(dt) {
    c.drawImage(paper, 0, 0);
    // 홈 포인트 링: 발이 임계 반경에 가까워질수록 진해진다 (스텝 트리거를 눈에 보이게)
    c.lineWidth = 1.2; c.setLineDash([3 * U, 5 * U]);
    const cs = Math.cos(sp.phi), sn = Math.sin(sp.phi);
    for (const lg of sp.legs) {
      const hx = sp.x + lg.home[0] * cs - lg.home[1] * sn, hy = sp.y + lg.home[0] * sn + lg.home[1] * cs;
      const dd = Math.hypot(lg.fx - hx, lg.fy - hy) / (R_STEP * U);
      c.strokeStyle = `rgba(214,56,43,${(.1 + .38 * Math.min(1, dd)).toFixed(3)})`; c.beginPath(); c.arc(hx, hy, R_STEP * U, 0, TAU); c.stroke();
    }
    c.setLineDash([]);
    // 발자국: 닿은 자리에 잉크 점 + 번지는 링
    for (let i = 0; i < sp.land.length; i += 2) marks.push({ x: sp.land[i], y: sp.land[i + 1], age: 0 });
    sp.land.length = 0;
    for (let i = marks.length - 1; i >= 0; i--) {
      const m = marks[i]; m.age += dt; if (m.age > 4.5) { marks.splice(i, 1); continue; }
      const f = 1 - m.age / 4.5;
      c.fillStyle = `rgba(29,24,20,${(.34 * f).toFixed(3)})`; c.beginPath(); c.arc(m.x, m.y, 2.6 * U, 0, TAU); c.fill();
      if (m.age < .5) { c.strokeStyle = `rgba(214,56,43,${(.55 * (1 - m.age / .5)).toFixed(3)})`; c.lineWidth = 1.5; c.beginPath(); c.arc(m.x, m.y, (4 + m.age * 40) * U, 0, TAU); c.stroke(); }
    }
    drawBowl(target.x, target.y);
    // 그림자
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const lg of sp.legs) {
      legIK(sp, lg, ik);
      c.strokeStyle = 'rgba(40,25,10,.13)'; c.lineWidth = 6 * U; c.beginPath();
      c.moveTo(ik.hx + 9 * U, ik.hy + 12 * U); c.lineTo(ik.kx + 9 * U * (1 + ik.kz / 120), ik.ky + 12 * U * (1 + ik.kz / 120)); c.lineTo(ik.fx + 8 * U, ik.fy + 11 * U); c.stroke();
    }
    c.fillStyle = 'rgba(40,25,10,.16)'; c.beginPath(); c.ellipse(sp.x + 10 * U, sp.y + 14 * U, 46 * U, 30 * U, sp.phi, 0, TAU); c.fill();
    // 다리 (스윙 중인 다리는 위로 올라 있어 나중에 그려 위에 보이게)
    const order = sp.legs.slice().sort((p, q) => p.lift - q.lift);
    for (const lg of order) {
      legIK(sp, lg, ik);
      const hp = P(ik.hx, ik.hy, ik.hz), kp = P(ik.kx, ik.ky, ik.kz), fp = P(ik.fx, ik.fy, ik.fz);
      const sw = 1 + KZ * 2 * ik.kz;
      seg(hp, kp, 9.5 * U * sw, INK); seg(kp, fp, 6 * U * sw, INK);
      seg(hp, kp, 2.4 * U, '#5d5043'); seg(kp, fp, 1.8 * U, '#6c5d4e');
      c.fillStyle = INK; c.beginPath(); c.arc(kp[0], kp[1], 6.6 * U * sw, 0, TAU); c.fill();
      c.fillStyle = '#7b6a58'; c.beginPath(); c.arc(kp[0] - 1.6 * U, kp[1] - 1.8 * U, 2.1 * U, 0, TAU); c.fill();
      c.fillStyle = lg.st ? RED : INK; c.beginPath(); c.arc(fp[0], fp[1], (lg.st ? 3.6 : 3) * U, 0, TAU); c.fill();
    }
    drawBody();
  }
  function drawBowl(x, y) {
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(40,25,10,.16)'; c.beginPath(); c.ellipse(4 * U, 7 * U, 20 * U, 16 * U, 0, 0, TAU); c.fill();
    c.fillStyle = RED; c.beginPath(); c.arc(0, 0, 18 * U, 0, TAU); c.fill();
    c.fillStyle = '#fff6df'; c.beginPath(); c.arc(0, 0, 14.5 * U, 0, TAU); c.fill();
    c.fillStyle = '#e8a43a'; c.beginPath(); c.arc(0, 0, 10 * U, 0, TAU); c.fill();
    c.strokeStyle = '#fff6df'; c.lineWidth = 1.6 * U; for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(0, 0, (4 + i * 2.4) * U, .3 + i, 2.6 + i); c.stroke(); }
    c.fillStyle = RED; c.beginPath(); c.arc(5 * U, -3 * U, 3.4 * U, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(29,24,20,.38)'; c.lineWidth = 1.6 * U;
    for (let i = -1; i <= 1; i++) { c.beginPath(); for (let q = 0; q <= 10; q++) { const yy = -24 * U - q * 3.4 * U, xx = i * 7 * U + Math.sin(clock * 2.2 + q * .7 + i) * 3 * U; q ? c.lineTo(xx, yy) : c.moveTo(xx, yy); } c.globalAlpha = .55; c.stroke(); c.globalAlpha = 1; }
    c.restore();
  }
  function drawBody() {
    const bp = P(sp.x, sp.y, sp.z + 6), s = (1 + KZ * (sp.z + 6)) * U;
    c.save(); c.translate(bp[0], bp[1]); c.rotate(sp.phi); c.scale(s, s);
    const gAb = c.createRadialGradient(-34, -8, 4, -30, 0, 34); gAb.addColorStop(0, '#4a3d33'); gAb.addColorStop(.55, INK); gAb.addColorStop(1, '#0e0b09');
    c.fillStyle = gAb; c.beginPath(); c.ellipse(-30, 0, 32, 24, 0, 0, TAU); c.fill();
    c.fillStyle = RED; c.beginPath(); c.moveTo(-40, -7); c.lineTo(-22, -3); c.lineTo(-22, 3); c.lineTo(-40, 7); c.lineTo(-33, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-18, -2.5); c.lineTo(-9, -8); c.lineTo(-9, 8); c.lineTo(-18, 2.5); c.closePath(); c.fill();
    const gTh = c.createRadialGradient(4, -5, 2, 8, 0, 22); gTh.addColorStop(0, '#5a4a3d'); gTh.addColorStop(1, '#17120f');
    c.fillStyle = gTh; c.beginPath(); c.ellipse(8, 0, 21, 16.5, 0, 0, TAU); c.fill();
    c.fillStyle = '#2a221c'; c.beginPath(); c.ellipse(26, 0, 11, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#f3ead6';
    for (const [ex, ey, er] of [[30, -4.2, 2.3], [30, 4.2, 2.3], [26.5, -7, 1.7], [26.5, 7, 1.7], [31.5, -1.6, 1.2], [31.5, 1.6, 1.2], [23.5, -4.5, 1.3], [23.5, 4.5, 1.3]]) { c.beginPath(); c.arc(ex, ey, er, 0, TAU); c.fill(); }
    c.fillStyle = RED; c.beginPath(); c.arc(30.3, -4.3, 1, 0, TAU); c.arc(30.3, 4.3, 1, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = 3; c.lineCap = 'round'; const tw = Math.sin(clock * 5) * .8;
    c.beginPath(); c.moveTo(34, -3); c.lineTo(41, -5 + tw); c.moveTo(34, 3); c.lineTo(41, 5 - tw); c.stroke();
    c.restore();
  }

  // ── 입력: 커서를 쫓는다. 입력이 3.5초 없으면 그릇이 화면을 돌아다닌다. ──
  const pm = e => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (x >= 0 && x <= W && y >= 0 && y <= H) { target.x = x; target.y = y; userAt = clock; }
  };
  addEventListener('pointermove', pm, { passive: true });

  let vis = true, tabVis = !document.hidden, last = performance.now(), acc = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabVis = !document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const FRAME = 1 / 24, DT = 1 / 60;
  const off_ = ctx.tick(() => {
    if (!vis || !tabVis) return;
    const now = performance.now(); acc += Math.min(.1, (now - last) / 1000); last = now;
    if (acc < FRAME) return;
    let t = Math.min(acc, .12); acc = 0;
    const real = t;
    while (t > 1e-9) {
      const h = Math.min(DT, t); t -= h; clock += h;
      if (clock - userAt > 3.5) { // 자동 시나리오: 두 주파수의 리사주 궤도
        target.x = W * (.5 + .3 * Math.cos(clock * .43 + .6)); target.y = H * (.52 + .26 * Math.sin(clock * .61));
      }
      stepSpider(sp, h, target.x, target.y);
    }
    draw(real);
  });
  return () => { off_(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', pm); };
}
