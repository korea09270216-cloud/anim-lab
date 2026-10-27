// s153 — 와류 입자 스모크 링: 정칙화 Biot–Savart 필라멘트 두 개가 서로 통과(leapfrogging)하고, 추적 입자 수천 개가 그 속도장을 따라 흐른다.
// 솔버(SOLVER 구간)는 렌더/DOM 과 분리돼 있어 노드 단독으로도 돌아간다.

/*SOLVER-START*/
var GAM = 1, DELTA = 0.2, DEL2 = DELTA * DELTA, K4 = GAM / (4 * Math.PI);
var RN0 = 48, RMINV = 28, RMAXV = 72, GCAP = 144, UMAX = 2.6;          // 링당 정점 48(28~72), 그룹당 ≤144 → 동시 2그룹 ≤288 세그먼트
var HT = 2 * Math.PI / RN0, HMAX = 1.55 * HT, HMIN = 0.5 * HT;         // 리메시 기준 변 길이
var FRAME_DT = 0.12, RSUB = 4, PSUB = 2;                                          // 프레임당 시뮬 시간, 링 서브스텝
var CORE_RHO = 0.19;                                                  // 연기 시드 반경(링 단면, R=1 기준)
var TAU = Math.PI * 2, PERT = 0.002;

function mkSegs(cap) {
  return { mx: new Float64Array(cap), my: new Float64Array(cap), mz: new Float64Array(cap),
    dx: new Float64Array(cap), dy: new Float64Array(cap), dz: new Float64Array(cap), m: 0 };
}

// 필라멘트 세그먼트 → 중점 + (Γ/4π)·dl
function buildSegs(g, S) {
  var VX = g.VX, VY = g.VY, VZ = g.VZ, nx = g.nxt, n = g.n;
  for (var j = 0; j < n; j++) {
    var k = nx[j];
    S.mx[j] = .5 * (VX[j] + VX[k]); S.my[j] = .5 * (VY[j] + VY[k]); S.mz[j] = .5 * (VZ[j] + VZ[k]);
    S.dx[j] = (VX[k] - VX[j]) * K4; S.dy[j] = (VY[k] - VY[j]) * K4; S.dz[j] = (VZ[k] - VZ[j]) * K4;
  }
  S.m = n;
}

// 정칙화(Rosenhead–Moore) Biot–Savart:  u(x)=Σ (Γ/4π) dl × r / (|r|²+δ²)^{3/2}
var _ux = 0, _uy = 0, _uz = 0;
function vel(S, x, y, z) {
  var mx = S.mx, my = S.my, mz = S.mz, dx = S.dx, dy = S.dy, dz = S.dz, m = S.m, ax = 0, ay = 0, az = 0;
  for (var j = 0; j < m; j++) {
    var rx = x - mx[j], ry = y - my[j], rz = z - mz[j];
    var s = rx * rx + ry * ry + rz * rz + DEL2, w = 1 / (s * Math.sqrt(s));
    ax += (dy[j] * rz - dz[j] * ry) * w; ay += (dz[j] * rx - dx[j] * rz) * w; az += (dx[j] * ry - dy[j] * rx) * w;
  }
  var sp = ax * ax + ay * ay + az * az;
  if (sp > UMAX * UMAX) { var q = UMAX / Math.sqrt(sp); ax *= q; ay *= q; az *= q; }
  _ux = ax; _uy = ay; _uz = az;
}

function createSim(NP, seed) {
  var sd = (seed >>> 0) || 1;
  function rnd() { sd = (sd + 0x6D2B79F5) | 0; var t = Math.imul(sd ^ (sd >>> 15), 1 | sd); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  var PX = new Float64Array(NP), PY = new Float64Array(NP), PZ = new Float64Array(NP);
  var SPD = new Float32Array(NP), VIS = new Float32Array(NP), AGE = new Float32Array(NP), MAXAGE = new Float32Array(NP);
  var SZ = new Float32Array(NP), MODE = new Uint8Array(NP), WAIT = new Int16Array(NP), FRATE = new Float32Array(NP), GI = new Int16Array(NP);
  var groups = [], gid = 0, live = null, frame = 0, NA = NP, lastC = [0, 0, 0];
  var U1 = new Float64Array(GCAP * 3), U2 = new Float64Array(GCAP * 3);
  var T = mkSegs(GCAP + 8);
  for (var q = 0; q < NP; q++) { SZ[q] = rnd(); MAXAGE[q] = 150 + rnd() * 120; GI[q] = -1; }

  function newGroup(cx, cy, cz, R, d, ty, tz) {
    var cap = GCAP + 8;
    var g = { id: ++gid, VX: new Float64Array(cap), VY: new Float64Array(cap), VZ: new Float64Array(cap), nxt: new Int32Array(cap),
      n: 2 * RN0, rs: [0, RN0], rn: [RN0, RN0], S: [mkSegs(cap), mkSegs(cap), mkSegs(cap), mkSegs(cap), mkSegs(cap)],
      c: [cx, cy, cz], rc: [[0, 0, 0], [0, 0, 0]], ra: [[1, 0, 0], [1, 0, 0]], rad: [R, R], axl: [0, 0], nP: 0, dying: false, age: 0, bad: false, wob: 0 };
    var cty = Math.cos(ty), sty = Math.sin(ty), ctz = Math.cos(tz), stz = Math.sin(tz);
    for (var r = 0; r < 2; r++) {
      var x0 = r === 0 ? d * .5 : -d * .5, ph = r * 1.7;
      for (var i = 0; i < RN0; i++) {
        var a = TAU * i / RN0, rr = R * (1 + PERT * Math.cos(4 * a + ph));   // 미세 섭동(위들 불안정 씨앗)
        var lx = x0, ly = rr * Math.cos(a), lz = rr * Math.sin(a);
        var x1 = lx * cty + lz * sty, z1 = -lx * sty + lz * cty;
        var x2 = x1 * ctz - ly * stz, y2 = x1 * stz + ly * ctz;
        var j = r * RN0 + i;
        g.VX[j] = cx + x2; g.VY[j] = cy + y2; g.VZ[j] = cz + z1;
        g.nxt[j] = r * RN0 + (i + 1) % RN0;
      }
    }
    diag(g);
    groups.push(g);
    return g;
  }

  function diag(g) {
    var tx = 0, ty = 0, tz = 0, ok = true, wob = 0;
    for (var r = 0; r < 2; r++) {
      var s0 = g.rs[r], n = g.rn[r], cx = 0, cy = 0, cz = 0, i, j;
      for (i = 0; i < n; i++) { j = s0 + i; cx += g.VX[j]; cy += g.VY[j]; cz += g.VZ[j]; }
      cx /= n; cy /= n; cz /= n;
      var ax = 0, ay = 0, az = 0, rs = 0, rmin = 1e9, rmax = 0;
      for (i = 0; i < n; i++) {
        j = s0 + i; var k = g.nxt[j];
        var ux = g.VX[j] - cx, uy = g.VY[j] - cy, uz = g.VZ[j] - cz, vx = g.VX[k] - cx, vy = g.VY[k] - cy, vz = g.VZ[k] - cz;
        ax += uy * vz - uz * vy; ay += uz * vx - ux * vz; az += ux * vy - uy * vx;
        var rr = Math.sqrt(ux * ux + uy * uy + uz * uz); rs += rr; if (rr < rmin) rmin = rr; if (rr > rmax) rmax = rr;
      }
      var al = Math.sqrt(ax * ax + ay * ay + az * az) || 1; ax /= al; ay /= al; az /= al;
      g.rc[r] = [cx, cy, cz]; g.ra[r] = [ax, ay, az]; g.rad[r] = rs / n;
      g.axl[r] = cx * g.ra[0][0] + cy * g.ra[0][1] + cz * g.ra[0][2];
      wob = Math.max(wob, (rmax - rmin) / (rs / n));
      tx += cx; ty += cy; tz += cz;
      if (!(cx === cx) || !(rs === rs) || rs / n > 4.5 || rs / n < 0.12) ok = false;
    }
    g.c = [tx / 2, ty / 2, tz / 2]; g.wob = wob; g.bad = !ok;
  }

  function remesh(g) {
    var VX = g.VX, VY = g.VY, VZ = g.VZ, nxt = g.nxt, need = false, r, i;
    for (r = 0; r < 2 && !need; r++) {
      var s0 = g.rs[r], n = g.rn[r];
      for (i = 0; i < n; i++) {
        var a = s0 + i, b = nxt[a], dx = VX[b] - VX[a], dy = VY[b] - VY[a], dz = VZ[b] - VZ[a];
        var e = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (e > HMAX || (e < HMIN && n > RMINV)) { need = true; break; }
      }
    }
    if (!need) return false;
    var outs = [];
    for (r = 0; r < 2; r++) {
      var s1 = g.rs[r], m = g.rn[r], ox = [], oy = [], oz = [], skip = false, cnt = m;
      var ed = function (p, q) { var a = s1 + p, b = s1 + q, dx = VX[b] - VX[a], dy = VY[b] - VY[a], dz = VZ[b] - VZ[a]; return Math.sqrt(dx * dx + dy * dy + dz * dz); };
      for (i = 0; i < m; i++) {
        var i0 = (i + m - 1) % m, i2 = (i + 1) % m, i3 = (i + 2) % m, ep = ed(i0, i), en = ed(i, i2);
        if (cnt > RMINV && ep < HMIN && en < HMIN && !skip) { cnt--; skip = true; continue; }
        skip = false;
        ox.push(VX[s1 + i]); oy.push(VY[s1 + i]); oz.push(VZ[s1 + i]);
        if (en > HMAX && ox.length + (m - i) < RMAXV) {                  // 4점 보간 세분: (-p0+9p1+9p2-p3)/16
          var P0 = s1 + i0, P1 = s1 + i, P2 = s1 + i2, P3 = s1 + i3;
          ox.push((-VX[P0] + 9 * VX[P1] + 9 * VX[P2] - VX[P3]) / 16);
          oy.push((-VY[P0] + 9 * VY[P1] + 9 * VY[P2] - VY[P3]) / 16);
          oz.push((-VZ[P0] + 9 * VZ[P1] + 9 * VZ[P2] - VZ[P3]) / 16);
        }
      }
      outs.push([ox, oy, oz]);
    }
    var p = 0;
    for (r = 0; r < 2; r++) {
      var o = outs[r], len = o[0].length;
      g.rs[r] = p; g.rn[r] = len;
      for (i = 0; i < len; i++) { VX[p + i] = o[0][i]; VY[p + i] = o[1][i]; VZ[p + i] = o[2][i]; nxt[p + i] = p + (i + 1) % len; }
      p += len;
    }
    g.n = p;
    return true;
  }

  // 링 정점 RK2(Heun) — 한 서브스텝
  function ringHeun(g, h) {
    var n = g.n, VX = g.VX, VY = g.VY, VZ = g.VZ, i;
    buildSegs(g, T);
    for (i = 0; i < n; i++) { vel(T, VX[i], VY[i], VZ[i]); U1[3 * i] = _ux; U1[3 * i + 1] = _uy; U1[3 * i + 2] = _uz; }
    var sx = g.VX.slice(0, n), sy = g.VY.slice(0, n), sz = g.VZ.slice(0, n);
    for (i = 0; i < n; i++) { VX[i] += h * U1[3 * i]; VY[i] += h * U1[3 * i + 1]; VZ[i] += h * U1[3 * i + 2]; }
    buildSegs(g, T);
    for (i = 0; i < n; i++) { vel(T, VX[i], VY[i], VZ[i]); U2[3 * i] = _ux; U2[3 * i + 1] = _uy; U2[3 * i + 2] = _uz; }
    for (i = 0; i < n; i++) {
      VX[i] = sx[i] + .5 * h * (U1[3 * i] + U2[3 * i]); VY[i] = sy[i] + .5 * h * (U1[3 * i + 1] + U2[3 * i + 1]); VZ[i] = sz[i] + .5 * h * (U1[3 * i + 2] + U2[3 * i + 2]);
    }
  }

  function stepGroup(g) {
    var h = FRAME_DT / RSUB;
    remesh(g);
    buildSegs(g, g.S[0]);
    for (var k = 0; k < RSUB; k++) {
      ringHeun(g, h);
      buildSegs(g, g.S[k + 1]);                                          // 링 서브스텝마다 상태를 보관 → 입자가 시간 보간으로 쓴다
    }
    diag(g);
    g.age++;
  }

  function groupById(id) { for (var i = 0; i < groups.length; i++) if (groups[i].id === id) return groups[i]; return null; }

  // 연기 알갱이를 살아있는 그룹의 링 코어 단면에 심는다
  function seed(i, g, ring) {
    if (ring < 0) ring = rnd() < .5 ? 0 : 1;
    var s0 = g.rs[ring], n = g.rn[ring], j = s0 + ((rnd() * n) | 0), k = g.nxt[j], f = rnd();
    var x = g.VX[j] + f * (g.VX[k] - g.VX[j]), y = g.VY[j] + f * (g.VY[k] - g.VY[j]), z = g.VZ[j] + f * (g.VZ[k] - g.VZ[j]);
    var c = g.rc[ring], a = g.ra[ring], rx = x - c[0], ry = y - c[1], rz = z - c[2], rl = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    var rho = CORE_RHO * Math.sqrt(rnd()), ph = rnd() * TAU, cp = Math.cos(ph) * rho, sp = Math.sin(ph) * rho;
    PX[i] = x + cp * rx + sp * a[0]; PY[i] = y + cp * ry + sp * a[1]; PZ[i] = z + cp * rz + sp * a[2];
    var old = groupById(GI[i]); if (old) old.nP--;
    GI[i] = g.id; g.nP++;
    VIS[i] = 0; AGE[i] = 0; MODE[i] = 0; SPD[i] = 0; WAIT[i] = 0; MAXAGE[i] = 140 + rnd() * 130;
  }

  function launch(o) {
    o = o || {};
    var c = live && isFinite(live.c[0] + live.c[1] + live.c[2]) ? live.c : lastC;   // 발산한 그룹의 중심은 믿지 않는다
    var R = 1, d = (o.d || (1.04 + rnd() * 0.08)) * R;
    // 총 세그먼트 상한: 그룹은 최대 2개 — 가장 오래된 그룹을 즉시 제거한다
    while (groups.length >= 2) {
      var old = groups.shift();
      for (var i = 0; i < NP; i++) if (GI[i] === old.id) GI[i] = -1;
    }
    if (live) {
      live.dying = true; live.dyAge = 0;
      for (var p = 0; p < NP; p++) if (GI[p] === live.id) { MODE[p] = 1; WAIT[p] = (rnd() * 12) | 0; FRATE[p] = 1 / (5 + rnd() * 5); }
    }
    var g = newGroup(c[0], c[1], c[2], R, d, o.ty || 0, o.tz || 0);
    live = g;
    // 첫 발사: 전부 심기. 이후엔 죽어가는 그룹의 알갱이가 페이드아웃을 마치는 대로 옮겨온다
    for (var i2 = 0; i2 < NP; i2++) if (GI[i2] === -1) { seed(i2, g, -1); VIS[i2] = 0; }
    g.born = frame;
    return g;
  }

  function advectParticles() {
    var hp = FRAME_DT / PSUB, st = RSUB / PSUB, i, s;
    for (i = 0; i < NA; i++) {
      var g = groupById(GI[i]); if (!g) continue;
      var x = PX[i], y = PY[i], z = PZ[i], a1, b1, c1;
      for (s = 0; s < PSUB; s++) {                                      // 입자 RK2(Heun): 링 상태 S[t], S[t+hp] 에서 속도를 평가
        vel(g.S[s * st], x, y, z); a1 = _ux; b1 = _uy; c1 = _uz;
        if (s === 0) SPD[i] += (Math.sqrt(a1 * a1 + b1 * b1 + c1 * c1) - SPD[i]) * .4;
        vel(g.S[(s + 1) * st], x + hp * a1, y + hp * b1, z + hp * c1);
        x += .5 * hp * (a1 + _ux); y += .5 * hp * (b1 + _uy); z += .5 * hp * (c1 + _uz);
      }
      if (!(x === x && y === y && z === z) || x * x + y * y + z * z > 1e10) { PX[i] = NaN; continue; }
      PX[i] = x; PY[i] = y; PZ[i] = z;
    }
  }

  function lifecycle() {
    var i, g;
    for (i = 0; i < NA; i++) {
      if (PX[i] !== PX[i]) { MODE[i] = 1; VIS[i] = 0; }                 // NaN 알갱이는 즉시 재시드
      if (MODE[i] === 0) {
        if (VIS[i] < 1) VIS[i] = Math.min(1, VIS[i] + .09);
        AGE[i]++;
        var gg = live && GI[i] === live.id ? live : null, far = false;      // 링에서 멀리 흘러간 연기는 후류로 빠지고 곧 재활용
        if (gg) { var ex = PX[i] - gg.c[0], ey = PY[i] - gg.c[1], ez = PZ[i] - gg.c[2]; far = ex * ex + ey * ey + ez * ez > 56; }
        if (AGE[i] > MAXAGE[i] || far) { MODE[i] = 1; WAIT[i] = 0; FRATE[i] = .1; }
      } else {
        if (WAIT[i] > 0) { WAIT[i]--; continue; }
        VIS[i] -= FRATE[i] || .1;
        if (VIS[i] <= 0 || PX[i] !== PX[i]) { if (live) seed(i, live, -1); }
      }
    }
    // 오래 죽어가는 그룹 정리
    for (var k = groups.length - 1; k >= 0; k--) {
      g = groups[k];
      if (g.dying) { g.dyAge = (g.dyAge || 0) + 1; if (g.nP <= 0 || g.dyAge > 70) { for (i = 0; i < NP; i++) if (GI[i] === g.id) { if (live) seed(i, live, -1); else GI[i] = -1; } groups.splice(k, 1); } }
    }
  }

  return {
    PX: PX, PY: PY, PZ: PZ, SPD: SPD, VIS: VIS, SZ: SZ, GI: GI,
    get live() { return live; }, get groups() { return groups; }, get frame() { return frame; }, get NA() { return NA; },
    setActive: function (n) {
      n = Math.max(200, Math.min(NP, n | 0));
      if (n > NA && live) for (var i = NA; i < n; i++) seed(i, live, -1);
      NA = n;
    },
    launch: launch,
    step: function () {
      for (var k = 0; k < groups.length; k++) stepGroup(groups[k]);
      advectParticles();
      lifecycle();
      frame++;
      if (live && !live.bad) lastC = live.c;
      if (live && live.bad) return false;
      return true;
    }
  };
}
/*SOLVER-END*/

export default function init(root, ctx) {
  const canvas = root.querySelector('.s153__cv');
  const poster = root.querySelector('.s153__poster');
  const c2d = canvas && canvas.getContext && canvas.getContext('2d');
  const lines = root.querySelectorAll('.s153__ln > span');
  let tw = null;
  if (lines.length) tw = gsap.from(lines, { yPercent: 112, duration: 1.4, ease: 'expo.out', stagger: .09, delay: .15 });
  if (!c2d) { root.classList.add('is-static'); return () => { if (tw) tw.kill(); }; }

  // ---------- 파라미터 ----------
  const NP_MAX = ctx.reduced ? 1600 : 3600;
  const CYCLE = 280;                       // 프레임(≈14초) 마다 새 링 발사
  const FRAME_MS = 48;                     // ≈20fps
  let sim = createSim(NP_MAX, (Math.random() * 1e9) | 0);
  sim.launch({});
  sim.setActive(Math.min(NP_MAX, 2600));

  // ---------- 버퍼 ----------
  let BW = 0, BH = 0, Wb, Tb, img, px32;
  const LUT = new Float32Array(2048);
  for (let i = 0; i < 2048; i++) LUT[i] = 1 - Math.exp(-i / 341 * 1.9);
  const PAL = new Uint32Array(64);                 // 속도(코어 근접도) 팔레트: 느림=장밋빛 크림 → 상아 → 빠름=호박빛 금
  (function () {
    const stops = [[0, 224, 176, 150], [.4, 250, 226, 198], [.78, 255, 245, 226], [1, 255, 218, 150]];
    for (let i = 0; i < 64; i++) {
      const t = i / 63; let k = 0; while (k < stops.length - 2 && t > stops[k + 1][0]) k++;
      const a = stops[k], b = stops[k + 1], u = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      const r = a[1] + (b[1] - a[1]) * u, g = a[2] + (b[2] - a[2]) * u, bl = a[3] + (b[3] - a[3]) * u;
      PAL[i] = (255 << 24) | (bl << 16) | (g << 8) | r;     // alpha 는 나중에 덮어쓴다
    }
  })();
  const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;

  function resize() {
    const w = root.clientWidth || 1440, h = root.clientHeight || 810;
    const sc = Math.min(.5, 780 / w);
    const nw = Math.max(160, Math.round(w * sc)), nh = Math.max(120, Math.round(h * sc));
    if (nw === BW && nh === BH) return;
    BW = nw; BH = nh; canvas.width = BW; canvas.height = BH;
    Wb = new Float32Array(BW * BH); Tb = new Float32Array(BW * BH);
    img = c2d.createImageData(BW, BH); px32 = new Uint32Array(img.data.buffer);
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(root);

  // ---------- 카메라 ----------
  const cam = { x: 0, y: 0, z: 0, init: false };
  let tSec = 0, rx_ = 0, ry_ = 0;               // 마우스에 의한 오빗 보정(감쇠)
  let fade = 0;                                  // 전체 페이드인
  function project() {
    const L = sim.live;
    if (L && isFinite(L.c[0] + L.c[1] + L.c[2])) {
      if (!cam.init) { cam.x = L.c[0]; cam.y = L.c[1]; cam.z = L.c[2]; cam.init = true; }
      const k = .14;
      cam.x += (L.c[0] - cam.x) * k; cam.y += (L.c[1] - cam.y) * k; cam.z += (L.c[2] - cam.z) * k;
    }
  }

  // ---------- 렌더 ----------
  function render() {
    project();
    const D = 8, W = BW, H = BH;
    const al = (113 + 11 * Math.sin(tSec * .24) + rx_ * 14) * Math.PI / 180, el = (14 + 6 * Math.sin(tSec * .17 + 1) + ry_ * 8) * Math.PI / 180;
    const ex = -Math.cos(al) * Math.cos(el), ey = Math.sin(el), ez = Math.sin(al) * Math.cos(el);
    const ox = cam.x + D * ex, oy = cam.y + D * ey, oz = cam.z + D * ez;
    let fx = -ex, fy = -ey, fz = -ez;
    let rxv = fy * 0 - fz * 1, ryv = fz * 0 - fx * 0, rzv = fx * 1 - fy * 0;          // f × up(0,1,0)
    const rl = Math.sqrt(rxv * rxv + ryv * ryv + rzv * rzv) || 1; rxv /= rl; ryv /= rl; rzv /= rl;
    const uxv = ryv * fz - rzv * fy, uyv = rzv * fx - rxv * fz, uzv = rxv * fy - ryv * fx;   // right × f
    const portrait = W < H * .9;
    const F = (portrait ? .165 : .235) * Math.min(H, W * (portrait ? 1.2 : .62)) * D;
    const cx = portrait ? W * .5 : W * .705, cy = portrait ? H * .24 : H * .5;
    const baseR = Math.max(1.6, BW / 780 * 2.7);

    Wb.fill(0); Tb.fill(0);
    const PX = sim.PX, PY = sim.PY, PZ = sim.PZ, SPD = sim.SPD, VIS = sim.VIS, SZ = sim.SZ, NA = sim.NA;
    let y0 = H, y1 = 0;
    const gA = fade * (1.0);
    for (let i = 0; i < NA; i++) {
      let v = VIS[i]; if (v <= 0.01) continue;
      const wx = PX[i] - cam.x, wy = PY[i] - cam.y, wz = PZ[i] - cam.z, wd = Math.sqrt(wx * wx + wy * wy + wz * wz);   // 링에서 먼 후류는 서서히 사라진다
      if (wd > 3.4) { v *= 1 - (wd - 3.4) / 3.2; if (v <= 0.01) continue; }
      const qx = PX[i] - ox, qy = PY[i] - oy, qz = PZ[i] - oz;
      const z = qx * fx + qy * fy + qz * fz; if (z < 1.5) continue;
      const iz = 1 / z;
      const sx = cx + F * (qx * rxv + qy * ryv + qz * rzv) * iz, sy = cy - F * (qx * uxv + qy * uyv + qz * uzv) * iz;
      const k = D * iz;
      const r = baseR * k * (.75 + .5 * SZ[i]) * 1.55;
      if (sx < -r || sx > W + r || sy < -r || sy > H + r) continue;
      let fog = 1.12 - (z - D) * .2; fog = fog < .3 ? .3 : fog > 1.15 ? 1.15 : fog;
      const sp = SPD[i] * 1.15; const ti = sp > 1 ? 63 : (sp * 63) | 0;
      const wgt = v * fog * gA * (.55 + .45 * (ti / 63)) / (r * r) * 3.4;
      const xa = Math.max(0, Math.floor(sx - r)), xb = Math.min(W - 1, Math.ceil(sx + r));
      const ya = Math.max(0, Math.floor(sy - r)), yb = Math.min(H - 1, Math.ceil(sy + r));
      const ir2 = 1 / (r * r);
      if (ya < y0) y0 = ya; if (yb > y1) y1 = yb;
      for (let yy = ya; yy <= yb; yy++) {
        const dy = yy + .5 - sy, row = yy * W;
        for (let xx = xa; xx <= xb; xx++) {
          const dx = xx + .5 - sx, d2 = (dx * dx + dy * dy) * ir2;
          if (d2 >= 1) continue;
          const q = 1 - d2, a = q * q * q * wgt;
          Wb[row + xx] += a; Tb[row + xx] += a * ti;
        }
      }
    }
    // 톤맵 + 팔레트 → ImageData
    const rowA = Math.max(0, Math.min(render.py0, y0)), rowB = Math.min(H - 1, Math.max(render.py1, y1));
    for (let yy = rowA; yy <= rowB; yy++) {
      const row = yy * W;
      for (let xx = 0; xx < W; xx++) {
        const w = Wb[row + xx];
        if (w <= 0) { px32[row + xx] = 0; continue; }
        const li = (w * 341) | 0, a = LUT[li > 2047 ? 2047 : li];
        const ti = (Tb[row + xx] / w) | 0;
        const c = PAL[ti > 63 ? 63 : ti];
        px32[row + xx] = (((a * 255) | 0) << 24) | (c & 0xFFFFFF);
      }
    }
    render.py0 = y0; render.py1 = y1;
    c2d.putImageData(img, 0, 0);
  }
  render.py0 = 0; render.py1 = 0;

  // ---------- 루프 ----------
  let running = false, visible = true, last = 0, costEma = 18, cooldown = 0, lastClick = 0, loopFrames = 0;
  function frame(now) {
    if (!running) return;
    if (now - last < FRAME_MS - 2) return;
    last = now;
    const t0 = performance.now();
    tSec += FRAME_MS / 1000;
    fade = Math.min(1, fade + .08);
    rx_ += ((ctx.mouse.nx - .5) * (ctx.fine ? 1 : 0) - rx_) * .05;
    ry_ += ((ctx.mouse.ny - .5) * (ctx.fine ? 1 : 0) - ry_) * .05;
    const ok = sim.step();
    loopFrames++;
    const L = sim.live;
    if (!ok || (L && sim.frame - L.born > CYCLE)) { sim.launch({}); loopFrames = 0; }
    render();
    const cost = performance.now() - t0;
    costEma += (cost - costEma) * .15;
    if (++cooldown > 12) {
      cooldown = 0;
      if (costEma > 34 && sim.NA > 1000) sim.setActive(sim.NA - 300);
      else if (costEma < 20 && sim.NA < NP_MAX) sim.setActive(sim.NA + 200);
    }
  }
  const off = ctx.tick((time) => frame(performance.now()));

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; running = visible && !document.hidden; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { running = visible && !document.hidden; };
  document.addEventListener('visibilitychange', onVis);
  running = true;
  root.__s153 = () => ({ cost: +costEma.toFixed(1), na: sim.NA, frame: sim.frame, bw: BW, bh: BH });   // 디버그 훅(검증용)

  const onDown = (e) => {
    if (e.target.closest && e.target.closest('a,button')) return;
    const t = performance.now(); if (t - lastClick < 1100) return; lastClick = t;
    const b = root.getBoundingClientRect();
    const nx = (e.clientX - b.left) / b.width, ny = (e.clientY - b.top) / b.height;
    sim.launch({ ty: (nx - .5) * .5, tz: (.5 - ny) * .5 });
  };
  root.addEventListener('pointerdown', onDown);

  return () => {
    running = false; off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    root.removeEventListener('pointerdown', onDown);
    if (tw) tw.kill();
  };
}
