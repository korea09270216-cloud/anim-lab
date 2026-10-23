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
varying vec2 v; uniform sampler2D tx; uniform vec2 R; uniform float T,gl,my;
float hh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){
  vec2 c=v*2.-1.; c*=1.+dot(c,c)*.075; vec2 uv=c*.5+.5;
  float inb=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
  float ln=floor(uv.y*180.); float tk=floor(T*14.);
  float tear=step(.965-gl*.12,hh(vec2(ln*.37,tk)))*(hh(vec2(ln,tk))-.5)*(.012+gl*.07);
  float roll=fract(T*.1+0.); float rb=smoothstep(.12,0.,abs(uv.y-(1.-roll)))+smoothstep(.1,0.,abs(uv.y-my))*gl;
  uv.x+=tear+rb*.012*sin(uv.y*90.+T*20.);
  float sh=.0025+gl*.011+rb*.007;
  vec3 col=vec3(texture2D(tx,uv+vec2(sh,0.)).r,texture2D(tx,uv).g,texture2D(tx,uv-vec2(sh,0.)).b);
  col+=rb*.09;
  float sl=.82+.18*sin(v.y*R.y*3.14159);
  col*=sl; col*=1.+.04*sin(T*60.);
  float gr=hh(v*R+vec2(T*53.,T*17.))-.5; col+=gr*(.13+gl*.18);
  col*=1.-.55*dot(v-.5,v-.5)*2.1;
  col*=inb;
  gl_FragColor=vec4(col,1.);
}`;
function draw(x, W, H, t) {
  const F = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#12062b'); g.addColorStop(.55, '#6a1b9a'); g.addColorStop(.62, '#e91e63'); g.addColorStop(1, '#1a0a30');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  // 태양 + 가로 슬릿(흘러내림)
  const cx = W / 2, cy = H * .5, r = H * .27;
  const sg = x.createLinearGradient(0, cy - r, 0, cy + r); sg.addColorStop(0, '#ffe53b'); sg.addColorStop(.55, '#ff5e8a'); sg.addColorStop(1, '#c2185b');
  x.save(); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.clip(); x.fillStyle = sg; x.fillRect(cx - r, cy - r, r * 2, r * 2);
  x.fillStyle = '#6a1b9a'; for (let i = 0; i < 9; i++) { const yy = cy + r * .05 + i * r * .13 + ((t * 9) % (r * .13)); x.fillRect(cx - r, yy, r * 2, 1 + i * .75); } x.restore();
  // 바닥 그리드
  const hy = H * .62; x.fillStyle = '#14052e'; x.fillRect(0, hy, W, H - hy); x.strokeStyle = '#ff2d95'; x.lineWidth = 1;
  for (let i = -14; i <= 14; i++) { x.beginPath(); x.moveTo(cx + i * 6, hy); x.lineTo(cx + i * 70, H); x.stroke(); }
  for (let k = 0; k < 9; k++) { const f = ((k + (t * .45) % 1) / 9); const yy = hy + (f * f) * (H - hy); x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
  // 타이틀
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `900 ${H * .17}px ${F}`; x.fillStyle = '#1a0a30'; x.fillText('다시, 감기', cx + 4, H * .27 + 4);
  x.fillStyle = '#fff6d6'; x.fillText('다시, 감기', cx, H * .27);
  x.font = `800 ${H * .035}px ${F}`; x.fillStyle = '#7ef9ff'; x.fillText('FILMROAD VIDEO RENTAL  ·  SINCE 1993', cx, H * .39);
  // OSD
  x.textAlign = 'left'; x.font = `700 ${H * .05}px 'Consolas','Courier New',monospace`; x.fillStyle = '#fff';
  if ((t * 1.5 | 0) % 2 === 0) x.fillText('▶ PLAY', W * .05, H * .09);
  x.textAlign = 'right'; const s = (t | 0) + 754; x.fillText(`SP  0:${String((s / 60) | 0).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`, W * .95, H * .09);
  x.textAlign = 'left'; x.fillText('CH 03', W * .05, H * .94);
  // 컬러 바
  const cols = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0']; const bw = W * .3 / 7; cols.forEach((c, i) => { x.fillStyle = c; x.fillRect(W * .36 + i * bw, H * .9, bw, H * .05); });
}
export default function init(root, ctx) {
  const canvas = root.querySelector('.s027__gl'); const mp = pointer(root, canvas);
  const src = document.createElement('canvas'); src.width = 640; src.height = 360; const sx = src.getContext('2d');
  let gl = 0, my = .5;
  const off = boot(root, ctx, canvas, ctx.reduced ? .35 : .5, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T gl my tx'); g.uniform1i(u.tx, 0);
    const t0 = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t0); g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return (t, w, h) => {
      draw(sx, 640, 360, t);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, src);
      // 커서 속도 → 글리치. idle 도 주기적으로 한 번씩 튄다
      const sp = mp.in ? Math.min(1, Math.hypot(mp.vx, mp.vy) * 14) : 0; mp.vx *= .8; mp.vy *= .8;
      const burst = Math.pow(Math.max(0, Math.sin(t * .9)), 14) * .7;
      gl += (Math.max(sp, burst) - gl) * .2; if (mp.in) my += (mp.y - my) * .3; else my = 1 - (t * .1) % 1;
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform1f(u.gl, gl); g.uniform1f(u.my, my);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); };
}
