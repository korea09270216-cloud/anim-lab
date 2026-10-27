// s168 — FTL(Follow-The-Leader) 머리카락. 엔진 없이 직접 구현한 솔버:
//  · 150가닥 × 8절. 매 서브스텝: 예측(중력·바람 항력·형상 복원 스프링·빗질) → 루트부터 FTL 1회 → 속도 보정 v -= s·d_child/dt
//  · 형상 복원: 루트 쪽은 강하고 끝으로 갈수록 약해지는 목표 형상 스프링(헤어스타일 유지, 끝은 자유롭게 휘날림)
//  · 머리 구 충돌, 커서 빗질(원통 밀어내기 + 이동 속도 끌림), 머리 회전 관성
//  · 렌더: Kajiya-Kay 접선 음영 → 밝기·굵기 버킷으로 묶어 한 번에 stroke (가닥당 호출 폭발 방지)
// createHair 는 DOM 이 없어 node 에서도 돌린다.

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function createHair(o = {}) {
  const NS = o.strands || 150, NP = o.nodes || 8, R = o.R || 120, SUBS = o.substeps || 2;
  const rnd = mulberry(o.seed || 11);
  const X = new Float64Array(NS * NP * 3), V = new Float64Array(NS * NP * 3), RL = new Float64Array(NS * NP * 3);
  const SEG = new Float64Array(NS), accent = new Uint8Array(NS), nrm = new Float64Array(NS * 3);
  const G = (o.gravity || 2400) * (R / 120), CD = o.airDrag == null ? 1.7 : o.airDrag, SD = o.sdamp == null ? 0.9 : o.sdamp;
  const K0 = o.shapeK == null ? 85 : o.shapeK;
  const kS = new Float64Array(NP);
  for (let i = 0; i < NP; i++) { const t = i / (NP - 1); kS[i] = i === 0 ? 0 : K0 * Math.pow(1 - 0.86 * t, 1.6); }
  const head = { cx: 0, cy: 0, cz: 0, yaw: 0, pcx: 0, pcy: 0, pyaw: 0 };

  // ── 가닥 루트 분포: 피보나치 구면 + 얼굴(이마 아래) 영역 제외
  let n = 0, tries = 0;
  const golden = 2.399963229728653;
  while (n < NS && tries < NS * 8) {
    const i = tries++;
    const cz = 1 - (1.0 + 0.36) * (i + 0.5) / (NS * 3.2); // 위쪽 반구 + 뒤통수 아래까지
    if (cz < -0.36) continue;
    const phi = i * golden, sn = Math.sqrt(Math.max(0, 1 - cz * cz));
    const nx = sn * Math.cos(phi), ny = -cz, nz = sn * Math.sin(phi); // y 아래 양수, 위쪽 = -y, 앞 = +z
    if (nz > 0.28 && ny > -0.58) continue;
    nrm[n * 3] = nx; nrm[n * 3 + 1] = ny; nrm[n * 3 + 2] = nz;
    n++;
  }
  // 모자란 가닥은 정수리 쪽에 채운다
  while (n < NS) { const a = rnd() * 6.283, s = 0.55 * rnd(); nrm[n * 3] = s * Math.cos(a); nrm[n * 3 + 1] = -Math.sqrt(1 - s * s); nrm[n * 3 + 2] = s * Math.sin(a); n++; }

  // ── 휴지 형상(머리 좌표계): 표면에서 바깥으로 시작해 중력 방향으로 흘러내림
  for (let s = 0; s < NS; s++) {
    const L = R * (2.2 + 0.75 * rnd()), l = L / (NP - 1);
    SEG[s] = l; accent[s] = rnd() < 0.08 ? 1 : 0;
    const snx = nrm[s * 3], snz = nrm[s * 3 + 2];
    let px = snx * R * 1.015, py = nrm[s * 3 + 1] * R * 1.015, pz = snz * R * 1.015;
    const wav = rnd() * 6.283, wamp = 0.12 + 0.12 * rnd();
    for (let k = 0; k < NP; k++) {
      const b = (s * NP + k) * 3;
      RL[b] = px; RL[b + 1] = py; RL[b + 2] = pz;
      // 머리 표면의 "아래쪽" 접선을 따라 흐르다가(헤어가 두피에 붙음) 점점 중력 방향으로 떨어진다
      const t = (k + 1) / (NP - 1), sm = Math.max(0, Math.min(1, t * 1.15 - 0.12)), e = sm * sm * (3 - 2 * sm);
      const rl = Math.hypot(px, py, pz) || 1, ox = px / rl, oy = py / rl, oz = pz / rl;
      let tx = -oy * ox, ty = 1 - oy * oy, tz = -oy * oz, tl = Math.hypot(tx, ty, tz);
      if (tl < 0.3) { const hl = Math.hypot(snx, snz) || 1; tx = snx / hl * 0.9 + Math.cos(wav) * 0.4; tz = snz / hl * 0.9 + Math.sin(wav) * 0.4; ty = 0.25; tl = Math.hypot(tx, ty, tz); }
      tx /= tl; ty /= tl; tz /= tl;
      // 앞머리는 옆으로 쓸어 넘김
      if (oz > 0.1) { tx += (snx >= 0 ? 1 : -1) * 1.2 * oz; tz -= 0.5 * oz; }
      let dx = tx * (1 - 0.85 * e), dy = ty * (1 - 0.85 * e) + e, dz = tz * (1 - 0.85 * e);
      dx += ox * 0.16 + Math.sin(wav + k * 0.9) * wamp * e; dy += oy * 0.16; dz += oz * 0.16 + Math.cos(wav + k * 0.9) * wamp * e * 0.6;
      const dl = Math.hypot(dx, dy, dz) || 1;
      px += dx / dl * l; py += dy / dl * l; pz += dz / dl * l;
      const rmin = R * (1.05 + 0.035 * k), pr = Math.hypot(px, py, pz);
      if (pr < rmin) { px *= rmin / pr; py *= rmin / pr; pz *= rmin / pr; }
    }
  }

  const toWorld = (lx, ly, lz, yaw, out, off) => {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    out[off] = head.cx + lx * c + lz * s; out[off + 1] = head.cy + ly; out[off + 2] = head.cz - lx * s + lz * c;
  };
  const tmp = new Float64Array(3);

  function snap() {
    for (let s = 0; s < NS; s++) for (let k = 0; k < NP; k++) {
      const b = (s * NP + k) * 3; toWorld(RL[b], RL[b + 1], RL[b + 2], head.yaw, X, b);
      V[b] = V[b + 1] = V[b + 2] = 0;
    }
    head.pcx = head.cx; head.pcy = head.cy; head.pyaw = head.yaw;
  }

  const corr = new Float64Array(NP * 3), pred = new Float64Array(NP * 3);
  // env: { t, wx, wy, wz, comb:{on,x,y,r,vx,vy} }, head 는 setHead 로 미리 갱신
  function step(dt, env) {
    const ds = dt / SUBS;
    const hcx0 = head.pcx, hcy0 = head.pcy, hy0 = head.pyaw, hcx1 = head.cx, hcy1 = head.cy, hy1 = head.yaw;
    for (let sub = 0; sub < SUBS; sub++) {
      const f = (sub + 1) / SUBS;
      const ccx = hcx0 + (hcx1 - hcx0) * f, ccy = hcy0 + (hcy1 - hcy0) * f, cyw = hy0 + (hy1 - hy0) * f;
      const cs = Math.cos(cyw), sn = Math.sin(cyw);
      for (let s = 0; s < NS; s++) {
        const base = s * NP * 3;
        // 루트(키네마틱)
        let rx = RL[base], ry = RL[base + 1], rz = RL[base + 2];
        const rwx = ccx + rx * cs + rz * sn, rwy = ccy + ry, rwz = head.cz - rx * sn + rz * cs;
        X[base] = rwx; X[base + 1] = rwy; X[base + 2] = rwz; V[base] = V[base + 1] = V[base + 2] = 0;
        pred[0] = rwx; pred[1] = rwy; pred[2] = rwz;
        for (let i = 1; i < NP; i++) {
          const b = base + i * 3, q = i * 3;
          let vx = V[b], vy = V[b + 1], vz = V[b + 2];
          const x = X[b], y = X[b + 1], z = X[b + 2];
          // 목표 형상(머리와 함께 움직임)
          const lx = RL[b], ly = RL[b + 1], lz = RL[b + 2];
          const tx = ccx + lx * cs + lz * sn, ty = ccy + ly, tz = head.cz - lx * sn + lz * cs;
          const k = kS[i];
          let ax = k * (tx - x), ay = k * (ty - y) + G, az = k * (tz - z);
          // 바람(공기 속도 쪽으로 항력) — 높이·시간에 따라 흔들리는 장
          const ph = env.t * 1.9 + y * 0.011 + x * 0.007 + i * 0.35 + s * 0.017;
          const wm = 1 + 0.5 * Math.sin(ph) + 0.25 * Math.sin(ph * 2.3 + 1.1);
          ax += CD * (env.wx * wm - vx); ay += CD * (env.wy * wm - vy); az += CD * (env.wz * wm - vz);
          // 빗질: 커서 근처는 커서 속도를 따라간다
          const cb = env.comb;
          if (cb && cb.on) {
            const dx = x - cb.x, dy = y - cb.y, d2 = dx * dx + dy * dy, rr = cb.r * 1.9;
            if (d2 < rr * rr) { const w = 1 - Math.sqrt(d2) / rr; ax += 14 * w * w * (cb.vx - vx) + 0 ; ay += 14 * w * w * (cb.vy - vy); }
          }
          vx += ax * ds; vy += ay * ds; vz += az * ds;
          let px = x + vx * ds, py = y + vy * ds, pz = z + vz * ds;
          // 커서 원통 밀어내기
          if (cb && cb.on) {
            const dx = px - cb.x, dy = py - cb.y, d2 = dx * dx + dy * dy;
            if (d2 < cb.r * cb.r && d2 > 1e-9) { const sq = cb.r / Math.sqrt(d2); px = cb.x + dx * sq; py = cb.y + dy * sq; }
          }
          // 머리 구 충돌
          const hx = px - ccx, hy = py - ccy, hz = pz - head.cz, hd2 = hx * hx + hy * hy + hz * hz, hr = R * 1.03;
          if (hd2 < hr * hr && hd2 > 1e-9) { const sq = hr / Math.sqrt(hd2); px = ccx + hx * sq; py = ccy + hy * sq; pz = head.cz + hz * sq; }
          pred[q] = px; pred[q + 1] = py; pred[q + 2] = pz;
        }
        // ── FTL: 루트부터 앞 입자의 *보정된* 위치를 기준으로 길이 유지
        const l = SEG[s];
        let ppx = pred[0], ppy = pred[1], ppz = pred[2];
        for (let i = 1; i < NP; i++) {
          const q = i * 3;
          let dx = pred[q] - ppx, dy = pred[q + 1] - ppy, dz = pred[q + 2] - ppz;
          const dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9, sc = l / dl;
          const nx = ppx + dx * sc, ny = ppy + dy * sc, nz = ppz + dz * sc;
          corr[q] = nx - pred[q]; corr[q + 1] = ny - pred[q + 1]; corr[q + 2] = nz - pred[q + 2];
          pred[q] = nx; pred[q + 1] = ny; pred[q + 2] = nz;
          ppx = nx; ppy = ny; ppz = nz;
        }
        // 속도 갱신: v = (p' − x)/dt − s·d_{i+1}/dt  (자식의 보정이 부모 운동량으로 되돌려진다)
        const id = 1 / ds;
        for (let i = 1; i < NP; i++) {
          const b = base + i * 3, q = i * 3, c = i + 1 < NP ? (i + 1) * 3 : -1;
          V[b] = (pred[q] - X[b]) * id - (c >= 0 ? SD * corr[c] * id : 0);
          V[b + 1] = (pred[q + 1] - X[b + 1]) * id - (c >= 0 ? SD * corr[c + 1] * id : 0);
          V[b + 2] = (pred[q + 2] - X[b + 2]) * id - (c >= 0 ? SD * corr[c + 2] * id : 0);
          X[b] = pred[q]; X[b + 1] = pred[q + 1]; X[b + 2] = pred[q + 2];
        }
      }
    }
    head.pcx = head.cx; head.pcy = head.cy; head.pyaw = head.yaw;
  }

  function stats() {
    let maxErr = 0, nan = 0, dev = 0, cntD = 0, vmax = 0;
    for (let s = 0; s < NS; s++) for (let i = 1; i < NP; i++) {
      const b = (s * NP + i) * 3, a = b - 3;
      const e = Math.abs(Math.hypot(X[b] - X[a], X[b + 1] - X[a + 1], X[b + 2] - X[a + 2]) / SEG[s] - 1);
      if (e > maxErr) maxErr = e;
      if (!Number.isFinite(X[b])) nan++;
      toWorld(RL[b], RL[b + 1], RL[b + 2], head.yaw, tmp, 0);
      dev += Math.hypot(X[b] - tmp[0], X[b + 1] - tmp[1], X[b + 2] - tmp[2]); cntD++;
      const v = Math.hypot(V[b], V[b + 1], V[b + 2]); if (v > vmax) vmax = v;
    }
    return { maxErr, nan, meanDev: dev / cntD, vmax };
  }

  return { NS, NP, R, X, V, RL, SEG, accent, nrm, head, step, snap, stats, toWorld };
}

// ───────────────────────── 렌더 / 시나리오 ─────────────────────────
const LUMB = 8, WB = 4;
const RAMP = [[[18, 13, 30], [72, 54, 118], [255, 240, 205]], [[70, 30, 18], [150, 70, 36], [255, 214, 150]]]; // [일반, 포인트(구리빛)] 어둠→결 광택→하이라이트

export default function init(root, ctx) {
  const cv = root.querySelector('.s168__cv');
  const g = cv && cv.getContext && cv.getContext('2d');
  if (!g) { root.classList.add('is-static'); return; }
  const stat = root.querySelector('.s168__stat');
  const RS = ctx.reduced ? 0.55 : 0.72;
  const F = 2600;
  const Lraw = [-0.5, -0.55, 0.7], Ll = Math.hypot(...Lraw), Lv = Lraw.map(v => v / Ll);
  const Hraw = [Lv[0], Lv[1], Lv[2] + 1], Hl = Math.hypot(...Hraw), Hv = Hraw.map(v => v / Hl);
  const btnGust = root.querySelector('[data-act="gust"]'), btnShake = root.querySelector('[data-act="shake"]');

  let sim, W = 0, H = 0, S = RS, hx0 = 0, hy0 = 0, R = 100;
  let cyc = 0, gust = 0, shake = 0, userAt = -1e9, vis = true, alive = true, last = performance.now();
  const hs = { yaw: 0, vyaw: 0 };
  const cur = { x: 0, y: 0, vx: 0, vy: 0, on: false, init: false };
  const buckets = []; for (let i = 0; i < 2 * 2 * LUMB * WB; i++) buckets.push([]);

  function build() {
    W = root.clientWidth; H = root.clientHeight;
    cv.width = Math.round(W * RS); cv.height = Math.round(H * RS); S = cv.width / W;
    const narrow = W < 820;
    R = Math.min(H * 0.145, W * (narrow ? 0.2 : 0.1));
    hx0 = narrow ? W * 0.5 : W * 0.7; hy0 = H * (narrow ? 0.6 : 0.4);
    sim = createHair({ R, strands: 150, nodes: 8 });
    sim.head.cx = hx0; sim.head.cy = hy0; sim.head.cz = 0; sim.head.yaw = 0;
    sim.snap();
    cyc = 0; gust = 0; shake = 0; hs.yaw = 0; hs.vyaw = 0; cur.init = false;
    for (let i = 0; i < 40; i++) sim.step(1 / 60, { t: i / 60, wx: 150, wy: 0, wz: 60, comb: null });
  }

  const sp = new Float64Array(4 * 3);
  // 접선 음영 + 이분할 곡선(Catmull-Rom 중간점)으로 가닥을 버킷에 쌓는다
  function strandSegments(s, front) {
    const NP = sim.NP, X = sim.X, base = s * NP * 3, cls = sim.accent[s];
    const half = (a, b, c, d) => (-a + 9 * b + 9 * c - d) * 0.0625;
    // 점열: 원 입자 + 중간 입자
    const pts = [];
    for (let i = 0; i < NP; i++) {
      pts.push(X[base + i * 3], X[base + i * 3 + 1], X[base + i * 3 + 2]);
      if (i < NP - 1) {
        const i0 = Math.max(0, i - 1), i1 = i, i2 = i + 1, i3 = Math.min(NP - 1, i + 2);
        for (let c = 0; c < 3; c++) pts.push(half(X[base + i0 * 3 + c], X[base + i1 * 3 + c], X[base + i2 * 3 + c], X[base + i3 * 3 + c]));
      }
    }
    const nPts = pts.length / 3;
    for (let i = 0; i < nPts - 1; i++) {
      const a = i * 3, b = a + 3;
      let tx = pts[b] - pts[a], ty = pts[b + 1] - pts[a + 1], tz = pts[b + 2] - pts[a + 2];
      const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
      const dl = tx * Lv[0] + ty * Lv[1] + tz * Lv[2], dh = tx * Hv[0] + ty * Hv[1] + tz * Hv[2];
      const sh = Math.sqrt(Math.max(0, 1 - dh * dh)), diff = Math.sqrt(Math.max(0, 1 - dl * dl));
      const v = Math.min(1, 0.05 * diff + 0.85 * Math.pow(sh, 36) + 0.1 * Math.pow(sh, 12));
      const lb = Math.min(LUMB - 1, (v * LUMB) | 0);
      const t = i / (nPts - 1), fz = F / (F - (pts[a + 2] + pts[b + 2]) * 0.5);
      const w = (5.2 - 3.4 * t) * fz * S;
      const wb = Math.min(WB - 1, Math.max(0, Math.round((w / (5.2 * S) - 0.3) * 4.2)));
      const bk = buckets[(((front ? 1 : 0) * 2 + cls) * LUMB + lb) * WB + wb];
      bk.push((hx0 + (pts[a] - hx0) * fz) * S, (hy0 + (pts[a + 1] - hy0) * fz) * S, (hx0 + (pts[b] - hx0) * fz) * S, (hy0 + (pts[b + 1] - hy0) * fz) * S);
    }
  }
  const flush = front => {
    g.lineCap = 'round';
    for (let cls = 0; cls < 2; cls++) for (let lb = 0; lb < LUMB; lb++) {
      const u = lb / (LUMB - 1), rp = RAMP[cls], seg = u < 0.5 ? 0 : 1, f = seg ? (u - 0.5) * 2 : u * 2, A = rp[seg], B = rp[seg + 1];
      g.strokeStyle = `rgb(${(A[0] + (B[0] - A[0]) * f) | 0},${(A[1] + (B[1] - A[1]) * f) | 0},${(A[2] + (B[2] - A[2]) * f) | 0})`;
      for (let wb = 0; wb < WB; wb++) {
        const bk = buckets[(((front ? 1 : 0) * 2 + cls) * LUMB + lb) * WB + wb];
        if (!bk.length) continue;
        g.lineWidth = (1.6 + wb) * S;
        g.beginPath();
        for (let i = 0; i < bk.length; i += 4) { g.moveTo(bk[i], bk[i + 1]); g.lineTo(bk[i + 2], bk[i + 3]); }
        g.stroke(); bk.length = 0;
      }
    }
  };

  function drawHead() {
    const cx = hx0 * S, cy = hy0 * S, r = R * S, yaw = sim.head.yaw;
    // 목 + 살롱 케이프(보라) 상반신
    g.fillStyle = '#d9c19b'; g.beginPath(); g.roundRect(cx - R * 0.34 * S, cy + R * 0.7 * S, R * 0.68 * S, R * 1.2 * S, R * 0.18 * S); g.fill();
    const cg = g.createLinearGradient(0, cy + R * 1.4 * S, 0, cy + R * 3.2 * S);
    cg.addColorStop(0, '#6a4fe0'); cg.addColorStop(1, '#3f2a9a');
    g.fillStyle = cg; g.beginPath(); g.moveTo(cx - R * 0.5 * S, cy + R * 1.3 * S);
    g.bezierCurveTo(cx - R * 1.3 * S, cy + R * 1.4 * S, cx - R * 1.8 * S, cy + R * 1.7 * S, cx - R * 2.15 * S, cy + R * 2.35 * S);
    g.lineTo(cx - R * 2.5 * S, cy + R * 5 * S); g.lineTo(cx + R * 2.5 * S, cy + R * 5 * S); g.lineTo(cx + R * 2.15 * S, cy + R * 2.35 * S);
    g.bezierCurveTo(cx + R * 1.8 * S, cy + R * 1.7 * S, cx + R * 1.3 * S, cy + R * 1.4 * S, cx + R * 0.5 * S, cy + R * 1.3 * S); g.closePath(); g.fill();
    g.fillStyle = 'rgba(255,255,255,.13)'; g.beginPath(); g.ellipse(cx - R * 0.95 * S, cy + R * 2.0 * S, R * 0.9 * S, R * 0.2 * S, 0.32, 0, 6.2832); g.fill();
    g.fillStyle = '#c8ad84'; g.beginPath(); g.ellipse(cx, cy + R * 1.38 * S, R * 0.56 * S, R * 0.2 * S, 0, 0, 6.2832); g.fill();
    // 머리 구 = 두피(머리색) 위에 얼굴(살색) — 얼굴이 돌아가면 두피만 보인다
    // 머리 좌표계 앞(0,0,1) → 화면 x = sin(yaw), 깊이 = cos(yaw)
    const sy = Math.sin(yaw), cw = Math.cos(yaw);
    g.save(); g.beginPath(); g.arc(cx, cy, r, 0, 6.2832); g.clip();
    g.fillStyle = '#171028'; g.fillRect(cx - r, cy - r, r * 2, r * 2);
    if (cw > 0.05) {
      const fx = cx + sy * r * 0.5, fy = cy + r * 0.22;
      const fg = g.createRadialGradient(fx - r * 0.15, fy - r * 0.25, r * 0.05, fx, fy, r * 0.75);
      fg.addColorStop(0, '#fbeedb'); fg.addColorStop(0.7, '#efd9b8'); fg.addColorStop(1, '#d9bd96');
      g.fillStyle = fg; g.beginPath(); g.ellipse(fx, fy, r * 0.64 * cw + r * 0.05, r * 0.72, 0, 0, 6.2832); g.fill();
    }
    g.restore();
    for (const side of [-1, 1]) { // 귀: 머리 좌표 (±1,0,0) → 화면 x = ±cos(yaw), 깊이 = ∓sin(yaw)
      const ex = side * cw, ez = -side * sy;
      if (ez > 0.1) { g.fillStyle = '#e3c9a2'; g.beginPath(); g.ellipse(cx + ex * r * 0.97, cy + r * 0.2, r * 0.09 * ez, r * 0.19, 0, 0, 6.2832); g.fill(); }
    }
  }

  function draw() {
    const w = cv.width, h = cv.height;
    g.clearRect(0, 0, w, h);
    // 뒤쪽/앞쪽 가닥 분류
    const NP = sim.NP, X = sim.X, cz = sim.head.cz;
    const frontList = [], backList = [];
    for (let s = 0; s < sim.NS; s++) {
      let zs = 0; for (let i = 1; i < NP; i++) zs += X[(s * NP + i) * 3 + 2];
      zs /= NP - 1;
      (zs > cz - R * 0.02 ? frontList : backList).push(s);
    }
    for (const s of backList) strandSegments(s, false);
    flush(false);
    drawHead();
    for (const s of frontList) strandSegments(s, true);
    flush(true);
    // 빗(커서) 표시
    if (cur.on) {
      g.strokeStyle = 'rgba(40,30,20,.5)'; g.lineWidth = 1.5 * S; g.beginPath(); g.arc(cur.x * S, cur.y * S, R * 0.5 * S, 0, 6.2832); g.stroke();
    }
  }

  // ── 입력
  const onMove = e => { const r = root.getBoundingClientRect(); if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) userAt = performance.now(); };
  addEventListener('pointermove', onMove, { passive: true });
  const doGust = () => { gust = 1; };
  const doShake = () => { shake = 1; };
  btnGust && btnGust.addEventListener('click', doGust); btnShake && btnShake.addEventListener('click', doShake);

  function controller() {
    cyc += 1 / 60;
    const t = cyc, real = performance.now() - userAt < 2500, r = root.getBoundingClientRect();
    // 머리 회전: 평소엔 천천히 좌우, 사용자가 있으면 커서 x 를 따라 고개를 돌림
    let yawT = 0.62 * Math.sin(t * 0.85) + 0.18 * Math.sin(t * 2.1);
    if (real) yawT = (Math.max(0, Math.min(1, (ctx.mouse.x - r.left) / r.width)) - 0.7) * 1.6;
    if (shake > 0.001) { yawT += 1.0 * Math.sin(t * 13) * shake; shake *= 0.96; }
    const k = 70, c = 11;
    hs.vyaw += (k * (yawT - hs.yaw) - c * hs.vyaw) / 60; hs.yaw += hs.vyaw / 60;
    sim.head.yaw = hs.yaw;
    sim.head.cx = hx0 + 14 * Math.sin(t * 0.7) + hs.yaw * 18; sim.head.cy = hy0 + 8 * Math.sin(t * 1.4);
    // 커서(빗)
    let px, py;
    if (real) { px = ctx.mouse.x - r.left; py = ctx.mouse.y - r.top; }
    else { px = hx0 + Math.sin(t * 0.62 + 1.2) * R * 2.0; py = hy0 + R * (0.6 + 0.9 * Math.sin(t * 0.93)); }
    if (!cur.init) { cur.x = px; cur.y = py; cur.init = true; }
    const nvx = (px - cur.x) * 60, nvy = (py - cur.y) * 60;
    cur.vx += (nvx - cur.vx) * 0.35; cur.vy += (nvy - cur.vy) * 0.35;
    cur.x = px; cur.y = py; cur.on = true; cur.r = R * 0.5;
    gust *= 0.985;
    const wbase = 120 + 420 * Math.max(0, Math.sin(t * 0.55)) ** 2 + 1400 * gust;
    const env = { t, wx: wbase * 0.9 * Math.cos(t * 0.3 + 0.5), wy: -25, wz: wbase * 0.35, comb: cur };
    sim.step(1 / 60, env);
  }

  // ── 루프
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);
  let ro = null, rt = 0, lastW = 0;
  if (window.ResizeObserver) {
    ro = new ResizeObserver(() => {
      if (Math.abs(root.clientWidth - lastW) < 2) return;
      clearTimeout(rt); rt = setTimeout(() => { if (alive) { build(); lastW = root.clientWidth; } }, 200);
    });
    ro.observe(root);
  }
  build(); lastW = root.clientWidth;
  let acc = 0, lastDraw = 0, hudAt = 0;
  const off = ctx.tick(() => {
    if (!vis || document.hidden) { last = performance.now(); return; }
    const now = performance.now();
    acc += Math.min(100, now - last); last = now;
    if (now - lastDraw < 38) return;
    lastDraw = now;
    let k = 0;
    while (acc >= 16.667 && k < 4) { controller(); acc -= 16.667; k++; }
    if (acc > 50) acc = 0;
    draw();
    if (stat && now - hudAt > 600) {
      hudAt = now;
      const s = sim.stats();
      if (s.nan > 0 || s.maxErr > 0.2) { build(); return; } // 자가 복구
      stat.textContent = `가닥 ${sim.NS} × ${sim.NP}절 · FTL 1회 반복 · 최대 길이 오차 ${(s.maxErr * 100).toFixed(2)}%`;
    }
  });

  return () => {
    alive = false; off(); io.disconnect(); ro && ro.disconnect(); clearTimeout(rt);
    removeEventListener('pointermove', onMove); document.removeEventListener('visibilitychange', onVis);
    btnGust && btnGust.removeEventListener('click', doGust); btnShake && btnShake.removeEventListener('click', doShake);
  };
}
