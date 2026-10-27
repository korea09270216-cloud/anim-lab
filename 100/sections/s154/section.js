// s154 — 캔버스 글자 → 정확 거리장(EDT) → 압출+베벨 SDF 레이마칭 → 유리/크롬
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
  const m = { x: .5, y: .5, in: false };
  const mv = e => { const r = canvas.getBoundingClientRect(); m.x = (e.clientX - r.left) / r.width; m.y = 1 - (e.clientY - r.top) / r.height; m.in = true; };
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

// ================= 글자 → 부호 거리장 =================
const WORDS = ['맑음', '투명', '결', '빛'];
const CHROME = [0, 0, 1, 1];            // 단어별 재질: 0 유리 · 1 크롬
const TW = 384, TH = 192;               // SDF 텍스처 크기 (월드 6×3 단위를 덮는다 → 1텍셀 = 6/384)
const RT = 18;                          // 거리 저장 범위(텍셀) — ±RT 를 8bit 로 양자화
const FONT = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif";
const INF = 1e20;

// Felzenszwalb–Huttenlocher 1D 제곱 거리변환 (정확한 유클리드, O(n))
function edt1d(f, n, d, v, z) {
  let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const dq = q - v[k]; d[q] = dq * dq + f[v[k]]; }
}
function edt2d(grid, w, h) {            // grid: 소스=0, 그 외=INF 로 채운 Float64Array → 제곱거리로 덮어쓴다
  const m = Math.max(w, h), f = new Float64Array(m), d = new Float64Array(m), v = new Int32Array(m), z = new Float64Array(m + 1);
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) f[y] = grid[y * w + x]; edt1d(f, h, d, v, z); for (let y = 0; y < h; y++) grid[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { for (let x = 0; x < w; x++) f[x] = grid[y * w + x]; edt1d(f, w, d, v, z); for (let x = 0; x < w; x++) grid[y * w + x] = d[x]; }
}
function wordSDF(word) {
  const S = 2, W = TW * S, H = TH * S;                   // 2× 오버샘플로 계산해 계단 노이즈를 줄인다
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#fff'; x.strokeStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round';
  const fs = H * .74; x.font = `900 ${fs}px ${FONT}`; x.lineWidth = fs * .05;
  x.strokeText(word, W / 2, H * .53); x.fillText(word, W / 2, H * .53);
  const px = x.getImageData(0, 0, W, H).data;
  const gi = new Float64Array(W * H), go = new Float64Array(W * H), ins = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) { const on = px[i * 4] > 127; ins[i] = on; gi[i] = on ? 0 : INF; go[i] = on ? INF : 0; }
  edt2d(gi, W, H); edt2d(go, W, H);                      // gi: 가장 가까운 '안쪽' 까지, go: 가장 가까운 '바깥' 까지
  const sd = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) sd[i] = ins[i] ? -(Math.sqrt(go[i]) - .5) : (Math.sqrt(gi[i]) - .5);
  // 2×2 평균 다운샘플 + 3×3 이항 블러 (단위: 최종 텍셀)
  const a = new Float32Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let xx = 0; xx < TW; xx++) {
    const i = (y * 2) * W + xx * 2; a[y * TW + xx] = (sd[i] + sd[i + 1] + sd[i + W] + sd[i + W + 1]) * .25 / S;
  }
  const out = new Uint8Array(TW * TH);
  for (let y = 0; y < TH; y++) for (let xx = 0; xx < TW; xx++) {
    let s = 0, wsum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const X = Math.min(TW - 1, Math.max(0, xx + dx)), Y = Math.min(TH - 1, Math.max(0, y + dy)), k = (dx ? 1 : 2) * (dy ? 1 : 2);
      s += a[Y * TW + X] * k; wsum += k;
    }
    const d = s / wsum / RT;                              // [-1,1]
    out[y * TW + xx] = Math.max(0, Math.min(255, Math.round(128 + 127 * d)));
  }
  return out;
}

// ================= 셰이더 =================
const FS = `
varying vec2 v; uniform vec2 R; uniform float T; uniform vec2 CAM; uniform float MX; uniform float CH;
uniform sampler2D A; uniform sampler2D B;
const vec2 HS=vec2(3.,1.5);
const float RW=${RT}.*6./${TW}.;          // 저장 범위(월드 단위)
const float DEP=.21, BEV=.075, FY=-1.5;
const vec3 BG=vec3(.9,.925,.95);
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

// ---- 2D 거리장 (텍스처 + 범위 밖 박스 거리) / 압출·베벨 ----
float sdf2(vec2 p){
  vec2 uv=vec2(p.x/(2.*HS.x)+.5,.5-p.y/(2.*HS.y));
  vec2 q=clamp(uv,vec2(.002),vec2(.998));
  float a=(texture2D(A,q).r*255.-128.)/127.;
  if(MX>.002){ float b=(texture2D(B,q).r*255.-128.)/127.; a=mix(a,b,MX); }
  return a*RW+length(max(abs(p)-HS,0.));
}
float glyph(vec3 p){
  vec2 w=vec2(sdf2(p.xy)+BEV,abs(p.z)-(DEP-BEV));
  return min(max(w.x,w.y),0.)+length(max(w,0.))-BEV;
}
vec3 nor(vec3 p){vec2 e=vec2(.011,-.011);return normalize(e.xyy*glyph(p+e.xyy)+e.yyx*glyph(p+e.yyx)+e.yxy*glyph(p+e.yxy)+e.xxx*glyph(p+e.xxx));}
vec2 box(vec3 ro,vec3 rd,vec3 b){vec3 m=1./rd,n=m*ro,k=abs(m)*b;vec3 t1=-n-k,t2=-n+k;return vec2(max(max(t1.x,t1.y),t1.z),min(min(t2.x,t2.y),t2.z));}

// ---- 스튜디오 환경 (반사·굴절 대상) ----
float rect(vec2 p,vec2 c,vec2 h,float s){vec2 d=abs(p-c)-h;return 1.-smoothstep(-s,s,max(d.x,d.y));}
vec3 floorCol(vec2 xz){
  vec2 q=xz*.5; vec2 f=abs(fract(q)-.5); float ln=smoothstep(.455,.5,max(f.x,f.y));
  float chk=mod(floor(q.x)+floor(q.y),2.);
  return mix(vec3(.8,.83,.88),vec3(.96,.97,.985),chk)*(1.-.2*ln);
}
vec3 env(vec3 d){
  float y=d.y, az=atan(d.x,d.z)+T*.045;
  vec3 c;
  if(y>=0.){
    c=mix(vec3(.93,.95,.98),vec3(.42,.58,.8),smoothstep(0.,.85,y));
  }else{
    vec2 xz=d.xz*(-2.2/min(y,-.02));                     // 바닥 평면(대략 글자 아래)에 투영한 타일
    vec3 fc=floorCol(xz); float fog=1.-exp(-length(xz)*.07);
    c=mix(fc,BG*.9,fog);
  }
  c*=1.-.62*exp(-pow((y+.02)/.055,2.));                // 수평선의 어두운 띠 → 크롬 대비
  // 소프트박스 2 + 스트립 + 어두운 플래그 (방위각/고도 평면 좌표)
  vec2 ae=vec2(az,y*1.7);
  c+=rect(ae,vec2(-.85,.62),vec2(.55,.3),.1)*vec3(1.,.96,.88)*3.6;
  c+=rect(ae,vec2(1.45,.42),vec2(.2,.7),.08)*vec3(.7,.9,1.)*3.;
  c+=rect(ae,vec2(1.95,.3),vec2(.07,.6),.04)*vec3(1.,.55,.4)*3.;
  c+=rect(ae,vec2(2.6,.7),vec2(.55,.1),.08)*vec3(1.,.9,.8)*2.;
  // 창틀 격자 (굴절에 쓸 디테일)
  float win=rect(ae,vec2(-2.4,.45),vec2(.65,.5),.04);
  vec2 g=abs(fract((ae-vec2(-3.05,-.05))*vec2(4.6,3.2))-.5);
  win*=1.-.92*smoothstep(.43,.5,max(g.x,g.y));
  c=mix(c,vec3(1.1,1.06,1.),win*.9);
  c*=1.-.55*rect(ae,vec2(0.35,.1),vec2(.1,.9),.05);       // 어두운 세로 플래그
  c*=1.-.45*rect(ae,vec2(-1.9,-.2),vec2(.07,.8),.05);
  return c;
}

float shadow(vec3 ro,vec3 rd){
  vec2 b=box(ro,rd,vec3(3.4,1.9,.9)); if(b.x>=b.y||b.y<0.) return 1.;
  float res=1.,t=max(.05,b.x);
  for(int i=0;i<22;i++){ float h=glyph(ro+rd*t); res=min(res,6.*h/t); t+=clamp(h*.8,.05,.45); if(res<.02||t>b.y)break; }
  return smoothstep(0.,1.,res);
}

vec3 shadeGlyph(vec3 p,vec3 rd){
  vec3 n=nor(p);
  float cs=clamp(dot(-rd,n),0.,1.), fr=pow(1.-cs,5.);
  vec3 rf=env(reflect(rd,n));
  vec3 chrome=rf*mix(vec3(.62,.66,.72),vec3(1.),fr)*1.05;
  vec3 col=chrome;
  if(CH<.995){
    // 유리: 내부로 마칭 → 출구 법선에서 채널별 IOR 로 재굴절 (분산)
    vec3 rdi=refract(rd,n,1./1.5);
    float t=.03; vec3 q=p+rdi*t;
    for(int i=0;i<18;i++){ q=p+rdi*t; float d=glyph(q); if(d>-.004)break; t+=max(-d,.02); }
    vec3 n2=nor(q);
    vec3 N=-n2;
    vec3 r0=refract(rdi,N,1.46), r1=refract(rdi,N,1.52), r2=refract(rdi,N,1.60);
    if(dot(r0,r0)<.5) r0=reflect(rdi,N);
    if(dot(r1,r1)<.5) r1=reflect(rdi,N);
    if(dot(r2,r2)<.5) r2=reflect(rdi,N);
    vec3 tr=vec3(env(r0).r,env(r1).g,env(r2).b);
    vec3 tint=exp(-t*vec3(.7,.2,.3));
    vec3 gl=tr*tint*(1.-.55*fr)+rf*(.06+.94*fr)*1.3;
    col=mix(gl,chrome,CH);
  }
  return col;
}

void main(){
  vec2 uv=(v-.5)*vec2(R.x/R.y,1.); uv.y-=.06;
  float yaw=CAM.x, pit=CAM.y;
  vec3 ro=7.3*vec3(sin(yaw)*cos(pit),sin(pit),cos(yaw)*cos(pit));
  vec3 ww=normalize(-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uu*uv.x+vv*uv.y+ww*1.5);
  vec3 col;
  vec2 bx=box(ro,rd,vec3(3.15,1.65,.5));
  float t=0.; bool hit=false;
  if(bx.x<bx.y&&bx.y>0.){
    t=max(bx.x,0.);
    for(int i=0;i<64;i++){ float d=glyph(ro+rd*t); if(d<.0018){hit=true;break;} t+=d*(MX>.002?.7:.88); if(t>bx.y)break; }
  }
  if(hit){
    col=shadeGlyph(ro+rd*t,rd);
  }else if(rd.y<-.0005){
    float tf=(FY-ro.y)/rd.y; vec3 p=ro+rd*tf;
    vec3 L=normalize(vec3(-.42,.9,.5));
    float sh=shadow(p+vec3(0.,.02,0.),L);
    vec3 fc=floorCol(p.xz);
    // 글자 바로 아래 은은한 접촉 그림자
    float ao=1.-.25*exp(-pow(length(vec2(max(abs(p.x)-2.9,0.),p.z*1.2))*.9,2.))*(.4+.6*smoothstep(-3.,3.,3.-abs(p.x)));
    fc*=(.62+.38*sh)*ao;
    float fog=1.-exp(-tf*.055);
    col=mix(fc,BG,clamp(fog,0.,1.));
  }else{
    col=mix(BG,vec3(.62,.74,.9),smoothstep(0.,.5,rd.y));
  }
  vec3 sh2=max(col-.82,0.); col=min(col,.82)+.18*(1.-exp(-sh2*5.));   // 소프트 숄더
  col*=1.-.12*dot(v-.5,v-.5)*1.6;
  col+=(hsh(gl_FragCoord.xy+T)-.5)/200.;
  gl_FragColor=vec4(col,1.);
}`;

export default function init(root, ctx) {
  const canvas = root.querySelector('.s154__gl');
  const chips = [...root.querySelectorAll('.s154__chips button')];
  const mp = pointer(root, canvas);
  const sdf = [];                                   // 단어별 8bit SDF (지연 생성)
  const st = { cur: 0, nxt: 0, m: 0, busy: false };
  const cam = { x: 0, y: .1, tx: 0, ty: .1 };
  let alive = true, tex = [], texReady = [];
  const timers = [];

  // 처음 두 단어는 즉시, 나머지는 한가할 때 하나씩 생성
  sdf[0] = wordSDF(WORDS[0]); sdf[1] = wordSDF(WORDS[1]);
  const lazy = i => { if (!alive || i >= WORDS.length) return; sdf[i] = wordSDF(WORDS[i]); upload(i); timers.push(setTimeout(() => lazy(i + 1), 250)); };
  timers.push(setTimeout(() => lazy(2), 600));

  let gl = null;
  function upload(i) {
    if (!gl || !sdf[i] || gl.isContextLost()) return;
    if (!tex[i]) tex[i] = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex[i]);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, TW, TH, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, sdf[i]);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    texReady[i] = true;
  }
  const ready = i => !!sdf[i];

  function go(i) {
    if (!ready(i) || i === st.cur || st.busy) return;
    st.busy = true; st.nxt = i; st.m = 0;
    chips.forEach((b, k) => b.classList.toggle('is-on', k === i));
    gsap.to(st, { m: 1, duration: ctx.reduced ? .01 : 1.5, ease: 'power3.inOut', onComplete() { st.cur = st.nxt; st.m = 0; st.busy = false; } });
  }
  const onChip = e => { const b = e.target.closest('button'); if (b) { auto = false; go(+b.dataset.i); } };
  root.querySelector('.s154__chips').addEventListener('click', onChip);
  let auto = true;
  timers.push(setInterval(() => { if (!auto || document.hidden) return; let k = (st.cur + 1) % WORDS.length; if (ready(k)) go(k); }, 5200));

  const off = boot(root, ctx, canvas, ctx.reduced ? .25 : .35, (g) => {
    gl = g; tex = []; texReady = [];
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T CAM MX CH A B');
    for (let i = 0; i < WORDS.length; i++) upload(i);
    g.uniform1i(u.A, 0); g.uniform1i(u.B, 1);
    return (t, w, h) => {
      const tx = mp.in ? mp.x : .5 + .26 * Math.sin(t * .31), ty = mp.in ? mp.y : .5 + .1 * Math.sin(t * .23 + 1);
      cam.tx = (tx - .5) * 1.7; cam.ty = .08 + (ty - .5) * .55;
      cam.x += (cam.tx - cam.x) * .06; cam.y += (cam.ty - cam.y) * .06;   // 감쇠 추종
      const a = st.cur, b = st.busy ? st.nxt : st.cur;
      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tex[a]);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, tex[b]);
      g.viewport(0, 0, w, h);
      g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform2f(u.CAM, cam.x, cam.y);
      g.uniform1f(u.MX, st.busy ? st.m : 0);
      g.uniform1f(u.CH, CHROME[a] + (CHROME[b] - CHROME[a]) * (st.busy ? st.m : 0));
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { alive = false; off(); mp.off(); timers.forEach(clearTimeout); timers.forEach(clearInterval); gsap.killTweensOf(st); root.querySelector('.s154__chips').removeEventListener('click', onChip); };
}
