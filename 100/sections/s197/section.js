// s197 — 풀장 코스틱: 128² 파동방정식 높이장(CPU) + 굴절 메시 면적비 코스틱(CPU 래스터) + 프래그먼트 한 패스 렌더
// ---- WebGL 공용 유틸 (이 섹션 전용 사본) ----
const PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const NOISE = 'float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+vec2(1.,1.)),f.x),f.y);}';
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
    if (!frame || !vis || lost || !g || g.isContextLost() || document.hidden) return;
    fit(canvas, scale);
    try { frame((performance.now() - t0) / 1000, canvas.width, canvas.height); } catch (e) { frame = null; root.classList.add('is-fallback'); console.warn('[gl]', e.message || e); }
  });
  return () => { off(); io.disconnect(); canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRest); };
}
// ---- /유틸 ----

// ================= 상수 =================
const N = 128, NN = N * N, W2 = N + 2;      // 높이장 해상도(+고스트 1겹)
const S = 256;                               // 코스틱 버퍼 해상도
const D = 0.9;                               // 풀 깊이 (수면 y=0, 바닥 y=-D, 풀 x,z ∈ [-1,1])
const ETA = 1 / 1.333;                       // 공기→물 굴절비
const BMAX = 8;                              // 코스틱 밝기 인코딩 상한
const DXW = 2 / (N - 1);                     // 격자 간격(월드)
const KW = 1.5;                              // 파동 강성 (속도형 스킴, <2 이면 안정)
const SUB_HZ = 80;                           // 고정 서브스텝 주파수
const FOC = 1.7;                            // 카메라 초점
const ASPL = 1.0;                            // 이보다 작은 삼각형은 중심 스플랫
const A0 = 0.5 * (S / (N - 1)) * (S / (N - 1)); // 평평한 수면일 때 삼각형 면적(px²) = oldArea

const norm3 = v => { const l = Math.hypot(v[0], v[1], v[2]); return [v[0] / l, v[1] / l, v[2] / l]; };
const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const SUN = norm3([.13, .88, .40]);         // 태양 방향(코스틱·데크). 카메라 쪽에서 들어온다
const SG = norm3([-.2, .34, -.92]);          // 수면 반사 하이라이트용 가상 태양(하늘 반사)
const IL = [-SUN[0], -SUN[1], -SUN[2]];
const LD = (() => { // 평평한 수면에서의 굴절광 방향
  const c = IL[1], k = 1 - ETA * ETA * (1 - c * c), q = ETA * c + Math.sqrt(k);
  return [ETA * IL[0], ETA * IL[1] - q, ETA * IL[2]];
})();
const SHX = LD[0] * D / -LD[1], SHZ = LD[2] * D / -LD[1];

// 환경 파동(바람) — 각도, 파수, 속도, 진폭, 위상
const WV = [[.3, 11, .45, .0105, 0], [2.1, 15, .38, .0072, 1.7], [4.0, 21, .33, .0044, 3.1], [5.2, 28, .27, .0030, 4.4], [1.2, 37, .22, .0020, 5.9], [3.3, 19, .31, .0034, 2.4], [.9, 25, .26, .0026, 0.8]];
const NW = WV.length;
const WCX = WV.map(a => Math.cos(a[0])), WSZ = WV.map(a => Math.sin(a[0])), WAMP = WV.map(a => a[3] * a[1]);

// ================= 셰이더 =================
const FS = `
varying vec2 v; uniform vec2 R; uniform float T;
uniform sampler2D uN; uniform sampler2D uC;
uniform vec3 RO; uniform vec3 UU; uniform vec3 VV; uniform vec3 WW; uniform vec3 LD; uniform vec3 SG; uniform vec2 CF;
const float D=.9; const float NG=128.; const float BMAX=8.;
const vec3 ABS=vec3(.95,.26,.17)*.85;
${NOISE}
float fbm3(vec2 p){float a=.5,s=0.;for(int i=0;i<3;i++){s+=a*nz(p);p=p*2.03+vec2(11.3,7.1);a*=.5;}return s;}
vec3 lin(vec3 c){return c*c;}
vec3 tileC(vec2 p,float sz,vec3 ca,vec3 cb,vec3 gr,float gw,float px,vec2 sd){
  vec2 q=p/sz,id=floor(q),f=fract(q);
  float r=hs(id+sd);
  vec3 c=mix(ca,cb,r*r*.9+.1*hs(id*1.7+sd+3.1));
  vec2 e=min(f,1.-f)*sz; float d=min(e.x,e.y);
  float g=clamp((d-gw)/max(px,1e-4)*.5+.5,0.,1.);
  float gn=nz(p*70.+sd)*.5+nz(p*170.)*.5; gn=mix(gn,.5,clamp(px*70.,0.,1.));
  c*=.92+.14*gn;
  c*=.86+.14*smoothstep(gw,gw+sz*.14,d);
  return mix(gr,c,g);
}
vec3 sky(vec3 d){
  float y=max(d.y,0.);
  vec3 c=mix(lin(vec3(.80,.89,.95)),lin(vec3(.18,.48,.88)),pow(y,.55));
  vec2 cp=d.xz/(y+.28)*1.3+vec2(T*.012,0.);
  float cl=smoothstep(.46,.8,fbm3(cp));
  c=mix(c,vec3(1.15),cl*.85*smoothstep(0.,.25,y));
  float s=max(dot(d,SG),0.);
  c+=vec3(1.,.82,.6)*(pow(s,700.)*10.+pow(s,16.)*.16);
  return c;
}
const vec3 HAZE=vec3(.77,.85,.9);
vec3 deckCol(vec3 P,float tp,float px){
  float m=max(abs(P.x),abs(P.z));
  vec3 alb;
  if(m<1.17){
    alb=tileC(P.xz,.29,lin(vec3(.97,.955,.91)),lin(vec3(.92,.9,.85)),lin(vec3(.76,.73,.68)),.006,px,vec2(1.,5.));
    alb*=mix(.45,1.,smoothstep(1.,1.035,m));
  }else alb=tileC(P.xz,.5,lin(vec3(.92,.87,.78)),lin(vec3(.85,.79,.69)),lin(vec3(.64,.59,.52)),.009,px,vec2(7.,2.));
  alb*=mix(1.,.84,1.-smoothstep(1.,1.28,m));
  alb*=.93+.07*nz(P.xz*3.1);
  float ls=fbm3(P.xz*1.05+vec2(T*.05,T*.032));
  alb*=1.-.2*smoothstep(.46,.64,ls)*(1.-exp(-tp*.5));
  vec3 col=alb*(vec3(1.,.96,.88)*1.9+vec3(.34,.42,.56)*.7);
  return mix(col,HAZE*1.25,1.-exp(-tp*tp*.0011));
}
vec3 waterCol(vec3 P,vec3 rd,float tp){
  float m=max(abs(P.x),abs(P.z));
  vec2 tc=(P.xz*.5+.5)*((NG-1.)/NG)+.5/NG;
  vec2 nt=(texture2D(uN,tc).rg*2.-1.)*.6;
  nt+=(vec2(nz(P.xz*58.+T*.35),nz(P.xz*58.+17.3-T*.3))-.5)*.03;
  vec3 n=normalize(vec3(nt.x,sqrt(max(1.-dot(nt,nt),.05)),nt.y));
  float cs=max(dot(n,-rd),0.);
  float F=.02+.98*pow(1.-cs,5.);
  vec3 refl=sky(reflect(rd,n));
  vec3 rr=refract(rd,n,1./1.333);
  float tf=(-D-P.y)/rr.y;
  float tx=abs(rr.x)<1e-4?1e9:((rr.x>0.?1.:-1.)-P.x)/rr.x;
  float tz=abs(rr.z)<1e-4?1e9:((rr.z>0.?1.:-1.)-P.z)/rr.z;
  float tt=min(tf,min(tx,tz));
  vec3 H=P+rr*tt;
  float pxw=(tp+tt)/(R.y*CF.x)*1.25;
  vec3 alb; float lk=1.;
  if(tf<=tx&&tf<=tz){
    alb=tileC(H.xz,.125,lin(vec3(.82,.94,.95)),lin(vec3(.66,.86,.9)),lin(vec3(.93,.98,.98)),.0035,pxw,vec2(3.,7.));
  }else{
    vec3 nW=tx<tz?vec3(-sign(rr.x),0.,0.):vec3(0.,0.,-sign(rr.z));
    vec2 wp=tx<tz?vec2(H.z,H.y):vec2(H.x,H.y);
    alb=tileC(wp,.125,lin(vec3(.78,.92,.94)),lin(vec3(.62,.84,.89)),lin(vec3(.92,.98,.98)),.0035,pxw,vec2(5.,2.));
    if(H.y>-.125) alb=tileC(wp,.125,lin(vec3(.12,.44,.62)),lin(vec3(.08,.34,.54)),lin(vec3(.75,.9,.93)),.0035,pxw,vec2(9.,4.));
    lk=max(3.*max(-dot(LD,nW),0.),.55);
  }
  float depth=-H.y;
  vec2 u=H.xz-LD.xz*(H.y/LD.y);
  float cc=texture2D(uC,u*.5+.5).r; float cau=cc*cc*BMAX;
  float sh=1.-smoothstep(.95,1.03,max(abs(u.x),abs(u.y)));
  float pL=depth/(-LD.y);
  vec3 aV=exp(-ABS*(tt+depth*.8)); vec3 aS=exp(-ABS*(tt+pL)*.6);
  vec3 rad=alb*(vec3(.55,.65,.8)*.4*aV+vec3(1.,.95,.85)*1.9*cau*sh*lk*aS);
  rad+=vec3(1.,1.,1.)*pow(max(cau-1.6,0.),1.15)*.075*sh*lk;
  rad+=vec3(.01,.13,.16)*(1.-exp(-.8*tt));
  rad*=mix(.5,1.,smoothstep(0.,.07,1.-m));
  return mix(rad,refl,F);
}
void main(){
  vec2 uv=(v-.5)*vec2(R.x/R.y,1.); uv.x-=CF.y;
  vec3 rd=normalize(UU*uv.x+VV*uv.y+WW*CF.x);
  vec3 col;
  if(rd.y>-.004){ col=mix(HAZE*1.25,sky(rd),smoothstep(0.,.14,rd.y)); }
  else{
    float tp=-RO.y/rd.y; vec3 P=RO+rd*tp;
    float px=tp/(R.y*CF.x)*1.25;
    float m=max(abs(P.x),abs(P.z));
    float wq=clamp((1.-m)/(px*1.6)*.5+.5,0.,1.);
    if(wq>=1.) col=waterCol(P,rd,tp);
    else if(wq<=0.) col=deckCol(P,tp,px);
    else col=mix(deckCol(P,tp,px),waterCol(P,rd,tp),wq);
  }
  col*=.62;
  col=(col*(2.51*col+.03))/(col*(2.43*col+.59)+.14);
  vec2 q=v-.5; col*=1.-.3*dot(q,q);
  col=pow(clamp(col,0.,1.),vec3(1./2.2));
  gl_FragColor=vec4(col,1.);
}`;

// ================= 섹션 =================
export default function init(root, ctx) {
  const canvas = root.querySelector('.s197__gl');
  const mp = pointer(root, canvas);

  // ---- 높이장 상태 (고스트 1겹 패딩) ----
  const h = new Float32Array(W2 * W2), vel = new Float32Array(W2 * W2), dmp = new Float32Array(W2 * W2).fill(.9965);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const e = Math.min(i, j, N - 1 - i, N - 1 - j);
    if (e < 6) dmp[(j + 1) * W2 + i + 1] = .9965 - .022 * (1 - e / 6); // 가장자리 스펀지(약한 흡수)
  }
  const X = new Float32Array(N), Z = new Float32Array(N);
  for (let i = 0; i < N; i++) X[i] = Z[i] = -1 + 2 * i / (N - 1);
  const SX = new Float32Array(NN), SZ = new Float32Array(NN);
  const PX = new Float32Array(NN), PY = new Float32Array(NN);
  const nbuf = new Uint8Array(NN * 4);
  for (let i = 3; i < nbuf.length; i += 4) nbuf[i] = 255;
  const cbuf = new Float32Array(S * S), tmp = new Float32Array(S * S), cbyte = new Uint8Array(S * S);
  const sA = new Float32Array(NW * N), cA = new Float32Array(NW * N), sB = new Float32Array(NW * N), cB = new Float32Array(NW * N);
  const invD2 = 1 / (2 * DXW);

  function ghost() {
    for (let i = 1; i <= N; i++) { h[i] = h[W2 + i]; h[(N + 1) * W2 + i] = h[N * W2 + i]; }
    for (let j = 0; j < W2; j++) { h[j * W2] = h[j * W2 + 1]; h[j * W2 + N + 1] = h[j * W2 + N]; }
  }
  // 속도형 파동 스텝: v += k(avg4(h)-h); v*=damp; h += v   (2패스 — 이웃은 항상 옛 h)
  function step() {
    ghost();
    for (let j = 1; j <= N; j++) {
      const o = j * W2;
      for (let i = 1; i <= N; i++) {
        const k = o + i;
        vel[k] = (vel[k] + ((h[k - 1] + h[k + 1] + h[k - W2] + h[k + W2]) * .25 - h[k]) * KW) * dmp[k];
      }
    }
    for (let j = 1; j <= N; j++) { const o = j * W2; for (let i = 1; i <= N; i++) h[o + i] += vel[o + i]; }
  }
  // 코사인 범프(Evan 식 drop): gx,gz 는 격자 좌표, rad 는 셀, str 는 월드 높이
  function drop(gx, gz, rad, str) {
    const j0 = Math.max(0, Math.floor(gz - rad)), j1 = Math.min(N - 1, Math.ceil(gz + rad));
    const i0 = Math.max(0, Math.floor(gx - rad)), i1 = Math.min(N - 1, Math.ceil(gx + rad));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      let d = 1 - Math.hypot(i - gx, j - gz) / rad; if (d <= 0) continue;
      h[(j + 1) * W2 + i + 1] += (.5 - Math.cos(d * Math.PI) * .5) * str;
    }
  }
  const toG = x => (x + 1) * .5 * (N - 1);
  const rainAt = (x, z, big) => drop(toG(x), toG(z), big ? 9 : 6.5, (big ? .02 : .013) * (Math.random() < .35 ? -1 : 1));

  // 초기 파문 시드 + 워밍업
  [[-.45, -.2, 1], [.35, .1, 0], [-.05, .55, 0], [.55, -.55, 1], [-.6, .45, 0]].forEach(a => rainAt(a[0], a[1], a[2]));
  for (let k = 0; k < 70; k++) step();

  // ---- 카메라 (JS·셰이더 동일 모델) ----
  function camAt(t) {
    const rm = ctx.reduced ? .3 : 1;
    const ro = [.36 + .2 * rm * Math.sin(t * .11), 2.5 + .06 * rm * Math.sin(t * .07), 3.05];
    const tg = [-.06, -.32, -.38];
    const ww = norm3([tg[0] - ro[0], tg[1] - ro[1], tg[2] - ro[2]]);
    const uu = norm3(cross3(ww, [0, 1, 0]));
    const vv = cross3(uu, ww);
    return { ro, ww, uu, vv };
  }
  function poolPos(nx, ny, cam, aspect, shx) {
    const ux = (nx - .5) * aspect - shx, uy = ny - .5;
    const dx = cam.uu[0] * ux + cam.vv[0] * uy + cam.ww[0] * FOC;
    const dy = cam.uu[1] * ux + cam.vv[1] * uy + cam.ww[1] * FOC;
    const dz = cam.uu[2] * ux + cam.vv[2] * uy + cam.ww[2] * FOC;
    if (dy > -1e-3) return null;
    const t = -cam.ro[1] / dy, x = cam.ro[0] + dx * t, z = cam.ro[2] + dz * t;
    return (Math.abs(x) < .985 && Math.abs(z) < .985) ? [x, z] : null;
  }
  const onDown = e => {
    const r = canvas.getBoundingClientRect(); const a = canvas.clientWidth / canvas.clientHeight;
    const p = poolPos((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height, camNow, a, shxOf(a));
    if (p) drop(toG(p[0]), toG(p[1]), 8, -.022);
  };
  const shxOf = a => .29 * Math.min(1, Math.max(0, (a - 1.05) / .6));
  let camNow = camAt(0);
  root.addEventListener('pointerdown', onDown);

  // ---- 한 프레임의 CPU 파이프라인: 법선 → 굴절 메시 → 면적비 래스터 → 블러/인코딩 ----
  function fields(t) {
    // 환경 파동의 분리 가능한 sin/cos 테이블
    for (let w = 0; w < NW; w++) {
      const a = WV[w][0], k = WV[w][1], om = k * WV[w][2], ph = WV[w][4];
      const kx = k * Math.cos(a), kz = k * Math.sin(a);
      for (let i = 0; i < N; i++) {
        const A = kx * X[i] - om * t + ph, B = kz * Z[i];
        sA[w * N + i] = Math.sin(A); cA[w * N + i] = Math.cos(A); sB[w * N + i] = Math.sin(B); cB[w * N + i] = Math.cos(B);
      }
    }
    ghost();
    let mx = 0;
    for (let j = 0; j < N; j++) {
      const o = (j + 1) * W2 + 1;
      for (let i = 0; i < N; i++) {
        const k = o + i;
        let gx = (h[k + 1] - h[k - 1]) * invD2, gz = (h[k + W2] - h[k - W2]) * invD2;
        const ah = h[k] < 0 ? -h[k] : h[k]; if (ah > mx) mx = ah;
        for (let w = 0; w < NW; w++) {
          const C = cA[w * N + i] * cB[w * N + j] - sA[w * N + i] * sB[w * N + j];
          const amp = WAMP[w] * C;
          gx += amp * WCX[w]; gz += amp * WSZ[w];
        }
        const id = j * N + i; SX[id] = gx; SZ[id] = gz;
        const inv = 1 / Math.sqrt(1 + gx * gx + gz * gz);
        const o4 = id * 4; // 법선 xz 를 [-0.6,0.6] → 0..255
        let r = -gx * inv / .6, b = -gz * inv / .6;
        r = r > 1 ? 1 : r < -1 ? -1 : r; b = b > 1 ? 1 : b < -1 ? -1 : b;
        nbuf[o4] = (r * 127.5 + 127.5 + .5) | 0; nbuf[o4 + 1] = (b * 127.5 + 127.5 + .5) | 0;
      }
    }
    // 에너지 가드
    if (mx > .05) { const f = .9; for (let k = 0; k < h.length; k++) { h[k] *= f; vel[k] *= f; } }
  }
  function splat(x, y, e) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    if (ix >= 0 && ix < S - 1 && iy >= 0 && iy < S - 1) {
      const o = iy * S + ix;
      cbuf[o] += e * (1 - fx) * (1 - fy); cbuf[o + 1] += e * fx * (1 - fy); cbuf[o + S] += e * (1 - fx) * fy; cbuf[o + S + 1] += e * fx * fy;
    }
  }
  function tri(x0, y0, x1, y1, x2, y2) {
    const ar2 = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    const ar = Math.abs(ar2) * .5;
    if (ar < ASPL) { splat((x0 + x1 + x2) / 3, (y0 + y1 + y2) / 3, A0); return; }
    const minx = Math.max(0, Math.ceil(Math.min(x0, x1, x2))), maxx = Math.min(S - 1, Math.floor(Math.max(x0, x1, x2)));
    const miny = Math.max(0, Math.ceil(Math.min(y0, y1, y2))), maxy = Math.min(S - 1, Math.floor(Math.max(y0, y1, y2)));
    if (maxx < minx || maxy < miny || (maxx - minx) * (maxy - miny) > 1800) return;
    const rho = A0 / ar, s = ar2 > 0 ? 1 : -1;
    const a0 = -(y1 - y0) * s, b0 = (x1 - x0) * s, a1 = -(y2 - y1) * s, b1 = (x2 - x1) * s, a2 = -(y0 - y2) * s, b2 = (x0 - x2) * s;
    for (let py = miny; py <= maxy; py++) {
      let e0 = a0 * (minx - x0) + b0 * (py - y0), e1 = a1 * (minx - x1) + b1 * (py - y1), e2 = a2 * (minx - x2) + b2 * (py - y2);
      let o = py * S + minx;
      for (let px = minx; px <= maxx; px++, o++) {
        if (e0 >= 0 && e1 >= 0 && e2 >= 0) cbuf[o] += rho;
        e0 += a0; e1 += a1; e2 += a2;
      }
    }
  }
  function caustics() {
    const IX = IL[0], IY = IL[1], IZ = IL[2], E2 = ETA * ETA, half = .5 * S;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const id = j * N + i, a = SX[id], b = SZ[id];
      const inv = 1 / Math.sqrt(1 + a * a + b * b);
      const nx = -a * inv, ny = inv, nz = -b * inv;
      const c = nx * IX + ny * IY + nz * IZ;
      const q = ETA * c + Math.sqrt(1 - E2 * (1 - c * c));
      const dx = ETA * IX - q * nx, dy = ETA * IY - q * ny, dz = ETA * IZ - q * nz;
      const t = D / -dy;
      PX[id] = (X[i] + dx * t - SHX + 1) * half - .5;
      PY[id] = (Z[j] + dz * t - SHZ + 1) * half - .5;
    }
    cbuf.fill(0);
    for (let j = 0; j < N - 1; j++) for (let i = 0; i < N - 1; i++) {
      const a = j * N + i, b = a + 1, c = a + N, d = c + 1;
      tri(PX[a], PY[a], PX[b], PY[b], PX[c], PY[c]);
      tri(PX[b], PY[b], PX[d], PY[d], PX[c], PY[c]);
    }
    // 3×3 박스(1-2-1 분리형) 블러 + sqrt 인코딩
    for (let y = 0; y < S; y++) {
      const o = y * S;
      for (let x = 0; x < S; x++) {
        const l = cbuf[o + (x > 0 ? x - 1 : 0)], r = cbuf[o + (x < S - 1 ? x + 1 : x)];
        tmp[o + x] = (l + 2 * cbuf[o + x] + r) * .25;
      }
    }
    const k = 1 / BMAX;
    for (let y = 0; y < S; y++) {
      const o = y * S, ou = (y > 0 ? y - 1 : 0) * S, od = (y < S - 1 ? y + 1 : y) * S;
      for (let x = 0; x < S; x++) {
        let v = (tmp[ou + x] + 2 * tmp[o + x] + tmp[od + x]) * .25 * k;
        if (v > 1) v = 1;
        cbyte[o + x] = (Math.sqrt(v) * 255 + .5) | 0;
      }
    }
  }

  // ---- 입력/자동 시나리오 상태 ----
  let prev = null, prevSrc = 0, lastReal = -99, nextRain = .7;

  const off = boot(root, ctx, canvas, ctx.reduced ? .32 : .5, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T RO UU VV WW LD SG CF uN uC');
    const mk = (unit, fmt, w, hh) => {
      const tx = g.createTexture(); g.activeTexture(g.TEXTURE0 + unit); g.bindTexture(g.TEXTURE_2D, tx);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      g.texImage2D(g.TEXTURE_2D, 0, fmt, w, hh, 0, fmt, g.UNSIGNED_BYTE, null);
      return tx;
    };
    g.pixelStorei(g.UNPACK_ALIGNMENT, 1);
    const tN = mk(0, g.RGBA, N, N), tC = mk(1, g.LUMINANCE, S, S);
    g.uniform1i(u.uN, 0); g.uniform1i(u.uC, 1);
    g.uniform3f(u.LD, LD[0], LD[1], LD[2]); g.uniform3f(u.SG, SG[0], SG[1], SG[2]);
    let lastT = -1, lw = 0, lh = 0;

    return (t, w, hh) => {
      if (lastT >= 0 && t - lastT < .046 && w === lw && hh === lh) return; // ~20fps 캡
      const dt = lastT < 0 ? .05 : Math.min(.12, Math.max(.001, t - lastT));
      lastT = t; lw = w; lh = hh;
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight), shx = shxOf(aspect);
      const cam = camAt(t); camNow = cam;

      // 포인터(실제) → 풀 평면 좌표, 없으면 가상 포인터(Lissajous)
      let pos = null, src = 0;
      if (mp.in && performance.now() - mp.t < 2500) { src = 1; lastReal = t; pos = poolPos(mp.x, mp.y, cam, aspect, shx); }
      else if (t - lastReal > 2.5) { src = 2; const sp = ctx.reduced ? .4 : 1; pos = [.6 * Math.sin(.78 * t * sp + .4), .52 * Math.sin(1.21 * t * sp + 1.1)]; }
      if (pos) {
        if (prev && prevSrc === src) {
          const dx = pos[0] - prev[0], dz = pos[1] - prev[1], d = Math.hypot(dx, dz);
          if (d > 1e-4 && d < 1.3) {
            const str = Math.min(.016, .0035 + .0032 * d / dt) * (src === 2 ? .8 : 1) * .6;
            const n = Math.max(1, Math.ceil(d / .045));
            for (let k = 1; k <= n; k++) drop(toG(prev[0] + dx * k / n), toG(prev[1] + dz * k / n), 4.6, str);
          }
        }
        prev = pos; prevSrc = src;
      } else { prev = null; }
      if (t > nextRain) { rainAt((Math.random() * 2 - 1) * .85, (Math.random() * 2 - 1) * .85, Math.random() < .3); nextRain = t + (src === 1 ? 2.6 + Math.random() * 1.5 : .8 + Math.random() * 1.1); }

      const ns = Math.min(6, Math.max(1, Math.round(dt * SUB_HZ)));
      for (let k = 0; k < ns; k++) step();
      fields(t);
      caustics();

      g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, tN);
      g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, N, N, g.RGBA, g.UNSIGNED_BYTE, nbuf);
      g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, tC);
      g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, S, S, g.LUMINANCE, g.UNSIGNED_BYTE, cbyte);

      g.viewport(0, 0, w, hh);
      g.uniform2f(u.R, w, hh); g.uniform1f(u.T, t);
      g.uniform3f(u.RO, cam.ro[0], cam.ro[1], cam.ro[2]);
      g.uniform3f(u.UU, cam.uu[0], cam.uu[1], cam.uu[2]); g.uniform3f(u.VV, cam.vv[0], cam.vv[1], cam.vv[2]); g.uniform3f(u.WW, cam.ww[0], cam.ww[1], cam.ww[2]);
      g.uniform2f(u.CF, FOC, shx);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); root.removeEventListener('pointerdown', onDown); };
}
