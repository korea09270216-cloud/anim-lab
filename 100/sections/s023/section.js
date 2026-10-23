// ---- WebGL 공용 유틸 (이 섹션 전용 사본) ----
const PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const NOISE = 'float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*nz(p);p=p*2.03+vec2(11.3,7.1);a*=.5;}return s;}';
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
  const m = { x: .5, y: .5, vx: 0, vy: 0, in: false, t: 0 };
  const mv = e => { const r = canvas.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width, y = 1 - (e.clientY - r.top) / r.height; m.vx = x - m.x; m.vy = y - m.y; m.x = x; m.y = y; m.in = true; m.t = performance.now(); };
  const lv = () => { m.in = false; };
  root.addEventListener('pointermove', mv); root.addEventListener('pointerleave', lv);
  m.off = () => { root.removeEventListener('pointermove', mv); root.removeEventListener('pointerleave', lv); };
  return m;
}
// setup(g, canvas) → frame(t, w, h). 컨텍스트 생성 실패·셰이더 오류는 is-fallback 으로, 컨텍스트 lost/restored 는 재초기화.
function boot(root, ctx, canvas, scale, setup, glOpts) {
  let g = null, frame = null, vis = true, lost = false;
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { rootMargin: '80px' }); io.observe(root);
  function start() {
    try {
      g = canvas.getContext('webgl', Object.assign({ antialias: false, alpha: false, powerPreference: 'low-power' }, glOpts || {}));
      if (!g) throw 0;
      frame = setup(g, canvas); root.classList.remove('is-fallback');
    } catch (e) { frame = null; root.classList.add('is-fallback'); if (e) console.warn('[gl]', e.message || e); }
  }
  const onLost = e => { e.preventDefault(); lost = true; frame = null; };
  const onRest = () => { lost = false; start(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRest);
  start();
  const t0 = performance.now();
  const off = ctx.tick(() => {
    if (!frame || !vis || lost || !g || g.isContextLost()) return;
    fit(canvas, scale);
    try { frame((performance.now() - t0) / 1000, canvas.width, canvas.height); } catch (e) { frame = null; root.classList.add('is-fallback'); console.warn('[gl]', e.message || e); }
  });
  return () => { off(); io.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRest); };
}
// ---- /유틸 ----
const VSH = `attribute vec2 a0; attribute vec2 a1; attribute vec3 r;
uniform float tm,T,asp,ps; uniform vec2 M; varying vec3 vc;
void main(){
  float d=r.x*.38; float k=clamp((tm-d)/.62,0.,1.); k=k*k*k*(k*(k*6.-15.)+10.);
  vec2 pos=mix(a0,a1,k);
  float sc=sin(k*3.14159); float an=r.y*6.28318+T*.4*(r.z-.5);
  pos+=vec2(cos(an),sin(an))*(.15+r.z*.75)*sc*1.1;
  pos+=.006*vec2(sin(T*1.3+r.y*40.),cos(T*1.1+r.x*40.));
  vec2 dm=pos-M; float l=length(dm); pos+=dm/(l+.001)*exp(-l*l*38.)*.2;
  gl_Position=vec4(pos.x/asp,pos.y,0.,1.);
  gl_PointSize=ps*(.7+r.z*.9);
  vec3 ink=vec3(.106,.102,.09), red=vec3(.91,.263,.122), gold=vec3(.86,.62,.16);
  vc=r.x<.62?ink:(r.x<.9?red:gold); vc=mix(vc,red,sc*.35);
}`;
const FSH = `varying vec3 vc; void main(){ vec2 q=gl_PointCoord-.5; float a=smoothstep(.5,.3,length(q)); gl_FragColor=vec4(vc,a); }`;
const WORDS = ['BREW', '보리', '홉', '건배'];
const N = 5500;
function sample(word) {
  const W = 1200, H = 560, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';
  let size = 520; x.font = `900 ${size}px 'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif`;
  const w = x.measureText(word).width; size = Math.min(520, size * 1100 / w); x.font = x.font.replace(/\d+px/, size + 'px');
  x.fillText(word, W / 2, H / 2 + size * .04);
  const d = x.getImageData(0, 0, W, H).data, pts = [];
  for (let py = 0; py < H; py += 2) for (let px = 0; px < W; px += 2) if (d[(py * W + px) * 4 + 3] > 140) pts.push([px, py]);
  const out = new Float32Array(N * 2), s = 3.0 / W;
  for (let i = 0; i < N; i++) { const q = pts[(Math.random() * pts.length) | 0] || [W / 2, H / 2]; out[i * 2] = (q[0] - W / 2) * s + (Math.random() - .5) * .006; out[i * 2 + 1] = -(q[1] - H / 2) * s + .02 + (Math.random() - .5) * .006; }
  return out;
}
export default function init(root, ctx) {
  const canvas = root.querySelector('.s023__gl');
  const targets = WORDS.map(sample);
  const rnd = new Float32Array(N * 3); for (let i = 0; i < N * 3; i++) rnd[i] = Math.random();
  const mp = pointer(root, canvas);
  const lis = [...root.querySelectorAll('.s023__idx li')];
  const HOLD = 2.4, MOVE = 2.2, PER = HOLD + MOVE;
  let tOff = 0, curIdx = -1, mx = 9, my = 9;
  const click = () => { clickFlag = true; };
  let clickFlag = false;
  root.addEventListener('pointerdown', click);
  const off = boot(root, ctx, canvas, ctx.reduced ? .4 : .6, (g) => {
    const p = compile(g, FSH, VSH); g.useProgram(p);
    const loc = { a0: g.getAttribLocation(p, 'a0'), a1: g.getAttribLocation(p, 'a1'), r: g.getAttribLocation(p, 'r') };
    const bufs = targets.map(t => { const b = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, b); g.bufferData(g.ARRAY_BUFFER, t, g.STATIC_DRAW); return b; });
    const rb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, rb); g.bufferData(g.ARRAY_BUFFER, rnd, g.STATIC_DRAW);
    const u = U(g, p, 'tm T asp ps M');
    g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE_MINUS_SRC_ALPHA); g.clearColor(.945, .925, .882, 1);
    curIdx = -1;
    const bind = (i) => {
      g.bindBuffer(g.ARRAY_BUFFER, bufs[i % 4]); g.enableVertexAttribArray(loc.a0); g.vertexAttribPointer(loc.a0, 2, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, bufs[(i + 1) % 4]); g.enableVertexAttribArray(loc.a1); g.vertexAttribPointer(loc.a1, 2, g.FLOAT, false, 0, 0);
      g.bindBuffer(g.ARRAY_BUFFER, rb); g.enableVertexAttribArray(loc.r); g.vertexAttribPointer(loc.r, 3, g.FLOAT, false, 0, 0);
    };
    return (t, w, h) => {
      let te = t + tOff;
      if (clickFlag) { clickFlag = false; const lc = te % PER; if (lc < HOLD) tOff += HOLD - lc; te = t + tOff; }
      const idx = Math.floor(te / PER), lc = te - idx * PER, tm = Math.min(1, Math.max(0, (lc - HOLD) / MOVE));
      if (idx !== curIdx) { curIdx = idx; bind(idx); lis.forEach((li, i) => li.classList.toggle('is-on', i === (idx % 4))); }
      const asp = w / h; const tx = mp.in ? (mp.x * 2 - 1) * asp : 9, ty = mp.in ? mp.y * 2 - 1 : 9;
      mx += (tx - mx) * .25; my += (ty - my) * .25;
      g.viewport(0, 0, w, h); g.clear(g.COLOR_BUFFER_BIT);
      g.uniform1f(u.tm, tm); g.uniform1f(u.T, t); g.uniform1f(u.asp, asp); g.uniform1f(u.ps, h * .0068); g.uniform2f(u.M, mx, my);
      g.drawArrays(g.POINTS, 0, N);
    };
  });
  return () => { off(); mp.off(); root.removeEventListener('pointerdown', click); };
}
