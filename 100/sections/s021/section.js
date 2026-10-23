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
const FS = NOISE + `
varying vec2 v; uniform vec2 R; uniform float T; uniform vec4 rp[8];
float H(vec2 u){ float s=0.; for(int i=0;i<8;i++){ float age=T-rp[i].z; if(age>0.&&age<5.){ float l=length(u-rp[i].xy); float x=l-age*.30; s+=sin(x*52.)*exp(-x*x*70.)*exp(-age*.75)*rp[i].w; } } return s; }
void main(){
  float asp=R.x/R.y; vec2 u=v*vec2(asp,1.);
  float e=.003; float h0=H(u); vec2 g=vec2(H(u+vec2(e,0.))-h0,H(u+vec2(0.,e))-h0)/e;
  vec2 p=u+g*.011;
  vec2 q=p*1.7+vec2(0.,T*.012);
  float w=fbm(q); float w2=fbm(q*1.2+w*2.6+3.1); float w3=fbm(q*2.1-w2*1.7+9.);
  float v1=abs(sin((q.x*.7+q.y*1.15+w2*5.2)*3.14159)); float vein=1.-smoothstep(0.,.1,v1);
  float v2=abs(sin((q.x*-.5+q.y*.9+w3*6.)*3.14159)); float vein2=1.-smoothstep(0.,.07,v2);
  vec3 base=mix(vec3(.93,.91,.87),vec3(.82,.80,.74),smoothstep(.25,.75,w));
  vec3 col=base;
  col=mix(col,vec3(.55,.60,.55),smoothstep(.55,.9,w2)*.35);
  col=mix(col,vec3(.09,.20,.17),vein*.78);
  col=mix(col,vec3(.72,.55,.24),vein2*.55);
  vec3 nn=normalize(vec3(-g*.05,1.));
  float spec=pow(max(dot(nn,normalize(vec3(-.35,.55,.75))),0.),36.);
  float shade=dot(nn,normalize(vec3(-.3,.4,.8)))-.9;
  col+=spec*.55+shade*.9;
  col*=1.-.22*length(v-.5);
  gl_FragColor=vec4(col,1.);
}`;
export default function init(root, ctx) {
  const canvas = root.querySelector('.s021__gl');
  const mp = pointer(root, canvas);
  const rip = []; for (let i = 0; i < 8; i++) rip.push({ x: 0, y: 0, t: -100, a: 0 });
  let ri = 0, tNow = 0, lastX = -1, lastY = -1, nextAuto = 0.6;
  const drop = (x, y, a) => { rip[ri] = { x, y, t: tNow, a }; ri = (ri + 1) % 8; };
  const el = root.querySelector('.s021__h');
  const off = boot(root, ctx, canvas, ctx.reduced ? .3 : .42, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T rp'); const arr = new Float32Array(32);
    return (t, w, h) => {
      tNow = t; const asp = w / h;
      // 포인터가 일정 거리 이상 움직이면 파문 생성
      const px = mp.x * asp, py = mp.y;
      if (mp.in && Math.hypot(px - lastX, py - lastY) > .09) { drop(px, py, .014 + Math.min(.02, Math.hypot(mp.vx, mp.vy) * .5)); lastX = px; lastY = py; }
      if (t > nextAuto) { drop((.12 + Math.random() * .76) * asp, .15 + Math.random() * .7, .018 + Math.random() * .01); nextAuto = t + 1.1 + Math.random() * 1.1; }
      rip.forEach((r, i) => { arr[i * 4] = r.x; arr[i * 4 + 1] = r.y; arr[i * 4 + 2] = r.t; arr[i * 4 + 3] = r.a; });
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform4fv(u.rp, arr);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  // 타이틀이 커서에 살짝 끌려오는 감쇠 반응
  const qx = gsap.quickTo(el, 'x', { duration: 1.2, ease: 'expo.out' }), qy = gsap.quickTo(el, 'y', { duration: 1.2, ease: 'expo.out' });
  const mv = e => { qx((e.clientX / innerWidth - .5) * -22); qy((e.clientY / innerHeight - .5) * -14); };
  root.addEventListener('pointermove', mv);
  gsap.from(el, { yPercent: 18, autoAlpha: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 80%' } });
  return () => { off(); mp.off(); root.removeEventListener('pointermove', mv); };
}
