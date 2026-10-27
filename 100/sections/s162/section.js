// s162 — Ebru 종이 마블링. Lu & Jaffer 식 닫힌형 면적 보존 변위의 "역사상 체인".
// 화면의 각 픽셀을 도구 체인의 역변환으로 거슬러 올라가 처음 닿는 잉크 방울의 색을 읽는다(유체 풀이 없음).
//  방울  p' = c + (p−c)·√(1 + r²/|p−c|²)   → 역: |q−c|<r 이면 그 방울색, 아니면 p = c + (q−c)·√(1 − r²/|q−c|²)
//  바늘/빗  p' = p + u·S·f(d)  (d = 경로 직선까지의 수직거리, f 는 d 만의 함수 → 전단이라 det=1, 역 = 부호 반전)
//  휘젓기  p' = c + R(θ(r))(p−c)  (비틀기, 반경 보존 → det=1)

const STR = 10;
const NOISE = new Float32Array(1024);
for (let i = 0; i < 1024; i++) { const h = Math.sin(i * 12.9898) * 43758.5453; NOISE[i] = 0.965 + (h - Math.floor(h)) * 0.07; }

let _r = 0, _g = 0, _b = 0, _id = 0;
// 한 점을 체인의 역변환으로 거슬러 올라가 색·도구 id 를 얻는다
function evalAt(x, y, T, P, n, bg) {
  _r = bg[0]; _g = bg[1]; _b = bg[2]; _id = 0;
  for (let k = n - 1; k >= 0; k--) {
    const o = k * STR, ty = T[k];
    if (ty === 0) {
      const r2 = P[o + 2]; if (r2 <= 0) continue;
      const dx = x - P[o], dy = y - P[o + 1], d2 = dx * dx + dy * dy;
      if (d2 < r2) {
        const rho = Math.sqrt(d2 / r2), sh = 0.84 + 0.18 * rho + 0.022 * Math.sin(rho * 42);
        _r = P[o + 5] * sh; _g = P[o + 6] * sh; _b = P[o + 7] * sh; _id = k + 1; return;
      }
      const s = Math.sqrt(1 - r2 / d2); x = P[o] + dx * s; y = P[o + 1] + dy * s;
    } else if (ty === 1) {
      const ux = P[o + 2], uy = P[o + 3], c = P[o + 5], lam = P[o + 6];
      const d = (x - P[o]) * -uy + (y - P[o + 1]) * ux;
      let f;
      if (lam === 0) { const t = 1 + Math.abs(d) / c; f = 1 / (t * t); }
      else { let q = d / lam; q -= Math.floor(q + 0.5); const t = 1 + Math.abs(q) * lam / c, e0 = P[o + 7]; f = (1 / (t * t) - e0) / (1 - e0); }
      const a = P[o + 4] * f; x -= ux * a; y -= uy * a;
    } else {
      const dx = x - P[o], dy = y - P[o + 1], e = (dx * dx + dy * dy) * P[o + 3];
      if (e < 9) { const th = P[o + 2] * Math.exp(-e), c = Math.cos(th), s = Math.sin(th); x = P[o] + dx * c + dy * s; y = P[o + 1] - dx * s + dy * c; }
    }
  }
}

// 1패스: 픽셀당 1샘플 + 도구 id.  2패스: 이웃과 id 가 다른 경계 픽셀만 2×2 초과표본(적응형 AA)
export function renderChain(data, RW, RH, T, P, n, bg, ids) {
  const inv = 1 / RH;
  for (let j = 0, o4 = 0, q = 0; j < RH; j++) {
    const y0 = (j + 0.5) * inv;
    for (let i = 0; i < RW; i++, o4 += 4, q++) {
      evalAt((i + 0.5) * inv, y0, T, P, n, bg); ids[q] = _id;
      const nz = NOISE[(i * 31 + j * 17) & 1023];
      data[o4] = _r * nz; data[o4 + 1] = _g * nz; data[o4 + 2] = _b * nz; data[o4 + 3] = 255;
    }
  }
  let edges = 0;
  for (let j = 1; j < RH - 1; j++) for (let i = 1; i < RW - 1; i++) { const q = j * RW + i, id = ids[q]; if (ids[q - 1] !== id || ids[q + 1] !== id || ids[q - RW] !== id || ids[q + RW] !== id) edges++; }
  const two = edges > RW * RH * 0.1; // 경계가 너무 많으면(비틀기로 가는 줄무늬) 대각 2표본만
  for (let j = 1; j < RH - 1; j++) for (let i = 1; i < RW - 1; i++) {
    const q = j * RW + i, id = ids[q];
    if (ids[q - 1] === id && ids[q + 1] === id && ids[q - RW] === id && ids[q + RW] === id) continue;
    let r = 0, g = 0, b = 0;
    if (two) { for (let m = 0; m < 2; m++) { evalAt((i + 0.25 + m * 0.5) * inv, (j + 0.25 + m * 0.5) * inv, T, P, n, bg); r += _r * 2; g += _g * 2; b += _b * 2; } }
    else for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) { evalAt((i + 0.25 + sx * 0.5) * inv, (j + 0.25 + sy * 0.5) * inv, T, P, n, bg); r += _r; g += _g; b += _b; }
    const nz = NOISE[(i * 31 + j * 17) & 1023] * 0.25, o4 = q * 4;
    data[o4] = r * nz; data[o4 + 1] = g * nz; data[o4 + 2] = b * nz;
  }
  return edges;
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const PAL = ['#c9371e', '#17386b', '#e3a22c', '#1c7c72', '#f6f0df', '#25242a', '#bb4a6e', '#41823f'].map(hex);
export const BG = hex('#e8dec6');
const ease = { out: t => 1 - Math.pow(1 - t, 3), io: t => t * t * (3 - 2 * t) };

function mulberry(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// 한 장(sheet)의 자동 연출 스크립트: 바탕 방울 9 → 동심 과녁 → 작은 방울 → 바늘 2회 → 빗 → 휘젓기 → 정지
export function makeScript(seed, aspect) {
  const rnd = mulberry(seed), ord = PAL.map((_, i) => i).sort(() => rnd() - 0.5), col = k => ord[k % ord.length];
  const A = [], cx = aspect * (0.42 + 0.16 * rnd()), cy = 0.42 + 0.16 * rnd();
  let t = 0.15, ci = 0;
  for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) {
    A.push({ t, ty: 0, cx: aspect * ((gx + 0.5) / 3 + (rnd() - .5) * 0.12), cy: (gy + 0.5) / 3 + (rnd() - .5) * 0.18, r: 0.2 + 0.08 * rnd(), c: col(ci++), dur: .5 }); t += 0.28;
  }
  const n = 5 + (rnd() * 2 | 0);
  for (let k = 0; k < n; k++) { A.push({ t, ty: 0, cx: cx + (rnd() - .5) * .008, cy, r: 0.085, c: col(ci++), dur: .55 }); t += .42; }
  for (let k = 0; k < 3; k++) { A.push({ t, ty: 0, cx: aspect * (0.1 + 0.8 * rnd()), cy: 0.12 + 0.76 * rnd(), r: 0.04 + 0.035 * rnd(), c: col(ci++), dur: .45 }); t += .32; }
  for (let k = 0; k < 2; k++) {
    const ang = (k ? 1.45 : -0.2) + (rnd() - .5) * 0.5, ux = Math.cos(ang), uy = Math.sin(ang), off = (rnd() - .5) * 0.3;
    A.push({ t, ty: 1, ox: cx - uy * off - ux * 0.5, oy: cy + ux * off - uy * 0.5, ux, uy, S: 0.38 + 0.14 * rnd(), c: 0.024, lam: 0, dur: 1.7 }); t += 1.6;
  }
  { const ang = Math.PI * 0.5 + (rnd() - .5) * 0.6, ux = Math.cos(ang), uy = Math.sin(ang);
    A.push({ t, ty: 1, ox: cx - ux * 0.5, oy: cy - uy * 0.5, ux, uy, S: 0.3 + 0.1 * rnd(), c: 0.016, lam: 0.09 + 0.03 * rnd(), dur: 2.6 }); t += 2.7; }
  A.push({ t, ty: 2, cx: aspect * (0.3 + 0.4 * rnd()), cy: 0.3 + 0.4 * rnd(), A: (rnd() < .5 ? -1 : 1) * (1.8 + 1.0 * rnd()), sig: 0.19, dur: 2.6 }); t += 2.6;
  return { actions: A, end: t + 5 };
}

export default function init(root, ctx) {
  const cv = root.querySelector('.s162__cv'), snap = root.querySelector('.s162__snap'), tray = root.querySelector('.s162__tray');
  const chips = [...root.querySelectorAll('.s162__chip')];
  const g = cv.getContext('2d'), gs = snap.getContext('2d');
  if (!g || !gs) { root.classList.add('is-static'); return; }
  const MAX = 40;
  const T = new Uint8Array(MAX), P = new Float32Array(MAX * STR);
  let ids = null, tools = [], script = null, aut = 0, ai = 0, sheet = 0, img = null, RW = 0, RH = 0, aspect = 1.6, dirty = true;
  let visible = true, tabOn = true, acc = 0, last = performance.now(), lastUser = -1e9, mode = 0, drag = null, cost = 25, pal = 0;
  const MODES = ['drop', 'needle', 'comb', 'swirl'];

  function size() {
    const r = tray.getBoundingClientRect(); aspect = Math.max(0.8, r.width / Math.max(1, r.height));
    RH = 252; RW = Math.round(RH * aspect);
    cv.width = snap.width = RW; cv.height = snap.height = RH; img = g.createImageData(RW, RH); ids = new Uint8Array(RW * RH); dirty = true;
  }
  function pack(k) {
    const t = tools[k], o = k * STR; T[k] = t.ty;
    if (t.ty === 0) { const r = t.r * ease.out(t.prog); const c = PAL[t.c]; P[o] = t.cx; P[o + 1] = t.cy; P[o + 2] = r * r; P[o + 3] = 0; P[o + 4] = r; P[o + 5] = c[0]; P[o + 6] = c[1]; P[o + 7] = c[2]; }
    else if (t.ty === 1) { P[o] = t.ox; P[o + 1] = t.oy; P[o + 2] = t.ux; P[o + 3] = t.uy; P[o + 4] = t.S * ease.io(t.prog); P[o + 5] = t.c; P[o + 6] = t.lam; P[o + 7] = t.lam ? 1 / Math.pow(1 + t.lam / (2 * t.c), 2) : 0; }
    else { P[o] = t.cx; P[o + 1] = t.cy; P[o + 2] = t.A * ease.io(t.prog); P[o + 3] = 1 / (2 * t.sig * t.sig); }
  }
  function add(t) { if (tools.length >= MAX) return null; t.prog = t.prog == null ? 1 : t.prog; tools.push(t); pack(tools.length - 1); dirty = true; return t; }

  function newSheet(fast) {
    if (!fast && RW) { gs.drawImage(cv, 0, 0); snap.style.transition = 'none'; snap.style.opacity = '1'; void snap.offsetWidth; snap.style.transition = 'opacity 1.6s ease'; snap.style.opacity = '0'; }
    tools = []; ai = 0; aut = 0; script = makeScript(7 + sheet * 13, aspect); sheet++; dirty = true;
    if (fast) { aut = 5; } // 첫 화면: 동심원+방울이 이미 놓인 상태로 시작
  }
  function runScript(dt) {
    aut += dt;
    while (ai < script.actions.length && script.actions[ai].t <= aut) {
      const a = script.actions[ai++], t = Object.assign({}, a); t.prog = 0; t.ddur = a.dur;
      if (!add(t)) { newSheet(); return; }
    }
    if (aut > script.end || tools.length >= MAX) newSheet();
  }
  function advance(dt) {
    for (let k = 0; k < tools.length; k++) { const t = tools[k]; if (t.prog < 1) { t.prog = Math.min(1, t.prog + dt / (t.ddur || 0.6)); pack(k); dirty = true; } }
  }

  // 포인터 — 클릭=방울, 끌기=선택한 도구
  const world = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.height, y: (e.clientY - r.top) / r.height }; };
  const finishAll = () => { tools.forEach((t, k) => { if (t.prog < 1) { t.prog = 1; pack(k); } }); while (ai < script.actions.length && script.actions[ai].t <= aut + 0.0) ai++; };
  const down = e => {
    if (e.button > 0) return; lastUser = performance.now(); finishAll();
    drag = { p0: world(e), tool: null, id: e.pointerId }; try { cv.setPointerCapture(e.pointerId); } catch (_) { }
  };
  const move = e => {
    if (!drag) return; lastUser = performance.now();
    const p = world(e), dx = p.x - drag.p0.x, dy = p.y - drag.p0.y, d = Math.hypot(dx, dy);
    if (d < 0.012 && !drag.tool) return;
    const m = MODES[mode];
    if (!drag.tool) {
      if (m === 'drop') drag.tool = add({ ty: 0, cx: drag.p0.x, cy: drag.p0.y, r: 0.05, c: (pal++) % PAL.length });
      else if (m === 'swirl') drag.tool = add({ ty: 2, cx: drag.p0.x, cy: drag.p0.y, A: 0, sig: 0.16 });
      else drag.tool = add({ ty: 1, ox: drag.p0.x, oy: drag.p0.y, ux: 1, uy: 0, S: 0, c: m === 'comb' ? 0.014 : 0.03, lam: m === 'comb' ? 0.085 : 0 });
      if (!drag.tool) { newSheet(); drag = null; return; }
    }
    const t = drag.tool, k = tools.length - 1;
    if (m === 'drop') t.r = Math.max(0.03, d); else if (m === 'swirl') { t.A = Math.max(-4, Math.min(4, dx * 6)); }
    else { t.ux = dx / d; t.uy = dy / d; t.S = d; }
    pack(k); dirty = true;
  };
  const up = e => {
    if (!drag) return; lastUser = performance.now();
    if (!drag.tool) add({ ty: 0, cx: drag.p0.x, cy: drag.p0.y, r: 0.06, c: (pal++) % PAL.length, prog: 0, ddur: 0.5 });
    drag = null; try { cv.releasePointerCapture(e.pointerId); } catch (_) { }
  };
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  const chipOff = chips.map((b, i) => { const f = () => { mode = i; chips.forEach((c, j) => c.classList.toggle('is-on', j === i)); }; b.addEventListener('click', f); return () => b.removeEventListener('click', f); });
  chips[0] && chips[0].classList.add('is-on');

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const onVis = () => { tabOn = !document.hidden; last = performance.now(); }; document.addEventListener('visibilitychange', onVis);
  let rt = 0; const onRes = () => { clearTimeout(rt); rt = setTimeout(() => { const r = tray.getBoundingClientRect(); if (Math.abs(r.width / r.height - aspect) > 0.05) { size(); newSheet(true); } }, 250); };
  addEventListener('resize', onRes);

  size(); newSheet(true);
  for (let k = 0; k < tools.length; k++) pack(k);
  // 첫 화면용 선행: 스크립트 5초 지점까지의 도구를 즉시 완성 상태로 배치
  { const a0 = script.actions; ai = 0; tools = []; while (ai < a0.length && a0[ai].t <= aut) { const t = Object.assign({}, a0[ai++]); t.prog = 1; tools.push(t); } tools.forEach((_, k) => pack(k)); }

  const off = ctx.tick(() => {
    if (!visible || !tabOn) return;
    const now = performance.now(); acc += Math.min(0.1, (now - last) / 1000); last = now;
    if (acc < Math.max(1 / 20, cost * 1.7 / 1000)) return; const dt = Math.min(acc, 0.12); acc = 0; // 렌더 비용이 크면 프레임을 건너뛰어 메인 스레드를 비운다
    const auto = !drag && now - lastUser > 5500;
    if (auto) runScript(dt);
    advance(dt);
    if (dirty) {
      const t0 = performance.now(); renderChain(img.data, RW, RH, T, P, tools.length, BG, ids); g.putImageData(img, 0, 0); dirty = false;
      cost = cost * 0.7 + (performance.now() - t0) * 0.3;
    }
    root.__s162 = { n: tools.length, sheet, cost };
  });

  return () => {
    off(); io.disconnect(); clearTimeout(rt); document.removeEventListener('visibilitychange', onVis); removeEventListener('resize', onRes);
    cv.removeEventListener('pointerdown', down); cv.removeEventListener('pointermove', move); cv.removeEventListener('pointerup', up); cv.removeEventListener('pointercancel', up);
    chipOff.forEach(f => f());
  };
}
