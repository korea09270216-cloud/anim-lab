// 비가향 곡면 위의 글자 — 직접 짠 소프트웨어 3D 래스터(삼각형 + z-버퍼 + 구로 조명).
// 곡면은 (a,b) 매개. (a+2π, b) ≡ (a, flip(b)) 이므로 텍스처는 a 를 4π(두 바퀴)로 잡고, 법선 방향(앞/뒤)에 따라
// 앞면 = (a/4π, t), 뒷면 = ((a+2π)/4π, 1−t) 를 읽는다 → 한 바퀴 돌면 반대면의 글자로 이어진다.
const TAU = Math.PI * 2;

const SURF = {
  mobius: {
    nA: 200, nB: 14, b0: -.36, b1: .36, edge: true, bline: 0, flip: b => -b, tOf: b => (b + .36) / .72,
    pos(a, b) { const r = 1.05 + b * Math.cos(a / 2); return [r * Math.cos(a), r * Math.sin(a), b * Math.sin(a / 2)]; },
    tex: { w: 2240, h: 128 },
  },
  klein: {                                                    // 8자형 몰입(자기교차)
    nA: 160, nB: 56, b0: 0, b1: TAU, edge: false, bline: Math.PI / 2, flip: b => TAU - b, tOf: b => b / TAU,
    pos(a, b) {
      const ca = Math.cos(a / 2), sa = Math.sin(a / 2), q = 2 + ca * Math.sin(b) - sa * Math.sin(2 * b);
      return [.5 * q * Math.cos(a), .5 * q * Math.sin(a), .5 * (sa * Math.sin(b) + ca * Math.sin(2 * b))];
    },
    tex: { w: 2048, h: 512 },
  },
};

function normalAt(S, a, b) {
  const h = 1e-4, p1 = S.pos(a + h, b), p2 = S.pos(a - h, b), q1 = S.pos(a, b + h), q2 = S.pos(a, b - h);
  const da = [p1[0] - p2[0], p1[1] - p2[1], p1[2] - p2[2]], db = [q1[0] - q2[0], q1[1] - q2[1], q1[2] - q2[2]];
  const n = [da[1] * db[2] - da[2] * db[1], da[2] * db[0] - da[0] * db[2], da[0] * db[1] - da[1] * db[0]];
  const l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l];
}

function build(S) {
  const { nA, nB, b0, b1 } = S, nv = (nA + 1) * (nB + 1);
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), SS = new Float32Array(nv), TT = new Float32Array(nv);
  for (let i = 0; i <= nA; i++) for (let j = 0; j <= nB; j++) {
    const k = i * (nB + 1) + j, a = i / nA * TAU, b = b0 + (b1 - b0) * j / nB;
    const p = S.pos(a, b), n = normalAt(S, a, b);
    P.set(p, k * 3); N.set(n, k * 3); SS[k] = a / (2 * TAU); TT[k] = S.tOf(b);
  }
  const tri = new Int32Array(nA * nB * 6);
  let o = 0;
  for (let i = 0; i < nA; i++) for (let j = 0; j < nB; j++) {
    const v00 = i * (nB + 1) + j, v10 = (i + 1) * (nB + 1) + j, v01 = v00 + 1, v11 = v10 + 1;
    tri[o++] = v00; tri[o++] = v10; tri[o++] = v11; tri[o++] = v00; tri[o++] = v11; tri[o++] = v01;
  }
  return { S, nv, P, N, SS, TT, tri, CX: new Float32Array(nv), CY: new Float32Array(nv), CZ: new Float32Array(nv), CN: new Float32Array(nv * 3), SX: new Float32Array(nv), SY: new Float32Array(nv), SD: new Float32Array(nv), SI: new Float32Array(nv) };
}

const FONT = "800 %PX%px 'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
function makeTex(kind) {
  const { w, h } = SURF[kind].tex;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); if (!x) return { w, h, d: new Uint8Array(w * h) };
  x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  if (kind === 'mobius') {
    const txt = '한 면뿐인 띠 · 한 바퀴를 돌면 어느새 뒷면에 · 한 바퀴를 더 돌아야 제자리 ·';
    let px = 66; x.font = FONT.replace('%PX%', px);
    const mw = x.measureText(txt).width, avail = w - 60;
    if (mw > avail) px = Math.floor(px * avail / mw);
    x.font = FONT.replace('%PX%', px); x.fillText(txt, w / 2, h / 2 + 3);
  } else {
    const rows = [['안쪽이 곧 바깥쪽 · ', .17, 96], ['클라인 병 · 경계 없는 한 면 · ', .5, 150], ['스스로를 지나는 병 · ', .83, 96]];
    for (const [t, ry, px] of rows) {
      x.font = FONT.replace('%PX%', px); const tw = x.measureText(t).width, n = Math.max(1, Math.round(w / tw)), sx = w / (n * tw);
      x.save(); x.translate(0, h * ry); x.scale(sx, 1);
      for (let i = 0; i < n; i++) x.fillText(t, (i + .5) * tw, 0);
      x.restore();
    }
  }
  const im = x.getImageData(0, 0, w, h).data, d = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) d[i] = im[i * 4 + 3];
  return { w, h, d };
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s188__cv'), g = cv.getContext('2d');
  const chips = [...root.querySelectorAll('.s188__chip')], antEl = root.querySelector('[data-ant]'), dotEl = root.querySelector('.s188__dot');
  if (!g) return;
  let W = 800, H = 450, res = 1, img = null, buf = null, zb = null;
  const fit = () => {
    const b = root.getBoundingClientRect(), s = .56 * res;
    W = Math.max(320, Math.round(b.width * s)); H = Math.max(240, Math.round(b.height * s));
    cv.width = W; cv.height = H; img = g.createImageData(W, H); buf = new Uint32Array(img.data.buffer); zb = new Float32Array(W * H);
  };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(root);

  const cache = {};
  const get = k => cache[k] || (cache[k] = { m: build(SURF[k]), tex: makeTex(k) });
  let kind = 'mobius', cur = get(kind);

  let lastSwitch = performance.now(), userHold = 0;
  function setKind(k) {
    kind = k; cur = get(k); antV = 0; lastLap = -1;
    chips.forEach(c => c.classList.toggle('is-on', c.dataset.k === k));
    gsap.fromTo(cv, { opacity: 0 }, { opacity: 1, duration: .9, ease: 'expo.out' });
    lastSwitch = performance.now();
  }
  const chipFns = chips.map(c => { const f = () => { if (c.dataset.k !== kind) setKind(c.dataset.k); userHold = performance.now(); }; c.addEventListener('click', f); return f; });

  // 시점: 드래그로 회전 + 자동 회전
  let yaw = .5, elev = .62, vyaw = 0, velev = 0, drag = false, lx = 0, ly = 0, antV = 0, lastLap = -1;
  const onDown = e => { drag = true; lx = e.clientX; ly = e.clientY; userHold = performance.now(); };
  const onMove = e => { if (!drag) return; vyaw = (e.clientX - lx) * .008; velev = (e.clientY - ly) * .004; yaw += vyaw; elev = Math.max(.1, Math.min(1.45, elev + velev)); lx = e.clientX; ly = e.clientY; userHold = performance.now(); };
  const onUp = () => { drag = false; };
  cv.addEventListener('pointerdown', onDown); addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);

  let visible = true, last = performance.now(), acc = 0, t = 0, avg = 20, nf = 0;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; last = performance.now(); }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { last = performance.now(); };
  document.addEventListener('visibilitychange', onVis);

  const camD = 5.6, L = [.38, .72, .58];
  const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  let M = [1, 0, 0, 0, 1, 0, 0, 0, 1], F = 400, cx = 0, cy = 0;
  const tr = (p0, p1, p2) => [M[0] * p0 + M[1] * p1 + M[2] * p2, M[3] * p0 + M[4] * p1 + M[5] * p2, M[6] * p0 + M[7] * p1 + M[8] * p2];
  const project = (p) => { const c = tr(p[0], p[1], p[2]), d = camD - c[2], q = F / d; return [cx + c[0] * q, cy - c[1] * q, d, q]; };

  function render(m, tex) {
    const { nv, P, N, SS, TT, tri, CX, CY, CZ, CN, SX, SY, SD, SI } = m, S = m.S;
    buf.fill(0); zb.fill(1e9);
    for (let i = 0; i < nv; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      const X = M[0] * x + M[1] * y + M[2] * z, Y = M[3] * x + M[4] * y + M[5] * z, Z = M[6] * x + M[7] * y + M[8] * z;
      CX[i] = X; CY[i] = Y; CZ[i] = Z;
      const nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
      const NX = M[0] * nx + M[1] * ny + M[2] * nz, NY = M[3] * nx + M[4] * ny + M[5] * nz, NZ = M[6] * nx + M[7] * ny + M[8] * nz;
      CN[i * 3] = NX; CN[i * 3 + 1] = NY; CN[i * 3 + 2] = NZ;
      const d = camD - Z, q = F / d; SX[i] = cx + X * q; SY[i] = cy - Y * q; SD[i] = d;
      SI[i] = NX * L[0] + NY * L[1] + NZ * L[2];
    }
    const td = tex.d, tw = tex.w, th = tex.h, edge = S.edge;
    for (let ti = 0; ti < tri.length; ti += 3) {
      const i0 = tri[ti], i1 = tri[ti + 1], i2 = tri[ti + 2];
      const x0 = SX[i0], y0 = SY[i0], x1 = SX[i1], y1 = SY[i1], x2 = SX[i2], y2 = SY[i2];
      const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
      if (area > -.02 && area < .02) continue;
      // 앞/뒤: 법선(매개 방향)과 시선 방향의 내적
      const nx = CN[i0 * 3] + CN[i1 * 3] + CN[i2 * 3], ny = CN[i0 * 3 + 1] + CN[i1 * 3 + 1] + CN[i2 * 3 + 1], nz = CN[i0 * 3 + 2] + CN[i1 * 3 + 2] + CN[i2 * 3 + 2];
      const vx = -(CX[i0] + CX[i1] + CX[i2]) / 3, vy = -(CY[i0] + CY[i1] + CY[i2]) / 3, vz = camD - (CZ[i0] + CZ[i1] + CZ[i2]) / 3;
      const front = nx * vx + ny * vy + nz * vz > 0;
      const sgn = front ? 1 : -1;
      let minX = Math.floor(Math.min(x0, x1, x2)), maxX = Math.ceil(Math.max(x0, x1, x2)), minY = Math.floor(Math.min(y0, y1, y2)), maxY = Math.ceil(Math.max(y0, y1, y2));
      if (maxX < 0 || minX >= W || maxY < 0 || minY >= H) continue;
      if (minX < 0) minX = 0; if (minY < 0) minY = 0; if (maxX >= W) maxX = W - 1; if (maxY >= H) maxY = H - 1;
      const inv = 1 / area, d0 = SD[i0], d1 = SD[i1], d2 = SD[i2];
      const s0 = SS[i0] + (front ? 0 : .5), s1 = SS[i1] + (front ? 0 : .5), s2 = SS[i2] + (front ? 0 : .5);
      const t0 = front ? TT[i0] : 1 - TT[i0], t1 = front ? TT[i1] : 1 - TT[i1], t2 = front ? TT[i2] : 1 - TT[i2];
      const l0 = SI[i0] * sgn, l1 = SI[i1] * sgn, l2 = SI[i2] * sgn;
      for (let y = minY; y <= maxY; y++) {
        const py = y + .5;
        for (let x = minX; x <= maxX; x++) {
          const px = x + .5;
          const w0 = ((x1 - px) * (y2 - py) - (x2 - px) * (y1 - py)) * inv, w1 = ((x2 - px) * (y0 - py) - (x0 - px) * (y2 - py)) * inv, w2 = 1 - w0 - w1;
          if (w0 < -.002 || w1 < -.002 || w2 < -.002) continue;
          const z = w0 * d0 + w1 * d1 + w2 * d2, idx = y * W + x;
          if (z >= zb[idx]) continue;
          zb[idx] = z;
          const s = w0 * s0 + w1 * s1 + w2 * s2, tt = w0 * t0 + w1 * t1 + w2 * t2;
          // 글자 마스크: s 방향 래핑, 위가 +t
          let u = s * tw - .5, v = (1 - tt) * th - .5;
          let iu = Math.floor(u); const fu = u - iu; let iv = Math.floor(v); const fv = v - iv;
          iu = ((iu % tw) + tw) % tw; const iu2 = iu + 1 === tw ? 0 : iu + 1;
          if (iv < 0) iv = 0; else if (iv > th - 2) iv = th - 2;
          const r0 = iv * tw, r1 = r0 + tw;
          const mk = ((td[r0 + iu] * (1 - fu) + td[r0 + iu2] * fu) * (1 - fv) + (td[r1 + iu] * (1 - fu) + td[r1 + iu2] * fu) * fv) / 255;
          let R, G, B;
          if (front) { R = 42 + (250 - 42) * mk; G = 37 + (243 - 37) * mk; B = 33 + (226 - 33) * mk; }
          else { R = 251 + (36 - 251) * mk; G = 244 + (32 - 244) * mk; B = 228 + (29 - 228) * mk; }
          if (edge && (tt < .05 || tt > .95)) { R = 242; G = 98; B = 70; }
          let li = w0 * l0 + w1 * l1 + w2 * l2; li = li < 0 ? 0 : li > 1 ? 1 : li;
          const sh = .66 + .5 * li;
          R *= sh; G *= sh; B *= sh;
          buf[idx] = (255 << 24) | ((B > 255 ? 255 : B) << 16) | ((G > 255 ? 255 : G) << 8) | (R > 255 ? 255 : R);
        }
      }
    }
  }

  // 개미: 곡면 위의 중심선(b=bline)을 걷는다. 홀수 바퀴에서는 (a, flip(b)) 위치 + 법선 반대쪽 → 같은 자리의 뒷면
  function antAt(m, v, off) {
    const S = m.S, lap = Math.floor(v / TAU), a = v - lap * TAU, odd = lap % 2 === 1;
    const b = odd ? S.flip(S.bline) : S.bline, n = normalAt(S, a, b), p = S.pos(a, b), sg = odd ? -1 : 1;
    return [p[0] + n[0] * off * sg, p[1] + n[1] * off * sg, p[2] + n[2] * off * sg];
  }
  function drawAnt(m) {
    const va = antV, off = .06;
    // 꼬리(지나온 길): 표면에 점선 + 가림 판정
    for (let k = 26; k >= 1; k--) {
      const v = va - k * .055; if (v < 0) continue;
      const pr = project(antAt(m, v, .015)), ix = Math.round(pr[0]), iy = Math.round(pr[1]);
      if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
      if (pr[2] > zb[iy * W + ix] + .05) continue;
      g.fillStyle = `rgba(242,98,70,${(.9 - k * .033).toFixed(2)})`;
      g.beginPath(); g.arc(pr[0], pr[1], Math.max(1.2, pr[3] * .014), 0, TAU); g.fill();
    }
    const p = project(antAt(m, va, off)), p2 = project(antAt(m, va + .06, off));
    const ix = Math.round(p[0]), iy = Math.round(p[1]);
    let hidden = false;
    if (ix >= 0 && iy >= 0 && ix < W && iy < H) { let zmin = 1e9; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const xx = ix + dx, yy = iy + dy; if (xx >= 0 && yy >= 0 && xx < W && yy < H) zmin = Math.min(zmin, zb[yy * W + xx]); } hidden = p[2] > zmin + .09; }
    let dx = p2[0] - p[0], dy = p2[1] - p[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    const sz = Math.max(4, p[3] * .05), px = -dy, py = dx, lap = Math.floor(va / TAU), onBack = lap % 2 === 1;
    g.save(); g.globalAlpha = hidden ? .28 : 1;
    const body = onBack ? '#2a1f12' : '#f25a3c';
    g.strokeStyle = body; g.lineWidth = Math.max(1, sz * .16); g.lineCap = 'round';
    const ph = t * 14;
    for (let i = -1; i <= 1; i++) for (const sd of [-1, 1]) {
      const bx = p[0] + dx * sz * .45 * i, by = p[1] + dy * sz * .45 * i, sw = Math.sin(ph + i * 2 + (sd > 0 ? 0 : Math.PI)) * .25;
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + px * sd * sz * 1.1 + dx * sz * (.3 * i + sw), by + py * sd * sz * 1.1 + dy * sz * (.3 * i + sw)); g.stroke();
    }
    g.fillStyle = body;
    for (const [o, r] of [[-.85, .62], [0, .5], [.78, .42]]) { g.beginPath(); g.ellipse(p[0] + dx * sz * o, p[1] + dy * sz * o, sz * r, sz * r * .8, Math.atan2(dy, dx), 0, TAU); g.fill(); }
    g.lineWidth = Math.max(1, sz * .1);
    g.beginPath(); g.moveTo(p[0] + dx * sz * 1.05, p[1] + dy * sz * 1.05); g.lineTo(p[0] + dx * sz * 1.7 + px * sz * .55, p[1] + dy * sz * 1.7 + py * sz * .55); g.moveTo(p[0] + dx * sz * 1.05, p[1] + dy * sz * 1.05); g.lineTo(p[0] + dx * sz * 1.7 - px * sz * .55, p[1] + dy * sz * 1.7 - py * sz * .55); g.stroke();
    g.restore();
  }

  const off = ctx.tick(() => {
    const now = performance.now();
    if (!visible || document.hidden) { last = now; return; }
    acc += now - last; last = now;
    if (acc < 50) return;
    const dt = Math.min(.12, acc / 1000); acc = 0;
    const ts = performance.now();
    t += dt;
    if (!drag) { yaw += vyaw; elev = Math.max(.1, Math.min(1.45, elev + velev)); vyaw *= .92; velev *= .92; yaw += dt * .22; }
    antV += dt * (ctx.reduced ? .3 : .85);
    if (now - lastSwitch > 30000 && now - userHold > 20000) setKind(kind === 'mobius' ? 'klein' : 'mobius');

    // 카메라 = Rx(elev)·Rz(yaw)
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), e = elev + .05 * Math.sin(t * .4), ce = Math.cos(e), se = Math.sin(e);
    // X_c = x1, Y_c = y1·sin e + z1·cos e, Z_c = −y1·cos e + z1·sin e  ((x1,y1) = z축 yaw 회전 후)
    M = [cyw, -syw, 0, se * syw, se * cyw, ce, -ce * syw, -ce * cyw, se];
    F = .27 * H * camD; cx = W * (W > H * 1.25 ? .66 : .5); cy = H * (.5 + .03);
    render(cur.m, cur.tex);
    g.putImageData(img, 0, 0);
    drawAnt(cur.m);

    const lap = Math.floor(antV / TAU);
    if (lap !== lastLap) {
      lastLap = lap; const back = lap % 2 === 1;
      if (dotEl) dotEl.classList.toggle('is-back', back);
      if (antEl) antEl.textContent = kind === 'mobius'
        ? `개미는 지금 ${back ? '크림' : '검은'} 면을 걷는 중 · ${lap + 1}바퀴째${back ? ' — 가장자리를 안 넘었는데 반대 면!' : ''}`
        : `개미는 지금 병의 ${back ? '안쪽' : '바깥쪽'}을 걷는 중 · ${lap + 1}바퀴째${back ? ' — 구멍 없이 안과 밖이 이어져 있어요' : ''}`;
    }
    const ms = performance.now() - ts; avg = avg * .85 + ms * .15;
    if (++nf % 10 === 0) {
      if (avg > 40 && res > .5) { res = Math.max(.5, res - .15); fit(); }
      else if (avg < 14 && res < 1.8) { res = Math.min(1.8, res + .15); fit(); }
    }
  });

  return () => {
    off(); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    cv.removeEventListener('pointerdown', onDown); removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
    chips.forEach((c, i) => c.removeEventListener('click', chipFns[i]));
    gsap.killTweensOf(cv);
  };
}
