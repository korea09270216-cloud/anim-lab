// s191 — DBM(유전체 파괴 모델) 번개
// 라플라스 방정식 ∇²φ=0 (방전 트리 φ=0, 지면·건물 φ=1, 나머지 경계 노이만)을 red-black SOR 로 이완시키고,
// 트리에 인접한 후보 격자를 확률 ∝ φ^η (η=1)로 골라 한 칸씩 붙인다(Niemeyer–Pietronero–Wiesmann 1984).
// 접지되면 뿌리까지 역추적한 주 채널이 귀환뇌격으로 번쩍이고, 가지는 하위 노드 수(전류량)에 비례해 빛난다.
export default function init(root, ctx) {
  const bg = root.querySelector('[data-bg]'), fx = root.querySelector('[data-fx]');
  const stat = root.querySelector('[data-stat]');
  const bgc = bg.getContext('2d'), g = fx.getContext('2d');
  if (!bgc || !g) return;
  const GW = 160, GH = 90, N = GW * GH, ETA = 1, OMEGA = 1.86, TAU = Math.PI * 2, FPS_STEP = 1000 / 24;
  const phi = new Float32Array(N), st = new Uint8Array(N), isCand = new Uint8Array(N), candPos = new Int32Array(N), nodeOf = new Int32Array(N).fill(-1);
  const top = new Int16Array(GW), ground = new Uint8Array(N);
  const NX = new Float32Array(N), NY = new Float32Array(N), NP = new Int32Array(N), NC = new Int32Array(N), NCell = new Int32Array(N), NAge = new Float32Array(N);
  let fT = 0, cand = [], n = 0, W = 0, H = 0, S = 4, phase = 'grow', phaseT = 0, strike = -1, main = null, cnt = null, maxCnt = 1, seedX = 0;
  let visible = false, alive = true, lastT = 0, acc = 0, simT = 0, rain = [], bursts = 0, simSteps = 0;
  const rnd = (() => { let s = 12345; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; })();

  /* ---------- 지형 (접지 전극) ---------- */
  function buildTerrain() {
    st.fill(0); phi.fill(0);
    const base = GH - 5;
    top.fill(base - 5);
    let x = 0;
    while (x < GW) {
      const w = 3 + (rnd() * 7 | 0), h = 7 + (rnd() * 14 | 0);
      for (let k = 0; k < w && x + k < GW; k++) top[x + k] = base - h;
      x += w + (rnd() < .25 ? 1 : 0);
    }
    // 피뢰침처럼 높은 첨탑 3개
    for (const [cx, hh] of [[46, 36], [118, 40], [88, 31]]) { for (let k = -1; k <= 1; k++) top[cx + k] = Math.min(top[cx + k], base - hh * (k === 0 ? 1 : .62)); }
    for (let xx = 0; xx < GW; xx++) for (let y = top[xx]; y < GH; y++) { st[y * GW + xx] = 2; phi[y * GW + xx] = 1; }
    ground.set(st);
  }

  /* ---------- 배경(정적) ---------- */
  function paintBg() {
    const p = bgc, sx = S;
    let gr = p.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#1b1252'); gr.addColorStop(.42, '#4a2c98'); gr.addColorStop(.78, '#d85f8e'); gr.addColorStop(1, '#ffb37c');
    p.fillStyle = gr; p.fillRect(0, 0, W, H);
    // 멀리 있는 안개 낀 도시
    p.fillStyle = 'rgba(96,62,150,.65)';
    for (let x = 0; x < W; x += 28) { const h = H * (.16 + ((x * 37) % 11) / 90); p.fillRect(x, H - h - H * .06, 30, h + H * .06); }
    // 구름 덩어리: 겹치는 불규칙 블롭 + 아래쪽에서 노을빛을 받는 테두리
    for (let i = 0; i < 52; i++) {
      const cx = W * (-.04 + rnd() * 1.08), cy = H * (.01 + Math.pow(rnd(), 1.4) * .24), r = H * (.06 + rnd() * .15);
      const rg = p.createRadialGradient(cx, cy, 0, cx, cy, r);
      rg.addColorStop(0, 'rgba(46,28,108,.95)'); rg.addColorStop(.6, 'rgba(58,36,122,.6)'); rg.addColorStop(1, 'rgba(58,36,122,0)');
      p.fillStyle = rg; p.beginPath(); p.arc(cx, cy, r, 0, TAU); p.fill();
    }
    for (let i = 0; i < 30; i++) {
      const cx = W * rnd(), cy = H * (.17 + rnd() * .1), r = H * (.05 + rnd() * .09);
      const rg = p.createRadialGradient(cx, cy, 0, cx, cy, r); rg.addColorStop(0, 'rgba(236,120,170,.26)'); rg.addColorStop(1, 'rgba(236,120,170,0)');
      p.fillStyle = rg; p.beginPath(); p.arc(cx, cy, r, 0, TAU); p.fill();
    }
    // 가까운 도시 (= 접지 전극과 동일한 격자)
    p.fillStyle = '#150c36';
    for (let x = 0; x < GW; x++) { const t0 = top[x]; if (t0 < GH) p.fillRect(x * sx, t0 * sx, sx + .5, H - t0 * sx); }
    p.fillStyle = 'rgba(255,214,150,.9)';
    for (let i = 0; i < 360; i++) { const x = rnd() * GW | 0, y = (top[x] + 2 + rnd() * (GH - top[x] - 4)) | 0; if (y < GH - 4 && top[x] < GH - 8) p.fillRect(x * sx, y * sx, sx * .6, sx * .75); }
  }

  /* ---------- DBM 코어 ---------- */
  function relax(sweeps) {
    for (let s = 0; s < sweeps; s++) for (let col = 0; col < 2; col++) for (let y = 0; y < GH; y++) {
      const row = y * GW, up = y > 0 ? -GW : 0, dn = y < GH - 1 ? GW : 0;
      for (let x = (y + col) & 1; x < GW; x += 2) {
        const i = row + x; if (st[i]) continue;
        const v = phi[i];
        phi[i] = v + OMEGA * ((phi[i + (x > 0 ? -1 : 0)] + phi[i + (x < GW - 1 ? 1 : 0)] + phi[i + up] + phi[i + dn]) * .25 - v);
      }
    }
  }
  function candAdd(c) { if (isCand[c]) return; isCand[c] = 1; candPos[c] = cand.length; cand.push(c); }
  function candDel(c) { if (!isCand[c]) return; const p = candPos[c], last = cand.pop(); if (last !== c) { cand[p] = last; candPos[last] = p; } isCand[c] = 0; }
  function reset() {
    st.set(ground); isCand.fill(0); nodeOf.fill(-1); cand = []; n = 0; strike = -1; main = null; cnt = null; phase = 'grow'; phaseT = 0;
    seedX = (GW * (.4 + rnd() * .38)) | 0; const sy = 11;
    addCell(sy * GW + seedX, -1);
    // 초기 장: 점진 워밍업 (프레임당 분할하지 않고 한 번에 150스윕 ≈ 20ms)
    for (let i = 0; i < N; i++) if (!st[i]) phi[i] = (i / GW | 0) / GH;
    relax(140);
  }
  function addCell(c, parentNode) {
    const x = c % GW, y = c / GW | 0;
    st[c] = 1; phi[c] = 0; candDel(c);
    const k = n++; nodeOf[c] = k; NCell[k] = c; NP[k] = parentNode; NC[k] = 1; NAge[k] = simT;
    NX[k] = (x + .5 + (rnd() - .5) * .55) * S; NY[k] = (y + .5 + (rnd() - .5) * .55) * S;
    let hit = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
      const nb = yy * GW + xx; if (st[nb] === 0) candAdd(nb); else if (st[nb] === 2) hit = true;
    }
    return hit ? k : -1;
  }
  function pickCandidate() {
    let sum = 0; const m = cand.length;
    for (let i = 0; i < m; i++) { const v = Math.max(0, phi[cand[i]]); sum += ETA === 1 ? v : Math.pow(v, ETA); }
    let r = rnd() * sum;
    for (let i = 0; i < m; i++) { const v = Math.max(0, phi[cand[i]]); r -= ETA === 1 ? v : Math.pow(v, ETA); if (r <= 0) return cand[i]; }
    return cand[m - 1];
  }
  function parentOf(c) {
    const x = c % GW, y = c / GW | 0; let best = -1, bd = 9;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue; const xx = x + dx, yy = y + dy; if (xx < 0 || xx >= GW || yy < 0 || yy >= GH) continue;
      const nb = yy * GW + xx; if (st[nb] !== 1) continue;
      const d = dx * dx + dy * dy + rnd() * .5; if (d < bd) { bd = d; best = nodeOf[nb]; }
    }
    return best;
  }
  function growStep(count) {
    for (let k = 0; k < count && phase === 'grow'; k++) {
      const c = pickCandidate(), par = parentOf(c);
      const hit = addCell(c, par);
      if (hit >= 0) { onStrike(hit); break; }
    }
  }
  function onStrike(k) {
    strike = k; phase = 'flash'; phaseT = 0; fT = 0;
    // 하위 노드 수(전류량): 자식이 항상 부모보다 늦게 생성되므로 역순 누적
    cnt = new Float32Array(n).fill(1); for (let i = n - 1; i > 0; i--) if (NP[i] >= 0) cnt[NP[i]] += cnt[i];
    main = new Uint8Array(n); for (let i = k; i >= 0; i = NP[i]) main[i] = 1;
    maxCnt = cnt[0];
  }

  /* ---------- 렌더 ---------- */
  function pulse(t) { let e = 0; for (const [tp, a] of [[0, 1], [.13, .85], [.3, .6]]) if (t > tp) e += a * Math.exp(-(t - tp) / .085); return e + .5 * Math.exp(-t / 1.0); }
  function draw(dt) {
    g.clearRect(0, 0, W, H);
    // 빗줄기 (idle 모션)
    g.strokeStyle = 'rgba(200,210,255,.26)'; g.lineWidth = 1; g.beginPath();
    for (const r of rain) { r.y += r.v * dt; r.x -= r.v * dt * .18; if (r.y > H) { r.y = -20; r.x = rnd() * W * 1.1; } g.moveTo(r.x, r.y); g.lineTo(r.x - 4, r.y + 15); }
    g.stroke();
    if (!n) return;
    const sec = phase === 'grow' ? 0 : fT;
    const E = phase === 'grow' ? 0 : pulse(sec);
    root.style.setProperty('--fl', Math.min(1, ctx.reduced ? E * .3 : E).toFixed(3));
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (phase === 'grow') {
      const all = new Path2D(), hot = new Path2D();
      for (let i = 1; i < n; i++) { const p = NP[i]; if (p < 0) continue; const P = (simT - NAge[i]) < .35 ? hot : all; P.moveTo(NX[p], NY[p]); P.lineTo(NX[i], NY[i]); }
      g.strokeStyle = 'rgba(120,150,255,.2)'; g.lineWidth = 5; g.stroke(all);
      g.strokeStyle = 'rgba(190,210,255,.8)'; g.lineWidth = 1.6; g.stroke(all);
      g.strokeStyle = 'rgba(150,180,255,.35)'; g.lineWidth = 6; g.stroke(hot);
      g.strokeStyle = '#fff'; g.lineWidth = 2.2; g.stroke(hot);
      // 선두 노드의 점
      g.fillStyle = '#fff'; for (let i = Math.max(1, n - 7); i < n; i++) { g.beginPath(); g.arc(NX[i], NY[i], 2.2, 0, TAU); g.fill(); }
    } else {
      // 가지: 전류량(하위 노드 수)에 비례해 굵기·밝기. 주 채널: 귀환뇌격
      const buckets = [new Path2D(), new Path2D(), new Path2D()], mainP = new Path2D();
      for (let i = 1; i < n; i++) { const p = NP[i]; if (p < 0) continue; const s = Math.sqrt(cnt[i] / maxCnt); const P = main[i] ? mainP : (s > .22 ? buckets[2] : s > .09 ? buckets[1] : buckets[0]); P.moveTo(NX[p], NY[p]); P.lineTo(NX[i], NY[i]); }
      const after = Math.exp(-sec / .9);
      g.strokeStyle = `rgba(120,150,255,${(.14 + .2 * after).toFixed(3)})`; g.lineWidth = 4; g.stroke(buckets[0]);
      g.strokeStyle = `rgba(190,210,255,${(.35 + .3 * after).toFixed(3)})`; g.lineWidth = 1; g.stroke(buckets[0]);
      g.strokeStyle = `rgba(150,180,255,${(.2 + .25 * after).toFixed(3)})`; g.lineWidth = 6; g.stroke(buckets[1]);
      g.strokeStyle = `rgba(215,228,255,${(.5 + .4 * after).toFixed(3)})`; g.lineWidth = 1.6; g.stroke(buckets[1]);
      g.strokeStyle = `rgba(150,180,255,${(.25 + .3 * after).toFixed(3)})`; g.lineWidth = 9; g.stroke(buckets[2]);
      g.strokeStyle = `rgba(235,242,255,${(.6 + .4 * after).toFixed(3)})`; g.lineWidth = 2.4; g.stroke(buckets[2]);
      const k = Math.min(1, E);
      g.strokeStyle = `rgba(110,150,255,${(.12 + .3 * k).toFixed(3)})`; g.lineWidth = 8 + 26 * k; g.stroke(mainP);
      g.strokeStyle = `rgba(180,205,255,${(.35 + .5 * k).toFixed(3)})`; g.lineWidth = 4 + 7 * k; g.stroke(mainP);
      g.strokeStyle = `rgba(255,255,255,${(.7 + .3 * k).toFixed(3)})`; g.lineWidth = 1.8 + 2.4 * k; g.stroke(mainP);
      // 구름 밑면 발광 + 접지점 스파크
      const rr = H * .6, rg = g.createRadialGradient(NX[0], NY[0], 0, NX[0], NY[0], rr);
      rg.addColorStop(0, `rgba(200,220,255,${(.5 * k).toFixed(3)})`); rg.addColorStop(1, 'rgba(200,220,255,0)'); g.fillStyle = rg; g.fillRect(NX[0] - rr, NY[0] - rr, rr * 2, rr * 2);
      const sx = NX[strike], sy = NY[strike], sr = 20 + 40 * k, sg = g.createRadialGradient(sx, sy, 0, sx, sy, sr);
      sg.addColorStop(0, `rgba(255,255,255,${(.9 * k).toFixed(3)})`); sg.addColorStop(1, 'rgba(160,190,255,0)'); g.fillStyle = sg; g.fillRect(sx - sr, sy - sr, sr * 2, sr * 2);
    }
  }

  function step(dt) {
    simT += dt; phaseT += dt; fT += dt;
    if (phase === 'grow') {
      // 프레임당 한 번의 이완마다 후보 2칸 (준정적 근사) — 총 ~28칸/프레임
      const cells = 14; const t0 = performance.now();
      for (let i = 0; i < cells && phase === 'grow'; i++) { relax(5); growStep(2); if (performance.now() - t0 > 24) break; }
      if (n > 5200) reset();
    } else if (phase === 'flash') {
      relax(0); if (phaseT > 2.6) { phase = 'dark'; phaseT = 0; }
    } else if (phase === 'dark') {
      if (phaseT > .9) reset();
    }
    draw(dt);
    if (phase === 'dark') root.style.setProperty('--fl', '0');
    if ((simT * 24 | 0) % 6 === 0) stat.textContent = `방전 트리 ${n.toLocaleString('ko-KR')}칸 · 후보 ${cand.length}칸 · ${phase === 'grow' ? '리더 전진 중' : '접지! 귀환뇌격'}`;
  }

  function resize() {
    const r = root.getBoundingClientRect(); const w = Math.max(480, Math.round(Math.min(r.width, 1440) * .66));
    if (Math.abs(w - W) < 6) return;
    W = bg.width = fx.width = w; H = bg.height = fx.height = Math.round(w * GH / GW); S = W / GW;
    paintBg();
  }

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) lastT = performance.now(); }, { threshold: .1 });
  io.observe(root);
  const onVis = () => { if (!document.hidden) lastT = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => resize()); ro.observe(root);

  for (let i = 0; i < 70; i++) rain.push({ x: rnd() * 1500, y: rnd() * 800, v: 520 + rnd() * 380 });
  buildTerrain(); resize(); reset();
  // 5초 안에 의미 있는 첫 화면: 보이기 전에 미리 몇십 칸 키워 둔다
  for (let i = 0; i < 6; i++) { relax(5); growStep(2); }
  draw(0);
  const off = ctx.tick(() => {
    if (!alive || !visible || document.hidden) return;
    const now = performance.now(); acc += now - lastT; lastT = now;
    if (acc < FPS_STEP) return; const dt = Math.min(.1, acc / 1000); acc = 0;
    step(dt);
  });
  root._dbg191 = { get n() { return n; }, get phase() { return phase; }, reset, step };
  return () => { alive = false; off(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); root.style.removeProperty('--fl'); };
}
