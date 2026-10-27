// s196 — 2D Radiance Cascades (Sannikov 방식) 직접 구현. 외부 코드 사용 없음.
// 장면(SDF 도형: 발광 카드·조명·벽) → 거리장 텍스처 → 캐스케이드 i=4..0 (프로브 간격 2^i, 방향 4^(i+1), 구간 [t_i,t_i+1]) 스피어 트레이싱
// → 상위→하위 병합 I = I_i + β_i·I' (premultiplied alpha) → 각 프로브 4방향 평균 = 입사광 E → 합성/톤매핑.
// 경로: WebGL float FBO → half-float FBO → CPU(Float32Array, 시간 분할) → (모두 실패 시) CSS 포스터.
const WS = 192, HS = 112;          // 장면 격자(월드 px). 112 = 16·7 이라 5단 캐스케이드가 정수로 떨어진다
const NC = 5, NS = 12, L0 = 1;
const STEPS = [3, 6, 10, 12, 16];
const EXPO = 1.15;
const TAU = Math.PI * 2;

// ---------- 장면 (월드 좌표, y 위쪽) ----------
const SA = new Float32Array(NS * 4), SB = new Float32Array(NS * 4), SE = new Float32Array(NS * 3), SL = new Float32Array(NS * 3);
const ZERO = [0, 0, 0];
const EMI = { cyan: [.34, 1.62, 2.1], mag: [2.8, .3, 1.8], amber: [3, 1.5, .24], lime: [1.1, 2.2, .22], bulb: [7, 6.7, 6.1], warm: [7.5, 3.1, 1.4], cool: [1.6, 3, 7] };
const ALB = { floor: [.86, .82, .76], pillar: [.78, .8, .86], louver: [.92, .9, .86], block: [.9, .62, .42], ball: [.9, .86, .82], card: [.12, .12, .14] };
function put(i, x, y, hx, hy, rot, r, disc, e, a) {
  SA[i * 4] = x; SA[i * 4 + 1] = y; SA[i * 4 + 2] = hx; SA[i * 4 + 3] = hy;
  SB[i * 4] = Math.cos(rot); SB[i * 4 + 1] = Math.sin(rot); SB[i * 4 + 2] = r; SB[i * 4 + 3] = disc ? 1 : 0;
  SE[i * 3] = e[0]; SE[i * 3 + 1] = e[1]; SE[i * 3 + 2] = e[2];
  SL[i * 3] = a[0]; SL[i * 3 + 1] = a[1]; SL[i * 3 + 2] = a[2];
}
function updateScene(t, lx, ly) {
  put(0, 96, 2.8, 108, 4, 0, 0, 0, ZERO, ALB.floor);
  put(1, 84, 36, 4.5, 15, 0, 1.2, 0, ZERO, ALB.pillar);
  put(2, 138, 68, 3, 13, Math.sin(t * .42) * .75, 1, 0, ZERO, ALB.louver);
  put(3, 120, 23, 9, 6.5, 0, 1.3, 0, ZERO, ALB.block);
  put(4, 163, 91, 7, 7, 0, 0, 1, ZERO, ALB.ball);
  put(5, 111 + Math.sin(t * .27) * 11, 87 + Math.sin(t * .4) * 4, 15, 7, Math.sin(t * .33) * .2, 2, 0, EMI.cyan, ALB.card);
  put(6, 150, 41, 14, 2.5, t * .26, 1.2, 0, EMI.mag, ALB.card);
  put(7, 66 + Math.cos(t * .3) * 7, 24 + Math.sin(t * .37) * 4, 6.5, 6.5, -t * .22, 1.6, 0, EMI.amber, ALB.card);
  put(8, 183, 62 + Math.sin(t * .35) * 12, 3.5, 13, 0, 1.5, 0, EMI.lime, ALB.card);
  put(9, lx, ly, 2.6, 2.6, 0, 0, 1, EMI.bulb, ZERO);
  put(10, 84 + 24 * Math.cos(t * .33), 62 + 10 * Math.sin(t * .33), 1.9, 1.9, 0, 0, 1, EMI.warm, ZERO);
  put(11, 163 + 14 * Math.cos(-t * .62), 91 + 14 * Math.sin(-t * .62), 1.7, 1.7, 0, 0, 1, EMI.cool, ZERO);
}

// ---------- GLSL ----------
const PRE = '#ifdef GL_FRAGMENT_PRECISION_HIGH\nprecision highp float;\n#else\nprecision mediump float;\n#endif\n';
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
const SDF = `
#define NS ${NS}
uniform vec4 uA[NS];uniform vec4 uB[NS];uniform vec3 uEm[NS];uniform vec3 uAl[NS];
float sdOne(vec2 p,vec4 a,vec4 b){
  vec2 q=p-a.xy;
  if(b.w>.5)return length(q)-a.z;
  q=vec2(b.x*q.x+b.y*q.y,-b.y*q.x+b.x*q.y);
  vec2 w=abs(q)-a.zw+b.z;
  return length(max(w,0.))+min(max(w.x,w.y),0.)-b.z;
}
float sdScene(vec2 p){
  float d=1e4;
  for(int i=0;i<NS;i++){d=min(d,sdOne(p,uA[i],uB[i]));}
  return d;
}
float sdSceneA(vec2 p,out vec3 em,out vec3 al,out vec4 ba,out vec4 bb){
  float d=1e4;em=vec3(0.);al=vec3(0.);ba=vec4(0.);bb=vec4(0.);
  for(int i=0;i<NS;i++){float e=sdOne(p,uA[i],uB[i]);if(e<d){d=e;em=uEm[i];al=uAl[i];ba=uA[i];bb=uB[i];}}
  return d;
}`;
// 1) 장면 패스: rgb=가장 가까운 도형의 발광색, a=부호 있는 거리(월드 px)
const FS_SCENE = SDF + `
void main(){
  vec2 p=floor(gl_FragCoord.xy)+.5;
  vec3 em,al;vec4 ba,bb;float d=sdSceneA(p,em,al,ba,bb);
  gl_FragColor=vec4(em,clamp(d,-6.,120.));
}`;
// 2) 캐스케이드 패스: 텍셀 = (프로브, 방향). 구간 마칭 + 상위 병합
const FS_CASC = `
varying vec2 v;
uniform sampler2D uScene;uniform sampler2D uUp;
uniform vec2 uSz;uniform vec2 uUpSz;
uniform float uB0,uSp,uT0,uT1,uSteps,uMin,uHasUp;
vec4 fetchUp(vec2 pr,float idx){
  float Bu=uB0*2.;
  vec2 tc=pr*Bu+vec2(mod(idx,Bu),floor(idx/Bu))+.5;
  return texture2D(uUp,tc/(uSz*2.));
}
float valid(vec2 pr){return step(.5,texture2D(uScene,(pr+.5)*uSp*2./uSz).a);}
void main(){
  vec2 fc=floor(gl_FragCoord.xy);
  vec2 pr=floor(fc/uB0);
  vec2 dx=fc-pr*uB0;
  float k=dx.x+dx.y*uB0;
  float ang=(k+.5)/(uB0*uB0)*6.28318530718;
  vec2 dir=vec2(cos(ang),sin(ang));
  vec2 pos=(pr+.5)*uSp;
  vec2 tt=vec2(1e5);
  if(dir.x>1e-4)tt.x=(uSz.x-pos.x)/dir.x;else if(dir.x<-1e-4)tt.x=-pos.x/dir.x;
  if(dir.y>1e-4)tt.y=(uSz.y-pos.y)/dir.y;else if(dir.y<-1e-4)tt.y=-pos.y/dir.y;
  float tx=min(tt.x,tt.y);
  vec3 rad=vec3(0.);float T=1.;
  if(uT0<tx){
    float tE=min(uT1,tx);float t=uT0;
    for(int s=0;s<16;s++){
      if(float(s)>=uSteps||t>tE)break;
      vec4 sc=texture2D(uScene,(pos+dir*t)/uSz);
      if(sc.a<.4){rad=sc.rgb;T=0.;break;}
      t+=max(sc.a,uMin);
    }
    if(T>0.&&uHasUp>.5&&tx>uT1){
      vec2 u=(pr+.5)*.5-.5;
      vec2 q0=floor(u);vec2 f=u-q0;
      vec2 hi=uUpSz-1.;
      vec2 qa=clamp(q0,vec2(0.),hi),qb=clamp(q0+1.,vec2(0.),hi);
      vec2 q10=vec2(qb.x,qa.y),q01=vec2(qa.x,qb.y);
      float w00=(1.-f.x)*(1.-f.y)*valid(qa),w10=f.x*(1.-f.y)*valid(q10),w01=(1.-f.x)*f.y*valid(q01),w11=f.x*f.y*valid(qb);
      float sw=w00+w10+w01+w11;
      if(sw<1e-4){w00=(1.-f.x)*(1.-f.y);w10=f.x*(1.-f.y);w01=(1.-f.x)*f.y;w11=f.x*f.y;sw=1.;}
      float is=.25/sw;
      w00*=is;w10*=is;w01*=is;w11*=is;
      vec4 acc=vec4(0.);
      for(int m=0;m<4;m++){
        float idx=k*4.+float(m);
        acc+=w00*fetchUp(qa,idx)+w10*fetchUp(q10,idx)+w01*fetchUp(q01,idx)+w11*fetchUp(qb,idx);
      }
      rad+=T*acc.rgb;T*=acc.a;
    }
  }
  gl_FragColor=vec4(rad,T);
}`;
// 3) 캐스케이드0 의 프로브당 4방향 평균 = 입사광 E
const FS_RES = `
varying vec2 v;uniform sampler2D uC0;uniform vec2 uSz;
void main(){
  vec2 fc=floor(gl_FragCoord.xy);
  vec3 s=vec3(0.);
  for(int k=0;k<4;k++){
    vec2 tc=fc*2.+vec2(mod(float(k),2.),floor(float(k)/2.))+.5;
    s+=texture2D(uC0,tc/(uSz*2.)).rgb;
  }
  gl_FragColor=vec4(s*.25,1.);
}`;
// 3b) 불투명 도형 안쪽 프로브는 광선이 전부 막혀 E=0 이다. 바깥 열린 프로브의 E 를 가우시안으로 안쪽 7px 까지 번지게 채워
//     표면이 "자기 주변이 받는 빛"으로 칠해지게 한다(경계 쌍선형 보간의 검은 테두리·법선 이음매도 같이 사라진다).
const FS_FILL = `
varying vec2 v;uniform sampler2D uE;uniform sampler2D uScn;uniform vec2 uSz;
void main(){
  vec2 fc=floor(gl_FragCoord.xy);
  vec2 uv=(fc+.5)/uSz;
  vec4 c=texture2D(uE,uv);
  if(texture2D(uScn,uv).a>=.5){gl_FragColor=c;return;}
  vec3 s=vec3(0.);float w=0.;
  for(int j=-7;j<=7;j++){for(int i=-7;i<=7;i++){
    vec2 q=(fc+vec2(float(i),float(j))+.5)/uSz;
    float k=step(.5,texture2D(uScn,q).a)*exp(-float(i*i+j*j)*.05);
    s+=k*texture2D(uE,q).rgb;w+=k;
  }}
  gl_FragColor=vec4(w>0.?s/w:vec3(0.),1.);
}`;
// 4) 합성: 해석적 도형(고해상도 경계) + E 로 표면/공기 조명 + 톤매핑
const FS_DISP = SDF + `
varying vec2 v;
uniform vec2 uSz;uniform vec2 uSc;uniform float uPx;uniform float uExp;uniform sampler2D uE;uniform sampler2D uS;
vec3 bilE(vec2 p){
  vec2 u=p-.5;vec2 i=floor(u);vec2 f=u-i;
  vec2 a=clamp(i,vec2(0.),uSz-1.),b=clamp(i+1.,vec2(0.),uSz-1.);
  vec3 c00=texture2D(uE,(a+.5)/uSz).rgb;
  vec3 c10=texture2D(uE,(vec2(b.x,a.y)+.5)/uSz).rgb;
  vec3 c01=texture2D(uE,(vec2(a.x,b.y)+.5)/uSz).rgb;
  vec3 c11=texture2D(uE,(b+.5)/uSz).rgb;
  return mix(mix(c00,c10,f.x),mix(c01,c11,f.x),f.y);
}
float T(vec2 p){return texture2D(uS,p/uSz).a;}
void main(){
  vec2 p=((v-.5)*uSc+.5)*uSz;
  float dT=T(p);
  vec2 gq=abs(fract(p/12.)-.5)*12.;
  float ln=1.-smoothstep(0.,uPx*1.4+.05,min(6.-gq.x,6.-gq.y)-.1);
  vec3 wall=vec3(.2,.21,.29)*(1.-.3*ln);
  vec3 amb=vec3(.008,.011,.026)*(.6+.8*p.y/uSz.y);
  vec3 E=bilE(p);
  vec3 col=wall*(E*1.5+.04)+E*.42+amb;
  if(dT<4.){
    vec3 em,al;vec4 ba,bb;float d=sdSceneA(p,em,al,ba,bb);
    float cov=clamp(.5-d/uPx,0.,1.);
    if(cov>0.){
      vec3 sc;
      if(max(em.r,max(em.g,em.b))>.25)sc=em*(.55+.6*exp(-max(-d,0.)/2.2));
      else sc=al*(E*2.4+.06);
      col=mix(col,sc,cov);
    }
  }
  col*=uExp;
  col=1.-exp(-col);
  col=pow(col,vec3(.78));
  col*=1.-.6*smoothstep(.3,.95,length(v-.5));
  col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)*(1.5/255.);
  gl_FragColor=vec4(col,1.);
}`;

// ---------- WebGL 유틸 ----------
function compile(g, fs) {
  const sh = (t, c) => { const o = g.createShader(t); g.shaderSource(o, c); g.compileShader(o); if (!g.getShaderParameter(o, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(o)); return o; };
  const p = g.createProgram();
  g.attachShader(p, sh(g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g.FRAGMENT_SHADER, PRE + fs));
  g.bindAttribLocation(p, 0, 'p'); g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
  return p;
}
function U(g, p, names) { const o = {}; names.split(' ').forEach(n => o[n] = g.getUniformLocation(p, n)); return o; }
function fit(c, s) { const w = Math.max(2, Math.round(c.clientWidth * s)), h = Math.max(2, Math.round(c.clientHeight * s)); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; return true; } return false; }

// 부동소수점 RT 를 실제로 만들어 보고 FBO 완전성으로 기능 검사한다. 실패하면 throw.
function makeGL(canvas, mode) {
  const g = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!g) throw new Error('no webgl');
  const ext = g.getExtension(mode === 'float' ? 'OES_texture_float' : 'OES_texture_half_float');
  if (!ext) throw new Error(mode + ' texture unsupported');
  g.getExtension(mode === 'float' ? 'WEBGL_color_buffer_float' : 'EXT_color_buffer_half_float');
  const type = mode === 'float' ? g.FLOAT : ext.HALF_FLOAT_OES;
  const lin = !!g.getExtension(mode === 'float' ? 'OES_texture_float_linear' : 'OES_texture_half_float_linear');
  const own = [];
  const dispose = () => { own.forEach(o => { try { o() } catch (e) { } }); };
  try {
    while (g.getError() !== g.NO_ERROR); // 이전 시도의 에러 비우기
    const target = (w, h, linear) => {
      const tex = g.createTexture(); g.bindTexture(g.TEXTURE_2D, tex);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, w, h, 0, g.RGBA, type, null);
      const f = linear ? g.LINEAR : g.NEAREST;
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, f); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, f);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      const fbo = g.createFramebuffer(); g.bindFramebuffer(g.FRAMEBUFFER, fbo);
      g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
      own.push(() => { g.deleteTexture(tex); g.deleteFramebuffer(fbo); });
      const st = g.checkFramebufferStatus(g.FRAMEBUFFER);
      g.bindFramebuffer(g.FRAMEBUFFER, null);
      if (st !== g.FRAMEBUFFER_COMPLETE) throw new Error(mode + ' fbo incomplete ' + st);
      return { tex, fbo, w, h };
    };
    const sceneT = target(WS, HS, lin), casT = [target(2 * WS, 2 * HS, false), target(2 * WS, 2 * HS, false)], eT = target(WS, HS, false), e2T = target(WS, HS, false);
    if (g.getError() !== g.NO_ERROR) throw new Error(mode + ' gl error');

    const mk = fs => { const p = compile(g, fs); own.push(() => g.deleteProgram(p)); return p; };
    const pS = mk(FS_SCENE), pC = mk(FS_CASC), pR = mk(FS_RES), pF = mk(FS_FILL), pD = mk(FS_DISP);
    const uS = U(g, pS, 'uA uB uEm uAl');
    const uC = U(g, pC, 'uScene uUp uSz uUpSz uB0 uSp uT0 uT1 uSteps uMin uHasUp');
    const uR = U(g, pR, 'uC0 uSz');
    const uF = U(g, pF, 'uE uScn uSz');
    const uD = U(g, pD, 'uA uB uEm uAl uSz uSc uPx uExp uE uS');
    g.useProgram(pC); g.uniform1i(uC.uScene, 0); g.uniform1i(uC.uUp, 1);
    g.useProgram(pR); g.uniform1i(uR.uC0, 0);
    g.useProgram(pF); g.uniform1i(uF.uE, 0); g.uniform1i(uF.uScn, 1); g.uniform2f(uF.uSz, WS, HS);
    g.useProgram(pD); g.uniform1i(uD.uE, 0); g.uniform1i(uD.uS, 1);
    const buf = g.createBuffer(); own.push(() => g.deleteBuffer(buf));
    g.bindBuffer(g.ARRAY_BUFFER, buf); g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    g.enableVertexAttribArray(0); g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.disable(g.BLEND); g.disable(g.DEPTH_TEST);

    // 캐스케이드별 상수: 프로브 간격 2^i, 블록 변 2^(i+1)(방향 4^(i+1)), 구간 [t_i, t_i+1], t_i = L0(4^i-1)/3
    const diag = Math.hypot(WS, HS);
    const CP = [];
    for (let i = 0; i < NC; i++) {
      const t0 = L0 * (4 ** i - 1) / 3, t1 = L0 * (4 ** (i + 1) - 1) / 3;
      CP.push({ B: 2 << i, sp: 1 << i, t0, t1, steps: STEPS[i], min: Math.max(.6, (Math.min(t1, diag) - t0) / (STEPS[i] * 1.25)) });
    }
    const shapes = u => { g.uniform4fv(u.uA, SA); g.uniform4fv(u.uB, SB); g.uniform3fv(u.uEm, SE); g.uniform3fv(u.uAl, SL); };

    return {
      name: mode, gl: true, g,
      frame(w, h, sx, sy) {
        g.bindFramebuffer(g.FRAMEBUFFER, sceneT.fbo); g.viewport(0, 0, WS, HS);
        g.useProgram(pS); shapes(uS); g.drawArrays(g.TRIANGLES, 0, 3);

        g.useProgram(pC);
        g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, sceneT.tex);
        g.uniform2f(uC.uSz, WS, HS);
        let di = 0, last = null;
        for (let i = NC - 1; i >= 0; i--) {
          const d = casT[di], up = casT[1 - di], P = CP[i];
          g.bindFramebuffer(g.FRAMEBUFFER, d.fbo); g.viewport(0, 0, d.w, d.h);
          g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, up.tex);
          g.uniform1f(uC.uB0, P.B); g.uniform1f(uC.uSp, P.sp); g.uniform1f(uC.uT0, P.t0); g.uniform1f(uC.uT1, P.t1);
          g.uniform1f(uC.uSteps, P.steps); g.uniform1f(uC.uMin, P.min); g.uniform1f(uC.uHasUp, i < NC - 1 ? 1 : 0);
          g.uniform2f(uC.uUpSz, WS >> (i + 1), HS >> (i + 1));
          g.drawArrays(g.TRIANGLES, 0, 3);
          last = d; di = 1 - di;
        }

        g.bindFramebuffer(g.FRAMEBUFFER, eT.fbo); g.viewport(0, 0, WS, HS);
        g.useProgram(pR); g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, last.tex);
        g.uniform2f(uR.uSz, WS, HS); g.drawArrays(g.TRIANGLES, 0, 3);

        g.bindFramebuffer(g.FRAMEBUFFER, e2T.fbo);
        g.useProgram(pF); g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, sceneT.tex);
        g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, eT.tex); g.drawArrays(g.TRIANGLES, 0, 3);

        g.bindFramebuffer(g.FRAMEBUFFER, null); g.viewport(0, 0, w, h);
        g.useProgram(pD); shapes(uD);
        g.activeTexture(g.TEXTURE1); g.bindTexture(g.TEXTURE_2D, sceneT.tex);
        g.activeTexture(g.TEXTURE0); g.bindTexture(g.TEXTURE_2D, e2T.tex);
        g.uniform2f(uD.uSz, WS, HS); g.uniform2f(uD.uSc, sx, sy); g.uniform1f(uD.uPx, WS * sx / w); g.uniform1f(uD.uExp, EXPO);
        g.drawArrays(g.TRIANGLES, 0, 3);
      },
      // 첫 프레임 직후 한 번: 캔버스가 통째로 까맣다면 이 경로는 쓸 수 없다(float 렌더가 선언만 되고 실제로는 0 을 내는 드라이버 대비)
      sane(w, h) {
        const px = new Uint8Array(w * h * 4); g.readPixels(0, 0, w, h, g.RGBA, g.UNSIGNED_BYTE, px);
        let s = 0, n = 0; for (let i = 0; i < px.length; i += 16) { s += px[i] + px[i + 1] + px[i + 2]; n++; }
        return s / (3 * n) > 4;
      },
      destroy() { dispose(); }
    };
  } catch (e) { dispose(); throw e; }
}

// ---------- CPU 폴백: 같은 알고리즘, 96×56 격자, 4단, 프레임 분할 ----------
function makeCPU(canvas) {
  const c2 = canvas.getContext('2d', { alpha: false });
  if (!c2) throw new Error('no 2d');
  const CW = 96, CH = 56, CN = 4, CL0 = 1.4, ws = CW / WS, TW = 2 * CW, TH = 2 * CH;
  const CST = [2, 5, 8, 10];
  const DW = 160;
  let DH = 90, img = null, px = null;
  const resize = ar => { const nh = Math.max(2, Math.round(DW / ar)); if (nh !== DH || !img) { DH = nh; canvas.width = DW; canvas.height = DH; img = c2.createImageData(DW, DH); px = img.data; } };
  resize(16 / 9);
  const sdf = new Float32Array(CW * CH), emg = new Float32Array(CW * CH * 3);
  const cas = [new Float32Array(TW * TH * 4), new Float32Array(TW * TH * 4)];
  const eg = new Float32Array(CW * CH * 3), eg2 = new Float32Array(CW * CH * 3);
  const cosT = [], sinT = [];
  for (let i = 0; i < CN; i++) { const D = (2 << i) ** 2, c = new Float32Array(D), s = new Float32Array(D); for (let k = 0; k < D; k++) { const a = (k + .5) / D * TAU; c[k] = Math.cos(a); s[k] = Math.sin(a); } cosT.push(c); sinT.push(s); }
  const CP = [];
  for (let i = 0; i < CN; i++) { const t0 = CL0 * (4 ** i - 1) / 3, t1 = CL0 * (4 ** (i + 1) - 1) / 3; CP.push({ B: 2 << i, sp: 1 << i, t0, t1, steps: CST[i], min: Math.max(.6, (Math.min(t1, 125) - t0) / (CST[i] * 1.25)) }); }

  function sdOne(i, x, y) {
    const qx = x - SA[i * 4], qy = y - SA[i * 4 + 1];
    if (SB[i * 4 + 3] > .5) return Math.hypot(qx, qy) - SA[i * 4 + 2];
    const c = SB[i * 4], s = SB[i * 4 + 1], r = SB[i * 4 + 2];
    const rx = Math.abs(c * qx + s * qy) - SA[i * 4 + 2] + r, ry = Math.abs(-s * qx + c * qy) - SA[i * 4 + 3] + r;
    return Math.hypot(Math.max(rx, 0), Math.max(ry, 0)) + Math.min(Math.max(rx, ry), 0) - r;
  }
  function sdScene(x, y) { let d = 1e4; for (let i = 0; i < NS; i++) { const e = sdOne(i, x, y); if (e < d) d = e; } return d; }
  const cl = (v, a, b) => v < a ? a : v > b ? b : v;
  function gridSd(x, y) {
    const u = x - .5, v = y - .5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const i0 = cl(i, 0, CW - 1), i1 = cl(i + 1, 0, CW - 1), j0 = cl(j, 0, CH - 1), j1 = cl(j + 1, 0, CH - 1);
    return (sdf[j0 * CW + i0] * (1 - fx) + sdf[j0 * CW + i1] * fx) * (1 - fy) + (sdf[j1 * CW + i0] * (1 - fx) + sdf[j1 * CW + i1] * fx) * fy;
  }
  function buildGrid() {
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const wx = (x + .5) / ws, wy = (y + .5) / ws; let best = 1e4, bi = 0;
      for (let i = 0; i < NS; i++) { const d = sdOne(i, wx, wy); if (d < best) { best = d; bi = i; } }
      const k = y * CW + x; sdf[k] = cl(best, -6, 120) * ws;
      emg[k * 3] = SE[bi * 3]; emg[k * 3 + 1] = SE[bi * 3 + 1]; emg[k * 3 + 2] = SE[bi * 3 + 2];
    }
  }
  function cascade(i, out, up) {
    const P = CP[i], B = P.B, sp = P.sp, D = B * B, hasUp = i < CN - 1, Bu = B * 2, npx = CW >> (i + 1), npy = CH >> (i + 1);
    const ct = cosT[i], st = sinT[i];
    for (let y = 0; y < TH; y++) for (let x = 0; x < TW; x++) {
      const prx = Math.floor(x / B), pry = Math.floor(y / B), k = (x - prx * B) + (y - pry * B) * B;
      const dx = ct[k], dy = st[k], px0 = (prx + .5) * sp, py0 = (pry + .5) * sp;
      let tx = 1e5, ty = 1e5;
      if (dx > 1e-4) tx = (CW - px0) / dx; else if (dx < -1e-4) tx = -px0 / dx;
      if (dy > 1e-4) ty = (CH - py0) / dy; else if (dy < -1e-4) ty = -py0 / dy;
      const tmax = Math.min(tx, ty);
      let r = 0, g = 0, b = 0, T = 1;
      if (P.t0 < tmax) {
        const tE = Math.min(P.t1, tmax); let t = P.t0;
        for (let s = 0; s < P.steps && t <= tE; s++) {
          const sx = px0 + dx * t, sy = py0 + dy * t, d = gridSd(sx, sy);
          if (d < .4 * ws * 2) {
            const ci = (cl(Math.floor(sy), 0, CH - 1) * CW + cl(Math.floor(sx), 0, CW - 1)) * 3;
            r = emg[ci]; g = emg[ci + 1]; b = emg[ci + 2]; T = 0; break;
          }
          t += d > P.min ? d : P.min;
        }
        if (T > 0 && hasUp && tmax > P.t1) {
          const ux = (prx + .5) * .5 - .5, uy = (pry + .5) * .5 - .5, q0x = Math.floor(ux), q0y = Math.floor(uy), fx = ux - q0x, fy = uy - q0y;
          const ax = cl(q0x, 0, npx - 1), bx = cl(q0x + 1, 0, npx - 1), ay = cl(q0y, 0, npy - 1), by = cl(q0y + 1, 0, npy - 1);
          const spu = sp * 2;
          let w00 = (1 - fx) * (1 - fy) * (gridSd((ax + .5) * spu, (ay + .5) * spu) > .5 * ws * 2 ? 1 : 0);
          let w10 = fx * (1 - fy) * (gridSd((bx + .5) * spu, (ay + .5) * spu) > .5 * ws * 2 ? 1 : 0);
          let w01 = (1 - fx) * fy * (gridSd((ax + .5) * spu, (by + .5) * spu) > .5 * ws * 2 ? 1 : 0);
          let w11 = fx * fy * (gridSd((bx + .5) * spu, (by + .5) * spu) > .5 * ws * 2 ? 1 : 0);
          let sw = w00 + w10 + w01 + w11;
          if (sw < 1e-4) { w00 = (1 - fx) * (1 - fy); w10 = fx * (1 - fy); w01 = (1 - fx) * fy; w11 = fx * fy; sw = 1; }
          const is = .25 / sw; w00 *= is; w10 *= is; w01 *= is; w11 *= is;
          let ar = 0, ag = 0, ab = 0, aa = 0;
          for (let m = 0; m < 4; m++) {
            const idx = k * 4 + m, ox = idx % Bu, oy = (idx / Bu) | 0;
            const i00 = ((ay * Bu + oy) * TW + ax * Bu + ox) * 4, i10 = ((ay * Bu + oy) * TW + bx * Bu + ox) * 4;
            const i01 = ((by * Bu + oy) * TW + ax * Bu + ox) * 4, i11 = ((by * Bu + oy) * TW + bx * Bu + ox) * 4;
            ar += w00 * up[i00] + w10 * up[i10] + w01 * up[i01] + w11 * up[i11];
            ag += w00 * up[i00 + 1] + w10 * up[i10 + 1] + w01 * up[i01 + 1] + w11 * up[i11 + 1];
            ab += w00 * up[i00 + 2] + w10 * up[i10 + 2] + w01 * up[i01 + 2] + w11 * up[i11 + 2];
            aa += w00 * up[i00 + 3] + w10 * up[i10 + 3] + w01 * up[i01 + 3] + w11 * up[i11 + 3];
          }
          r += T * ar; g += T * ag; b += T * ab; T *= aa;
        }
      }
      const o = (y * TW + x) * 4; out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = T;
    }
  }
  function resolve(c0) {
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < 4; k++) { const o = ((y * 2 + (k >> 1)) * TW + x * 2 + (k & 1)) * 4; r += c0[o]; g += c0[o + 1]; b += c0[o + 2]; }
      const e = (y * CW + x) * 3; eg[e] = r * .25; eg[e + 1] = g * .25; eg[e + 2] = b * .25;
    }
    // 불투명 도형 안쪽은 바깥 열린 셀의 E 를 가우시안으로 채운다(GLSL FS_FILL 과 동일)
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const k0 = y * CW + x, e = k0 * 3;
      if (sdf[k0] >= .4) { eg2[e] = eg[e]; eg2[e + 1] = eg[e + 1]; eg2[e + 2] = eg[e + 2]; continue; }
      let r = 0, g = 0, b = 0, w = 0;
      for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) {
        const xx = cl(x + i, 0, CW - 1), yy = cl(y + j, 0, CH - 1), kk = yy * CW + xx;
        if (sdf[kk] < .4) continue;
        const wt = Math.exp(-(i * i + j * j) * .2); r += wt * eg[kk * 3]; g += wt * eg[kk * 3 + 1]; b += wt * eg[kk * 3 + 2]; w += wt;
      }
      if (w > 0) { eg2[e] = r / w; eg2[e + 1] = g / w; eg2[e + 2] = b / w; } else { eg2[e] = eg2[e + 1] = eg2[e + 2] = 0; }
    }
  }
  const E = [0, 0, 0];
  function bilE(wx, wy) {
    const u = wx * ws - .5, v = wy * ws - .5, i = Math.floor(u), j = Math.floor(v), fx = u - i, fy = v - j;
    const a = cl(i, 0, CW - 1), b = cl(i + 1, 0, CW - 1), c = cl(j, 0, CH - 1), d = cl(j + 1, 0, CH - 1);
    for (let k = 0; k < 3; k++) E[k] = (eg2[(c * CW + a) * 3 + k] * (1 - fx) + eg2[(c * CW + b) * 3 + k] * fx) * (1 - fy) + (eg2[(d * CW + a) * 3 + k] * (1 - fx) + eg2[(d * CW + b) * 3 + k] * fx) * fy;
    return E;
  }
  function display(sx, sy, exp) {
    const pxw = WS * sx / DW;
    for (let y = 0; y < DH; y++) for (let x = 0; x < DW; x++) {
      const u = (x + .5) / DW, v = 1 - (y + .5) / DH;
      const wx = ((u - .5) * sx + .5) * WS, wy = ((v - .5) * sy + .5) * HS;
      let d = 1e4, bi = 0;
      for (let i = 0; i < NS; i++) { const e = sdOne(i, wx, wy); if (e < d) { d = e; bi = i; } }
      const e0 = bilE(wx, wy), Er = e0[0], Eg = e0[1], Eb = e0[2];
      const gx = Math.abs(((wx / 12) % 1 + 1) % 1 - .5) * 12, gy = Math.abs(((wy / 12) % 1 + 1) % 1 - .5) * 12;
      const ln = 1 - cl((Math.min(6 - gx, 6 - gy) - .1) / (pxw * 1.4 + .05), 0, 1);
      const wk = 1 - .3 * ln, amb = .6 + .8 * wy / HS;
      let r = .2 * wk * (Er * 1.5 + .04) + Er * .42 + .008 * amb, g = .21 * wk * (Eg * 1.5 + .04) + Eg * .42 + .011 * amb, b = .29 * wk * (Eb * 1.5 + .04) + Eb * .42 + .026 * amb;
      const cov = cl(.5 - d / pxw, 0, 1);
      if (cov > 0) {
        const er = SE[bi * 3], eg3 = SE[bi * 3 + 1], eb = SE[bi * 3 + 2];
        let sr, sg, sb;
        if (Math.max(er, eg3, eb) > .25) { const k = .55 + .6 * Math.exp(-Math.max(-d, 0) / 2.2); sr = er * k; sg = eg3 * k; sb = eb * k; }
        else { sr = SL[bi * 3] * (Er * 2.4 + .06); sg = SL[bi * 3 + 1] * (Eg * 2.4 + .06); sb = SL[bi * 3 + 2] * (Eb * 2.4 + .06); }
        r += (sr - r) * cov; g += (sg - g) * cov; b += (sb - b) * cov;
      }
      const dd = Math.hypot(u - .5, v - .5), sm = cl((dd - .3) / .65, 0, 1), vg = 1 - .6 * sm * sm * (3 - 2 * sm);
      const o = (y * DW + x) * 4;
      px[o] = Math.pow(1 - Math.exp(-r * exp), .78) * vg * 255; px[o + 1] = Math.pow(1 - Math.exp(-g * exp), .78) * vg * 255; px[o + 2] = Math.pow(1 - Math.exp(-b * exp), .78) * vg * 255; px[o + 3] = 255;
    }
    c2.putImageData(img, 0, 0);
  }
  let stage = 0, di = 0, last = cas[0];
  return {
    name: 'cpu', gl: false, slow: true,
    frame(w, h, sx, sy, ar) {
      resize(ar);
      // 4틱에 한 번 조명 갱신: [장면격자+c3] [c2] [c1] [c0+해상]
      if (stage === 0) { buildGrid(); cascade(3, cas[di], cas[1 - di]); last = cas[di]; di = 1 - di; }
      else if (stage === 1) { cascade(2, cas[di], cas[1 - di]); last = cas[di]; di = 1 - di; }
      else if (stage === 2) { cascade(1, cas[di], cas[1 - di]); last = cas[di]; di = 1 - di; }
      else { cascade(0, cas[di], cas[1 - di]); last = cas[di]; di = 1 - di; resolve(last); }
      stage = (stage + 1) & 3;
      display(sx, sy, EXPO);
    },
    sane() { return true; },
    destroy() { }
  };
}

export default function init(root, ctx) {
  const glc = root.querySelector('.s196__gl'), cpc = root.querySelector('.s196__cpu');
  const force = new URLSearchParams(location.search).get('rc'); // 검증용: rc=cpu | rc=half
  const order = force === 'cpu' ? ['cpu'] : force === 'half' ? ['half', 'cpu'] : ['float', 'half', 'cpu'];
  const speed = ctx.reduced ? .4 : 1;
  const BASE_DT = ctx.reduced ? 85 : 50;       // ≈20fps (reduced 12fps)

  // 포인터 (캔버스 UV, y 위쪽)
  const pm = { x: .5, y: .5, in: false, t: -1e9 };
  const ui = root.querySelector('.s196__ui');
  const mv = e => { const r = ui.getBoundingClientRect(); pm.x = (e.clientX - r.left) / r.width; pm.y = 1 - (e.clientY - r.top) / r.height; pm.in = true; pm.t = performance.now(); };
  const lv = () => { pm.in = false; };
  root.addEventListener('pointermove', mv); root.addEventListener('pointerleave', lv);

  let backend = null, idx = 0, vis = true, lost = false, frames = 0, minDt = BASE_DT, slow = 0, fast = 0;
  let scale = .55, last = performance.now() - 100, simT = 12, mode = '';
  const light = { x: 96, y: 56 };

  function start(from) {
    if (backend) { backend.destroy(); backend = null; }
    for (let i = from; i < order.length; i++) {
      try {
        const b = order[i] === 'cpu' ? makeCPU(cpc) : makeGL(glc, order[i]);
        backend = b; idx = i; frames = 0; mode = b.name;
        root.dataset.rc = b.name;
        root.classList.remove('is-fallback'); root.classList.toggle('is-cpu', !b.gl);
        if (!b.gl) minDt = Math.max(minDt, 66);
        return;
      } catch (e) { console.warn('[s196]', order[i], e && e.message || e); }
    }
    backend = null; root.dataset.rc = 'poster'; root.classList.add('is-fallback');
  }
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { rootMargin: '80px' }); io.observe(root);
  const onLost = e => { e.preventDefault(); lost = true; backend = null; root.dataset.rc = 'lost'; root.classList.add('is-fallback'); };
  const onRest = () => { lost = false; start(0); };
  glc.addEventListener('webglcontextlost', onLost); glc.addEventListener('webglcontextrestored', onRest);
  start(0);

  function target(dt, w, h) {
    const ac = w / h, as = WS / HS;
    const sx = ac > as ? 1 : ac / as, sy = ac > as ? as / ac : 1;
    const now = performance.now();
    let tx, ty, k;
    if (pm.in && now - pm.t < 2800) {
      tx = ((pm.x - .5) * sx + .5) * WS; ty = ((pm.y - .5) * sy + .5) * HS; k = 1 - Math.exp(-dt * 14);
    } else { // 입력이 없으면 리사주 자동 이동
      tx = 96 + 74 * Math.sin(simT * .37 + .6); ty = 58 + 36 * Math.sin(simT * .53 + 1.3); k = 1 - Math.exp(-dt * 5);
    }
    light.x += (tx - light.x) * k; light.y += (ty - light.y) * k;
    return [sx, sy];
  }

  const off = ctx.tick(() => {
    if (!backend || !vis || lost || document.hidden) return;
    const now = performance.now(), el = now - last;
    if (el < minDt - 2) return;
    last = now;
    const dt = Math.min(el, 120) / 1000;
    simT += dt * speed;
    const cv = backend.gl ? glc : cpc;
    if (backend.gl) {
      if (backend.g.isContextLost()) return;
      fit(glc, scale);
    }
    const w = backend.gl ? glc.width : cpc.width, h = backend.gl ? glc.height : cpc.height;
    const [sx, sy] = target(dt, cv.clientWidth || 16, cv.clientHeight || 9);
    updateScene(simT, light.x, light.y);
    try {
      backend.frame(w, h, sx, sy, (cv.clientWidth || 16) / (cv.clientHeight || 9));
      frames++;
      if (backend.gl && frames === 3 && !backend.sane(w, h)) { console.warn('[s196]', mode, 'blank output → next backend'); start(idx + 1); return; }
    } catch (e) { console.warn('[s196]', mode, e && e.message || e); start(idx + 1); return; }
    // 느린 머신(소프트웨어 렌더)에서는 프레임 간격·해상도를 단계적으로 낮추고, 여유가 생기면 되돌린다
    if (backend.gl) {
      if (el > minDt * 1.9) { slow++; fast = 0; } else if (el < minDt * 1.2) { fast++; slow = Math.max(0, slow - 1); }
      if (slow > 5 && minDt < 130) { minDt = Math.min(130, minDt * 1.35); scale = Math.max(.36, scale * .88); slow = 0; }
      else if (fast > 40 && (minDt > BASE_DT || scale < .55)) { minDt = Math.max(BASE_DT, minDt / 1.2); scale = Math.min(.55, scale * 1.1); fast = 0; }
    }
  });

  return () => {
    off(); io.disconnect(); root.removeEventListener('pointermove', mv); root.removeEventListener('pointerleave', lv);
    glc.removeEventListener('webglcontextlost', onLost); glc.removeEventListener('webglcontextrestored', onRest);
    if (backend) backend.destroy();
  };
}
