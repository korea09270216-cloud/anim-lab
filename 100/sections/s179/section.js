// s179 — 페이지 컬 물리. 원통(나선) 말림 프로파일 + Z버퍼 소프트 래스터라이저(Canvas2D ImageData)
// 평면 점 → 말림축 a 에 사영(d) → d0 이후 호장 u 를 곡률 적분으로 감는다. x'=d0+X(u), z=Z(u), 접선각 φ(u)
export default function (root, ctx) {
  const cv = root.querySelector('.s179__cv');
  const idxEls = [...root.querySelectorAll('.s179__idx li')];
  let g2 = null;
  try { g2 = cv.getContext('2d', { alpha: false }); } catch (e) { g2 = null; }
  if (!g2) { root.classList.add('is-fallback'); return () => {}; }

  const FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const TAU = Math.PI * 2, PI = Math.PI;
  const NC = 40, NR = 30, NP = 4, CS = 4;
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const s01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const easeIO = p => { p = clamp(p, 0, 1); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > PI) d -= TAU; if (d < -PI) d += TAU; return d; };

  // ───────── 상태 ─────────
  let W = 0, H = 0, px0 = 0, py0 = 0, pw = 0, ph = 0, unit = 1;
  let fbImg = null, fb32 = null, zbuf = null, backdrop32 = null;
  let pageCv = [], pageTex = [], backTex = null;
  let TW = 1, TH = 1;
  let pi = 0;                          // 현재 맨 위 페이지
  let sh = null, shB = null, SW = 0, SH = 0;   // 그림자 맵(저해상)
  let onScreen = true, docVis = !document.hidden, alive = true;

  let mode = 'idle';                   // idle | auto | drag | spring
  let s = 0, sv = 0, sT = 0;           // 당김 거리(그랩점 이동량), 속도, 스프링 목표
  let alphaS = 0, speedF = 0;
  let grabEdge = true, gX = 0, gY = 0; // 그랩: 먼 가장자리(auto) 또는 사용자가 잡은 점
  let T = 0, idleSince = 0;
  let finishing = false, fadeT = 0, fade = 0;
  let lastL = 0, lastExt = 1, lastD0 = 0, lastDmin = 0, lastR = 30;
  let drag = null;

  // ───────── 페이지 텍스처(프로시저럴 매거진 면) ─────────
  const mkCv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  function paint(i, c, w, h) {
    const u = h / 322;
    const tx = (str, x, y, sz, wt, col, al, ls) => {
      c.font = wt + ' ' + (sz * u) + 'px ' + FONT; c.fillStyle = col; c.textAlign = al || 'left'; c.textBaseline = 'alphabetic';
      try { c.letterSpacing = ((ls || 0) * u) + 'px'; } catch (e) {}
      c.fillText(str, x, y);
    };
    if (i === 0) {
      c.fillStyle = '#f5ead6'; c.fillRect(0, 0, w, h);
      tx('계절식탁 결', w * .05, h * .092, 11, 800, '#2a1812', 'left', 1);
      tx('VOL.12 — 2026 WINTER', w * .95, h * .092, 8.5, 700, '#2a1812', 'right', 1.2);
      c.fillStyle = '#2a1812'; c.fillRect(w * .05, h * .118, w * .9, Math.max(1, 1.4 * u));
      tx('겨울,', w * .045, h * .42, 92, 900, '#2a1812', 'left', -4);
      tx('국물', w * .045, h * .715, 92, 900, '#e4432d', 'left', -4);
      tx('뜨끈한 한 그릇이 계절을 바꾼다.', w * .05, h * .795, 8.6, 600, '#4a352b');
      tx('서른 곳의 골목 식당에서 찾은 겨울의 맛.', w * .05, h * .84, 8.6, 600, '#4a352b');
      c.fillStyle = '#2a1812'; rr(c, w * .05, h * .88, w * .39, h * .075, h * .0375); c.fill();
      tx('특집  서른 곳의 국물 지도', w * .068, h * .9275, 8.4, 800, '#f5ead6', 'left', .4);
      const cx = w * .76, cy = h * .585, r = h * .27;
      c.strokeStyle = '#2a1812'; c.lineWidth = 1.7 * u; c.lineCap = 'round';
      for (let k = -1; k <= 1; k++) {
        const x = cx + k * r * .42; c.beginPath(); c.moveTo(x, cy - r * 1.08);
        c.bezierCurveTo(x + 9 * u, cy - r * 1.2, x - 9 * u, cy - r * 1.3, x, cy - r * 1.46); c.stroke();
      }
      c.fillStyle = '#e4432d'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
      c.strokeStyle = '#f5ead6'; c.lineWidth = 2 * u; c.beginPath(); c.arc(cx, cy, r * .9, 0, TAU); c.stroke();
      c.fillStyle = '#f2b632'; c.beginPath(); c.arc(cx, cy, r * .8, 0, TAU); c.fill();
      c.strokeStyle = '#d98f2b'; c.lineWidth = 1.8 * u;
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(cx - r * .1, cy + r * .06, r * (.2 + k * .1), PI * (.1 + k * .25), PI * (.9 + k * .25)); c.stroke(); }
      c.fillStyle = '#fff7e6'; c.beginPath(); c.ellipse(cx + r * .28, cy - r * .25, r * .24, r * .19, -.5, 0, TAU); c.fill();
      c.fillStyle = '#f08a24'; c.beginPath(); c.arc(cx + r * .3, cy - r * .26, r * .09, 0, TAU); c.fill();
      c.fillStyle = '#2f7a52';
      for (let k = 0; k < 11; k++) { const a = k * 2.399, rd = r * (.22 + .5 * ((k * .37) % 1)); c.beginPath(); c.arc(cx + Math.cos(a) * rd, cy + Math.sin(a) * rd * .9, 2.3 * u, 0, TAU); c.fill(); }
    } else if (i === 1) {
      c.fillStyle = '#1f5a46'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#f2b632';
      const sp = 14.5 * u;
      for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 14; gx++) {
        const x = w * .5 + gx * sp + (gy % 2) * sp * .5, y = h * .12 + gy * sp * .86;
        if (x > w * .975) continue;
        const t = clamp(((x - w * .5) / (w * .47)) * .55 + (1 - (y - h * .1) / (h * .8)) * .55, 0, 1);
        c.beginPath(); c.arc(x, y, (.8 + 5.2 * t) * u, 0, TAU); c.fill();
      }
      tx('INTERVIEW  01', w * .05, h * .15, 9, 800, '#f2b632', 'left', 1.6);
      tx('된장 한 숟갈이', w * .05, h * .36, 30, 900, '#f5ead6', 'left', -1.4);
      tx('한 해를', w * .05, h * .53, 30, 900, '#f5ead6', 'left', -1.4);
      tx('데웁니다.', w * .05, h * .70, 30, 900, '#f2b632', 'left', -1.4);
      tx('장독대 지기 박순자(71)가 말하는', w * .05, h * .80, 8.4, 500, '#cfe3d6');
      tx('천 일의 기다림, 그리고 손맛.', w * .05, h * .845, 8.4, 500, '#cfe3d6');
      c.fillStyle = '#f5ead6'; c.beginPath(); c.arc(w * .14, h * .935, h * .045, 0, TAU); c.fill();
      tx('p.24', w * .95, h * .955, 8.4, 700, '#cfe3d6', 'right', .6);
    } else if (i === 2) {
      c.fillStyle = '#e4432d'; c.fillRect(0, 0, w, h);
      c.save(); c.translate(w * .5, h * .5); c.rotate(-.52); c.fillStyle = 'rgba(255,240,220,.09)';
      for (let k = -14; k < 14; k++) c.fillRect(-w, k * 22 * u, w * 2, 9 * u);
      c.restore();
      tx('12', w * .965, h * .9, 232, 900, '#f5ead6', 'right', -10);
      tx('NEXT ISSUE', w * .05, h * .13, 9, 800, '#f5ead6', 'left', 1.8);
      tx('다음 호', w * .05, h * .30, 31, 900, '#f5ead6', 'left', -1.2);
      tx('예고', w * .05, h * .445, 31, 900, '#2a1812', 'left', -1.2);
      tx('여름, 면(麵)의 계절.', w * .05, h * .55, 10.5, 800, '#f5ead6');
      tx('냉면에서 소바까지, 국수가', w * .05, h * .62, 8.4, 500, '#ffd9c9');
      tx('이어 온 길을 따라갑니다.', w * .05, h * .665, 8.4, 500, '#ffd9c9');
      c.fillStyle = '#20304f'; c.beginPath(); c.arc(w * .105, h * .83, h * .095, 0, TAU); c.fill();
      tx('予告', w * .105, h * .855, 15, 900, '#f5ead6', 'center');
    } else {
      c.fillStyle = '#f2b632'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#20304f'; c.beginPath(); c.arc(0, h, h * .66, 0, TAU); c.fill();
      c.fillStyle = '#fff3d6';
      for (let gy = 0; gy < 9; gy++) for (let gx = 0; gx < 8; gx++) {
        const x = w * .56 + gx * 22 * u + (gy % 2) * 11 * u, y = h * .13 + gy * 24 * u;
        c.save(); c.translate(x, y); c.rotate(.5 + Math.sin(gx * 1.7 + gy * 2.3) * .5); c.beginPath(); c.ellipse(0, 0, 3.2 * u, 8 * u, 0, 0, TAU); c.fill(); c.restore();
      }
      tx('쌀,', w * .05, h * .3, 50, 900, '#20304f', 'left', -2);
      tx('다시 읽다', w * .05, h * .52, 50, 900, '#20304f', 'left', -2);
      tx('한 톨의 무게', w * .06, h * .74, 12, 800, '#f5ead6', 'left', .8);
      tx('쌀알 하나에 담긴 수백 번의 손길.', w * .06, h * .80, 8.4, 500, '#c9d3e8');
      tx('농부와 밥집이 함께 적은 한 해.', w * .06, h * .845, 8.4, 500, '#c9d3e8');
      tx('FEATURE  04', w * .95, h * .955, 8.4, 800, '#20304f', 'right', 1.2);
    }
  }

  function paintBack(c, w, h) {
    const u = h / 322;
    c.fillStyle = '#efe6d3'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#e4d8bf'; c.font = '700 ' + (13 * u) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (let gy = 0; gy < 11; gy++) for (let gx = 0; gx < 15; gx++) c.fillText('결', (gx + (gy % 2) * .5) * 34 * u + 12 * u, gy * 31 * u + 14 * u);
    c.strokeStyle = '#d3c4a4'; c.lineWidth = Math.max(1, 1.2 * u); c.strokeRect(11 * u, 11 * u, w - 22 * u, h - 22 * u);
    c.fillStyle = '#efe6d3'; c.fillRect(w * .5 - 62 * u, h * .5 - 38 * u, 124 * u, 76 * u);
    c.strokeRect(w * .5 - 62 * u, h * .5 - 38 * u, 124 * u, 76 * u);
    c.fillStyle = '#c9b88f'; c.font = '900 ' + (46 * u) + 'px ' + FONT; c.fillText('결', w * .5, h * .5 - 3 * u);
    c.fillStyle = '#a69874'; c.font = '700 ' + (7.2 * u) + 'px ' + FONT; c.textBaseline = 'alphabetic';
    c.fillText('계절식탁 결 · 12호 · 편집부 · 비매품', w * .5, h - 18 * u);
  }

  function getTex(canvas) {
    const d = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    return { u8: d.data, u32: new Uint32Array(d.data.buffer) };
  }

  function buildTextures() {
    pageCv = []; pageTex = [];
    for (let i = 0; i < NP; i++) {
      const c = mkCv(pw, ph); paint(i, c.getContext('2d'), pw, ph);
      pageCv.push(c); pageTex.push(getTex(c));
    }
    const b = mkCv(pw, ph); paintBack(b.getContext('2d'), pw, ph); backTex = getTex(b);
  }

  function buildBackdrop(under) {
    const c = mkCv(W, H), x = c.getContext('2d');
    const gr = x.createRadialGradient(W * .62, H * .46, H * .08, W * .55, H * .5, W * .78);
    gr.addColorStop(0, '#f6c7b2'); gr.addColorStop(1, '#e99f84');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    x.save(); x.shadowColor = 'rgba(70,28,12,.40)'; x.shadowBlur = 20 * unit; x.shadowOffsetX = 4 * unit; x.shadowOffsetY = 8 * unit;
    x.fillStyle = '#e3d4b8'; x.fillRect(px0 + 2.4 * unit, py0 + 3.4 * unit, pw, ph); x.restore();
    x.fillStyle = '#f0e4cc'; x.fillRect(px0 + 1.2 * unit, py0 + 1.7 * unit, pw, ph);
    x.drawImage(pageCv[under], px0, py0);
    backdrop32 = new Uint32Array(x.getImageData(0, 0, W, H).data.buffer);
  }

  function layout() {
    const r = root.getBoundingClientRect();
    const cw = Math.max(320, r.width), chh = Math.max(360, r.height);
    const sc = Math.min(0.6, 880 / cw);
    const nw = Math.round(cw * sc), nh = Math.round(chh * sc);
    if (nw === W && nh === H && fb32) return;
    W = nw; H = nh; cv.width = W; cv.height = H;
    const narrow = cw < 900;
    const sx0 = narrow ? W * .05 : W * .40, sx1 = narrow ? W * .95 : W * .975;
    const sy0 = narrow ? H * .36 : H * .08, sy1 = narrow ? H * .96 : H * .92;
    const aw = sx1 - sx0, ah = sy1 - sy0;
    pw = Math.floor(Math.min(aw * .86, ah * .84 * 1.42)); ph = Math.floor(pw / 1.42);
    px0 = Math.round(sx0 + (aw - pw) / 2); py0 = Math.round(sy0 + (ah - ph) / 2);
    unit = ph / 322; TW = pw; TH = ph;
    fbImg = g2.createImageData(W, H); fb32 = new Uint32Array(fbImg.data.buffer); zbuf = new Float32Array(W * H);
    SW = Math.ceil(W / CS) + 2; SH = Math.ceil(H / CS) + 2; sh = new Float32Array(SW * SH); shB = new Float32Array(SW * SH);
    buildTextures(); buildBackdrop((pi + 1) % NP);
  }

  // ───────── 말림 프로파일(호장 u 별 X,Z,φ) ─────────
  const TBL = 1100, HSTEP = 2.5;
  const tPhi = new Float32Array(TBL), tX = new Float32Array(TBL), tZ = new Float32Array(TBL), tL = new Float32Array(TBL);
  let tN = 0, PX = 0, PZ = 0, PP = 0;
  function buildProfile(R, g, umax) {
    const n = Math.min(TBL - 1, Math.ceil(umax / HSTEP) + 2), ramp = .55 * R;
    let phi = 0, X = 0, Z = 0;
    for (let i = 0; i < n; i++) {
      const u = i * HSTEP;
      tPhi[i] = phi; tX[i] = X; tZ[i] = Z; tL[i] = u - X;
      const t = s01(u / ramp);                                  // 곡률 램프: 접는 줄에서 곡률이 0 → 연속 (C²)
      const kap = g * t / (R * Math.max(.3, 1 - .024 * phi));   // 나선: 안쪽으로 갈수록 반경 감소
      const pm = phi + .5 * HSTEP * kap;
      X += HSTEP * Math.cos(pm); Z += HSTEP * Math.sin(pm); phi += HSTEP * kap;
    }
    tN = n;
  }
  function prof(u) {
    let f = u / HSTEP; if (f < 0) f = 0;
    let i = f | 0; if (i >= tN - 1) { i = tN - 2; f = tN - 1; }
    const t = f - i;
    PX = tX[i] + (tX[i + 1] - tX[i]) * t; PZ = tZ[i] + (tZ[i + 1] - tZ[i]) * t; PP = tPhi[i] + (tPhi[i + 1] - tPhi[i]) * t;
  }
  function searchTbl(arr, val) {
    let lo = 0, hi = tN - 1;
    if (val >= arr[hi]) return hi * HSTEP;
    if (val <= arr[0]) return 0;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (arr[m] < val) lo = m; else hi = m; }
    const a = arr[lo], b = arr[hi];
    return (lo + (b > a ? (val - a) / (b - a) : 0)) * HSTEP;
  }

  // ───────── 메시 ─────────
  const NV = (NC + 1) * (NR + 1);
  const vx = new Float32Array(NV), vy = new Float32Array(NV), vz = new Float32Array(NV);
  const vu = new Float32Array(NV), vv = new Float32Array(NV), vp = new Float32Array(NV);
  const colD = new Float32Array(NC + 1), colXa = new Float32Array(NC + 1), colZ = new Float32Array(NC + 1), colP = new Float32Array(NC + 1);
  let EDmin = 0, EDmax = 0, EEmin = 0, EEmax = 0;
  function extents(ax, ay) {
    const bx = -ay, by = ax;
    let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
    for (let k = 0; k < 4; k++) {
      const x = px0 + (k & 1) * pw, y = py0 + (k >> 1) * ph;
      const dd = x * ax + y * ay, ee = x * bx + y * by;
      if (dd < a) a = dd; if (dd > b) b = dd; if (ee < c) c = ee; if (ee > d) d = ee;
    }
    EDmin = a; EDmax = b; EEmin = c; EEmax = d;
  }

  // 조명 LUT (접선각 φ 인덱스)
  const lutS = new Float32Array(512), lutP = new Float32Array(512), lutB = new Uint8Array(512);
  const Ll = Math.hypot(.42, .52, .74), Lx = -.42 / Ll, Ly = -.52 / Ll, Lz = .74 / Ll;
  const Hl = Math.hypot(Lx, Ly, Lz + 1), Hx = Lx / Hl, Hy = Ly / Hl, Hz = (Lz + 1) / Hl;
  function buildLut(ax, ay) {
    for (let i = 0; i < 512; i++) {
      const ph_ = i * TAU / 512, sn = Math.sin(ph_), cs = Math.cos(ph_);
      let nx = -sn * ax, ny = -sn * ay, nz = cs;
      const back = cs < 0;
      if (back) { nx = -nx; ny = -ny; nz = -nz; }
      const diff = Math.max(0, nx * Lx + ny * Ly + nz * Lz) / Lz;
      const nh = nx * Hx + ny * Hy + nz * Hz;
      lutP[i] = nh > 0 ? Math.pow(nh, 34) * (back ? 46 : 60) : 0;
      lutS[i] = back ? .30 + .70 * Math.pow(diff, 1.25) : (.32 + .68 * Math.pow(diff, 1.25)) * (.28 + .72 * s01(cs / .42));   // 말린 안쪽 벽(앞면, 옆으로 선 면)은 어둡게
      lutB[i] = back ? 1 : 0;
    }
  }

  // curl 결과(프레임 공유)
  let curlOn = false, cax = 1, cay = 0, cbx = 0, cby = 1, cd0 = 0, cdmin = 0, cdmax = 0, cR = 30, cg = 1, cFlatCols = 0, ncol = 4;

  function buildMesh() {
    const ax = Math.cos(alphaS), ay = Math.sin(alphaS), bx = -ay, by = ax;
    cax = ax; cay = ay; cbx = bx; cby = by;
    extents(ax, ay);
    const dmin = EDmin - 1.5, dmax = EDmax + 1.5, emin = EEmin - 2, emax = EEmax + 2;
    cdmin = dmin; cdmax = dmax;
    const ext = dmax - dmin;
    lastExt = ext;
    const dg = grabEdge ? dmax - 1.5 : clamp(gX * ax + gY * ay, dmin, dmax);
    const g = .25 + .75 * s01(s / (46 * unit));
    const Rb = (24 + 22 * speedF) * unit;
    const Lest = (dmax - dg) + s + Rb;
    const R = Math.max(Rb, Lest / 16.2);
    cR = R; cg = g;
    let d0 = dmax + 50;
    if (s > .05) {
      buildProfile(R, g, ext + 3 * R + 40);
      const ug = searchTbl(tL, s);
      d0 = dg - ug;
    }
    cd0 = d0; lastD0 = d0; lastDmin = dmin; lastR = R;
    const L = dmax - d0;
    lastL = L;
    curlOn = L > 1.0 && s > .05;
    if (!curlOn) { ncol = 4; cFlatCols = 4; return; }
    buildProfile(R, g, L + 2 * R + 40);
    const nf = d0 > dmin + 1 ? 4 : 0;
    ncol = NC; cFlatCols = nf;
    const ncv = NC - nf;
    const ustart = Math.max(0, dmin - d0), uend = dmax - d0;
    prof(ustart); const phs = PP; prof(uend); const phe = PP;
    const w = s01((phe - phs) / 1.2);
    for (let j = 0; j <= NC; j++) {
      let d;
      if (j <= nf && nf > 0) d = dmin + (d0 - dmin) * j / nf;
      else {
        const jj = j - nf, t = jj / ncv;
        const uu = ustart + (uend - ustart) * t;
        let up = searchTbl(tPhi, phs + (phe - phs) * t);
        up = clamp(up, ustart, uend);
        let uj = uu + (up - uu) * w;
        if (jj === 0) uj = ustart; if (jj === ncv) uj = uend;
        d = d0 + uj;
      }
      colD[j] = d;
      if (j < nf || (nf > 0 && j === nf)) { colXa[j] = d; colZ[j] = 0; colP[j] = 0; }
      else { prof(d - d0); colXa[j] = d0 + PX; colZ[j] = PZ; colP[j] = PP; }
    }
    fillVerts(ax, ay, bx, by, emin, emax, ncol);
  }

  const DPERSP = 1.7;
  function fillVerts(ax, ay, bx, by, emin, emax, nc) {
    const ccx = px0 + pw * .5, ccy = py0 + ph * .5, D = DPERSP * H;
    for (let k = 0; k <= NR; k++) {
      const e = emin + (emax - emin) * k / NR;
      for (let j = 0; j <= nc; j++) {
        const i = k * (nc + 1) + j;
        const xa = colXa[j], z = colZ[j];
        const sx = xa * ax + e * bx, sy = xa * ay + e * by;
        const f = D / (D - z);
        vx[i] = ccx + (sx - ccx) * f; vy[i] = ccy + (sy - ccy) * f; vz[i] = z; vp[i] = colP[j];
        vu[i] = colD[j] * ax + e * bx - px0; vv[i] = colD[j] * ay + e * by - py0;
      }
    }
  }

  // ───────── 래스터라이저 ─────────
  let texF = null, texF32 = null, texK = null;
  let SR = 0, SG = 0, SB = 0;
  const EDGE = (255 << 24) | (232 << 16) | (240 << 8) | 247;
  function bil(t, x, y) {
    if (x < 0) x = 0; else if (x > TW - 1.001) x = TW - 1.001;
    if (y < 0) y = 0; else if (y > TH - 1.001) y = TH - 1.001;
    const ix = x | 0, iy = y | 0, fx = x - ix, fy = y - iy;
    const i = (iy * TW + ix) << 2, j = i + (TW << 2);
    const w11 = fx * fy, w10 = fx - w11, w01 = fy - w11, w00 = 1 - fx - fy + w11;
    SR = t[i] * w00 + t[i + 4] * w10 + t[j] * w01 + t[j + 4] * w11;
    SG = t[i + 1] * w00 + t[i + 5] * w10 + t[j + 1] * w01 + t[j + 5] * w11;
    SB = t[i + 2] * w00 + t[i + 6] * w10 + t[j + 2] * w01 + t[j + 6] * w11;
  }
  const ST = .24 / 255;

  function tri(i0, i1, i2, flat) {
    const x0 = vx[i0], y0 = vy[i0], x1 = vx[i1], y1 = vy[i1], x2 = vx[i2], y2 = vy[i2];
    const dx1 = x1 - x0, dy1 = y1 - y0, dx2 = x2 - x0, dy2 = y2 - y0;
    const det = dx1 * dy2 - dx2 * dy1;
    if (det > -.05 && det < .05) return;
    const id = 1 / det;
    const u0 = vu[i0], v0 = vv[i0], z0 = vz[i0], p0 = vp[i0];
    const du1 = vu[i1] - u0, du2 = vu[i2] - u0, dv1 = vv[i1] - v0, dv2 = vv[i2] - v0;
    const dz1 = vz[i1] - z0, dz2 = vz[i2] - z0, dp1 = vp[i1] - p0, dp2 = vp[i2] - p0;
    const gux = (du1 * dy2 - du2 * dy1) * id, guy = (du2 * dx1 - du1 * dx2) * id;
    const gvx = (dv1 * dy2 - dv2 * dy1) * id, gvy = (dv2 * dx1 - dv1 * dx2) * id;
    const gzx = (dz1 * dy2 - dz2 * dy1) * id, gzy = (dz2 * dx1 - dz1 * dx2) * id;
    const gpx = (dp1 * dy2 - dp2 * dy1) * id, gpy = (dp2 * dx1 - dp1 * dx2) * id;
    let xa = x0, ya = y0, xb = x1, yb = y1, xc = x2, yc = y2, t_;
    if (ya > yb) { t_ = xa; xa = xb; xb = t_; t_ = ya; ya = yb; yb = t_; }
    if (yb > yc) { t_ = xb; xb = xc; xc = t_; t_ = yb; yb = yc; yc = t_; }
    if (ya > yb) { t_ = xa; xa = xb; xb = t_; t_ = ya; ya = yb; yb = t_; }
    const lenAC = yc - ya; if (lenAC < 1e-6) return;
    const invAC = 1 / lenAC, invAB = yb - ya > 1e-6 ? 1 / (yb - ya) : 0, invBC = yc - yb > 1e-6 ? 1 / (yc - yb) : 0;
    const yS = Math.max(0, Math.ceil(ya - .5)), yE = Math.min(H - 1, Math.floor(yc - .5));
    for (let y = yS; y <= yE; y++) {
      const yy = y + .5;
      const xAC = xa + (xc - xa) * (yy - ya) * invAC;
      const xS = yy < yb ? xa + (xb - xa) * (yy - ya) * invAB : xb + (xc - xb) * (yy - yb) * invBC;
      const xl = xAC < xS ? xAC : xS, xr = xAC < xS ? xS : xAC;
      const xs = Math.max(0, Math.ceil(xl - .5)), xe = Math.min(W - 1, Math.floor(xr - .5));
      if (xs > xe) continue;
      const ddx = xs + .5 - x0, ddy = yy - y0;
      let u = u0 + gux * ddx + guy * ddy, v = v0 + gvx * ddx + gvy * ddy;
      let z = z0 + gzx * ddx + gzy * ddy, p = p0 + gpx * ddx + gpy * ddy;
      let idx = y * W + xs;
      if (flat) {
        for (let x = xs; x <= xe; x++, idx++, u += gux, v += gvx) {
          if (u < 0 || v < 0 || u >= TW || v >= TH) continue;
          if (zbuf[idx] >= 0) continue;
          const iu = u | 0, iv = v | 0;
          fb32[idx] = (iu === 0 || iv === 0 || iu === TW - 1 || iv === TH - 1) ? EDGE : texF32[iv * TW + iu];
          zbuf[idx] = 0;
        }
      } else {
        for (let x = xs; x <= xe; x++, idx++, u += gux, v += gvx, z += gzx, p += gpx) {
          if (u < -.5 || v < -.5 || u >= TW + .5 || v >= TH + .5) continue;
          if (z <= zbuf[idx]) continue;
          const ed = Math.min(u, TW - u, v, TH - v);                        // 페이지 경계까지 거리(안쪽 +)
          const cov = ed >= .5 ? 1 : ed + .5;                              // 경계 픽셀 커버리지(안티에일리어싱)
          if (cov <= .03) continue;
          if (cov > .5) zbuf[idx] = z;
          const li = ((p * 81.48733) | 0) & 511;
          const m = lutS[li];
          let r, g, b;
          if (lutB[li] === 0) { bil(texF, u - .5, v - .5); r = SR; g = SG; b = SB; }
          else {
            bil(texK, TW - u - .5, v - .5); const kr = SR, kg = SG, kb = SB;
            bil(texF, u - .5, v - .5);                                   // 뒷면 위로 비치는 앞면 잉크
            r = kr * (1 - .24 + SR * ST); g = kg * (1 - .24 + SG * ST); b = kb * (1 - .24 + SB * ST);
          }
          const sp = lutP[li];
          r = r * m + sp; g = g * m + sp; b = b * m + sp;
          if (ed < 1.3) { const t = (1.3 - (ed < 0 ? 0 : ed)) * .6, mm = m > 1 ? 1 : m; r += (247 * mm - r) * t; g += (240 * mm - g) * t; b += (232 * mm - b) * t; }
          if (r > 255) r = 255; if (g > 255) g = 255; if (b > 255) b = 255;
          if (cov < 1) { const o = fb32[idx], ic = 1 - cov; r = r * cov + (o & 255) * ic; g = g * cov + ((o >> 8) & 255) * ic; b = b * cov + ((o >> 16) & 255) * ic; }
          fb32[idx] = (255 << 24) | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
    }
  }

  // ───────── 접촉 그림자(높이별 반그림자 · 누적 max 테이블) ─────────
  const NBMAX = 340, NSMAX = 260;
  const shT = new Float32Array(NBMAX * NSMAX);
  function shadowPass() {
    const ax = cax, ay = cay, bx = cbx, by = cby, d0 = cd0;
    const bw = 4, hs = 6;
    const dminS = cdmin - 150, NB = Math.min(NBMAX, Math.ceil((cdmax - cdmin + 300) / bw));
    const k0 = Math.floor(Math.max(0, cdmin - d0) / hs), k1 = Math.min(NSMAX - 1 + k0, Math.floor((cdmax - d0) / hs));
    if (k1 < k0) return;
    const SHX = .33, SHY = .42, shd = SHX * ax + SHY * ay;
    const R = cR, g = cg;
    for (let k = k0; k <= k1; k++) {
      const row = (k - k0) * NB;
      if (k === k0) shT.fill(0, row, row + NB); else shT.copyWithin(row, row - NB, row);
      const u = k * hs; prof(u);
      const z = PZ, xs = d0 + PX + shd * z;
      const ramp = s01(u / (.55 * R));
      const A = (.78 * Math.exp(-z / (.9 * R + 10)) + .1) * (.5 + .5 * g * ramp);
      const sg = 4 + .42 * z, inv = 1 / sg;
      const b0 = Math.max(0, Math.floor((xs - 3 * sg - dminS) / bw)), b1 = Math.min(NB - 1, Math.ceil((xs + 3 * sg - dminS) / bw));
      for (let bI = b0; bI <= b1; bI++) {
        const q = (dminS + bI * bw - xs) * inv, w = A * Math.exp(-q * q);
        if (w > shT[row + bI]) shT[row + bI] = w;
      }
    }
    const xlo = px0 - 6, xhi = px0 + pw + 6, ylo = py0 - 6, yhi = py0 + ph + 6;
    let cx0 = SW, cx1 = -1, cy0 = SH, cy1 = -1;
    for (let cy = 0; cy < SH; cy++) {
      for (let cx = 0; cx < SW; cx++) {
        const x = (cx + .5) * CS, y = (cy + .5) * CS;
        const d = x * ax + y * ay, e = x * bx + y * by;
        let lo = -1e9, hi = 1e9, ok = true;
        const ex = e * bx, ey = e * by;
        if (Math.abs(ax) > 1e-4) { const t1 = (xlo - ex) / ax, t2 = (xhi - ex) / ax; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)); }
        else if (ex < xlo || ex > xhi) ok = false;
        if (Math.abs(ay) > 1e-4) { const t1 = (ylo - ey) / ay, t2 = (yhi - ey) / ay; lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2)); }
        else if (ey < ylo || ey > yhi) ok = false;
        let val = 0;
        if (ok && hi > lo) {
          const umax = hi - d0;
          if (umax >= k0 * hs) {
            const k = Math.min(k1, Math.floor(umax / hs));
            const fb = (d - dminS) / bw;
            if (fb >= 0 && fb < NB - 1) {
              const ib = fb | 0, fr = fb - ib, o = (k - k0) * NB + ib;
              val = shT[o] * (1 - fr) + shT[o + 1] * fr;
            }
          }
        }
        sh[cy * SW + cx] = val;
        if (val > .01) { if (cx < cx0) cx0 = cx; if (cx > cx1) cx1 = cx; if (cy < cy0) cy0 = cy; if (cy > cy1) cy1 = cy; }
      }
    }
    if (cx1 < 0) return;
    cx0 = Math.max(0, cx0 - 3); cy0 = Math.max(0, cy0 - 3); cx1 = Math.min(SW - 1, cx1 + 3); cy1 = Math.min(SH - 1, cy1 + 3);
    for (let pass = 0; pass < 2; pass++) {               // [1 2 1] 분리 블러 ×2 → 가우시안 근사(계단 제거)
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const o = cy * SW + cx;
        shB[o] = (sh[cx > cx0 ? o - 1 : o] + 2 * sh[o] + sh[cx < cx1 ? o + 1 : o]) * .25;
      }
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) {
        const o = cy * SW + cx;
        sh[o] = (shB[cy > cy0 ? o - SW : o] + 2 * shB[o] + shB[cy < cy1 ? o + SW : o]) * .25;
      }
    }
    const strength = .66 * (1 - fade);
    const xs0 = Math.max(0, (cx0 - 1) * CS), xs1 = Math.min(W - 1, (cx1 + 2) * CS);
    const ys0 = Math.max(0, (cy0 - 1) * CS), ys1 = Math.min(H - 1, (cy1 + 2) * CS);
    for (let y = ys0; y <= ys1; y++) {
      const gy = (y + .5) / CS - .5, iy = Math.max(0, gy | 0), fy = gy - iy, r0 = iy * SW, r1 = (iy + 1) * SW;
      for (let x = xs0; x <= xs1; x++) {
        const idx = y * W + x;
        if (zbuf[idx] > .8) continue;
        const gx = (x + .5) / CS - .5, ix = Math.max(0, gx | 0), fx = gx - ix;
        const a = sh[r0 + ix] * (1 - fx) + sh[r0 + ix + 1] * fx, b = sh[r1 + ix] * (1 - fx) + sh[r1 + ix + 1] * fx;
        let v = a * (1 - fy) + b * fy;
        if (v < .006) continue;
        if (zbuf[idx] === 0) v *= .42;                    // 위 시트(평평한 면) 위의 그림자는 약하게: 아래 페이지·책상에 진하게
        const k = 1 - strength * v, c = fb32[idx];
        fb32[idx] = (255 << 24) | ((((c >> 16) & 255) * (k + (1 - k) * .1)) << 16) | ((((c >> 8) & 255) * k) << 8) | ((c & 255) * k);
      }
    }
  }

  // ───────── 프레임 렌더 ─────────
  function render() {
    fb32.set(backdrop32);
    buildMesh();
    texF = pageTex[pi].u8; texF32 = pageTex[pi].u32; texK = backTex.u8;
    if (!curlOn) {
      for (let y = 0; y < ph; y++) fb32.set(texF32.subarray(y * pw, (y + 1) * pw), (py0 + y) * W + px0);
      for (let x = 0; x < pw; x++) { fb32[py0 * W + px0 + x] = EDGE; fb32[(py0 + ph - 1) * W + px0 + x] = EDGE; }
      for (let y = 0; y < ph; y++) { fb32[(py0 + y) * W + px0] = EDGE; fb32[(py0 + y) * W + px0 + pw - 1] = EDGE; }
    } else {
      zbuf.fill(-1);
      buildLut(cax, cay);
      const nc = ncol, nf = cFlatCols;
      for (let k = 0; k < NR; k++) {
        for (let j = 0; j < nc; j++) {
          const a = k * (nc + 1) + j, b = a + 1, c = a + nc + 1, d = c + 1;
          const mnU = Math.min(vu[a], vu[b], vu[c], vu[d]), mxU = Math.max(vu[a], vu[b], vu[c], vu[d]);
          if (mxU < -1 || mnU > TW + 1) continue;
          const mnV = Math.min(vv[a], vv[b], vv[c], vv[d]), mxV = Math.max(vv[a], vv[b], vv[c], vv[d]);
          if (mxV < -1 || mnV > TH + 1) continue;
          const fl = j < nf;
          tri(a, b, c, fl); tri(b, d, c, fl);
        }
      }
      if (fade > 0) {
        const f = fade, nf_ = 1 - f;
        for (let i = 0, n = W * H; i < n; i++) {
          if (zbuf[i] < -.5) continue;
          const c = fb32[i], bd = backdrop32[i];
          fb32[i] = (255 << 24) | ((((c >> 16) & 255) * nf_ + ((bd >> 16) & 255) * f) << 16) | ((((c >> 8) & 255) * nf_ + ((bd >> 8) & 255) * f) << 8) | ((c & 255) * nf_ + (bd & 255) * f);
        }
      }
      shadowPass();
    }
    g2.putImageData(fbImg, 0, 0);
  }

  // ───────── 입력/자동 시나리오/스프링 ─────────
  const acts = [
    { a: 4,    kind: 'peek', F: .60, rise: 2.0, hold: 2.7 },
    { a: 128,  kind: 'flip', F: .80, rise: 2.4, hold: 0 },
    { a: -36,  kind: 'peek', F: .52, rise: 1.9, hold: 2.5 },
    { a: -158, kind: 'flip', F: .80, rise: 2.3, hold: 0 },
    { a: 62,   kind: 'peek', F: .56, rise: 2.0, hold: 2.6 },
    { a: -92,  kind: 'flip', F: .80, rise: 2.4, hold: 0 },
  ];
  let autoPhase = 'gap', autoGap = .12, autoT = 0, autoIdx = 0;

  function pageSwap() {
    pi = (pi + 1) % NP;
    buildBackdrop((pi + 1) % NP);
    idxEls.forEach((el, i) => el.classList.toggle('is-on', i === pi));
    s = 0; sv = 0; sT = 0; mode = 'idle'; finishing = false; fade = 0; fadeT = 0; idleSince = T; speedF = 0;
    if (drag) drag.dead = true;
  }

  function autoUpdate(dt) {
    if (autoPhase === 'paused') {
      if (mode === 'idle' && !drag && T - idleSince > 2.4) { autoPhase = 'gap'; autoGap = .2; }
      return;
    }
    if (autoPhase === 'gap') {
      if (mode !== 'idle') return;
      autoGap -= dt; if (autoGap > 0) return;
      autoPhase = 'run'; autoT = 0; grabEdge = true; alphaS = acts[autoIdx % acts.length].a * PI / 180;
      return;
    }
    const A = acts[autoIdx % acts.length];
    autoT += dt;
    alphaS = (A.a + 12 * Math.sin(.95 * T) + 5 * Math.sin(2.2 * T + 1.1)) * PI / 180;     // 리사주식 연속 각도 변화
    extents(Math.cos(alphaS), Math.sin(alphaS));
    const ext = EDmax - EDmin, p = autoT / A.rise;
    const base = A.kind === 'flip' ? clamp(p, 0, 1) * clamp(p, 0, 1) : easeIO(p);
    const nS = A.F * ext * base * (1 + (p >= 1 && A.kind === 'peek' ? .06 * Math.sin(1.7 * autoT) : 0)) * (ctx.reduced ? .8 : 1);
    sv = (nS - s) / Math.max(dt, 1e-3); s = nS; mode = 'auto';
    if (autoT >= A.rise + A.hold) {
      mode = 'spring';
      sT = A.kind === 'flip' ? ext + 240 * unit : 0;
      autoPhase = 'gap'; autoGap = .15; autoIdx++;
    }
  }

  function step(dt) {
    T += dt;
    autoUpdate(dt);
    if (mode === 'drag' && drag) {
      const prev = s;
      s += (drag.sT - s) * Math.min(1, dt * 20);
      sv += ((s - prev) / Math.max(dt, 1e-3) - sv) * Math.min(1, dt * 12);
      if (drag.aT !== null) alphaS += angDiff(drag.aT, alphaS) * Math.min(1, dt * 14);
    } else if (mode === 'spring') {
      const flip = sT > 0, fast = drag && drag.pending, ks = fast ? 300 : flip ? 55 : 92, cs = fast ? 36 : flip ? 9.5 : 11.5;
      let n = Math.ceil(dt / .02); const h = dt / n;
      while (n-- > 0) {
        sv += (ks * (sT - s) - cs * sv) * h; s += sv * h;
        if (s < 0) { s = 0; sv = Math.abs(sv) * .3; }
      }
      if (drag && drag.pending && s < 3 * unit) {
        drag.pending = false; drag.x0 = drag.lx; drag.y0 = drag.ly; drag.sT = 0; drag.aT = null; drag.locked = false;
        grabEdge = false; gX = drag.x0; gY = drag.y0; s = 0; sv = 0; mode = 'drag';
      } else if (!flip && s < .5 && Math.abs(sv) < 10) { s = 0; sv = 0; mode = 'idle'; idleSince = T; }
    }
    speedF += (clamp(Math.abs(sv) / (1100 * unit), 0, 1) - speedF) * Math.min(1, dt / .18);
    if (mode === 'idle') { s = 0; sv = 0; }
    // 완주 판정: 말림 접선이 페이지 왼쪽(뒤쪽) 가장자리를 완전히 벗어남
    if (!finishing && s > 5 && lastD0 < lastDmin - 1.25 * lastR && (mode === 'spring' || mode === 'drag')) {
      finishing = true; fadeT = 0;
      if (mode === 'drag') { mode = 'spring'; sT = lastExt + 240 * unit; if (drag) drag.dead = true; }
    }
    if (finishing) {
      fadeT += dt; fade = easeIO(fadeT / .4);
      if (fadeT >= .4) pageSwap();
    }
  }

  // 포인터
  function toCv(e) { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; }
  function inPage(x, y) { const m = 22 * unit; return x > px0 - m && x < px0 + pw + m && y > py0 - m && y < py0 + ph + m; }
  function onDown(e) {
    if (e.button > 0 || finishing) return;
    const [x, y] = toCv(e);
    if (!inPage(x, y)) return;
    if (autoPhase === 'run') autoIdx++;
    autoPhase = 'paused';
    const fresh = s <= 3 * unit;
    drag = { id: e.pointerId, x0: x, y0: y, lx: x, ly: y, pending: !fresh, locked: false, sT: 0, aT: null, dead: false };
    if (fresh) { grabEdge = false; gX = x; gY = y; s = 0; sv = 0; mode = 'drag'; }
    else { mode = 'spring'; sT = 0; }            // 말려 있던 종이는 먼저 빠르게 펴지고, 그 자리에서 새 제스처가 시작된다
    try { cv.setPointerCapture(e.pointerId); } catch (_) {}
    cv.style.cursor = 'grabbing';
  }
  function onMove(e) {
    if (!drag || drag.dead || e.pointerId !== drag.id) {
      if (!drag) { const [x, y] = toCv(e); cv.style.cursor = inPage(x, y) ? 'grab' : 'default'; }
      return;
    }
    const [x, y] = toCv(e);
    if (drag.pending) { drag.lx = x; drag.ly = y; return; }
    const vx_ = x - drag.x0, vy_ = y - drag.y0, len = Math.hypot(vx_, vy_);
    if (len < 12 * unit) { drag.sT = 0; return; }
    drag.aT = Math.atan2(-vy_, -vx_);            // 말림축 ⟂ 드래그 방향: 접히는 쪽 = 드래그 반대
    if (!drag.locked) { alphaS = drag.aT; drag.locked = true; }
    drag.sT = len;
  }
  function onUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dd = drag; drag = null; cv.style.cursor = 'grab';
    try { cv.releasePointerCapture(e.pointerId); } catch (_) {}
    if (dd.dead || mode !== 'drag') { idleSince = T; return; }
    const f = clamp(lastL / Math.max(lastExt, 1), 0, 1);
    let complete = f > .5;
    if (sv > 650 * unit) complete = f > .12;
    if (sv < -650 * unit) complete = false;
    mode = 'spring'; sT = complete ? lastExt + 240 * unit : 0; idleSince = T;
    if (!complete && s < .5) { s = 0; sv = 0; mode = 'idle'; }
  }
  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', onUp);
  cv.addEventListener('pointercancel', onUp);

  // ───────── 루프/정지 ─────────
  let lastNow = 0, rsTimer = 0;
  layout();
  idxEls.forEach((el, i) => el.classList.toggle('is-on', i === pi));
  render();
  const off = ctx.tick(() => {
    if (!alive || !onScreen || !docVis) { lastNow = 0; return; }
    const now = performance.now();
    if (lastNow && now - lastNow < 46) return;
    const dt = lastNow ? Math.min(.1, (now - lastNow) / 1000) : 1 / 30;
    lastNow = now;
    step(dt);
    render();
  });
  const io = new IntersectionObserver(es => { onScreen = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { docVis = !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  const ro = new ResizeObserver(() => { clearTimeout(rsTimer); rsTimer = setTimeout(() => { if (alive) { layout(); render(); } }, 140); });
  ro.observe(root);

  return () => {
    alive = false; off && off(); io.disconnect(); ro.disconnect(); clearTimeout(rsTimer);
    document.removeEventListener('visibilitychange', onVis);
    cv.removeEventListener('pointerdown', onDown); cv.removeEventListener('pointermove', onMove);
    cv.removeEventListener('pointerup', onUp); cv.removeEventListener('pointercancel', onUp);
  };
}
