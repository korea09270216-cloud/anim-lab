// s190 — 빛결 티하우스 · Fortune 스윕라인 보로노이
// 스윕라인(스크롤/시간) 이 내려오며 해안선(포물선 호) 과 보로노이 변을 실시간으로 그리고, 지나간 자리에 스테인드글라스 색이 번진다.
// 아래 FORTUNE 블록은 외부 의존이 없는 순수 알고리즘이다(테스트 스크립트가 이 블록만 잘라서 검증한다).

// ==== FORTUNE-BEGIN ====
/* Fortune 스윕라인 알고리즘 (화면 좌표: y 가 아래로 증가, 스윕라인은 위→아래).
   - 사이트 y 오름차순(동률은 x 오름차순). 스윕라인 y=L 에서 L 보다 위인 사이트 s 의 포물선은
       p_s(x) = (L + s.y)/2 - (x - s.x)^2 / (2 (L - s.y))      (s 와 직선 y=L 에서 등거리인 점들)
     해안선 = max_s p_s(x) (스윕라인에 가장 가까운 포물선 조각들의 상위 포락선).
   - 이벤트: 사이트 이벤트(y=s.y) + 원 이벤트(세 사이트의 외접원 아래점 y=cy+r), 이진 힙.
   - 해안선 = 호의 이중 연결 리스트. 인접 호쌍의 접점(breakpoint) 은 포물선 교점을 직접 푼다.
   - 호가 쪼개지거나 이웃이 바뀌면 그 호의 원 이벤트를 무효화(false alarm) 하고 다시 만든다. */
function fortuneCreate(rawSites, W, H) {
  // ---- 입력 정리: y,x 정렬 + 중복점 병합 ----
  // 좌표를 2^-10 격자로 스냅: 1e-9 수준의 미세 흔들림(거의 같은 y / 거의 원주 위) 을 정확한 퇴화 입력으로 정리해 부동소수 취약 구간을 피한다
  const SNAP = 1024, snap = v => Math.round(v * SNAP) / SNAP;
  rawSites = rawSites.map(p => ({ x: snap(p.x), y: snap(p.y) }));
  const order = rawSites.map((_, i) => i).sort((i, j) => rawSites[i].y - rawSites[j].y || rawSites[i].x - rawSites[j].x);
  const sites = [];
  const siteOf = new Array(rawSites.length);
  for (const i of order) {
    const p = rawSites[i];
    let dup = null;
    for (let k = sites.length - 1; k >= 0 && p.y - sites[k].y <= 1e-9; k--) {
      if (Math.abs(sites[k].x - p.x) <= 1e-9) { dup = sites[k]; break; }
    }
    if (dup) { siteOf[i] = dup; dup.dups.push(i); continue; }
    const s = { x: p.x, y: p.y, id: sites.length, src: i, dups: [] };
    sites.push(s); siteOf[i] = s;
  }

  // ---- 이진 힙 (이벤트 큐) : y, 같은 y 면 원 이벤트(t=0) 먼저, 그 다음 x ----
  const heap = [];
  const less = (a, b) => a.y < b.y || (a.y === b.y && (a.t < b.t || (a.t === b.t && a.x < b.x)));
  function push(ev) {
    let i = heap.length; heap.push(ev);
    while (i > 0) { const p = (i - 1) >> 1; if (!less(ev, heap[p])) break; heap[i] = heap[p]; i = p; }
    heap[i] = ev;
  }
  function pop() {
    const top = heap[0], last = heap.pop(), n = heap.length;
    if (n) {
      let i = 0;
      for (;;) {
        let c = 2 * i + 1; if (c >= n) break;
        if (c + 1 < n && less(heap[c + 1], heap[c])) c++;
        if (!less(heap[c], last)) break;
        heap[i] = heap[c]; i = c;
      }
      heap[i] = last;
    }
    return top;
  }

  const st = { L: -Infinity, head: null, edges: [], verts: [], falseAlarms: 0, nCircle: 0 };

  function reset() {
    heap.length = 0;
    for (const s of sites) heap.push({ t: 1, y: s.y, x: s.x, site: s }); // 정렬된 배열은 이미 유효한 힙
    st.L = -Infinity; st.head = null; st.edges = []; st.verts = []; st.falseAlarms = 0; st.nCircle = 0;
  }

  // ---- 접점(breakpoint): 왼쪽 호 l, 오른쪽 호 r 의 포물선 교점 x ----
  // 왼쪽 사이트 기준으로 평행이동(X = x - l.x)하면 a X^2 + b X + c = 0,
  //   a = dl - dr, b = -2 dl u, c = dl dr (dr - dl) + dl u^2   (u = r.x - l.x, d* = L - *.y)
  // 원하는 근은 (-b - sqrt(disc)) / (2a) (왼쪽이 넓으면 작은 근, 좁으면 큰 근) — a→0 에서도 안정되게 변형한다.
  function bpx(l, r, L) {
    let dl = L - l.y, dr = L - r.y;
    if (dl < 0) dl = 0; if (dr < 0) dr = 0;
    if (dr === 0) return dl === 0 ? (l.x + r.x) / 2 : r.x;   // 오른쪽 포물선이 스윕라인 위의 수직선
    if (dl === 0) return l.x;                                 // 왼쪽이 수직선
    const u = r.x - l.x;
    const a = dl - dr, b = -2 * dl * u, c = dl * dr * (dr - dl) + dl * u * u;
    const s = Math.sqrt(Math.max(0, b * b - 4 * a * c));
    if (b < 0) return l.x + (2 * c) / (s - b);              // 같은 높이(a=0)면 -c/b = 중점
    if (a === 0) return (l.x + r.x) / 2;
    return l.x - (b + s) / (2 * a);
  }
  const parabY = (s, L, x) => { const d = L - s.y; return (L + s.y) / 2 - (x - s.x) * (x - s.x) / (2 * d); };
  function bpY(l, r, L, x) { return (L - l.y > 0) ? parabY(l, L, x) : parabY(r, L, x); }

  // ---- 자료구조 ----
  const newArc = site => ({ site, prev: null, next: null, ev: null, le: null });
  function newEdge(l, r, sx, sy) {
    const e = { l, r, sx: sx === undefined ? null : sx, sy: sy === undefined ? null : sy, ex: null, ey: null, dx: l.y - r.y, dy: r.x - l.x };
    st.edges.push(e); return e;
  }
  const kill = arc => { if (arc.ev) { arc.ev.valid = false; arc.ev = null; } };

  // 연속 세 호 (prev, arc, next) 의 원 이벤트 생성. 좌→우로 수렴(D<0) 하는 삼중점만 호 arc 를 소멸시킨다.
  function checkCircle(arc) {
    kill(arc);
    const p = arc.prev, q = arc.next;
    if (!p || !q) return;
    const A = p.site, B = arc.site, C = q.site;
    if (A === C) return;
    const ax = A.x - B.x, ay = A.y - B.y, cx = C.x - B.x, cy = C.y - B.y;
    const D = 2 * (ax * cy - ay * cx);
    if (!(D < 0)) return;                                 // 일직선(D=0) · 발산하는 삼중점은 원 이벤트 없음
    const a2 = ax * ax + ay * ay, c2 = cx * cx + cy * cy;
    const ux = (cy * a2 - ay * c2) / D, uy = (ax * c2 - cx * a2) / D;
    const ccx = B.x + ux, ccy = B.y + uy, r = Math.sqrt(ux * ux + uy * uy);
    const y = ccy + r;
    if (!isFinite(y) || y < st.L - 1e-6) return;
    const ev = { t: 0, y, x: ccx, arc, valid: true, cx: ccx, cy: ccy, r };
    arc.ev = ev; push(ev);
  }

  function siteEvent(s) {
    const L = s.y;
    if (!st.head) { st.head = newArc(s); return; }
    // 해안선 위에서 s.x 가 속하는 호 탐색 (접점 x 가 단조 증가)
    let a = st.head;
    while (a.next && s.x > bpx(a.site, a.next.site, L)) a = a.next;
    const as = a.site, dA = L - as.y;
    const n = newArc(s);
    if (dA <= 1e-12) {
      // 퇴화: 같은 y 의 사이트 — 기존 호가 수직선이라 쪼갤 수 없다. 이웃으로 끼워 넣고 변은 위쪽 무한에서 시작.
      if (s.x >= as.x) {
        n.prev = a; n.next = a.next; if (a.next) a.next.prev = n; a.next = n;
        n.le = newEdge(as, s);
      } else {
        n.next = a; n.prev = a.prev; if (a.prev) a.prev.next = n; else st.head = n; a.prev = n;
        a.le = newEdge(s, as);
      }
      if (n.prev) checkCircle(n.prev);
      checkCircle(n);
      if (n.next) checkCircle(n.next);
      return;
    }
    // 일반: 호 a 를 [a, n, a2] 로 쪼갠다. s 바로 위 해안선 점이 두 변의 시작점.
    const px = s.x, py = (L + as.y) / 2 - (px - as.x) * (px - as.x) / (2 * dA);
    const a2 = newArc(as);
    n.le = newEdge(as, s, px, py);
    a2.le = newEdge(s, as, px, py);
    n.prev = a; n.next = a2; a2.prev = n; a2.next = a.next;
    if (a.next) a.next.prev = a2;
    a.next = n;
    checkCircle(a);      // 쪼개진 호의 기존 원 이벤트는 여기서 무효화(false alarm)
    checkCircle(a2);
  }

  function circleEvent(ev) {
    const m = ev.arc; m.ev = null;
    const l = m.prev, r = m.next;
    st.nCircle++;
    const vx = ev.cx, vy = ev.cy;
    m.le.ex = vx; m.le.ey = vy;            // 소멸하는 호의 양쪽 변이 보로노이 꼭짓점에서 끝난다
    r.le.ex = vx; r.le.ey = vy;
    st.verts.push({ x: vx, y: vy, r: ev.r, ey: ev.y, a: l.site, b: m.site, c: r.site });
    l.next = r; r.prev = l;
    r.le = newEdge(l.site, r.site, vx, vy); // 새로 이웃이 된 l,r 사이의 변이 이 꼭짓점에서 시작
    checkCircle(l); checkCircle(r);
  }

  // 이벤트를 y ≤ Lt 까지 처리 (앞으로만 진행; 되감기는 reset 후 재실행)
  function advance(Lt) {
    for (;;) {
      const ev = heap[0];
      if (!ev) break;
      if (ev.t === 0 && !ev.valid) { pop(); st.falseAlarms++; continue; }
      if (ev.y > Lt) break;
      pop();
      if (ev.y > st.L) st.L = ev.y;
      if (ev.t === 1) siteEvent(ev.site); else circleEvent(ev);
    }
  }

  // 해안선: [{site, x0, x1}] (x0=-Inf 로 시작, 마지막 x1=+Inf)
  function beach(L) {
    const out = [];
    let x0 = -Infinity;
    for (let a = st.head; a; a = a.next) {
      const x1 = a.next ? bpx(a.site, a.next.site, L) : Infinity;
      out.push({ site: a.site, x0, x1, arc: a });
      x0 = x1;
    }
    return out;
  }

  function pendingCircles(L, range) {
    const out = [];
    for (const ev of heap) if (ev.t === 0 && ev.valid && ev.y >= L && ev.y <= L + range) out.push(ev);
    return out;
  }

  // ---- 변 → 캔버스 경계 클리핑 ----
  function clipLine(mx, my, dx, dy) {
    let t0 = -Infinity, t1 = Infinity;
    if (Math.abs(dx) < 1e-12) { if (mx < -1e-9 || mx > W + 1e-9) return null; }
    else { let a = -mx / dx, b = (W - mx) / dx; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
    if (Math.abs(dy) < 1e-12) { if (my < -1e-9 || my > H + 1e-9) return null; }
    else { let a = -my / dy, b = (H - my) / dy; if (a > b) { const t = a; a = b; b = t; } if (a > t0) t0 = a; if (b < t1) t1 = b; }
    return t0 <= t1 ? [t0, t1] : null;
  }
  // 끝이 열린 변(ex==null) 은 +방향 반직선, 시작이 없는(sx==null) 변은 -방향으로 무한
  function edgeSegment(e) {
    const len = Math.hypot(e.dx, e.dy); if (len === 0) return null;
    const dx = e.dx / len, dy = e.dy / len;
    const mx = (e.l.x + e.r.x) / 2, my = (e.l.y + e.r.y) / 2;
    const bx = clipLine(mx, my, dx, dy); if (!bx) return null;
    let t0 = e.sx === null ? -Infinity : (e.sx - mx) * dx + (e.sy - my) * dy;
    let t1 = e.ex === null ? Infinity : (e.ex - mx) * dx + (e.ey - my) * dy;
    if (bx[0] > t0) t0 = bx[0]; if (bx[1] < t1) t1 = bx[1];
    if (!(t1 - t0 > 1e-9)) return null;
    return [mx + dx * t0, my + dy * t0, mx + dx * t1, my + dy * t1];
  }

  // 끝까지 돌리고 셀 폴리곤 생성: 셀 = (자기 변의 클립된 끝점 + 자기가 소유한 캔버스 모서리) 를 사이트 기준 각도 정렬
  function finish() {
    advance(Infinity);
    const segs = [];
    for (const e of st.edges) {
      const g = edgeSegment(e);
      if (g) segs.push({ a: e.l, b: e.r, x1: g[0], y1: g[1], x2: g[2], y2: g[3] });
    }
    const pts = sites.map(() => []);
    for (const g of segs) {
      pts[g.a.id].push(g.x1, g.y1, g.x2, g.y2);
      pts[g.b.id].push(g.x1, g.y1, g.x2, g.y2);
    }
    for (const [qx, qy] of [[0, 0], [W, 0], [W, H], [0, H]]) {
      let best = Infinity; const d = sites.map(s => { const v = Math.hypot(s.x - qx, s.y - qy); if (v < best) best = v; return v; });
      for (let i = 0; i < sites.length; i++) if (d[i] <= best + 1e-9 * (W + H)) pts[i].push(qx, qy);
    }
    const cells = sites.map((s, i) => {
      const p = pts[i], arr = [];
      let mx = 0, my = 0; for (let k = 0; k < p.length; k += 2) { mx += p[k]; my += p[k + 1]; }
      mx /= Math.max(1, p.length / 2); my /= Math.max(1, p.length / 2);   // 정렬 중심 = 끝점 평균(셀 내부) — 경계 위 사이트도 안전
      for (let k = 0; k < p.length; k += 2) arr.push({ x: p[k], y: p[k + 1], a: Math.atan2(p[k + 1] - my, p[k] - mx) });
      arr.sort((u, v) => u.a - v.a);
      const poly = [];
      for (const q of arr) {
        const lx = poly.length ? poly[poly.length - 2] : NaN, ly = poly.length ? poly[poly.length - 1] : NaN;
        if (Math.abs(q.x - lx) < 1e-6 && Math.abs(q.y - ly) < 1e-6) continue;
        poly.push(q.x, q.y);
      }
      while (poly.length > 2 && Math.abs(poly[0] - poly[poly.length - 2]) < 1e-6 && Math.abs(poly[1] - poly[poly.length - 1]) < 1e-6) poly.length -= 2;
      let area = 0;
      for (let k = 0, m = poly.length; k < m; k += 2) { const k2 = (k + 2) % m; area += poly[k] * poly[k2 + 1] - poly[k2] * poly[k + 1]; }
      return { site: s, poly, area: Math.abs(area) / 2 };
    });
    return { segs, cells };
  }

  reset();
  return { sites, siteOf, st, reset, advance, beach, bpx, bpY, parabY, pendingCircles, finish, seg: edgeSegment, W, H };
}
// ==== FORTUNE-END ====

// ---------------------------------------------------------------- 장면(월드 820×1000 = 아치창 한 장)
const WW = 820, WH = 1000, ARCH_CY = 410;
const WORD = '빛결';
const FONT = '"Pretendard","Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR","Nanum Gothic",sans-serif';
const LEAD = '#1a1420';
// 보석 팔레트 [h,s,l]: 글자 셀은 따뜻한 빛, 바탕 셀은 차가운 빛 (+ 유백색 몇 장)
const WARM = [[44, 96, 58], [38, 95, 56], [30, 94, 55], [50, 92, 63], [22, 90, 54], [8, 82, 52], [350, 72, 56]];
const HALO = [[224, 62, 26], [238, 52, 24], [206, 72, 28], [258, 44, 28], [196, 70, 24]];   // 글자 윤곽을 감싸는 짙은 청색 유리
const COOL = [[216, 72, 43], [226, 56, 36], [188, 78, 38], [158, 62, 34], [268, 46, 42], [202, 80, 46], [140, 50, 32], [246, 50, 46]];
const OPAL = [[43, 46, 86], [28, 36, 80]];
const hsl = (h, s, l) => `hsl(${h.toFixed(1)},${s.toFixed(1)}%,${l.toFixed(1)}%)`;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 글자 모양 마스크 + 글자까지의 거리장 (샘플 밀도 제어용)
function glyphMask() {
  const S = 0.5, mw = Math.round(WW * S), mh = Math.round(WH * S);
  const c = document.createElement('canvas'); c.width = mw; c.height = mh;
  const g = c.getContext('2d', { willReadFrequently: true });
  const draw = (sz, dx, dy, fallback) => {
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, mw, mh); g.setTransform(S, 0, 0, S, 0, 0);
    g.fillStyle = g.strokeStyle = '#000';
    if (fallback) { g.beginPath(); g.arc(WW / 2, 620, 190, 0, 6.2832); g.fill(); return; }
    g.font = `800 ${sz}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.fillText(WORD, WW / 2 + dx, 640 + dy);
  };
  const bbox = () => {
    const d = g.getImageData(0, 0, mw, mh).data; let x0 = mw, y0 = mh, x1 = -1, y1 = -1;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) if (d[(y * mw + x) * 4 + 3] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { x0, y0, x1, y1 };
  };
  let size = 340; draw(size, 0, 0); let b = bbox(), fb = false;
  if (b.x1 < 0 || b.x1 - b.x0 < 20) { fb = true; draw(0, 0, 0, true); b = bbox(); }
  else {
    size *= Math.min(712 / ((b.x1 - b.x0 + 1) / S), 420 / ((b.y1 - b.y0 + 1) / S));
    draw(size, 0, 0); b = bbox();
    draw(size, WW / 2 - (b.x0 + b.x1 + 1) / 2 / S, 612 - (b.y0 + b.y1 + 1) / 2 / S, false);
  }
  const d = g.getImageData(0, 0, mw, mh).data, m = new Uint8Array(mw * mh);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  // 체임퍼 거리변환(월드 px): seed 픽셀에서 각 픽셀까지의 거리
  const w1 = 1 / S, w2 = 1.4142 / S;
  const chamfer = seed => {
    const D = new Float32Array(mw * mh);
    for (let i = 0; i < D.length; i++) D[i] = seed[i] ? 0 : 1e6;
    for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
      const i = y * mw + x; let v = D[i];
      if (x > 0 && D[i - 1] + w1 < v) v = D[i - 1] + w1;
      if (y > 0) {
        if (D[i - mw] + w1 < v) v = D[i - mw] + w1;
        if (x > 0 && D[i - mw - 1] + w2 < v) v = D[i - mw - 1] + w2;
        if (x < mw - 1 && D[i - mw + 1] + w2 < v) v = D[i - mw + 1] + w2;
      }
      D[i] = v;
    }
    for (let y = mh - 1; y >= 0; y--) for (let x = mw - 1; x >= 0; x--) {
      const i = y * mw + x; let v = D[i];
      if (x < mw - 1 && D[i + 1] + w1 < v) v = D[i + 1] + w1;
      if (y < mh - 1) {
        if (D[i + mw] + w1 < v) v = D[i + mw] + w1;
        if (x < mw - 1 && D[i + mw + 1] + w2 < v) v = D[i + mw + 1] + w2;
        if (x > 0 && D[i + mw - 1] + w2 < v) v = D[i + mw - 1] + w2;
      }
      D[i] = v;
    }
    return D;
  };
  const dist = chamfer(m);                                   // 글자 밖 → 글자까지
  const din = chamfer(m.map(v => 1 - v));                    // 글자 안 → 윤곽까지
  return { m, dist, din, mw, mh, S, fallback: fb };
}

// 사이트 샘플링
//  ① 글자 윤곽선 위에서 Poisson-disk 로 점을 고르고, 법선 방향 ±8px 에 안/밖 사이트를 한 쌍씩 둔다
//     → 한 쌍의 이등분선이 정확히 글자 윤곽에 놓여 보로노이 셀 경계가 글자 모양을 따라간다
//  ② 글자 속살은 Mitchell best-candidate(균일 블루노이즈) 로 채우고
//  ③ 바탕은 글자에서 멀수록 성긴 가변 밀도 best-candidate 로 몇 장만 둔다
function sampleSites(mk, rnd, NI, NB) {
  const { m, dist, din, mw, mh, S } = mk, pts = [];
  const idxOf = (x, y) => Math.min(mh - 1, Math.max(0, (y * S) | 0)) * mw + Math.min(mw - 1, Math.max(0, (x * S) | 0));
  const at = (A, x, y) => A[idxOf(x, y)];
  const nearest2 = (x, y) => { let d = Infinity; for (let i = 0; i < pts.length; i++) { const dx = pts[i].x - x, dy = pts[i].y - y, v = dx * dx + dy * dy; if (v < d) d = v; } return d; };
  // ① 윤곽
  const bnd = [], core = [];
  for (let y = 1; y < mh - 1; y++) for (let x = 1; x < mw - 1; x++) {
    const i = y * mw + x; if (!m[i]) continue;
    if (!m[i - 1] || !m[i + 1] || !m[i - mw] || !m[i + mw]) bnd.push(i); else if (din[i] >= 13) core.push(i);
  }
  for (let i = bnd.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = bnd[i]; bnd[i] = bnd[j]; bnd[j] = t; }
  const cont = [], SP2 = 25 * 25, OFF = 8;
  for (const idx of bnd) {
    const cx = ((idx % mw) + 0.5) / S, cy = (((idx / mw) | 0) + 0.5) / S;
    let ok = true; for (let k = 0; k < cont.length; k++) { const dx = cont[k][0] - cx, dy = cont[k][1] - cy; if (dx * dx + dy * dy < SP2) { ok = false; break; } }
    if (!ok) continue;
    const e = 6, gx = at(din, cx + e, cy) - at(din, cx - e, cy), gy = at(din, cx, cy + e) - at(din, cx, cy - e), len = Math.hypot(gx, gy);
    if (len < 1e-6) continue;
    const nx = -gx / len, ny = -gy / len;
    const pi = { x: cx - nx * OFF, y: cy - ny * OFF, g: 1 }, po = { x: cx + nx * OFF, y: cy + ny * OFF, g: 2 };
    if (at(m, pi.x, pi.y) !== 1 || at(m, po.x, po.y) !== 0) continue;
    if (nearest2(pi.x, pi.y) < 49 || nearest2(po.x, po.y) < 49) continue;
    cont.push([cx, cy]); pts.push(pi, po);
  }
  // ② 속살
  for (let n = 0; n < NI && core.length; n++) {
    let bx = 0, by = 0, bd = -1;
    for (let k = 0; k < 16; k++) {
      const idx = core[(rnd() * core.length) | 0];
      const x = ((idx % mw) + rnd()) / S, y = (((idx / mw) | 0) + rnd()) / S, d = nearest2(x, y);
      if (d > bd) { bd = d; bx = x; by = y; }
    }
    if (bd > 22 * 22) pts.push({ x: bx, y: by, g: 1 });
  }
  // ③ 바탕
  const inWin = (x, y) => y >= ARCH_CY ? (x > -14 && x < WW + 14 && y < WH + 14) : Math.hypot(x - WW / 2, y - ARCH_CY) < 446;
  for (let n = 0; n < NB; n++) {
    let bx = 0, by = 0, bs = -1;
    for (let k = 0; k < 26; k++) {
      let x, y, t = 0; do { x = -14 + rnd() * (WW + 28); y = -14 + rnd() * (WH + 28); } while (!inWin(x, y) && ++t < 30);
      const r = 24 + 112 * smooth(0, 300, at(dist, x, y));
      const sc = Math.sqrt(nearest2(x, y)) / r;
      if (sc > bs) { bs = sc; bx = x; by = y; }
    }
    pts.push({ x: bx, y: by, g: 0 });
  }
  return pts;
}

function buildScene(rnd) {
  const mk = glyphMask();
  const pts = sampleSites(mk, rnd, 90, 48);
  const sim = fortuneCreate(pts, WW, WH);
  const fin = sim.finish();
  const N = sim.sites.length;
  // 이웃 · 색 배정 (이웃과 같은 보석색 회피)
  const nbr = sim.sites.map(() => new Set()), pair = new Map(), area = fin.cells.map(c => c.area);
  for (const s of fin.segs) {
    nbr[s.a.id].add(s.b.id); nbr[s.b.id].add(s.a.id);
    const w = Math.min(area[s.a.id], area[s.b.id]);
    pair.set(Math.min(s.a.id, s.b.id) * N + Math.max(s.a.id, s.b.id), w < 900 ? 0 : w < 4200 ? 1 : 2);
  }
  const order = sim.sites.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; const t = order[i]; order[i] = order[j]; order[j] = t; }
  const col = new Array(N);
  // 셀 종류: 글자 안쪽 사이트=1(따뜻한 빛), 윤곽 거울상=2(짙은 청색 테두리 유리), 바탕=0 (바탕 셀이 대부분 글자 안이면 1: 폴리곤 표본점 마스크 투표)
  const inGlyph = (x, y) => { const ix = (x * mk.S) | 0, iy = (y * mk.S) | 0; return ix >= 0 && iy >= 0 && ix < mk.mw && iy < mk.mh && mk.m[iy * mk.mw + ix] === 1; };
  const kind = fin.cells.map(c => {
    const p = c.poly, g = pts[c.site.src].g; if (p.length < 6) return 0;
    if (g) return g;
    let mx = 0, my = 0; for (let k = 0; k < p.length; k += 2) { mx += p[k]; my += p[k + 1]; }
    mx /= p.length / 2; my /= p.length / 2;
    let v = inGlyph(mx, my) ? 1 : 0, n = 1;
    for (let k = 0; k < p.length; k += 2) { n++; if (inGlyph((mx + p[k]) / 2, (my + p[k + 1]) / 2)) v++; }
    return v / n >= 0.5 ? 1 : 0;
  });
  for (const i of order) {
    const glyph = kind[i] === 1;
    const pal = glyph ? (rnd() < 0.1 ? OPAL : WARM) : kind[i] === 2 ? HALO : COOL;
    const used = new Set(); for (const j of nbr[i]) if (col[j] && col[j].pal === pal) used.add(col[j].k);
    let cand = []; for (let k = 0; k < pal.length; k++) if (!used.has(k)) cand.push(k);
    if (!cand.length) cand = pal.map((_, k) => k);
    const k = cand[(rnd() * cand.length) | 0], b = pal[k];
    col[i] = { pal, k, h: b[0] + (rnd() - .5) * 8, s: b[1] + (rnd() - .5) * 8, l: b[2] + (rnd() - .5) * 7, glyph };
  }
  // 스윕 종료 위치: 캔버스 안 모든 점 q 에서 q.y + (q 에서 최근접 사이트까지 거리) 의 최댓값
  let Lend = 0;
  for (const c of fin.cells) for (let k = 0; k < c.poly.length; k += 2) Lend = Math.max(Lend, c.poly[k + 1] + Math.hypot(c.poly[k] - c.site.x, c.poly[k + 1] - c.site.y));
  Lend += 2;
  // 스윕 속도: 이벤트(사이트+원) 가 고르게 터지도록 y 분포의 분위수와 선형을 섞고, 단조 LUT 로 만든다
  const ev = sim.sites.map(s => s.y).concat(sim.st.verts.map(v => v.ey)).filter(y => y <= Lend).sort((a, b) => a - b);
  const Ls = -24, LUT = new Float32Array(513);
  let mx = Ls;
  for (let i = 0; i <= 512; i++) {
    const s = i / 512, f = s * (ev.length - 1), j = Math.min(ev.length - 2, f | 0);
    const q = ev[j] + (ev[j + 1] - ev[j]) * (f - j), lin = Ls + (Lend - Ls) * s;
    const L = lin + (q - lin) * 0.5 * Math.sin(Math.PI * s);
    mx = Math.max(mx, L); LUT[i] = mx;
  }
  LUT[512] = Lend;
  const Lof = s => { const f = Math.min(1, Math.max(0, s)) * 512, i = Math.min(511, f | 0); return LUT[i] + (LUT[i + 1] - LUT[i]) * (f - i); };
  sim.reset();
  return { sim, kind: sim.sites.map(q => pts[q.src].g), cells: fin.cells, col, pair, N, Lend, Lof, nGlyph: pts.filter(p => p.g).length, fallback: mk.fallback };
}

// 스테인드글라스 레이어(완성된 셀 전부)를 한 번 그려 둔다 — 스윕이 지나간 자리만 드러난다
function paintGlass(gc, kx, ky, scene) {
  gc.setTransform(1, 0, 0, 1, 0, 0); gc.clearRect(0, 0, gc.canvas.width, gc.canvas.height);
  gc.setTransform(kx, 0, 0, ky, 0, 0);
  gc.fillStyle = '#d9c9a8'; gc.fillRect(0, 0, WW, WH);
  gc.lineJoin = 'round';
  const rr = mulberry32(77);
  for (const cell of scene.cells) {
    const p = cell.poly; if (p.length < 6) continue;
    const c = scene.col[cell.site.id];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let k = 0; k < p.length; k += 2) { if (p[k] < x0) x0 = p[k]; if (p[k] > x1) x1 = p[k]; if (p[k + 1] < y0) y0 = p[k + 1]; if (p[k + 1] > y1) y1 = p[k + 1]; }
    const ang = rr() * 0.8 - 0.1, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hw = (x1 - x0) / 2 + 1, hh = (y1 - y0) / 2 + 1;
    const gr = gc.createLinearGradient(cx - hw * (0.8 - ang), cy - hh, cx + hw * (0.8 + ang), cy + hh);
    gr.addColorStop(0, hsl(c.h, c.s, c.l + 14)); gr.addColorStop(0.55, hsl(c.h, c.s, c.l)); gr.addColorStop(1, hsl(c.h, c.s + 5, c.l - 13));
    gc.beginPath(); gc.moveTo(p[0], p[1]); for (let k = 2; k < p.length; k += 2) gc.lineTo(p[k], p[k + 1]); gc.closePath();
    gc.fillStyle = gr; gc.fill();
    gc.strokeStyle = gr; gc.lineWidth = 1.6; gc.stroke();      // 이웃과 겹쳐 안티앨리어싱 틈 제거
    const s = cell.site, rad = Math.sqrt(cell.area / Math.PI) * 1.25 + 4;
    const rg = gc.createRadialGradient(s.x - rad * .22, s.y - rad * .3, 0, s.x, s.y, rad);
    rg.addColorStop(0, c.glyph ? 'rgba(255,248,214,.42)' : 'rgba(255,255,255,.26)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    gc.fillStyle = rg; gc.fill();
    if (cell.area > 5200) {        // 큰 판유리: 손으로 분 유리의 결 같은 빛줄기
      gc.save(); gc.clip(); gc.strokeStyle = 'rgba(255,255,255,.11)'; gc.lineWidth = 3 + rr() * 5;
      for (let q = 0; q < 2; q++) { const u = x0 + (x1 - x0) * (0.15 + rr() * 0.7); gc.beginPath(); gc.moveTo(u, y0 - 4); gc.bezierCurveTo(u + 30 * (rr() - .5), cy - hh * .3, u - 40 * (rr() - .5), cy + hh * .3, u + 20 * (rr() - .5), y1 + 4); gc.stroke(); }
      gc.restore();
    }
  }
}

// ---------------------------------------------------------------- 섹션
export default function init(root, ctx) {
  const $ = q => root.querySelector(q);
  const track = $('.s190__track'), stage = $('.s190__stage'), win = $('.s190__win'), cv = $('.s190__cv');
  const ruler = $('.s190__ruler'), nowEl = $('.s190__now b'), spill = $('.s190__spill');
  const g2 = cv && cv.getContext('2d');
  if (!g2) { root.classList.add('s190--static'); return () => {}; }

  const scene = buildScene(mulberry32(190513));
  const sim = scene.sim, Lof = scene.Lof;
  const glass = document.createElement('canvas'), gg = glass.getContext('2d');
  const paper = document.createElement('canvas'), pg = paper.getContext('2d');
  let kx = 1, ky = 1;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = Math.round(win.clientWidth * dpr), h = Math.round(win.clientHeight * dpr);
    if (w < 40 || h < 40) return;
    const f = Math.min(1, Math.sqrt(560000 / (w * h))); w = Math.round(w * f); h = Math.round(h * f);
    cv.width = glass.width = paper.width = w; cv.height = glass.height = paper.height = h;
    kx = w / WW; ky = h / WH;
    paintGlass(gg, kx, ky, scene);
    // 종이 바탕(아직 빛이 닿지 않은 면) + 가는 격자
    pg.setTransform(1, 0, 0, 1, 0, 0);
    const bgr = pg.createLinearGradient(0, 0, 0, h); bgr.addColorStop(0, '#f3e9d3'); bgr.addColorStop(1, '#e8dabd');
    pg.fillStyle = bgr; pg.fillRect(0, 0, w, h);
    pg.setTransform(kx, 0, 0, ky, 0, 0); pg.strokeStyle = 'rgba(36,26,44,.06)'; pg.lineWidth = 1 / kx; pg.beginPath();
    for (let x = 41; x < WW; x += 41) { pg.moveTo(x, 0); pg.lineTo(x, WH); }
    for (let y = 41; y < WH; y += 41) { pg.moveTo(0, y); pg.lineTo(WW, y); }
    pg.stroke();
  }

  // ---- 해안선 경로: 포물선 호를 2차 베지어로 정확히 이어 붙인다 (호 = 접점 사이의 구간) ----
  function traceBeach(c, bl, L, closed) {
    c.beginPath();
    let started = false, endX = 0;
    for (let i = 0; i < bl.length; i++) {
      const a = bl[i], s = a.site, d = L - s.y; if (d <= 1e-9) continue;
      let xa = Math.max(a.x0, -8), xb = Math.min(a.x1, WW + 8);
      const c0 = (L + s.y) / 2, wlim = Math.sqrt(2 * d * (c0 + 3000));
      if (xa < s.x - wlim) xa = s.x - wlim; if (xb > s.x + wlim) xb = s.x + wlim;
      if (!(xb > xa)) continue;
      const ya = c0 - (xa - s.x) * (xa - s.x) / (2 * d), yb = c0 - (xb - s.x) * (xb - s.x) / (2 * d);
      const xm = (xa + xb) / 2, ym = ya - (xa - s.x) / d * (xm - xa);
      if (!started) { if (closed) { c.moveTo(xa, -3000); c.lineTo(xa, ya); } else c.moveTo(xa, ya); started = true; }
      else c.lineTo(xa, ya);
      c.quadraticCurveTo(xm, ym, xb, yb); endX = xb;
    }
    if (started && closed) { c.lineTo(endX, -3000); c.closePath(); }
    return started;
  }

  // ---- 상태 ----
  let s = ctx.reduced ? 1 : 0.05, phase = 'sweep', holdT = 0, veil = 0, advTo = -Infinity;
  const T_SWEEP = 13.5, T_HOLD = 3.6;
  const prox = { p: 0 };
  let lastP = 0, lastScroll = -1e9, visible = true, introDone = false;
  let lastClock = '', lastFrac = -1, lastLit = -1;
  const spot = { x: -999, y: -999, a: 0 };

  function draw(L, now) {
    const c = g2, W = cv.width, Hh = cv.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(paper, 0, 0);
    c.setTransform(kx, 0, 0, ky, 0, 0);
    const px = 1 / kx;
    // 아직 지나지 않은 사이트 (글자 모양이 점으로 보인다)
    c.fillStyle = 'rgba(36,26,44,.42)'; c.beginPath();
    for (const q of sim.sites) if (q.y > L && scene.kind[q.id] !== 1) { c.moveTo(q.x + 1.7, q.y); c.arc(q.x, q.y, 1.7, 0, 6.2832); }
    c.fill();
    c.fillStyle = 'rgba(176,78,22,.9)'; c.beginPath();
    for (const q of sim.sites) if (q.y > L && scene.kind[q.id] === 1) { c.moveTo(q.x + 2.5, q.y); c.arc(q.x, q.y, 2.5, 0, 6.2832); }
    c.fill();

    const bl = sim.beach(L);
    // ① 스윕이 지나간 면(해안선 위) 만 스테인드글라스가 드러난다
    c.save();
    if (traceBeach(c, bl, L, true)) {
      c.clip();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(glass, 0, 0);
      c.globalCompositeOperation = 'lighter';          // 방금 빛이 닿은 띠: 해안선 바로 위가 가장 밝고 위로 갈수록 식는다
      c.setTransform(kx, 0, 0, ky, 0, 0);
      const fg = c.createLinearGradient(0, L - 110, 0, L);
      fg.addColorStop(0, 'rgba(255,226,160,0)'); fg.addColorStop(1, 'rgba(255,226,160,.34)');
      c.fillStyle = fg; c.fillRect(0, L - 110, WW, 110);
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = 'source-over';
      if (spot.a > 0.01) {                            // 포인터가 비추는 햇살 얼룩
        c.globalCompositeOperation = 'lighter';
        const r = 110 * W / Math.max(1, win.clientWidth), g = c.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, r);
        g.addColorStop(0, `rgba(255,236,190,${0.34 * spot.a})`); g.addColorStop(1, 'rgba(255,236,190,0)');
        c.fillStyle = g; c.fillRect(spot.x - r, spot.y - r, r * 2, r * 2);
      }
      if (s > 0.985) {                                // 완성 후: 빛이 유리 위를 한 번 훑고 지나간다
        c.globalCompositeOperation = 'lighter';
        const ph = ((now / 2600) % 1.6) - 0.3, bx = ph * W * 1.4 - W * 0.2;
        const g = c.createLinearGradient(bx - W * 0.2, 0, bx + W * 0.2, Hh * 0.45);
        g.addColorStop(0, 'rgba(255,240,200,0)'); g.addColorStop(0.5, 'rgba(255,240,200,.2)'); g.addColorStop(1, 'rgba(255,240,200,0)');
        c.fillStyle = g; c.fillRect(0, 0, W, Hh);
      }
    }
    c.restore();
    c.setTransform(kx, 0, 0, ky, 0, 0); c.globalCompositeOperation = 'source-over';

    // ② 처리된 사이트: 유리 속 작은 기포
    c.fillStyle = 'rgba(255,252,240,.55)'; c.beginPath();
    for (const q of sim.sites) if (q.y <= L) { c.moveTo(q.x + 1.5, q.y); c.arc(q.x, q.y, 1.5, 0, 6.2832); }
    c.fill();

    // ③ 새로 놓인 사이트들의 포물선 전체 (최근 것만 옅게) — 해안선이 이 곡선들의 포락선이라는 걸 보여준다
    c.lineWidth = 1.1 * px; c.lineCap = 'round';
    for (let i = sim.sites.length - 1; i >= 0; i--) {
      const q = sim.sites[i]; if (q.y > L) continue;
      const d = L - q.y; if (d > 150) break;
      if (d < 1) continue;
      const c0 = (L + q.y) / 2, wl = Math.sqrt(Math.max(1, 2 * d * (150 - d / 2)));   // 해안선 위 150px 띠 안의 부분만
      const xa = q.x - wl, xb = q.x + wl, ya = c0 - wl * wl / (2 * d);
      c.strokeStyle = `rgba(255,252,236,${(0.4 * (1 - d / 150)).toFixed(3)})`;
      c.beginPath(); c.moveTo(xa, ya); c.quadraticCurveTo(q.x, c0 + wl * wl / (2 * d), xb, ya);   // 꼭짓점 c0 인 정확한 포물선
      c.stroke();
    }

    // ④ 납(lead) 선: 확정된 변 + 아직 접점이 그리고 있는 변
    const paths = [new Path2D(), new Path2D(), new Path2D()], N = scene.N, pr = scene.pair;
    const bucket = e => { const a = e.l.id, b = e.r.id; const v = pr.get((a < b ? a : b) * N + (a < b ? b : a)); return v === undefined ? 1 : v; };
    const edges = sim.st.edges;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i]; if (e.ex === null) continue;
      const g = sim.seg(e); if (!g) continue;
      const p = paths[bucket(e)]; p.moveTo(g[0], g[1]); p.lineTo(g[2], g[3]);
    }
    const tips = [];
    for (let i = 1; i < bl.length; i++) {
      const a = bl[i], e = a.arc.le; if (!e) continue;
      const bx = bl[i - 1].x1; if (bx < -20 || bx > WW + 20) continue;
      const by = sim.bpY(bl[i - 1].site, a.site, L, bx);
      const p = paths[bucket(e)];
      p.moveTo(e.sx === null ? bx : e.sx, e.sy === null ? -2000 : e.sy); p.lineTo(bx, by);
      tips.push(bx, by);
    }
    c.strokeStyle = LEAD; c.lineCap = 'round';
    c.lineWidth = 2.5 * px; c.stroke(paths[0]); c.lineWidth = 3.9 * px; c.stroke(paths[1]); c.lineWidth = 5.6 * px; c.stroke(paths[2]);

    // ⑤ 원 이벤트: 방금 터진 꼭짓점(원 + 점) 은 서서히 사라지고, 곧 터질 원은 점선으로 예고
    for (let i = sim.st.verts.length - 1; i >= 0; i--) {
      const v = sim.st.verts[i], age = L - v.ey; if (age > 95) break;
      const al = 1 - age / 95;
      if (v.r < 420) { c.strokeStyle = `rgba(255,250,232,${(al * 0.6).toFixed(3)})`; c.lineWidth = 1.5 * px; c.beginPath(); c.arc(v.x, v.y, v.r, 0, 6.2832); c.stroke(); }
      c.fillStyle = `rgba(255,236,170,${al.toFixed(3)})`; c.beginPath(); c.arc(v.x, v.y, 2.2 + 4.5 * al, 0, 6.2832); c.fill();
    }
    const pend = sim.pendingCircles(L, 120); pend.sort((u, w) => u.y - w.y);
    c.setLineDash([5 * px, 5 * px]);
    for (let i = 0; i < pend.length && i < 14; i++) {
      const e = pend[i], al = 1 - (e.y - L) / 120; if (e.r > 300) continue;
      c.strokeStyle = `rgba(26,20,32,${(al * 0.5).toFixed(3)})`; c.lineWidth = 3 * px; c.beginPath(); c.arc(e.cx, e.cy, e.r, 0, 6.2832); c.stroke();
      c.strokeStyle = `rgba(255,250,232,${(al * 0.9).toFixed(3)})`; c.lineWidth = 1.5 * px; c.stroke();
      c.fillStyle = `rgba(232,72,43,${al.toFixed(3)})`; c.beginPath(); c.arc(e.cx, e.y, 3.2, 0, 6.2832); c.fill();
    }
    c.setLineDash([]);

    // ⑥ 해안선 (포물선 호의 상위 포락선)
    traceBeach(c, bl, L, false);
    c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,205,110,.30)'; c.lineWidth = 9 * px; c.stroke();
    c.strokeStyle = 'rgba(26,20,32,.5)'; c.lineWidth = 4.4 * px; c.stroke();
    c.strokeStyle = '#fffaf0'; c.lineWidth = 2.1 * px; c.stroke();
    // 접점(펜 끝)
    c.fillStyle = '#fff'; c.strokeStyle = LEAD; c.lineWidth = 1.2 * px; c.beginPath();
    for (let i = 0; i < tips.length; i += 2) { c.moveTo(tips[i] + 3.6, tips[i + 1]); c.arc(tips[i], tips[i + 1], 3.6, 0, 6.2832); }
    c.fill(); c.stroke();

    // ⑦ 스윕라인
    if (L > -10) {
      c.strokeStyle = '#e8482b'; c.lineWidth = 1.6 * px; c.beginPath(); c.moveTo(0, L); c.lineTo(WW, L); c.stroke();
      c.fillStyle = '#e8482b'; c.beginPath(); c.moveTo(0, L - 7); c.lineTo(11, L); c.lineTo(0, L + 7); c.closePath();
      c.moveTo(WW, L - 7); c.lineTo(WW - 11, L); c.lineTo(WW, L + 7); c.closePath(); c.fill();
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    if (veil > 0.001) { c.globalAlpha = veil; c.fillStyle = '#efe3cc'; c.fillRect(0, 0, W, Hh); c.globalAlpha = 1; }
  }

  function render(now) {
    const L = Lof(s);
    if (L < advTo) { sim.reset(); advTo = -Infinity; }
    sim.advance(L); advTo = L;
    // 포인터 햇살
    if (ctx.fine && !ctx.reduced) {
      const r = cv.getBoundingClientRect(), mx = ctx.mouse.x - r.left, my = ctx.mouse.y - r.top;
      const inside = mx > 0 && my > 0 && mx < r.width && my < r.height;
      const tx = mx / r.width * cv.width, ty = my / r.height * cv.height;
      if (inside && spot.a < 0.05) { spot.x = tx; spot.y = ty; }
      spot.x += (tx - spot.x) * 0.25; spot.y += (ty - spot.y) * 0.25;
      spot.a += ((inside ? 1 : 0) - spot.a) * 0.18;
    }
    draw(L, now);
    // HTML 쪽 연동: 빛의 시계 · 번짐 정도
    const frac = Math.min(1, Math.max(0, L / WH));
    if (Math.abs(frac - lastFrac) > 0.0015) {
      lastFrac = frac; ruler.style.setProperty('--y', (frac * 100).toFixed(2) + '%');
      const mins = Math.round((9 + 9 * frac) * 60), hh = Math.floor(mins / 60), mm = String(mins % 60).padStart(2, '0');
      const clock = (hh < 12 ? '오전 ' : '오후 ') + (hh > 12 ? hh - 12 : hh) + ':' + mm;
      if (clock !== lastClock) { lastClock = clock; nowEl.textContent = clock; }
    }
    const lit = Math.min(1, Math.max(0, (L - 60) / (scene.Lend - 60)));
    if (Math.abs(lit - lastLit) > 0.01) { lastLit = lit; spill.style.setProperty('--lit', (lit * (1 - veil)).toFixed(3)); }
  }

  function step(dt, now) {
    const p = prox.p;
    if (Math.abs(p - lastP) > 2e-4) { lastP = p; lastScroll = now; }
    if (now - lastScroll < 1800) {                       // 사용자가 스크럽 중 → 스크롤 위치가 스윕을 지배
      const tgt = Math.min(1, p / 0.88);
      s += (tgt - s) * (1 - Math.exp(-dt * 8));
      phase = s > 0.995 ? 'hold' : 'sweep'; holdT = 0; veil = 0;
      return;
    }
    if (ctx.reduced) return;
    if (veil > 0 && phase !== 'fade') veil = Math.max(0, veil - dt / 0.7);
    if (phase === 'sweep') { s += dt / T_SWEEP; if (s >= 1) { s = 1; phase = 'hold'; holdT = 0; } }
    else if (phase === 'hold') { holdT += dt; if (holdT > T_HOLD) { phase = 'fade'; holdT = 0; } }
    else if (phase === 'fade') { holdT += dt; veil = Math.min(1, holdT / 0.9); if (holdT >= 0.9) { s = 0.03; phase = 'sweep'; } }
  }

  // ---- 스크롤(ScrollTrigger scrub) : 트랙 안을 지나는 동안 0→1 ----
  const tw = gsap.to(prox, { p: 1, ease: 'none', scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });

  // ---- 카피 등장 (한 번) ----
  const lns = [...root.querySelectorAll('.s190__ln > span')];
  const fades = [...root.querySelectorAll('.s190__eyebrow, .s190__lead, .s190__actions, .s190__info, .s190__hint')];
  gsap.set(lns, { yPercent: 112 }); gsap.set(fades, { autoAlpha: 0 });
  const intro = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
    .to(fades[0], { autoAlpha: 1, duration: 0.8 }, 0)
    .to(lns, { yPercent: 0, duration: 1.3, stagger: 0.12 }, 0.1)
    .to(fades.slice(1), { autoAlpha: 1, duration: 0.9, stagger: 0.1, ease: 'power2.out' }, 0.5);

  // ---- 루프 · 가시성 ----
  resize();
  const ro = new ResizeObserver(() => resize()); ro.observe(win);
  const io = new IntersectionObserver(es => {
    visible = es[0].isIntersecting;
    if (visible && !introDone) { introDone = true; intro.play(); }
  }, { threshold: 0.05 });
  io.observe(stage);

  let last = performance.now();
  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    if (now - last < 40) return;                          // ≈24fps 상한
    const dt = Math.min((now - last) / 1000, 0.12); last = now;
    step(dt, now); render(now);
  });
  render(performance.now());

  return () => {
    off(); io.disconnect(); ro.disconnect(); intro.kill();
    if (tw.scrollTrigger) tw.scrollTrigger.kill(); tw.kill();
    gsap.killTweensOf([...lns, ...fades]);
  };
}
