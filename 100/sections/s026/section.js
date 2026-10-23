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
varying vec2 v; uniform vec2 R; uniform float T; uniform vec2 M;
mat2 rot(float a){float c=cos(a),s=sin(a);return mat2(c,-s,s,c);}
float smin(float a,float b,float k){float h=clamp(.5+.5*(b-a)/k,0.,1.);return mix(b,a,h)-k*h*(1.-h);}
float sdBox(vec3 p,vec3 b,float r){vec3 q=abs(p)-b;return length(max(q,0.))+min(max(q.x,max(q.y,q.z)),0.)-r;}
float obj(vec3 p){
  float k=mod(T/3.4,3.); float i=floor(k); float f=smoothstep(.5,.95,fract(k));
  float tw=.55*sin(T*.45)+(M.x-.5)*1.4;
  p.xz*=rot(p.y*tw+T*.2);
  float s=length(p)-.95; float b=sdBox(p,vec3(.62),.14); float t=length(vec2(length(p.xz)-.8,p.y))-.32;
  float w0=i<.5?1.-f:(i>1.5?f:0.); float w1=i<.5?f:(i<1.5?1.-f:0.); float w2=i>.5&&i<1.5?f:(i>1.5?1.-f:0.);
  float d=w0*s+w1*b+w2*t;
  d+=.025*sin(p.x*7.+T)*sin(p.y*6.-T*.8)*sin(p.z*7.);
  return d;
}
float map(vec3 p){
  float d=obj(p);
  vec3 s1=vec3(1.45*cos(T*.7),.55*sin(T*.9),1.45*sin(T*.7)); vec3 s2=vec3(-1.2*cos(T*.55+2.),.7*sin(T*.6+1.),1.2*sin(T*.55+2.));
  float sat=min(length(p-s1)-.27,length(p-s2)-.2);
  d=smin(d,sat,.45);
  return min(d,p.y+1.2);
}
vec3 nor(vec3 p){vec2 e=vec2(.0025,-.0025);return normalize(e.xyy*map(p+e.xyy)+e.yyx*map(p+e.yyx)+e.yxy*map(p+e.yxy)+e.xxx*map(p+e.xxx));}
float shadow(vec3 ro,vec3 rd){float res=1.,t=.06;for(int i=0;i<20;i++){float h=map(ro+rd*t);res=min(res,8.*h/t);t+=clamp(h,.04,.5);if(res<.01||t>6.)break;}return clamp(res,0.,1.);}
void main(){
  vec2 uv=(v-.5)*vec2(R.x/R.y,1.); uv.x-=.28;
  float a=T*.13+(M.x-.5)*3.2, e=.3+(M.y-.5)*.7;
  vec3 ro=6.6*vec3(cos(a)*cos(e),sin(e),sin(a)*cos(e));
  vec3 ww=normalize(-ro), uu=normalize(cross(ww,vec3(0.,1.,0.))), vv=cross(uu,ww);
  vec3 rd=normalize(uu*uv.x+vv*uv.y+ww*1.9);
  vec3 bg=mix(vec3(.93,.9,.84),vec3(.86,.82,.75),v.y*.9);
  vec3 col=bg; float t=0.; bool hit=false;
  for(int i=0;i<56;i++){ float h=map(ro+rd*t); if(h<.003){hit=true;break;} t+=h*.95; if(t>12.)break; }
  if(hit){
    vec3 p=ro+rd*t; vec3 n=nor(p);
    vec3 L=normalize(vec3(-.5,.9,.45));
    float dif=clamp(dot(n,L),0.,1.); float sh=.25+.75*shadow(p+n*.02,L);
    float amb=.5+.5*n.y; float ao=clamp(map(p+n*.35)/.35,0.,1.)*.6+.4;
    vec3 base;
    if(p.y<-1.19){ base=vec3(.9,.86,.78); } else { base=mix(vec3(.82,.42,.27),vec3(.95,.66,.45),.5+.5*n.y); }
    vec3 lit=base*(dif*sh*vec3(1.,.92,.82)*1.05+amb*ao*vec3(.6,.58,.6)*.95);
    lit+=pow(clamp(dot(reflect(rd,n),L),0.,1.),24.)*.18*sh*step(-1.19,p.y);
    float fog=1.-exp(-.0016*t*t*t); col=mix(lit,bg,clamp(fog,0.,1.));
  }
  col=pow(col,vec3(.95));
  gl_FragColor=vec4(col,1.);
}`;
export default function init(root, ctx) {
  const canvas = root.querySelector('.s026__gl');
  const mp = pointer(root, canvas); const m = { x: .5, y: .5 };
  const off = boot(root, ctx, canvas, ctx.reduced ? .22 : .3, (g) => {
    const p = compile(g, FS); g.useProgram(p); triangle(g);
    const u = U(g, p, 'R T M');
    return (t, w, h) => {
      const tx = mp.in ? mp.x : .5, ty = mp.in ? mp.y : .5;
      m.x += (tx - m.x) * .05; m.y += (ty - m.y) * .05; // 감쇠 추적
      g.viewport(0, 0, w, h); g.uniform2f(u.R, w, h); g.uniform1f(u.T, t); g.uniform2f(u.M, m.x, m.y);
      g.drawArrays(g.TRIANGLES, 0, 3);
    };
  });
  return () => { off(); mp.off(); };
}
