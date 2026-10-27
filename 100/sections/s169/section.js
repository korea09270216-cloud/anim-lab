// s169 — 베지어 글리프 GPU 래스터화 (Slug 방식). 비트맵 글리프/폰트 파일 없음.
// 글리프 = 손으로 정의한 2차 베지어 곡선 리스트 → 데이터 텍스처 → 프래그먼트 셰이더가 픽셀마다
// 수평·수직 광선과 곡선의 교차(winding)로 커버리지를 계산. 카메라 중심은 글리프 로컬 좌표로 처리.
export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const glc = q('.s169__gl'), ovc = q('.s169__ov');
  const elZ = q('[data-z]'), elPin = q('[data-pin]'), elCurves = q('[data-curves]'), elDot = q('[data-dot]');
  const qs = new URLSearchParams(location.search);
  const FORCE_GL1 = qs.get('gl') === '1', FORCE_U8 = qs.get('fmt') === 'u8', FORCE_2D = qs.get('fb') === '1', DBG = qs.get('dbg') === '1';
  const ov = ovc.getContext('2d');

  /* ================= 1. 글리프 정의 (em=1000, y 위, 외곽 CCW · 구멍 CW) ================= */
  const nf = v => +v.toFixed(4);
  function circ(cx, cy, r, ccw) {
    const s = ccw ? 1 : -1, kc = r / Math.cos(Math.PI / 8);
    const P = k => [nf(cx + r * Math.cos(s * k * Math.PI / 4)), nf(cy + r * Math.sin(s * k * Math.PI / 4))];
    const C = k => [nf(cx + kc * Math.cos(s * (k + .5) * Math.PI / 4)), nf(cy + kc * Math.sin(s * (k + .5) * Math.PI / 4))];
    let d = 'M' + P(0).join(' ');
    for (let k = 0; k < 8; k++) d += 'Q' + C(k).join(' ') + ' ' + P(k + 1).join(' ');
    return d + 'Z';
  }
  // R x y r = 직선 + 그 끝점 모서리 반경 r. 나머지 직선-직선 모서리는 볼록 9 / 오목 4 로 자동 라운딩.
  const SRC = {
    B: ['M0 0L330 0Q612 0 612 190Q612 330 527 387Q515 395 527 403Q565 430 565 540Q565 700 340 700L0 700Z',
        'M150 585L290 585Q415 585 415 520Q415 455 290 455L150 455Z',
        'M150 340L320 340Q462 340 462 228Q462 115 320 115L150 115Z'],
    A: ['M0 0L165 0L217.5 150L482.5 150L535 0L700 0R455 700 26R245 700 26Z',
        'M259.5 270L350 528.5L440.5 270Z',
        circ(350, 210, 5, false)],
    R: ['M0 0L150 0L150 270L270 270L400 0L590 0L439 313Q434 324 446 324Q570 324 570 520Q570 700 340 700L0 700Z',
        'M150 585L300 585Q420 585 420 485Q420 385 300 385L150 385Z'],
    U: ['M0 700L0 300Q0 0 320 0Q640 0 640 300L640 700L490 700L490 300Q490 115 320 115Q150 115 150 300L150 700Z'],
    N: ['M0 0L150 0L150 430L470 0L620 0L620 700L470 700L470 270L150 700L0 700Z'],
    O: [circ(0, 0, 230, true), circ(0, 0, 128, false)]
  };
  const NAMES = ['B', 'A', 'R', 'U', 'N', 'O'];
  const GX = [0, 668, 1424, 2070, 2766];          // 단어 안 글리프 원점
  const WORDW = 3386, PERIOD_L = 3626;            // 단어 폭 / 행 반복 주기(로컬 단위)
  const RC = 9, RI = 4, qz = v => Math.round(v * 32) / 32;

  function parsePath(d) {
    const t = d.match(/[MLRQZ]|-?\d+(?:\.\d+)?/g); let i = 0; const out = []; let cur = null, pos = null, start = null;
    const num = () => +t[i++];
    while (i < t.length) {
      const c = t[i++];
      if (c === 'M') { cur = []; out.push(cur); pos = [num(), num()]; start = pos; }
      else if (c === 'L' || c === 'R') { const p = [num(), num()]; const r = c === 'R' ? num() : undefined; cur.push({ t: 'L', a: pos, b: p, r }); pos = p; }
      else if (c === 'Q') { const cc = [num(), num()], p = [num(), num()]; cur.push({ t: 'Q', a: pos, c: cc, b: p }); pos = p; }
      else if (c === 'Z') { if (Math.hypot(pos[0] - start[0], pos[1] - start[1]) > 1e-6) cur.push({ t: 'L', a: pos, b: start }); pos = start; }
    }
    return out;
  }
  // 직선-직선 모서리에 2차 곡선 라운딩을 끼워 곡선 리스트로 변환
  function contourQuads(segs) {
    const n = segs.length, len = segs.map(s => Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1]));
    const tA = new Array(n).fill(0), tB = new Array(n).fill(0), corner = new Array(n).fill(false);
    const dir = i => [(segs[i].b[0] - segs[i].a[0]) / len[i], (segs[i].b[1] - segs[i].a[1]) / len[i]];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (segs[i].t !== 'L' || segs[j].t !== 'L') continue;
      const u = dir(i), v = dir(j), cr = u[0] * v[1] - u[1] * v[0], dt = u[0] * v[0] + u[1] * v[1];
      if (Math.abs(cr) < 1e-3 && dt > 0) continue;
      let R = segs[i].r != null ? segs[i].r : (cr > 0 ? RC : RI);
      R = Math.min(R, .42 * len[i], .42 * len[j]);
      tB[i] = R; tA[j] = R; corner[i] = true;
    }
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = segs[i], j = (i + 1) % n;
      if (s.t === 'L') {
        const u = dir(i), a = [s.a[0] + u[0] * tA[i], s.a[1] + u[1] * tA[i]], b = [s.b[0] - u[0] * tB[i], s.b[1] - u[1] * tB[i]];
        out.push({ a, b, c: null });
        if (corner[i]) { const v = dir(j), R = tA[j]; out.push({ a: b, c: s.b, b: [s.b[0] + v[0] * R, s.b[1] + v[1] * R] }); }
      } else out.push({ a: s.a, c: s.c, b: s.b });
    }
    return out;
  }
  const glyphs = NAMES.map(name => {
    const quads = [], starts = [];
    for (const d of SRC[name]) for (const segs of parsePath(d)) {
      starts.push(quads.length / 6);
      for (const s of contourQuads(segs)) {
        const ax = qz(s.a[0]), ay = qz(s.a[1]), bx = qz(s.b[0]), by = qz(s.b[1]);
        if (s.c) quads.push(ax, ay, qz(s.c[0]), qz(s.c[1]), bx, by);
        else quads.push(ax, ay, (ax + bx) / 2, (ay + by) / 2, bx, by);
      }
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (let i = 0; i < quads.length; i += 2) { x0 = Math.min(x0, quads[i]); x1 = Math.max(x1, quads[i]); y0 = Math.min(y0, quads[i + 1]); y1 = Math.max(y1, quads[i + 1]); }
    return { name, quads: Float32Array.from(quads), n: quads.length / 6, starts, box: [x0, y0, x1, y1] };
  });
  const TOTAL_CURVES = glyphs.slice(0, 5).reduce((s, g) => s + g.n, 0);
  if (elCurves) elCurves.textContent = TOTAL_CURVES;

  /* ---- 밴드: 수평 광선은 y 밴드, 수직 광선은 x 밴드의 곡선 리스트만 훑는다 ---- */
  const NB = 256;
  glyphs.forEach(g => {
    g.bands = [[], []];
    for (let ax = 0; ax < 2; ax++) {
      const ci = ax === 0 ? 1 : 0;                     // 수평 광선(0) = y 밴드, 수직 광선(1) = x 밴드
      const lo = g.box[ci], hi = g.box[ci + 2], step = (hi - lo) / NB;
      for (let b = 0; b < NB; b++) {
        const bl = lo + b * step - .3, bh = lo + (b + 1) * step + .3, list = [];
        for (let c = 0; c < g.n; c++) {
          const o = c * 6; let mn = 1e9, mx = -1e9;
          for (let k = 0; k < 3; k++) { const v = g.quads[o + k * 2 + ci]; mn = Math.min(mn, v); mx = Math.max(mx, v); }
          if (mx >= bl && mn <= bh) list.push(c);
        }
        g.bands[ax].push(list);
      }
    }
  });
  const MAXL = Math.min(40, 2 + Math.max(...glyphs.map(g => Math.max(...g.bands[0].map(l => l.length), ...g.bands[1].map(l => l.length)))));

  /* ================= 2. GPU ================= */
  const TW = 512;
  function packTexture(f32) {
    const tpc = f32 ? 2 : 3, hdrN = glyphs.length * 2 * NB;
    let used = hdrN; const hdr = [], curves = [];
    glyphs.forEach(g => { for (let ax = 0; ax < 2; ax++) for (let b = 0; b < NB; b++) {
      const list = g.bands[ax][b]; hdr.push([used, list.length]);
      for (const c of list) { curves.push(g.quads.subarray(c * 6, c * 6 + 6)); used += tpc; }
    } });
    const th = Math.ceil(used / TW);
    if (f32) {
      const d = new Float32Array(TW * th * 4);
      hdr.forEach((h, i) => { d[i * 4] = h[0]; d[i * 4 + 1] = h[1]; });
      curves.forEach((c, i) => { const o = (hdrN + i * 2) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = c[3]; d[o + 4] = c[4]; d[o + 5] = c[5]; });
      return { data: d, th, tpc };
    }
    const d = new Uint8Array(TW * th * 4);
    const enc = (o, x, y) => { const X = Math.round((x + 256) * 64), Y = Math.round((y + 256) * 64); d[o] = X >> 8; d[o + 1] = X & 255; d[o + 2] = Y >> 8; d[o + 3] = Y & 255; };
    hdr.forEach((h, i) => { const o = i * 4; d[o] = h[0] >> 8; d[o + 1] = h[0] & 255; d[o + 2] = h[1] >> 8; d[o + 3] = h[1] & 255; });
    curves.forEach((c, i) => { const o = (hdrN + i * 3) * 4; enc(o, c[0], c[1]); enc(o + 4, c[2], c[3]); enc(o + 8, c[4], c[5]); });
    return { data: d, th, tpc };
  }

  function fragSrc(v2, f32, deriv) {
    const head = v2
      ? '#version 300 es\nprecision highp float;precision highp int;precision highp sampler2D;out vec4 oC;\n#define FETCH(x,y) texelFetch(uTex,ivec2(int(x),int(y)),0)\n#define OUT(c) oC=c\n'
      : (deriv ? '#extension GL_OES_standard_derivatives : enable\n' : '') + 'precision highp float;\n#define FETCH(x,y) texture2D(uTex,vec2(((x)+0.5)/uTS.x,((y)+0.5)/uTS.y))\n#define OUT(c) gl_FragColor=c\n';
    const dv = (v2 || deriv) ? '#define HASD 1\n' : '';
    const fmt = f32
      ? `#define TPC 2.0
void curve(float i,out vec2 a,out vec2 b,out vec2 c){vec4 t0=TX(i);vec4 t1=TX(i+1.0);a=t0.xy;b=t0.zw;c=t1.xy;}
vec2 hdr(float i){return TX(i).xy;}`
      : `#define TPC 3.0
float dec(float hi,float lo){return (floor(hi*255.0+0.5)*256.0+floor(lo*255.0+0.5))/64.0-256.0;}
vec2 pt(vec4 t){return vec2(dec(t.x,t.y),dec(t.z,t.w));}
void curve(float i,out vec2 a,out vec2 b,out vec2 c){a=pt(TX(i));b=pt(TX(i+1.0));c=pt(TX(i+2.0));}
vec2 hdr(float i){vec4 t=TX(i);return vec2(floor(t.x*255.0+0.5)*256.0+floor(t.y*255.0+0.5),floor(t.z*255.0+0.5)*256.0+floor(t.w*255.0+0.5));}`;
    return head + dv + `#define MAXL ${MAXL}
uniform sampler2D uTex;uniform vec2 uTS;uniform vec2 uCam;uniform float uK;uniform float uNB;
uniform vec4 uCol;uniform vec4 uRA;uniform vec4 uRB;uniform float uGX[5];uniform vec4 uGBox[5];uniform float uGHB[5];uniform float uGB[4];uniform vec3 uE1;uniform vec3 uE2;uniform vec3 uN;uniform float uD;uniform float uF;uniform vec2 uSC;uniform float uPPU;
vec4 TX(float i){float y=floor(i/uTS.x);float x=i-y*uTS.x;return FETCH(x,y);}
${fmt}
// 한 곡선 × 한 광선: v=광선에 수직인 좌표(픽셀 기준 상대), u=광선 방향 좌표.  av,bv/au,bu = 원시 2차 계수
void ray(float v0,float v1,float v2,float u0,float av,float bv,float au,float bu,float ppu,float sg,inout float cov,inout float wgt){
  float s=(v0<0.0?1.0:0.0)+(v1<0.0?2.0:0.0)+(v2<0.0?4.0:0.0);
  if(s==0.0||s==7.0)return;
  // 근 적격 판정은 제어점 부호만으로 (Slug 0x2E74 표). 근 값은 위치에만 쓴다.
  bool e1=(s==2.0||s==4.0||s==5.0||s==6.0);
  bool e2=(s==1.0||s==2.0||s==3.0||s==5.0);
  float t1,t2;
  if(abs(av)<0.015625){ t1=t2=v0/(2.0*bv); }
  else{
    float d=sqrt(max(bv*bv-av*v0,0.0));
    float qq=bv+(bv>=0.0?d:-d);
    if(abs(qq)<1e-6)qq=1e-6;
    float ta=qq/av;float tb=v0/qq;
    if(bv>=0.0){t2=ta;t1=tb;}else{t1=ta;t2=tb;}
  }
  if(e1){float u=(au*t1-2.0*bu)*t1+u0;cov+=sg*clamp(u*ppu+0.5,0.0,1.0);wgt=max(wgt,clamp(1.0-abs(u)*ppu*2.0,0.0,1.0));}
  if(e2){float u=(au*t2-2.0*bu)*t2+u0;cov-=sg*clamp(u*ppu+0.5,0.0,1.0);wgt=max(wgt,clamp(1.0-abs(u)*ppu*2.0,0.0,1.0));}
}
void main(){
  vec2 d=gl_FragCoord.xy-uSC;
  vec3 r=vec3(d,-uF);
  float lam=-uD*uN.z/dot(uN,r);
  vec2 W=vec2(lam*dot(uE1,r)+uD*uE1.z,lam*dot(uE2,r)+uD*uE2.z);
  vec2 v=W*uK;
#ifdef HASD
  vec2 fw=max(fwidth(v),vec2(1e-7));
#else
  vec2 fw=vec2(1.0/uPPU);
#endif
  if(lam<0.0)discard;
  vec2 cam=uCam;
  // 블록 반복(행·벽): 셀 인덱스를 구해 카메라를 셀 원점으로 평행이동
  if(uRA.x>0.0){float k=floor((cam.x+v.x-uRA.y)/uRA.x);if(k<0.0||k>=uRA.z)discard;cam.x-=k*uRA.x;}
  if(uRB.x>0.0){float k=floor((cam.y+v.y-uRB.y)/uRB.x);if(k<0.0||k>=uRB.z)discard;cam.y-=k*uRB.x;}
  // 단어 안에서 글리프 선택 (경계 = 글리프 사이 틈의 중앙)
  float gi=0.0;
  for(int i=0;i<4;i++){if(cam.x+v.x>uGB[i])gi+=1.0;}
  vec4 box=uGBox[0];float gx=uGX[0],hb=uGHB[0];
  for(int i=1;i<5;i++){if(float(i)==gi){box=uGBox[i];gx=uGX[i];hb=uGHB[i];}}
  cam.x-=gx;
  vec2 P=cam+v;
  vec2 m=fw*3.0;
  if(P.x<box.x-m.x||P.x>box.z+m.x||P.y<box.y-m.y||P.y>box.w+m.y)discard;
  float ppx=1.0/fw.x,ppy=1.0/fw.y;
  float cx=0.0,wx=0.0,cy=0.0,wy=0.0;
  float bh=clamp(floor((P.y-box.y)/(box.w-box.y)*uNB),0.0,uNB-1.0);
  vec2 h=hdr(hb+bh);
  for(int i=0;i<MAXL;i++){
    if(float(i)>=h.y)break;
    vec2 a,b,c;curve(h.x+float(i)*TPC,a,b,c);
    vec2 r0=(a-cam)-v,r1=(b-cam)-v,r2=(c-cam)-v;
    ray(r0.y,r1.y,r2.y,r0.x,a.y-2.0*b.y+c.y,a.y-b.y,a.x-2.0*b.x+c.x,a.x-b.x,ppx,1.0,cx,wx);
  }
  float bv=clamp(floor((P.x-box.x)/(box.z-box.x)*uNB),0.0,uNB-1.0);
  h=hdr(hb+uNB+bv);
  for(int i=0;i<MAXL;i++){
    if(float(i)>=h.y)break;
    vec2 a,b,c;curve(h.x+float(i)*TPC,a,b,c);
    vec2 r0=(a-cam)-v,r1=(b-cam)-v,r2=(c-cam)-v;
    ray(r0.x,r1.x,r2.x,r0.y,a.x-2.0*b.x+c.x,a.x-b.x,a.y-2.0*b.y+c.y,a.y-b.y,ppy,-1.0,cy,wy);
  }
  float cov=max(abs(cx*wx+cy*wy)/max(wx+wy,1.0/65536.0),min(abs(cx),abs(cy)));
  OUT(uCol*clamp(cov,0.0,1.0));
}`;
  }

  function createGPU() {
    const attrs = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false };
    let gl = null, v2 = false;
    try {
      if (!FORCE_GL1) { gl = glc.getContext('webgl2', attrs); v2 = !!gl; }
      if (!gl) gl = glc.getContext('webgl', attrs) || glc.getContext('experimental-webgl', attrs);
    } catch (e) { gl = null; }
    if (!gl) return null;
    const pf = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!pf || pf.precision < 23) return null;
    let deriv = v2 || !!gl.getExtension('OES_standard_derivatives');
    // 부동소수 텍스처 기능 검사 → 없으면 RGBA8 16비트 인코딩
    let f32 = false;
    if (!FORCE_U8) { f32 = v2 ? true : !!gl.getExtension('OES_texture_float'); }
    const tex = gl.createTexture();
    function upload(useF32) {
      const pk = packTexture(useF32);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      while (gl.getError() !== gl.NO_ERROR) { /* flush */ }
      if (useF32) gl.texImage2D(gl.TEXTURE_2D, 0, v2 ? gl.RGBA32F : gl.RGBA, TW, pk.th, 0, gl.RGBA, gl.FLOAT, pk.data);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TW, pk.th, 0, gl.RGBA, gl.UNSIGNED_BYTE, pk.data);
      return { ok: gl.getError() === gl.NO_ERROR, th: pk.th };
    }
    let up = upload(f32);
    if (!up.ok && f32) { f32 = false; up = upload(false); }
    if (!up.ok) return null;
    function sh(type, src) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { console.warn('s169 shader', gl.getShaderInfoLog(s)); return null; }
      return s;
    }
    const vs = sh(gl.VERTEX_SHADER, v2 ? '#version 300 es\nin vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}' : 'attribute vec2 aPos;void main(){gl_Position=vec4(aPos,0.0,1.0);}');
    const fs = sh(gl.FRAGMENT_SHADER, fragSrc(v2, f32, deriv));
    if (!vs || !fs) return null;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPos'); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn('s169 link', gl.getProgramInfoLog(prog)); return null; }
    gl.useProgram(prog);
    const U = {}; ['uTex', 'uTS', 'uCam', 'uK', 'uNB', 'uCol', 'uRA', 'uRB', 'uGX', 'uGBox', 'uGHB', 'uGB', 'uE1', 'uE2', 'uN', 'uD', 'uF', 'uSC', 'uPPU'].forEach(n => U[n] = gl.getUniformLocation(prog, n));
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(U.uTex, 0); gl.uniform2f(U.uTS, TW, up.th); gl.uniform1f(U.uNB, NB);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    return { gl, v2, f32, deriv, U, buf, prog };
  }

  /* ================= 3. 장면 (월드 단위) ================= */
  const INK = [.09, .075, .06], VER = [.949, .275, .118];
  // 단어 블록 하나 = 5글자 곡선을 한 번에 그린다(셰이더가 x 로 글리프 선택). 행·벽은 블록 반복(nx × ny)
  const WORDBOX = (() => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (let g = 0; g < 5; g++) { const b = glyphs[g].box; x0 = Math.min(x0, GX[g] + b[0]); x1 = Math.max(x1, GX[g] + b[2]); y0 = Math.min(y0, b[1]); y1 = Math.max(y1, b[3]); } return [x0, y0, x1, y1]; })();
  const TAB_WORD = { gx: Float32Array.from(GX), box: new Float32Array(20), hb: new Float32Array(5), gb: new Float32Array(4), box0: WORDBOX };
  for (let g = 0; g < 5; g++) { TAB_WORD.box.set(glyphs[g].box, g * 4); TAB_WORD.hb[g] = g * 2 * NB; }
  for (let i = 0; i < 4; i++) TAB_WORD.gb[i] = (GX[i] + glyphs[i].box[2] + GX[i + 1] + glyphs[i + 1].box[0]) / 2;
  const TAB_RING = { gx: new Float32Array(5), box: new Float32Array(20), hb: new Float32Array(5).fill(5 * 2 * NB), gb: new Float32Array(4).fill(1e9), box0: glyphs[5].box };
  for (let g = 0; g < 5; g++) TAB_RING.box.set(glyphs[5].box, g * 4);
  const blocks = [];
  const WALL_SC = 1 / 12, WPX = PERIOD_L, WPY = 1320, WX0 = -120, WY0 = -310, wpw = WPX * WALL_SC, wph = WPY * WALL_SC;
  const WOX = -7100, WOY = -5300, NX = Math.ceil(17800 / wpw), NY = Math.ceil(11000 / wph);
  const cellOf = (wx, wy) => [Math.floor((wx - (WOX + WX0 * WALL_SC)) / wpw), Math.floor((wy - (WOY + WY0 * WALL_SC)) / wph)];
  const [cx0, cy0] = cellOf(-260, -1000), [cx1, cy1] = cellOf(3650, 1000);
  for (const [a_, b_, c_, d_] of [[0, 0, cx0, NY], [cx1 + 1, 0, NX, NY], [cx0, 0, cx1 + 1, cy0], [cx0, cy1 + 1, cx1 + 1, NY]]) {
    if (c_ > a_ && d_ > b_) blocks.push({ tab: TAB_WORD, ox: WOX + a_ * wpw, oy: WOY + b_ * wph, sc: WALL_SC, col: [...INK, .15], nx: c_ - a_, ny: d_ - b_, px: WPX, py: WPY, x0: WX0, y0: WY0, wall: true });
  }
  blocks.push({ tab: TAB_RING, ox: 2400, oy: 330, sc: 2.1, col: [...VER, 1], nx: 1, ny: 1, px: 0, py: 0, ring: true });
  let prevBase = 0;
  for (let k = 1; k <= 6; k++) {
    const sc = Math.pow(2, -k), top = prevBase - 80 * Math.pow(2, 1 - k), base = top - 700 * sc; prevBase = base;
    blocks.push({ tab: TAB_WORD, ox: 0, oy: base, sc, col: [...(k % 2 ? INK : VER), k > 4 ? .8 : 1], nx: Math.pow(2, k), ny: 1, px: PERIOD_L, py: 0, x0: -120, y0: 0, row: k });
  }
  blocks.push({ tab: TAB_WORD, ox: 0, oy: 0, sc: 1, col: [...INK, 1], nx: 1, ny: 1, px: 0, py: 0, word: true });
  // 블록의 월드 사각형
  for (const b of blocks) {
    const bx = b.tab.box0, rx = b.nx > 1, ry = b.ny > 1;
    b.rect = [b.ox + b.sc * (rx ? b.x0 : bx[0]), b.oy + b.sc * (ry ? b.y0 : bx[1]), b.ox + b.sc * (rx ? b.x0 + b.nx * b.px : bx[2]), b.oy + b.sc * (ry ? b.y0 + b.ny * b.py : bx[3])];
    b.h = bx[3] - bx[1];
  }
  const C0 = [WORDW / 2 + 110, 300], T =[GX[1] + 350, 210];     // 광각 중심 / 핀홀(A 가로대 구멍, 반지름 5단위)
  const PIN_D = 10;
  const LZMAX = Math.log(420), LZMIN = Math.log(.42);

  /* ---- 타임라인 ---- */
  const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * x * (x * (x * 6 - 15) + 10); };
  const ss = (a, b, x) => sm((x - a) / (b - a));
  const t1 = 1.4, t2 = t1 + 9.4, t3 = t2 + 3.6, t4 = t3 + 10.5, t5 = t4 + 5.2, t6 = t5 + 4.2;
  function lnZ(t) {
    if (t < t1) return 0;
    if (t < t2) return LZMAX * sm((t - t1) / (t2 - t1));
    if (t < t3) return LZMAX;
    if (t < t4) return LZMAX + (LZMIN - LZMAX) * sm((t - t3) / (t4 - t3));
    if (t < t5) return LZMIN;
    return LZMIN * (1 - sm((t - t5) / (t6 - t5)));
  }
  function camAt(t, mouse) {
    const lz = lnZ(t), Z = Math.exp(lz);
    let cx, cy;
    if (lz >= 0) {
      const u = lz / LZMAX, beta = ss(.42, .93, u), k = Math.exp(-lz) * (1 - beta);
      cx = T[0] + (C0[0] - T[0]) * k; cy = T[1] + (C0[1] - T[1]) * k;
    } else { cx = C0[0]; cy = C0[1]; }
    if (t >= t2 && t < t3) {            // 최대 배율에서 핀홀 가장자리를 천천히 훑는다
      const tau = (t - t2) / (t3 - t2), env = Math.sin(Math.PI * tau), A = 330 / (S0 * Z), ph = tau * 5.2;
      cx += A * env * Math.sin(ph); cy += A * env * .55 * Math.cos(ph) * .8;
    }
    let ft = 0;
    if (t >= t4 - 3.8 && t < t5) ft = ss(t4 - 3.8, t4, t);
    else if (t >= t5) ft = 1 - ss(t5, t5 + 2.6, t);
    const zf = 1 - ss(.55, 2.2, Z);
    let yaw = (-.62 + .1 * Math.sin(t * .9)) * ft, pitch = (.46 + .05 * Math.sin(t * .7 + 1)) * ft;
    const idle = zf * (.035 + .02 * Math.sin(t * .8));
    yaw += idle * Math.sin(t * .6) + zf * (mouse.nx - .5) * .18;
    pitch += idle * Math.cos(t * .5) + zf * (mouse.ny - .5) * .12;
    return { lz, Z, cx, cy, yaw, pitch };
  }

  /* ================= 4. 렌더 ================= */
  let gpu = null, useFallback = false, rs = .42, cssW = 1, cssH = 1, W = 2, H = 2, dpr = 1, S0 = .3;
  let clock = 0, visible = false, dead = false, lastDraw = 0, clockPrev = performance.now(), ema = 50, slow = 0, fast = 0, lastDown = 0;
  let curCam = null, view = null;

  function resize() {
    const r = root.getBoundingClientRect();
    cssW = Math.max(2, r.width); cssH = Math.max(2, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    ovc.width = Math.round(cssW * dpr); ovc.height = Math.round(cssH * dpr);
    S0 = Math.min(.66 * cssW / WORDW, .6 * cssH / 1750);
    sizeGL();
  }
  function sizeGL() {
    W = Math.max(2, Math.round(cssW * rs)); H = Math.max(2, Math.round(cssH * rs));
    if (glc.width !== W || glc.height !== H) { glc.width = W; glc.height = H; }
    if (gpu) gpu.gl.viewport(0, 0, W, H);
  }

  function makeView(cam) {
    let { yaw, pitch } = cam;
    const ppu = S0 * cam.Z * rs, F = 1.15 * W, D = F / ppu;
    let e1, e2, n, tries = 0;
    for (;;) {
      const cy_ = Math.cos(yaw), sy_ = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
      e1 = [cy_, sy_ * sp, -sy_ * cp]; e2 = [0, cp, sp]; n = [sy_, -cy_ * sp, cy_ * cp];
      let ok = true;
      for (const [du, dv] of [[-2200, -1000], [2200, -1000], [-2200, 1000], [2200, 1000]]) {
        if (D - du * e1[2] - dv * e2[2] < .3 * D) ok = false;
      }
      if (ok || tries++ > 8) break;
      yaw *= .8; pitch *= .8;
    }
    return { cam, ppu, F, D, e1, e2, n, yaw, pitch };
  }
  // 월드(카메라 상대 du,dv) → 렌더 픽셀 오프셋(중심 기준, y 위). 카메라 뒤면 null
  function proj(vw, du, dv) {
    const e1 = vw.e1, e2 = vw.e2, D = vw.D;
    const X = du * e1[0] + dv * e2[0], Y = du * e1[1] + dv * e2[1], Zc = -D + du * e1[2] + dv * e2[2];
    if (-Zc < .05 * D) return null;
    return [vw.F * X / -Zc, vw.F * Y / -Zc];
  }
  function clipPoly(poly, hw, hh) {
    const edges = [[0, 1, -hw], [0, -1, -hw], [1, 1, -hh], [1, -1, -hh]]; // axis, sign, offset: sign*p[axis] + off <= 0 inside
    for (const [ax, sg, off] of edges) {
      const out = [];
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], da = sg * a[ax] + off, db = sg * b[ax] + off;
        if (da <= 0) out.push(a);
        if ((da < 0) !== (db < 0) && da !== db) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
      }
      poly = out; if (!poly.length) break;
    }
    return poly;
  }

  let rowsOn = true, lastTab = null;
  const vtx = new Float32Array(48);
  // 평면 다각형(카메라 상대 du,dv) → 카메라 공간 근평면 클리핑 → 렌더 픽셀 오프셋
  function projPoly(vw, pts) {
    const e1 = vw.e1, e2 = vw.e2, D = vw.D, zmax = -.05 * D;
    const P3 = pts.map(([du, dv]) => [du * e1[0] + dv * e2[0], du * e1[1] + dv * e2[1], -D + du * e1[2] + dv * e2[2]]);
    const out = [];
    for (let i = 0; i < P3.length; i++) {
      const a = P3[i], b = P3[(i + 1) % P3.length], ia = a[2] <= zmax, ib = b[2] <= zmax;
      if (ia) out.push(a);
      if (ia !== ib) { const t = (zmax - a[2]) / (b[2] - a[2]); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, zmax]); }
    }
    return out.map(p => [vw.F * p[0] / -p[2], vw.F * p[1] / -p[2]]);
  }
  function drawGL(vw) {
    const { gl, U } = gpu, cam = vw.cam;
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform3f(U.uE1, vw.e1[0], vw.e1[1], vw.e1[2]); gl.uniform3f(U.uE2, vw.e2[0], vw.e2[1], vw.e2[2]); gl.uniform3f(U.uN, vw.n[0], vw.n[1], vw.n[2]);
    gl.uniform1f(U.uD, vw.D); gl.uniform1f(U.uF, vw.F); gl.uniform2f(U.uSC, W / 2, H / 2);
    const hw = W / 2 + 2, hh = H / 2 + 2, mW = 2.6 / vw.ppu * 1.5;
    lastTab = null;
    let drawn = 0;
    for (const b of blocks) {
      if (b.row && !rowsOn) continue;
      const sc = b.sc, ppuI = vw.ppu * sc;
      if (ppuI * b.h < .35) continue;
      const r = b.rect, x0 = r[0] - mW, y0 = r[1] - mW, x1 = r[2] + mW, y1 = r[3] + mW;
      const poly = projPoly(vw, [[x0 - cam.cx, y0 - cam.cy], [x1 - cam.cx, y0 - cam.cy], [x1 - cam.cx, y1 - cam.cy], [x0 - cam.cx, y1 - cam.cy]]);
      if (poly.length < 3) continue;
      const cl = clipPoly(poly, hw, hh);
      if (cl.length < 3) continue;
      for (let i = 0; i < cl.length; i++) { vtx[i * 2] = cl[i][0] / (W / 2); vtx[i * 2 + 1] = cl[i][1] / (H / 2); }
      gl.bufferData(gl.ARRAY_BUFFER, vtx.subarray(0, cl.length * 2), gl.DYNAMIC_DRAW);
      if (lastTab !== b.tab) { gl.uniform1fv(U.uGX, b.tab.gx); gl.uniform4fv(U.uGBox, b.tab.box); gl.uniform1fv(U.uGHB, b.tab.hb); gl.uniform1fv(U.uGB, b.tab.gb); lastTab = b.tab; }
      gl.uniform2f(U.uCam, (cam.cx - b.ox) / sc, (cam.cy - b.oy) / sc);
      gl.uniform1f(U.uK, 1 / sc);
      const c = b.col; gl.uniform4f(U.uCol, c[0] * c[3], c[1] * c[3], c[2] * c[3], c[3]);
      if (b.nx > 1) gl.uniform4f(U.uRA, b.px, b.x0, b.nx, 0); else gl.uniform4f(U.uRA, 0, 0, 0, 0);
      if (b.ny > 1) gl.uniform4f(U.uRB, b.py, b.y0, b.ny, 0); else gl.uniform4f(U.uRB, 0, 0, 0, 0);
      gl.uniform1f(U.uPPU, ppuI);
      gl.drawArrays(gl.TRIANGLE_FAN, 0, cl.length);
      drawn++;
    }
    return drawn;
  }

  /* ---- 2D 폴백: 같은 곡선 리스트를 Path2D 로 (원근 없음) ---- */
  const paths = glyphs.map(g => {
    const p = new Path2D(); let prev = null;
    for (let c = 0; c < g.n; c++) {
      const o = c * 6, q_ = g.quads;
      if (g.starts.includes(c) || !prev || Math.abs(prev[0] - q_[o]) > 1e-6 || Math.abs(prev[1] - q_[o + 1]) > 1e-6) { if (prev) p.closePath(); p.moveTo(q_[o], q_[o + 1]); }
      p.quadraticCurveTo(q_[o + 2], q_[o + 3], q_[o + 4], q_[o + 5]); prev = [q_[o + 4], q_[o + 5]];
    }
    p.closePath(); return p;
  });
  function draw2D(cam) {
    const ppu = S0 * cam.Z;
    ov.setTransform(dpr, 0, 0, dpr, 0, 0); ov.clearRect(0, 0, cssW, cssH);
    let budget = 700;
    for (const b of blocks) {
      const sc = b.sc, k = ppu * sc;
      if (k * b.h < .4) continue;
      const c = b.col; ov.fillStyle = `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${c[3]})`;
      const single = b.ring ? 5 : -1;
      for (let j = 0; j < b.ny; j++) for (let i = 0; i < b.nx; i++) {
        const wx = b.ox + sc * i * b.px, wy = b.oy + sc * j * b.py;
        const sx = cssW / 2 + (wx - cam.cx) * ppu, sy = cssH / 2 - (wy - cam.cy) * ppu;
        const bx = b.tab.box0;
        if (sx + bx[0] * k > cssW || sx + bx[2] * k < 0 || sy - bx[3] * k > cssH || sy - bx[1] * k < 0) continue;
        if (--budget < 0) return;
        if (single >= 0) { ov.setTransform(dpr * k, 0, 0, -dpr * k, dpr * sx, dpr * sy); ov.fill(paths[5]); continue; }
        for (let g = 0; g < 5; g++) { ov.setTransform(dpr * k, 0, 0, -dpr * k, dpr * (sx + GX[g] * k), dpr * sy); ov.fill(paths[g]); }
      }
    }
    ov.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- 오버레이: 가이드라인 · 제어점 · 핀홀 치수 ---- */
  const BLUE = '#2a3cff';
  function toCss(vw, wx, wy) {
    const p = proj(vw, wx - vw.cam.cx, wy - vw.cam.cy);
    return p ? [cssW / 2 + p[0] / rs, cssH / 2 - p[1] / rs] : null;
  }
  function drawOverlay(vw) {
    const Z = vw.cam.Z;
    ov.setTransform(dpr, 0, 0, dpr, 0, 0); ov.clearRect(0, 0, cssW, cssH);
    // 베이스라인 / 캡하이트
    const ga = .85 * (1 - ss(40, 160, Z));
    if (ga > .02) {
      ov.save(); ov.lineWidth = 1; ov.strokeStyle = BLUE; ov.globalAlpha = ga; ov.setLineDash([6, 5]);
      ov.font = '700 10px ui-monospace,Menlo,Consolas,monospace'; ov.fillStyle = BLUE; ov.textBaseline = 'bottom';
      for (const [y, lab] of [[0, 'BASELINE 0'], [700, 'CAP HEIGHT 700']]) {
        const a = toCss(vw, -260, y), b = toCss(vw, WORDW + 260, y);
        if (!a || !b) continue;
        ov.beginPath(); ov.moveTo(a[0], a[1]); ov.lineTo(b[0], b[1]); ov.stroke();
        ov.fillText(lab, Math.max(6, Math.min(cssW - 110, a[0] + 6)), Math.max(14, Math.min(cssH - 4, a[1] - 3)));
      }
      ov.restore();
    }
    // 제어점
    const pa = ss(10, 45, Z);
    if (pa > .02) {
      ov.save(); ov.globalAlpha = pa; ov.lineWidth = 1; ov.strokeStyle = BLUE; ov.fillStyle = '#fff';
      const m = 30;
      for (let gi = 0; gi < 5; gi++) {
        const g = glyphs[gi], ox = GX[gi];
        const b0 = toCss(vw, ox + g.box[0], g.box[1]), b1 = toCss(vw, ox + g.box[2], g.box[3]);
        if (b0 && b1 && (Math.max(b0[0], b1[0]) < -m || Math.min(b0[0], b1[0]) > cssW + m || Math.max(b0[1], b1[1]) < -m || Math.min(b0[1], b1[1]) > cssH + m)) continue;
        for (let c = 0; c < g.n; c++) {
          const o = c * 6, qd = g.quads;
          const p0 = toCss(vw, ox + qd[o], qd[o + 1]), p2 = toCss(vw, ox + qd[o + 4], qd[o + 5]);
          if (!p0 || !p2) continue;
          const isLine = Math.abs(qd[o + 2] - (qd[o] + qd[o + 4]) / 2) < 1e-4 && Math.abs(qd[o + 3] - (qd[o + 1] + qd[o + 5]) / 2) < 1e-4;
          const on = p => p[0] > -m && p[0] < cssW + m && p[1] > -m && p[1] < cssH + m;
          if (!isLine) {
            const p1 = toCss(vw, ox + qd[o + 2], qd[o + 3]);
            if (p1 && (on(p0) || on(p1) || on(p2))) {
              ov.beginPath(); ov.moveTo(p0[0], p0[1]); ov.lineTo(p1[0], p1[1]); ov.lineTo(p2[0], p2[1]); ov.stroke();
              ov.beginPath(); ov.arc(p1[0], p1[1], 3.4, 0, 6.2832); ov.fill(); ov.stroke();
            }
          }
          if (on(p0)) { ov.fillRect(p0[0] - 3.5, p0[1] - 3.5, 7, 7); ov.strokeRect(p0[0] - 3.5, p0[1] - 3.5, 7, 7); }
        }
      }
      ov.restore();
    }
    // 핀홀 치수선
    const da = ss(60, 140, Z);
    if (da > .02) {
      const a = toCss(vw, T[0] - PIN_D / 2, T[1]), b = toCss(vw, T[0] + PIN_D / 2, T[1]);
      if (a && b) {
        ov.save(); ov.globalAlpha = da; ov.strokeStyle = '#f2461e'; ov.lineWidth = 2;
        const y = a[1] + 0;
        ov.beginPath(); ov.moveTo(a[0], y); ov.lineTo(b[0], y); ov.moveTo(a[0], y - 10); ov.lineTo(a[0], y + 10); ov.moveTo(b[0], y - 10); ov.lineTo(b[0], y + 10); ov.stroke();
        ov.font = '800 13px ui-monospace,Menlo,Consolas,monospace'; ov.textAlign = 'center'; ov.textBaseline = 'middle';
        const mx = Math.max(110, Math.min(cssW - 110, (a[0] + b[0]) / 2)), my = Math.max(300, Math.min(cssH - 80, y - 22)), lab = 'Ø 10 단위 = 0.01 em', tw = ov.measureText(lab).width + 20;
        ov.fillStyle = '#f2461e'; ov.fillRect(mx - tw / 2, my - 12, tw, 24);
        ov.fillStyle = '#efe6d3'; ov.fillText(lab, mx, my + 1);
        ov.restore();
      }
    }
  }

  function updateHud(cam) {
    const Z = cam.Z, zt = Z >= 100 ? Z.toFixed(0) : Z >= 10 ? Z.toFixed(1) : Z.toFixed(2);
    if (elZ.textContent !== zt) elZ.textContent = zt;
    const pd = PIN_D * S0 * Z, pt = pd >= 100 ? Math.round(pd).toLocaleString('en-US') : pd.toFixed(1);
    if (elPin.textContent !== pt) elPin.textContent = pt;
    const lo = Math.log10(.42), hi = Math.log10(420), p = (Math.log10(Z) - lo) / (hi - lo);
    // 눈금 위치(.18/.40/.62/.84)와 같은 축: x=.18+... 선형 보간 대신 로그축에 맞춰 0..1
    elDot.style.bottom = (Math.min(1, Math.max(0, p)) * 100).toFixed(2) + '%';
  }

  function render() {
    const cam = camAt(clock, ctx.mouse);
    if (ctx.reduced) { cam.yaw *= .3; cam.pitch *= .3; }
    curCam = cam;
    if (gpu && !useFallback) {
      view = makeView(cam);
      drawGL(view);
      drawOverlay(view);
    } else {
      draw2D(cam);
    }
    updateHud(cam);
  }

  /* ================= 5. 루프 / 수명 ================= */
  function boot() {
    gpu = FORCE_2D ? null : createGPU();
    useFallback = !gpu;
    glc.style.display = useFallback ? 'none' : '';
    resize();
    if (DBG) window.__s169 = {
      setRows: v => { rowsOn = v; }, gpu: () => gpu && { v2: gpu.v2, f32: gpu.f32, deriv: gpu.deriv }, seek: t => { clock = t; render(); }, rs: () => rs, setRs: v => { rs = v; sizeGL(); }, MAXL, TOTAL_CURVES, ema: () => ema,
      bench: (t, n) => { clock = t; const px = new Uint8Array(4), t0 = performance.now(); for (let i = 0; i < n; i++) { render(); gpu && gpu.gl.readPixels(0, 0, 1, 1, gpu.gl.RGBA, gpu.gl.UNSIGNED_BYTE, px); } return (performance.now() - t0) / n; }
    };
  }
  boot();
  const onLost = e => { e.preventDefault(); useFallback = true; glc.style.display = 'none'; gpu = null; };
  const onRestored = () => { gpu = FORCE_2D ? null : createGPU(); useFallback = !gpu; glc.style.display = useFallback ? 'none' : ''; sizeGL(); };
  glc.addEventListener('webglcontextlost', onLost);
  glc.addEventListener('webglcontextrestored', onRestored);

  const ro = new ResizeObserver(() => resize()); ro.observe(root);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; clockPrev = performance.now(); }, { threshold: 0 });
  io.observe(root);
  render();

  const off = ctx.tick(() => {
    if (dead) return;
    const now = performance.now();
    if (!visible || document.hidden) { clockPrev = now; return; }
    const dt = now - lastDraw;
    if (dt < 48) return;
    lastDraw = now;
    clock += Math.min(.25, (now - clockPrev) / 1000) * (ctx.reduced ? .5 : 1); clockPrev = now;
    if (ctx.reduced && clock > t1 + 5) clock = 0;
    render();
    // 소프트웨어 렌더 보호: 프레임 간격이 늘어지면 해상도 스케일을 낮춘다
    ema += (Math.min(dt, 400) - ema) * .25;
    if (gpu && !useFallback) {
      if (ema > 105) { slow++; fast = 0; } else if (ema < 60) { fast++; slow = 0; } else { slow = 0; fast = 0; }
      if (slow >= 4 && rs > .26) { rs = Math.max(.26, rs * .85); sizeGL(); slow = 0; ema = 70; lastDown = now; }
      else if (fast >= 90 && rs < .8 && now - lastDown > 20000) { rs = Math.min(.8, rs * 1.12); sizeGL(); fast = 0; }
    }
  });

  return () => {
    dead = true; off(); io.disconnect(); ro.disconnect();
    glc.removeEventListener('webglcontextlost', onLost); glc.removeEventListener('webglcontextrestored', onRestored);
    try { if (gpu) { const e = gpu.gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); } } catch (e) { /* noop */ }
    if (DBG) delete window.__s169;
  };
}
