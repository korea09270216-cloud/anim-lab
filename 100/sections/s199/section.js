// 슈바르츠실트 블랙홀 중력 렌즈 — 픽셀마다 빛의 측지선을 직접 적분한다.
//  광선이 지나는 평면(카메라 위치 벡터 + 광선 방향)에서 u = 1/r 에 대해  d²u/dφ² + u = 3Mu²   (M = 1, r_s = 2)
//  초기값  u0 = 1/r0,  du/dφ = −u0·√(1−2u0)·cot ψ   (ψ = 관측자 기준 반경 바깥 방향과의 각)
//  64스텝 속도 베를레(고정 dφ) → u ≥ 1/2 면 지평선 포획, u → 0 이면 탈출 방향으로 별밭을 샘플.
//  적도면(y=0) 통과 구간마다 강착원반을 합성(위/아래로 휘어 보이는 2차 상) — 도플러 비밍 D³, 중력 적색편이, 케플러 전단.
export default function init(root, ctx) {
  const cv0 = root.querySelector('.s199__gl');
  const dbg = new URLSearchParams(location.search);
  let alive = true, visible = true, lost = false;
  let cv = cv0, gl = null;
  let scale = +(dbg.get('s199scale') || 0.36), steps = 64;
  let lastT = 0, avgDt = 120, frame = 0, scrollP = 0;
  let az = 0.4, el = 0.2, r0 = 38, lastMove = -99, pAz = 0, pEl = 0, ptrX = 0, ptrY = 0;
  const t0 = performance.now();

  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes, uCen, uJit; uniform float uTime, uMix, uFov; uniform vec3 uCam; uniform int uSteps;
uniform sampler2D uHist;
out vec4 oc;
const float RIN = 6.0, ROUT = 18.0, TP = 20.0, H = 0.085;

uint hsh(uint x){ x ^= x>>16; x *= 0x7feb352dU; x ^= x>>15; x *= 0x846ca68bU; x ^= x>>16; return x; }
float h2(ivec2 p){ return float(hsh(uint(p.x)*0x9E3779B1U ^ hsh(uint(p.y)+0x85ebca6bU))) * (1.0/4294967295.0); }
float h3(ivec3 p){ return float(hsh(uint(p.x)*0x9E3779B1U ^ hsh(uint(p.y)*0x85ebca6bU ^ hsh(uint(p.z)+0xc2b2ae35U)))) * (1.0/4294967295.0); }
float vn3(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f); ivec3 q = ivec3(i)+ivec3(65536);
  float a=h3(q), b=h3(q+ivec3(1,0,0)), c=h3(q+ivec3(0,1,0)), d=h3(q+ivec3(1,1,0));
  float e=h3(q+ivec3(0,0,1)), g=h3(q+ivec3(1,0,1)), h=h3(q+ivec3(0,1,1)), k=h3(q+ivec3(1,1,1));
  return mix(mix(mix(a,b,f.x),mix(c,d,f.x),f.y), mix(mix(e,g,f.x),mix(h,k,f.x),f.y), f.z);
}
float vnp(vec2 x, float per){                       // 방위각 방향으로 per 칸마다 이어지는 값 노이즈
  vec2 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  float x0 = mod(i.x, per), x1 = mod(i.x+1.0, per); int y0 = int(i.y)+4096;
  float a=h2(ivec2(int(x0),y0)), b=h2(ivec2(int(x1),y0)), c=h2(ivec2(int(x0),y0+1)), d=h2(ivec2(int(x1),y0+1));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float dtex(float rc, float ang, float age){          // 케플러 전단을 먹인 원반 난류 (방위로 긴 줄무늬)
  float om = 1.7*pow(rc, -1.5);
  float x = (ang - om*age)/6.2831853;
  float rr = log(rc);
  float n = 0.0, amp = 0.5, tot = 0.0;
  for(int k=0;k<3;k++){
    float m = float(1<<k);
    n += amp*vnp(vec2(x*14.0*m, rr*(11.0*m) + float(k)*3.7), 14.0*m);
    tot += amp; amp *= 0.55;
  }
  return n/tot;
}
vec3 bb(float t){
  t = clamp(t, 0.0, 2.5);
  vec3 c = mix(vec3(0.55,0.06,0.01), vec3(1.0,0.36,0.05), smoothstep(0.0,0.45,t));
  c = mix(c, vec3(1.0,0.76,0.42), smoothstep(0.35,0.85,t));
  return mix(c, vec3(0.82,0.9,1.0), smoothstep(0.9,1.7,t));
}
vec4 diskShade(float rc, float cph, float sph, vec3 e1, vec3 e2, float uc, float vc, float r0){
  float rr = (rc-RIN)/(ROUT-RIN);
  float env = smoothstep(0.0,0.05,rr)*(1.0-smoothstep(0.3,1.0,rr));
  if(env < 0.002) return vec4(0.0);
  vec3 pos = rc*(cph*e1 + sph*e2);
  float ang = atan(pos.z, pos.x);
  float ph = fract(uTime/TP), wA = 1.0-abs(2.0*ph-1.0);
  float turb = wA*dtex(rc, ang, ph*TP) + (1.0-wA)*dtex(rc, ang, fract(ph+0.5)*TP);
  vec3 vdir = normalize(vec3(-pos.z, 0.0, pos.x));
  vec3 tang = (-vc/(uc*uc))*(cph*e1+sph*e2) + rc*(-sph*e1+cph*e2);
  vec3 n = -normalize(tang);                         // 광자가 관측자 쪽으로 나는 방향
  float beta = sqrt(1.0/(rc-2.0));
  float D = sqrt(1.0-beta*beta)/(1.0-beta*dot(vdir, n));
  float g = D*sqrt(1.0-2.0/rc)/sqrt(1.0-2.0/r0);
  float T = pow(RIN/rc, 0.75)*g;
  float I = pow(RIN/rc, 2.2)*(0.22+1.5*turb)*pow(g, 3.0);
  return vec4(bb(T)*I*1.5, env*clamp(0.30+1.0*turb, 0.0, 1.0));
}
vec3 stars(vec3 dir){
  vec3 ng = normalize(vec3(0.35,0.80,0.45));
  float lat = dot(dir, ng);
  float band = exp(-lat*lat*9.0);
  float cl = vn3(dir*5.0)*0.6 + vn3(dir*11.0+7.0)*0.3 + vn3(dir*24.0)*0.1;
  float milky = band*smoothstep(0.30,0.85,cl);
  vec3 col = mix(vec3(0.06,0.05,0.12), vec3(0.50,0.34,0.30), milky)*milky*0.85 + vec3(0.012,0.016,0.04)*band;
  for(int L=0;L<2;L++){
    float S = (L==0) ? 26.0 : 62.0;
    vec3 p = dir*S; vec3 ip = floor(p); vec3 fp = p-ip; ivec3 q = ivec3(ip)+ivec3(65536);
    float h = h3(q);
    if(h > 0.80 - band*0.20){
      vec3 sp = vec3(h3(q+ivec3(11,0,0)), h3(q+ivec3(0,17,0)), h3(q+ivec3(0,0,23)))*0.6+0.2;
      vec3 dd = fp-sp; float d2 = dot(dd,dd);
      float mag = h3(q+ivec3(5,5,5));
      float br = pow(mag, 4.0)*(L==0 ? 1.7 : 0.9) + 0.10;
      col += br*exp(-d2/(L==0 ? 0.017 : 0.022))*mix(vec3(1.0,0.74,0.52), vec3(0.62,0.78,1.0), h3(q+ivec3(9,3,1)));
    }
  }
  return col;
}

void main(){
  vec2 pp = (gl_FragCoord.xy + uJit - uCen*uRes)/(0.5*uRes.y);
  vec3 O = uCam; float r0 = length(O); vec3 e1 = O/r0;
  vec3 fw = -e1; vec3 rt = normalize(cross(fw, vec3(0.0,1.0,0.0))); vec3 upv = cross(rt, fw);
  vec3 d = normalize(fw + (pp.x*rt + pp.y*upv)*uFov);
  float cp = dot(d, e1); vec3 dpv = d - cp*e1; float sp = max(length(dpv), 1e-4);
  vec3 e2 = dpv/sp;
  float u0 = 1.0/r0;
  float u = u0, v = -u0*sqrt(1.0-2.0*u0)*cp/sp;
  float phi = 0.0, c = 1.0, s = 0.0;
  float ch = cos(H), sh = sin(H);
  float sPrev = e1.y;
  vec3 acc = vec3(0.0); float trans = 1.0, glow = 0.0;
  bool cap = false, esc = false;
  for(int i=0;i<64;i++){
    if(i >= uSteps) break;
    float a0 = 3.0*u*u - u;
    float un = u + v*H + 0.5*a0*H*H;
    float a1 = 3.0*un*un - un;
    float vn = v + 0.5*(a0+a1)*H;
    float cn = c*ch - s*sh, sn = s*ch + c*sh;
    float sNew = e1.y*cn + e2.y*sn;
    if(sPrev*sNew < 0.0 && trans > 0.02){            // 적도면 통과 → 강착원반
      float t = sPrev/(sPrev-sNew);
      float uc = mix(u, un, t);
      float rc = 1.0/uc;
      if(rc > RIN && rc < ROUT){
        float pc = phi + t*H;
        vec4 dk = diskShade(rc, cos(pc), sin(pc), e1, e2, uc, mix(v, vn, t), r0);
        acc += trans*dk.rgb*dk.a; trans *= (1.0-dk.a);
      }
    }
    float dp = (un-0.3333)/0.032; glow += exp(-dp*dp)*H;     // 광자 고리: 임계 궤도 근처에 오래 머문 광선
    u = un; v = vn; c = cn; s = sn; sPrev = sNew; phi += H;
    if(u >= 0.5){ cap = true; break; }
    if(u < 0.004 && v < 0.0){ esc = true; break; }
  }
  vec3 bg = vec3(0.0);
  if(!cap && v < 0.0){
    float b = inversesqrt(max(v*v + u*u*(1.0-2.0*u), 1e-8));
    float pf = phi + asin(clamp(b*u, 0.0, 1.0));
    vec3 dirOut = cos(pf)*e1 + sin(pf)*e2;
    bg = stars(dirOut);
  }
  vec3 res = acc + trans*bg + (cap ? 0.0 : glow*0.07)*vec3(1.0,0.78,0.5);
  res *= 0.85;
  res = (res*(2.51*res+0.03))/(res*(2.43*res+0.59)+0.14);
  res = pow(clamp(res, 0.0, 1.0), vec3(1.0/2.2));
  vec3 hist = texture(uHist, gl_FragCoord.xy/uRes).rgb;
  oc = vec4(mix(res, hist, uMix), 1.0);
}`;

  const FS2 = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform sampler2D uTex;
out vec4 oc;
void main(){
  vec2 uv = gl_FragCoord.xy/uRes, px = 1.0/uRes;
  vec3 c = texture(uTex, uv).rgb;
  vec3 b = vec3(0.0);                                  // 가벼운 블룸: 밝은 부분만 주변으로 번짐
  for(int i=0;i<8;i++){
    float a = float(i)*0.7854;
    vec2 o = vec2(cos(a), sin(a));
    b += max(texture(uTex, uv + o*px*3.0).rgb - 0.55, 0.0) + max(texture(uTex, uv + o*px*7.0).rgb - 0.6, 0.0)*0.7;
  }
  c += b*0.16*vec3(1.0,0.82,0.62);
  float vg = 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y);
  c *= 0.72 + 0.28*pow(vg, 0.3);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)-0.5)*0.012;
  oc = vec4(c, 1.0);
}`;

  function sh(g, type, src) { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; }
  function mk(g, fs) { const p = g.createProgram(); g.attachShader(p, sh(g, g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g, g.FRAGMENT_SHADER, fs)); g.linkProgram(p); if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p)); return p; }
  let P1, P2, U1 = {}, U2 = {}, fbo = [null, null], htex = [null, null], bw = 0, bh = 0, cur = 0, ready = 0;

  function startGL() {
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return false;
    try {
      P1 = mk(gl, FS); P2 = mk(gl, FS2);
      ['uRes', 'uCen', 'uJit', 'uTime', 'uMix', 'uFov', 'uCam', 'uSteps', 'uHist'].forEach(n => U1[n] = gl.getUniformLocation(P1, n));
      ['uRes', 'uTex'].forEach(n => U2[n] = gl.getUniformLocation(P2, n));
      return true;
    } catch (e) { gl = null; return false; }
  }
  function buildTargets(w, h) {
    for (let i = 0; i < 2; i++) {
      if (htex[i]) { gl.deleteTexture(htex[i]); gl.deleteFramebuffer(fbo[i]); }
      htex[i] = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, htex[i]);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbo[i] = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, htex[i], 0);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); bw = w; bh = h; ready = 0;
  }
  function size() {
    const w = Math.max(64, Math.round(cv.clientWidth * scale)), h = Math.max(36, Math.round(cv.clientHeight * scale));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    if (gl && (bw !== w || bh !== h)) buildTargets(w, h);
  }
  const ok = startGL();
  if (!ok) cv.style.display = 'none'; else size();

  const onLost = e => { e.preventDefault(); lost = true; cv.style.display = 'none'; };
  cv.addEventListener('webglcontextlost', onLost);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { if (document.hidden) visible = false; };
  document.addEventListener('visibilitychange', onVis);
  const st = ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', scrub: .5, onUpdate: s => { scrollP = s.progress; } });
  const onMove = () => { if (ctx.fine) { lastMove = performance.now() / 1000; ptrX = ctx.mouse.nx - .5; ptrY = ctx.mouse.ny - .5; } };
  addEventListener('pointermove', onMove);

  let camPrev = [0, 0, 0];
  const off = ctx.tick(() => {
    if (!alive || !visible || !gl || lost) return;
    const now = performance.now();
    if (now - lastT < 1000 / 20) return;
    const dt = Math.min(now - lastT, 400); lastT = now;
    avgDt += (dt - avgDt) * .15;
    if (avgDt > 300 && scale > .22) { scale = Math.max(.22, scale - .04); avgDt = 160; }
    const tt = (now - t0) / 1000, sec = now / 1000;
    // 카메라: 커서가 있으면 커서가, 없으면 느린 자동 궤도
    const pointerActive = sec - lastMove < 5;
    const tAz = pointerActive ? ptrX * 2.6 + .35 + tt * .02 : tt * .06 + .4;
    const tEl = dbg.get('s199el') !== null ? +dbg.get('s199el') : pointerActive ? .07 + (.5 - ptrY) * .55 : .2 + .085 * Math.sin(tt * .27);
    az += (tAz - az) * .06; el += (Math.max(.04, Math.min(.75, tEl)) - el) * .06;
    const r = 40 - scrollP * 8 + Math.sin(tt * .17) * 1.2;
    r0 += (r - r0) * .08;
    const cx = r0 * Math.cos(el) * Math.cos(az), cy = r0 * Math.sin(el), cz = r0 * Math.cos(el) * Math.sin(az);
    const moved = Math.hypot(cx - camPrev[0], cy - camPrev[1], cz - camPrev[2]); camPrev = [cx, cy, cz];
    size();
    const wide = cv.width > cv.height * 1.2;
    const a = cur, b = 1 - cur, k = frame++;
    const jx = (k * .7548776662 % 1) - .5, jy = (k * .5698402910 % 1) - .5;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[a]); gl.viewport(0, 0, bw, bh);
    gl.useProgram(P1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, htex[b]); gl.uniform1i(U1.uHist, 0);
    gl.uniform2f(U1.uRes, bw, bh); gl.uniform2f(U1.uCen, wide ? .62 : .5, wide ? .52 : .66); gl.uniform2f(U1.uJit, jx, jy);
    gl.uniform1f(U1.uTime, tt); gl.uniform1f(U1.uFov, wide ? .40 : .5);
    gl.uniform1f(U1.uMix, ready < 2 ? 0 : (moved > .25 ? .18 : (ctx.reduced ? .8 : .6)));
    gl.uniform3f(U1.uCam, cx, cy, cz); gl.uniform1i(U1.uSteps, steps);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, bw, bh);
    gl.useProgram(P2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, htex[a]); gl.uniform1i(U2.uTex, 0); gl.uniform2f(U2.uRes, bw, bh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = b; ready++;
  });

  root.__s199 = { get scale() { return scale; }, get avgDt() { return avgDt; }, gl: !!gl, get el() { return el; } };
  return () => {
    alive = false; off(); io.disconnect(); st.kill();
    document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove);
    cv.removeEventListener('webglcontextlost', onLost);
    if (gl) { const e = gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); }
  };
}
