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
const VERT = `
uniform float uT; uniform vec3 uM; uniform float uS; varying float vH; varying vec3 vN;
float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
  vec3 n=normalize(position);
  float d=n3(n*2.2+vec3(0.,uT*.35,uT*.2))*.34+n3(n*5.+uT*.5)*.07;
  float b=pow(max(dot(n,uM),0.),7.)*uS;
  float h=d+b*.75; vH=h; vN=n;
  vec3 p=n*(1.45+h-.17);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
}`;
const FRAG_L = `varying float vH; void main(){ gl_FragColor=vec4(mix(vec3(.06,.08,.03),vec3(.35,.5,0.),smoothstep(.25,.8,vH)),1.); }`;
const FRAG_S = `varying float vH; varying vec3 vN; void main(){ vec3 c=mix(vec3(.78,.96,.12),vec3(.93,1.,.45),smoothstep(.1,.7,vH)); c*=.9+.1*vN.y; gl_FragColor=vec4(c,1.); }`;
export default function init(root, ctx) {
  const canvas = root.querySelector('.s028__gl');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, premultipliedAlpha: true, powerPreference: 'low-power' }); }
  catch (e) { root.classList.add('is-fallback'); return () => {}; }
  const PR = ctx.reduced ? .4 : .6;
  renderer.setPixelRatio(PR); renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(36, 1, .1, 50); cam.position.set(0, 0, 6.2);
  const uni = { uT: { value: 0 }, uM: { value: new THREE.Vector3(0, 0, 1) }, uS: { value: 0 } };
  const geo = new THREE.IcosahedronGeometry(1, 9);
  const solid = new THREE.Mesh(geo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG_S, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
  const wgeo = new THREE.WireframeGeometry(geo);
  const lines = new THREE.LineSegments(wgeo, new THREE.ShaderMaterial({ uniforms: uni, vertexShader: VERT, fragmentShader: FRAG_L }));
  const grp = new THREE.Group(); grp.add(solid, lines); grp.position.x = 1.35; scene.add(grp);
  const rings = [];
  [[2.1, .35, 0], [2.5, -.5, 1.1]].forEach(([r, tx, tz]) => {
    const pts = []; for (let i = 0; i <= 128; i++) { const a = i / 128 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
    const l = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x10130a, transparent: true, opacity: .55 }));
    l.rotation.set(tx, 0, tz); grp.add(l); rings.push(l);
  });
  let lostFlag = false, vis = true, w0 = 0, h0 = 0;
  const onLost = () => { lostFlag = true; }, onRest = () => { lostFlag = false; renderer.setClearColor(0x000000, 0); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRest);
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { rootMargin: '80px' }); io.observe(root);
  const mp = pointer(root, canvas); const mm = new THREE.Vector3(0, 0, 1), tmp = new THREE.Vector3(), q = new THREE.Quaternion();
  let st = 0; const t0 = performance.now();
  const off = ctx.tick(() => {
    if (!vis || lostFlag) return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (w !== w0 || h !== h0) { w0 = w; h0 = h; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); grp.position.x = w / h > 1.2 ? 1.35 : 0; }
    const t = (performance.now() - t0) / 1000; uni.uT.value = t;
    // 커서가 없을 땐 가상 포인터가 구체 위를 천천히 훑는다
    const ax = mp.in ? (mp.x - .5) * 2 : Math.sin(t * .8) * .7, ay = mp.in ? (mp.y - .5) * 2 : Math.cos(t * .6) * .5;
    const target = mp.in ? 1 : .55; st += (target - st) * .05; uni.uS.value = st * (1.1 + .3 * Math.sin(t * 2));
    grp.rotation.y = t * .18; grp.rotation.x = Math.sin(t * .3) * .15;
    rings[0].rotation.y = t * .25; rings[1].rotation.y = -t * .18;
    tmp.set(ax * 1.1 - (grp.position.x / 2.4), ay * .8, .9).normalize();
    grp.updateMatrixWorld(); q.copy(grp.quaternion).invert(); tmp.applyQuaternion(q);
    mm.lerp(tmp, .12).normalize(); uni.uM.value.copy(mm);
    try { renderer.render(scene, cam); } catch (e) { root.classList.add('is-fallback'); }
  });
  return () => { off(); io.disconnect(); mp.off(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRest); geo.dispose(); wgeo.dispose(); renderer.dispose(); };
}
