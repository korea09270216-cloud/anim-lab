// s177 — 유리 균열 전파
// 충격점에서 방사 균열(각도 지터·확률 분기)이 에너지를 잃으며 전파 → 링 균열이 방사 균열과 만나는 지점을 잇는다.
// 균열이 만든 위상: (방사 쐐기 k) × (링 구간 j) 사다리꼴 셀 → 셀 비트맵에 굴절(배경 오프셋)·하이라이트를 구워 낙하 붕괴
export default function init(root, ctx) {
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const frame = root.querySelector('[data-frame]');
  const bg = root.querySelector('[data-bg]'), fx = root.querySelector('[data-fx]');
  const bgc = bg.getContext('2d'), g = fx.getContext('2d');
  if (!bgc || !g) return;
  const TAU = Math.PI * 2, FPS_STEP = 1000 / 24, VC = 1500;
  let W = 0, H = 0, state = 'idle', st = 0, simT = 0, idleT = 0;
  let visible = false, alive = true, lastT = 0, acc = 0;
  let P = { x: 0, y: 0 }, cr = null, cells = [], shake = 0, regenT = 0;
  const ptr = { x: 0, y: 0, mx: 0, my: 0, inside: false, moved: -99 };
  const AUTO_WAIT = 2.3;

  /* ---------- 배경 장면 (굴절의 원본) ---------- */
  function paintScene() {
    const p = bgc, u = H / 100;
    let gr = p.createLinearGradient(0, 0, W * .3, H);
    gr.addColorStop(0, '#ffd9c4'); gr.addColorStop(.5, '#f7b6d6'); gr.addColorStop(1, '#a995ff');
    p.fillStyle = gr; p.fillRect(0, 0, W, H);
    // 태양 + 링
    p.fillStyle = '#ff6a45'; p.beginPath(); p.arc(W * .74, H * .4, H * .33, 0, TAU); p.fill();
    p.strokeStyle = 'rgba(255,255,255,.55)'; p.lineWidth = u * .35;
    for (let i = 1; i < 6; i++) { p.beginPath(); p.arc(W * .74, H * .4, H * .33 * (1 + i * .13), 0, TAU); p.stroke(); }
    // 도시 실루엣
    p.fillStyle = '#2a1f5c';
    let x = 0; const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    while (x < W) { const w = u * (4 + rnd() * 7), h = u * (14 + rnd() * 30); p.fillRect(x, H - h, w, h); x += w + u * .6; }
    p.fillStyle = 'rgba(255,224,170,.9)';
    for (let i = 0; i < 90; i++) { const wx = rnd() * W, wy = H - rnd() * u * 36; p.fillRect(wx, wy, u * .8, u * 1.1); }
    // 가는 줄무늬 (굴절 오프셋이 잘 보이게)
    p.strokeStyle = 'rgba(255,255,255,.28)'; p.lineWidth = 1;
    for (let y = H * .62; y < H; y += u * 1.6) { p.beginPath(); p.moveTo(0, y); p.lineTo(W, y); p.stroke(); }
    // 타이포
    const ls = v => { if ('letterSpacing' in p) p.letterSpacing = v + 'px'; };
    p.lineJoin = 'round';
    ls(-u * 1.1); p.font = `900 ${u * 13}px ${FONT}`; p.fillStyle = '#1a1233';
    p.fillText('깨지기 쉬운,', W * .06, H * .3);
    p.strokeStyle = '#1a1233'; p.lineWidth = u * .5; p.fillStyle = '#fff6ea';
    p.strokeText('그래서 투명한.', W * .06, H * .47); p.fillText('그래서 투명한.', W * .06, H * .47);
    ls(-.3); p.font = `700 ${u * 3.6}px ${FONT}`; p.fillStyle = '#1a1233';
    p.fillText('손끝에서 시작되는 유리 공예, 비침', W * .065, H * .56);
    p.font = `600 ${u * 2.8}px ${FONT}`; p.globalAlpha = .75; p.fillText('입으로 불고 · 불로 녹이고 · 시간으로 식힙니다', W * .065, H * .61); p.globalAlpha = 1;
  }

  function resize() {
    const w = Math.max(320, Math.round(Math.min(frame.clientWidth, 1500) * .72));
    const h = Math.max(200, Math.round(w * frame.clientHeight / Math.max(1, frame.clientWidth)));
    if (Math.abs(w - W) < 6 && Math.abs(h - H) < 6) return;
    W = bg.width = fx.width = w; H = bg.height = fx.height = h;
    paintScene();
  }

  /* ---------- 균열 생성 ---------- */
  function lerpAt(ray, s) {
    const { xs, ys, ss } = ray; let i = 1;
    while (i < ss.length - 1 && ss[i] < s) i++;
    const t = Math.max(0, Math.min(1, (s - ss[i - 1]) / ((ss[i] - ss[i - 1]) || 1)));
    return [xs[i - 1] + (xs[i] - xs[i - 1]) * t, ys[i - 1] + (ys[i] - ys[i - 1]) * t];
  }
  function band(ray, sa, sb) {
    const out = [lerpAt(ray, sa)];
    for (let i = 0; i < ray.ss.length; i++) if (ray.ss[i] > sa && ray.ss[i] < sb) out.push([ray.xs[i], ray.ys[i]]);
    if (sb !== Infinity) out.push(lerpAt(ray, sb));
    return out;
  }
  function clipRect(poly) {
    for (const [nx, ny, d] of [[1, 0, 0], [-1, 0, W], [0, 1, 0], [0, -1, H]]) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length];
        const da = nx * a[0] + ny * a[1] + d, db = nx * b[0] + ny * b[1] + d;
        if (da >= 0) out.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = out; if (!poly.length) break;
    }
    return poly;
  }

  function genCracks(P) {
    const diag = Math.hypot(W, H), far = diag * 3, u = H / 100;
    const K = 10 + (Math.random() * 3 | 0), base0 = Math.random() * TAU;
    const rays = [], branches = [];
    for (let k = 0; k < K; k++) {
      const th = base0 + (k + (Math.random() - .5) * .4) * TAU / K;
      const ph1 = Math.random() * TAU, ph2 = Math.random() * TAU, A1 = .03 + Math.random() * .03, A2 = .015 + Math.random() * .02;
      const xs = [P.x], ys = [P.y], ss = [0]; let s = 0, a = th;
      for (;;) {
        s += 9; a = th + A1 * Math.sin(s * .011 + ph1) + A2 * Math.sin(s * .029 + ph2);
        const x = xs[xs.length - 1] + Math.cos(a) * 9, y = ys[ys.length - 1] + Math.sin(a) * 9;
        xs.push(x); ys.push(y); ss.push(s);
        if (x < -60 || x > W + 60 || y < -60 || y > H + 60 || s > far) break;
      }
      xs.push(xs[xs.length - 1] + Math.cos(a) * far); ys.push(ys[ys.length - 1] + Math.sin(a) * far); ss.push(s + far);
      rays.push({ th, a, xs, ys, ss, sp: .85 + Math.random() * .3, exitS: s });
    }
    // 분기 균열 (확률·에너지 감쇠)
    const growBranch = (x, y, ang, len, t0, speed, depth) => {
      const xs = [x], ys = [y], ts = [t0]; let L = 0; const ph = Math.random() * TAU;
      while (L < len) {
        L += 7; const a = ang + .2 * Math.sin(L * .045 + ph) + (Math.random() - .5) * .07;
        x += Math.cos(a) * 7; y += Math.sin(a) * 7; xs.push(x); ys.push(y); ts.push(t0 + L / speed);
        if (x < -10 || x > W + 10 || y < -10 || y > H + 10) break;
        if (depth < 2 && Math.random() < .022 * (1 - L / len)) growBranch(x, y, a + (Math.random() < .5 ? -1 : 1) * (.5 + Math.random() * .6), len * (.3 + Math.random() * .3), t0 + L / speed, speed, depth + 1);
      }
      branches.push({ xs, ys, ts, d: depth });
    };
    for (const r of rays) {
      let sb = 26 + Math.random() * 30;
      while (sb < r.exitS) {
        if (Math.random() < .78 * Math.exp(-sb / (diag * .5))) {
          const p = lerpAt(r, sb), p2 = lerpAt(r, sb + 8), dir = Math.atan2(p2[1] - p[1], p2[0] - p[0]);
          growBranch(p[0], p[1], dir + (Math.random() < .5 ? -1 : 1) * (.35 + Math.random() * .55), (60 + Math.random() * 230) * (1 - .45 * sb / diag), sb / (VC * r.sp), VC * .75, 0);
        }
        sb += 38 + Math.random() * 70;
      }
    }
    // 링 균열: 반경 사다리 × 방사선 교점
    const R = [5, 11, 22, 44].map(v => v * u * (.92 + Math.random() * .16));
    const rp = R.map(Rj => rays.map(r => { const s = Rj * (.9 + Math.random() * .2); return { s, p: lerpAt(r, s), t: s / (VC * r.sp) }; }));
    const seg = R.map((_, j) => rays.map((_, k) => {
      const A = rp[j][k].p, B = rp[j][(k + 1) % K].p, mx = (A[0] + B[0]) / 2, my = (A[1] + B[1]) / 2;
      const nx = B[1] - A[1], ny = A[0] - B[0], l = Math.hypot(nx, ny) || 1, o = (Math.random() - .5) * 5;
      return [A, [mx + nx / l * o, my + ny / l * o], B];
    }));
    // 셀 폴리곤
    const polys = [];
    for (let k = 0; k < K; k++) {
      const k1 = (k + 1) % K, rk = rays[k], rk1 = rays[k1];
      for (let j = 0; j <= R.length; j++) {
        let poly;
        const sA0 = j === 0 ? 0 : rp[j - 1][k].s, sB0 = j === 0 ? 0 : rp[j - 1][k1].s;
        const sA1 = j === R.length ? Infinity : rp[j][k].s, sB1 = j === R.length ? Infinity : rp[j][k1].s;
        const up = band(rk, sA0, sA1), vp = band(rk1, sB0, sB1).reverse();
        poly = up.slice();
        if (j < R.length) poly.push(seg[j][k][1]); // 바깥 링 균열 (rk → rk1)
        else {
          // 최외곽: 먼 반경 호로 닫는다 (모서리 틈 방지)
          let d = rk1.a - rk.a; while (d <= 0) d += TAU; while (d > TAU) d -= TAU;
          for (let q = 1; q < 8; q++) { const aa = rk.a + d * q / 8; poly.push([P.x + Math.cos(aa) * far, P.y + Math.sin(aa) * far]); }
        }
        poly = poly.concat(vp);
        if (j > 0) poly.push(seg[j - 1][k][1]); // 안쪽 링 균열 (rk1 → rk 복귀)
        poly = clipRect(poly);
        if (poly.length >= 3) polys.push({ poly, k, j });
      }
    }
    let tFull = 0; for (const r of rays) tFull = Math.max(tFull, Math.min(r.exitS, diag * .9) / (VC * r.sp));
    return { rays, branches, R, rp, seg, polys, K, tFull: tFull + .1 };
  }

  /* ---------- 균열 그리기 (진행 중) ---------- */
  function strokeUpTo(pa, xs, ys, tOf, t) {
    let i = 0; const n = xs.length;
    pa.moveTo(xs[0], ys[0]);
    while (i + 1 < n && tOf(i + 1) <= t) { i++; pa.lineTo(xs[i], ys[i]); }
    if (i + 1 < n) { const f = (t - tOf(i)) / (tOf(i + 1) - tOf(i) || 1); if (f > 0) pa.lineTo(xs[i] + (xs[i + 1] - xs[i]) * f, ys[i] + (ys[i + 1] - ys[i]) * f); }
  }
  function drawCracks(t) {
    const main = new Path2D(), thin = new Path2D();
    for (const r of cr.rays) strokeUpTo(main, r.xs, r.ys, i => r.ss[i] / (VC * r.sp), t);
    for (const b of cr.branches) if (b.ts[0] <= t) strokeUpTo(b.d ? thin : main, b.xs, b.ys, i => b.ts[i], t);
    cr.seg.forEach((row, j) => row.forEach((sg, k) => {
      const t0 = Math.max(cr.rp[j][k].t, cr.rp[j][(k + 1) % cr.K].t) + .02;
      if (t < t0) return;
      const f = Math.min(1, (t - t0) / .06);
      thin.moveTo(sg[0][0], sg[0][1]); thin.lineTo(sg[1][0], sg[1][1]);
      if (f > .5) thin.lineTo(sg[2][0], sg[2][1]);
    }));
    g.lineCap = 'round'; g.lineJoin = 'round';
    g.strokeStyle = 'rgba(26,18,51,.5)'; g.lineWidth = 3; g.stroke(main); g.lineWidth = 2; g.stroke(thin);
    g.save(); g.translate(-.7, -.7);
    g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 1.5; g.stroke(main); g.lineWidth = 1; g.stroke(thin);
    g.restore();
  }

  /* ---------- 셀 비트맵 굽기 (굴절 + 하이라이트) ---------- */
  function bake() {
    const u = H / 100;
    cells = cr.polys.map(({ poly }, idx) => {
      let A = 0, cx = 0, cy = 0;
      for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], c = a[0] * b[1] - b[0] * a[1]; A += c; cx += (a[0] + b[0]) * c; cy += (a[1] + b[1]) * c; }
      A /= 2; if (Math.abs(A) < 4) return null; cx /= 6 * A; cy /= 6 * A;
      const sgn = A > 0 ? 1 : -1, loc = poly.map(p => [p[0] - cx, p[1] - cy]);
      let rr = 0, x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of poly) { rr = Math.max(rr, Math.hypot(p[0] - cx, p[1] - cy)); x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      x0 = Math.floor(x0) - 2; y0 = Math.floor(y0) - 2; x1 = Math.ceil(x1) + 2; y1 = Math.ceil(y1) + 2;
      const bm = document.createElement('canvas'); bm.width = Math.max(2, x1 - x0); bm.height = Math.max(2, y1 - y0);
      const b = bm.getContext('2d');
      // 굴절: 셀마다 기울기 → 배경 샘플 오프셋 (충격점에서 멀수록 크게 흔들림)
      const d = Math.hypot(cx - P.x, cy - P.y), ang = Math.atan2(cy - P.y, cx - P.x) + (Math.random() - .5) * 1.2;
      const mag = (2 + Math.random() * 5) * (.5 + Math.min(1, d / (H * .8)));
      const ox = Math.cos(ang) * mag, oy = Math.sin(ang) * mag;
      b.save(); b.beginPath(); poly.forEach((p, i) => i ? b.lineTo(p[0] - x0, p[1] - y0) : b.moveTo(p[0] - x0, p[1] - y0)); b.closePath(); b.clip();
      b.drawImage(bg, -x0 + ox, -y0 + oy);
      b.fillStyle = 'rgba(196,238,244,.17)'; b.fillRect(0, 0, bm.width, bm.height);
      // 분쇄된 충격점 (하얗게 번짐)
      const rg = b.createRadialGradient(P.x - x0, P.y - y0, 0, P.x - x0, P.y - y0, 9 * u);
      rg.addColorStop(0, 'rgba(255,255,255,.92)'); rg.addColorStop(.5, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
      b.fillStyle = rg; b.fillRect(0, 0, bm.width, bm.height);
      // 면 광택 띠
      const gx = cx - x0, gy = cy - y0, sa = Math.random() * TAU, gp = .25 + Math.random() * .5, L = rr * 1.05;
      const sg = b.createLinearGradient(gx - Math.cos(sa) * L, gy - Math.sin(sa) * L, gx + Math.cos(sa) * L, gy + Math.sin(sa) * L);
      sg.addColorStop(Math.max(0, gp - .16), 'rgba(255,255,255,0)'); sg.addColorStop(gp, 'rgba(255,255,255,.38)'); sg.addColorStop(Math.min(1, gp + .16), 'rgba(255,255,255,0)');
      b.fillStyle = sg; b.fillRect(0, 0, bm.width, bm.height);
      // 이 셀을 가로지르는 잔균열 (클립 덕에 셀 안쪽만 남는다)
      b.translate(-x0, -y0); b.lineCap = 'round';
      const hair = new Path2D();
      for (const br of cr.branches) { hair.moveTo(br.xs[0], br.ys[0]); for (let i = 1; i < br.xs.length; i++) hair.lineTo(br.xs[i], br.ys[i]); }
      b.strokeStyle = 'rgba(26,18,51,.45)'; b.lineWidth = 2; b.stroke(hair);
      b.translate(-.6, -.6); b.strokeStyle = 'rgba(255,255,255,.9)'; b.lineWidth = 1; b.stroke(hair);
      b.restore();
      // 경계 베벨: 광원(좌상단) 쪽은 흰색, 반대는 짙게
      const lit = new Path2D(), dark = new Path2D();
      for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length], ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1;
        const nx = sgn * ey / l, ny = -sgn * ex / l; const tg = (nx * -.55 + ny * -.83) > 0 ? lit : dark;
        tg.moveTo(p[0] - x0, p[1] - y0); tg.lineTo(q[0] - x0, q[1] - y0);
      }
      b.lineJoin = 'round'; b.strokeStyle = 'rgba(26,18,51,.55)'; b.lineWidth = 1.6; b.stroke(dark);
      b.strokeStyle = 'rgba(255,255,255,.95)'; b.lineWidth = 1.9; b.stroke(lit);
      return {
        bm, ox: x0 - cx, oy: y0 - cy, cx, cy, loc, rr, x: cx, y: cy, a: 0, d,
        tr: .12 + d / 1900 + Math.random() * .3, vx: (Math.random() - .5) * 70 + Math.cos(ang) * 30, vy: -10 - Math.random() * 40,
        w: (Math.random() - .5) * 2.6, ph: Math.random() * TAU, pw: (Math.random() < .5 ? -1 : 1) * (.8 + Math.random() * 2.4), gl: Math.random() * TAU,
        flipper: Math.random() < .55, jit: Math.random() * TAU,
      };
    }).filter(Boolean);
  }

  /* ---------- 상태 전이 ---------- */
  function impact(x, y) {
    if (state !== 'idle' || !W) return;
    P = { x: Math.max(10, Math.min(W - 10, x)), y: Math.max(10, Math.min(H - 10, y)) };
    cr = genCracks(P); cells = []; st = 0; state = 'crack'; shake = 1;
  }
  function collapse() { if (state === 'hold') { state = 'fall'; st = 0; } }

  /* ---------- 프레임 ---------- */
  function drawGlassIntact(alpha) {
    // 맑은 유리: 옅은 색 + 대각 광택(시간에 따라 스윽 지나감)
    g.fillStyle = `rgba(196,238,244,${.1 * alpha})`; g.fillRect(0, 0, W, H);
    const sw = ((simT * .16) % 1.9 - .45) * (W + H) * .8;
    const gr = g.createLinearGradient(sw - W * .12, 0, sw + W * .12, H * .6);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, `rgba(255,255,255,${.3 * alpha})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const g2 = g.createLinearGradient(0, 0, W * .5, H);
    g2.addColorStop(0, `rgba(255,255,255,${.22 * alpha})`); g2.addColorStop(.18, 'rgba(255,255,255,0)'); g2.addColorStop(.8, 'rgba(255,255,255,0)'); g2.addColorStop(1, `rgba(255,255,255,${.12 * alpha})`);
    g.fillStyle = g2; g.fillRect(0, 0, W, H);
  }
  function drawAim() {
    const left = AUTO_WAIT - idleT, lock = left < .8 ? 1 - Math.max(0, left) / .8 : 0;
    g.save(); g.translate(ptr.x, ptr.y);
    g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const ph = ((simT * .8 + i / 3) % 1), r = (34 - 20 * lock) * (.35 + ph * .65);
      g.globalAlpha = (1 - ph) * .8; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    }
    g.globalAlpha = 1; g.fillStyle = lock > 0 ? '#ff6a45' : '#fff'; g.beginPath(); g.arc(0, 0, 3 + 2 * lock, 0, TAU); g.fill();
    g.restore();
  }
  function drawCells() {
    for (const c of cells) {
      g.save(); g.translate(c.x, c.y);
      if (state === 'hold') { const j = Math.sin(simT * 38 + c.jit) * .0035 * Math.min(1, st / .6); g.rotate(j); } else { g.rotate(c.a); }
      const flip = state === 'fall' && c.flipper ? Math.cos(c.ph) : 1; const fy = Math.abs(flip) < .12 ? .12 * Math.sign(flip || 1) : flip;
      g.scale(1, fy);
      g.drawImage(c.bm, c.ox, c.oy);
      if (state === 'fall' && st >= c.tr) {
        const gl = Math.pow(Math.max(0, Math.sin(2 * c.a + c.gl + st * 2)), 6) * .55;
        if (gl > .03) { g.beginPath(); c.loc.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = `rgba(255,255,255,${gl.toFixed(3)})`; g.fill(); }
        const dk = c.flipper ? .26 * (1 - Math.abs(flip)) : 0;
        if (dk > .02) { g.beginPath(); c.loc.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fillStyle = `rgba(26,18,51,${dk.toFixed(3)})`; g.fill(); }
      }
      g.restore();
    }
  }

  function step(dt) {
    simT += dt;
    g.clearRect(0, 0, W, H);
    if (shake > 0) { shake = Math.max(0, shake - dt * 4); frame.style.transform = `translate(${((Math.random() - .5) * 8 * shake).toFixed(1)}px,${((Math.random() - .5) * 8 * shake).toFixed(1)}px)`; if (!shake) frame.style.transform = ''; }
    if (state === 'idle' || state === 'regen') {
      let alpha = 1;
      if (state === 'regen') { regenT += dt / .9; alpha = Math.min(1, regenT); }
      drawGlassIntact(alpha);
      if (state === 'idle') {
        idleT += dt;
        const useMouse = ptr.inside && simT - ptr.moved < 2.2;
        const vx = W * (.5 + .26 * Math.sin(simT * .6)), vy = H * (.46 + .18 * Math.sin(simT * .95 + 1));
        const tx = useMouse ? ptr.mx : vx, ty = useMouse ? ptr.my : vy, k = idleT > AUTO_WAIT - .8 ? .04 : .2;
        ptr.x += (tx - ptr.x) * Math.min(1, k * dt * 25); ptr.y += (ty - ptr.y) * Math.min(1, k * dt * 25);
        drawAim();
        if (idleT > AUTO_WAIT && !root.hasAttribute('data-manual')) impact(ptr.x, ptr.y);
      } else if (regenT >= 1) { state = 'idle'; idleT = 0; }
      return;
    }
    st += dt;
    if (state === 'crack') {
      drawGlassIntact(1);
      if (st < .25) { const r = 16 * (H / 100) * (.4 + st * 4), rg = g.createRadialGradient(P.x, P.y, 0, P.x, P.y, r); rg.addColorStop(0, `rgba(255,255,255,${1 - st / .25})`); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(P.x - r, P.y - r, r * 2, r * 2); }
      drawCracks(st);
      if (st >= cr.tFull) { bake(); state = 'hold'; st = 0; }
    } else if (state === 'hold') {
      drawCells();
      if (st > .9) { state = 'fall'; st = 0; }
    } else if (state === 'fall') {
      let alive_ = 0;
      for (const c of cells) {
        if (st < c.tr) { alive_++; continue; }
        c.vy += 1800 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.a += c.w * dt * Math.min(1, (st - c.tr) * 2); c.ph += c.pw * dt;
        if (c.y - c.rr < H + 60) alive_++;
      }
      drawCells();
      if (alive_ === 0 || st > 3.4) { cells = []; cr = null; state = 'regen'; regenT = 0; }
    }
  }

  /* ---------- 입력 / 라이프사이클 ---------- */
  const toCanvas = e => { const r = fx.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const onMove = e => { const [x, y] = toCanvas(e); ptr.mx = x; ptr.my = y; ptr.inside = true; ptr.moved = simT; };
  const onLeave = () => { ptr.inside = false; };
  const onDown = e => { const [x, y] = toCanvas(e); if (state === 'idle') impact(x, y); else collapse(); };
  const onKey = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'idle') impact(ptr.x, ptr.y); else collapse(); } };
  frame.addEventListener('pointermove', onMove); frame.addEventListener('pointerleave', onLeave);
  frame.addEventListener('pointerdown', onDown); frame.addEventListener('keydown', onKey);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) lastT = performance.now(); }, { threshold: .15 });
  io.observe(root);
  const onVis = () => { if (!document.hidden) lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { if (state === 'idle') resize(); });
  ro.observe(frame);

  resize(); ptr.x = W * .5; ptr.y = H * .46; idleT = -.3;
  const off = ctx.tick(() => {
    if (!alive || !visible || document.hidden) return;
    const now = performance.now(); acc += now - lastT; lastT = now;
    if (acc < FPS_STEP) return;
    const dt = Math.min(.08, acc / 1000); acc = 0;
    step(dt);
  });
  root._dbg177 = { impact, collapse, get state() { return state; }, get cells() { return cells.length; }, get cr() { return cr && { rays: cr.rays.length, br: cr.branches.length, polys: cr.polys.length, tFull: cr.tFull }; } };

  return () => {
    alive = false; off(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis);
    frame.removeEventListener('pointermove', onMove); frame.removeEventListener('pointerleave', onLeave);
    frame.removeEventListener('pointerdown', onDown); frame.removeEventListener('keydown', onKey);
    frame.style.transform = '';
  };
}
