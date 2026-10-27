// s200 — 가우시안 스플랫 미니 렌더러 (월요 달항아리)
// 파이프라인: 절차 생성(이방성 3D 가우시안) → 디졸브 변위 → 카메라 공간 → (조건부) 깊이 기수 정렬
//            → 공분산 투영 Σ' = J·W·Σ·Wᵀ·Jᵀ (+0.3px² EWA 저역통과) → 고유분해 → 인스턴스 쿼드(WebGL) / 스프라이트(Canvas2D)
export default function init(root, ctx) {
  const stage = root.querySelector('.s200__stage');
  const view = root.querySelector('.s200__view');
  const QS = new URLSearchParams(location.search), FORCE = QS.get('s200r'); // 측정용: 'gl' | '2d' (+ s200lod, s200scale 로 적응 품질 고정)

  /* ============================== 수학 도우미 ============================== */
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
  const norm = (x, y, z) => { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

  function rng(seed) { // mulberry32
    let a = seed | 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function lat(x, y, z) { // 정수 격자 해시 → [0,1)
    let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440670441)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296;
  }
  function vnoise(x, y, z) { // 3D value noise (삼선형 + smoothstep 보간)
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    let fx = x - xi, fy = y - yi, fz = z - zi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
    const a = lerp(lat(xi, yi, zi), lat(xi + 1, yi, zi), fx), b = lerp(lat(xi, yi + 1, zi), lat(xi + 1, yi + 1, zi), fx);
    const c = lerp(lat(xi, yi, zi + 1), lat(xi + 1, yi, zi + 1), fx), d = lerp(lat(xi, yi + 1, zi + 1), lat(xi + 1, yi + 1, zi + 1), fx);
    return lerp(lerp(a, b, fy), lerp(c, d, fy), fz);
  }
  function curl(x, y, z) { // 벡터 포텐셜 Ψ=(n0,n1,n2) 의 회전 ∇×Ψ — 비압축(발산 0) 속도장 → 소용돌이 흩어짐
    const e = 0.1, k = 1.35;
    const P = (c, px, py, pz) => vnoise(px * k + c * 17.3, py * k + c * 5.9, pz * k + c * 9.1);
    const dz = (c) => P(c, x, y, z + e) - P(c, x, y, z - e), dy = (c) => P(c, x, y + e, z) - P(c, x, y - e, z), dx = (c) => P(c, x + e, y, z) - P(c, x - e, y, z);
    const s = 1 / (2 * e);
    return [(dy(2) - dz(1)) * s, (dz(0) - dx(2)) * s, (dx(1) - dy(0)) * s];
  }
  // 정규직교 프레임(열 e, f, e×f) → 단위 쿼터니언 (Shepperd)
  function quatFrame(e, f) {
    const n = cross(e, f);
    const m00 = e[0], m01 = f[0], m02 = n[0], m10 = e[1], m11 = f[1], m12 = n[1], m20 = e[2], m21 = f[2], m22 = n[2];
    const tr = m00 + m11 + m22; let w, x, y, z;
    if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; w = s / 4; x = (m21 - m12) / s; y = (m02 - m20) / s; z = (m10 - m01) / s; }
    else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; w = (m21 - m12) / s; x = s / 4; y = (m01 + m10) / s; z = (m02 + m20) / s; }
    else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; w = (m02 - m20) / s; x = (m01 + m10) / s; y = s / 4; z = (m12 + m21) / s; }
    else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; w = (m10 - m01) / s; x = (m02 + m20) / s; y = (m12 + m21) / s; z = s / 4; }
    const l = Math.hypot(x, y, z, w) || 1; return [x / l, y / l, z / l, w / l];
  }
  function perp(d) { // d 에 수직인 두 단위벡터
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const a = cross(d, ref); const l = Math.hypot(a[0], a[1], a[2]) || 1; a[0] /= l; a[1] /= l; a[2] /= l;
    return [a, cross(d, a)];
  }

  /* ============================== 절차 장면 ============================== */
  const STR = 18, K_BODY = 0, K_GROUND = 1, K_SHADOW = 2, K_MOTE = 3;
  const LIGHT = norm(-0.5, 0.74, 0.46);

  function catmull(p0, p1, p2, p3, t) {
    const t2 = t * t, t3 = t2 * t, o = [0, 0];
    for (let i = 0; i < 2; i++) o[i] = 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * t + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * t2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * t3);
    return o;
  }
  // 선반(lathe) 프로파일 (r,y) 곡선 → 조밀 테이블, 법선, 면적 누적(균일 면적 샘플용)
  function makeProfile(ctrl) {
    const pts = [], n = ctrl.length;
    for (let i = 0; i < n - 1; i++) {
      const p0 = ctrl[Math.max(0, i - 1)], p1 = ctrl[i], p2 = ctrl[i + 1], p3 = ctrl[Math.min(n - 1, i + 2)];
      for (let k = 0; k < 10; k++) pts.push(catmull(p0, p1, p2, p3, k / 10));
    }
    pts.push(ctrl[n - 1].slice());
    const m = pts.length, P = { m, r: new Float32Array(m), y: new Float32Array(m), nr: new Float32Array(m), ny: new Float32Array(m), tr: new Float32Array(m), ty: new Float32Array(m), cum: new Float32Array(m) };
    for (let j = 0; j < m; j++) { P.r[j] = pts[j][0]; P.y[j] = pts[j][1]; }
    for (let j = 0; j < m; j++) {
      const a = Math.max(0, j - 1), b = Math.min(m - 1, j + 1);
      let dr = P.r[b] - P.r[a], dy = P.y[b] - P.y[a]; const l = Math.hypot(dr, dy) || 1; dr /= l; dy /= l;
      P.tr[j] = dr; P.ty[j] = dy; P.nr[j] = dy; P.ny[j] = -dr;
      if (j > 0) P.cum[j] = P.cum[j - 1] + Math.hypot(P.r[j] - P.r[j - 1], P.y[j] - P.y[j - 1]) * 0.5 * (P.r[j] + P.r[j - 1]);
    }
    P.total = P.cum[m - 1]; return P;
  }
  function evalAt(P, lo, f, o) {
    const hi = lo + 1;
    o.r = lerp(P.r[lo], P.r[hi], f); o.y = lerp(P.y[lo], P.y[hi], f);
    const tr = lerp(P.tr[lo], P.tr[hi], f), ty = lerp(P.ty[lo], P.ty[hi], f), l = Math.hypot(tr, ty) || 1;
    o.tr = tr / l; o.ty = ty / l; o.nr = o.ty; o.ny = -o.tr; return o;
  }
  function sampleArea(P, u, o) { // u∈[0,1) → 면적 균일 위치
    const tgt = u * P.total; let lo = 0, hi = P.m - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P.cum[mid] <= tgt) lo = mid; else hi = mid; }
    const seg = P.cum[hi] - P.cum[lo]; return evalAt(P, lo, seg > 0 ? (tgt - P.cum[lo]) / seg : 0, o);
  }
  function sampleY(P, yv, o) { // y 단조 증가 프로파일에서 높이로 조회
    let lo = 0, hi = P.m - 1; yv = clamp(yv, P.y[0], P.y[hi]);
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (P.y[mid] <= yv) lo = mid; else hi = mid; }
    const seg = P.y[hi] - P.y[lo]; return evalAt(P, lo, seg > 0 ? (yv - P.y[lo]) / seg : 0, o);
  }

  const JAR = makeProfile([[0.285, 0], [0.30, 0.03], [0.325, 0.065], [0.375, 0.115], [0.44, 0.19], [0.50, 0.29], [0.535, 0.40], [0.545, 0.50], [0.535, 0.60], [0.495, 0.70], [0.425, 0.79], [0.345, 0.865], [0.285, 0.925], [0.255, 0.97], [0.252, 1.005], [0.262, 1.035], [0.272, 1.05]]);
  const JAR_IN = makeProfile([[0.240, 1.046], [0.232, 1.0], [0.226, 0.94], [0.214, 0.885], [0.19, 0.845]]);
  const CUP = makeProfile([[0.070, 0], [0.075, 0.015], [0.092, 0.035], [0.13, 0.075], [0.165, 0.125], [0.18, 0.17], [0.186, 0.192]]);
  const CUP_IN = makeProfile([[0.176, 0.19], [0.162, 0.15], [0.125, 0.09], [0.085, 0.05]]);

  function buildScene() {
    const rnd = rng(0x20c0ffe), rr = (a, b) => a + (b - a) * rnd();
    const rec = [];
    const add = (x, y, z, q, sx, sy, sz, r, g, b, op, kind, dg, og, fd) =>
      rec.push(x, y, z, q[0], q[1], q[2], q[3], sx, sy, sz, r, g, b, op, kind, dg, og, fd);
    // 표면에 붙은 원반(local z = −바깥 법선)은 kind 에 16 비트를 달아 "뒷면 컬링 대상"으로 표시 (nc=1 이면 제외)
    const obj = (x, y, z, q, sx, sy, sz, c, op, nc) => add(x, y, z, q, sx, sy, sz, c[0], c[1], c[2], op, nc ? K_BODY : K_BODY | 16, 1, 1, 0.45);
    const tmp = {};

    // 도자기 유약의 베이크드 라이팅 (램버트 + 반구광 + AO + 지면 반사광 + 하이라이트)
    function porcelain(n, y, tint) {
      const lam = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
      const t = clamp(0.20 + 0.60 * lam + 0.26 * (0.5 + 0.5 * n[1]), 0, 1) * (0.72 + 0.28 * sstep(0, 0.24, y));
      const H = norm(LIGHT[0] + 0.43, LIGHT[1] + 0.3, LIGHT[2] + 0.9);
      const spec = Math.pow(Math.max(0, n[0] * H[0] + n[1] * H[1] + n[2] * H[2]), 40) * 0.30;
      const bounce = Math.max(0, 0.5 - y) / 0.5 * Math.max(0, 0.6 - n[1]) * 0.20;
      return [lerp(0.60, 0.985, t) * tint[0] + spec + bounce * 0.85, lerp(0.64, 0.965, t) * tint[1] + spec + bounce * 0.55, lerp(0.79, 0.93, t) * tint[2] + spec + bounce * 0.28];
    }
    const WHITE = [1, 1, 1];

    /* ---- 달항아리 몸통: 표면 접선 프레임에 정렬된 납작한 원반형 스플랫 ---- */
    const NB = 8800, spacing = Math.sqrt(2 * Math.PI * JAR.total / NB);
    for (let i = 0; i < NB; i++) {
      const u = (i * 0.6180339887 + rr(0, 0.35) / NB) % 1, phi = ((i * 0.7548776662 + rr(0, 0.5) / NB) % 1) * 2 * Math.PI;
      const s = sampleArea(JAR, u, tmp), cp = Math.cos(phi), sp = Math.sin(phi);
      const ephi = [-sp, 0, cp], es = norm(s.tr * cp, s.ty, s.tr * sp), nn = [s.nr * cp, s.ny, s.nr * sp];
      const q = quatFrame(ephi, es), v = rr(0.97, 1.03);
      let c = porcelain(nn, s.y, [v * rr(0.985, 1.01), v, v * rr(0.99, 1.02)]);
      if (s.y < 0.05) { const k = 0.55 + 0.45 * Math.max(0, nn[0] * LIGHT[0] + nn[2] * LIGHT[2] + 0.5); c = [0.66 * k, 0.40 * k, 0.27 * k]; } // 굽: 유약 안 바른 철분 태토
      const sg = spacing * rr(0.66, 0.84);
      obj(s.r * cp, s.y, s.r * sp, q, sg * rr(0.95, 1.4), sg * rr(0.75, 1.1), 0.0045, c, rr(0.78, 0.95));
    }
    // 입술 안쪽 벽 + 어둠
    for (let i = 0; i < 220; i++) {
      const s = sampleArea(JAR_IN, (i * 0.618) % 1, tmp), phi = ((i * 0.7548 + 0.13) % 1) * 2 * Math.PI, cp = Math.cos(phi), sp = Math.sin(phi);
      const q = quatFrame([-sp, 0, cp], norm(s.tr * cp, s.ty, s.tr * sp)), d = 1 - sstep(1.046, 0.845, s.y) * 0.85;
      obj(s.r * cp, s.y, s.r * sp, q, 0.022, 0.02, 0.004, [0.30 * d + 0.05, 0.31 * d + 0.06, 0.40 * d + 0.10], 0.92);
    }
    // 입술 테두리: 수평으로 누운 얇은 링 (입구가 들쭉날쭉해 보이지 않도록)
    for (let i = 0; i < 110; i++) {
      const phi = (i / 110) * 2 * Math.PI + rr(-0.02, 0.02), cp = Math.cos(phi), sp = Math.sin(phi), k = rr(0.97, 1.03);
      obj(0.258 * cp, 1.046, 0.258 * sp, quatFrame([-sp, 0, cp], [cp, 0, sp]), 0.021, 0.016, 0.004, [0.95 * k, 0.93 * k, 0.90 * k], 0.93, 1);
    }
    for (let i = 0; i < 22; i++) { const a = rr(0, 6.283), r = Math.sqrt(rnd()) * 0.2; obj(r * Math.cos(a), 0.86, r * Math.sin(a), [0, 0, 0, 1], 0.05, 0.004, 0.05, [0.05, 0.06, 0.13], 0.95, 1); }

    /* ---- 청화 붓질: 곡면 위에 깔리는 갸름한 코발트 스플랫 ---- */
    const COBALT = [0.10, 0.21, 0.56];
    function paintDot(phi, yv, sa, sc, ang, wash) {
      const s = sampleY(JAR, yv, tmp), cp = Math.cos(phi), sp = Math.sin(phi);
      const ephi = [-sp, 0, cp], es = norm(s.tr * cp, s.ty, s.tr * sp), nn = [s.nr * cp, s.ny, s.nr * sp];
      const ca = Math.cos(ang), sn = Math.sin(ang);
      const d = [ca * ephi[0] + sn * es[0], ca * ephi[1] + sn * es[1], ca * ephi[2] + sn * es[2]];
      const d2 = [-sn * ephi[0] + ca * es[0], -sn * ephi[1] + ca * es[1], -sn * ephi[2] + ca * es[2]];
      const lam = Math.max(0, nn[0] * LIGHT[0] + nn[1] * LIGHT[1] + nn[2] * LIGHT[2]), sh = 0.62 + 0.5 * lam;
      const w = wash;
      const c = [lerp(COBALT[0], 0.30, w) * sh, lerp(COBALT[1], 0.46, w) * sh, lerp(COBALT[2], 0.80, w) * sh];
      const off = 0.0042;
      obj(s.r * cp + nn[0] * off, s.y + nn[1] * off, s.r * sp + nn[2] * off, quatFrame(d, d2), sa, sc, 0.0026, c, rr(0.88, 0.97));
    }
    function paintBlossom(phi0, u, v, R) {
      for (let k = 0; k < 5; k++) {
        const a = k * 1.2566 + rr(-0.2, 0.2), uu = u + Math.cos(a) * R, vv = v + Math.sin(a) * R;
        const r = sampleY(JAR, vv, tmp).r; paintDot(phi0 + uu / r, vv, R * 0.5, R * 0.42, a, 0.35 + rr(0, 0.25));
      }
      const r = sampleY(JAR, v, tmp).r; paintDot(phi0 + u / r, v, R * 0.2, R * 0.2, 0, 0);
    }
    function paintTwig(phi0, u, v, ang, len, w, depth) {
      const step = 0.0105, steps = (len / step) | 0; let cu = u, cv = v, a = ang;
      for (let i = 0; i < steps; i++) {
        a += rr(-0.13, 0.13); cu += Math.cos(a) * step; cv += Math.sin(a) * step;
        if (cv < 0.15 || cv > 0.88) break;
        const r = sampleY(JAR, cv, tmp).r, ww = w * (1 - 0.55 * i / steps);
        paintDot(phi0 + cu / r, cv, step * 0.95, ww * 0.55, a, i / steps * 0.45 + rr(0, 0.2));
        if (depth < 2 && i > steps * 0.22 && rnd() < 0.05) paintTwig(phi0, cu, cv, a + (rnd() < 0.5 ? -1 : 1) * rr(0.5, 0.95), len * rr(0.35, 0.55), w * 0.68, depth + 1);
      }
      if (depth >= 1) paintBlossom(phi0, cu, cv, 0.05);
    }
    const FACE = 1.12; // 시작 카메라가 보는 방위(rad)
    paintTwig(FACE, -0.55, 0.20, 0.62, 1.15, 0.034, 0);
    paintBlossom(FACE, 0.30, 0.66, 0.05); paintBlossom(FACE, -0.05, 0.50, 0.042);
    paintTwig(FACE + Math.PI, 0.4, 0.84, -2.55, 0.95, 0.032, 0);
    paintTwig(FACE + Math.PI * 0.5, -0.1, 0.20, 1.2, 0.55, 0.028, 1);
    paintTwig(FACE + Math.PI * 1.5, 0.1, 0.22, 1.9, 0.5, 0.028, 1);
    for (const [yv, hw] of [[0.935, 0.017], [0.905, 0.007], [0.145, 0.02], [0.176, 0.007]]) { // 목·굽 둘레 띠
      const r = sampleY(JAR, yv, tmp).r, cnt = Math.round(2 * Math.PI * r / 0.0085);
      for (let i = 0; i < cnt; i++) paintDot(i / cnt * 2 * Math.PI, yv, 0.0105, hw * 0.55, 0, rr(0, 0.25));
    }
    // 유약 흘러내림(드립): 입술에서 아래로 흐른 연한 청회색
    for (let k = 0; k < 16; k++) {
      const phi = rr(0, 6.283), len = rr(0.05, 0.16), yv0 = 1.0;
      for (let j = 0; j < 6; j++) {
        const yv = yv0 - len * j / 5, s = sampleY(JAR, yv, tmp), cp = Math.cos(phi), sp = Math.sin(phi);
        const es = norm(s.tr * cp, s.ty, s.tr * sp), ephi = [-sp, 0, cp], nn = [s.nr * cp, s.ny, s.nr * sp];
        add(s.r * cp + nn[0] * 0.003, s.y, s.r * sp + nn[2] * 0.003, quatFrame(es, ephi), 0.022, 0.008 * (1 - j * 0.1), 0.003, 0.74, 0.82, 0.90, 0.55, K_BODY, 1, 1, 0.55);
      }
    }

    /* ---- 매화 가지: 3D 재귀 + 꽃잎 5장(납작한 원반) ---- */
    const BARK = [0.20, 0.14, 0.12];
    function blossom(cx, cy, cz, size) {
      const nrm = norm(rr(-1, 1), rr(-0.3, 1), rr(-1, 1)), [a, b] = perp(nrm), pink = rr(0, 1);
      for (let k = 0; k < 5; k++) {
        const ang = k * 1.2566 + rr(-0.2, 0.2), ra = [Math.cos(ang) * a[0] + Math.sin(ang) * b[0], Math.cos(ang) * a[1] + Math.sin(ang) * b[1], Math.cos(ang) * a[2] + Math.sin(ang) * b[2]];
        const tg = cross(nrm, ra), o = size * 0.92, c = lerp(0.8, 1, pink * rnd());
        add(cx + ra[0] * o, cy + ra[1] * o, cz + ra[2] * o, quatFrame(ra, tg), size * 0.62, size * 0.5, size * 0.12, 1.0, c * 0.86 + 0.1, c * 0.88 + 0.1, 0.95, K_BODY, 1, 1, 0.55);
      }
      add(cx, cy, cz, [0, 0, 0, 1], size * 0.3, size * 0.3, size * 0.3, 0.93, 0.66, 0.26, 0.95, K_BODY, 1, 1, 0.55);
    }
    function twig(p, d, len, rad, depth) {
      let px = p[0], py = p[1], pz = p[2], dx = d[0], dy = d[1], dz = d[2];
      const step = 0.038, steps = Math.max(3, (len / step) | 0);
      for (let i = 0; i < steps; i++) {
        dx += rr(-0.32, 0.32); dy += rr(-0.2, 0.2) + 0.03; dz += rr(-0.32, 0.32);
        const l = Math.hypot(dx, dy, dz); dx /= l; dy /= l; dz /= l;
        px += dx * step; py += dy * step; pz += dz * step;
        const w = rad * (1 - 0.5 * i / steps), [a, b] = perp([dx, dy, dz]), k = rr(0.9, 1.1);
        add(px, py, pz, quatFrame([dx, dy, dz], a), step * 0.85, w * 1.05, w * 0.9, BARK[0] * k, BARK[1] * k, BARK[2] * k, 0.96, K_BODY, 1, 1, 0.55);
        if (depth >= 1 && rnd() < 0.45) { const o = rr(0.01, 0.03); blossom(px + b[0] * o, py + b[1] * o + 0.01, pz + b[2] * o, rr(0.036, 0.052)); }
        if (depth < 3 && i > 1 && i < steps - 1 && rnd() < (depth === 0 ? 0.2 : 0.15)) {
          const sgn = rnd() < 0.5 ? -1 : 1, ang = rr(0.5, 0.95) * sgn, ca = Math.cos(ang), sn = Math.sin(ang);
          twig([px, py, pz], norm(dx * ca - dz * sn, dy + rr(0, 0.25), dx * sn + dz * ca), len * rr(0.5, 0.65), rad * 0.72, depth + 1);
        }
      }
      if (depth >= 1) { blossom(px, py, pz, 0.052); for (let k = 0; k < 2; k++) add(px + rr(-.04, .04), py + rr(0, .05), pz + rr(-.04, .04), [0, 0, 0, 1], 0.017, 0.017, 0.017, 0.74, 0.30, 0.42, 0.95, K_BODY, 1, 1, 0.55); }
    }
    twig([0.02, 1.0, 0.0], norm(0.3, 1, -0.15), 0.9, 0.022, 0);
    twig([0.03, 1.0, 0.0], norm(-0.62, 1, 0.28), 0.62, 0.017, 1);
    twig([0.0, 1.0, 0.03], norm(0.7, 1, -0.32), 0.46, 0.015, 1);
    twig([-0.02, 1.0, 0.0], norm(-0.55, 1, 0.5), 0.4, 0.014, 1);

    /* ---- 찻잔(청자) + 찻물 ---- */
    const CX = 1.02, CZ = -0.2;
    for (let i = 0; i < 640; i++) {
      const s = sampleArea(CUP, (i * 0.618) % 1, tmp), phi = ((i * 0.7548 + 0.31) % 1) * 2 * Math.PI, cp = Math.cos(phi), sp = Math.sin(phi);
      const nn = [s.nr * cp, s.ny, s.nr * sp], q = quatFrame([-sp, 0, cp], norm(s.tr * cp, s.ty, s.tr * sp));
      const c = porcelain(nn, s.y * 2.2, [0.64 * rr(.97, 1.03), 0.86 * rr(.97, 1.03), 0.74 * rr(.97, 1.03)]);
      obj(CX + s.r * cp, s.y, CZ + s.r * sp, q, rr(0.012, 0.017), rr(0.01, 0.014), 0.004, c, rr(0.8, 0.95));
    }
    for (let i = 0; i < 280; i++) {
      const s = sampleArea(CUP_IN, (i * 0.618) % 1, tmp), phi = ((i * 0.7548 + 0.7) % 1) * 2 * Math.PI, cp = Math.cos(phi), sp = Math.sin(phi);
      const q = quatFrame([-sp, 0, cp], norm(s.tr * cp, s.ty, s.tr * sp)), d = 0.55 + 0.45 * sstep(0.05, 0.19, s.y);
      obj(CX + s.r * cp, s.y, CZ + s.r * sp, q, 0.014, 0.013, 0.004, [0.50 * d, 0.68 * d, 0.58 * d], 0.9);
    }
    for (let i = 0; i < 70; i++) { const a = rr(0, 6.283), r = Math.sqrt(rnd()) * 0.15; obj(CX + r * Math.cos(a), 0.125, CZ + r * Math.sin(a), [0, 0, 0, 1], 0.026, 0.004, 0.026, [0.62, 0.38, 0.17], 0.92, 1); }

    /* ---- 받침(원목 상판): 결 방향으로 긴 스플랫 + 바탕 스플랫, 가장자리로 갈수록 투명 ---- */
    const GR = 1.7;
    for (let i = 0; i < 250; i++) {
      const rad = GR * Math.sqrt((i * 0.7548776662 + rr(0, 0.4) / 250) % 1), ang = ((i * 0.5698402909) % 1) * 2 * Math.PI;
      if (rad < 0.2) continue;
      const f = sstep(GR, GR * 0.5, rad), sz = rr(0.10, 0.125) * lerp(0.75, 1, f), v = rr(0.94, 1.06);
      const nz = vnoise(Math.cos(ang) * rad * 1.3 + 3, 0, Math.sin(ang) * rad * 1.3) - 0.5;
      add(rad * Math.cos(ang), -0.004, rad * Math.sin(ang), [0, 0, 0, 1], sz * 1.1, 0.012, sz, (0.86 + nz * 0.14) * v, (0.68 + nz * 0.12) * v, (0.48 + nz * 0.10) * v, 0.8 * f, K_GROUND, 0.1, 0.25, 0.18);
    }
    for (let i = 0; i < 90; i++) {
      const rad = GR * 0.95 * Math.sqrt((i * 0.7548776662 + 0.21) % 1), ang = ((i * 0.5698402909 + 0.4) % 1) * 2 * Math.PI;
      if (rad < 0.25) continue;
      const f = sstep(GR, GR * 0.45, rad), a = rr(-0.07, 0.07), v = rr(0.8, 1.08), dark = rnd() < 0.6;
      add(rad * Math.cos(ang), -0.002, rad * Math.sin(ang), [0, Math.sin(a / 2), 0, Math.cos(a / 2)], rr(0.2, 0.3) * lerp(0.7, 1, f), 0.01, rr(0.014, 0.024), (dark ? 0.68 : 0.92) * v, (dark ? 0.50 : 0.76) * v, (dark ? 0.34 : 0.56) * v, rr(0.22, 0.4) * f, K_GROUND, 0.1, 0.25, 0.18);
    }
    // 접지 그림자(빛 반대쪽으로 늘어진 부드러운 암부)
    const sd = [-LIGHT[0], -LIGHT[2]], sdl = Math.hypot(sd[0], sd[1]);
    function shadowBlob(cx, cz, rad, count, stretch) {
      for (let i = 0; i < count; i++) {
        const a = rr(0, 6.283), r = Math.sqrt(rnd()) * rad, x = cx + Math.cos(a) * r + sd[0] / sdl * stretch * r * rnd(), z = cz + Math.sin(a) * r + sd[1] / sdl * stretch * r * rnd();
        add(x, 0.002, z, [0, 0, 0, 1], rr(0.08, 0.13), 0.008, rr(0.08, 0.13), 0.22, 0.13, 0.09, rr(0.17, 0.3) * (1 - r / rad * 0.5), K_SHADOW, 0, 0.2, 0.95);
      }
    }
    shadowBlob(0, 0, 0.62, 30, 0.7); shadowBlob(0, 0, 0.5, 14, 0.3); shadowBlob(CX, CZ, 0.26, 10, 0.6);

    /* ---- 먼지(가마 불티): 공중에 떠도는 작은 등방 스플랫 ---- */
    for (let i = 0; i < 170; i++) {
      const a = rr(0, 6.283), r = Math.sqrt(rnd()) * 2.1, gold = rnd() < 0.6, s = rr(0.009, 0.022);
      add(Math.cos(a) * r, rr(-0.1, 2.3), Math.sin(a) * r * 0.8, [0, 0, 0, 1], s, s, s, gold ? 1.0 : 0.6, gold ? 0.82 : 0.72, gold ? 0.5 : 0.95, rr(0.35, 0.65), K_MOTE, 0.5, 0.3, 0.15);
    }

    /* ---------- 타입 배열로 정리 + 디졸브 사전계산 ---------- */
    const N = rec.length / STR;
    const perm = new Uint32Array(N); for (let i = 0; i < N; i++) perm[i] = i;
    for (let i = N - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0, t = perm[i]; perm[i] = perm[j]; perm[j] = t; } // LOD 접두부가 균일 부분집합이 되도록 셔플
    const S = {
      N, pos: new Float32Array(N * 3), quat: new Float32Array(N * 4), sig: new Float32Array(N * 3), sbar: new Float32Array(N),
      rgb: new Float32Array(N * 3), rgb0: new Uint32Array(N), opa: new Float32Array(N), kind: new Uint8Array(N), cull: new Uint8Array(N), gain: new Float32Array(N * 3),
      thr: new Float32Array(N), drift: new Float32Array(N * 3), swirl: new Float32Array(N), phase: new Float32Array(N), tcol: new Uint8Array(N),
    };
    const raw = new Float32Array(N);
    for (let j = 0; j < N; j++) {
      const o = perm[j] * STR;
      S.pos[j * 3] = rec[o]; S.pos[j * 3 + 1] = rec[o + 1]; S.pos[j * 3 + 2] = rec[o + 2];
      for (let k = 0; k < 4; k++) S.quat[j * 4 + k] = rec[o + 3 + k];
      const sx = rec[o + 7], sy = rec[o + 8], sz = rec[o + 9];
      S.sig[j * 3] = sx; S.sig[j * 3 + 1] = sy; S.sig[j * 3 + 2] = sz; S.sbar[j] = Math.cbrt(sx * sy * sz) * 1.5;
      const r = clamp(rec[o + 10], 0, 1) * 255, g = clamp(rec[o + 11], 0, 1) * 255, b = clamp(rec[o + 12], 0, 1) * 255;
      S.rgb[j * 3] = r; S.rgb[j * 3 + 1] = g; S.rgb[j * 3 + 2] = b; S.rgb0[j] = (r | 0) | ((g | 0) << 8) | ((b | 0) << 16);
      S.opa[j] = rec[o + 13]; S.kind[j] = rec[o + 14] & 15; S.cull[j] = rec[o + 14] >> 4;
      S.gain[j * 3] = rec[o + 15]; S.gain[j * 3 + 1] = rec[o + 16]; S.gain[j * 3 + 2] = rec[o + 17];
      S.phase[j] = rnd() * 6.2832; S.tcol[j] = rnd() < 0.62 ? 0 : 1;
      const x = rec[o], y = rec[o + 1], z = rec[o + 2];
      // 디졸브 임계값: 위쪽부터 노이즈 경계를 따라 침식 (이후 순위 정규화로 p 에 선형 비례)
      raw[j] = 0.5 * (1 - clamp(y / 2.1, 0, 1)) + 0.36 * vnoise(x * 2.1 + 7, y * 2.1, z * 2.1 + 3) + 0.14 * rnd();
      // 흩어짐 속도장: curl 노이즈 + 바깥쪽 + 위쪽
      const c = curl(x, y, z), hl = Math.hypot(x, z) || 1, up = 0.35 + 0.6 * rnd(), mg = 0.55 + 0.9 * rnd();
      S.drift[j * 3] = c[0] * 0.32 * mg + (x / hl) * 0.33 * mg; S.drift[j * 3 + 1] = c[1] * 0.36 * mg + up; S.drift[j * 3 + 2] = c[2] * 0.32 * mg + (z / hl) * 0.33 * mg;
      S.swirl[j] = (rnd() - 0.4) * 1.6;
    }
    const idx = Array.from({ length: N }, (_, i) => i).sort((a, b) => raw[a] - raw[b]);
    for (let r = 0; r < N; r++) S.thr[idx[r]] = (r + 0.5) / N;
    return S;
  }
  const S = buildScene();
  const N = S.N;
  const { pos, quat, sig, sbar, rgb, rgb0, opa, kind, cull, gain, thr, drift, swirl, phase, tcol } = S;

  /* ============================== 상태 · 버퍼 ============================== */
  const BAND = 0.42;                       // 디졸브 전이 폭 (스플랫별 q = clamp((p(1+BAND) − thr)/BAND, 0, 1))
  const CUT = 2.0, CUT2 = CUT * CUT, EDGE = Math.exp(-0.5 * CUT2); // 가우시안 컷오프 반경(σ 단위)
  const LP = 0.3;                           // EWA 저역통과: 화면 공분산에 더하는 0.3 px²
  const FOV = 30 * Math.PI / 180, MAXPIX = 300000;
  const camX = new Float32Array(N), camY = new Float32Array(N), camZ = new Float32Array(N), qv = new Float32Array(N);
  const keys = new Uint16Array(N), tmpIdx = new Uint32Array(N), order = new Uint32Array(N);
  const cLo = new Uint32Array(256), cHi = new Uint32Array(256);
  const inst = new ArrayBuffer(N * 28), f32 = new Float32Array(inst), u32 = new Uint32Array(inst), u8 = new Uint8Array(inst);

  const areaK = [0, 0, 0, 0];
  const cam = { yaw: 0.45, pitch: 0.2, dist: 6.0, tx: 0.05, ty: 1.0, tz: 0, C: [0, 0, 0], r: [1, 0, 0], u: [0, 1, 0], f: [0, 0, -1], W: 2, H: 2, fpx: 1, cx: 1, cy: 1 };
  let p = 1, pPrev = 1, lod = QS.get('s200lod') ? +QS.get('s200lod') : 1, renderScale = QS.get('s200scale') ? +QS.get('s200scale') : 0.46, activeN = N, lodGrow = 1;
  let sorted = false, sortF = [0, 0, 0], sortP = 0, sortD = 0, sinceSort = 0;
  const stats = { N, sorts: 0, frames: 0, count: 0, cost: 0, gap: 0, path: '', lod: 1, scale: 0.5, p: 1 };
  root.__s200 = stats;

  // 카메라 행렬: 궤도 위치 C, 전방 f, 우측 r, 상방 u  (뷰 회전 W 의 행 = r,u,f)
  function updateCamera() {
    const cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch), cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const dx = cp * syw, dy = sp, dz = cp * cyw;
    cam.C[0] = cam.tx + cam.dist * dx; cam.C[1] = cam.ty + cam.dist * dy; cam.C[2] = cam.tz + cam.dist * dz;
    cam.f[0] = -dx; cam.f[1] = -dy; cam.f[2] = -dz;
    const rl = Math.hypot(-cam.f[2], cam.f[0]) || 1;
    cam.r[0] = -cam.f[2] / rl; cam.r[1] = 0; cam.r[2] = cam.f[0] / rl;
    cam.u[0] = cam.r[1] * cam.f[2] - cam.r[2] * cam.f[1]; cam.u[1] = cam.r[2] * cam.f[0] - cam.r[0] * cam.f[2]; cam.u[2] = cam.r[0] * cam.f[1] - cam.r[1] * cam.f[0];
  }

  /* ---- 패스 1: 디졸브 변위 → 카메라 공간 좌표 ---- */
  function particles(n, t) {
    const Cx = cam.C[0], Cy = cam.C[1], Cz = cam.C[2];
    const r0 = cam.r[0], r1 = cam.r[1], r2 = cam.r[2], u0 = cam.u[0], u1 = cam.u[1], u2 = cam.u[2], f0 = cam.f[0], f1 = cam.f[1], f2 = cam.f[2];
    const pp = p * (1 + BAND);
    for (let i = 0; i < n; i++) {
      const i3 = i * 3;
      let x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2], q = 0;
      const u = pp - thr[i];
      if (u > 0) q = u >= BAND ? 1 : u / BAND;
      if (kind[i] === K_MOTE) { const ph = phase[i]; x += Math.sin(t * 0.31 + ph) * 0.09; y += Math.sin(t * 0.23 + ph * 1.7) * 0.12; z += Math.cos(t * 0.27 + ph * 1.3) * 0.09; }
      if (q > 0) {
        const e = q * q * (3 - 2 * q), g = gain[i3], k = e * g;
        let X = x + drift[i3] * k, Z = z + drift[i3 + 2] * k;
        const sw = swirl[i] * k;                                   // 수직축 둘레 소용돌이
        if (sw !== 0) { const c = Math.cos(sw), s = Math.sin(sw); const nx = X * c - Z * s; Z = X * s + Z * c; X = nx; }
        const hv = 0.07 * q * g, ph = phase[i];                    // 구름이 된 뒤의 부유
        x = X + Math.sin(t * 0.9 + ph) * hv; y = y + drift[i3 + 1] * k + Math.sin(t * 0.7 + ph * 1.7) * hv; z = Z + Math.cos(t * 0.8 + ph * 1.3) * hv;
      }
      qv[i] = q;
      const rx = x - Cx, ry = y - Cy, rz = z - Cz;
      camX[i] = rx * r0 + ry * r1 + rz * r2; camY[i] = rx * u0 + ry * u1 + rz * u2; camZ[i] = rx * f0 + ry * f1 + rz * f2;
    }
  }

  /* ---- 패스 2: 깊이 정렬 (16비트 양자화 키 위 LSD 기수정렬 8+8, 먼 것 → 가까운 것) ---- */
  // 재정렬 조건(needResort): ① 마지막 정렬 시점 대비 시선 방향 각도 > SORT_ANGLE ② 디졸브 위상 변화 > SORT_DP
  // ③ 거리 변화 ④ 위상이 움직이는 동안 SORT_EVERY 프레임마다 ⑤ LOD(개수) 변경. 그 외에는 이전 순서를 재사용한다.
  const SORT_COS = Math.cos(0.035), SORT_DP = 0.02, SORT_EVERY = 6, SORT_HEARTBEAT = 60;
  function needResort() {
    if (!sorted) return true;
    const c = cam.f[0] * sortF[0] + cam.f[1] * sortF[1] + cam.f[2] * sortF[2];
    if (c < SORT_COS) return true;
    if (Math.abs(p - sortP) > SORT_DP) return true;
    if (Math.abs(cam.dist - sortD) > 0.2) return true;
    if (Math.abs(p - pPrev) > 1e-4 && sinceSort >= SORT_EVERY) return true;
    return sinceSort >= SORT_HEARTBEAT;
  }
  function sortDepth(n) {
    let zmin = 1e9, zmax = -1e9;
    for (let i = 0; i < n; i++) { const z = camZ[i]; if (z < zmin) zmin = z; if (z > zmax) zmax = z; }
    const sc = 65535 / Math.max(1e-5, zmax - zmin);
    cLo.fill(0); cHi.fill(0);
    for (let i = 0; i < n; i++) { const k = 65535 - (((camZ[i] - zmin) * sc) | 0); keys[i] = k; cLo[k & 255]++; cHi[k >> 8]++; }
    let a = 0, b = 0;
    for (let d = 0; d < 256; d++) { const x = cLo[d]; cLo[d] = a; a += x; const y = cHi[d]; cHi[d] = b; b += y; }
    for (let i = 0; i < n; i++) tmpIdx[cLo[keys[i] & 255]++] = i;
    for (let j = 0; j < n; j++) { const i = tmpIdx[j]; order[cHi[keys[i] >> 8]++] = i; }
    sorted = true; sortF[0] = cam.f[0]; sortF[1] = cam.f[1]; sortF[2] = cam.f[2]; sortP = p; sortD = cam.dist; sinceSort = 0; stats.sorts++;
  }

  /* ---- 패스 3: 3D 공분산 → 화면 2×2 공분산 → 타원 인스턴스 ---- */
  function project(n) {
    const W = cam.W, H = cam.H, F = cam.fpx, cx0 = cam.cx, cy0 = cam.cy;
    const w00 = cam.r[0], w01 = cam.r[1], w02 = cam.r[2], w10 = cam.u[0], w11 = cam.u[1], w12 = cam.u[2], w20 = cam.f[0], w21 = cam.f[1], w22 = cam.f[2];
    const limX = 1.3 * Math.max(cx0, W - cx0) / F, limY = 1.3 * Math.max(cy0, H - cy0) / F, SMAX = 0.07 * Math.max(W, H);
    const grow = lodGrow;
    let o = 0, count = 0, area = 0;
    for (let k = 0; k < n; k++) {
      const i = order[k], zc = camZ[i];
      if (zc < 0.5) continue;
      const q = qv[i], g3 = i * 3;
      let alpha = opa[i], s0 = sig[g3], s1 = sig[g3 + 1], s2 = sig[g3 + 2];
      if (q > 0) { // 디졸브: 축소 + 등방화(먼지) + 투명화
        const og = gain[g3 + 1], m = 0.9 * q * og, ks = 1 - 0.4 * q * og, sb = sbar[i];
        s0 = ks * (s0 + (sb - s0) * m); s1 = ks * (s1 + (sb - s1) * m); s2 = ks * (s2 + (sb - s2) * m);
        alpha *= 1 - gain[g3 + 2] * q;
      }
      s0 *= grow; s1 *= grow; s2 *= grow;
      // 쿼터니언 → 회전행렬 R (열 = 스플랫 로컬 축의 월드 방향)
      const i4 = i * 4, qx = quat[i4], qy = quat[i4 + 1], qz = quat[i4 + 2], qw = quat[i4 + 3];
      const xx = qx * qx, yy = qy * qy, zz = qz * qz, xy = qx * qy, xz = qx * qz, yz = qy * qz, wx = qw * qx, wy = qw * qy, wz = qw * qz;
      const a00 = 1 - 2 * (yy + zz), a10 = 2 * (xy + wz), a20 = 2 * (xz - wy);
      const a01 = 2 * (xy - wz), a11 = 1 - 2 * (xx + zz), a21 = 2 * (yz + wx);
      const a02 = 2 * (xz + wy), a12 = 2 * (yz - wx), a22 = 1 - 2 * (xx + yy);
      // 뒷면 컬링: 표면에 붙어 있는(q=0) 원반이 카메라 반대쪽을 보면 불투명한 앞면에 가려지므로 건너뛴다 (오버드로우 ≈ 절반)
      if (q === 0 && cull[i] === 1) {
        const dn = (w00 * a02 + w01 * a12 + w02 * a22) * camX[i] + (w10 * a02 + w11 * a12 + w12 * a22) * camY[i] + (w20 * a02 + w21 * a12 + w22 * a22) * zc;
        if (dn < -0.12 * zc) continue;
      }
      // M = W·R·S  (Σ_cam = M·Mᵀ = W R S Sᵀ Rᵀ Wᵀ)
      const m00 = (w00 * a00 + w01 * a10 + w02 * a20) * s0, m01 = (w00 * a01 + w01 * a11 + w02 * a21) * s1, m02 = (w00 * a02 + w01 * a12 + w02 * a22) * s2;
      const m10 = (w10 * a00 + w11 * a10 + w12 * a20) * s0, m11 = (w10 * a01 + w11 * a11 + w12 * a21) * s1, m12 = (w10 * a02 + w11 * a12 + w12 * a22) * s2;
      const m20 = (w20 * a00 + w21 * a10 + w22 * a20) * s0, m21 = (w20 * a01 + w21 * a11 + w22 * a21) * s1, m22 = (w20 * a02 + w21 * a12 + w22 * a22) * s2;
      // 원근 야코비안 J (2×3): px = cx + F·x/z, py = cy − F·y/z, 시야 밖 접선은 1.3배로 클램프
      const iz = 1 / zc, xc = camX[i], yc = camY[i];
      const tx = clamp(xc * iz, -limX, limX), ty = clamp(yc * iz, -limY, limY);
      const j00 = F * iz, j02 = -F * tx * iz, j11 = -F * iz, j12 = F * ty * iz;
      const t00 = j00 * m00 + j02 * m20, t01 = j00 * m01 + j02 * m21, t02 = j00 * m02 + j02 * m22;
      const t10 = j11 * m10 + j12 * m20, t11 = j11 * m11 + j12 * m21, t12 = j11 * m12 + j12 * m22;
      // Σ' = T·Tᵀ
      let a = t00 * t00 + t01 * t01 + t02 * t02, b = t00 * t10 + t01 * t11 + t02 * t12, c = t10 * t10 + t11 * t11 + t12 * t12;
      const det0 = a * c - b * b;
      a += LP; c += LP;
      const det1 = a * c - b * b;
      alpha *= det0 > 0 ? Math.sqrt(det0 / det1) : 0; // 저역통과로 늘어난 면적만큼 불투명도 보정
      if (alpha < 0.014) continue;
      // 2×2 고유분해: λ = mid ± √(((a−c)/2)² + b²), 주축 v1 = (b, λ1 − a)
      const mid = 0.5 * (a + c), dd = 0.5 * (a - c), rad = Math.sqrt(dd * dd + b * b);
      const l1 = mid + rad, l2 = Math.max(mid - rad, 0.05);
      let vx = b, vy = l1 - a;
      if (Math.abs(vx) + Math.abs(vy) < 1e-6) { vx = 1; vy = 0; }
      const il = 1 / Math.sqrt(vx * vx + vy * vy); vx *= il; vy *= il;
      const sg1 = Math.min(Math.sqrt(l1), SMAX), sg2 = Math.min(Math.sqrt(l2), sg1);
      const px = cx0 + F * xc * iz, py = cy0 - F * yc * iz, ext = CUT * sg1;
      if (px + ext < 0 || px - ext > W || py + ext < 0 || py - ext > H) continue;
      // 색: 디졸브 전선은 청화 코발트/가마 불티 색으로 물든다
      let col = rgb0[i];
      if (q > 0.004 && gain[g3 + 1] > 0.5) {
        const tint = clamp(0.75 * 4 * q * (1 - q) + 0.4 * q, 0, 0.92), r0 = rgb[g3], gg = rgb[g3 + 1], bb = rgb[g3 + 2];
        const tr = tcol[i] === 0 ? 70 : 255, tg = tcol[i] === 0 ? 110 : 190, tb = tcol[i] === 0 ? 215 : 90;
        col = ((r0 + (tr - r0) * tint) | 0) | (((gg + (tg - gg) * tint) | 0) << 8) | (((bb + (tb - bb) * tint) | 0) << 16);
      }
      f32[o] = px; f32[o + 1] = py; f32[o + 2] = vx * sg1; f32[o + 3] = vy * sg1; f32[o + 4] = -vy * sg2; f32[o + 5] = vx * sg2;
      u32[o + 6] = (col | (Math.min(255, (alpha * 255 + 0.5) | 0) << 24)) >>> 0;
      o += 7; count++; area += sg1 * sg2; areaK[kind[i]] += sg1 * sg2;
    }
    stats.area = Math.round(area * 4 * CUT2); // 쿼드 픽셀 면적 합 = 오버드로우 지표
    for (let q = 0; q < 4; q++) { stats['ak' + q] = Math.round(areaK[q] * 4 * CUT2); areaK[q] = 0; }
    return count;
  }

  /* ============================== 렌더러 ============================== */
  const VS = 'attribute vec2 aCorner;attribute vec2 aCenter;attribute vec4 aAxes;attribute vec4 aColor;uniform vec2 uRes;uniform float uCut;varying vec2 vPos;varying vec4 vCol;' +
    'void main(){vec2 v=aCorner*uCut;vec2 px=aCenter+v.x*aAxes.xy+v.y*aAxes.zw;gl_Position=vec4(px.x/uRes.x*2.0-1.0,1.0-px.y/uRes.y*2.0,0.0,1.0);vPos=v;vCol=aColor;}';
  const FS = 'precision mediump float;varying vec2 vPos;varying vec4 vCol;uniform float uCut2;uniform float uE;' +
    'void main(){float d2=dot(vPos,vPos);if(d2>uCut2)discard;float g=(exp(-0.5*d2)-uE)/(1.0-uE);float a=vCol.a*g;gl_FragColor=vec4(vCol.rgb*a,a);}';

  let canvas = null, R = null, cw = 2, ch = 2, usedGL = false;

  function makeGL(cv) {
    const opt = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    let gl = null, v2 = false;
    try { gl = cv.getContext('webgl2', opt); v2 = !!gl; if (!gl) gl = cv.getContext('webgl', opt) || cv.getContext('experimental-webgl', opt); } catch (e) { gl = null; }
    if (!gl) return null;
    let ext = null;
    if (!v2) { ext = gl.getExtension('ANGLE_instanced_arrays'); if (!ext) return null; }
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return null;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aCorner'); gl.bindAttribLocation(prog, 1, 'aCenter'); gl.bindAttribLocation(prog, 2, 'aAxes'); gl.bindAttribLocation(prog, 3, 'aColor');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    const uRes = gl.getUniformLocation(prog, 'uRes');
    gl.uniform1f(gl.getUniformLocation(prog, 'uCut'), CUT); gl.uniform1f(gl.getUniformLocation(prog, 'uCut2'), CUT2); gl.uniform1f(gl.getUniformLocation(prog, 'uE'), EDGE);
    const cbuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, cbuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const ibuf = gl.createBuffer();
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.ONE, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // 프리멀티플라이드 over
    gl.clearColor(0, 0, 0, 0);
    const div = (loc, d) => (v2 ? gl.vertexAttribDivisor(loc, d) : ext.vertexAttribDivisorANGLE(loc, d));
    return {
      lost: false,
      resize() { gl.viewport(0, 0, cw, ch); gl.uniform2f(uRes, cw, ch); },
      draw(count) {
        gl.viewport(0, 0, cw, ch); gl.clear(gl.COLOR_BUFFER_BIT);
        if (count <= 0) return;
        gl.bindBuffer(gl.ARRAY_BUFFER, cbuf); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); div(0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); gl.bufferData(gl.ARRAY_BUFFER, u8.subarray(0, count * 28), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 28, 0); div(1, 1);
        gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 28, 8); div(2, 1);
        gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 4, gl.UNSIGNED_BYTE, true, 28, 24); div(3, 1);
        if (v2) gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count); else ext.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP, 0, 4, count);
      },
      dispose() { try { gl.deleteBuffer(cbuf); gl.deleteBuffer(ibuf); gl.deleteProgram(prog); const l = gl.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); } catch (e) { /* noop */ } },
    };
  }

  function make2D(cv) { // 폴백: 컬러별 가우시안 스프라이트 + setTransform 타원 드로우
    let g = null; try { g = cv.getContext('2d'); } catch (e) { g = null; }
    if (!g) return null;
    const SP = 24, sprites = new Array(4096);
    function sprite(c) {
      const r = c & 255, gg = (c >>> 8) & 255, b = (c >>> 16) & 255, key = ((r >> 4) << 8) | ((gg >> 4) << 4) | (b >> 4);
      let s = sprites[key]; if (s) return s;
      s = document.createElement('canvas'); s.width = s.height = SP;
      const x = s.getContext('2d'), im = x.createImageData(SP, SP), d = im.data;
      for (let yy = 0; yy < SP; yy++) for (let xx = 0; xx < SP; xx++) {
        const nx = ((xx + 0.5) / SP * 2 - 1) * CUT, ny = ((yy + 0.5) / SP * 2 - 1) * CUT, d2 = nx * nx + ny * ny, o = (yy * SP + xx) * 4;
        d[o] = (key >> 8) * 17; d[o + 1] = ((key >> 4) & 15) * 17; d[o + 2] = (key & 15) * 17; d[o + 3] = d2 > CUT2 ? 0 : ((Math.exp(-0.5 * d2) - EDGE) / (1 - EDGE)) * 255;
      }
      x.putImageData(im, 0, 0); sprites[key] = s; return s;
    }
    return {
      resize() { /* 캔버스 크기 변경으로 충분 */ },
      draw(count) {
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
        for (let k = 0; k < count; k++) {
          const o = k * 7, c = u32[o + 6];
          g.setTransform(f32[o + 2], f32[o + 3], f32[o + 4], f32[o + 5], f32[o], f32[o + 1]);
          g.globalAlpha = (c >>> 24) / 255;
          g.drawImage(sprite(c), -CUT, -CUT, 2 * CUT, 2 * CUT);
        }
        g.globalAlpha = 1;
      },
      dispose() { /* noop */ },
    };
  }

  function mount(useGL) {
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    if (R) R.dispose();
    canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    view.appendChild(canvas);
    resize();
    R = useGL ? makeGL(canvas) : null;
    usedGL = !!R;
    if (!R) {
      if (useGL) { canvas.parentNode.removeChild(canvas); canvas = document.createElement('canvas'); canvas.setAttribute('aria-hidden', 'true'); view.appendChild(canvas); resize(); }
      R = make2D(canvas);
    }
    if (R) {
      stage.classList.remove('is-poster');
      if (!usedGL) { lod = Math.min(lod, 0.42); renderScale = Math.min(renderScale, 0.4); applyLod(); resize(); }
      if (usedGL) canvas.addEventListener('webglcontextlost', onLost, false);
      R.resize();
    } else { stage.classList.add('is-poster'); }
    stats.path = usedGL ? 'webgl' : R ? 'canvas2d' : 'poster';
    sorted = false;
  }
  function onLost(e) { e.preventDefault(); canvas.removeEventListener('webglcontextlost', onLost, false); mount(false); }

  function applyLod() { activeN = Math.max(500, Math.floor(N * lod)); lodGrow = lod < 1 ? 1 / Math.sqrt(lod) : 1; sorted = false; stats.lod = lod; }
  function resize() {
    const w = stage.clientWidth || 1, h = stage.clientHeight || 1;
    const s = Math.min(renderScale, Math.sqrt(MAXPIX / (w * h)));
    cw = Math.max(2, Math.round(w * s)); ch = Math.max(2, Math.round(h * s));
    if (canvas) { canvas.width = cw; canvas.height = ch; }
    cam.W = cw; cam.H = ch; cam.fpx = 0.5 * ch / Math.tan(FOV / 2);
    const asp = w / h, portrait = asp < 0.9;
    cam.cx = cw * (0.5 + (portrait ? 0 : 0.16)); cam.cy = ch * (0.5 + (portrait ? 0.14 : 0.02));
    baseDist = portrait ? Math.max(6.0, 1.45 / (Math.tan(FOV / 2) * asp)) : 6.0;
    stats.scale = renderScale;
    if (R) R.resize();
  }
  let baseDist = 6.0;

  /* ============================== 입력 · 컨트롤러 ============================== */
  const off = [];
  const on = (t, ev, fn, o) => { t.addEventListener(ev, fn, o); off.push(() => t.removeEventListener(ev, fn, o)); };
  let dragging = false, moved = false, pressing = false, downX = 0, downY = 0, downT = 0, lastX = 0, lastY = 0, lastMoveT = 0, hovering = false;
  let dragYaw = 0, dragPitch = 0, velYaw = 0, hoverYaw = 0, hoverPitch = 0, autoGain = 1, autoPhase = 0.0;
  let lastScroll = -1e9, scrollS = 0, prevS = 0, mode = 'loop', loopT = 8.6;

  on(stage, 'pointerdown', e => {
    if (e.target.closest && e.target.closest('a,button')) return;
    dragging = true; moved = false; pressing = false; downX = lastX = e.clientX; downY = lastY = e.clientY; downT = lastMoveT = performance.now(); velYaw = 0;
    try { stage.setPointerCapture(e.pointerId); } catch (er) { /* noop */ }
    stage.classList.add('is-drag');
  });
  on(stage, 'pointermove', e => {
    if (!dragging) return;
    const now = performance.now(), dx = e.clientX - lastX, dy = e.clientY - lastY, dt = Math.max(0.008, (now - lastMoveT) / 1000);
    if (!moved && Math.hypot(e.clientX - downX, e.clientY - downY) > 6) { moved = true; pressing = false; }
    if (moved) { dragYaw -= dx * 0.0062; dragPitch += dy * 0.0042; velYaw = lerp(velYaw, -dx * 0.0062 / dt, 0.5); }
    lastX = e.clientX; lastY = e.clientY; lastMoveT = now;
  });
  const endDrag = () => { dragging = false; pressing = false; stage.classList.remove('is-drag'); };
  on(stage, 'pointerup', endDrag); on(stage, 'pointercancel', endDrag); on(stage, 'lostpointercapture', endDrag);
  on(stage, 'pointerenter', () => { hovering = true; }); on(stage, 'pointerleave', () => { hovering = false; });

  const prox = { s: 0 };
  const tween = gsap.to(prox, { s: 1, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  const scrollToP = s => sstep(0.08, 0.92, s);

  const LOOP_LEN = 11.2; // 형태 유지 3.6s → 디졸브 2.6s → 구름 1.6s → 재결합 3.4s
  function loopP(t) {
    t = ((t % LOOP_LEN) + LOOP_LEN) % LOOP_LEN;
    if (t < 3.6) return 0; t -= 3.6;
    if (t < 2.6) return easeIO(t / 2.6); t -= 2.6;
    if (t < 1.6) return 1; t -= 1.6;
    return 1 - easeIO(t / 3.4);
  }

  function control(dt, nowMs, t) {
    // ---- 위상 p : 누르기 > 스크롤 > 자동 루프 (사용자가 만지면 넘겨받고, 2.8초 뒤 루프로 복귀)
    if (Math.abs(prox.s - prevS) > 0.0006) { lastScroll = nowMs; prevS = prox.s; }
    scrollS = prox.s;
    if (dragging && !moved && nowMs - downT > 380) pressing = true;
    let target, m;
    if (stats.dbgP != null) { target = stats.dbgP; m = 'dbg'; }
    else if (pressing) { target = 1; m = 'press'; }
    else if (nowMs - lastScroll < 2800) { target = scrollToP(scrollS); m = 'scroll'; }
    else {
      if (mode !== 'loop') loopT = p < 0.5 ? 0 : 6.9; // 사용자 조작에서 루프로 매끄럽게 복귀
      loopT += dt; target = ctx.reduced ? 0 : loopP(loopT); m = 'loop';
    }
    mode = m;
    pPrev = p; p += (target - p) * (1 - Math.exp(-dt * (m === 'loop' ? 22 : 7)));
    if (Math.abs(target - p) < 1e-4) p = target;
    stats.p = p; stats.mode = m; stats.yaw = cam.yaw;
    // ---- 카메라: 자동 스윕 + 호버 시차 + 드래그 관성 (+ 스크롤 돌리)
    autoGain += ((dragging ? 0 : 1) - autoGain) * (1 - Math.exp(-dt * 1.6));
    autoPhase += dt * (ctx.reduced ? 0.04 : 0.2) * autoGain;
    if (!dragging) { dragYaw += velYaw * dt; velYaw *= Math.exp(-dt * 2.4); }
    const hx = hovering && ctx.fine ? ctx.mouse.nx - 0.5 : 0, hy = hovering && ctx.fine ? ctx.mouse.ny - 0.5 : 0, hk = 1 - Math.exp(-dt * 3);
    hoverYaw += (-hx * 0.5 - hoverYaw) * hk; hoverPitch += (hy * 0.2 - hoverPitch) * hk;
    dragPitch = clamp(dragPitch, -0.35, 0.45);
    cam.yaw = 0.45 + 1.0 * Math.sin(autoPhase) + hoverYaw + dragYaw;
    cam.pitch = clamp(0.2 + hoverPitch + dragPitch + 0.014 * Math.sin(t * 0.35), 0.03, 0.62);
    cam.dist = baseDist - 0.55 * easeIO(clamp(scrollS * 1.6, 0, 1)) - 0.2 * p;
  }

  /* ============================== 메인 루프 ============================== */
  let visible = true, tPrev = performance.now(), tLastRender = 0, tStart = tPrev, frames = 0, costEMA = 0, gapEMA = 50, lastDegrade = 0;
  const FRAME_MS = ctx.reduced ? 80 : 48; // ~20fps 캡
  const LADDER = [[1, 0.46], [0.8, 0.44], [0.65, 0.41], [0.5, 0.38]]; let ladder = 0;

  function frame() {
    if (!visible || document.hidden || !R) return;
    const now = performance.now();
    if (now - tLastRender < FRAME_MS) return;
    const gap = now - tLastRender; tLastRender = now;
    const dt = Math.min(0.6, (now - tPrev) / 1000); tPrev = now;
    const t = (now - tStart) / 1000;
    control(dt, now, t);
    updateCamera();
    const t0 = performance.now();
    particles(activeN, t);
    sinceSort++;
    if (needResort()) sortDepth(activeN);
    const count = project(activeN);
    R.draw(count);
    const cost = performance.now() - t0;
    stats.frames++; stats.count = count; frames++;
    costEMA = frames === 1 ? cost : costEMA * 0.85 + cost * 0.15; gapEMA = gapEMA * 0.88 + Math.min(gap, 400) * 0.12;
    stats.cost = +costEMA.toFixed(1); stats.gap = +gapEMA.toFixed(1);
    // 적응형 품질: 메인스레드 비용(>34ms) 또는 프레임 간격(>170ms ≈ 6fps, 소프트웨어 GL 채움률 병목)이 예산을 넘으면
    // [LOD, 렌더 스케일] 사다리를 한 칸씩 내려간다 (단방향 — 화면이 출렁이지 않게)
    if (!QS.get('s200lod') && frames > 20 && now - lastDegrade > 2500 && ladder < LADDER.length - 1 && (costEMA > 34 || gapEMA > 170)) {
      lastDegrade = now; ladder++;
      lod = Math.min(lod, LADDER[ladder][0]); renderScale = Math.min(renderScale, LADDER[ladder][1]); applyLod(); resize();
    }
  }
  const stopTick = ctx.tick(frame);

  const io = new IntersectionObserver(es => { for (const e of es) { visible = e.isIntersecting; if (visible) { tPrev = performance.now(); } } }, { threshold: 0 });
  io.observe(stage);
  on(document, 'visibilitychange', () => { tPrev = performance.now(); });
  const ro = new ResizeObserver(() => { resize(); });
  ro.observe(stage);

  /* ---- 시작: 구름 상태(p=1)에서 모여드는 장면(loopT=8.6 = 재결합 구간)으로 열린다 ---- */
  updateCamera();
  applyLod();
  mount(FORCE !== '2d');

  return function cleanup() {
    stopTick(); io.disconnect(); ro.disconnect(); off.forEach(f => f());
    if (tween.scrollTrigger) tween.scrollTrigger.kill();
    tween.kill();
    if (canvas) canvas.removeEventListener('webglcontextlost', onLost, false);
    if (R) R.dispose();
    R = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}
