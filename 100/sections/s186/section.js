// 4D 다포체: 600셀 꼭짓점(황금비 좌표) → 120셀은 600셀의 정사면체 셀 중심(쌍대)으로 생성.
// 회전 = 6개 평면(XY,XZ,XW,YZ,YW,ZW) 회전행렬의 곱. 모서리는 S³ 위 대원호(slerp)로 쪼개 입체투영 → 3D 에서 원호가 된다.
const PHI = (1 + Math.sqrt(5)) / 2;

function perms(n) {
  const out = [];
  (function rec(a, used) {
    if (a.length === n) { let inv = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (a[i] > a[j]) inv++; out.push({ p: a.slice(), even: inv % 2 === 0 }); return; }
    for (let i = 0; i < n; i++) if (!used[i]) { used[i] = true; a.push(i); rec(a, used); a.pop(); used[i] = false; }
  })([], []);
  return out;
}

function build600() {
  const v = [];
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) { const a = [0, 0, 0, 0]; a[i] = s; v.push(a); }
  for (let m = 0; m < 16; m++) v.push([0, 1, 2, 3].map(i => (m >> i & 1 ? .5 : -.5)));
  const base = [PHI / 2, .5, 1 / (2 * PHI)];
  for (const { p, even } of perms(4)) {
    if (!even) continue;
    for (let m = 0; m < 8; m++) { const a = [0, 0, 0, 0]; for (let k = 0; k < 3; k++) a[p[k]] = (m >> k & 1 ? 1 : -1) * base[k]; v.push(a); }   // p[3] 자리는 0
  }
  return v;
}
const d2 = (a, b) => { let s = 0; for (let i = 0; i < 4; i++) s += (a[i] - b[i]) ** 2; return s; };

function makeEdges(v, target) {
  const e = [];
  for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (Math.abs(d2(v[i], v[j]) - target) < 1e-6) e.push(i, j);
  return e;
}

function buildPoly(kind) {
  let v, e, cells;
  if (kind === 'tess') {
    v = []; for (let m = 0; m < 16; m++) v.push([0, 1, 2, 3].map(i => (m >> i & 1 ? .5 : -.5)));
    e = makeEdges(v, 1); cells = 8;
  } else {
    const v6 = build600(), e6 = makeEdges(v6, 1 / (PHI * PHI));          // 변 길이 1/φ
    if (kind === 'c600') { v = v6; e = e6; cells = 0; }
    else {
      const nb = v6.map(() => []);
      for (let i = 0; i < e6.length; i += 2) { nb[e6[i]].push(e6[i + 1]); nb[e6[i + 1]].push(e6[i]); }
      const isN = (a, b) => nb[a].includes(b);
      const tets = [];
      for (let i = 0; i < v6.length; i++) {
        const N = nb[i].filter(j => j > i);
        for (let a = 0; a < N.length; a++) for (let b = a + 1; b < N.length; b++) {
          if (!isN(N[a], N[b])) continue;
          for (let c = b + 1; c < N.length; c++) if (isN(N[a], N[c]) && isN(N[b], N[c])) tets.push([i, N[a], N[b], N[c]]);
        }
      }
      v = tets.map(t => { const s = [0, 0, 0, 0]; for (const k of t) for (let i = 0; i < 4; i++) s[i] += v6[k][i]; const l = Math.hypot(...s); return s.map(x => x / l); });
      const faces = new Map();
      tets.forEach((t, ci) => { for (let skip = 0; skip < 4; skip++) { const f = t.filter((_, i) => i !== skip).sort((x, y) => x - y).join(','); (faces.get(f) || faces.set(f, []).get(f)).push(ci); } });
      e = []; for (const cs of faces.values()) if (cs.length === 2) e.push(cs[0], cs[1]);
      cells = 120;
      if (cells === 120 && tets.length !== 600) { v = v6; e = e6; cells = 0; }     // 방어: 기대와 다르면 600셀로 폴백
    }
    if (kind === 'c600') cells = 600;
  }
  const n = v.length, m = e.length / 2;
  const V = new Float64Array(n * 4); v.forEach((a, i) => V.set(a, i * 4));
  const dot = v[e[0]].reduce((s, x, i) => s + x * v[e[1]][i], 0);
  const theta = Math.acos(Math.max(-1, Math.min(1, dot)));
  const sub = kind === 'tess' ? 24 : kind === 'c600' ? 12 : 6;
  const wa = new Float64Array(sub + 1), wb = new Float64Array(sub + 1);
  for (let k = 0; k <= sub; k++) { const t = k / sub; wa[k] = Math.sin((1 - t) * theta) / Math.sin(theta); wb[k] = Math.sin(t * theta) / Math.sin(theta); }
  return { V, E: Int32Array.from(e), n, m, cells, sub, wa, wb, Vr: new Float64Array(n * 4) };
}

// 4×4 평면 회전 (행우선), 곱
const I4 = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
function planeRot(i, j, a) { const m = I4(), c = Math.cos(a), s = Math.sin(a); m[i * 4 + i] = c; m[j * 4 + j] = c; m[i * 4 + j] = -s; m[j * 4 + i] = s; return m; }
function mul4(A, B) { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += A[i * 4 + k] * B[k * 4 + j]; o[i * 4 + j] = s; } return o; }

const PAL = [[94, 230, 255], [74, 168, 255], [111, 123, 255], [160, 107, 255], [224, 107, 255], [255, 107, 181], [255, 138, 91], [255, 209, 102]];
const WIDTHS = [.7, 1.1, 1.6, 2.2, 3.0];
const WM = { tess: 2.3, c600: .85, c120: 1 };

export default function init(root, ctx) {
  const cv = root.querySelector('.s186__cv'), g = cv.getContext('2d');
  const chips = [...root.querySelectorAll('.s186__chip')];
  const nameEl = root.querySelector('[data-name]'), vEl = root.querySelector('[data-v]'), eEl = root.querySelector('[data-e]'), cEl = root.querySelector('[data-c]');
  if (!g) return;
  const NAMES = { tess: '초입방체', c600: '600셀', c120: '120셀' };
  const polys = {};
  const getPoly = k => polys[k] || (polys[k] = buildPoly(k));
  let kind = 'c120', P = getPoly(kind);
  let W = 1080, H = 608, res = 1;
  const fit = () => { const b = root.getBoundingClientRect(); W = Math.round(Math.max(320, b.width) * res * .75); H = Math.round(Math.max(300, b.height) * res * .75); if (cv.width !== W) cv.width = W; if (cv.height !== H) cv.height = H; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(root);

  const st = { kScale: 1, alpha: 1 };
  function setKind(k, instant) {
    kind = k; P = getPoly(k);
    chips.forEach(c => c.classList.toggle('is-on', c.dataset.k === k));
    nameEl.textContent = NAMES[k]; vEl.textContent = P.n; eEl.textContent = P.m; cEl.textContent = P.cells || 600;
    if (!instant) { gsap.killTweensOf(st); gsap.fromTo(st, { kScale: .55, alpha: 0 }, { kScale: 1, alpha: 1, duration: 1.4, ease: 'expo.out' }); }
    lastSwitch = performance.now();
  }
  let lastSwitch = performance.now(), userHold = 0;
  const order = ['c120', 'c600', 'tess'];
  const chipFns = chips.map(c => { const f = () => { setKind(c.dataset.k); userHold = performance.now(); }; c.addEventListener('click', f); return f; });
  setKind('c120', true);

  // 입력: 드래그 = 3D 시점(XZ, YZ), 자동 = XW,YW,ZW + XY
  const ang = { xy: 0, xz: 0, xw: 0, yz: 0, yw: 0, zw: 0 };
  const rate = { xy: .05, xz: .035, xw: .21, yz: .02, yw: .13, zw: .17 };
  let drag = false, lx = 0, ly = 0, vx = 0, vy = 0;
  const onDown = e => { drag = true; lx = e.clientX; ly = e.clientY; userHold = performance.now(); try { cv.setPointerCapture(e.pointerId); } catch (_) { } };
  const onMove = e => { if (!drag) return; vx = (e.clientX - lx) * .006; vy = (e.clientY - ly) * .006; ang.xz += vx; ang.yz += vy; lx = e.clientX; ly = e.clientY; userHold = performance.now(); };
  const onUp = () => { drag = false; };
  cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

  let visible = true, last = performance.now(), acc = 0, avg = 20, nf = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  const px = new Float64Array(40), py = new Float64Array(40), pw = new Float64Array(40), pz = new Float64Array(40), pk = new Float64Array(40), ok = new Uint8Array(40);

  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    acc += now - last; last = now;
    if (acc < 50) return;
    const dt = Math.min(.12, acc / 1000); acc = 0;
    const ts = performance.now();
    const sp = ctx.reduced ? .3 : 1;
    for (const k in rate) ang[k] += rate[k] * dt * sp;
    if (!drag) { ang.xz += vx; ang.yz += vy; vx *= .9; vy *= .9; }
    if (now - lastSwitch > 22000 && now - userHold > 15000) setKind(order[(order.indexOf(kind) + 1) % 3]);

    // 6평면 회전행렬
    let R = planeRot(0, 3, ang.xw);
    R = mul4(R, planeRot(1, 3, ang.yw)); R = mul4(R, planeRot(2, 3, ang.zw));
    R = mul4(R, planeRot(0, 1, ang.xy)); R = mul4(R, planeRot(0, 2, ang.xz)); R = mul4(R, planeRot(1, 2, ang.yz));
    const { V, Vr, E, m, sub, wa, wb, n } = P;
    for (let i = 0; i < n; i++) {
      const x = V[i * 4], y = V[i * 4 + 1], z = V[i * 4 + 2], w = V[i * 4 + 3];
      Vr[i * 4] = R[0] * x + R[1] * y + R[2] * z + R[3] * w; Vr[i * 4 + 1] = R[4] * x + R[5] * y + R[6] * z + R[7] * w;
      Vr[i * 4 + 2] = R[8] * x + R[9] * y + R[10] * z + R[11] * w; Vr[i * 4 + 3] = R[12] * x + R[13] * y + R[14] * z + R[15] * w;
    }
    const camD = 6.5, F = .30 * H * camD * st.kScale, cx = W * (W > H * 1.25 ? .64 : .5), cy = H * .5;
    const B = []; for (let i = 0; i < 40; i++) B.push(new Path2D());
    let segs = 0;
    for (let e = 0; e < m; e++) {
      const ia = E[e * 2] * 4, ib = E[e * 2 + 1] * 4;
      for (let k = 0; k <= sub; k++) {
        const A = wa[k], Bk = wb[k];
        const x = A * Vr[ia] + Bk * Vr[ib], y = A * Vr[ia + 1] + Bk * Vr[ib + 1], z = A * Vr[ia + 2] + Bk * Vr[ib + 2], w = A * Vr[ia + 3] + Bk * Vr[ib + 3];
        const om = 1 - w;
        if (om < .1) { ok[k] = 0; continue; }                       // 투영점 근처 클램핑(그 부분은 어차피 화면 밖으로 달아남)
        const kk = 1 / om, Z = z * kk, dep = camD - Z;
        if (dep < 1.3) { ok[k] = 0; continue; }
        const q = F / dep;
        px[k] = cx + x * kk * q; py[k] = cy + y * kk * q; pz[k] = Z; pw[k] = w; pk[k] = kk; ok[k] = 1;
      }
      for (let k = 0; k < sub; k++) {
        if (!ok[k] || !ok[k + 1]) continue;
        const x0 = px[k], y0 = py[k], x1 = px[k + 1], y1 = py[k + 1];
        if ((x0 < -80 && x1 < -80) || (x0 > W + 80 && x1 > W + 80) || (y0 < -80 && y1 < -80) || (y0 > H + 80 && y1 > H + 80)) continue;
        const zm = (pz[k] + pz[k + 1]) * .5, wm = (pw[k] + pw[k + 1]) * .5;
        let wb_ = Math.floor((zm + 2.2) / 1.2); wb_ = wb_ < 0 ? 0 : wb_ > 4 ? 4 : wb_;
        if (wb_ > 2 && (pk[k] > 3.2 || pk[k + 1] > 3.2)) wb_ = 2;          // 투영점 쪽 거대 호는 가늘게
        let cb = Math.floor((wm * .5 + .5) * 8); cb = cb < 0 ? 0 : cb > 7 ? 7 : cb;
        const p = B[cb * 5 + wb_]; p.moveTo(x0, y0); p.lineTo(x1, y1); segs++;
      }
    }
    g.clearRect(0, 0, W, H);
    g.lineCap = 'round';
    g.globalAlpha = st.alpha;
    const sc = W / 1080 * 1.0;
    for (let cb = 0; cb < 8; cb++) for (let w_ = 0; w_ < 5; w_++) {
      const c = PAL[cb];
      g.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(Math.min(1, (.26 + .17 * w_) * (kind === 'tess' ? 1.5 : 1))).toFixed(2)})`;
      g.lineWidth = WIDTHS[w_] * WM[kind] * Math.max(.8, sc * 1.25);
      g.stroke(B[cb * 5 + w_]);
    }
    g.globalAlpha = 1;
    const ms = performance.now() - ts; avg = avg * .85 + ms * .15;
    if (++nf % 10 === 0) {                                              // 프레임 비용으로 렌더 해상도 적응
      if (avg > 38 && res > .5) { res = Math.max(.5, res - .15); fit(); }
      else if (avg < 14 && res < 1) { res = Math.min(1, res + .15); fit(); }
    }
  });

  return () => {
    off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    cv.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
    chips.forEach((c, i) => c.removeEventListener('click', chipFns[i]));
    gsap.killTweensOf(st);
  };
}
