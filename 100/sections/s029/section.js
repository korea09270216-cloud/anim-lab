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
const VSH = `attribute vec4 s; attribute float e;
uniform float uD,uLen,asp; varying vec3 vc; varying float vb;
void main(){
  float z=fract(s.z-uD); float zz=mix(.025,1.,z);
  float tail=min(zz*(1.+uLen),1.4);
  float zr=mix(zz,tail,e);
  vec2 p=s.xy/zr*.22;
  gl_Position=vec4(p.x/asp,p.y,0.,1.);
  float b=smoothstep(1.,.05,zz)*(1.-e*.9);
  vb=b*(.5+.6*s.w); vc=mix(vec3(.65,.78,1.),vec3(1.,.82,.5),step(.8,s.w));
}`;
const FSH = `varying vec3 vc; varying float vb; void main(){ gl_FragColor=vec4(vc*vb,vb); }`;
const N = 2600;
const PH = [['01 — 이륙', '지구를 두고<br>밤하늘로.'], ['02 — 가속', '별이 선이 되는<br>시간.'], ['03 — 도착', '고요한 궤도에<br>닿았습니다.']];
export default function init(root, ctx) {
  const canvas = root.querySelector('.s029__gl');
  const eye = root.querySelector('[data-eye]'), hh = root.querySelector('[data-h]'), vv = root.querySelector('[data-v]');
  let phase = 0;
  const setPhase = (i) => {
    if (i === phase) return; phase = i;
    gsap.timeline().to([eye, hh], { autoAlpha: 0, y: -20, duration: .35, ease: 'power3.in' })
      .add(() => { eye.textContent = PH[i][0]; hh.innerHTML = PH[i][1]; })
      .fromTo([eye, hh], { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .08 });
  };
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => setPhase(s.progress < .34 ? 0 : s.progress < .72 ? 1 : 2) });
  const sv = new Float32Array(N * 4 * 2), ev = new Float32Array(N * 2);
  for (let i = 0; i < N; i++) {
    const a = Math.random() * 6.2832, r = Math.pow(Math.random(), .6) * 1.5 + .05, z = Math.random(), w = Math.random();
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    for (let k = 0; k < 2; k++) { sv.set([x, y, z, w], (i * 2 + k) * 4); ev[i * 2 + k] = k; }
  }
  let sy = scrollY, vel = 0, dist = 0, warp = 0, last = 0, shown = '';
  const off = boot(root, ctx, canvas, ctx.reduced ? .4 : .55, (g) => {
    const p = compile(g, FSH, VSH); g.useProgram(p);
    const sb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, sb); g.bufferData(g.ARRAY_BUFFER, sv, g.STATIC_DRAW);
    const ls = g.getAttribLocation(p, 's'); g.enableVertexAttribArray(ls); g.vertexAttribPointer(ls, 4, g.FLOAT, false, 0, 0);
    const eb = g.createBuffer(); g.bindBuffer(g.ARRAY_BUFFER, eb); g.bufferData(g.ARRAY_BUFFER, ev, g.STATIC_DRAW);
    const le = g.getAttribLocation(p, 'e'); g.enableVertexAttribArray(le); g.vertexAttribPointer(le, 1, g.FLOAT, false, 0, 0);
    const u = U(g, p, 'uD uLen asp');
    g.enable(g.BLEND); g.blendFunc(g.ONE, g.ONE); g.clearColor(0, 0, 0, 0);
    return (t, w, h) => {
      const dt = Math.min(.05, t - last); last = t;
      const d = scrollY - sy; sy = scrollY; vel += (Math.abs(d) - vel) * .12;
      const target = Math.min(1, vel / 45) + .22 + .2 * Math.max(0, Math.sin(t * .8)); // idle 펄스: 스크롤이 없어도 주기적으로 워프
      warp += (target - warp) * (target > warp ? .1 : .035);
      dist += dt * (.015 + warp * .55);
      const sp = (warp * 4.2).toFixed(2); if (sp !== shown) { shown = sp; vv.textContent = sp; }
      g.viewport(0, 0, w, h); g.clear(g.COLOR_BUFFER_BIT);
      g.uniform1f(u.uD, dist); g.uniform1f(u.uLen, .03 + warp * 2.4); g.uniform1f(u.asp, w / h);
      g.drawArrays(g.LINES, 0, N * 2);
    };
  }, { alpha: true, premultipliedAlpha: true });
  return () => { off(); st.kill(); gsap.killTweensOf([eye, hh]); };
}
