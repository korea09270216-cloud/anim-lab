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
varying vec2 v; uniform vec2 R; uniform float T; uniform vec4 b[8]; uniform vec3 cl[8];
void main(){
  float asp=R.x/R.y; vec2 p=vec2(v.x*asp,v.y);
  float f=0.; vec2 gr=vec2(0.); vec3 acc=vec3(0.); float ws=0.; float fs=0.;
  for(int i=0;i<8;i++){
    vec2 d=p-b[i].xy; float d2=dot(d,d)+1e-4; float r2=b[i].z*b[i].z;
    float w=r2/d2; f+=w; gr+=-2.*r2*d/(d2*d2); acc+=cl[i]*w*w; ws+=w*w;
    vec2 ds=d-vec2(.02,-.03); fs+=r2/(dot(ds,ds)+1e-4);
  }
  vec3 bg=mix(vec3(1.,.84,.88),vec3(1.,.93,.86),v.y*.8+.1*sin(v.x*3.));
  bg*=1.-.12*smoothstep(.8,1.1,fs)*(1.-smoothstep(.95,1.2,f))-.0;
  float inside=smoothstep(.97,1.06,f);
  vec3 base=acc/max(ws,1e-4);
  float h=clamp((f-1.)/2.2,0.,1.);
  vec3 nrm=normalize(vec3(-gr*.016,.55+h*1.2));
  vec3 L=normalize(vec3(-.45,.6,.75));
  float dif=dot(nrm,L)*.5+.5;
  float spec=pow(max(dot(reflect(-L,nrm),vec3(0.,0.,1.)),0.),30.);
  float fr=pow(1.-nrm.z,2.);
  vec3 col=base*(.72+.5*dif)+vec3(1.,.95,.96)*spec*.85+fr*vec3(1.,.9,.95)*.35;
  col=mix(col,base*1.12+.08,h*.4);
  gl_FragColor=vec4(mix(bg,col,inside),1.);
}`;
const COL = [[1, .36, .5], [.35, .88, .72], [1, .86, .25], [.45, .52, 1], [1, .62, .45], [.85, .45, .95], [1, .36, .5], [.35, .88, .72]];
export default function init(root, ctx) {
  const canvas = root.querySelector('.s025__gl');
  const mp = pointer(root, canvas);
  const mb = { x: .5, y: .5, vx: 0, vy: 0 };
  const off = boot(root, ctx, canvas, ctx.reduced ? .3 : .45, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T b cl'); g.uniform3fv(u.cl, new Float32Array(COL.flat()));
    const arr = new Float32Array(32);
    let last = 0;
    return (t, w, h) => {
      const asp = w / h, dt = Math.min(.05, t - last); last = t;
      // 커서 방울 = 스프링-댐퍼. 커서가 없으면 느리게 8자 궤적
      const tx = mp.in ? mp.x : .5 + .2 * Math.sin(t * .5), ty = mp.in ? mp.y : .5 + .16 * Math.sin(t * .7 + 1);
      mb.vx += ((tx - mb.x) * 60 - mb.vx * 7.5) * dt; mb.vy += ((ty - mb.y) * 60 - mb.vy * 7.5) * dt; mb.x += mb.vx * dt; mb.y += mb.vy * dt;
      const sp = Math.min(.04, Math.hypot(mb.vx, mb.vy) * .025);
      const orb = (i, rx, ry, fx, fy, ph, r) => { arr[i * 4] = asp * (.5 + rx * Math.sin(t * fx + ph)); arr[i * 4 + 1] = .5 + ry * Math.sin(t * fy + ph * 1.7); arr[i * 4 + 2] = r * (1 + .06 * Math.sin(t * 1.3 + ph * 3)); arr[i * 4 + 3] = 0; };
      orb(0, .34, .3, .31, .43, 0, .13); orb(1, .3, .25, .41, .27, 1.7, .11); orb(2, .38, .28, .23, .37, 3.1, .145);
      orb(3, .26, .32, .47, .33, 4.4, .1); orb(4, .4, .22, .29, .51, 5.6, .12); orb(5, .2, .3, .53, .39, 2.3, .09); orb(6, .33, .18, .37, .21, 0.9, .105);
      arr[28] = mb.x * asp; arr[29] = mb.y; arr[30] = .115 + sp; arr[31] = 0;
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform4fv(u.b, arr);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); };
}
