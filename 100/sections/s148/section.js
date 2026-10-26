const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FS = `precision mediump float;
uniform vec2 uR;uniform float uT;uniform float uP;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float vn(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}
float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*vn(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return s;}
vec3 sceneA(vec2 uv,float asp){
  vec3 c=mix(vec3(1.,.9,.68),vec3(.98,.5,.34),1.-uv.y);
  vec2 p=(uv-vec2(.62,.58))*vec2(asp,1.);
  float r=length(p);
  float ring=smoothstep(.02,0.,abs(fract(r*9.-uT*.15)-.5)-.2)*smoothstep(.55,.2,r)*.28;
  c=mix(c,vec3(1.,.96,.84),smoothstep(.27,.26,r));
  c+=ring*vec3(1.,.8,.5);
  vec2 b=(uv-vec2(.62,.17))*vec2(asp,1.);
  float bowl=smoothstep(.0,-.01,length(b*vec2(.55,1.4))-.3)*step(b.y,.04);
  c=mix(c,vec3(.24,.1,.05),bowl);
  float rim=smoothstep(.012,.0,abs(b.y-.04))*step(abs(b.x),.55);
  c=mix(c,vec3(.95,.85,.7),rim*.0);
  float steam=vn(vec2(uv.x*asp*6.,uv.y*3.-uT*.6))*smoothstep(.2,.7,uv.y)*smoothstep(.95,.5,uv.y)*smoothstep(.0,.2,.35-abs(uv.x-.62)*.7);
  c=mix(c,vec3(1.),steam*.35);
  return c;
}
vec3 sceneB(vec2 uv,float asp){
  vec3 c=mix(vec3(.07,.05,.2),vec3(.28,.12,.38),1.-uv.y);
  vec2 g=floor(uv*vec2(asp,1.)*60.);
  float st=step(.985,h(g))*(.5+.5*sin(uT*3.+h(g)*30.));
  c+=st*vec3(1.,.95,.8)*step(.45,uv.y);
  vec2 m=(uv-vec2(.7,.72))*vec2(asp,1.);
  float moon=smoothstep(.16,.155,length(m))-smoothstep(.15,.145,length(m-vec2(.05,.03)));
  c=mix(c,vec3(1.,.93,.7),clamp(moon,0.,1.));
  for(int i=0;i<5;i++){
    float fi=float(i);
    vec2 lp=vec2(.14+fi*.15,.92-mod(fi,2.)*.07);
    lp.x+=sin(uT*.8+fi)*.008;
    vec2 d=(uv-lp)*vec2(asp,1.);
    float body=smoothstep(.052,.048,length(d*vec2(1.,.8)));
    float glow=.012/(length(d)+.03);
    c+=vec3(1.,.35,.18)*glow*.55;
    c=mix(c,vec3(1.,.3,.15),body);
    c=mix(c,vec3(.2,.05,.03),smoothstep(.003,.0,abs(uv.x-lp.x))*step(lp.y,uv.y));
  }
  float table=smoothstep(.0,-.004,uv.y-.2);
  c=mix(c,vec3(.12,.06,.1),table);
  return c;
}
void main(){
  vec2 uv=gl_FragCoord.xy/uR;float asp=uR.x/uR.y;
  vec3 A=sceneA(uv,asp),B=sceneB(uv,asp);
  vec2 q=(uv-vec2(.55,.45))*vec2(asp,1.);
  float r=length(q),a=atan(q.y,q.x);
  float sw=a+r*5.-uT*.12;
  vec2 sp=vec2(cos(sw),sin(sw))*r*3.2+vec2(uT*.02,0.);
  float n=fbm(sp*1.6+fbm(sp*2.+uT*.04)*1.4);
  n=smoothstep(.12,.92,n*.78+r*.42);
  float th=uP*1.32-.16;
  float d=th-n;
  vec3 col=mix(A,B,step(0.,d));
  float edge=smoothstep(-.07,0.,d)*step(d,0.);
  col*=1.-smoothstep(-.12,0.,d)*step(d,0.)*.55;
  vec3 fire=mix(vec3(1.,.82,.3),vec3(1.,.28,.05),smoothstep(-.02,-.07,d));
  col=mix(col,fire,edge*step(d,0.));
  float after=smoothstep(.0,.06,d)*smoothstep(.12,.05,d);
  col+=after*vec3(.5,.18,.05)*.5;
  gl_FragColor=vec4(col,1.);
}`;

export default function init(root, ctx) {
  const cv = root.querySelector('.s148__cv');
  const stage = root.querySelector('.s148__stage');
  const A = root.querySelector('.s148__copy--a'), B = root.querySelector('.s148__copy--b');
  const bar = root.querySelector('.s148__bar i');
  const fa = root.querySelector('.s148__fallback .b');
  let gl = null;
  try { gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) || cv.getContext('experimental-webgl'); } catch (e) { gl = null; }
  let prog = null, uR, uT, uP;
  if (gl) {
    try {
      const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      prog = gl.createProgram();
      gl.attachShader(prog, mk(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, mk(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link');
      gl.useProgram(prog);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      uR = gl.getUniformLocation(prog, 'uR'); uT = gl.getUniformLocation(prog, 'uT'); uP = gl.getUniformLocation(prog, 'uP');
    } catch (e) { gl = null; prog = null; }
  }
  if (!gl) root.classList.add('is-fallback');

  function resize() {
    if (!gl) return;
    const w = Math.max(2, Math.round(Math.min(stage.clientWidth, 1600) * .36)), h = Math.max(2, Math.round(stage.clientHeight * .36));
    cv.width = w; cv.height = h; gl.viewport(0, 0, w, h);
  }
  resize();
  window.addEventListener('resize', resize);

  // 진행도: 스크롤이 움직이면 스크롤을, 2.5초 가만히 있으면 자동 왕복
  const S = { scroll: 0, auto: 0, cur: 0, lastScroll: -1e9, mode: 'auto' };
  const auto = gsap.to(S, { auto: 1, duration: 4.2, ease: 'power2.inOut', yoyo: true, repeat: -1, repeatDelay: 1.1 });
  const st = ScrollTrigger.create({
    trigger: stage, start: 'top top', end: '+=160%', pin: true, scrub: false,
    onUpdate: self => { if (Math.abs(self.progress - S.scroll) > .001) { S.scroll = self.progress; S.lastScroll = performance.now(); } }
  });

  let vis = true, last = 0;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(stage);

  function frame() {
    if (!vis) return;
    const now = performance.now();
    if (now - last < 38) return; last = now;
    const idle = now - S.lastScroll > 2500;
    const target = idle ? S.auto : S.scroll;
    S.cur += (target - S.cur) * (idle ? .2 : .1);
    const p = S.cur;
    const k = Math.min(1, Math.max(0, (p - .42) / .2));
    A.style.opacity = String(1 - Math.min(1, Math.max(0, (p - .3) / .22)));
    A.style.transform = 'translateY(' + (-p * 40).toFixed(1) + 'px)';
    B.style.opacity = String(k);
    B.style.transform = 'translateY(' + ((1 - k) * 36).toFixed(1) + 'px)';
    bar.style.transform = 'scaleY(' + p.toFixed(3) + ')';
    if (!gl) { fa.style.opacity = String(p); return; }
    gl.uniform2f(uR, cv.width, cv.height);
    gl.uniform1f(uT, now / 1000);
    gl.uniform1f(uP, p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  const off = ctx.tick(frame);

  return () => {
    off(); io.disconnect(); auto.kill(); st.kill();
    window.removeEventListener('resize', resize);
    if (gl) { const e = gl.getExtension('WEBGL_lose_context'); e && e.loseContext(); }
  };
}
