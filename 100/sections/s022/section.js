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
const FS = `
varying vec2 v; uniform sampler2D tx; uniform float off,k,T; uniform vec2 R;
vec3 smp(vec2 uv,float sh){ return vec3(texture2D(tx,uv+vec2(0.,sh*1.0)).r, texture2D(tx,uv).g, texture2D(tx,uv-vec2(0.,sh*1.0)).b); }
void main(){
  float asp=R.x/R.y; vec2 c=v-.5;
  float zoom=1.+k*.22*cos(c.y*3.1416)*cos(c.y*3.1416);
  float x=c.x/zoom;
  float curl=k*.22*(c.x*c.x*4.-.5)+k*.025*sin(c.x*7.+T*1.3);
  float y=c.y+curl;
  float vis=(R.y/R.x)*.5;
  vec2 uv=vec2(x+.5, off+y*vis);
  float sh=k*.028+.004*sin(T*.8);
  vec3 col=smp(uv,sh);
  float vg=1.-.35*dot(c,c)*2.2; col*=vg;
  col+=abs(k)*.06;
  gl_FragColor=vec4(col,1.);
}`;
function poster() {
  const W = 1024, H = 2048, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  const F = "'Pretendard','Apple SD Gothic Neo','Malgun Gothic',system-ui,sans-serif";
  x.fillStyle = '#ff3a1d'; x.fillRect(0, 0, W, H);
  const rows = [
    ['빨간맛', 'fill', '#fff3e4', '#ff3a1d'], ['RED HOT', 'stroke', '#1a0d08', '#ffcf3d'], ['떡볶이', 'fill', '#1a0d08', '#ff3a1d'],
    ['매콤달콤', 'fill', '#ffcf3d', '#ff3a1d'], ['SPICY', 'stroke', '#fff3e4', '#1a0d08'], ['오늘도', 'fill', '#fff3e4', '#d9230c'],
    ['한 그릇', 'fill', '#ff3a1d', '#fff3e4'], ['튀김추가', 'stroke', '#1a0d08', '#fff3e4']
  ];
  const rh = H / rows.length;
  rows.forEach(([t, mode, fg, bg], i) => {
    const y0 = i * rh; x.fillStyle = bg; x.fillRect(0, y0, W, rh);
    let size = 320; x.font = `900 ${size}px ${F}`; const w = x.measureText(t).width; size = Math.min(330, size * (W * .9) / w);
    x.font = `900 ${size}px ${F}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    if (mode === 'fill') { x.fillStyle = fg; x.fillText(t, W / 2, y0 + rh * .52); }
    else { x.lineWidth = 6; x.strokeStyle = fg; x.strokeText(t, W / 2, y0 + rh * .52); }
    x.fillStyle = fg; x.font = `800 16px ${F}`; x.textAlign = 'left'; x.fillText(`NO.${String(i + 1).padStart(2, '0')} ✦ 붉은소반`, 24, y0 + 28); x.textAlign = 'right'; x.fillText('SINCE 1998', W - 24, y0 + 28);
    x.fillRect(0, y0, W, 3);
    x.beginPath(); x.arc(W - 48, y0 + rh - 40, 16, 0, 7); x.fill();
  });
  return c;
}
export default function init(root, ctx) {
  const canvas = root.querySelector('.s022__gl');
  const tex = poster();
  let sy = scrollY, vel = 0, kS = 0;
  const off = boot(root, ctx, canvas, ctx.reduced ? .3 : .5, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const t0 = g.createTexture(); g.bindTexture(g.TEXTURE_2D, t0);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, tex);
    g.generateMipmap(g.TEXTURE_2D);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT); g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.REPEAT);
    const u = U(g, p, 'R T off k tx'); g.uniform1i(u.tx, 0);
    return (t, w, h) => {
      const rect = root.getBoundingClientRect(); const span = Math.max(1, rect.height - innerHeight);
      const prog = Math.min(1, Math.max(0, -rect.top / span));
      const d = scrollY - sy; sy = scrollY;
      vel += (d - vel) * .18; // 스크롤 속도(px/frame) 감쇠 평균
      const target = Math.max(-1, Math.min(1, vel / 85)) + .26 * Math.sin(t * .9); // idle 숨쉬기 → 마우스·스크롤 없어도 휜다
      kS += (target - kS) * .14;
      const offs = prog * 2.2 + t * .012;
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform1f(u.off, offs); g.uniform1f(u.k, kS);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => off();
}
