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
const SIM = NOISE + `
varying vec2 v; uniform sampler2D st; uniform vec2 px; uniform float T,asp; uniform vec4 sg[2]; uniform vec2 ss[2];
float cap(vec2 p,vec2 a,vec2 b){ vec2 pa=p-a, ba=b-a; float h=clamp(dot(pa,ba)/max(dot(ba,ba),1e-6),0.,1.); return length(pa-ba*h); }
void main(){
  vec2 p=v*3.2+vec2(T*.03,0.); float e=.02;
  float n1=fbm(p+vec2(0.,e))-fbm(p-vec2(0.,e)); float n2=fbm(p+vec2(e,0.))-fbm(p-vec2(e,0.));
  vec2 fl=vec2(n1,-n2)/(2.*e)*.00085;
  vec2 uv=v-fl;
  float c=texture2D(st,uv).r*.4;
  c+=(texture2D(st,uv+vec2(px.x,0.)).r+texture2D(st,uv-vec2(px.x,0.)).r+texture2D(st,uv+vec2(0.,px.y)).r+texture2D(st,uv-vec2(0.,px.y)).r)*.15;
  c=c*.9935-.0016;
  vec2 q=vec2(v.x*asp,v.y);
  for(int i=0;i<2;i++){
    float d=cap(q,sg[i].xy*vec2(asp,1.),sg[i].zw*vec2(asp,1.));
    float r=ss[i].x; float a=smoothstep(r,r*.25,d)*ss[i].y;
    float w=.75+.5*nz(q*70.);
    c=max(c,a*w);
  }
  gl_FragColor=vec4(clamp(c,0.,1.),0.,0.,1.);
}`;
const SHOW = NOISE + `
varying vec2 v; uniform sampler2D st; uniform vec2 R; uniform float T;
void main(){
  vec2 wob=vec2(fbm(v*9.+T*.02),fbm(v*9.+5.2))-.5;
  float d=texture2D(st,v+wob*.006).r;
  float body=smoothstep(.2,.5,d);
  float rim=smoothstep(.06,.2,d)-smoothstep(.2,.42,d);
  vec2 pp=v*R; float fib=fbm(pp*.9)*.5+fbm(pp*.12)*.5;
  vec3 paper=mix(vec3(.93,.895,.82),vec3(.885,.84,.76),fib);
  paper*=1.-.18*length(v-.5);
  float dry=smoothstep(.25,.75,fbm(v*R*.45))*.35*(1.-body*.2);
  vec3 ink=mix(vec3(.09,.075,.06),vec3(.2,.16,.12),dry);
  vec3 col=mix(paper,vec3(.62,.36,.22),rim*.28);
  col=mix(col,ink,body*.96);
  gl_FragColor=vec4(col,1.);
}`;
export default function init(root, ctx) {
  const canvas = root.querySelector('.s024__gl');
  const mp = pointer(root, canvas);
  let pm = null, pa = null;
  const off = boot(root, ctx, canvas, ctx.reduced ? .3 : .5, (g) => {
    const W = 384, H = 216;
    const ps = compile(g, SIM), pd = compile(g, SHOW); triangle(g);
    const us = U(g, ps, 'st px T asp sg ss'), ud = U(g, pd, 'st R T');
    const mk = () => { const t = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t); g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, W, H, 0, g.RGBA, g.UNSIGNED_BYTE, null); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE); const f = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, f); g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, t, 0); g.clearColor(0, 0, 0, 1); g.clear(g.COLOR_BUFFER_BIT); return { t, f }; };
    let A = mk(), B = mk(); pm = null; pa = null;
    const sg = new Float32Array(8), ss = new Float32Array(4);
    return (t, w, h) => {
      const asp = w / h;
      // 슬롯0 = 커서, 슬롯1 = 자동 붓(리사주 궤적, 끊겼다 이어지는 획)
      if (mp.in && performance.now() - mp.t < 120) {
        const c = [mp.x, mp.y], p = pm || c; const sp = Math.hypot((c[0] - p[0]) * asp, c[1] - p[1]);
        sg.set([p[0], p[1], c[0], c[1]], 0); ss[0] = .02 + Math.min(.03, sp * 1.2); ss[1] = .95; pm = c;
      } else { sg.set([0, 0, 0, 0], 0); ss[0] = .01; ss[1] = 0; pm = null; }
      const ph = t * .55, stroke = Math.sin(t * .31) > -.35;
      const ac = [.5 + .36 * Math.sin(ph * 1.0 + .6), .5 + .3 * Math.sin(ph * 1.37 + 1.2) * Math.cos(ph * .5)];
      if (stroke) { const p = pa || ac; sg.set([p[0], p[1], ac[0], ac[1]], 4); ss[2] = .012 + .014 * (.5 + .5 * Math.sin(t * 1.7)); ss[3] = .9; pa = ac; } else { sg.set([0, 0, 0, 0], 4); ss[2] = .01; ss[3] = 0; pa = null; }
      g.useProgram(ps); g.bindFramebuffer(g.FRAMEBUFFER, B.f); g.viewport(0, 0, W, H);
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, A.t); g.uniform1i(us.st, 0);
      g.uniform2f(us.px, 1 / W, 1 / H); g.uniform1f(us.T, t); g.uniform1f(us.asp, asp); g.uniform4fv(us.sg, sg); g.uniform2fv(us.ss, [ss[0], ss[1], ss[2], ss[3]]);
      g.drawArrays(g.TRIANGLES, 0, 3);
      g.useProgram(pd); g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h);
      g.bindTexture(g.TEXTURE_2D, B.t); g.uniform1i(ud.st, 0); g.uniform2f(ud.R, w, h); g.uniform1f(ud.T, t);
      g.drawArrays(g.TRIANGLES, 0, 3);
      const x = A; A = B; B = x;
    };
  });
  return () => { off(); mp.off(); };
}
