// 비누방울 박막 간섭 — CPU 두께장(이류+중력 배수+증발) → 1D 스펙트럼 LUT(OPD→색) → 해석적 구 교차 풀스크린 셰이더 → 터짐(구면 홀 + 미스트)
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
// ---- /유틸 ----

const NB = 6, GW = 128, GH = 64, NC = GW * GH, ATLAS_H = 512, HMAX = 1100;
const LUTN = 2048, LUTMAX = 3000, TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const rnd = (a, b) => a + Math.random() * (b - a);
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

// ---- 3D 값 노이즈 (구면 위에서 심 없이 샘플) ----
function ih(x, y, z) { let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vn(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  let fx = x - xi, fy = y - yi, fz = z - zi; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const a = ih(xi, yi, zi), b = ih(xi + 1, yi, zi), c = ih(xi, yi + 1, zi), d = ih(xi + 1, yi + 1, zi);
  const e = ih(xi, yi, zi + 1), f = ih(xi + 1, yi, zi + 1), g = ih(xi, yi + 1, zi + 1), h = ih(xi + 1, yi + 1, zi + 1);
  const x0 = a + (b - a) * fx, x1 = c + (d - c) * fx, x2 = e + (f - e) * fx, x3 = g + (h - g) * fx;
  const y0 = x0 + (x1 - x0) * fy, y1 = x2 + (x3 - x2) * fy; return y0 + (y1 - y0) * fz;
}

// ---- 격자 기하: 경도 i(128) × 위도 j(64), j=0 이 남극(아래) ----
const sinL = new Float32Array(GW), cosL = new Float32Array(GW), sinP = new Float32Array(GH), cosP = new Float32Array(GH);
for (let i = 0; i < GW; i++) { const l = (i + .5) / GW * TAU - Math.PI; sinL[i] = Math.sin(l); cosL[i] = Math.cos(l); }
for (let j = 0; j < GH; j++) { const f = ((j + .5) / GH - .5) * Math.PI; sinP[j] = Math.sin(f); cosP[j] = Math.cos(f); }
let AREA = 0; for (let j = 0; j < GH; j++) AREA += cosP[j] * GW;

// ---- 스펙트럼 LUT: OPD(0..3000nm) → 비누막 2빔 간섭 반사색 (Rλ = sin²(π·OPD/λ), OPD=0 에서 검정) ----
function bakeLut() {
  const gl = (l, m, s1, s2) => { const t = (l - m) / (l < m ? s1 : s2); return Math.exp(-.5 * t * t); };
  const L = [], X = [], Y = [], Z = [];
  for (let l = 380; l <= 730; l += 5) {
    L.push(l);
    X.push(1.056 * gl(l, 599.8, 37.9, 31.0) + .362 * gl(l, 442.0, 16.0, 26.7) - .065 * gl(l, 501.1, 20.4, 26.2));
    Y.push(.821 * gl(l, 568.8, 46.9, 40.5) + .286 * gl(l, 530.9, 16.3, 31.1));
    Z.push(1.217 * gl(l, 437.0, 11.8, 36.0) + .681 * gl(l, 459.0, 26.0, 13.8));
  }
  const rgb = (x, y, z) => [3.2406 * x - 1.5372 * y - .4986 * z, -.9689 * x + 1.8758 * y + .0415 * z, .0557 * x - .2040 * y + 1.0570 * z];
  let wx = 0, wy = 0, wz = 0; for (let m = 0; m < L.length; m++) { wx += X[m]; wy += Y[m]; wz += Z[m]; }
  const W = rgb(wx, wy, wz); // 등에너지 흰색(Rλ≡1) → (1,1,1) 로 정규화
  const out = new Uint8Array(LUTN * 4);
  for (let k = 0; k < LUTN; k++) {
    const opd = k / (LUTN - 1) * LUTMAX; let sx = 0, sy = 0, sz = 0;
    for (let m = 0; m < L.length; m++) { const s = Math.sin(Math.PI * opd / L[m]); const r = s * s; sx += r * X[m]; sy += r * Y[m]; sz += r * Z[m]; }
    const c = rgb(sx, sy, sz);
    for (let ch = 0; ch < 3; ch++) out[k * 4 + ch] = Math.round(255 * Math.pow(clamp(c[ch] / W[ch], 0, 1), 1 / 2.2));
    out[k * 4 + 3] = 255;
  }
  return out;
}

// ---- 셰이더 ----
const nrm = a => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const f3 = a => 'vec3(' + a.map(v => v.toFixed(5)).join(',') + ')';
function lightDef(name, c, up) {
  const C = nrm(c), d = up[0] * C[0] + up[1] * C[1] + up[2] * C[2];
  const Uu = nrm([up[0] - d * C[0], up[1] - d * C[1], up[2] - d * C[2]]);
  return `const vec3 C${name}=${f3(C)};const vec3 U${name}=${f3(Uu)};`;
}
const FS = () => `
varying vec2 v; uniform vec2 R; uniform float T;
uniform sampler2D uTh; uniform sampler2D uLut;
uniform vec4 uB[${NB}]; uniform vec4 uP[${NB}]; uniform vec4 uS[${NB}];
${lightDef('0', [.1, 1, .25], [1, 0, 0])}
${lightDef('1', [.55, .38, .74], [0, 1, 0])}
${lightDef('2', [-.5, .46, .72], [0, 1, 0])}
${lightDef('3', [.92, -.08, .4], [0, 1, 0])}
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float rbox(vec2 q,vec2 hf,float sf){vec2 e=abs(q)-hf;return 1.-smoothstep(-sf,sf,max(e.x,e.y));}
float gbox(vec3 d,vec3 c,vec3 u,vec2 hf,float sf){float dc=dot(d,c);if(dc<.08)return 0.;vec2 q=vec2(dot(d,u),dot(d,cross(c,u)))/dc;return rbox(q,hf,sf);}
// 반사 방향 기준 프로시저럴 스튜디오: 그라디언트 + 오버헤드 패널 + 소프트박스 + 세로 스트립 + 창틀(2x2) 하이라이트
vec3 env(vec3 d){
  float up=smoothstep(-.7,.9,d.y);
  vec3 col=mix(vec3(.12,.14,.19),vec3(.60,.70,.84),up);
  col+=vec3(.50,.38,.28)*.35*smoothstep(-.2,-.95,d.y);
  col+=vec3(.50,.58,.78)*.55*smoothstep(0.,-1.,d.z);
  col+=vec3(.95,.97,1.)*1.2*gbox(d,C0,U0,vec2(.9,.55),.3);
  col+=vec3(.82,.92,1.)*2.8*gbox(d,C1,U1,vec2(.30,.20),.07);
  col+=vec3(.9,.95,1.)*2.3*gbox(d,C3,U3,vec2(.09,.55),.05);
  float dw=dot(d,C2);
  if(dw>.08){
    vec3 w=cross(C2,U2); vec2 q=vec2(dot(d,U2),dot(d,w))/dw;
    float inner=rbox(q,vec2(.23,.40),.012), outer=rbox(q,vec2(.275,.445),.012);
    float cr=max(1.-smoothstep(.012,.026,abs(q.x)),max(1.-smoothstep(.012,.026,abs(q.y-.135)),1.-smoothstep(.012,.026,abs(q.y+.135))));
    col+=vec3(1.,.97,.92)*5.4*inner*(1.-cr)+vec3(.8,.78,.75)*.5*(outer-inner);
  }
  return col;
}
vec3 bgc(vec2 p,vec2 q,float asp){
  vec3 c0=vec3(.15,.39,.45),c1=vec3(.22,.26,.51),c2=vec3(.34,.23,.47);
  float g=clamp(q.x*.5+(1.-q.y)*.55,0.,1.);
  vec3 c=mix(mix(c0,c1,smoothstep(0.,.6,g)),c2,smoothstep(.5,1.,g));
  vec2 gq=q-vec2(.62,.5); c+=vec3(.06,.07,.09)*exp(-dot(gq,gq)*4.);
  c*=1.-.35*smoothstep(.45,1.1,length((q-.5)*vec2(1.1,1.)));
  c=pow(c,vec3(2.2));
  for(int k=0;k<6;k++){
    float fk=float(k);
    vec2 bc=vec2(fract(fk*.618+.17)*asp,fract(fk*.371+.23))+vec2(sin(T*.06+fk*1.7),cos(T*.05+fk*2.3))*.035;
    float rr=.045+.06*fract(fk*.733+.1); float d=length(p-bc);
    float fill=smoothstep(rr,rr-.01,d), edge=smoothstep(.012,0.,abs(d-rr));
    c+=mix(vec3(.45,.8,.85),vec3(.9,.7,.95),fract(fk*.41))*(fill*.022+edge*.03);
  }
  return c;
}
vec3 film(vec3 nw,vec3 nf,float cosi,float yaw,vec4 P,float fade,float slot,float side,out float blk){
  float cy=cos(yaw),sy=sin(yaw);
  vec3 nl=vec3(nw.x*cy+nw.z*sy,nw.y,-nw.x*sy+nw.z*cy);
  float tu=atan(nl.z,nl.x)*.1591549+.5;
  float tv=(slot*64.+clamp((asin(clamp(nl.y,-1.,1.))*.3183099+.5)*64.,.5,63.5))/${ATLAS_H}.;
  float h=texture2D(uTh,vec2(tu,tv)).r*${HMAX}.;
  float vis=1.,rim=0.;
  if(P.w>=0.){
    float dd=acos(clamp(dot(nw,P.xyz),-1.,1.))-P.w;
    vis=smoothstep(-.01,.05,dd); rim=exp(-max(dd,0.)*8.)*vis;
  }
  h+=rim*820.;
  blk=(1.-smoothstep(10.,75.,h))*vis;
  float s2=1.-cosi*cosi; float ct=sqrt(max(1.-s2*.5653,0.));
  float opd=2.66*h*ct;
  vec3 lc=texture2D(uLut,vec2(opd*${((LUTN - 1) / LUTN / LUTMAX).toFixed(9)}+${(.5 / LUTN).toFixed(9)},.5)).rgb;
  lc=pow(lc,vec3(2.2));
  float F=.04+.96*pow(1.-cosi,5.);
  float refl=min(4.*F,1.);
  vec3 r=reflect(vec3(0.,0.,-1.),nf);
  return lc*refl*env(r)*(1.+3.2*rim)*vis*fade*2.1*side;
}
void main(){
  float asp=R.x/R.y; vec2 p=vec2(v.x*asp,v.y);
  vec3 col=bgc(p,v,asp);
  for(int i=0;i<${NB};i++){
    vec4 B=uB[i]; if(B.z<.002)continue;
    vec2 dv=p-B.xy; float r=B.z; float d2=dot(dv,dv);
    if(d2>=r*r)continue;
    float d=sqrt(d2); float aa=clamp((r-d)*R.y*.55,0.,1.);
    float zz=sqrt(max(r*r-d2,r*r*.0004)); float cosi=zz/r;
    vec3 nF=vec3(dv,zz)/r, nB=vec3(dv,-zz)/r, nBi=vec3(-dv,zz)/r;
    vec4 S=uS[i]; vec4 P=uP[i];
    float k1,k2;
    vec3 add=film(nF,nF,cosi,B.w,P,S.x,S.y,1.,k1)+film(nB,nBi,cosi,B.w,P,S.x,S.y,.72,k2);
    float dim=(P.w<0.?.09*pow(1.-cosi,2.):0.)+.5*max(k1,k2);
    col=col*(1.-dim*S.x*aa)+add*aa;
  }
  col=1.-exp(-col*1.3);
  col=pow(col,vec3(.4545));
  col+=(hsh(gl_FragCoord.xy+fract(T)*7.)-.5)/255.;
  gl_FragColor=vec4(col,1.);
}`;

// 방울 홈 위치: [x(폭 비율), y(아래서 높이 비율), 반지름(높이 단위)], 초기 나이 비율
const HOMES = [[.63, .52, .30, .12], [.86, .70, .18, .78], [.40, .80, .15, .45], [.88, .27, .15, .25], [.19, .82, .10, .60], [.73, .13, .11, .05]];

export default function init(root, ctx) {
  const canvas = root.querySelector('.s165__gl'), mistC = root.querySelector('.s165__mist');
  const m2 = mistC.getContext('2d');
  const reduced = !!ctx.reduced;
  const CAP = reduced ? .09 : .046, SCALE = reduced ? .26 : .4, SIMRATE = reduced ? .8 : 1.5;
  const t0 = performance.now(); const clock = () => (performance.now() - t0) / 1000;

  // ---- 상태 ----
  const lutData = bakeLut();
  const atlas = new Uint8Array(GW * ATLAS_H);
  const pending = new Array(NB).fill(true);
  const ub = new Float32Array(NB * 4), up = new Float32Array(NB * 4), us = new Float32Array(NB * 4);
  const cx_ = new Float32Array(6), cy_ = new Float32Array(6), cz_ = new Float32Array(6), isg_ = new Float32Array(6), amp_ = new Float32Array(6);
  const bubbles = HOMES.map((h, i) => ({
    slot: i, h: new Float32Array(NC), t: new Float32Array(NC), hx: h[0], hy: h[1], hr: h[2], a0: h[3],
    state: 'gone', born: 0, life: 30, armT: 0, rise0: 0, fade0: 0, st: 0, lastUpd: 0, yaw: 0, yawV: .1, off: { x: 0, y: 0 },
    ax: .02, ay: .02, wx: .3, wy: .4, px: 0, py: 0, vort: [], black: 0, bP: [0, 1, 0], P: [0, 0, 1], bt0: 0, respawnAt: 0,
    swipe: 0, cx: 0, cy: 0, cr: 0, fade: 0, scaleR: 1, rise: .5, ox: 0, oy: 0, oz: 0,
  }));
  let aspect = 16 / 9, nowT = 0, prevT = 0;

  // ---- 두께장 시드 ----
  function bake(b, dtS) {
    const hh = b.h; let bw = 0, bx = 0, by = 0, bz = 0;
    const ox = b.st * .07 + b.ox, oy = b.st * .05 + b.oy, oz = -b.st * .06 + b.oz;
    const base = b.slot * NC;
    for (let j = 0; j < GH; j++) {
      const cp = cosP[j], sp = sinP[j];
      const ke = .004 + .075 * Math.pow(clamp((sp + .1) / 1.1, 0, 1), 1.6), dec = dtS > 0 ? Math.exp(-ke * dtS) : 1;
      for (let i = 0; i < GW; i++) {
        const idx = j * GW + i; let x = hh[idx] * dec;
        if (dtS > 0) { // 미세 노이즈 재주입 (얇은 막엔 주입 안 함 → 검은 막 유지)
          const n = vn(cp * cosL[i] * 9 + ox, sp * 9 + oy, cp * sinL[i] * 9 + oz) - .5;
          x += n * 52 * dtS * Math.min(1, x / 220);
        }
        if (!(x >= 3)) x = x !== x ? 380 : 3; // NaN 가드 + 하한(검은 막 3nm)
        if (x > HMAX) x = HMAX;
        hh[idx] = x;
        const e = x / HMAX * 255 + Math.random() - .5; // ±0.5 레벨 디더
        atlas[base + idx] = e < 0 ? 0 : e > 255 ? 255 : (e + .5) | 0;
        if (x < 28 && sp > -.2) { bw += cp; bx += cp * cosL[i] * cp; by += cp * sp; bz += cp * sinL[i] * cp; }
      }
    }
    b.black = bw / AREA;
    const l = Math.hypot(bx, by, bz) || 1; b.bP = [bx / l, by / l, bz / l];
    pending[b.slot] = true;
  }
  function seed(b, a) {
    const hT = 470 * Math.pow(1 - a, 1.6) + 14, hB = 640 - 90 * a;
    const o0 = rnd(0, 90), o1 = rnd(0, 90), o2 = rnd(0, 90), sc = rnd(1.8, 2.6), hh = b.h;
    for (let j = 0; j < GH; j++) {
      const cp = cosP[j], sp = sinP[j], bas = hB + (hT - hB) * sstep(-.7, .95, sp);
      for (let i = 0; i < GW; i++) {
        const px = cp * cosL[i], pz = cp * sinL[i];
        const w1 = vn(px * 1.6 + o0, sp * 1.6 + o1, pz * 1.6 + o2) - .5, w2 = vn(px * 1.6 + o1 + 31.7, sp * 1.6 + o2 + 12.3, pz * 1.6 + o0 + 7.9) - .5, w3 = vn(px * 1.6 + o2 + 17.1, sp * 1.6 + o0 + 41.3, pz * 1.6 + o1 + 3.3) - .5;
        const qx = px * sc + 3.4 * w1 + o0, qy = sp * sc + 3.4 * w2 + o1, qz = pz * sc + 3.4 * w3 + o2;
        const n3 = .55 * vn(qx, qy, qz) + .28 * vn(qx * 2.1 + 5.2, qy * 2.1 + 5.2, qz * 2.1 + 5.2) + .17 * vn(qx * 4.4 + 9.1, qy * 4.4 + 9.1, qz * 4.4 + 9.1);
        const rel = clamp((n3 - .5) * 2 * 2.1, -1, 1);
        hh[j * GW + i] = bas * (1 + .6 * rel) + 26 * rel;
      }
    }
    b.ox = rnd(0, 50); b.oy = rnd(0, 50); b.oz = rnd(0, 50); b.st = 0;
    bake(b, 0);
  }
  function newVortices(b) {
    const v = [];
    for (let k = 0; k < 5; k++) {
      const strong = k < 3, sg = Math.random() < .5 ? -1 : 1;
      v.push({ l0: rnd(0, TAU), wl: rnd(-.22, .22) * (strong ? 1 : 2.2), p0: rnd(-.75, .75), wp: rnd(.07, .17), ph: rnd(0, TAU),
        g: sg * (strong ? rnd(.05, .1) : rnd(.025, .045)), s: strong ? rnd(.5, .8) : rnd(.3, .42) });
    }
    b.vort = v;
  }
  function spawn(b, now, initial) {
    const a = initial ? b.a0 : 0;
    b.life = rnd(28, 40); b.born = now - a * b.life;
    b.armT = initial ? 6 + b.slot * 3.2 : now + 9 + rnd(0, 4);
    b.rise0 = initial ? now - 2.6 - b.slot * .1 : now; b.fade0 = initial ? now - .5 - b.slot * .08 : now;
    b.rise = .55 + b.hr; b.scaleR = initial ? 1 : rnd(.88, 1.12);
    if (!initial) { const H = HOMES[b.slot]; b.hx = clamp(H[0] + rnd(-.08, .08), .1, .93); b.hy = clamp(H[1] + rnd(-.07, .07), .1, .88); }
    b.ax = rnd(.012, .03); b.ay = rnd(.012, .026); b.wx = rnd(.22, .42); b.wy = rnd(.28, .5); b.px = rnd(0, TAU); b.py = rnd(0, TAU);
    b.yaw = rnd(0, TAU); b.yawV = rnd(.07, .16) * (Math.random() < .5 ? -1 : 1);
    b.off.x = b.off.y = 0; b.swipe = 0; b.lastUpd = now; b.state = 'live';
    newVortices(b); seed(b, a);
  }

  // ---- 두께 시뮬: semi-Lagrangian(Catmull-Rom) 이류 → 보존형 중력 배수 → 증발/재주입 ----
  function advect(b, dt) {
    const src = b.h, dst = b.t, K = b.vort.length, st = b.st;
    for (let k = 0; k < K; k++) {
      const v = b.vort[k], lam = v.l0 + v.wl * st, phi = v.p0 * Math.sin(v.wp * st + v.ph);
      cx_[k] = Math.cos(phi) * Math.cos(lam); cy_[k] = Math.sin(phi); cz_[k] = Math.cos(phi) * Math.sin(lam);
      isg_[k] = 1 / (v.s * v.s); amp_[k] = v.g * 4 * isg_[k];
    }
    const kL = GW / TAU, kP = GH / Math.PI;
    for (let j = 0; j < GH; j++) {
      const cp = cosP[j], sp = sinP[j], icp = 1 / Math.max(cp, .18);
      for (let i = 0; i < GW; i++) {
        const cl = cosL[i], sl = sinL[i], px = cp * cl, pz = cp * sl;
        let gx = 0, gy = 0, gz = 0; // 스트림함수 ψ=ΣΓ·exp(-r²/σ²) 의 접선 기울기
        for (let k = 0; k < K; k++) {
          const cd = px * cx_[k] + sp * cy_[k] + pz * cz_[k], e = amp_[k] * Math.exp((2 * cd - 2) * isg_[k]);
          gx += e * (cx_[k] - cd * px); gy += e * (cy_[k] - cd * sp); gz += e * (cz_[k] - cd * pz);
        }
        const vx = sp * gz - pz * gy, vy = pz * gx - px * gz, vz = px * gy - sp * gx; // u = p × ∇ψ (발산 0)
        const ue = (-sl * vx + cl * vz) * icp, un = -sp * cl * vx + cp * vy - sp * sl * vz;
        const di = clamp(ue * dt * kL, -9, 9), dj = clamp(un * dt * kP, -9, 9);
        const sx = i - di, sy = clamp(j - dj, 0, GH - 1);
        const x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
        const xa = (x0 - 1) & 127, xb = x0 & 127, xc = (x0 + 1) & 127, xd = (x0 + 2) & 127;
        let r0 = 0, r1 = 0, r2 = 0, r3 = 0;
        for (let q = -1; q <= 2; q++) {
          const yy = y0 + q < 0 ? 0 : y0 + q > GH - 1 ? GH - 1 : y0 + q, bs = yy * GW;
          const a = src[bs + xa], bb = src[bs + xb], c = src[bs + xc], d = src[bs + xd];
          const val = bb + .5 * fx * (c - a + fx * (2 * a - 5 * bb + 4 * c - d + fx * (3 * (bb - c) + d - a)));
          if (q === -1) r0 = val; else if (q === 0) r1 = val; else if (q === 1) r2 = val; else r3 = val;
        }
        let o = r1 + .5 * fy * (r2 - r0 + fy * (2 * r0 - 5 * r1 + 4 * r2 - r3 + fy * (3 * (r1 - r2) + r3 - r0)));
        dst[j * GW + i] = o;
      }
    }
    b.h = dst; b.t = src;
  }
  function drain(b, dt) { // ∂h/∂t = -∂(g·h³)/∂y 의 upwind 유속(위 칸→아래 칸), 칸 폭(cosφ) 보정
    const h = b.h;
    for (let j = 0; j < GH - 1; j++) {
      const ratio = Math.max(cosP[j + 1], .12) / Math.max(cosP[j], .12);
      for (let i = 0; i < GW; i++) {
        const s = h[(j + 1) * GW + i]; if (!(s > 0)) continue;
        const fr = Math.min(.35, .06 * dt * s * s / 360000), q = s * fr;
        h[(j + 1) * GW + i] = s - q; h[j * GW + i] += q * ratio;
      }
    }
  }
  function stepField(b, now) {
    const dtR = clamp(now - b.lastUpd, .02, .6); b.lastUpd = now;
    const dtS = dtR * SIMRATE; b.st += dtS;
    advect(b, dtS); drain(b, dtS); bake(b, dtS);
  }

  // ---- 터짐 + 미스트 ----
  const mist = []; let hadMist = false;
  function spawnMist(b, n) {
    const P = b.P, a = Math.abs(P[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
    let e1 = [P[1] * a[2] - P[2] * a[1], P[2] * a[0] - P[0] * a[2], P[0] * a[1] - P[1] * a[0]]; e1 = nrm(e1);
    const e2 = [P[1] * e1[2] - P[2] * e1[1], P[2] * e1[0] - P[0] * e1[2], P[0] * e1[1] - P[1] * e1[0]];
    const al = Math.min(b.alpha, 3.0), ca = Math.cos(al), sa = Math.sin(al);
    for (let k = 0; k < n && mist.length < 190; k++) {
      const ps = rnd(0, TAU), c = Math.cos(ps), s = Math.sin(ps);
      const qx = ca * P[0] + sa * (c * e1[0] + s * e2[0]), qy = ca * P[1] + sa * (c * e1[1] + s * e2[1]), qz = ca * P[2] + sa * (c * e1[2] + s * e2[2]);
      if (qz < -.35 && Math.random() < .6) continue;
      const sp = rnd(.04, .3);
      mist.push({ x: b.cx + qx * b.cr, y: b.cy + qy * b.cr, vx: qx * sp + rnd(-.03, .03), vy: qy * sp + rnd(0, .09), life: rnd(.55, 1.3), age: 0, sz: rnd(1.1, 3.1), big: Math.random() < .12 });
    }
  }
  function burst(b, n, now) {
    if (b.state !== 'live' || b.fade < .35) return;
    b.state = 'burst'; b.bt0 = now; b.P = nrm(n); b.alpha = 0; spawnMist(b, 16);
  }
  function worldFromLocal(b, p) { const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw); return [p[0] * cy - p[2] * sy, p[1], p[0] * sy + p[2] * cy]; }
  function autoBurst(b, now) {
    let p = b.black > .05 ? b.bP : [.15, .92, .35];
    let w = worldFromLocal(b, p); if (w[2] < .12) w = [w[0] * .5, w[1], .3 + Math.abs(w[2])]; // 보이는 쪽으로 살짝 당김
    burst(b, w, now);
  }
  function hitTest(x, y) { // 위에 있는(작은 방울 우선) 방울 하나
    let best = null, bd = 1e9;
    for (const b of bubbles) {
      if (b.state !== 'live' || b.cr <= 0) continue;
      const d = Math.hypot(x - b.cx, y - b.cy); if (d < b.cr && b.cr < bd) { best = b; bd = b.cr; }
    }
    return best;
  }
  function hitNormal(b, x, y) { const dx = x - b.cx, dy = y - b.cy, z = Math.sqrt(Math.max(b.cr * b.cr - dx * dx - dy * dy, 1e-6)); return [dx / b.cr, dy / b.cr, z / b.cr]; }

  // ---- 포인터 ----
  const mp = { x: 0, y: 0, in: false, t: 0 };
  const toH = e => { const r = canvas.getBoundingClientRect(); return [(e.clientX - r.left) / r.height, 1 - (e.clientY - r.top) / r.height]; };
  const onMove = e => {
    const [x, y] = toH(e), nowMs = performance.now();
    if (mp.in) {
      const d = Math.hypot(x - mp.x, y - mp.y), sp = d / Math.max(10, nowMs - mp.t) * 1000;
      if (sp > 3.4) for (const b of bubbles) { // 빠르게 문지르면 터짐
        if (b.state === 'live' && Math.hypot(x - b.cx, y - b.cy) < b.cr * .95) { b.swipe += d; if (b.swipe > 1.1) burst(b, hitNormal(b, x, y), clock()); }
      }
    }
    mp.x = x; mp.y = y; mp.t = nowMs; mp.in = true;
  };
  const onLeave = () => { mp.in = false; };
  const onDown = e => { const [x, y] = toH(e), b = hitTest(x, y); if (b) burst(b, hitNormal(b, x, y), clock()); };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave); root.addEventListener('pointerdown', onDown);

  // ---- 프레임(CPU): 운동·상태·시뮬 스케줄·유니폼 ----
  function cpuStep(now, w, h) {
    const dt = clamp(now - prevT, .001, .12); prevT = now; nowT = now; aspect = w / h;
    const rs = Math.min(1, aspect * .72);
    for (let i = 0; i < NB; i++) {
      const b = bubbles[i];
      if (b.state === 'gone') { if (now >= b.respawnAt) spawn(b, now, false); else { ub[i * 4 + 2] = 0; up[i * 4 + 3] = -1; continue; } }
      const e = 1 - Math.pow(1 - clamp((now - b.rise0) / 3.4, 0, 1), 3);
      b.fade = sstep(0, .9, now - b.fade0);
      b.swipe = Math.max(0, b.swipe - dt * .9);
      const lf = clamp((now - b.born) / b.life, 0, 1.2);
      let x = b.hx * aspect + b.ax * Math.sin(b.wx * now + b.px) * 1.3;
      let y = b.hy + (lf - .5) * .16 + b.ay * Math.sin(b.wy * now + b.py);
      // 커서 척력 (화면 공간, 감쇠 추종)
      let tx = 0, ty = 0;
      if (mp.in) {
        const dx = x - mp.x, dy = y - mp.y, d = Math.hypot(dx, dy) + 1e-5, inf = b.hr * b.scaleR + .22;
        if (d < inf) { const k = Math.pow(1 - d / inf, 2) * .13; tx = dx / d * k; ty = dy / d * k; }
      }
      const al = 1 - Math.exp(-dt * 3.2); b.off.x += (tx - b.off.x) * al; b.off.y += (ty - b.off.y) * al;
      x += b.off.x; y += b.off.y - (1 - e) * b.rise;
      const r = b.hr * b.scaleR * rs * (.6 + .4 * e);
      b.cx = x; b.cy = y; b.cr = r; b.yaw += b.yawV * dt;
      ub[i * 4] = x; ub[i * 4 + 1] = y; ub[i * 4 + 2] = r; ub[i * 4 + 3] = b.yaw;
      us[i * 4] = b.fade; us[i * 4 + 1] = b.slot;
      if (b.state === 'burst') {
        b.alpha = (now - b.bt0) * 8.4;
        up[i * 4] = b.P[0]; up[i * 4 + 1] = b.P[1]; up[i * 4 + 2] = b.P[2]; up[i * 4 + 3] = b.alpha;
        if (b.alpha < 3.1) spawnMist(b, 7);
        if (b.alpha > Math.PI + .9) { b.state = 'gone'; b.respawnAt = now + .9 + rnd(0, 1.5); ub[i * 4 + 2] = 0; up[i * 4 + 3] = -1; }
      } else {
        up[i * 4 + 3] = -1;
        if (now > b.armT && (b.black > .1 || now - b.born > b.life)) autoBurst(b, now);
      }
    }
    // 시뮬: 가장 오래 갱신 안 된 살아있는 방울 1~2개 (≤9ms)
    const t1 = performance.now();
    for (let n = 0; n < 2; n++) {
      let pick = null;
      for (const b of bubbles) if (b.state === 'live' && (!pick || b.lastUpd < pick.lastUpd)) pick = b;
      if (!pick || now - pick.lastUpd < .1) break;
      stepField(pick, now);
      if (performance.now() - t1 > 9) break;
    }
    drawMist(dt, w, h);
  }
  function drawMist(dt, w, h) {
    const mw = Math.max(2, Math.round(mistC.clientWidth * .5)), mh = Math.max(2, Math.round(mistC.clientHeight * .5));
    if (mistC.width !== mw || mistC.height !== mh) { mistC.width = mw; mistC.height = mh; }
    if (!mist.length && !hadMist) return;
    m2.clearRect(0, 0, mw, mh); hadMist = mist.length > 0;
    const S = mh, dr = Math.exp(-1.4 * dt);
    for (let k = mist.length - 1; k >= 0; k--) {
      const m = mist[k]; m.age += dt;
      if (m.age >= m.life) { mist.splice(k, 1); continue; }
      m.vy -= .6 * dt; m.vx *= dr; m.vy *= dr; m.x += m.vx * dt; m.y += m.vy * dt;
      const f = 1 - m.age / m.life, a = Math.pow(f, .8), px = m.x * S, py = (1 - m.y) * S, rr = m.sz * (m.big ? 1.7 : 1) * .62 * (.6 + .4 * f);
      m2.fillStyle = 'rgba(190,232,255,' + (.3 * a).toFixed(3) + ')'; m2.beginPath(); m2.arc(px, py, rr * 1.9, 0, TAU); m2.fill();
      m2.fillStyle = 'rgba(255,255,255,' + (.85 * a).toFixed(3) + ')'; m2.beginPath(); m2.arc(px, py, rr, 0, TAU); m2.fill();
    }
  }

  // ---- WebGL 부팅 (컨텍스트 생성 실패·lost → 포스터 폴백) ----
  let g = null, frame = null, vis = true, lost = false;
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { rootMargin: '80px' }); io.observe(root);
  function setup(gl) {
    const p = compile(gl, FS()); gl.useProgram(p); triangle(gl);
    const u = U(gl, p, 'R T uTh uLut uB uP uS');
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.activeTexture(gl.TEXTURE0); const tTh = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tTh);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, GW, ATLAS_H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.activeTexture(gl.TEXTURE1); const tLut = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tLut);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, LUTN, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(u.uTh, 0); gl.uniform1i(u.uLut, 1);
    pending.fill(true);
    return (t, w, h) => {
      cpuStep(t, w, h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tTh);
      for (let s = 0; s < NB; s++) if (pending[s]) {
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, s * GH, GW, GH, gl.LUMINANCE, gl.UNSIGNED_BYTE, atlas.subarray(s * NC, (s + 1) * NC)); pending[s] = false;
      }
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, tLut);
      gl.viewport(0, 0, w, h); gl.uniform2f(u.R, w, h); gl.uniform1f(u.T, t);
      gl.uniform4fv(u.uB, ub); gl.uniform4fv(u.uP, up); gl.uniform4fv(u.uS, us);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
  }
  function start() {
    try {
      g = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
      if (!g) throw 0;
      frame = setup(g); root.classList.remove('is-fallback');
    } catch (e) { frame = null; root.classList.add('is-fallback'); if (e) console.warn('[gl]', e.message || e); }
  }
  const onLost = e => { e.preventDefault(); lost = true; frame = null; };
  const onRest = () => { lost = false; start(); };
  canvas.addEventListener('webglcontextlost', onLost); canvas.addEventListener('webglcontextrestored', onRest);

  // 초기 방울: 시작 두께를 바로 풍성하게 시드(워밍업 없음), 나이를 엇갈리게
  bubbles.forEach(b => spawn(b, 0, true));
  start();
  let lastF = -1, cost = 0;
  const off = ctx.tick(() => {
    if (!frame || !vis || document.hidden || lost || !g || g.isContextLost()) return;
    const tn = clock(); if (tn - lastF < CAP) return; lastF = tn;
    fit(canvas, SCALE);
    const c0 = performance.now(); try { frame(tn, canvas.width, canvas.height); cost += (performance.now() - c0 - cost) * .1; } catch (e) { frame = null; root.classList.add('is-fallback'); console.warn('[gl]', e.message || e); }
  });
  root.__s165 = { burstAll: () => bubbles.forEach(b => autoBurst(b, clock())), bubbles, age: (i, sec) => { const b = bubbles[i]; for (let k = 0; k < sec / .45; k++) { b.lastUpd = nowT - .3; stepField(b, nowT); } }, get cost() { return cost; } };

  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave); root.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('webglcontextlost', onLost); canvas.removeEventListener('webglcontextrestored', onRest);
    delete root.__s165; mist.length = 0;
  };
}
