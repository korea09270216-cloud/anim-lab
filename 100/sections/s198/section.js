// 볼류메트릭 구름: 프래그먼트 셰이더 레이마칭.
//  밀도 장  = 3옥타브 fbm (노이즈 텍스처 1회 fetch/옥타브) × 높이 프로파일
//  투과율   = Beer-Lambert  T *= exp(-σ·dt),  구간 해석 적분  C += T·(1-exp(-σ·dt))·S
//  위상     = Henyey-Greenstein 이중 로브 (전방 은빛 테두리 + 약한 후방)
//  조명     = 태양 방향 4스텝 광 마칭(스텝 길이 지수 증가) → exp 감쇠 + 다중산란 보정
//  디더     = 인터리브드 그라디언트 노이즈 지터 + 이전 프레임 누적(렌더 스케일 0.3)
export default function init(root, ctx) {
  const cv0 = root.querySelector('.s198__gl');
  const elT = root.querySelector('.s198__clock-t'), elBar = root.querySelector('.s198__clock-bar u');
  const dbg = new URLSearchParams(location.search);
  let alive = true, visible = true, lost = false;
  let cv = cv0, gl = null;
  let scale = +(dbg.get('s198scale') || 0.3), steps = +(dbg.get('s198steps') || 40);
  let lastT = 0, avgDt = 120, frame = 0, scrollP = 0, mx = 0, my = 0, lastClock = '';
  const t0 = performance.now();

  const VS = `#version 300 es
void main(){ vec2 p = vec2(float((gl_VertexID<<1)&2), float(gl_VertexID&2)); gl_Position = vec4(p*2.0-1.0, 0.0, 1.0); }`;

  const FS = `#version 300 es
precision highp float;
uniform vec2 uRes; uniform float uTime, uFrame, uMix, uCamZ, uCover; uniform vec3 uSun; uniform vec2 uLook; uniform int uSteps;
uniform sampler2D uNoise, uHist;
out vec4 oc;
const float H0 = 0.2, H1 = 2.5;

float n3(vec3 x){                                  // 값 노이즈, 텍스처 1회: R=z층, G=z+1층(오프셋 37,17)
  vec3 p = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  vec2 uv = (p.xy + vec2(37.0,17.0)*p.z + f.xy + 0.5)/256.0;
  vec2 rg = textureLod(uNoise, uv, 0.0).yx;
  return mix(rg.x, rg.y, f.z);
}
vec3 rot(vec3 p){ p.xy = mat2(0.8,-0.6,0.6,0.8)*p.xy; p.yz = mat2(0.936,-0.352,0.352,0.936)*p.yz; return p; }
float dens(vec3 p, int oct){
  float h = clamp((p.y-H0)/(H1-H0), 0.0, 1.0);
  vec3 q = p*vec3(0.38,0.62,0.38) + vec3(uTime*0.05, 0.0, uTime*0.03);
  float a = 0.5, s = 0.0;
  for(int i=0;i<3;i++){ if(i>=oct) break; s += a*n3(q); q = rot(q)*2.03; a *= 0.55; }
  s /= (oct>=3 ? 0.9525 : (oct==2 ? 0.775 : 0.5));
  float prof = smoothstep(0.0,0.2,h)*(1.0-smoothstep(0.55,1.0,h));
  float cover = mix(0.64, 0.51, prof) + uCover;
  return clamp((s-cover)*6.5, 0.0, 1.0);
}
float hg(float c, float g){ float g2 = g*g; return (1.0-g2)/pow(1.0+g2-2.0*g*c, 1.5); }
vec3 sky(vec3 rd, float disc){
  float warm = 1.0 - smoothstep(0.0, 0.42, uSun.y);
  float sd = max(dot(rd, uSun), 0.0);
  vec3 zen = mix(vec3(0.03,0.12,0.45), vec3(0.025,0.02,0.16), warm);
  vec3 hor = mix(vec3(0.42,0.62,0.90), vec3(1.0,0.20,0.04), warm);
  float g = pow(1.0-clamp(rd.y,0.0,1.0), 2.6);
  vec3 c = mix(zen, hor, g);
  float band = exp(-pow((g-0.45)/0.22, 2.0));
  c = mix(c, vec3(0.62,0.08,0.20), band*warm*0.70);
  c += vec3(1.0,0.30,0.06)*pow(sd,5.0)*(0.10+0.34*warm) + vec3(1.0,0.55,0.18)*pow(sd,50.0)*0.9*disc;
  c += vec3(1.0,0.90,0.70)*smoothstep(0.99978,0.99988,sd)*9.0*disc;
  return c;
}
float ign(vec2 p, float k){ return fract(dot(p, vec2(0.7548776662, 0.5698402910)) + k*0.6180339887); }   // R2 저불일치 디더 + 황금비 시간 이동

void main(){
  vec2 uv = (gl_FragCoord.xy - 0.5*uRes)/(0.5*uRes.y);
  float yaw = uLook.x, pit = uLook.y;
  vec3 f = vec3(sin(yaw)*cos(pit), sin(pit), cos(yaw)*cos(pit));
  vec3 r = normalize(cross(vec3(0.0,1.0,0.0), f));
  vec3 u = cross(f, r);
  vec3 rd = normalize(f + (uv.x*r + uv.y*u)*0.46);
  vec3 ro = vec3(0.0, 3.1, uCamZ);

  vec3 bg = sky(rd, 1.0);
  vec3 col = vec3(0.0); float T = 1.0, fog = 0.0;
  if(rd.y < -0.004){
    float tA = (H1-ro.y)/rd.y;
    float tB = min((H0-ro.y)/rd.y, tA + 70.0);
    if(tA < 85.0){
      float dt = clamp((tB-tA)/float(uSteps), 0.05, 1.3);
      float t = tA + dt*ign(gl_FragCoord.xy, uFrame);
      float warm = 1.0 - smoothstep(0.0, 0.42, uSun.y);
      vec3 sunCol = mix(vec3(1.0,0.86,0.70), vec3(1.0,0.38,0.10), warm) * 2.6;
      float cth = dot(rd, uSun);
      float phase = (mix(hg(cth,-0.2), hg(cth,0.66), 0.42))*0.30;
      float tHit = -1.0;
      for(int i=0;i<64;i++){
        if(i>=uSteps) break;
        vec3 p = ro + rd*t;
        float d = dens(p, 3);
        if(d > 0.004){
          if(tHit < 0.0) tHit = t;
          // 광 마칭 4스텝
          float od = 0.0, ls = 0.28; vec3 lp = p;
          for(int j=0;j<4;j++){ lp += uSun*ls; od += dens(lp, 2)*ls; ls *= 1.9; }
          float h = clamp((p.y-H0)/(H1-H0), 0.0, 1.0);
          float lt = exp(-od*2.6) + 0.22*exp(-od*0.6);
          vec3 amb = mix(vec3(0.10,0.04,0.16), vec3(0.22,0.22,0.46), h)*0.50;
          vec3 S = sunCol*lt*(phase*0.9 + 0.06) + amb;
          S *= mix(0.55, 1.0, smoothstep(0.0, 0.5, h));
          float sg = d*5.2;
          float sT = exp(-sg*dt);
          col += T*(1.0-sT)*S;
          T *= sT;
          if(T < 0.03) break;
        }
        t += dt;
      }
      if(tHit < 0.0) tHit = t;
      fog = 1.0 - exp(-tHit*0.030);
    }
  }
  vec3 fogCol = sky(normalize(vec3(rd.x, 0.012, rd.z)), 0.0);
  vec3 res = (mix(col, fogCol*(1.0-T), fog) + T*bg)*0.62;
  // 톤매핑 (ACES 근사) + 감마
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
  vec2 uv = gl_FragCoord.xy/uRes;
  vec2 px = 0.75/uRes;                                   // 디더 고주파를 걷어내는 5탭 박스
  vec3 c = (texture(uTex, uv).rgb*2.0 + texture(uTex, uv+vec2(px.x,px.y)).rgb + texture(uTex, uv+vec2(-px.x,px.y)).rgb + texture(uTex, uv+vec2(px.x,-px.y)).rgb + texture(uTex, uv+vec2(-px.x,-px.y)).rgb)/6.0;
  float vg = 16.0*uv.x*uv.y*(1.0-uv.x)*(1.0-uv.y);
  c *= 0.82 + 0.18*pow(vg, 0.32);
  c += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)-0.5)*0.012;
  oc = vec4(c, 1.0);
}`;

  function sh(g, type, src) { const s = g.createShader(type); g.shaderSource(s, src); g.compileShader(s); if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s)); return s; }
  function mk(g, fs) { const p = g.createProgram(); g.attachShader(p, sh(g, g.VERTEX_SHADER, VS)); g.attachShader(p, sh(g, g.FRAGMENT_SHADER, fs)); g.linkProgram(p); if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p)); return p; }
  let P1, P2, U1 = {}, U2 = {}, noiseTex, fbo = [null, null], htex = [null, null], bw = 0, bh = 0, cur = 0, ready = 0;

  function noiseData() {                                     // 시드 고정 난수 256² (G = R 을 (37,17) 이동)
    let s = 1234567; const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const r = new Uint8Array(256 * 256); for (let i = 0; i < r.length; i++) r[i] = rnd() * 255 | 0;
    const d = new Uint8Array(256 * 256 * 4);
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4; d[i] = r[i >> 2]; d[i + 1] = r[((y + 17) & 255) * 256 + ((x + 37) & 255)]; d[i + 2] = 0; d[i + 3] = 255;
    }
    return d;
  }
  function startGL() {
    gl = cv.getContext('webgl2', { antialias: false, alpha: false, depth: false, powerPreference: 'low-power' });
    if (!gl) return false;
    try {
      P1 = mk(gl, FS); P2 = mk(gl, FS2);
      ['uRes', 'uTime', 'uFrame', 'uMix', 'uCamZ', 'uCover', 'uSun', 'uLook', 'uSteps', 'uNoise', 'uHist'].forEach(n => U1[n] = gl.getUniformLocation(P1, n));
      ['uRes', 'uTex'].forEach(n => U2[n] = gl.getUniformLocation(P2, n));
      noiseTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, noiseTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 256, 0, gl.RGBA, gl.UNSIGNED_BYTE, noiseData());
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
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
  if (!ok) { cv.style.display = 'none'; }                    // CSS 포스터(.s198__sky + 그라디언트)만 남는다
  else size();

  const onLost = e => { e.preventDefault(); lost = true; cv.style.display = 'none'; };
  cv.addEventListener('webglcontextlost', onLost);
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: 0 });
  io.observe(root);
  const onVis = () => { if (document.hidden) visible = false; };
  document.addEventListener('visibilitychange', onVis);
  const st = ScrollTrigger.create({ trigger: root, start: 'top bottom', end: 'bottom top', scrub: .5, onUpdate: s => { scrollP = s.progress; } });
  const onMove = () => { if (ctx.fine) { mx = ctx.mouse.nx - .5; my = ctx.mouse.ny - .5; } };
  addEventListener('pointermove', onMove);

  let yaw = 0, pit = -0.06, elS = .3;
  const off = ctx.tick(() => {
    if (!alive || !visible || !gl || lost) return;
    const now = performance.now();
    if (now - lastT < 1000 / 20) return;
    const dt = Math.min(now - lastT, 400); lastT = now;
    avgDt += (dt - avgDt) * .15;
    // 소프트웨어 렌더에서 프레임이 늘어지면 해상도/스텝을 낮춘다
    if (avgDt > 260 && scale > .2) { scale = Math.max(.2, scale - .04); avgDt = 150; }
    else if (avgDt > 260 && steps > 28) { steps -= 4; avgDt = 150; }
    const tt = (now - t0) / 1000;
    // 태양: 자동으로 천천히 기울고, 스크롤이 시각을 민다 (0.02 ≈ 수평선 / 0.36 ≈ 오후)
    const ph = (dbg.get('s198sun') !== null) ? +dbg.get('s198sun') : (0.5 + 0.5 * Math.sin(tt * .11 + 1.1)) * .75 + scrollP * .25;
    const el = .012 + .22 * (1 - ph) * (1 - ph * .35);
    const az = .30 - ph * .18;
    elS += (el - elS) * .25;
    const sx = Math.sin(az) * Math.cos(elS), sy = Math.sin(elS), sz = Math.cos(az) * Math.cos(elS);
    yaw += (mx * .22 - yaw) * .08; pit += ((-0.06 - my * .08) - pit) * .08;
    size();
    const cz = tt * .55;
    // 패스 1: 레이마칭 + 이전 프레임 누적
    const a = cur, b = 1 - cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[a]); gl.viewport(0, 0, bw, bh);
    gl.useProgram(P1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noiseTex); gl.uniform1i(U1.uNoise, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, htex[b]); gl.uniform1i(U1.uHist, 1);
    gl.uniform2f(U1.uRes, bw, bh); gl.uniform1f(U1.uTime, tt); gl.uniform1f(U1.uFrame, frame++ % 64);
    gl.uniform1f(U1.uMix, ready < 2 ? 0 : (ctx.reduced ? .8 : .6)); gl.uniform1f(U1.uCamZ, cz); gl.uniform1f(U1.uCover, 0);
    gl.uniform3f(U1.uSun, sx, sy, sz); gl.uniform2f(U1.uLook, yaw, pit); gl.uniform1i(U1.uSteps, steps);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    // 패스 2: 화면으로
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, bw, bh);
    gl.useProgram(P2);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, htex[a]); gl.uniform1i(U2.uTex, 0); gl.uniform2f(U2.uRes, bw, bh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    cur = b; ready++;
    // 시계: 태양 고도 → 시각
    const mins = 19 * 60 + 5 - (elS - .012) / .22 * 75, hh = Math.floor(mins / 60), mm = Math.floor(mins % 60);
    const s = hh + ':' + String(mm).padStart(2, '0');
    if (s !== lastClock) { lastClock = s; elT.textContent = s; }
    elBar.style.transform = 'translateX(' + ((1 - (elS - .012) / .22) * 182).toFixed(1) + 'px)';
  });

  root.__s198 = { get scale() { return scale; }, get steps() { return steps; }, get avgDt() { return avgDt; }, gl: !!gl };
  return () => {
    alive = false; off(); io.disconnect(); st.kill();
    document.removeEventListener('visibilitychange', onVis); removeEventListener('pointermove', onMove);
    cv.removeEventListener('webglcontextlost', onLost);
    if (gl) { const e = gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); }
  };
}
