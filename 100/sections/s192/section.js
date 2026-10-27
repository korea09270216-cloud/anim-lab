// s192 — 공간 식민화(Space Colonization) 나무 — 스크롤이 성장 단계
// Runions·Lane·Prusinkiewicz 2007. 수관 모양의 어트랙터 점 군(영양분)을 흩뿌리고, 각 점은 영향 반경 안의 "가장 가까운 가지 노드 하나"에만 끌림을 준다.
// 노드는 끌림 벡터 합의 방향으로 한 마디 자라고, 킬 거리 안에 들어온 점은 소멸한다. 근접 질의는 공간 해시, 굵기는 파이프 모델(자식 단면적의 합).
// 성장 전체를 미리 시뮬레이션해 노드마다 "태어난 반복 회차"를 기록하고, 스크롤 진행도가 그 회차를 되감는다.
export default function init(root, ctx) {
  const cv = root.querySelector('[data-cv]'), g = cv.getContext('2d');
  const stat = root.querySelector('[data-stat]'), bar = root.querySelector('[data-bar]');
  if (!g) return;
  const TAU = Math.PI * 2, FPS_STEP = 1000 / 24;
  const WW = 1000, WH = 560, CAP = 5200;
  const DI = 78, DK = 9.5, SEG = 5.2, NATT = 1050, MAXIT = 320;
  let W = 0, H = 0, sc = 1, ox = 0;
  let visible = false, alive = true, lastT = 0, acc = 0, simT = 0, prog = 0, tgt = 0;
  const rnd = (() => { let s = 20260; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

  /* ---------- 어트랙터(수관 모양) ---------- */
  const CX = 640, GY = 508;
  const lobes = [[CX, 232, 205, 182, 0], [CX - 135, 268, 118, 108, 1.3], [CX + 140, 258, 112, 102, 2.2], [CX - 18, 138, 118, 82, .4]];
  const inside = (x, y) => {
    for (const [cx, cy, rx, ry, ph] of lobes) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry, a = Math.atan2(dy, dx), d2 = dx * dx + dy * dy;
      if (d2 < 1 + .16 * Math.sin(a * 5 + ph) + .08 * Math.sin(a * 11 + ph * 2)) return true;
    }
    return false;
  };
  const AX = new Float32Array(NATT), AY = new Float32Array(NATT), AK = new Int32Array(NATT).fill(1e9);
  let na = 0;
  (function genAttractors() {
    const cell = 9, cols = Math.ceil(WW / cell) + 1, hash = new Map();
    for (let tries = 0; tries < 60000 && na < NATT; tries++) {
      const x = 340 + rnd() * 600, y = 20 + rnd() * 420; if (!inside(x, y)) continue;
      const kx = x / cell | 0, ky = y / cell | 0; let ok = true;
      for (let a = -1; a <= 1 && ok; a++) for (let b = -1; b <= 1 && ok; b++) { const l = hash.get((ky + b) * cols + kx + a); if (l) for (const q of l) { const dx = AX[q] - x, dy = AY[q] - y; if (dx * dx + dy * dy < 8.6 * 8.6) { ok = false; break; } } }
      if (!ok) continue;
      AX[na] = x; AY[na] = y; const key = ky * cols + kx; (hash.get(key) || hash.set(key, []).get(key)).push(na); na++;
    }
  })();

  /* ---------- 성장 시뮬레이션 (공간 해시 근접 질의) ---------- */
  const X = new Float32Array(CAP), Y = new Float32Array(CAP), P = new Int32Array(CAP).fill(-1), BORN = new Int32Array(CAP), DEP = new Int16Array(CAP), NCH = new Uint8Array(CAP);
  let n = 0, K = 0;
  (function grow() {
    const cs = DI, cols = Math.ceil((WW + 200) / cs) + 2, rows = Math.ceil((WH + 200) / cs) + 2;
    const head = new Int32Array(cols * rows).fill(-1), next = new Int32Array(CAP).fill(-1);
    const hk = (x, y) => ((Math.max(0, y) / cs | 0) + 1) * cols + (Math.min(WW + 100, Math.max(0, x)) / cs | 0) + 1;
    const addNode = (x, y, p, it) => { const k = n++; X[k] = x; Y[k] = y; P[k] = p; BORN[k] = it; DEP[k] = p >= 0 ? DEP[p] + 1 : 0; if (p >= 0) NCH[p]++; const h = hk(x, y); next[k] = head[h]; head[h] = k; return k; };
    addNode(CX, GY, -1, 0);
    const sx = new Float32Array(CAP), sy = new Float32Array(CAP), sn = new Uint16Array(CAP);
    let alive_ = na;
    for (let it = 1; it <= MAXIT && alive_ > 0 && n < CAP - 80; it++) {
      sn.fill(0, 0, n); const touched = [];
      for (let a = 0; a < na; a++) {
        if (AK[a] < 1e9) continue;
        const ax = AX[a], ay = AY[a], cx = ax / cs | 0, cy = ay / cs | 0; let best = -1, bd = DI * DI;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          for (let k = head[(cy + dy + 1) * cols + cx + dx + 1]; k >= 0; k = next[k]) { const ddx = X[k] - ax, ddy = Y[k] - ay, d = ddx * ddx + ddy * ddy; if (d < bd) { bd = d; best = k; } }
        }
        if (best < 0) continue;
        const l = Math.sqrt(bd) || 1; if (!sn[best]) { sx[best] = 0; sy[best] = 0; touched.push(best); }
        sx[best] += (ax - X[best]) / l; sy[best] += (ay - Y[best]) / l; sn[best]++;
      }
      let added = 0;
      for (const k of touched) {
        if (n >= CAP - 2 || NCH[k] > 3) continue;
        let dx = sx[k], dy = sy[k]; const l = Math.hypot(dx, dy); if (l < 1e-4) continue;
        dx /= l; dy /= l; dx += (rnd() - .5) * .22; dy += (rnd() - .5) * .22 - .04; const l2 = Math.hypot(dx, dy); dx /= l2; dy /= l2;
        // 자기 부모 방향과 거의 같은 자리 중복 방지
        addNode(X[k] + dx * SEG, Y[k] + dy * SEG, k, it); added++;
      }
      if (!added) {
        // 영향권에 아무도 없으면(줄기가 수관에 닿기 전) 가장 높은 노드를 수관 쪽으로 위로 뻗는다 (부트스트랩 줄기)
        let hi = 0; for (let k = 1; k < n; k++) if (Y[k] < Y[hi]) hi = k;
        if (Y[hi] > 400) { const ddx = (CX - X[hi]) * .02, l = Math.hypot(ddx, 1); addNode(X[hi] + ddx / l * SEG, Y[hi] - 1 / l * SEG, hi, it); }
      }
      // 킬: 가지에서 킬 거리 안으로 들어온 어트랙터 제거
      for (let a = 0; a < na; a++) {
        if (AK[a] < 1e9) continue; const ax = AX[a], ay = AY[a], cx = ax / cs | 0, cy = ay / cs | 0; let kill = false;
        for (let dy = -1; dy <= 1 && !kill; dy++) for (let dx = -1; dx <= 1 && !kill; dx++) for (let k = head[(cy + dy + 1) * cols + cx + dx + 1]; k >= 0; k = next[k]) { const ddx = X[k] - ax, ddy = Y[k] - ay; if (ddx * ddx + ddy * ddy < DK * DK) { kill = true; break; } }
        if (kill) { AK[a] = it; alive_--; }
      }
      K = it;
      if (alive_ <= na * .03) break; // 남은 양분이 3% 이하면 성장 종료(닿지 않는 점 때문에 끝없이 늘어지지 않게)
    }
    for (let a = 0; a < na; a++) if (AK[a] >= 1e9) AK[a] = K; // 마지막에 남은 점은 마지막 회차에 흡수된 것으로 처리
  })();

  /* ---------- 잎·꽃 / 꽃잎 ---------- */
  const leaves = [];
  for (let i = 1; i < n; i++) {
    const tip = NCH[i] === 0, twig = DEP[i] > 14 && rnd() < .16;
    if (!tip && !twig) continue;
    const m = tip ? 2 + (rnd() * 2 | 0) : 1;
    for (let q = 0; q < m; q++) {
      const r = rnd(); leaves.push({ i, a: rnd() * TAU, s: 4.2 + rnd() * 5.5, kind: r < .5 ? 0 : r < .62 ? 1 : r < .8 ? 2 : r < .9 ? 3 : 4, d: BORN[i] / K * .5 + rnd() * .22, ox: (rnd() - .5) * 6, oy: (rnd() - .5) * 6 });
    }
  }
  const LEAF_COL = ['#6fb36a', '#8cc77a', '#ff9db9', '#ffc4d6', '#f6e27a'];
  const clouds = [[40, 90, 34, 18, 22], [420, 160, 42, 20, 16], [800, 60, 30, 15, 28], [1100, 200, 38, 18, 19]].map(([x, y, w, h, v]) => ({ x, y, w, h, v }));
  const motes = Array.from({ length: 46 }, () => ({ x: rnd() * 1060, y: 60 + rnd() * 430, v: 10 + rnd() * 22, f: .5 + rnd() * 1.1, ph: rnd() * TAU, r: 1.6 + rnd() * 2.4 }));
  const petals = Array.from({ length: 42 }, () => ({ x: CX - 260 + rnd() * 520, y: rnd() * 440, v: 18 + rnd() * 34, ph: rnd() * TAU, s: 3 + rnd() * 3 }));

  /* ---------- 렌더 ---------- */
  const frac = new Float32Array(CAP), rn = new Float32Array(CAP), OX = new Float32Array(CAP), OY = new Float32Array(CAP);
  const bgCv = document.createElement('canvas');
  function paintBg() {
    bgCv.width = W; bgCv.height = H; const p = bgCv.getContext('2d');
    p.setTransform(sc, 0, 0, sc, ox, 0);
    let gr = p.createLinearGradient(0, 0, 0, WH); gr.addColorStop(0, '#fbf5e4'); gr.addColorStop(.7, '#f6e9d2'); gr.addColorStop(1, '#efdcc0');
    p.fillStyle = gr; p.fillRect(-ox / sc, 0, W / sc, WH);
    p.fillStyle = '#ffd9a8'; p.beginPath(); p.arc(860, 120, 70, 0, TAU); p.fill();
    p.strokeStyle = 'rgba(255,200,150,.5)'; p.lineWidth = 2; for (let i = 1; i < 4; i++) { p.beginPath(); p.arc(860, 120, 70 + i * 22, 0, TAU); p.stroke(); }
    p.fillStyle = '#cfe3b4'; p.beginPath(); p.ellipse(220, 560, 520, 150, 0, 0, TAU); p.fill();
    p.fillStyle = '#b9d79c'; p.beginPath(); p.ellipse(900, 565, 480, 120, 0, 0, TAU); p.fill();
    p.fillStyle = '#8fbf7c'; p.fillRect(-ox / sc, GY, W / sc, WH - GY + 4);
    p.fillStyle = '#7eb06c'; p.beginPath(); p.ellipse(CX, GY + 2, 170, 10, 0, 0, TAU); p.fill();
    p.strokeStyle = '#6fa05e'; p.lineWidth = 1.5; p.beginPath();
    for (let i = 0; i < 160; i++) { const x = rnd() * WW * 1.2 - 100, y = GY + 4 + rnd() * 40; p.moveTo(x, y); p.lineTo(x + (rnd() - .5) * 6, y - 5 - rnd() * 7); }
    p.stroke();
  }
  function resize() {
    const r = cv.getBoundingClientRect(); const w = Math.max(480, Math.round(Math.min(r.width, 1500) * .85)), h = Math.max(270, Math.round(w * r.height / Math.max(1, r.width)));
    if (Math.abs(w - W) < 6 && Math.abs(h - H) < 6) return;
    W = cv.width = w; H = cv.height = h; sc = H / WH; ox = (W - WW * sc) / 2; paintBg();
  }

  const WIDTHS = [.9, 1.4, 2.1, 3.2, 4.8, 7, 99], COLS = ['#7a5a3a', '#6e4f33', '#614529', '#553c24', '#4a331e', '#3f2a19', '#35231a'];
  function render(time, itf, bloom) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(bgCv, 0, 0);
    g.setTransform(sc, 0, 0, sc, ox, 0);
    // 천천히 흘러가는 구름 (idle 모션)
    { const cp = new Path2D(); for (const c of clouds) { const x = (c.x + time * c.v) % 1400 - 200; for (let q = 0; q < 4; q++) { cp.moveTo(x + q * 46 + c.w, c.y - q % 2 * 10); cp.ellipse(x + q * 46, c.y - q % 2 * 10, c.w, c.h, 0, 0, TAU); } } g.fillStyle = 'rgba(196,214,230,.55)'; g.fill(cp); }
    // 떠다니는 꽃가루 (idle 모션)
    { const mp = new Path2D(); for (const m of motes) { const x = (m.x + time * m.v) % 1060 - 30, y = m.y + Math.sin(time * m.f + m.ph) * 16, r = m.r * (.75 + .25 * Math.sin(time * 3 + m.ph)); mp.moveTo(x + r, y); mp.arc(x, y, r, 0, TAU); } g.fillStyle = 'rgba(255,214,120,.8)'; g.fill(mp); }
    // 남은 양분(어트랙터): 아직 소비되지 않은 점이 반짝이며 가지가 향할 곳을 보여준다
    g.fillStyle = 'rgba(94,168,92,.85)';
    for (let a = 0; a < na; a++) { if (AK[a] > itf) { const tw = .7 + .3 * Math.sin(time * 2.2 + a); const s = 1.7 * tw; g.fillRect(AX[a] - s / 2, AY[a] - s / 2, s, s); } }
    // 가지 진행 (생성 회차 → 마디 길이 비율)
    let vis = 0;
    for (let i = 1; i < n; i++) { const f = itf - (BORN[i] - 1); frac[i] = f <= 0 ? 0 : f >= 1 ? 1 : f; if (frac[i] > 0) vis++; }
    rn.fill(0, 0, n);
    for (let i = n - 1; i >= 1; i--) {
      if (frac[i] <= 0) continue;
      if (rn[i] === 0) rn[i] = Math.pow(.46 * Math.max(.3, frac[i]), 2.2);
      rn[P[i]] += rn[i];
    }
    // 바람 흔들림: 부모의 오프셋을 누적(가는 가지일수록 더 흔들림)
    OX[0] = 0; OY[0] = 0;
    const paths = WIDTHS.map(() => new Path2D());
    for (let i = 1; i < n; i++) {
      if (frac[i] <= 0) continue;
      const r = Math.pow(rn[i], 1 / 2.2), p = P[i];
      const w = Math.sin(time * 1.25 + X[i] * .006 + DEP[i] * .06) * .6 + Math.sin(time * .53 + Y[i] * .01) * .4;
      const k = .62 / (.7 + r * .9) * (itf / K * .8 + .2);
      OX[i] = OX[p] + w * k * SEG * .1; OY[i] = OY[p] + Math.cos(time * 1.1 + X[i] * .005) * k * SEG * .035;
      const f = frac[i], x0 = X[p] + OX[p], y0 = Y[p] + OY[p], x1 = X[p] + (X[i] - X[p]) * f + OX[i], y1 = Y[p] + (Y[i] - Y[p]) * f + OY[i];
      let b = 0; while (b < WIDTHS.length - 1 && r * 2 > WIDTHS[b]) b++;
      paths[b].moveTo(x0, y0); paths[b].lineTo(x1, y1);
    }
    g.lineCap = 'round'; g.lineJoin = 'round';
    // 굵기는 파이프 모델의 실제 반지름을 구간 대표값으로 그린다
    const rep = [.55, .85, 1.25, 1.9, 2.9, 4.4, 7];
    for (let b = WIDTHS.length - 1; b >= 0; b--) { g.strokeStyle = COLS[b]; g.lineWidth = rep[b] * 2; g.stroke(paths[b]); }
    // 잎·꽃
    if (bloom > 0) {
      const pl = [0, 1, 2, 3, 4].map(() => new Path2D());
      for (const L of leaves) {
        const bp = Math.max(0, Math.min(1, (bloom * 1.5 - L.d) / .45)); if (bp <= 0 || frac[L.i] < 1) continue;
        const s = L.s * (bp < .7 ? bp / .7 * 1.12 : 1.12 - (bp - .7) / .3 * .12);
        const x = X[L.i] + OX[L.i] + L.ox, y = Y[L.i] + OY[L.i] + L.oy;
        if (L.kind === 2 || L.kind === 3) { // 꽃: 다섯 장 꽃잎
          for (let q = 0; q < 5; q++) { const a = L.a + q * TAU / 5; pl[L.kind].moveTo(x + Math.cos(a) * s * .55 + s * .46, y + Math.sin(a) * s * .55); pl[L.kind].ellipse(x + Math.cos(a) * s * .55, y + Math.sin(a) * s * .55, s * .46, s * .32, a, 0, TAU); }
          pl[4].moveTo(x + s * .24, y); pl[4].arc(x, y, s * .24, 0, TAU);
        } else { pl[L.kind].moveTo(x + s, y); pl[L.kind].ellipse(x, y, s, s * .5, L.a, 0, TAU); }
      }
      for (let k = 0; k < 5; k++) { g.fillStyle = LEAF_COL[k]; g.fill(pl[k]); }
      // 떨어지는 꽃잎 (idle 모션)
      if (bloom > .85) {
        g.fillStyle = 'rgba(255,170,198,.9)';
        for (const q of petals) { const yy = (q.y + time * q.v) % 470, xx = q.x + Math.sin(time * .9 + q.ph) * 26 + yy * .12; g.beginPath(); g.ellipse(xx, yy + 20, q.s, q.s * .55, time * 1.4 + q.ph, 0, TAU); g.fill(); }
      }
    }
    // 성장 단계 표기
    {
      const alive_ = (() => { let c = 0; for (let a = 0; a < na; a++) if (AK[a] > itf) c++; return c; })();
      const pct = Math.round(Math.min(1, prog) * 100);
      stat.textContent = `성장 ${pct}% · 가지 ${vis.toLocaleString('ko-KR')} · 남은 양분 ${alive_.toLocaleString('ko-KR')}${bloom > .05 ? ' · 개화 ' + Math.round(bloom * 100) + '%' : ''}`;
      bar.style.width = pct + '%';
    }
  }

  /* ---------- 스크롤 / 루프 ---------- */
  function scrollP() { const r = root.getBoundingClientRect(); const span = Math.max(1, r.height - innerHeight); return Math.max(0, Math.min(1, -r.top / span)); }
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) lastT = performance.now(); }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { if (!document.hidden) lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => resize()); ro.observe(cv);
  resize();
  const GROW_END = .76;
  let tStart = 0;
  const frameDraw = () => {
    if (!tStart) tStart = performance.now(); const wall = (performance.now() - tStart) / 1000;
    const intro = Math.min(.34, wall * .03);
    tgt = Math.max(scrollP(), intro); prog += (tgt - prog) * .16;
    const itf = Math.min(1, prog / GROW_END) * (K + 6), bloom = Math.max(0, (prog - GROW_END) / (1 - GROW_END));
    render(wall, itf, Math.min(1, bloom));
  };
  frameDraw();
  const off = ctx.tick(() => {
    if (!alive || !visible || document.hidden) return;
    const now = performance.now(); acc += now - lastT; lastT = now;
    if (acc < FPS_STEP) return; const dt = Math.min(.08, acc / 1000); acc = 0;
    simT += dt; frameDraw();
  });
  root._dbg192 = { get n() { return n; }, get K() { return K; }, get na() { return na; }, get leaves() { return leaves.length; }, setProg(v) { prog = v; tgt = v; } };
  return () => { alive = false; off(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); };
}
