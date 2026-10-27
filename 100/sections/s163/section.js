// s163 에디토리얼 엔진 — 줄마다 "사용 가능한 폭 구간(slot)"을 계산해 단어를 배치하는 자체 줄바꿈 엔진.
// ① 어절 폭을 canvas.measureText 로 1회 캐시 ② 줄 밴드마다 장애물(원·볼록 다각형)의 x-구간을 단 폭에서 빼 슬롯 목록 생성
// ③ 슬롯을 왼쪽부터 어절 단위(keep-all, 하이픈 없음)로 채워 커서를 이어간다 ④ 단어별 상태를 지수 감쇠로 미끄러뜨려 그린다.
// DOM(.s163__sr)이 본문의 정본이고 캔버스는 거기서 읽은 파생물이다(접근성 미러).
export default function init(root, ctx) {
  const stage = root.querySelector('.s163__stage');
  const cv = root.querySelector('.s163__cv');
  const g = cv.getContext('2d');
  if (!g) { root.classList.add('is-static'); return; }
  const handles = [...root.querySelectorAll('.s163__orb')];
  const SANS = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const SERIF = "'Noto Serif KR','Nanum Myeongjo','Batang','AppleMyungjo',serif";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = t => t * t * (3 - 2 * t);

  /* ───────── 1) DOM 미러에서 본문 읽기 ───────── */
  const sr = root.querySelector('.s163__sr');
  const kicker = (sr.querySelector('.s163__kicker') || {}).textContent || '';
  const headParas = [...sr.querySelectorAll('h2 .l')].map(el => ({ t: el.textContent.trim(), acc: el.hasAttribute('data-acc'), s: 'head' }));
  const bodyParas = [...sr.querySelectorAll('p:not(.s163__kicker), blockquote')]
    .map(el => ({ t: el.textContent.replace(/\s+/g, ' ').trim(), s: el.tagName === 'BLOCKQUOTE' ? 'quote' : 'body' }));
  const mk = paras => {
    const out = [];
    paras.forEach((p, pi) => p.t.split(' ').filter(Boolean).forEach((t, k) =>
      out.push({ t, s: p.s, acc: !!p.acc, pi, first: k === 0, w: 0, x: 0, y: 0, a: 0, tx: 0, ty: 0, ta: 0, key: -1, init: false })));
    return out;
  };
  const headW = mk(headParas), bodyW = mk(bodyParas);

  /* ───────── 2) 치수·스타일·측정 캐시 ───────── */
  let W = 0, H = 0, dpr = 1, narrow = false;
  let padX = 60, mastH = 84, headTop = 0, headBot = 0, bodyTop = 0, bodyBot = 0, cols = [], headCols = [];
  const S = {};
  const cache = new Map();
  let overflow = 0;

  const COL = { head: [23, 18, 14], headAcc: [212, 64, 31], body: [44, 37, 30], quote: [194, 56, 26] };

  function build() {
    const r = stage.getBoundingClientRect();
    const w = Math.round(r.width), h = Math.round(r.height);
    if (w < 40 || h < 40) return false;
    const rescale = W && H;
    const ow = W, oh = H;
    W = w; H = h; dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    narrow = W < 700;
    const mid = W < 1100;
    padX = Math.max(22, W * 0.055);
    mastH = narrow ? 64 : 84;
    const hfs = clamp(W / 19, 32, 110), hlh = Math.round(hfs * 1.1);
    headTop = mastH + (narrow ? 34 : 46);
    headBot = headTop + hlh * 2;
    bodyTop = headBot + (narrow ? 26 : 34);
    bodyBot = H - (narrow ? 44 : 54);
    const n = narrow ? 1 : mid ? 2 : 3, gap = n === 3 ? 44 : 36;
    const cw = (W - 2 * padX - gap * (n - 1)) / n;
    cols = Array.from({ length: n }, (_, i) => ({ x: padX + i * (cw + gap), w: cw }));
    S.head = { font: `800 ${hfs}px ${SANS}`, fs: hfs, lh: hlh, mt: 0, mb: 0, minW: hfs * 1.2, just: false, keep: 1, tint: 0.55, tr: hfs * 0.9 + 30 };
    const setBody = bfs => {
      const qfs = Math.round(bfs * 1.55);
      S.body = { font: `500 ${bfs}px ${SANS}`, fs: bfs, lh: Math.round(bfs * 1.68), mt: 0, mb: Math.round(bfs * 0.6), minW: bfs * 3.2, just: true, keep: 2, tint: 0.85, tr: bfs * 3.4 + 40 };
      S.quote = { font: `700 ${qfs}px ${SERIF}`, fs: qfs, lh: Math.round(qfs * 1.4), mt: Math.round(bfs * 0.7), mb: Math.round(bfs * 0.8), minW: qfs * 3, just: false, keep: 3, tint: 0.5, tr: qfs * 2 + 40 };
      cache.clear();
      for (const k in S) { g.font = S[k].font; S[k].sp = g.measureText(" ").width || S[k].fs * 0.28; }
      const meas = list => list.forEach(wd => {
        const key = wd.s + "|" + wd.t; let v = cache.get(key);
        if (v === undefined) { g.font = S[wd.s].font; v = g.measureText(wd.t).width; cache.set(key, v); }
        wd.w = v;
      });
      meas(headW); meas(bodyW);
    };
    // 본문 크기 자동 맞춤: 필요 면적(어절 폭×줄 높이)이 단 면적의 66%(장애물이 먹는 몫 포함)에 오도록 폰트 크기를 풀어 화면 비율이 달라도 단이 비지 않게 한다
    setBody(narrow ? 15 : 17);
    let need = 0; bodyW.forEach(wd => { const t = S[wd.s]; need += (wd.w + t.sp) * t.lh; });
    const avail = n * cw * (bodyBot - bodyTop) * 0.66;
    const fit = clamp((narrow ? 15 : 17) * Math.sqrt(avail / need), 14, narrow ? 17 : 26);
    setBody(Math.round(fit * 2) / 2);
    headCols = [{ x: padX, w: W - 2 * padX }];
    // 장애물 크기·영역
    const u = Math.min(W, H);
    const rA = clamp(u * 0.095, 34, 88);
    OB[0].r = rA; OB[1].r = rA * 0.66; OB[2].r = rA * 0.84;
    handles.forEach((hd, i) => { const d = Math.round(OB[i].r * 2); hd.style.width = d + 'px'; hd.style.height = d + 'px'; });
    region();
    OB.forEach(o => {
      if (rescale && ow && oh) { o.x = o.x / ow * W; o.y = o.y / oh * H; }
      o.x = clamp(o.x, R.x0, R.x1); o.y = clamp(o.y, R.y0, R.y1);
    });
    return true;
  }
  const R = { x0: 0, x1: 0, y0: 0, y1: 0 };
  function region() {
    const m = OB.reduce((a, o) => Math.max(a, o.r), 0);
    R.x0 = padX + m * 0.6; R.x1 = W - padX - m * 0.6;
    R.y0 = headTop + m * 0.5; R.y1 = bodyBot - m * 0.4;
  }

  /* ───────── 3) 장애물: 원 2 + 회전 보석(볼록 육각형) ───────── */
  const PAD = 13;
  const OB = [
    { kind: 'c', r: 70, x: 0, y: 0, vx: 0, vy: 0, ax: 0.78, ay: 0.80, fx: 0.125, fy: 0.17, px: 0.6, py: 1.9, tint: [196, 50, 20], drag: null, rel: -99 },
    { kind: 'c', r: 46, x: 0, y: 0, vx: 0, vy: 0, ax: 0.86, ay: 0.72, fx: 0.105, fy: 0.145, px: 3.1, py: 0.7, tint: [15, 92, 90], drag: null, rel: -99 },
    { kind: 'p', r: 60, x: 0, y: 0, vx: 0, vy: 0, ax: 0.66, ay: 0.86, fx: 0.15, fy: 0.115, px: 5.0, py: 2.6, tint: [168, 108, 12], rot: 0.3, pts: [], drag: null, rel: -99 }
  ];
  function polyPts(o) {
    o.pts.length = 0;
    for (let i = 0; i < 6; i++) { const a = o.rot + i * Math.PI / 3; o.pts.push({ x: o.x + Math.cos(a) * o.r, y: o.y + Math.sin(a) * o.r }); }
  }
  function spanCircle(o, y0, y1) {
    const Rr = o.r + PAD;
    const dy = o.y < y0 ? y0 - o.y : o.y > y1 ? o.y - y1 : 0;
    if (dy >= Rr) return null;
    const h = Math.sqrt(Rr * Rr - dy * dy);
    return [o.x - h, o.x + h];
  }
  function spanPoly(o, y0, y1) {
    y0 -= PAD * 0.7; y1 += PAD * 0.7;
    let lo = Infinity, hi = -Infinity; const P = o.pts, n = P.length;
    for (let i = 0; i < n; i++) {
      const a = P[i], b = P[(i + 1) % n], dy = b.y - a.y;
      let t0, t1;
      if (Math.abs(dy) < 1e-9) { if (a.y < y0 || a.y > y1) continue; t0 = 0; t1 = 1; }
      else { t0 = (y0 - a.y) / dy; t1 = (y1 - a.y) / dy; if (t0 > t1) { const q = t0; t0 = t1; t1 = q; } t0 = Math.max(0, t0); t1 = Math.min(1, t1); if (t0 > t1) continue; }
      const xa = a.x + (b.x - a.x) * t0, xb = a.x + (b.x - a.x) * t1;
      if (xa < lo) lo = xa; if (xb < lo) lo = xb; if (xa > hi) hi = xa; if (xb > hi) hi = xb;
    }
    return lo < hi ? [lo - PAD, hi + PAD] : null;
  }
  // 줄 밴드 [y0,y1] 에서 단 [l,r] 의 자유 슬롯 목록(좌→우)
  function freeSlots(l, r, y0, y1, minW) {
    let sl = [[l, r]];
    for (let i = 0; i < OB.length; i++) {
      const o = OB[i], iv = o.kind === 'c' ? spanCircle(o, y0, y1) : spanPoly(o, y0, y1);
      if (!iv) continue;
      const next = [];
      for (const s of sl) {
        if (iv[1] <= s[0] || iv[0] >= s[1]) next.push(s);
        else { if (iv[0] - s[0] >= minW) next.push([s[0], iv[0]]); if (s[1] - iv[1] >= minW) next.push([iv[1], s[1]]); }
      }
      sl = next;
    }
    return sl;
  }

  /* ───────── 4) 줄바꿈 엔진 ───────── */
  // words: 어절 배열(문단 pi 포함). 반환값 = 배치된 어절 수. 못 놓은 어절은 ta=0.
  function layout(words, cs, y0, y1) {
    const n = words.length;
    let ci = 0, mtDone = -1;
    for (let c = 0; c < cs.length && ci < n; c++) {
      const col = cs[c];
      let y = y0, firstLine = true;
      while (ci < n) {
        const w0 = words[ci], st = S[w0.s];
        if (w0.first && w0.pi !== mtDone) {
          mtDone = w0.pi;
          if (!firstLine) { y += st.mt; if (y + st.lh * st.keep > y1 + 0.5) break; }   // 문단 첫머리가 단 끝에 외톨이로 남지 않게(풀쿼트는 3줄 여유)
        }
        if (y + st.lh > y1 + 0.5) break;
        const slots = freeSlots(col.x, col.x + col.w, y, y + st.lh, st.minW);
        let ended = false;
        for (let s = 0; s < slots.length && !ended; s++) {
          if (ci >= n || words[ci].pi !== w0.pi) break;
          const sw = slots[s][1] - slots[s][0];
          const key = c * 100000 + ((y + 0.5) | 0) * 8 + s;      // 이 줄·슬롯의 식별자(히스테리시스용)
          let used = 0, cnt = 0, sumW = 0, j = ci;
          while (j < n && words[j].pi === w0.pi) {
            const wj = words[j], need = (cnt ? st.sp : 0) + wj.w, over = used + need - sw;
            // 자연 폭에 들어가면 받는다. 넘치더라도 직전 프레임에 이 줄에 있던 어절이고 공백을 24%까지 줄이면 들어가면 유지(줄 이탈 깜빡임 방지)
            if (over > 0 && !(wj.key === key && over <= cnt * st.sp * 0.24)) break;
            used += need; sumW += wj.w; cnt++; j++;
          }
          if (!cnt) {
            if (words[ci].w > col.w && sw >= col.w * 0.98) { cnt = 1; used = sumW = words[ci].w; j = ci + 1; } // 한 어절이 단보다 넓을 때만 강제
            else continue;
          }
          const paraEnd = j >= n || words[j].pi !== w0.pi;
          let gap = st.sp;
          if (cnt > 1) {
            if (used > sw) gap = (sw - sumW) / (cnt - 1);                                              // 공백 수축
            else if (!paraEnd && st.just) { const ex = (sw - used) / (cnt - 1); if (ex < st.fs * 0.8) gap = st.sp + ex; } // 양끝 정렬(과대 틈은 왼쪽 정렬)
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
    return ci;
  }

  /* ───────── 5) 오브 물리(자동 궤도 + 드래그 관성) ───────── */
  let T = 6.2;           // 자동 궤도 시간(초)
  function autoTarget(o) {
    const cx = (R.x0 + R.x1) / 2, cy = (R.y0 + R.y1) / 2, hw = (R.x1 - R.x0) / 2, hh = (R.y1 - R.y0) / 2;
    return [cx + hw * o.ax * Math.sin(o.fx * T + o.px), cy + hh * o.ay * Math.sin(o.fy * T + o.py)];
  }
  function placeInitial() { OB.forEach(o => { const t = autoTarget(o); o.x = t[0]; o.y = t[1]; o.vx = o.vy = 0; }); OB[2].rot = 0.3; }
  const speed = ctx.reduced ? 0.35 : 1;
  function stepPhys(dt, now) {
    T += dt * speed;
    OB.forEach(o => {
      if (o.drag) {
        const nx = o.x + (o.drag.x - o.x) * (1 - Math.exp(-dt / 0.035)), ny = o.y + (o.drag.y - o.y) * (1 - Math.exp(-dt / 0.035));
        o.vx += ((nx - o.x) / dt - o.vx) * 0.35; o.vy += ((ny - o.y) / dt - o.vy) * 0.35;
        o.x = clamp(nx, R.x0, R.x1); o.y = clamp(ny, R.y0, R.y1);
      } else {
        const k = smooth(clamp((now - o.rel - 1.4) / 2.2, 0, 1)) * 5.5 * speed;  // 놓은 뒤 잠시 관성, 이어서 궤도로 복귀
        const tg = autoTarget(o);
        o.vx += ((tg[0] - o.x) * k - o.vx * (1.1 + 2.1 * Math.sqrt(k / 5.5))) * dt;
        o.vy += ((tg[1] - o.y) * k - o.vy * (1.1 + 2.1 * Math.sqrt(k / 5.5))) * dt;
        o.x += o.vx * dt; o.y += o.vy * dt;
        if (o.x < R.x0) { o.x = R.x0; o.vx = Math.abs(o.vx) * 0.6; } if (o.x > R.x1) { o.x = R.x1; o.vx = -Math.abs(o.vx) * 0.6; }
        if (o.y < R.y0) { o.y = R.y0; o.vy = Math.abs(o.vy) * 0.6; } if (o.y > R.y1) { o.y = R.y1; o.vy = -Math.abs(o.vy) * 0.6; }
      }
    });
    // 오브끼리 완전히 겹치지 않게 약한 반발
    for (let i = 0; i < OB.length; i++) for (let j = i + 1; j < OB.length; j++) {
      const a = OB[i], b = OB[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, min = a.r + b.r + 18;
      if (d < min) { const p = (min - d) * 0.5, ux = dx / d, uy = dy / d; if (!a.drag) { a.x -= ux * p; a.y -= uy * p; } if (!b.drag) { b.x += ux * p; b.y += uy * p; } }
    }
    OB[2].rot += dt * 0.42 * speed;
    polyPts(OB[2]);
  }

  /* ───────── 6) 입력: 핸들(버튼) 드래그 + 방향키 ───────── */
  const offs = [];
  const on = (el, ev, fn, opt) => { el.addEventListener(ev, fn, opt); offs.push(() => el.removeEventListener(ev, fn, opt)); };
  const nowS = () => performance.now() / 1000;
  handles.forEach((hd, i) => {
    const o = OB[i];
    const pos = e => { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    on(hd, 'pointerdown', e => {
      e.preventDefault(); hd.setPointerCapture(e.pointerId);
      const p = pos(e); o.drag = { id: e.pointerId, ox: o.x - p[0], oy: o.y - p[1], x: o.x, y: o.y };
      hd.classList.add('is-drag');
    });
    on(hd, 'pointermove', e => {
      if (!o.drag || o.drag.id !== e.pointerId) return;
      const p = pos(e); o.drag.x = clamp(p[0] + o.drag.ox, R.x0, R.x1); o.drag.y = clamp(p[1] + o.drag.oy, R.y0, R.y1);
    });
    const up = e => {
      if (!o.drag || (e && o.drag.id !== e.pointerId)) return;
      o.drag = null; o.rel = nowS(); hd.classList.remove('is-drag');
      const sp = Math.hypot(o.vx, o.vy); if (sp > 1500) { o.vx *= 1500 / sp; o.vy *= 1500 / sp; }
    };
    on(hd, 'pointerup', up); on(hd, 'pointercancel', up); on(hd, 'lostpointercapture', up);
    on(hd, 'keydown', e => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d) return;
      e.preventDefault(); const st = e.shiftKey ? 64 : 24;
      o.x = clamp(o.x + d[0] * st, R.x0, R.x1); o.y = clamp(o.y + d[1] * st, R.y0, R.y1); o.vx = o.vy = 0; o.rel = nowS();
    });
  });

  /* ───────── 7) 그리기 ───────── */
  function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function glow(o, c0, c1, k) {
    const gr = g.createRadialGradient(o.x, o.y, o.r * 0.5, o.x, o.y, o.r * k);
    gr.addColorStop(0, c0); gr.addColorStop(1, c1);
    g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r * k, 0, 6.2832); g.fill();
  }
  function shadow(o) {
    const gr = g.createRadialGradient(o.x + o.r * 0.16, o.y + o.r * 0.3, o.r * 0.2, o.x + o.r * 0.16, o.y + o.r * 0.3, o.r * 1.25);
    gr.addColorStop(0, 'rgba(40,24,8,.26)'); gr.addColorStop(1, 'rgba(40,24,8,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(o.x + o.r * 0.16, o.y + o.r * 0.3, o.r * 1.25, 0, 6.2832); g.fill();
  }
  function sphere(o, stops) {
    const gr = g.createRadialGradient(o.x - o.r * 0.34, o.y - o.r * 0.4, o.r * 0.08, o.x, o.y, o.r);
    stops.forEach((s, i) => gr.addColorStop(s[0], s[1]));
    g.fillStyle = gr; g.beginPath(); g.arc(o.x, o.y, o.r, 0, 6.2832); g.fill();
  }
  function gem(o) {
    const P = o.pts, L = -2.2;
    for (let i = 0; i < 6; i++) {
      const a = P[i], b = P[(i + 1) % 6], mid = o.rot + (i + 0.5) * Math.PI / 3;
      const lit = 0.5 + 0.5 * Math.cos(mid - L);
      g.fillStyle = `rgb(${(176 + 70 * lit) | 0},${(112 + 92 * lit) | 0},${(18 + 52 * lit) | 0})`;
      g.beginPath(); g.moveTo(o.x, o.y); g.lineTo(a.x, a.y); g.lineTo(b.x, b.y); g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(255,240,200,.55)'; g.lineWidth = 1.2; g.beginPath();
    P.forEach((p, i) => i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)); g.closePath(); g.stroke();
    const inner = 0.52; g.strokeStyle = 'rgba(255,248,224,.38)'; g.beginPath();
    for (let i = 0; i < 6; i++) { const a = o.rot + i * Math.PI / 3 + 0.2; const x = o.x + Math.cos(a) * o.r * inner, y = o.y + Math.sin(a) * o.r * inner; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.closePath(); g.stroke();
  }

  function drawFrame() {
    const ink = '#17120e';
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    g.fillStyle = ink;
    g.font = `900 ${narrow ? 26 : 34}px ${SERIF}`;
    g.fillText('숯결 저널', padX, mastH - (narrow ? 26 : 30));
    g.font = `600 ${narrow ? 10 : 11}px ${SANS}`;
    try { g.letterSpacing = '0.22em'; } catch (e) {}
    g.fillStyle = 'rgba(23,18,14,.62)';
    g.fillText('SUTGYEOL JOURNAL', padX + (narrow ? 118 : 150), mastH - (narrow ? 26 : 30));
    g.textAlign = 'right';
    g.fillText(narrow ? 'NO.27 · 가을' : 'NO.27 · 2026 가을호 · 화덕 특집', W - padX, mastH - (narrow ? 26 : 30));
    g.textAlign = 'left';
    try { g.letterSpacing = '0px'; } catch (e) {}
    g.fillStyle = ink; g.fillRect(padX, mastH - 16, W - 2 * padX, 3);
    g.fillRect(padX, mastH - 9, W - 2 * padX, 1);
    // 키커
    g.font = `800 ${narrow ? 11 : 12}px ${SANS}`;
    try { g.letterSpacing = '0.2em'; } catch (e) {}
    g.fillStyle = '#d4401f'; g.fillText(kicker.toUpperCase(), padX, mastH + (narrow ? 14 : 20));
    try { g.letterSpacing = '0px'; } catch (e) {}
    // 단 구분선
    g.fillStyle = 'rgba(23,18,14,.22)';
    g.fillRect(padX, bodyTop - 14, W - 2 * padX, 1);
    for (let i = 1; i < cols.length; i++) { const x = cols[i].x - (cols[i].x - cols[i - 1].x - cols[i - 1].w) / 2; g.fillRect(x, bodyTop - 4, 1, bodyBot - bodyTop + 8); }
    // 푸터
    g.font = `600 ${narrow ? 10 : 11}px ${SANS}`;
    try { g.letterSpacing = '0.14em'; } catch (e) {}
    g.fillStyle = 'rgba(23,18,14,.55)'; g.textBaseline = 'middle';
    g.fillText('숯결 · 불과 시간의 기록', padX, H - 22);
    g.textAlign = 'right';
    g.fillText(overflow > 0 ? '다음 면에 계속 →' : '■', W - padX, H - 22);
    g.textAlign = 'left';
    try { g.letterSpacing = '0px'; } catch (e) {}
  }

  function drawWords(words) {
    let cur = '';
    g.textBaseline = 'middle';
    for (let i = 0; i < words.length; i++) {
      const wd = words[i];
      if (wd.a < 0.02) continue;
      const st = S[wd.s];
      if (st.font !== cur) { g.font = st.font; cur = st.font; }
      let base = wd.acc ? COL.headAcc : COL[wd.s];
      // 오브 근처 글자는 오브의 색으로 달아오른다
      let best = 0, bi = -1;
      const cx = wd.x + wd.w / 2;
      for (let k = 0; k < OB.length; k++) {
        const o = OB[k], d = Math.hypot(cx - o.x, wd.y - o.y) - o.r;
        const t = clamp(1 - d / st.tr, 0, 1);
        if (t > best) { best = t; bi = k; }
      }
      if (bi >= 0 && best > 0.02) base = mix(base, OB[bi].tint, smooth(best) * st.tint);
      g.globalAlpha = wd.a;
      g.fillStyle = rgb(base);
      g.fillText(wd.t, wd.x, wd.y);
    }
    g.globalAlpha = 1;
  }

  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    drawFrame();
    // 오브가 번지는 빛(글자 아래)
    glow(OB[0], 'rgba(255,150,70,.30)', 'rgba(255,150,70,0)', 2.3);
    glow(OB[1], 'rgba(60,190,175,.26)', 'rgba(60,190,175,0)', 2.3);
    glow(OB[2], 'rgba(235,175,60,.30)', 'rgba(235,175,60,0)', 2.2);
    drawWords(headW); drawWords(bodyW);
    shadow(OB[0]); shadow(OB[1]); shadow(OB[2]);
    sphere(OB[0], [[0, '#ffe2b5'], [0.32, '#ff914a'], [0.72, '#d4401f'], [1, '#7c200d']]);
    sphere(OB[1], [[0, '#d2fbf3'], [0.34, '#46bcb0'], [0.76, '#0f5c5a'], [1, '#04302f']]);
    gem(OB[2]);
  }

  /* ───────── 8) 프레임 루프 ───────── */
  let vis = true, last = performance.now(), ready = false;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  function relayout() {
    layout(headW, headCols, headTop, headBot);
    const done = layout(bodyW, cols, bodyTop, bodyBot);
    overflow = bodyW.length - done;
  }
  function settle(dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-dt / 0.06), ka = snap ? 1 : Math.min(1, k * 1.6);
    const each = wd => {
      if (!wd.init) { wd.x = wd.tx; wd.y = wd.ty; wd.a = 0; wd.init = true; }
      if (wd.ta === 1) {
        if (wd.a < 0.03) { wd.x = wd.tx; wd.y = wd.ty; }
        else { wd.y = wd.ty; wd.x += (wd.tx - wd.x) * k; }
      }
      wd.a += (wd.ta - wd.a) * ka;
    };
    headW.forEach(each); bodyW.forEach(each);
  }
  function place() {
    for (let i = 0; i < OB.length; i++) {
      const o = OB[i]; handles[i].style.transform = `translate(${(o.x - o.r).toFixed(1)}px,${(o.y - o.r).toFixed(1)}px)`;
    }
  }
  function frame() {
    const now = performance.now();
    if (!ready || !vis || document.hidden) { last = now; return; }
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000)); last = now;
    stepPhys(dt, now / 1000);
    relayout();
    settle(dt, ctx.reduced);
    draw(); place();
  }

  function boot() {
    if (!build()) return false;
    placeInitial(); polyPts(OB[2]);
    relayout(); settle(0, true); draw(); place();
    ready = true; return true;
  }
  let ro = null;
  if (!boot()) { const t = setInterval(() => { if (boot()) clearInterval(t); }, 200); offs.push(() => clearInterval(t)); }
  ro = new ResizeObserver(() => { if (ready) { build(); relayout(); settle(0, true); draw(); place(); } });
  ro.observe(stage);
  const off = ctx.tick(frame);

  return () => { off(); io.disconnect(); ro.disconnect(); offs.forEach(f => f()); };
}
