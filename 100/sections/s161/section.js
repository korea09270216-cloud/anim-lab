// s161 — 유리창 빗방울: CPU 방울 시뮬(병합·스틱슬립·꼬리) → 법선/크기 맵(RGBA8) → 렌즈 굴절 셰이더 + 김서림 마스크
// ---- WebGL 공용 유틸 (이 섹션 전용 사본) ----
const PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
function compile(g, fs, vs) {
  const sh = (t, c) => { const o = g.createShader(t); g.shaderSource(o, c); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
  const p = g.createProgram();
  g.attachShader(p, sh(g.VERTEX_SHADER, vs || VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, PRE + fs));
  g.bindAttribLocation(p, 0, 'p'); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
  return p;
}
function triangle(g) { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW); g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0); return b; }
function U(g, p, names) { const o = {}; names.split(' ').forEach(n => o[n] = g.getUniformLocation(p, n)); return o; }
function fit(c, s) { const w = Math.max(2, Math.round(c.clientWidth * s)), h = Math.max(2, Math.round(c.clientHeight * s)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; } return false; }
function pointer(root, canvas) {
  const m = { x: .5, y: .5, in: false, t: 0 };
  const mv = e => { const r = canvas.getBoundingClientRect(); m.x = (e.clientX - r.left) / r.width; m.y = 1 - (e.clientY - r.top) / r.height; m.in = true; m.t = performance.now(); };
  const lv = () => { m.in = false; };
  root.addEventListener('pointermove', mv); root.addEventListener('pointerleave', lv);
  m.off = () => { root.removeEventListener('pointermove', mv); root.removeEventListener('pointerleave', lv); };
  return m;
}
function boot(root, ctx, canvas, scale, setup) {
  let g = null, frame = null, vis = true, lost = false, hidden = document.hidden;
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { rootMargin: '80px' }); io.observe(root);
  const onVis = () => { hidden = document.hidden; }; document.addEventListener('visibilitychange', onVis);
  function start() {
    try {
      g = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!g) throw 0;
      frame = setup(g, canvas); root.classList.remove('is-fallback');
    } catch (e) { frame = null; root.classList.add('is-fallback'); if (e) console.warn('[gl]', e.message || e); }
  }
  const onLost = e => { e.preventDefault(); lost = true; frame = null; };
  const onRest = () => { lost = false; start(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRest);
  start();
  const t0 = performance.now(); let acc = 0, last = t0;
  const off = ctx.tick(() => {
    if (!frame || !vis || hidden || lost || !g || g.isContextLost()) return;
    const now = performance.now(); acc += now - last; last = now;
    if (acc < 46) return; acc = 0;                                  // ~20fps 캡
    fit(canvas, scale);
    try { frame((now - t0) / 1000, canvas.width, canvas.height); } catch (e) { frame = null; root.classList.add('is-fallback'); console.warn('[gl]', e.message || e); }
  });
  return () => { off(); io.disconnect(); document.removeEventListener('visibilitychange', onVis); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRest); };
}
// ---- /유틸 ----

// ================= 프로시저럴 밤 도시 (2D 캔버스 → 3단 블러 텍스처) =================
const BW = 768, BH = 432;
function makeCity() {
  const c = document.createElement('canvas'); c.width = BW; c.height = BH;
  const x = c.getContext('2d'); const S = BW / 768;
  let seed = 11; const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const sky = x.createLinearGradient(0, 0, 0, BH);
  sky.addColorStop(0, '#0b1038'); sky.addColorStop(.42, '#232e78'); sky.addColorStop(.66, '#5b3d96'); sky.addColorStop(.82, '#c05a92'); sky.addColorStop(1, '#3a2250');
  x.fillStyle = sky; x.fillRect(0, 0, BW, BH);
  const hg = x.createRadialGradient(BW * .55, BH * .74, 0, BW * .55, BH * .74, BW * .55);
  hg.addColorStop(0, 'rgba(255,125,150,.42)'); hg.addColorStop(1, 'rgba(255,125,150,0)'); x.fillStyle = hg; x.fillRect(0, 0, BW, BH);
  const WIN = ['255,214,120', '255,236,190', '255,190,110', '170,230,255', '255,150,200'];
  function layer(baseY, hmin, hmax, wmin, wmax, col, prob, alpha) {
    let px = -12 * S;
    while (px < BW) {
      const bw = (wmin + rnd() * (wmax - wmin)) * S, bh = (hmin + rnd() * (hmax - hmin)) * BH;
      x.fillStyle = col; x.fillRect(px, baseY - bh, bw, bh + 40);
      const ww = 3.4 * S, wh = 4.6 * S, gx = 7 * S, gy = 9.5 * S;
      for (let wy = baseY - bh + 7 * S; wy < baseY - 8 * S; wy += gy)
        for (let wx = px + 4 * S; wx < px + bw - 5 * S; wx += gx)
          if (rnd() < prob) { x.fillStyle = `rgba(${WIN[(rnd() * WIN.length) | 0]},${alpha * (.55 + rnd() * .45)})`; x.fillRect(wx, wy, ww, wh); }
      if (rnd() < .22) { x.fillStyle = 'rgba(255,70,60,.95)'; x.fillRect(px + bw * .5, baseY - bh - 7 * S, 2.2 * S, 2.2 * S); }
      px += bw + (rnd() < .3 ? rnd() * 7 * S : 0);
    }
  }
  layer(BH * .70, .10, .28, 34, 70, '#2a2f68', .3, .9);
  layer(BH * .78, .14, .36, 40, 84, '#151a44', .42, 1);
  layer(BH * .87, .2, .5, 46, 100, '#0b0d24', .5, 1);
  // 네온 간판
  const neon = (nx, ny, w, h, col, txt) => {
    x.save(); x.shadowColor = col; x.shadowBlur = 16 * S; x.strokeStyle = col; x.lineWidth = 2.4 * S; x.strokeRect(nx, ny, w, h);
    x.fillStyle = col; x.font = `900 ${h * .62}px 'Malgun Gothic','Apple SD Gothic Neo',sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(txt, nx + w / 2, ny + h / 2 + 1); x.restore();
  };
  neon(BW * .12, BH * .52, 70 * S, 30 * S, '#ff5fa8', '카페'); neon(BW * .66, BH * .46, 84 * S, 34 * S, '#5fe0ff', '노래방'); neon(BW * .84, BH * .6, 60 * S, 26 * S, '#ffc25a', '약국');
  neon(BW * .38, BH * .58, 54 * S, 24 * S, '#8dff9a', '24');
  // 젖은 도로 + 반사 줄기
  const rd = x.createLinearGradient(0, BH * .86, 0, BH); rd.addColorStop(0, '#0b0c1e'); rd.addColorStop(1, '#171328'); x.fillStyle = rd; x.fillRect(0, BH * .86, BW, BH * .14);
  const COL = ['255,190,90', '90,220,255', '255,80,170', '255,245,225', '255,70,60', '90,255,170'];
  for (let i = 0; i < 46; i++) {
    const cx = rnd() * BW, w = (3 + rnd() * 9) * S, col = COL[(rnd() * COL.length) | 0];
    const gr = x.createLinearGradient(0, BH * .86, 0, BH); gr.addColorStop(0, `rgba(${col},.5)`); gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr; x.fillRect(cx - w / 2, BH * .86, w, BH * .14);
  }
  // 보케 광원 (가로등·차량 불빛)
  for (let i = 0; i < 140; i++) {
    const cx = rnd() * BW, cy = BH * (.5 + rnd() * .42), r = (2.2 + Math.pow(rnd(), 1.6) * 13) * S, col = COL[(rnd() * COL.length) | 0], a = .6 + rnd() * .4;
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(.72, `rgba(${col},${a * .75})`); gr.addColorStop(1, `rgba(${col},0)`);
    x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, r, 0, 6.2832); x.fill();
  }
  return c;
}
function blurred(src, px) {
  const c = document.createElement('canvas'); c.width = BW; c.height = BH; const x = c.getContext('2d');
  if ('filter' in x) { x.filter = `blur(${px}px)`; x.drawImage(src, 0, 0); x.filter = 'none'; }
  else {                                                         // 필터 미지원: 다운샘플→업샘플 박스 블러
    const k = Math.max(2, Math.round(px * 1.6)), t = document.createElement('canvas'); t.width = Math.ceil(BW / k); t.height = Math.ceil(BH / k);
    t.getContext('2d').drawImage(src, 0, 0, t.width, t.height); x.imageSmoothingEnabled = true; x.drawImage(t, 0, 0, BW, BH);
  }
  return c;
}

// ================= 셰이더 =================
const FS = `
varying vec2 v; uniform vec2 R; uniform vec2 MS; uniform float T;
uniform sampler2D W; uniform sampler2D F; uniform sampler2D S; uniform sampler2D M; uniform sampler2D B;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec3 city(vec2 uv,float f){
  vec3 s=texture2D(S,uv).rgb, m=texture2D(M,uv).rgb, b=texture2D(B,uv).rgb;
  return mix(mix(s,m,smoothstep(0.,.4,f)),b,smoothstep(.3,1.,f));
}
void main(){
  vec2 uv=vec2(v.x,1.-v.y);
  float f=texture2D(F,uv).r;
  vec3 fc=city(uv,f);
  float lum=dot(fc,vec3(.33));
  fc=mix(fc*(1.-.1*f)+.04*f,vec3(.56,.62,.74)*(.38+.75*lum),.42*f);           // 김서림: 어두워지고 뿌옇게
  vec4 w=texture2D(W,uv);
  float a=w.a;
  vec3 col=fc;
  float sa=texture2D(W,uv+vec2(1.6,2.8)/MS).a;
  col*=1.-.38*sa*(1.-a);                                               // 방울 그림자
  if(a>.003){
    vec2 n=w.rg*2.-1.; float rr=w.b*16.;
    vec2 off=-n*rr*2.5/MS;                                             // 렌즈: 역상 + 축소
    float e=length(n); float z=sqrt(max(1.-e*e,0.));
    vec3 dc=city(uv+off,.04+.1*smoothstep(0.,.9,e));                   // 방울 안은 맑게(가장자리만 살짝 번짐)
    float rim=smoothstep(.5,1.,e);
    dc*=1.14-.62*rim;                                                  // 가장자리는 빛이 휘어 어둡다
    vec3 nn=normalize(vec3(n,z+.001));
    dc+=vec3(1.,.93,.82)*pow(max(dot(nn,normalize(vec3(-.45,-.5,.75))),0.),36.)*.95;   // 점 하이라이트
    dc+=vec3(.85,.93,1.)*rim*rim*max(dot(n,vec2(.55,.78)),0.)*.42;      // 반대편 집광
    col=mix(col,dc,a);
  }
  col=pow(col,vec3(.94));
  col*=1.-.3*dot(v-.5,v-.5);
  gl_FragColor=vec4(col,1.);
}`;

export default function init(root, ctx) {
  const canvas = root.querySelector('.s161__gl');
  const mp = pointer(root, canvas);
  const MW = 480, RMAX = 16, FW = 192;
  let MH = 270, FH = 108;
  let map, map32, fog, fogU8;
  const drops = [];
  const rand = Math.random;
  const alloc = () => {
    map = new Uint8Array(MW * MH * 4); map32 = new Uint32Array(map.buffer);
    fog = new Float32Array(FW * FH).fill(.9); fogU8 = new Uint8Array(FW * FH);
  };
  alloc();
  const addDrop = (x, y, r, slide, v) => {
    const d = { x, y, r, rt: r, rc: 6.5 + rand() * 3.5, sl: !!slide, v: v || 0, vm: 1, tm: 0, vx: 0, dist: 0, gap: 3 + rand() * 7, dead: false };
    drops.push(d); return d;
  };
  // 초기 시드: 작은 방울 다수 + 미끄러지는 큰 방울 몇 개
  for (let i = 0; i < 200; i++) addDrop(rand() * MW, rand() * MH, .9 + Math.pow(rand(), 2.2) * 3.4, false);
  for (let i = 0; i < 16; i++) { const d = addDrop(rand() * MW, rand() * MH * .8, 7.2 + rand() * 3, true, 22 + rand() * 20); d.rc = 6; }

  // 김서림 지우기 (맵 좌표계, 반경 = 김서림 셀)
  function clearFog(mx, my, rad, amt) {
    const fx = mx * FW / MW, fy = my * FH / MH, r = Math.max(rad, .7);
    const x0 = Math.max(0, Math.floor(fx - r - 1)), x1 = Math.min(FW - 1, Math.ceil(fx + r + 1)), y0 = Math.max(0, Math.floor(fy - r - 1)), y1 = Math.min(FH - 1, Math.ceil(fy + r + 1));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dd = Math.hypot(x + .5 - fx, y + .5 - fy) / r; if (dd >= 1) continue;
      const k = 1 - dd * dd * (3 - 2 * dd), i = y * FW + x;
      fog[i] *= 1 - amt * k;
    }
  }
  // 손가락(커서)으로 닦기: 김서림 + 작은 방울 쓸어내기 + 큰 방울은 밀려 내려감
  const finger = { x: -1, y: -1, on: false };
  function wipe(mx, my) {
    const cell = canvas.clientWidth / FW || 7.5, radF = 34 / cell, radM = 34 / ((canvas.clientWidth || 1440) / MW);
    if (finger.on) {
      const dx = mx - finger.x, dy = my - finger.y, n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / 2.5));
      for (let k = 1; k <= n; k++) clearFog(finger.x + dx * k / n, finger.y + dy * k / n, radF, .85);
    } else clearFog(mx, my, radF, .85);
    for (const d of drops) {
      if (Math.hypot(d.x - mx, d.y - my) < radM + d.r) {
        if (d.r < 4.2 && rand() < .5) d.dead = true;
        else if (!d.sl && d.r > 4.2) { d.sl = true; d.vm = 1.1; d.v = 24; d.tm = .6; d.rc = d.rt * .6; }
      }
    }
    finger.x = mx; finger.y = my; finger.on = true;
  }

  function step(dt) {
    // 생성: 작은 방울이 계속 맺힌다, 가끔 위에서 큰 방울이 흘러내림
    if (drops.length < 300) for (let k = 0; k < 2; k++) addDrop(rand() * MW, rand() * MH, .8 + Math.pow(rand(), 2.4) * 2.2, false);
    if (rand() < .05) { const d = addDrop(rand() * MW, -4, 7.5 + rand() * 3, true, 28); d.rc = 6; }
    // 증발: 작은 정지 방울이 가끔 사라짐
    if (rand() < .35) { const d = drops[(rand() * drops.length) | 0]; if (d && !d.sl && d.rt < 2.4) d.dead = true; }
    const born = [];
    for (const d of drops) {
      if (d.dead) continue;
      if (!d.sl) {
        d.rt += (.7 + rand() * .9) * dt * .42;                       // 수분 흡수로 서서히 성장
        if (d.rt >= d.rc) { d.sl = true; d.v = 6; d.tm = 0; }
      } else {
        d.tm -= dt;
        if (d.tm <= 0) { d.tm = .25 + rand() * 1; d.vm = rand() < .22 ? 0 : .4 + rand() * 1.4; }   // 스틱-슬립
        const vt = (10 + (d.r - 4) * 7.5) * d.vm;
        d.v += (vt - d.v) * Math.min(1, dt * 5);
        d.y += d.v * dt; d.vx += (rand() - .5) * dt * 26; d.vx *= .95; d.x += d.vx * dt * Math.min(1, d.v / 12);
        d.dist += d.v * dt;
        if (d.dist > d.gap) {                                         // 꼬리: 작은 구슬을 남기고 자기 질량이 줄어든다
          d.dist = 0; d.gap = 2.6 + rand() * 7;
          const rb = .65 + rand() * 1.05 * Math.min(1.4, d.r / 8);
          born.push([d.x + (rand() - .5) * d.r * .5, d.y - d.r * .85, rb]);
          d.rt = Math.sqrt(Math.max(d.rt * d.rt - rb * rb * .9, 0));
        }
        clearFog(d.x, d.y, Math.max(1.2, d.r * 1.15 * FW / MW), 1);   // 지나간 자리는 닦임
        if (d.rt < 4.6) { d.sl = false; d.v = 0; d.rc = d.rt + 2.4 + rand() * 3.5; }
        if (d.y - d.r > MH + 2) d.dead = true;
      }
      d.r += (d.rt - d.r) * Math.min(1, dt * 9);                    // 병합/성장은 몇 프레임에 걸쳐 부드럽게
    }
    for (const b of born) addDrop(b[0], b[1], b[2], false);
    // 병합: 겹치면 면적을 합산(질량 보존), 위치는 면적 가중
    const n = drops.length;
    for (let i = 0; i < n; i++) {
      const a = drops[i]; if (a.dead) continue;
      for (let j = i + 1; j < n; j++) {
        const b = drops[j]; if (b.dead) continue;
        const rs = (a.r + b.r) * .8; const dx = a.x - b.x; if (dx > rs || dx < -rs) continue;
        const dy = a.y - b.y; if (dx * dx + dy * dy < rs * rs) {
          const big = a.rt >= b.rt ? a : b, sm = big === a ? b : a;
          const A1 = big.rt * big.rt, A2 = sm.rt * sm.rt;
          big.x = (big.x * A1 + sm.x * A2) / (A1 + A2); big.y = (big.y * A1 + sm.y * A2) / (A1 + A2);
          big.rt = Math.min(Math.sqrt(A1 + A2), RMAX - .4);
          if (big.sl || sm.sl) { big.sl = true; big.v = Math.max(big.v, sm.v) * 1.12 + 4; big.tm = .5; big.vm = 1.1; }
          else if (big.rt >= big.rc * .9) { big.sl = true; big.v = 8; big.tm = .3; }
          sm.dead = true;
        }
      }
    }
    for (let i = drops.length - 1; i >= 0; i--) if (drops[i].dead) { drops[i] = drops[drops.length - 1]; drops.pop(); }
    // 김서림 재성장
    const grow = dt * .042;
    for (let i = 0; i < fog.length; i++) { const f = fog[i] + grow; fog[i] = f > 1 ? 1 : f; }
  }

  function paint(d) {
    const rx = d.r * (d.sl ? .92 : 1), ry = d.r * (d.sl ? 1.1 : 1);
    const x0 = Math.max(0, Math.floor(d.x - rx - 1)), x1 = Math.min(MW - 1, Math.ceil(d.x + rx + 1)), y0 = Math.max(0, Math.floor(d.y - ry - 1)), y1 = Math.min(MH - 1, Math.ceil(d.y + ry + 1));
    const rc = Math.min(255, (d.r / RMAX) * 255) | 0, mr = Math.min(rx, ry);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const dx = (x + .5 - d.x) / rx, dy = (y + .5 - d.y) / ry, e2 = dx * dx + dy * dy; if (e2 >= 1) continue;
      const e = Math.sqrt(e2), a = Math.min(1, (1 - e) * mr * 1.1 + .02) * 255 | 0, i = (y * MW + x) * 4;
      if (map[i + 3] > a && map[i + 2] >= rc) continue;
      map[i] = 127.5 + 127.5 * dx; map[i + 1] = 127.5 + 127.5 * dy; map[i + 2] = rc; map[i + 3] = a;
    }
  }

  // 자동 손가락(입력이 없을 때) — 리사주 곡선으로 김서림을 닦는다
  const autoPos = t => [MW * (.5 + .4 * Math.sin(t * .37 + 1.2)), MH * (.5 + .3 * Math.sin(t * .53 + .4) * Math.cos(t * .21))];
  for (let t = -6; t < 0; t += .12) { const p = autoPos(t); wipe(p[0], p[1]); }
  finger.on = false;
  for (let k = 0; k < 24; k++) step(1 / 30);                         // 첫 화면에 이미 미끄러진 흔적이 있도록 워밍업

  let gl = null, tex = null, texDim = '';
  let last = 0, autoT = 0, wasReal = false;
  const lastRealMove = () => mp.in && performance.now() - mp.t < 2500;

  const off = boot(root, ctx, canvas, ctx.reduced ? .35 : .5, (g) => {
    gl = g;
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R MS T W F S M B');
    const mk = () => { const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); return t; };
    tex = { W: mk(), F: mk(), S: mk(), M: mk(), B: mk() }; texDim = '';
    const city = makeCity();
    [['S', city], ['M', blurred(city, 5)], ['B', blurred(city, 17)]].forEach(([k, cv]) => { g.bindTexture(g.TEXTURE_2D, tex[k]); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, cv); });
    ['W', 'F', 'S', 'M', 'B'].forEach((k, i) => g.uniform1i(u[k], i));
    return (t, w, h) => {
      const dt = Math.min(.1, Math.max(.02, t - last)); last = t;
      // 섹션 종횡비가 바뀌면 맵 높이를 새로 잡는다
      const nh = Math.max(120, Math.round(MW * h / w));
      if (Math.abs(nh - MH) > 6) { const k = nh / MH; drops.forEach(d => d.y *= k); MH = nh; FH = Math.round(FW * MH / MW); alloc(); texDim = ''; }
      // 포인터: 실제 입력이 있으면 그것으로, 없으면 자동 손가락
      const real = lastRealMove();
      if (real !== wasReal) { finger.on = false; wasReal = real; }     // 입력 주체가 바뀌면 점프 선을 긋지 않는다
      if (real) { wipe(mp.x * MW, (1 - mp.y) * MH); }
      else { autoT += dt; const p = autoPos(autoT); wipe(p[0], p[1]); }
      const steps = Math.min(3, Math.max(1, Math.round(dt * 30)));
      for (let s = 0; s < steps; s++) step(dt / steps);
      // 맵 렌더 (R,G=법선 xy · B=크기 · A=덮임)
      map32.fill(0x00008080);
      for (const d of drops) paint(d);
      for (let i = 0; i < fog.length; i++) fogU8[i] = fog[i] * 255;
      g.viewport(0, 0, w, h);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex.W);
      if (texDim !== MH) g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, MW, MH, 0, g.RGBA, g.UNSIGNED_BYTE, map); else g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, MW, MH, g.RGBA, g.UNSIGNED_BYTE, map);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, tex.F); g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
      if (texDim !== MH) g.texImage2D(g.TEXTURE_2D, 0, g.LUMINANCE, FW, FH, 0, g.LUMINANCE, g.UNSIGNED_BYTE, fogU8); else g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, FW, FH, g.LUMINANCE, g.UNSIGNED_BYTE, fogU8);
      texDim = MH;
      g.activeTexture(g.TEXTURE2); g.bindTexture(g.TEXTURE_2D, tex.S);
      g.activeTexture(g.TEXTURE3); g.bindTexture(g.TEXTURE_2D, tex.M);
      g.activeTexture(g.TEXTURE4); g.bindTexture(g.TEXTURE_2D, tex.B);
      g.uniform2f(u.R, w, h); g.uniform2f(u.MS, MW, MH); g.uniform1f(u.T, t);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); };
}
