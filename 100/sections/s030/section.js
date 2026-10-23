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
const FS = `
varying vec2 v; uniform sampler2D tx; uniform vec2 R,M; uniform float T,pg,mr;
float m2(float a,float b){ return 2.*a+3.*b-4.*a*b; }
float bayer(vec2 p){ p=floor(p); float x=mod(p.x,4.),y=mod(p.y,4.);
  float a=mod(x,2.),b=mod(y,2.),c=floor(x/2.),d=floor(y/2.);
  return (4.*m2(a,b)+m2(c,d)+.5)/16.; }
void main(){
  vec2 fc=v*R; float asp=R.x/R.y;
  float sweep=pg*1.5-v.x*.45-v.y*.15;
  float bub=smoothstep(mr,mr*.25,length((v-M)*vec2(asp,1.)));
  float r=clamp(sweep+bub,0.,1.);
  float B=floor(mix(26.,1.,pow(r,.55))+.5); B=max(B,1.);
  vec2 cell=floor(fc/B); vec2 uvp=(cell+.5)*B/R;
  vec3 c=texture2D(tx,uvp).rgb;
  float L=mix(4.,40.,r*r);
  float bd=bayer(fc/max(B*.5,1.))-.5;
  c=floor(c*L+.5+bd*.55*(1.-r*.8))/L;
  c=mix(c,texture2D(tx,v).rgb,smoothstep(.85,1.,r));
  gl_FragColor=vec4(c,1.);
}`;
function art(W, H) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const sky = x.createLinearGradient(0, 0, 0, H * .62); sky.addColorStop(0, '#3a1c71'); sky.addColorStop(.35, '#d76d77'); sky.addColorStop(.75, '#ffaf7b'); sky.addColorStop(1, '#ffe29a');
  x.fillStyle = sky; x.fillRect(0, 0, W, H);
  const sx = W * .62, sy = H * .5;
  const sun = x.createRadialGradient(sx, sy, 0, sx, sy, H * .3); sun.addColorStop(0, '#fffbe0'); sun.addColorStop(.4, '#fff1a8'); sun.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = sun; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff6c9'; x.beginPath(); x.arc(sx, sy, H * .105, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.35)'; [[.1, .2, .3, .02], [.45, .27, .35, .025], [.7, .16, .24, .018], [.05, .36, .26, .02]].forEach(([a, b, w, h]) => { x.fillRect(W * a, H * b, W * w, H * h); });
  const ridge = (base, amp, f, ph, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= W; i += 6) x.lineTo(i, H * base + Math.sin(i / W * f + ph) * H * amp + Math.sin(i / W * f * 2.7 + ph * 2) * H * amp * .35); x.lineTo(W, H); x.fill(); };
  ridge(.62, .06, 7, 1, '#7a3b6e'); ridge(.67, .05, 9, 3, '#3d2a6b');
  const sea = x.createLinearGradient(0, H * .66, 0, H); sea.addColorStop(0, '#ff9a76'); sea.addColorStop(.25, '#3aa6a0'); sea.addColorStop(1, '#0d3b5c'); x.fillStyle = sea; x.fillRect(0, H * .7, W, H * .3);
  x.fillStyle = '#fff2b0'; for (let i = 0; i < 14; i++) { const w = H * (.2 - i * .012), y = H * (.72 + i * .02); x.fillRect(sx - w / 2 + Math.sin(i * 2) * 8, y, w, 4 + i * .4); }
  x.fillStyle = '#1b1030'; x.beginPath(); x.moveTo(W * .2, H * .8); x.lineTo(W * .3, H * .8); x.lineTo(W * .28, H * .84); x.lineTo(W * .22, H * .84); x.fill();
  x.beginPath(); x.moveTo(W * .245, H * .79); x.lineTo(W * .245, H * .66); x.lineTo(W * .29, H * .785); x.fill();
  x.strokeStyle = '#1b1030'; x.lineWidth = 3; [[.4, .22], [.46, .25], [.5, .2]].forEach(([a, b]) => { x.beginPath(); x.moveTo(W * a, H * b); x.quadraticCurveTo(W * (a + .015), H * (b - .03), W * (a + .03), H * b); x.quadraticCurveTo(W * (a + .045), H * (b - .03), W * (a + .06), H * b); x.stroke(); });
  return c;
}
export default function init(root, ctx) {
  const canvas = root.querySelector('.s030__gl'); const mp = pointer(root, canvas);
  const pct = root.querySelector('[data-pct]'), bar = root.querySelector('[data-bar]');
  const tex = art(780, 600); const m = { x: .5, y: .5, r: 0 }; let shown = -1;
  const off = boot(root, ctx, canvas, ctx.reduced ? .45 : .6, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R M T pg mr tx'); g.uniform1i(u.tx, 0);
    const t0 = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t0); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, tex);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return (t, w, h) => {
      // 자동 현상 사이클: 점 → 선명(홀드) → 다시 점. 느린 사인을 smoothstep 으로 눌러 양 끝에서 머문다
      const s = .5 + .5 * Math.sin(t * .8 - 1.2); const pg = Math.min(1, Math.max(0, (s - .12) / .76)); const e = pg * pg * (3 - 2 * pg);
      m.x += ((mp.in ? mp.x : .5 + .3 * Math.sin(t * .9)) - m.x) * .12; m.y += ((mp.in ? mp.y : .5 + .2 * Math.cos(t * .7)) - m.y) * .12;
      m.r += ((mp.in ? .24 : .12) - m.r) * .06;
      const q = Math.round(e * 100); if (q !== shown) { shown = q; pct.textContent = q + '%'; bar.style.width = q + '%'; }
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform2f(u.M, m.x, m.y); g.uniform1f(u.T, t); g.uniform1f(u.pg, e); g.uniform1f(u.mr, m.r);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); };
}
