// s164 실루엣 텍스트 랩(Bad Apple 류) — 절차적으로 춤추는 흑백 실루엣이 문단 속에 빈 구간을 만든다.
// ① 매 프레임 실루엣(춤추는 인형 + 커피콩 + 커서 + DOM 박스)을 저해상도 마스크(셀 8px)에 래스터화
// ② 텍스트 줄 밴드마다 마스크를 스캔해 "막힌 구간(run-length)"을 구하고 단 폭에서 빼 슬롯으로 변환
// ③ 슬롯을 어절(keep-all, 하이픈 없음) 단위로 채우며 커서를 단·슬롯 사이로 이어간다 — 줄 이탈 히스테리시스(공백 24% 수축)로 깜빡임 억제
export default function init(root, ctx) {
  const stage = root.querySelector('.s164__stage');
  const cv = root.querySelector('.s164__cv');
  const g = cv.getContext('2d');
  const mk = document.createElement('canvas');
  const mg = mk.getContext('2d', { willReadFrequently: true });
  if (!g || !mg) { root.classList.add('is-static'); return; }
  const ui = root.querySelector('.s164__ui');
  const SANS = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const CREAM = '#f8f1e2', LIME = '#d8ff3d';

  /* ───────── 1) DOM 미러에서 본문 읽기 ───────── */
  const paras = [...root.querySelectorAll('.s164__sr p')].map(p => {
    const toks = []; let carry = '', cAcc = false;
    const flush = () => { if (carry) toks.push({ t: carry, acc: cAcc }); carry = ''; cAcc = false; };
    (function walk(n, acc) {
      n.childNodes.forEach(c => {
        if (c.nodeType === 3) {
          c.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            if (/^\s+$/.test(part)) flush(); else { carry += part; cAcc = cAcc || acc; }
          });
        } else walk(c, acc || c.tagName === 'B');
      });
    })(p, false);
    flush();
    return toks;
  });
  const REPS = 3;                      // 본문이 모자라면 문단을 순환시킨다(단어 상태는 순환마다 별도)
  const words = [];
  for (let r = 0, pi = 0; r < REPS; r++) paras.forEach(toks => { toks.forEach((o, k) => words.push({ t: o.t, acc: o.acc, pi, first: k === 0, w: 0, x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0, key: -1, init: false })); pi++; });

  /* ───────── 2) 치수 ───────── */
  let W = 0, H = 0, dpr = 1, narrow = false, st = null;
  let cols = [], textTop = 0, textBot = 0, cell = 8, mw = 0, mh = 0, occ = null, tmp = null, rects = [];
  const cache = new Map();
  const PAD = 11;
  function build() {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 40 || h < 40) return false;
    W = w; H = h; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    narrow = W < 700;
    const bfs = narrow ? 15 : clamp(W / 80, 14, 25);
    st = { font: `500 ${bfs}px ${SANS}`, bold: `800 ${bfs}px ${SANS}`, fs: bfs, lh: Math.round(bfs * 1.62), mb: Math.round(bfs * 0.62), minW: bfs * 3 };
    cache.clear();
    g.font = st.font; st.sp = g.measureText(' ').width || bfs * 0.28;
    words.forEach(wd => {
      const key = (wd.acc ? 'b|' : 'n|') + wd.t; let v = cache.get(key);
      if (v === undefined) { g.font = wd.acc ? st.bold : st.font; v = g.measureText(wd.t).width; cache.set(key, v); }
      wd.w = v;
    });
    const padX = Math.max(22, W * 0.04);
    textTop = narrow ? 22 : 30; textBot = H - (narrow ? 26 : 30);
    const n = narrow ? 1 : 2, gap = 40, cw = (W - 2 * padX - gap * (n - 1)) / n;
    cols = Array.from({ length: n }, (_, i) => ({ x: padX + i * (cw + gap), w: cw }));
    cell = narrow ? 7 : 8;
    mw = Math.ceil(W / cell); mh = Math.ceil(H / cell);
    mk.width = mw; mk.height = mh; occ = new Uint8Array(mw * mh); tmp = new Uint8Array(mw);
    // DOM 박스(브랜드·타이틀·CTA)는 직사각형 장애물
    const sr = stage.getBoundingClientRect();
    rects = [...ui.querySelectorAll('.s164__brand, .s164__title h2, .s164__title p, .s164__cta')].map(el => {
      const b = el.getBoundingClientRect();
      return { x0: b.left - sr.left, y0: b.top - sr.top, x1: b.right - sr.left, y1: b.bottom - sr.top };
    });
    return true;
  }

  /* ───────── 3) 춤추는 실루엣(절차적 FK 인형) ───────── */
  const J = {};
  const dir = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];   // a=0 아래, ±π/2 옆, ±π 위
  const add = (p, v) => [p[0] + v[0], p[1] + v[1]];
  function pose(t, cx, cy, S) {
    const ph = t * 9.6;                                        // ≈ 92 BPM
    const sw = Math.sin(ph * 0.5), bounce = Math.abs(sw);
    const xs = 0.86 + 0.14 * Math.cos(t * 0.8);                // 몸통의 좌우 폭(살짝 비트는 느낌)
    const hip = [cx + sw * 0.075 * S, cy + 0.1 * S + (1 - bounce) * 0.04 * S];
    const lean = 0.17 * Math.sin(ph * 0.5 + 0.8);
    const neck = add(hip, dir(Math.PI + lean, 0.3 * S));
    const head = add(neck, dir(Math.PI + lean * 1.8 + 0.12 * Math.sin(ph), 0.1 * S));
    const half = x => 0.5 + 0.5 * x;
    const sL = add(neck, [-0.06 * S * xs, 0.02 * S]), sR = add(neck, [0.06 * S * xs, 0.02 * S]);
    const aUL = -(1.9 + 0.9 * Math.sin(ph * 0.5)), aUR = 1.9 + 0.9 * Math.sin(ph * 0.5 + Math.PI);
    const aFL = aUL - (0.15 + 0.85 * half(Math.sin(ph + 0.6))), aFR = aUR + (0.15 + 0.85 * half(Math.sin(ph + 2.4)));
    const eL = add(sL, dir(aUL, 0.175 * S * xs)), wL = add(eL, dir(aFL, 0.165 * S * xs));
    const eR = add(sR, dir(aUR, 0.175 * S * xs)), wR = add(eR, dir(aFR, 0.165 * S * xs));
    const hL = add(hip, [-0.04 * S * xs, 0]), hR = add(hip, [0.04 * S * xs, 0]);
    const aTL = -(0.12 + 0.3 * half(Math.sin(ph * 0.5 + 0.4))), aTR = 0.12 + 0.3 * half(Math.sin(ph * 0.5 + 0.4 + Math.PI));
    const aSL = aTL + 0.08 + 0.95 * half(Math.sin(ph * 0.5 + 2.0)), aSR = aTR - 0.08 - 0.95 * half(Math.sin(ph * 0.5 + 2.0 + Math.PI));
    const kL = add(hL, dir(aTL, 0.225 * S)), kR = add(hR, dir(aTR, 0.225 * S));
    const anL = add(kL, dir(aSL, 0.225 * S)), anR = add(kR, dir(aSR, 0.225 * S));
    const fL = add(anL, [-0.075 * S, 0.012 * S]), fR = add(anR, [0.075 * S, 0.012 * S]);
    Object.assign(J, { S, hip, neck, head, hr: 0.07 * S, sL, sR, eL, eR, wL, wR, hL, hR, kL, kR, anL, anR, fL, fR });
  }
  function limb(c, a, b, w) { c.lineWidth = w; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  function dot(c, p, r) { c.beginPath(); c.arc(p[0], p[1], r, 0, 6.2832); c.fill(); }
  function paintFigure(c, ex, ox, oy) {                          // ex = 두께 가산(마스크 여백), ox/oy = 그림자 오프셋
    const S = J.S, o = (p) => [p[0] + ox, p[1] + oy];
    c.lineCap = c.lineJoin = 'round';
    limb(c, o(J.hL), o(J.hR), 0.07 * S + ex);
    limb(c, o(J.hL), o(J.kL), 0.07 * S + ex); limb(c, o(J.kL), o(J.anL), 0.054 * S + ex); limb(c, o(J.anL), o(J.fL), 0.044 * S + ex);
    limb(c, o(J.hR), o(J.kR), 0.07 * S + ex); limb(c, o(J.kR), o(J.anR), 0.054 * S + ex); limb(c, o(J.anR), o(J.fR), 0.044 * S + ex);
    limb(c, o(J.hip), o(J.neck), 0.095 * S + ex);
    limb(c, o(J.sL), o(J.sR), 0.065 * S + ex);
    limb(c, o(J.sL), o(J.eL), 0.043 * S + ex); limb(c, o(J.eL), o(J.wL), 0.037 * S + ex);
    limb(c, o(J.sR), o(J.eR), 0.043 * S + ex); limb(c, o(J.eR), o(J.wR), 0.037 * S + ex);
    dot(c, o(J.head), J.hr + ex / 2); dot(c, o(J.wL), 0.033 * S + ex / 2); dot(c, o(J.wR), 0.033 * S + ex / 2);
  }
  // 커피콩 5개가 인형 주위를 돈다
  const BEANS = Array.from({ length: 5 }, (_, i) => ({ rx: 0.34 + i * 0.085, ry: 0.28 + (i % 3) * 0.11, f: 0.38 + i * 0.11, p: i * 1.9, r: 0.036 + (i % 2) * 0.012 }));
  function beanPos(b, t, cx, cy, S) {
    const a = t * b.f + b.p;
    return { x: cx + Math.cos(a) * b.rx * S * 1.05, y: cy + Math.sin(a * 1.3) * b.ry * S * 0.95, ang: a * 2.2, rx: b.r * S * 1.25, ry: b.r * S * 0.8 };
  }
  function paintBean(c, p, ex) { c.beginPath(); c.ellipse(p.x, p.y, p.rx + ex / 2, p.ry + ex / 2, p.ang, 0, 6.2832); c.fill(); }

  /* ───────── 4) 마스크 → 슬롯 ───────── */
  const cur = { x: 0, y: 0, r: 0, on: false };
  function rasterMask() {
    const k = 1 / cell;
    mg.setTransform(1, 0, 0, 1, 0, 0);
    mg.fillStyle = '#000'; mg.fillRect(0, 0, mw, mh);
    mg.setTransform(k, 0, 0, k, 0, 0);
    mg.fillStyle = '#fff'; mg.strokeStyle = '#fff';
    paintFigure(mg, PAD * 2, 0, 0);
    beanList.forEach(p => paintBean(mg, p, PAD * 2));
    if (cur.r > 1) dot(mg, [cur.x, cur.y], cur.r + PAD);
    rects.forEach(r => mg.fillRect(r.x0 - PAD, r.y0 - PAD, r.x1 - r.x0 + PAD * 2, r.y1 - r.y0 + PAD * 2));
    const d = mg.getImageData(0, 0, mw, mh).data;
    for (let i = 0, n = mw * mh; i < n; i++) occ[i] = d[i * 4] > 72 ? 1 : 0;
  }
  function bandIntervals(y0, y1) {
    const r0 = Math.max(0, Math.floor(y0 / cell)), r1 = Math.min(mh - 1, Math.floor((y1 - 0.01) / cell));
    tmp.fill(0);
    for (let r = r0; r <= r1; r++) { const b = r * mw; for (let x = 0; x < mw; x++) if (occ[b + x]) tmp[x] = 1; }
    const out = []; let s = -1;
    for (let x = 0; x <= mw; x++) {
      const v = x < mw ? tmp[x] : 0;
      if (v && s < 0) s = x; else if (!v && s >= 0) { out.push([s * cell, x * cell]); s = -1; }
    }
    return out;
  }
  function freeSlots(l, r, y0, y1, minW) {
    const iv = bandIntervals(y0, y1), out = []; let x = l;
    for (let i = 0; i < iv.length; i++) {
      const a = iv[i][0], b = iv[i][1];
      if (b <= x) continue; if (a >= r) break;
      if (a - x >= minW) out.push([x, a]);
      if (b > x) x = b;
    }
    if (r - x >= minW) out.push([x, r]);
    return out;
  }

  /* ───────── 5) 줄바꿈 엔진 ───────── */
  function layout() {
    const n = words.length;
    let ci = 0, mtDone = -1;
    for (let c = 0; c < cols.length && ci < n; c++) {
      const col = cols[c];
      let y = textTop, firstLine = true;
      while (ci < n) {
        const w0 = words[ci];
        if (w0.first && w0.pi !== mtDone) { mtDone = w0.pi; if (!firstLine && y + st.lh * 2 > textBot + 0.5) break; }
        if (y + st.lh > textBot + 0.5) break;
        const slots = freeSlots(col.x, col.x + col.w, y, y + st.lh, st.minW);
        let ended = false;
        for (let s = 0; s < slots.length && !ended; s++) {
          if (ci >= n || words[ci].pi !== w0.pi) break;
          const sw = slots[s][1] - slots[s][0];
          const key = c * 100000 + ((y + 0.5) | 0) * 8 + s;
          let used = 0, cnt = 0, sumW = 0, j = ci;
          while (j < n && words[j].pi === w0.pi) {
            const wj = words[j], need = (cnt ? st.sp : 0) + wj.w, over = used + need - sw;
            if (over > 0 && !(wj.key === key && over <= cnt * st.sp * 0.24)) break;
            used += need; sumW += wj.w; cnt++; j++;
          }
          if (!cnt) { if (words[ci].w > col.w && sw >= col.w * 0.98) { cnt = 1; used = sumW = words[ci].w; j = ci + 1; } else continue; }
          const paraEnd = j >= n || words[j].pi !== w0.pi;
          let gap = st.sp;
          if (cnt > 1) {
            if (used > sw) gap = (sw - sumW) / (cnt - 1);
            else if (!paraEnd) { const ex = (sw - used) / (cnt - 1); if (ex < st.fs * 0.75) gap = st.sp + ex; }
          }
          let x = slots[s][0];
          for (let k = ci; k < j; k++) { const wd = words[k]; wd.tx = x; wd.ty = y + st.lh / 2; wd.ta = 1; wd.key = key; x += wd.w + gap; }
          // 같은 줄·슬롯의 어절은 함께 움직인다: 하나라도 크게 밀리면 슬롯 전체를 순간이동(서로 통과하며 겹치는 비행 방지), 작은 이동만 미끄러진다
          let jump = false;
          for (let k = ci; k < j; k++) { const wd = words[k]; if (!wd.init || wd.a < 0.03 || Math.abs(wd.ty - wd.y) > 1.5 || Math.abs(wd.tx - wd.x) > 14) { jump = true; break; } }
          if (jump) for (let k = ci; k < j; k++) { words[k].x = words[k].tx; words[k].y = words[k].ty; }
          ci = j;
          if (paraEnd) ended = true;
        }
        y += st.lh;
        if (ci > 0 && (ci >= n || words[ci].pi !== words[ci - 1].pi)) y += st.mb;
        firstLine = false;
      }
    }
    for (let k = ci; k < n; k++) { words[k].ta = 0; words[k].key = -1; }
  }
  function settle(dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt / 0.06), ka = snap ? 1 : Math.min(1, k * 1.6);
    for (let i = 0; i < words.length; i++) {
      const wd = words[i];
      if (!wd.init) { wd.x = wd.tx; wd.y = wd.ty; wd.a = 0; wd.init = true; }
      if (wd.ta === 1) {
        if (wd.a < 0.03) { wd.x = wd.tx; wd.y = wd.ty; }
        else { wd.y = wd.ty; wd.x += (wd.tx - wd.x) * k; }
      }
      wd.a += (wd.ta - wd.a) * ka;
    }
  }

  /* ───────── 6) 그리기 ───────── */
  let beanList = [];
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    // 인형 그림자 → 인형
    g.strokeStyle = g.fillStyle = 'rgba(8,14,110,.38)';
    paintFigure(g, 0, 9, 12);
    beanList.forEach(p => { p.y += 7; p.x += 5; paintBean(g, p, 0); p.y -= 7; p.x -= 5; });
    g.strokeStyle = g.fillStyle = LIME;
    paintFigure(g, 0, 0, 0);
    beanList.forEach(p => {
      g.fillStyle = LIME; paintBean(g, p, 0);
      g.strokeStyle = '#2335e0'; g.lineWidth = Math.max(1.2, p.ry * 0.22); g.lineCap = 'round'; g.beginPath();
      const ca = Math.cos(p.ang), sa = Math.sin(p.ang), L = p.rx * 0.78;
      g.moveTo(p.x - ca * L, p.y - sa * L);
      g.quadraticCurveTo(p.x - sa * p.ry * 0.5, p.y + ca * p.ry * 0.5, p.x + ca * L, p.y + sa * L); g.stroke();
    });
    if (cur.r > 1) { g.strokeStyle = LIME; g.lineWidth = 2; g.beginPath(); g.arc(cur.x, cur.y, cur.r, 0, 6.2832); g.stroke(); g.fillStyle = LIME; dot(g, [cur.x, cur.y], 3); }
    // 글자
    g.textBaseline = 'middle';
    let curFont = '';
    for (let i = 0; i < words.length; i++) {
      const wd = words[i];
      if (wd.a < 0.02) continue;
      const f = wd.acc ? st.bold : st.font;
      if (f !== curFont) { g.font = f; curFont = f; }
      g.globalAlpha = wd.a * (wd.acc ? 1 : 0.94);
      g.fillStyle = wd.acc ? LIME : CREAM;
      g.fillText(wd.t, wd.x, wd.y);
    }
    g.globalAlpha = 1;
  }

  /* ───────── 7) 프레임 루프 ───────── */
  let T = 3.4, cx = 0, cy = 0, lastMx = -1, lastMy = -1, lastMove = -99;
  let vis = true, last = performance.now(), ready = false;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const speed = ctx.reduced ? 0.4 : 1;
  const figS = () => (narrow ? Math.min(H * 0.5, W * 0.9) : H * 0.78);
  function step(dt, now) {
    T += dt * speed;
    const r = stage.getBoundingClientRect(), m = ctx.mouse;
    const lx = m.x - r.left, ly = m.y - r.top, inside = lx >= 0 && lx <= W && ly >= 0 && ly <= H;
    if (m.x !== lastMx || m.y !== lastMy) { lastMx = m.x; lastMy = m.y; lastMove = now; }
    const active = inside && now - lastMove < 3.2;
    // 인형은 천천히 좌우를 거닐고, 커서가 있으면 그쪽으로 끌려간다
    let tx = W * (narrow ? 0.5 : 0.65) + Math.sin(T * 0.23) * W * (narrow ? 0.12 : 0.1);
    if (active) tx = clamp(tx * 0.4 + lx * 0.6, W * (narrow ? 0.3 : 0.5), W * 0.84);
    const ty = H * (narrow ? 0.46 : 0.5) + Math.sin(T * 0.31 + 1) * H * 0.02;
    if (!cx) { cx = tx; cy = ty; }
    const k = 1 - Math.exp(-dt / 0.9);
    cx += (tx - cx) * k; cy += (ty - cy) * k;
    // 커서 블롭(글자가 비켜 간다)
    cur.on = active;
    cur.x += ((cur.on ? lx : cur.x) - cur.x) * (1 - Math.exp(-dt / 0.06)); cur.y += ((cur.on ? ly : cur.y) - cur.y) * (1 - Math.exp(-dt / 0.06));
    if (cur.on && cur.r < 1) { cur.x = lx; cur.y = ly; }
    cur.r += ((cur.on ? 34 : 0) - cur.r) * (1 - Math.exp(-dt / 0.16));
    pose(T, cx, cy, figS());
    beanList = BEANS.map(b => beanPos(b, T, cx, cy, J.S));
  }
  function frame() {
    const now = performance.now();
    if (!ready || !vis || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    step(dt, now / 1000);
    rasterMask(); layout(); settle(dt, ctx.reduced); draw();
  }
  function boot() {
    if (!build()) return false;
    step(0.016, performance.now() / 1000); rasterMask(); layout(); settle(0, true); draw();
    ready = true; return true;
  }
  const offs = [];
  if (!boot()) { const t = setInterval(() => { if (boot()) clearInterval(t); }, 200); offs.push(() => clearInterval(t)); }
  const ro = new ResizeObserver(() => { if (ready) { build(); step(0.016, performance.now() / 1000); rasterMask(); layout(); settle(0, true); draw(); } });
  ro.observe(stage);
  const off = ctx.tick(frame);
  return () => { off(); io.disconnect(); ro.disconnect(); offs.forEach(f => f()); };
}
