// s176 — 보로노이 산산조각 페이지 전환
// Bowyer–Watson Delaunay(직접 구현) → 외접원 중심의 쌍대로 보로노이 셀 → 충격점 중심 비균질 시드
// 파편 = 셀 폴리곤으로 미리 오려둔 비트맵 강체(질량중심·회전·낙하), 충격파가 퍼지며 파편이 순차 이탈
export default function init(root, ctx) {
  const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
  const cv = root.querySelector('[data-cv]');
  const stage = root.querySelector('[data-stage]');
  const idxEl = root.querySelector('[data-idx]');
  const dots = [...root.querySelectorAll('[data-dots] li')];
  const g = cv.getContext('2d');
  if (!g) return;

  const PAGES = [
    { bg: '#f1e6d0', ink: '#17120f', acc: '#e5412a' },
    { bg: '#12362c', ink: '#f1e6d0', acc: '#f3b83b' },
    { bg: '#f2b632', ink: '#14213d', acc: '#e5412a' },
  ];
  const TAU = Math.PI * 2;
  const FPS_STEP = 1000 / 24;
  let W = 0, H = 0, pages = [], cur = 0, state = 'idle', S = null;
  let visible = false, alive = true, lastT = 0, idleT = 0, simT = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0, inside: false, moved: -99 };
  const AUTO_WAIT = 2.5;

  /* ---------- 페이지 프로시저럴 렌더 ---------- */
  function paint(k) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const p = c.getContext('2d'); const u = H / 100; const P = PAGES[k];
    p.fillStyle = P.bg; p.fillRect(0, 0, W, H);
    const ls = v => { if ('letterSpacing' in p) p.letterSpacing = v + 'px'; };
    if (k === 0) {
      const cx = W * .72, cy = H * .5, R = H * .52;
      p.fillStyle = P.acc; p.beginPath(); p.arc(cx, cy, R, 0, TAU); p.fill();
      p.strokeStyle = 'rgba(241,230,208,.5)'; p.lineWidth = u * .35;
      for (let i = 1; i < 8; i++) { p.beginPath(); p.arc(cx, cy, R * i / 8, 0, TAU); p.stroke(); }
      // 크래커
      p.save(); p.translate(cx, cy); p.rotate(-.22);
      const cw = R * 1.02, ch = R * .78;
      p.fillStyle = '#f0d28f'; p.strokeStyle = P.ink; p.lineWidth = u * .7;
      p.beginPath(); p.roundRect(-cw / 2, -ch / 2, cw, ch, u * 2.6); p.fill(); p.stroke();
      p.fillStyle = 'rgba(23,18,15,.75)';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { p.beginPath(); p.arc(-cw * .3 + i * cw * .2, -ch * .26 + j * ch * .26, u * .62, 0, TAU); p.fill(); }
      p.restore();
      // 하프톤
      p.fillStyle = P.ink;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
        const r = u * 1.15 * Math.max(0, 1 - (x + (7 - y)) / 20);
        if (r > .3) { p.beginPath(); p.arc(W * .52 + x * u * 2.6, H * .1 + y * u * 2.6, r, 0, TAU); p.fill(); }
      }
      ls(-u * 2.2); p.font = `900 ${u * 60}px ${FONT}`; p.fillStyle = P.ink; p.fillText('산산', W * .055, H * .74);
      ls(-.4); p.font = `800 ${u * 4.8}px ${FONT}`; p.fillText('바삭, 하고 부서지는 순간.', W * .06, H * .85);
      p.font = `600 ${u * 3.1}px ${FONT}`; p.globalAlpha = .75; p.fillText('결대로 쪼개지는 수제 크래커', W * .06, H * .905); p.globalAlpha = 1;
    } else if (k === 1) {
      const cols = ['#f1e6d0', '#e5412a', '#f3b83b', '#8fc5a1', '#f1e6d0', '#e5412a', '#f3b83b'];
      for (let i = 0; i < 7; i++) { p.fillStyle = cols[i]; p.beginPath(); p.arc(W * .74, H * 1.12, H * (.98 - i * .13), Math.PI, TAU); p.fill(); }
      p.fillStyle = '#12362c'; p.beginPath(); p.arc(W * .74, H * 1.12, H * .12, Math.PI, TAU); p.fill();
      p.fillStyle = P.acc; p.beginPath(); p.arc(W * .88, H * .2, H * .09, 0, TAU); p.fill();
      p.strokeStyle = P.ink; p.lineWidth = u * .4; p.globalAlpha = .5;
      for (let i = 0; i < 6; i++) { p.beginPath(); p.moveTo(W * .06, H * .13 + i * u * 1.9); p.bezierCurveTo(W * .2, H * .06 + i * u * 1.9, W * .3, H * .2 + i * u * 1.9, W * .42, H * .13 + i * u * 1.9); p.stroke(); }
      p.globalAlpha = 1;
      ls(-u * 1.4); p.font = `900 ${u * 19}px ${FONT}`; p.fillStyle = P.ink;
      p.lineJoin = 'round'; p.strokeStyle = P.bg; p.lineWidth = u * 1.6;
      p.strokeText('한 입 더,', W * .06, H * .5); p.fillText('한 입 더,', W * .06, H * .5); p.fillStyle = P.acc;
      p.strokeText('결대로.', W * .06, H * .71); p.fillText('결대로.', W * .06, H * .71);
      ls(-.3); p.fillStyle = P.ink; p.font = `700 ${u * 3.6}px ${FONT}`; p.strokeText('오늘 구운 첫 판은 아직 따뜻해요', W * .065, H * .86); p.fillText('오늘 구운 첫 판은 아직 따뜻해요', W * .065, H * .86);
    } else {
      p.fillStyle = P.ink; p.beginPath(); p.moveTo(0, H); p.lineTo(0, H * .34); p.lineTo(W * .46, H); p.closePath(); p.fill();
      p.fillStyle = P.acc; p.beginPath(); p.arc(W * .84, H * .27, H * .21, 0, TAU); p.fill();
      for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2 === 0) { p.fillStyle = P.ink; p.fillRect(W * .6 + i * u * 5.2, H * .58 + j * u * 5.2, u * 5.2, u * 5.2); }
      p.fillStyle = P.bg; p.beginPath(); p.arc(W * .12, H * .84, u * 3.6, 0, TAU); p.fill();
      ls(-u * 2); p.font = `900 ${u * 58}px ${FONT}`; p.fillStyle = P.ink; p.fillText('조각', W * .23, H * .7);
      ls(-.3); p.font = `800 ${u * 4.6}px ${FONT}`; p.fillText('오늘의 조각을 골라요', W * .235, H * .81);
      p.font = `600 ${u * 3.1}px ${FONT}`; p.globalAlpha = .75; p.fillText('세 가지 맛, 서른 개의 결', W * .235, H * .865); p.globalAlpha = 1;
    }
    return c;
  }

  function resize() {
    const r = stage.getBoundingClientRect();
    const w = Math.max(320, Math.round(Math.min(r.width, 1500) * .78));
    const h = Math.max(200, Math.round(w * r.height / Math.max(1, r.width)));
    if (Math.abs(w - W) < 6 && Math.abs(h - H) < 6) return;
    W = cv.width = w; H = cv.height = h;
    pages = [0, 1, 2].map(paint);
  }

  /* ---------- Bowyer–Watson Delaunay (직접 구현) ---------- */
  function delaunay(P) {
    const n = P.length;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
    const dm = Math.max(x1 - x0, y1 - y0) || 1, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const pts = P.concat([[mx - 20 * dm, my - dm], [mx, my + 20 * dm], [mx + 20 * dm, my - dm]]);
    const mk = (a, b, c) => {
      const ax = pts[a][0], ay = pts[a][1], bx = pts[b][0], by = pts[b][1], cx = pts[c][0], cy = pts[c][1];
      const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
      if (Math.abs(d) < 1e-9) return null;
      const a2 = ax * ax + ay * ay, b2 = bx * bx + by * by, c2 = cx * cx + cy * cy;
      const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
      const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
      return { a, b, c, x: ux, y: uy, r2: (ax - ux) * (ax - ux) + (ay - uy) * (ay - uy) };
    };
    let tris = [mk(n, n + 1, n + 2)];
    for (let i = 0; i < n; i++) {
      const px = pts[i][0], py = pts[i][1], keep = [], edges = new Map();
      const add = (u, v) => { const k = u < v ? u * 4096 + v : v * 4096 + u; const e = edges.get(k); if (e) e.c++; else edges.set(k, { u, v, c: 1 }); };
      for (const t of tris) {
        const dx = px - t.x, dy = py - t.y;
        if (dx * dx + dy * dy < t.r2 * (1 - 1e-10)) { add(t.a, t.b); add(t.b, t.c); add(t.c, t.a); } else keep.push(t);
      }
      tris = keep;
      for (const e of edges.values()) if (e.c === 1) { const t = mk(e.u, e.v, i); if (t) tris.push(t); }
    }
    return tris.filter(t => t.a < n && t.b < n && t.c < n);
  }

  function clipRect(poly) {
    // 반평면: nx*x+ny*y+d >= 0  (x>=0, x<=W, y>=0, y<=H)
    const hp = [[1, 0, 0], [-1, 0, W], [0, 1, 0], [0, -1, H]];
    for (const [nx, ny, d] of hp) {
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

  // 보로노이 셀: 사이트를 4변으로 거울 반사해 모든 셀을 유계로 만든 뒤 Delaunay 쌍대(외접원 중심)로 구성
  function voronoi(sites) {
    const n = sites.length, P = sites.map(s => [s.x, s.y]);
    for (const s of sites) P.push([-s.x, s.y], [2 * W - s.x, s.y], [s.x, -s.y], [s.x, 2 * H - s.y]);
    const tris = delaunay(P);
    const inc = Array.from({ length: n }, () => []);
    for (const t of tris) { if (t.a < n) inc[t.a].push(t); if (t.b < n) inc[t.b].push(t); if (t.c < n) inc[t.c].push(t); }
    const cells = [];
    for (let i = 0; i < n; i++) {
      const s = sites[i];
      let poly = inc[i].map(t => [t.x, t.y]).sort((p, q) => Math.atan2(p[1] - s.y, p[0] - s.x) - Math.atan2(q[1] - s.y, q[0] - s.x));
      poly = poly.filter((p, j) => { const q = poly[(j + 1) % poly.length]; return Math.hypot(p[0] - q[0], p[1] - q[1]) > .4; });
      poly = clipRect(poly);
      if (poly.length >= 3) cells.push(poly);
    }
    return cells;
  }

  function genSeeds(P, N) {
    const pts = [];
    const R = Math.hypot(Math.max(P.x, W - P.x), Math.max(P.y, H - P.y));
    for (const [fx, fy] of [[.04, .06], [.96, .06], [.04, .94], [.96, .94], [.5, .03], [.5, .97], [.03, .5], [.97, .5]]) pts.push({ x: fx * W, y: fy * H });
    let guard = 0;
    while (pts.length < N && guard++ < N * 80) {
      let best = null, bs = -1;
      for (let c = 0; c < 6; c++) {
        const a = Math.random() * TAU, r = R * Math.pow(Math.random(), 1.6);
        const x = P.x + Math.cos(a) * r, y = P.y + Math.sin(a) * r;
        if (x < 6 || y < 6 || x > W - 6 || y > H - 6) continue;
        let d = 1e12; for (const q of pts) { const dd = (q.x - x) ** 2 + (q.y - y) ** 2; if (dd < d) d = dd; }
        const sc = d / (1 + (r / R) * 5);
        if (sc > bs) { bs = sc; best = { x, y }; }
      }
      if (best) pts.push(best);
    }
    return pts;
  }

  /* ---------- 파편 생성 ---------- */
  function makeShards(P, src) {
    const N = 44 + (Math.random() * 12 | 0);
    const cells = voronoi(genSeeds(P, N));
    const diag = Math.hypot(W, H);
    return cells.map(poly => {
      let A = 0, cx = 0, cy = 0;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], cr = a[0] * b[1] - b[0] * a[1];
        A += cr; cx += (a[0] + b[0]) * cr; cy += (a[1] + b[1]) * cr;
      }
      A /= 2; cx /= 6 * A; cy /= 6 * A;
      const sgn = A > 0 ? 1 : -1, area = Math.abs(A);
      const loc = poly.map(p => [p[0] - cx, p[1] - cy]);
      let rr = 0; for (const p of loc) rr = Math.max(rr, Math.hypot(p[0], p[1]));
      // 1.3px 바깥으로 살짝 부풀려 오려 이음새(AA 틈) 제거
      const grow = 1 + 1.3 / Math.max(rr, 6);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      const gl = loc.map(p => [p[0] * grow, p[1] * grow]);
      for (const p of gl) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
      x0 = Math.floor(x0) - 1; y0 = Math.floor(y0) - 1; x1 = Math.ceil(x1) + 1; y1 = Math.ceil(y1) + 1;
      const bm = document.createElement('canvas'); bm.width = Math.max(2, x1 - x0); bm.height = Math.max(2, y1 - y0);
      const b = bm.getContext('2d');
      b.beginPath(); gl.forEach((p, i) => i ? b.lineTo(p[0] - x0, p[1] - y0) : b.moveTo(p[0] - x0, p[1] - y0)); b.closePath(); b.clip();
      b.drawImage(src, -cx - x0, -cy - y0);
      const d = Math.hypot(cx - P.x, cy - P.y);
      const ang = Math.atan2(cy - P.y, cx - P.x);
      const near = Math.exp(-d / (diag * .42));
      const sp = 260 + 520 * near;
      const small = 1 / (1 + area / 4200);
      // 가장자리 법선(바깥) — 하이라이트용
      const nrm = loc.map((p, i) => { const q = loc[(i + 1) % loc.length]; const ex = q[0] - p[0], ey = q[1] - p[1], l = Math.hypot(ex, ey) || 1; return [sgn * ey / l, -sgn * ex / l]; });
      return {
        poly: loc, nrm, bm, ox: x0, oy: y0, cx, cy, x: cx, y: cy, a: 0, rr, area,
        tr: d / 1250 + Math.random() * .05,
        vx: Math.cos(ang) * sp * (.75 + Math.random() * .5), vy: Math.sin(ang) * sp * (.75 + Math.random() * .5) - 140 - 220 * near,
        w: (Math.random() - .5) * (2.4 + 9 * small), ph: Math.random() * TAU, pw: (Math.random() < .5 ? -1 : 1) * (1.2 + Math.random() * 3.2),
        gl: Math.random() * TAU, rel: false,
      };
    });
  }

  function impact(x, y) {
    if (state !== 'idle' || !W) return;
    const P = { x: Math.max(8, Math.min(W - 8, x)), y: Math.max(8, Math.min(H - 8, y)) };
    const next = (cur + 1) % 3;
    const shards = makeShards(P, pages[cur]);
    const parts = [];
    for (let i = 0; i < 90; i++) {
      const a = Math.random() * TAU, v = 160 + Math.random() * 900;
      parts.push({ x: P.x, y: P.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 120, s: 1.5 + Math.random() * 5, life: .7 + Math.random() * .9, c: Math.random() < .5 ? PAGES[cur].ink : (Math.random() < .5 ? PAGES[cur].acc : PAGES[cur].bg) });
    }
    S = { P, next, shards, parts, t: 0 };
    state = 'shatter';
  }

  /* ---------- 갱신 / 그리기 ---------- */
  const GRAV = 1500;
  function stepShatter(dt) {
    S.t += dt;
    for (const s of S.shards) {
      if (S.t < s.tr) continue;
      if (!s.rel) { s.rel = true; }
      s.vy += GRAV * dt; s.vx *= (1 - .35 * dt);
      s.x += s.vx * dt; s.y += s.vy * dt; s.a += s.w * dt; s.ph += s.pw * dt;
    }
    for (const p of S.parts) { p.life -= dt; p.vy += 1000 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
  }

  function drawShatter() {
    const { P, next, shards, parts, t } = S;
    const sh = Math.exp(-t * 7) * 9;
    g.save();
    g.translate((Math.random() - .5) * sh, (Math.random() - .5) * sh);
    g.drawImage(pages[next], 0, 0);
    const lightX = -.55, lightY = -.83;
    const Rw = t * 1250;
    // 아직 이탈 전 파편 사이의 균열선(충격파 전면까지) — 파편 아래 단계에서 먼저
    for (const s of shards) {
      const tl = t - s.tr;
      g.save();
      if (tl < 0) {
        const tr = Math.max(0, 1 - (s.tr - t) * 6);
        g.translate(s.cx + (Math.random() - .5) * tr * 1.4, s.cy + (Math.random() - .5) * tr * 1.4);
      } else {
        const sy = Math.cos(s.ph); const sy2 = Math.abs(sy) < .1 ? (sy < 0 ? -.1 : .1) : sy;
        g.translate(s.x, s.y); g.rotate(s.a); g.scale(1, sy2);
      }
      g.drawImage(s.bm, s.ox, s.oy);
      // 유리 광택 + 면 기울기 음영
      if (tl >= 0) {
        const sy = Math.abs(Math.cos(s.ph));
        const gr = g.createLinearGradient(-s.rr, -s.rr, s.rr, s.rr);
        const gp = (Math.sin(s.gl + tl * 3) * .5 + .5) * .6 + .2;
        gr.addColorStop(Math.max(0, gp - .22), 'rgba(255,255,255,0)'); gr.addColorStop(gp, 'rgba(255,255,255,.42)'); gr.addColorStop(Math.min(1, gp + .22), 'rgba(255,255,255,0)');
        g.beginPath(); s.poly.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath();
        g.fillStyle = gr; g.fill();
        g.fillStyle = `rgba(0,0,0,${(.32 * (1 - sy)).toFixed(3)})`; g.fill();
      }
      // 경계 하이라이트: 광원 쪽 면은 흰색, 반대쪽은 짙게
      const ca = Math.cos(s.a), sa = Math.sin(s.a);
      g.lineJoin = 'round';
      let lit = new Path2D(), dark = new Path2D();
      for (let i = 0; i < s.poly.length; i++) {
        const p = s.poly[i], q = s.poly[(i + 1) % s.poly.length], nn = s.nrm[i];
        const nx = nn[0] * ca - nn[1] * sa, ny = nn[0] * sa + nn[1] * ca;
        const tgt = (tl < 0 ? nn[0] : nx) * lightX + (tl < 0 ? nn[1] : ny) * lightY > 0 ? lit : dark;
        tgt.moveTo(p[0], p[1]); tgt.lineTo(q[0], q[1]);
      }
      g.strokeStyle = 'rgba(20,14,10,.55)'; g.lineWidth = 1.4; g.stroke(dark);
      g.strokeStyle = tl < 0 ? 'rgba(255,255,255,.55)' : 'rgba(255,255,255,.95)'; g.lineWidth = tl < 0 ? 1 : 1.9; g.stroke(lit);
      g.restore();
    }
    // 충격파 링 + 섬광 + 파편 가루
    if (t < .8) {
      g.strokeStyle = `rgba(255,255,255,${(1 - t / .8) * .8})`; g.lineWidth = 2.5; g.beginPath(); g.arc(P.x, P.y, Rw, 0, TAU); g.stroke();
    }
    if (t < .3) {
      const r = 60 + t * 700, gr = g.createRadialGradient(P.x, P.y, 0, P.x, P.y, r);
      gr.addColorStop(0, `rgba(255,255,255,${(1 - t / .3) * .95})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(P.x - r, P.y - r, r * 2, r * 2);
    }
    for (const p of parts) if (p.life > 0) { g.globalAlpha = Math.min(1, p.life * 2); g.fillStyle = p.c; g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
    g.globalAlpha = 1;
    g.restore();
  }

  function drawReticle(tNow) {
    const col = PAGES[cur].ink, acc = PAGES[cur].acc;
    const left = AUTO_WAIT - idleT;
    const lock = left < .7 ? 1 - Math.max(0, left) / .7 : 0;
    const r = 26 - 14 * lock;
    g.save(); g.translate(ptr.x, ptr.y);
    g.lineWidth = 2.2; g.strokeStyle = col; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    g.strokeStyle = lock > 0 ? acc : col;
    g.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + tNow * .6 * (1 - lock); g.moveTo(Math.cos(a) * (r + 3), Math.sin(a) * (r + 3)); g.lineTo(Math.cos(a) * (r + 12 - 5 * lock), Math.sin(a) * (r + 12 - 5 * lock)); }
    g.stroke();
    g.fillStyle = acc; g.beginPath(); g.arc(0, 0, 2.6 + 2 * lock, 0, TAU); g.fill();
    g.restore();
  }

  function setPage(k) {
    cur = k; idxEl.textContent = String(k + 1).padStart(2, '0');
    dots.forEach((d, i) => d.classList.toggle('is-on', i === k));
  }

  function frame(dt, now) {
    simT += dt;
    if (state === 'idle') {
      idleT += dt;
      const useMouse = ptr.inside && simT - ptr.moved < 2.2;
      const vx = W * (.5 + .27 * Math.sin(simT * .7)), vy = H * (.5 + .2 * Math.sin(simT * 1.1 + 1));
      ptr.tx = useMouse ? ptr.mx : vx; ptr.ty = useMouse ? ptr.my : vy;
      const k = idleT > AUTO_WAIT - .7 ? .04 : .2;
      ptr.x += (ptr.tx - ptr.x) * Math.min(1, k * dt * 60 / 2.4); ptr.y += (ptr.ty - ptr.y) * Math.min(1, k * dt * 60 / 2.4);
      g.drawImage(pages[cur], 0, 0);
      drawReticle(simT);
      if (idleT > AUTO_WAIT && !root.hasAttribute('data-manual')) impact(ptr.x, ptr.y);
    } else {
      const sub = 2; for (let i = 0; i < sub; i++) stepShatter(dt / sub);
      drawShatter();
      const gone = S.shards.every(s => s.y - s.rr > H + 40 || s.x < -s.rr - 80 || s.x - s.rr > W + 80);
      if (S.t > 3.6 || (gone && S.t > 1.2)) {
        setPage(S.next); state = 'idle'; idleT = -0.6; S = null;
      }
    }
  }

  /* ---------- 입력 / 라이프사이클 ---------- */
  const toCanvas = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  const onMove = e => { const [x, y] = toCanvas(e); ptr.mx = x; ptr.my = y; ptr.inside = true; ptr.moved = simT; };
  const onLeave = () => { ptr.inside = false; };
  const onDown = e => { const [x, y] = toCanvas(e); if (state === 'idle') impact(x, y); };
  const onKey = e => { if ((e.key === 'Enter' || e.key === ' ') && state === 'idle') { e.preventDefault(); impact(ptr.x, ptr.y); } };
  stage.addEventListener('pointermove', onMove); stage.addEventListener('pointerleave', onLeave);
  stage.addEventListener('pointerdown', onDown); stage.addEventListener('keydown', onKey);

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) { lastT = performance.now(); } }, { threshold: .15 });
  io.observe(root);
  const onVis = () => { if (!document.hidden) lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { if (state === 'idle') { resize(); } });
  ro.observe(stage);

  ptr.mx = 0; ptr.my = 0;
  resize(); setPage(0);
  ptr.x = W * .5; ptr.y = H * .5; idleT = -0.4;
  g.drawImage(pages[0], 0, 0);

  let acc = 0;
  const off = ctx.tick(() => {
    if (!alive || !visible || document.hidden) return;
    const now = performance.now();
    acc += now - lastT; lastT = now;
    if (acc < FPS_STEP) return;
    const dt = Math.min(.08, acc / 1000); acc = 0;
    frame(dt, now);
  });

  root._dbg176 = { impact, get state() { return state; }, get W() { return W; }, get H() { return H; } };

  return () => {
    alive = false; off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    stage.removeEventListener('pointermove', onMove); stage.removeEventListener('pointerleave', onLeave);
    stage.removeEventListener('pointerdown', onDown); stage.removeEventListener('keydown', onKey);
  };
}
