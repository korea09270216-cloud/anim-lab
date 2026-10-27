// s172 — FABRIK 문어. 8팔 × 12관절.
// createOctopus(): DOM 없는 순수 시뮬(FABRIK + 각도 클램프 + 절차 curl/흡반). init(): Canvas2D 렌더 + 입력/가시성 제어.
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const wrap = a => { a = (a + PI) % TAU; if (a < 0) a += TAU; return a - PI; };
const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const NA = 8, NJ = 12, NL = NJ - 1;   // 팔 수 · 관절 수 · 링크 수
const KK = 6;                          // FABRIK 체인 = 관절 0..KK, 끝 5개 링크(KK..10)는 curl/파동 FK 꼬리
const HT = [1, .95, .8, .28, .1, 0, 0, 0];   // 각도 순위별 주공격 가중치(1,2,3위 = 주공격 / 4,5위 = 기울임)
const SUCK = 16, SUB = 3, NS = NL * SUB + 1;

export function createOctopus(W, H, opt = {}) {
  const rnd = mulberry32(opt.seed == null ? 172 : opt.seed);
  const sway = opt.sway == null ? 1 : opt.sway;
  const k = clamp(Math.min(H / 405, W / 640), .3, 1.7);
  const portrait = W < H * 1.1;
  const home = portrait ? { x: W * .5, y: H * .64 } : { x: W * .67, y: H * .5 };
  const Rb = 42 * k;

  // ── 링크 길이(뿌리→끝 테이퍼) · 관절별 최대 굴곡각 · 두께
  const lens = new Float64Array(NL), mb = new Float64Array(NL), cum = new Float64Array(NJ), rad = new Float64Array(NJ), thc = new Float64Array(NL);
  for (let i = 0; i < NL; i++) lens[i] = 30 * k * (1 - .75 * i / 10);
  mb[0] = 1.25;                                              // 0번: 몸통 방사 방향 대비 펼침 한계
  for (let j = 1; j < NL; j++) mb[j] = .80 + .55 * Math.pow(j / 10, 1.8);
  for (let j = 0; j < NL; j++) { cum[j + 1] = cum[j] + lens[j]; thc[j] = mb[j] * .95; }
  const total = cum[NJ - 1];
  let Lp = 0; for (let i = 0; i < KK; i++) Lp += lens[i];
  const Lt = total - Lp;
  for (let j = 0; j < NJ; j++) rad[j] = k * (1.1 + 9.4 * Math.pow(1 - cum[j] / total, .85));
  // 클램프로 접을 수 있는 최소 현(chord): 모든 관절이 한계각으로 같은 방향 굴곡할 때의 끝점 거리 → 이보다 가까운 K 목표는 만들지 않는다
  let minChord;
  { let x = lens[0], y = 0, a = 0; for (let i = 1; i < KK; i++) { a += mb[i]; x += Math.cos(a) * lens[i]; y += Math.sin(a) * lens[i]; } minChord = Math.hypot(x, y); }
  const minK = Math.max(minChord * 1.06, .5 * Lp);
  const Lreach = total + Rb * .3;

  // ── 꼬리(curl) 로컬 FK: 헤딩 0, side 부호 포함. anchor = 끝점↔무게중심 보간(코일 중심이 먹이에 오도록)
  const tl = new Float64Array(2 * (NL - KK + 1));
  function tailAnchor(side, ce, out) {
    let x = 0, y = 0, a = 0, sx = 0, sy = 0, n = 1;
    for (let j = KK; j < NL; j++) {
      a += side * ce * thc[j]; x += Math.cos(a) * lens[j]; y += Math.sin(a) * lens[j];
      sx += x; sy += y; n++;
    }
    out.x = lerp(x, sx / n, ce); out.y = lerp(y, sy / n, ce);
  }

  // ── 팔 생성
  const arms = [];
  for (let a = 0; a < NA; a++) {
    arms.push({
      idx: a, phi: a * TAU / NA + TAU / 16, side: a % 2 ? 1 : -1,
      bow: a % 2 ? 1 : -1, wph: a * .93 + rnd() * .5, wfq: 1.45 + .4 * rnd(), tauA: .06 + .07 * rnd(), rhoJ: (rnd() - .5) * 10 * k,
      p: new Float64Array(2 * NJ), ip: new Float64Array(2 * NJ), ib: new Float64Array(NL),
      tk: { x: 0, y: 0 }, tv: { x: 0, y: 0 }, aim: { x: home.x, y: home.y }, kt: { x: 0, y: 0 }, an: { x: 0, y: 0 },
      h: 0, c: 0, ce: 0, cg: 0, cr: 0, gr: 0, rb: new Float64Array(KK), rbInit: false, rank: a, cx: 0, cy: 0, ax: 0, ay: 0,
      g: { qx: new Float64Array(NS), qy: new Float64Array(NS), tx: new Float64Array(NS), ty: new Float64Array(NS), r: new Float64Array(NS), s: new Float64Array(NS),
        poly: new Float64Array(2 * (2 * NS + 3)), np: 0, hi: new Float64Array(2 * NS), sk: new Float64Array(SUCK * 4) },
    });
  }

  const body = { x: home.x, y: home.y, vx: 0, vy: 0, face: 0, fv: 0, psi: 0, pv: 0, breathe: 0 };
  const eye = { gx: 0, gy: 0, blink: 0, blinkIn: 2.2, blinkT: -1 };
  const prey = { st: 'gone', x: 0, y: 0, vx: 0, vy: 0, bx: 0, by: 0, t: 0, scale: 0, grabT: 0, holdT: 0, carryT: 0, eatT: 0, wait: .35, rot: 0, sx: 0, sy: 0, ex: 0, ey: 0 };
  const stats = { eaten: 0, spawned: 0, resets: 0 };

  // 유휴 FK 포즈: 뿌리에서 사인 파동(뿌리→끝 위상 지연) + 바깥으로 말리는 나선 바이어스
  function idlePose(arm, t, ax, ay, ang0) {
    const ib = arm.ib, ip = arm.ip;
    ib[0] = arm.side * .12 + .22 * sway * Math.sin(.7 * t + arm.wph);
    for (let j = 1; j < NL; j++) {
      const A = (.05 + .032 * j) * sway;
      ib[j] = clamp(arm.side * (.11 + .016 * j) + A * Math.sin(arm.wfq * t - .62 * j + arm.wph), -.9 * mb[j], .9 * mb[j]);
    }
    let x = ax, y = ay, a = ang0; ip[0] = x; ip[1] = y;
    for (let j = 0; j < NL; j++) { a += ib[j]; x += Math.cos(a) * lens[j]; y += Math.sin(a) * lens[j]; ip[2 * j + 2] = x; ip[2 * j + 3] = y; }
  }

  // 균일 굴곡 호(arc) 사전: 목표까지의 현(chord)이 dist 가 되는 링크간 굴곡 β 를 이분법으로 푼다 → 슬랙이 끝 관절 한 곳에 몰려 접히는(hairpin) FABRIK 고유 문제를 완화
  const arcTmp = { phi: 0, beta: 0, rel0: 0 };
  function arcChord(beta, sgn, setPhi) {
    let x = 0, y = 0, h = 0;
    for (let i = 0; i < KK; i++) { if (i > 0) h += sgn * beta; x += Math.cos(h) * lens[i]; y += Math.sin(h) * lens[i]; }
    if (setPhi) arcTmp.phi = Math.atan2(y, x);
    return Math.hypot(x, y);
  }
  function arcPrior(dist, sgn, angT, ang0) {
    let lo = 0, hi = mb[1] * .95;
    if (arcChord(hi, sgn, false) > dist) lo = hi; else for (let i = 0; i < 14; i++) { const m = (lo + hi) * .5; if (arcChord(m, sgn, false) > dist) lo = m; else hi = m; }
    arcTmp.beta = (lo + hi) * .5; arcChord(arcTmp.beta, sgn, true); arcTmp.rel0 = wrap(angT - arcTmp.phi - ang0);
    return arcTmp;
  }

  // 관절 각속도 제한(스텝당 DMAX): 최종 굴곡을 직전 스텝 굴곡 ±DMAX 신뢰영역과 각도 한계의 교집합으로 자른다 → 활 방향 전환/새 먹이에서도 채찍질 없이 연속
  const DMAX = .04;
  function limBend(rb, i, d) { const lo = Math.max(-mb[i], rb[i] - DMAX), hi = Math.min(mb[i], rb[i] + DMAX); d = d < lo ? lo : d > hi ? hi : d; rb[i] = d; return d; }

  // ── FABRIK (체인 0..KK).
  //  후진: 목표→루트, 링크 길이 유지 + 인접 링크 각 클램프 / 전진: 루트 고정, 각도 클램프(첫 링크는 몸통 방사 방향 대비).
  //  앞쪽 반복은 호 사전(prior)으로 굴곡을 고르게 분배하고, 마지막 2회는 순수 FABRIK 로 팁을 목표에 맞춘다. 루트 쪽 굴곡이 한계에 몰릴 때만 활 방향(bow)은 K 목표 단계에서 히스테리시스로 결정.
  function solve(arm, tx, ty, ang0, iters) {
    const p = arm.p, rx = p[0], ry = p[1], rb = arm.rb;
    if (!arm.rbInit) { let pv = ang0; for (let i = 0; i < KK; i++) { const a = Math.atan2(p[2 * i + 3] - p[2 * i + 1], p[2 * i + 2] - p[2 * i]); rb[i] = clamp(wrap(a - pv), -mb[i], mb[i]); pv = a; } arm.rbInit = true; }
    const dx = tx - rx, dy = ty - ry, dist = Math.hypot(dx, dy);
    const angT = Math.atan2(dy, dx);
    if (dist >= Lp * .9995) {                       // 도달 불가: 목표 방향으로 직선 펴기(각도 클램프는 유지)
      let prev = ang0;
      for (let i = 0; i < KK; i++) {
        const d = limBend(rb, i, wrap(angT - prev)); const a = prev + d;
        p[2 * i + 2] = p[2 * i] + Math.cos(a) * lens[i]; p[2 * i + 3] = p[2 * i + 1] + Math.sin(a) * lens[i]; prev = a;
      }
      return;
    }
    const pr = arcPrior(dist, arm.bow, angT, ang0);
    const beta = pr.beta, rel0 = pr.rel0, sgn = arm.bow, eps = .12 * k;
    for (let it = 0; it < iters; it++) {
      p[2 * KK] = tx; p[2 * KK + 1] = ty;
      let nextRev = 0;
      for (let i = KK - 1; i >= 0; i--) {                       // 후진
        let a = Math.atan2(p[2 * i + 1] - p[2 * i + 3], p[2 * i] - p[2 * i + 2]);
        if (i < KK - 1) a = nextRev + clamp(wrap(a - nextRev), -mb[i + 1], mb[i + 1]);
        p[2 * i] = p[2 * i + 2] + Math.cos(a) * lens[i]; p[2 * i + 1] = p[2 * i + 3] + Math.sin(a) * lens[i]; nextRev = a;
      }
      p[0] = rx; p[1] = ry;
      let prev = ang0; const wp = it < iters - 2 ? .8 : 0;
      for (let i = 0; i < KK; i++) {                            // 전진
        let a = Math.atan2(p[2 * i + 3] - p[2 * i + 1], p[2 * i + 2] - p[2 * i]);
        if (wp) a += wp * wrap(prev + (i === 0 ? rel0 : sgn * beta) - a);
        const d = it === iters - 1 ? limBend(rb, i, wrap(a - prev)) : clamp(wrap(a - prev), -mb[i], mb[i]); a = prev + d;
        p[2 * i + 2] = p[2 * i] + Math.cos(a) * lens[i]; p[2 * i + 3] = p[2 * i + 1] + Math.sin(a) * lens[i]; prev = a;
      }
    }
  }

  // K 목표의 닫힌형 해: 호로 휜 체인의 끝 접선은 현(chord) 방향에서 δ(dK)=bow·β·(KK-1)-φ 만큼 돌아가 있다(호 사전이 수렴해와 정확히 일치).
  // P-뿌리 = dK·e(angK) + R(angK+δ)·A  →  회전 불변이라 |q|² = (dK+A'x)² + A'y² 를 dK 에 대해 이분법으로 풀고, angK 는 잔여 각으로 구한다.
  const kOut = { x: 0, y: 0, rel0: 0 };
  function kSolve(arm, px, py, sg) {
    const rx = arm.ax, ry = arm.ay, qx = px - rx, qy = py - ry, dq = Math.hypot(qx, qy), angq = Math.atan2(qy, qx);
    tailAnchor(arm.side, arm.cg, tmpA);
    const Ax = tmpA.x, Ay = tmpA.y;
    let lo = minK, hi = Lp * .9995, rax = 0, ray = 0;
    const evalK = dK => { arcPrior(dK, sg, 0, 0); const dl = sg * arcTmp.beta * (KK - 1) - arcTmp.phi, c = Math.cos(dl), s2 = Math.sin(dl); rax = c * Ax - s2 * Ay; ray = s2 * Ax + c * Ay; return Math.hypot(dK + rax, ray) - dq; };
    let dK;
    if (evalK(hi) < 0) dK = hi; else if (evalK(lo) > 0) dK = lo;
    else { for (let it = 0; it < 12; it++) { const m = (lo + hi) * .5; if (evalK(m) > 0) hi = m; else lo = m; } dK = (lo + hi) * .5; }
    evalK(dK);
    const aK = angq - Math.atan2(ray, dK + rax);
    kOut.x = rx + Math.cos(aK) * dK; kOut.y = ry + Math.sin(aK) * dK;
    kOut.rel0 = wrap(aK - arcTmp.phi - arm.aa);
    return kOut;
  }

  // 꼬리 FK: (1-ce)·유휴파동·(1-.85h) + ce·side·θcurl 를 누적 회전
  function tailFK(arm) {
    const p = arm.p;
    let a = Math.atan2(p[2 * KK + 1] - p[2 * KK - 1], p[2 * KK] - p[2 * KK - 2]);
    const wk = (1 - arm.cg) * (1 - .85 * arm.h);
    for (let j = KK; j < NL; j++) {
      a += wk * arm.ib[j] + arm.cg * arm.side * thc[j];
      p[2 * j + 2] = p[2 * j] + Math.cos(a) * lens[j]; p[2 * j + 3] = p[2 * j + 1] + Math.sin(a) * lens[j];
    }
  }

  // ── 먹이 수명주기(자동 시나리오): gone → free → held → carry → eat → gone
  function spawnPrey() {
    let best = null;
    for (let tr = 0; tr < 28; tr++) {
      const ang = portrait ? rnd() * TAU : (rnd() < .8 ? (rnd() * 2 - 1) * 2.0 : PI + (rnd() * 2 - 1) * .9);
      const D = (.62 + .3 * rnd()) * Lreach;
      const x = home.x + Math.cos(ang) * D, y = home.y + Math.sin(ang) * D;
      if (x < W * .07 || x > W * .95 || y < H * .13 || y > H * .87) continue;
      if (Math.hypot(x - prey.bx, y - prey.by) < 70 * k) continue;
      best = { x, y }; break;
    }
    if (!best) best = { x: home.x - Lreach * .55, y: home.y + (rnd() - .5) * H * .3 };
    prey.bx = best.x; prey.by = best.y; prey.x = prey.vx = best.x; prey.y = prey.vy = best.y;
    prey.st = 'free'; prey.t = 0; prey.scale = 0; prey.grabT = 0; prey.rot = rnd() * TAU; stats.spawned++;
  }
  function lifecycle(dt) {
    prey.rot += dt * .5;
    if (prey.st === 'gone') { prey.wait -= dt; if (prey.wait <= 0) spawnPrey(); return; }
    if (prey.st === 'free') {
      prey.t += dt; prey.scale = Math.min(1, prey.scale + dt * 2.2);
      prey.x = prey.vx = prey.bx + Math.sin(prey.t * 1.7) * 1.4 * k; prey.y = prey.vy = prey.by + Math.cos(prey.t * 1.3) * 1.8 * k;
      let n = 0;
      for (const a of arms) if (a.ce > .7 && Math.hypot(a.cx - prey.x, a.cy - prey.y) < 30 * k) n++;
      prey.grabT = n ? prey.grabT + dt : Math.max(0, prey.grabT - dt);
      if (prey.grabT > .45) { prey.st = 'held'; prey.holdT = 0; prey.sx = prey.x; prey.sy = prey.y; }
      else if (prey.t > 16) { prey.st = 'gone'; prey.wait = .2; }       // 못 잡으면 재시드
    } else if (prey.st === 'held') {
      prey.holdT += dt;
      if (prey.holdT > 1.7) {
        prey.st = 'carry'; prey.carryT = 0; prey.sx = prey.x; prey.sy = prey.y;
        const dx = prey.sx - body.x, dy = prey.sy - body.y, d = Math.hypot(dx, dy) || 1, dc = Math.min(d, .62 * Lp);
        prey.ex = body.x + dx / d * dc; prey.ey = body.y + dy / d * dc;
      }
    } else if (prey.st === 'carry') {
      prey.carryT += dt; const u = clamp(prey.carryT / 1.6, 0, 1), e = u * u * (3 - 2 * u);
      prey.x = lerp(prey.sx, prey.ex, e); prey.y = lerp(prey.sy, prey.ey, e);
      if (u >= 1) { prey.st = 'eat'; prey.eatT = 0; }
    } else if (prey.st === 'eat') {
      prey.eatT += dt; prey.scale = Math.max(0, 1 - prey.eatT / .5);
      if (prey.eatT >= .55) { prey.st = 'gone'; prey.wait = 1.3 + rnd() * 1.1; stats.eaten++; }
    }
  }

  const tmpA = { x: 0, y: 0 };
  const order = arms.map((_, i) => i);

  function step(dt, inp) {
    o.t += dt; const t = o.t;
    const user = !!(inp && inp.active);
    let P = null, gaze = null;
    if (user) {
      gaze = { x: inp.x, y: inp.y };
      if (Math.hypot(inp.x - body.x, inp.y - body.y) > 1.55 * Rb) P = gaze;
      if (prey.st === 'held' || prey.st === 'carry') { prey.st = 'free'; prey.grabT = 0; prey.t = 0; }
      prey.rot += dt * .5;
    } else {
      lifecycle(dt);
      if (prey.st === 'free' || prey.st === 'held' || prey.st === 'carry') P = { x: prey.x, y: prey.y };
      gaze = P;
    }

    // 몸통: 팔이 뻗는 방향으로 느리게 추종(스프링 감쇠)
    const hx = home.x + Math.sin(t * .31) * 5 * k, hy = home.y + Math.sin(t * .23 + 1) * 4 * k;
    let ox = 0, oy = 0;
    if (P) { ox = .3 * (P.x - hx); oy = .3 * (P.y - hy); const m = Math.hypot(ox, oy), lim = 40 * k; if (m > lim) { ox *= lim / m; oy *= lim / m; } }
    const bx0 = body.x, by0 = body.y;
    body.vx += (3.6 * (hx + ox - body.x) - 2.7 * body.vx) * dt; body.vy += (3.6 * (hy + oy - body.y) - 2.7 * body.vy) * dt;
    body.x += body.vx * dt; body.y += body.vy * dt;
    const ddx = body.x - bx0, ddy = body.y - by0;
    body.breathe = 1 + .025 * Math.sin(t * 2.2);
    // 얼굴 방향 · 몸통 회전
    let faceT;
    if (gaze && Math.hypot(gaze.x - body.x, gaze.y - body.y) > .8 * Rb) faceT = Math.atan2(gaze.y - body.y, gaze.x - body.x); else faceT = .15 + .5 * Math.sin(t * .23);
    body.fv += (4.5 * wrap(faceT - body.face) - 3.8 * body.fv) * dt; body.face += body.fv * dt;
    body.pv += (1.0 * (.3 * wrap(body.face) - body.psi) - 1.6 * body.pv) * dt; body.psi += body.pv * dt;
    // 눈: 시선 · 깜빡임
    const gt = gaze ? Math.atan2(gaze.y - body.y, gaze.x - body.x) : body.face, gd = gaze ? clamp(Math.hypot(gaze.x - body.x, gaze.y - body.y) / (4 * Rb), .2, 1) : .3;
    eye.gx += (Math.cos(gt) * gd - eye.gx) * Math.min(1, dt * 7); eye.gy += (Math.sin(gt) * gd - eye.gy) * Math.min(1, dt * 7);
    eye.blinkIn -= dt;
    if (eye.blinkT < 0 && eye.blinkIn <= 0) eye.blinkT = 0;
    if (eye.blinkT >= 0) { eye.blinkT += dt / .17; eye.blink = Math.sin(clamp(eye.blinkT, 0, 1) * PI); if (eye.blinkT >= 1) { eye.blinkT = -1; eye.blink = 0; eye.blinkIn = 2.4 + rnd() * 3; } }

    // 앵커 · 유휴 포즈 · 순위
    const th = P ? Math.atan2(P.y - body.y, P.x - body.x) : 0;
    for (const arm of arms) {
      const aa = arm.phi + body.psi, rr = Rb * .74 * body.breathe;
      arm.ax = body.x + Math.cos(aa) * rr; arm.ay = body.y + Math.sin(aa) * rr; arm.aa = aa;
      const p = arm.p;
      if (arm.init !== true) {
        idlePose(arm, t, arm.ax, arm.ay, aa); p.set(arm.ip); arm.tk.x = arm.ip[2 * KK]; arm.tk.y = arm.ip[2 * KK + 1]; arm.init = true;
      } else for (let j = 0; j < NJ; j++) { p[2 * j] += ddx; p[2 * j + 1] += ddy; }
      p[0] = arm.ax; p[1] = arm.ay;
      idlePose(arm, t, arm.ax, arm.ay, aa);
      arm.score = P ? Math.abs(wrap(th - aa)) - (arm.h > .5 ? .18 : 0) : 9;
    }
    order.sort((a, b) => arms[a].score - arms[b].score);
    for (let r = 0; r < NA; r++) arms[order[r]].rank = r;

    // 팔별: 반응 지연(h 상승 τ, aim 저역통과 τ) → K 목표 → 목표 스프링
    for (const arm of arms) {
      const r = arm.rank;
      // 팔 뿌리~먹이 거리: 클램프로 접을 수 없을 만큼 가까우면 주공격에서 빠지고(유휴 파동), 꼬리 길이만큼 가까우면 꼬리를 말아 도달거리를 줄인다
      const dRoot = P ? Math.hypot(P.x - arm.ax, P.y - arm.ay) : 1e9;
      const hT = P ? HT[r] * smooth((dRoot - 30 * k) / (20 * k)) : 0;
      arm.cr += (smooth((minK + Lt - dRoot) / (Lt - 20 * k)) - arm.cr) * (1 - Math.exp(-dt / .18));
      arm.cg = Math.max(arm.ce, arm.cr);
      const tau = hT > arm.h ? .10 + .12 * r + (arm.idx % 3) * .03 : .7;
      arm.h += (hT - arm.h) * (1 - Math.exp(-dt / tau));
      if (P) { const f = 1 - Math.exp(-dt / (.07 + .07 * r + arm.tauA)); arm.aim.x += (P.x - arm.aim.x) * f; arm.aim.y += (P.y - arm.aim.y) * f; }
      const p = arm.p, rx = arm.ax, ry = arm.ay;
      let kx = arm.ip[2 * KK], ky = arm.ip[2 * KK + 1];
      if (P && arm.h > .002) {
        const ux = arm.aim.x - rx, uy = arm.aim.y - ry, ud = Math.hypot(ux, uy) || 1;
        const px = arm.aim.x - uy / ud * arm.rhoJ * (r < 3 ? 1 : 0), py = arm.aim.y + ux / ud * arm.rhoJ * (r < 3 ? 1 : 0);
        const res = kSolve(arm, px, py, arm.bow);
        if (arm.h > .3 && Math.abs(res.rel0) > .7) {            // 활(bow) 방향: 뿌리 굴곡이 한계에 몰릴 때만, 충분히 이득일 때만 전환(히스테리시스)
          const x0 = res.x, y0 = res.y, r0 = res.rel0;
          const alt = kSolve(arm, px, py, -arm.bow);
          if (Math.abs(alt.rel0) < Math.abs(r0) - .35) arm.bow = -arm.bow; else { res.x = x0; res.y = y0; res.rel0 = r0; }
        }
        const hx2 = res.x, hy2 = res.y;
        kx = lerp(kx, hx2, arm.h); ky = lerp(ky, hy2, arm.h);
      }
      arm.kt.x = kx; arm.kt.y = ky;
    }
    // 팔끝 간 최소거리 반발(교차 방지)
    const dmin = 15 * k;
    for (let i = 0; i < NA; i++) for (let j = i + 1; j < NA; j++) {
      const A = arms[i], B = arms[j]; if (A.h < .3 && B.h < .3) continue;
      let dx = B.kt.x - A.kt.x, dy = B.kt.y - A.kt.y; const d = Math.hypot(dx, dy);
      if (d < dmin) { if (d < 1e-6) { dx = 1; dy = 0; } else { dx /= d; dy /= d; } const m = (dmin - d) * .5; A.kt.x -= dx * m; A.kt.y -= dy * m; B.kt.x += dx * m; B.kt.y += dy * m; }
    }
    // 스프링(임계감쇠) + 속도 제한 → IK → 꼬리 FK → curl/grip 갱신
    const W2 = 6.5, vmax = 320 * k;
    for (const arm of arms) {
      const tk = arm.tk, tv = arm.tv;
      tv.x += (W2 * W2 * (arm.kt.x - tk.x) - 2 * W2 * tv.x) * dt; tv.y += (W2 * W2 * (arm.kt.y - tk.y) - 2 * W2 * tv.y) * dt;
      const sp = Math.hypot(tv.x, tv.y); if (sp > vmax) { tv.x *= vmax / sp; tv.y *= vmax / sp; }
      tk.x += tv.x * dt; tk.y += tv.y * dt;
      solve(arm, tk.x, tk.y, arm.aa, 4);
      tailFK(arm);
      const p = arm.p;
      if (!Number.isFinite(p[2 * NJ - 1] + p[2 * NJ - 2])) { p.set(arm.ip); tk.x = arm.ip[2 * KK]; tk.y = arm.ip[2 * KK + 1]; tv.x = tv.y = 0; stats.resets++; }
      let sx = 0, sy = 0; for (let j = KK; j < NJ; j++) { sx += p[2 * j]; sy += p[2 * j + 1]; }
      arm.cx = sx / (NJ - KK); arm.cy = sy / (NJ - KK);
      // curl 구동: 팔끝(말리기 전)/꼬리 무게중심(말린 뒤)과 먹이의 거리 → 연속 함수(히스테리시스 없음) + 1차 지연. 부정귀환이라 진동하지 않는다
      let ct = 0;
      if (P && arm.h > .55) {
        const dtip = Math.hypot(p[2 * NJ - 2] - P.x, p[2 * NJ - 1] - P.y), dce = Math.hypot(arm.cx - P.x, arm.cy - P.y);
        ct = smooth((34 * k - lerp(dtip, dce, arm.cg)) / (23 * k));
      }
      arm.c += (ct - arm.c) * (1 - Math.exp(-dt / (ct > arm.c ? .35 : .5))); arm.ce = smooth(arm.c);
      arm.gr = clamp(arm.gr + (arm.ce > .6 ? .55 : -1) * dt, 0, 1);
    }
  }

  // ── 렌더용 기하: Catmull-Rom 중심선 → 접선/법선 → 곡률 제한 반경 → 좌/우 오프셋 윤곽 폴리곤 + 흡반
  function prepare() {
    for (const arm of arms) buildGeom(arm);
  }
  function buildGeom(arm) {
    const g = arm.g, p = arm.p; let n = 0;
    for (let i = 0; i < NL; i++) {
      const i0 = i > 0 ? i - 1 : 0, i3 = i + 2 < NJ ? i + 2 : NJ - 1;
      const x0 = p[2 * i0], y0 = p[2 * i0 + 1], x1 = p[2 * i], y1 = p[2 * i + 1], x2 = p[2 * i + 2], y2 = p[2 * i + 3], x3 = p[2 * i3], y3 = p[2 * i3 + 1];
      for (let m = 0; m < SUB; m++) {
        const u = m / SUB, u2 = u * u, u3 = u2 * u;
        g.qx[n] = .5 * (2 * x1 + (x2 - x0) * u + (2 * x0 - 5 * x1 + 4 * x2 - x3) * u2 + (3 * x1 - x0 - 3 * x2 + x3) * u3);
        g.qy[n] = .5 * (2 * y1 + (y2 - y0) * u + (2 * y0 - 5 * y1 + 4 * y2 - y3) * u2 + (3 * y1 - y0 - 3 * y2 + y3) * u3);
        g.r[n] = lerp(rad[i], rad[i + 1], u); n++;
      }
    }
    g.qx[n] = p[2 * NJ - 2]; g.qy[n] = p[2 * NJ - 1]; g.r[n] = rad[NJ - 1]; n++;
    g.s[0] = 0; for (let i = 1; i < n; i++) g.s[i] = g.s[i - 1] + Math.hypot(g.qx[i] - g.qx[i - 1], g.qy[i] - g.qy[i - 1]);
    for (let i = 0; i < n; i++) {
      const a = i > 0 ? i - 1 : 0, b = i < n - 1 ? i + 1 : n - 1;
      let tx = g.qx[b] - g.qx[a], ty = g.qy[b] - g.qy[a]; const l = Math.hypot(tx, ty) || 1; g.tx[i] = tx / l; g.ty[i] = ty / l;
    }
    // 곡률 제한: 반경이 곡률반경의 .82 를 넘지 않게 → 안쪽 오프셋 곡선이 뒤집혀 꼬이지 않는다
    for (let i = 1; i < n - 1; i++) {
      const cr = g.tx[i - 1] * g.ty[i + 1] - g.ty[i - 1] * g.tx[i + 1], dt2 = g.tx[i - 1] * g.tx[i + 1] + g.ty[i - 1] * g.ty[i + 1];
      const ang = Math.abs(Math.atan2(cr, dt2)), ds = g.s[i + 1] - g.s[i - 1];
      if (ang > 1e-4) { const rmax = .82 * ds / ang; if (g.r[i] > rmax) g.r[i] = rmax; }
    }
    const poly = g.poly; let q = 0;
    for (let i = 0; i < n; i++) { poly[q++] = g.qx[i] - g.ty[i] * g.r[i]; poly[q++] = g.qy[i] + g.tx[i] * g.r[i]; }
    const e = n - 1;
    for (let c = 1; c <= 3; c++) {                       // 끝 둥근 캡
      const a = c * PI / 4, cs = Math.cos(a), sn = Math.sin(a);
      const nx = -g.ty[e], ny = g.tx[e];
      poly[q++] = g.qx[e] + (nx * cs + g.tx[e] * sn) * g.r[e]; poly[q++] = g.qy[e] + (ny * cs + g.ty[e] * sn) * g.r[e];
    }
    for (let i = n - 1; i >= 0; i--) { poly[q++] = g.qx[i] + g.ty[i] * g.r[i]; poly[q++] = g.qy[i] - g.tx[i] * g.r[i]; }
    g.np = q / 2; g.n = n;
    // 등쪽 하이라이트 라인(흡반 반대편)
    for (let i = 0; i < n; i++) { g.hi[2 * i] = g.qx[i] + g.ty[i] * g.r[i] * .5 * arm.side; g.hi[2 * i + 1] = g.qy[i] - g.tx[i] * g.r[i] * .5 * arm.side; }
    // 흡반: 아랫면(side 쪽)에 호장 비례 배치. 끝에서 뿌리 쪽으로 순서대로 활성
    const S = g.s[n - 1]; let ix = 0;
    for (let m = 0; m < SUCK; m++) {
      const f = .14 + .82 * (m / (SUCK - 1)), target = f * S;
      while (ix < n - 2 && g.s[ix + 1] < target) ix++;
      const u = clamp((target - g.s[ix]) / ((g.s[ix + 1] - g.s[ix]) || 1), 0, 1);
      const x = lerp(g.qx[ix], g.qx[ix + 1], u), y = lerp(g.qy[ix], g.qy[ix + 1], u), r = lerp(g.r[ix], g.r[ix + 1], u);
      const tx = lerp(g.tx[ix], g.tx[ix + 1], u), ty = lerp(g.ty[ix], g.ty[ix + 1], u);
      const act = smooth((arm.gr * 12 - (SUCK - 1 - m)) / 4);
      const off = .46 * r * arm.side;
      g.sk[4 * m] = x - ty * off; g.sk[4 * m + 1] = y + tx * off; g.sk[4 * m + 2] = r * (.4 + .2 * act); g.sk[4 * m + 3] = act;
    }
  }

  const o = { W, H, k, Rb, home, lens, mb, rad, cum, total, Lp, Lt, minK, minChord, arms, body, prey, eye, stats, t: 0, step, prepare, solve, tailFK, KK, NJ, NL, NA, SUCK, NS };
  // 초기 포즈를 한 번 적용해 첫 프레임부터 팔이 펼쳐져 있게 한다
  for (let i = 0; i < 90; i++) step(1 / 60, null);
  return o;
}

// ─────────────────────────────── Canvas2D 렌더
export function drawOctopus(g, o, time) {
  const { W, H, k, Rb, body, prey, arms } = o;
  g.clearRect(0, 0, W, H);
  g.lineJoin = 'round'; g.lineCap = 'round';
  // 뒤쪽 층(홀수 팔: 어둡고 반투명) → 먹이 → 앞쪽 층(짝수 팔) → 몸통
  for (let a = 1; a < o.NA; a += 2) drawArm(g, o, arms[a], false);
  drawPrey(g, o, time);
  for (let a = 0; a < o.NA; a += 2) drawArm(g, o, arms[a], true);
  drawBody(g, o, time);
}

function armPath(poly, np) {
  const pa = new Path2D(); pa.moveTo(poly[0], poly[1]);
  for (let i = 1; i < np; i++) pa.lineTo(poly[2 * i], poly[2 * i + 1]);
  pa.closePath(); return pa;
}
function drawArm(g, o, arm, front) {
  const k = o.k, gg = arm.g, p = arm.p;
  const pa = armPath(gg.poly, gg.np);
  g.save(); g.translate(2.2 * k, 3.4 * k); g.fillStyle = front ? 'rgba(1,12,24,.32)' : 'rgba(1,12,24,.2)'; g.fill(pa); g.restore();
  g.lineWidth = 6 * k; g.strokeStyle = front ? 'rgba(255,118,78,.15)' : 'rgba(255,118,78,.07)'; g.stroke(pa);
  const gr = g.createLinearGradient(p[0], p[1], p[2 * o.NJ - 2], p[2 * o.NJ - 1]);
  if (front) { gr.addColorStop(0, '#ff4a36'); gr.addColorStop(.55, '#ff6d42'); gr.addColorStop(1, '#ffb25a'); }
  else { gr.addColorStop(0, '#b92f33'); gr.addColorStop(.6, '#df5238'); gr.addColorStop(1, '#f48a4a'); }
  g.globalAlpha = front ? .97 : .88; g.fillStyle = gr; g.fill(pa); g.globalAlpha = 1;
  // 등쪽 하이라이트
  const hp = new Path2D(); hp.moveTo(gg.hi[0], gg.hi[1]);
  for (let i = 1; i < gg.n - 2; i++) hp.lineTo(gg.hi[2 * i], gg.hi[2 * i + 1]);
  g.lineWidth = 1.3 * k; g.strokeStyle = front ? 'rgba(255,226,196,.42)' : 'rgba(255,200,160,.22)'; g.stroke(hp);
  // 흡반 3단계(비활성 · 부착 중 · 부착)
  const sk = gg.sk;
  const p0 = new Path2D(), p1 = new Path2D(), p2 = new Path2D(), p3 = new Path2D();
  for (let m = 0; m < o.SUCK; m++) {
    const x = sk[4 * m], y = sk[4 * m + 1], r = sk[4 * m + 2], act = sk[4 * m + 3];
    if (r < .55) continue;
    const pp = act < .15 ? p0 : act < .7 ? p1 : p2;
    pp.moveTo(x + r, y); pp.arc(x, y, r, 0, TAU);
    if (act >= .7 && r > 1.3) { p3.moveTo(x + r * .42, y); p3.arc(x, y, r * .42, 0, TAU); }
  }
  g.fillStyle = front ? 'rgba(255,224,200,.55)' : 'rgba(255,214,184,.34)'; g.fill(p0);
  g.fillStyle = 'rgba(255,238,222,.86)'; g.fill(p1);
  g.fillStyle = '#fff6ec'; g.fill(p2); g.lineWidth = 1 * k; g.strokeStyle = 'rgba(255,70,110,.85)'; g.stroke(p2);
  g.fillStyle = 'rgba(190,34,64,.8)'; g.fill(p3);
}
function drawPrey(g, o, time) {
  const pr = o.prey, k = o.k;
  if (pr.st === 'gone' || pr.scale <= .01) return;
  let x = pr.x, y = pr.y;
  if (pr.st === 'held' || pr.st === 'carry') {          // 감긴 꼬리들의 무게중심 쪽으로 시각 보정(감싸 쥔 느낌)
    let sx = 0, sy = 0, w = 0; for (const a of o.arms) if (a.ce > .3) { sx += a.cx * a.ce; sy += a.cy * a.ce; w += a.ce; }
    if (w > 0) { pr.vx += (sx / w - pr.vx) * .2; pr.vy += (sy / w - pr.vy) * .2; x = lerp(pr.x, pr.vx, .7); y = lerp(pr.y, pr.vy, .7); }
  }
  const s = pr.scale * k * 1.35, pulse = .5 + .5 * Math.sin(time * 4);
  g.save(); g.translate(x, y);
  g.strokeStyle = `rgba(150,255,235,${.12 + .12 * pulse})`; g.lineWidth = 1.2 * k; g.beginPath(); g.arc(0, 0, (11 + 3 * pulse) * s, 0, TAU); g.stroke();
  if (pr.st === 'eat') { g.strokeStyle = `rgba(255,236,200,${.5 * pr.scale})`; g.beginPath(); g.arc(0, 0, (11 + (1 - pr.scale) * 30) * k, 0, TAU); g.stroke(); }
  g.rotate(pr.rot * .6);
  // 작은 새우: 호를 따라 줄어드는 마디 + 꼬리 + 더듬이
  g.fillStyle = '#ffd2a4';
  for (let i = 0; i < 5; i++) { const a = -1.1 + i * .55, rr = (3.4 - i * .42) * s; g.beginPath(); g.arc(Math.cos(a) * 7 * s, Math.sin(a) * 7 * s + 2 * s, Math.max(rr, .4), 0, TAU); g.fill(); }
  g.strokeStyle = '#ffb27c'; g.lineWidth = 1.1 * k * pr.scale; g.beginPath();
  g.moveTo(Math.cos(1.1) * 7 * s, Math.sin(1.1) * 7 * s + 2 * s); g.lineTo(Math.cos(1.1) * 7 * s + 3 * s, Math.sin(1.1) * 7 * s + 4.5 * s);
  g.moveTo(Math.cos(-1.1) * 7 * s, Math.sin(-1.1) * 7 * s + 2 * s); g.lineTo(-1 * s, -12 * s); g.moveTo(Math.cos(-1.1) * 7 * s, Math.sin(-1.1) * 7 * s + 2 * s); g.lineTo(5 * s, -11 * s); g.stroke();
  g.fillStyle = '#1b0f12'; g.beginPath(); g.arc(Math.cos(-1.1) * 7 * s + 1 * s, Math.sin(-1.1) * 7 * s + 1 * s, .8 * s, 0, TAU); g.fill();
  g.restore();
}
function drawBody(g, o, time) {
  const { body, Rb, k, eye } = o;
  const F = { x: Math.cos(body.face), y: Math.sin(body.face) }, Pp = { x: -F.y, y: F.x };
  const R = Rb * body.breathe;
  // 몸통 바닥 그림자
  g.fillStyle = 'rgba(1,12,24,.25)'; g.beginPath(); g.arc(body.x + 3 * k, body.y + 5 * k, R, 0, TAU); g.fill();
  const mc = { x: body.x - F.x * .62 * R, y: body.y - F.y * .62 * R };
  const gr = g.createRadialGradient(body.x - .35 * R, body.y - .45 * R, R * .1, body.x, body.y, R * 1.7);
  gr.addColorStop(0, '#ffa273'); gr.addColorStop(.45, '#ff5d3f'); gr.addColorStop(1, '#c82f34');
  g.fillStyle = 'rgba(255,100,70,.16)'; g.lineWidth = 7 * k; g.strokeStyle = 'rgba(255,110,76,.16)';
  const bp = new Path2D(); bp.moveTo(body.x + R, body.y); bp.arc(body.x, body.y, R, 0, TAU);
  bp.moveTo(mc.x + R * .96, mc.y); bp.ellipse(mc.x, mc.y, R * 1.02, R * .86, body.face, 0, TAU);
  g.stroke(bp); g.fillStyle = gr; g.fill(bp);
  // 색소포 점무늬
  for (let i = 0; i < 16; i++) {
    const a = i * 2.399 + body.psi, d = (.15 + .85 * ((i * .618) % 1)) * R * 1.05;
    const sx = mc.x * .35 + body.x * .65 + Math.cos(a) * d, sy = mc.y * .35 + body.y * .65 + Math.sin(a) * d;
    g.fillStyle = i % 3 ? `rgba(150,16,50,${.14 + .12 * Math.sin(time * 1.3 + i)})` : `rgba(255,214,170,${.2 + .14 * Math.sin(time * 1.1 + i * 2)})`;
    g.beginPath(); g.arc(sx, sy, (1.6 + (i % 4) * .7) * k, 0, TAU); g.fill();
  }
  // 눈 2개: 소켓 · 안구 · 홍채 · 가로 슬릿 동공 · 눈꺼풀(blink)
  for (let s = -1; s <= 1; s += 2) {
    const ex = body.x + F.x * .44 * R + Pp.x * s * .44 * R, ey = body.y + F.y * .44 * R + Pp.y * s * .44 * R, er = .22 * R;
    g.fillStyle = '#b72b30'; g.beginPath(); g.arc(ex, ey, er * 1.25, 0, TAU); g.fill();
    const open = 1 - eye.blink * .96;
    g.fillStyle = '#fff1cf'; g.beginPath(); g.ellipse(ex, ey, er, Math.max(er * open, .3), 0, 0, TAU); g.fill();
    const gx = ex + eye.gx * er * .38, gy = ey + eye.gy * er * .38;
    g.fillStyle = '#ffb12e'; g.beginPath(); g.ellipse(gx, gy, er * .66, Math.max(er * .66 * open, .25), 0, 0, TAU); g.fill();
    g.fillStyle = '#0a1220'; g.beginPath(); g.ellipse(gx, gy, er * .5, Math.max(er * .13 * open, .2), 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(gx - er * .22, gy - er * .26 * open, er * .12, 0, TAU); g.fill();
  }
}

// ─────────────────────────────── 섹션 init
export default function init(root, ctx) {
  const cv = root.querySelector('.s172__cv');
  const bgA = root.querySelector('.s172__giant:not(.s172__giant--line)'), bgB = root.querySelector('.s172__giant--line');
  let g = null;
  try { g = cv && cv.getContext('2d'); } catch (e) { g = null; }
  if (!g) { root.classList.add('is-static'); return () => {}; }

  let oct = null, W = 0, H = 0, cssW = 1, cssH = 1;
  const flakes = [];
  let seed = 7;
  const fr = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) flakes.push({ x: fr(), y: fr(), z: .3 + fr() * .7, p: fr() * 6 });
  const build = () => {
    const r = root.getBoundingClientRect();
    cssW = Math.max(1, r.width); cssH = Math.max(1, r.height);
    const sc = cssW > 900 ? .5 : .6;
    W = Math.max(160, Math.round(cssW * sc)); H = Math.max(120, Math.round(cssH * sc));
    cv.width = W; cv.height = H;
    oct = createOctopus(W, H, { sway: ctx.reduced ? .5 : 1 });
  };
  build();
  let rt = 0;
  const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => { if (Math.abs(root.clientWidth - cssW) > 2 || Math.abs(root.clientHeight - cssH) > 2) build(); }, 120); });
  ro.observe(root);

  // 타이틀 한 줄씩 마스크 리빌(보조 연출)
  const lines = root.querySelectorAll('.s172__ln > span');
  const intro = lines.length ? gsap.from(lines, { yPercent: 108, duration: 1.3, ease: 'expo.out', stagger: .12, delay: .1 }) : null;

  let visible = true, docVis = !document.hidden;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { docVis = !document.hidden; last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  const mouse = ctx.mouse; let lmx = mouse.x, lmy = mouse.y, lastMove = -1e9;
  const inp = { active: false, x: 0, y: 0 };
  const DT = 1 / 60;
  let last = performance.now(), acc = 0, lastDraw = 0, simT = 0;

  const off = ctx.tick(() => {
    const now = performance.now();
    let dt = (now - last) / 1000; last = now;
    if (!visible || !docVis || !oct) return;
    dt = Math.min(dt, .1) * (ctx.reduced ? .6 : 1);
    if (mouse.x !== lmx || mouse.y !== lmy) { lmx = mouse.x; lmy = mouse.y; lastMove = now; }
    const r = root.getBoundingClientRect();
    const inside = mouse.x >= r.left && mouse.x <= r.right && mouse.y >= r.top && mouse.y <= r.bottom;
    inp.active = inside && now - lastMove < 2200;            // 사용자가 움직이면 가상 포인터(먹이 시나리오)는 양보
    inp.x = (mouse.x - r.left) * (W / r.width); inp.y = (mouse.y - r.top) * (H / r.height);
    acc += dt; let n = 0;
    while (acc >= DT && n < 6) { oct.step(DT, inp); acc -= DT; n++; simT += DT; }
    if (acc > DT * 6) acc = 0;
    if (now - lastDraw >= 40) {                               // 렌더 ≤ 25fps
      lastDraw = now;
      oct.prepare();
      // 배경 거대 타이포 패럴랙스(몸통과 반대 방향/같은 방향 → 앞·뒤 레이어 깊이)
      const dx = (oct.body.x - oct.home.x) / W * 60;
      if (bgA) bgA.style.transform = `translate3d(${(-dx).toFixed(1)}px,0,0)`;
      if (bgB) bgB.style.transform = `translate3d(${(dx * .8).toFixed(1)}px,0,0)`;
      drawFrame(simT);
    }
  });

  function drawFrame(time) {
    drawOctopus(g, oct, time);
    // 마린 스노우(몸 위에 얇게) — 한 번에 fillRect
    g.fillStyle = 'rgba(190,255,245,.3)';
    for (const f of flakes) {
      const x = ((f.x + Math.sin(time * .3 + f.p) * .012) % 1) * W, y = (((f.y - time * .012 * f.z) % 1) + 1) % 1 * H;
      const s = f.z > .7 ? 2 : 1; g.fillRect(x, y, s, s);
    }
    if (inp.active) {                                          // 사용자 포인터(먹이 역할) 표시 링
      g.strokeStyle = 'rgba(150,255,235,.45)'; g.lineWidth = 1.2; g.beginPath(); g.arc(inp.x, inp.y, 7 * oct.k, 0, TAU); g.stroke();
    }
  }
  oct.prepare(); drawFrame(0);

  return () => {
    off(); io.disconnect(); ro.disconnect(); clearTimeout(rt);
    document.removeEventListener('visibilitychange', onVis);
    if (intro) intro.kill();
  };
}
