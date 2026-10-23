gsap.registerPlugin(ScrollTrigger, SplitText);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
const reduce = matchMedia('(prefers-reduced-motion:reduce)').matches;

/* ---------- Lenis ↔ GSAP ---------- */
const lenis = new Lenis({ lerp: 0.1 });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
$$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault(); lenis.scrollTo(a.getAttribute('href'), { offset: 0 });
}));

/* 스크롤 진행바 */
gsap.to('.progress i', { scaleX: 1, ease: 'none',
  scrollTrigger: { trigger: document.body, start: 'top top', end: 'bottom bottom', scrub: 0 } });

/* ---------- 커서 + 마그네틱 ---------- */
const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: 0, ny: 0 };
addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  mouse.nx = e.clientX / innerWidth; mouse.ny = e.clientY / innerHeight;
});
if (fine) {
  const cur = $('.cursor'), lab = $('.cursor__label');
  const cx = gsap.quickTo(cur, 'x', { duration: .35, ease: 'power3' });
  const cy = gsap.quickTo(cur, 'y', { duration: .35, ease: 'power3' });
  addEventListener('pointermove', e => { cx(e.clientX); cy(e.clientY); });
  $$('[data-cursor]').forEach(el => {
    el.addEventListener('pointerenter', () => { lab.textContent = el.dataset.cursor; cur.classList.add('is-big'); });
    el.addEventListener('pointerleave', () => cur.classList.remove('is-big'));
  });
  $$('.magnetic').forEach(el => {
    const inner = $('span', el);
    const mx = gsap.quickTo(el, 'x', { duration: .6, ease: 'elastic.out(1,.4)' });
    const my = gsap.quickTo(el, 'y', { duration: .6, ease: 'elastic.out(1,.4)' });
    const ix = gsap.quickTo(inner, 'x', { duration: .6, ease: 'elastic.out(1,.4)' });
    const iy = gsap.quickTo(inner, 'y', { duration: .6, ease: 'elastic.out(1,.4)' });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      mx(dx * .35); my(dy * .35); ix(dx * .18); iy(dy * .18);
    });
    el.addEventListener('pointerleave', () => { mx(0); my(0); ix(0); iy(0); });
  });
}

/* ---------- 01 HERO: 글자 마스크 리빌 ---------- */
const heroSplit = SplitText.create('.hero__title', { type: 'chars,lines', mask: 'lines', charsClass: 'char' });
const subSplit = SplitText.create('.hero__sub', { type: 'lines', mask: 'lines' });
gsap.timeline({ defaults: { ease: 'expo.out' }, delay: .2 })
  .from(heroSplit.chars, { yPercent: 120, rotate: 8, duration: 1.4, stagger: { each: .03, from: 'start' } })
  .from(subSplit.lines, { yPercent: 110, duration: 1, stagger: .12 }, '-=.9')
  .from('.hero .btn', { scale: .6, opacity: 0, duration: 1, ease: 'back.out(2)' }, '-=.7')
  .from('.hero .tag', { opacity: 0, y: 10, duration: .8 }, 0);
/* 히어로 스크롤 아웃: 글자 웨이브 */
gsap.to(heroSplit.chars, { yPercent: -60, opacity: 0, stagger: { each: .015, from: 'center' }, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom 30%', scrub: true } });

/* ---------- 02 단어 점등 ---------- */
const fillEl = $('#fillText');
fillEl.innerHTML = fillEl.textContent.trim().split(/\s+/).map(w => `<span class="w">${w}</span>`).join(' ');
gsap.to('.fill__text .w', { opacity: 1, stagger: .1, ease: 'none',
  scrollTrigger: { trigger: '.fill__text', start: 'top 80%', end: 'bottom 45%', scrub: true } });

/* ---------- 03 마퀴 + 속도 스큐 ---------- */
const rows = $$('.marquee__row').map(row => {
  const track = $('.marquee__track', row), dir = +row.dataset.dir;
  const w = () => track.scrollWidth / 2;
  return { track, dir, x: dir < 0 ? 0 : -w(), w };
});
let vel = 0;
lenis.on('scroll', ({ velocity }) => { vel = velocity; });
const skew = gsap.quickTo('.marquee__track', 'skewX', { duration: .5, ease: 'power3' });
gsap.ticker.add(() => {
  const boost = 1 + Math.abs(vel) * .6;
  rows.forEach(r => {
    r.x += r.dir * 1.2 * boost * (vel < 0 ? -1 : 1);
    const w = r.w();
    if (r.x <= -w) r.x += w; if (r.x >= 0 && r.dir > 0) r.x -= w; if (r.x > 0 && r.dir < 0) r.x -= w;
    gsap.set(r.track, { x: r.x });
  });
  skew(gsap.utils.clamp(-18, 18, -vel * 1.4));
});

/* ---------- 04 가로 스크롤 + 내부 패럴랙스 ---------- */
const track = $('.hscroll__track');
const hTween = gsap.to(track, { x: () => -(track.scrollWidth - innerWidth), ease: 'none',
  scrollTrigger: { trigger: '.hscroll', start: 'top top', end: () => '+=' + (track.scrollWidth - innerWidth),
    pin: true, scrub: .6, invalidateOnRefresh: true, anticipatePin: 1 } });
$$('.hcard__img').forEach(img => {
  // ::before 는 직접 못 건드리므로 CSS 변수(--tx)를 스크럽
  gsap.fromTo(img, { '--tx': '-9%' }, { '--tx': '9%', ease: 'none',
    scrollTrigger: { trigger: img, containerAnimation: hTween, start: 'left right', end: 'right left', scrub: true } });
});

/* ---------- 05 클립패스 원 확장 ---------- */
gsap.timeline({ scrollTrigger: { trigger: '.circle', start: 'top top', end: '+=120%', pin: true, scrub: true } })
  .fromTo('.circle__b', { clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)', ease: 'power2.inOut' }, 0)
  .to('.circle__a h2', { scale: .85, opacity: .3, ease: 'none' }, 0)
  .from('.circle__b h2', { scale: 1.6, ease: 'none' }, 0);

/* ---------- 06 스택 카드 ---------- */
const cards = $$('.scard');
cards.forEach((c, i) => {
  if (i === cards.length - 1) return;
  gsap.to(c, { scale: .9 - (cards.length - i) * .01 + .04, filter: 'brightness(.7)', ease: 'none',
    scrollTrigger: { trigger: cards[i + 1], start: 'top 85%', end: 'top 12%', scrub: true } });
});

/* ---------- 07 호버 리빌 리스트 ---------- */
if (fine) {
  const pv = $('.list__preview'), pvIn = $('div', pv);
  const px = gsap.quickTo(pv, 'x', { duration: .6, ease: 'power3' });
  const py = gsap.quickTo(pv, 'y', { duration: .6, ease: 'power3' });
  const rot = gsap.quickTo(pv, 'rotation', { duration: .6, ease: 'power3' });
  let lastX = 0;
  addEventListener('pointermove', e => {
    px(e.clientX + 30); py(e.clientY - pv.offsetHeight / 2);
    rot(gsap.utils.clamp(-12, 12, (e.clientX - lastX) * .5)); lastX = e.clientX;
  });
  $$('.list__ul li').forEach(li => {
    li.addEventListener('pointerenter', () => {
      pv.style.setProperty('--ph', li.dataset.h);
      gsap.to(pv, { opacity: 1, scale: 1, duration: .5, ease: 'back.out(1.7)' });
    });
    li.addEventListener('pointerleave', () => gsap.to(pv, { opacity: 0, scale: .6, duration: .35 }));
  });
}
gsap.from('.list__ul li', { yPercent: 40, opacity: 0, stagger: .12, duration: 1, ease: 'expo.out', clearProps: 'opacity,transform',
  scrollTrigger: { trigger: '.list__ul', start: 'top 80%' } });

/* ---------- 08 3D 틸트 ---------- */
$$('.tcard').forEach(c => {
  const rx = gsap.quickTo(c, 'rotationX', { duration: .5, ease: 'power3' });
  const ry = gsap.quickTo(c, 'rotationY', { duration: .5, ease: 'power3' });
  c.addEventListener('pointermove', e => {
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    ry((x - .5) * 28); rx(-(y - .5) * 28);
    c.style.setProperty('--gx', x * 100 + '%'); c.style.setProperty('--gy', y * 100 + '%'); c.style.setProperty('--go', 1);
  });
  c.addEventListener('pointerleave', () => { rx(0); ry(0); c.style.setProperty('--go', 0); });
});
gsap.from('.tcard', { y: 120, opacity: 0, rotationX: -30, stagger: .15, duration: 1.2, ease: 'expo.out',
  scrollTrigger: { trigger: '.tilt__grid', start: 'top 80%' } });

/* ---------- 09 카운터 + SVG 드로우 ---------- */
const path = $('#drawPath'), len = path.getTotalLength();
gsap.set(path, { strokeDasharray: len, strokeDashoffset: len });
gsap.to(path, { strokeDashoffset: 0, ease: 'none',
  scrollTrigger: { trigger: '.stats', start: 'top 70%', end: 'center 40%', scrub: true } });
$$('[data-count]').forEach(el => {
  const o = { v: 0 };
  gsap.to(o, { v: +el.dataset.count, duration: 2.2, ease: 'power3.out',
    scrollTrigger: { trigger: el, start: 'top 85%', once: true },
    onUpdate: () => { el.textContent = Math.round(o.v).toLocaleString(); } });
});

/* ---------- 10 텍스트 스크램블 ---------- */
const CH = '!<>-_\\/[]{}—=+*^?#ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function scramble(el, text, dur = 1.4) {
  const o = { p: 0 };
  gsap.killTweensOf(o);
  gsap.to(o, { p: 1, duration: dur, ease: 'none', onUpdate() {
    const n = Math.floor(o.p * text.length);
    el.textContent = text.split('').map((c, i) => c === ' ' ? ' ' : i < n ? c : CH[Math.random() * CH.length | 0]).join('');
  }, onComplete: () => { el.textContent = text; } });
}
const sc = $('[data-scramble]');
ScrollTrigger.create({ trigger: sc, start: 'top 80%', once: true, onEnter: () => scramble(sc, sc.dataset.scramble, 1.8) });
sc.addEventListener('pointerenter', () => scramble(sc, sc.dataset.scramble, 1));

/* ---------- 11·12 WebGL: 액체 그라디언트 + 마우스 파동 ---------- */
function glInit(canvas, opts = {}) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;
  const vs = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const fs = `precision highp float;
uniform vec2 uR;uniform float uT;uniform vec2 uM;uniform float uV;uniform vec3 uC1,uC2,uC3;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p*=2.02;a*=.5;}return v;}
void main(){
 vec2 uv=gl_FragCoord.xy/uR;vec2 q=(gl_FragCoord.xy-.5*uR)/min(uR.x,uR.y);
 vec2 m=(uM-.5*uR)/min(uR.x,uR.y);
 float d=length(q-m);
 // 마우스 파동: 거리 기반 사인 링
 float ring=sin(d*28.-uT*5.)*exp(-d*5.)*uV;
 vec2 w=q+normalize(q-m+1e-4)*ring*.06;
 float t=uT*.12;
 vec2 a=vec2(fbm(w*1.6+t),fbm(w*1.6-t+5.2));
 float f=fbm(w*1.4+a*2.2+t);
 vec3 col=mix(uC1,uC2,smoothstep(.2,.7,f));
 col=mix(col,uC3,smoothstep(.55,.95,fbm(w*2.+a*1.5-t)));
 col+=ring*.35;
 col*=1.-.35*dot(q,q);
 gl_FragColor=vec4(col,1.);}`;
  const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(sh)); return sh; };
  const pr = gl.createProgram(); gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(pr); gl.useProgram(pr);
  const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = n => gl.getUniformLocation(pr, n);
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  gl.uniform3fv(U('uC1'), hex(opts.c1)); gl.uniform3fv(U('uC2'), hex(opts.c2)); gl.uniform3fv(U('uC3'), hex(opts.c3));
  // 부드러운 그라디언트라 저해상도 렌더 후 CSS 로 늘려도 티가 안 난다 (GPU 부하 ↓)
  const dpr = opts.scale || .5;
  canvas.addEventListener('webglcontextlost', e => e.preventDefault());
  const size = () => { const r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr; gl.viewport(0, 0, canvas.width, canvas.height); };
  size(); addEventListener('resize', size);
  const st = { mx: canvas.width / 2, my: canvas.height / 2, v: 0, visible: true };
  new IntersectionObserver(([e]) => st.visible = e.isIntersecting).observe(canvas);
  let px = 0, py = 0;
  const frame = t => {
    if (st.visible) {
      const r = canvas.getBoundingClientRect();
      const tx = (mouse.x - r.left) * dpr, ty = (r.height - (mouse.y - r.top)) * dpr;
      st.mx += (tx - st.mx) * .08; st.my += (ty - st.my) * .08;
      const sp = Math.hypot(mouse.x - px, mouse.y - py); px = mouse.x; py = mouse.y;
      st.v += (Math.min(sp / 40, 1.2) - st.v) * .06 + .0;
      gl.uniform2f(U('uR'), canvas.width, canvas.height);
      gl.uniform1f(U('uT'), t / 1000);
      gl.uniform2f(U('uM'), st.mx, st.my);
      gl.uniform1f(U('uV'), opts.base + st.v * 1.5);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return gl;
}
if (!reduce) {
  glInit($('#heroBg'), { c1: '#0b0b0d', c2: '#ff4d2e', c3: '#7c5cff', base: .5, scale: .3 });
  glInit($('#glCanvas'), { c1: '#06121f', c2: '#00c2a8', c3: '#ff4d2e', base: .8, scale: .45 });
}
const gsplit = SplitText.create('.gl__ui h2', { type: 'words', mask: 'words' });
gsap.from(gsplit.words, { yPercent: 110, stagger: .1, duration: 1.2, ease: 'expo.out',
  scrollTrigger: { trigger: '.gl', start: 'top 60%' } });
