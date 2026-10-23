// 섹션 단독 뷰어. 계약: /100/sections/sNNN/{section.html, section.css, section.js(export default init(root, ctx)), meta.json}
const id = (new URLSearchParams(location.search).get('s') || '000').padStart(3, '0');
history.scrollRestoration = 'manual';
scrollTo(0, 0);

const plugins = ['ScrollTrigger', 'SplitText', 'Flip', 'Draggable', 'MotionPathPlugin', 'Observer', 'ScrollToPlugin',
  'MorphSVGPlugin', 'DrawSVGPlugin', 'InertiaPlugin', 'CustomEase', 'CustomBounce', 'CustomWiggle',
  'Physics2DPlugin', 'PhysicsPropsPlugin', 'ScrambleTextPlugin', 'TextPlugin'];
gsap.registerPlugin(...plugins.map(n => window[n]).filter(Boolean));

const reduced = matchMedia('(prefers-reduced-motion:reduce)').matches;
const lenis = new Lenis({ lerp: 0.1 });
window.__lenis = lenis;
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add(t => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

const mouse = { x: innerWidth / 2, y: innerHeight / 2, nx: .5, ny: .5 };
addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.nx = e.clientX / innerWidth; mouse.ny = e.clientY / innerHeight;
});

// 섹션에 넘겨주는 컨텍스트 (전역 gsap/ScrollTrigger/THREE/Matter 도 그대로 쓸 수 있다)
const ctx = { mouse, lenis, reduced, fine: matchMedia('(hover:hover) and (pointer:fine)').matches,
  tick: fn => { gsap.ticker.add(fn); return () => gsap.ticker.remove(fn); } };

document.getElementById('hudId').textContent = 's' + id;
document.getElementById('replay').onclick = () => location.reload();
const n = +id;
const pad = v => String(v).padStart(3, '0');
document.getElementById('prev').href = `?s=${pad(Math.max(0, n - 1))}`;
document.getElementById('next').href = `?s=${pad(n + 1)}`;
fetch(`./sections/s${id}/meta.json`).then(r => r.json()).then(m => {
  document.getElementById('hudTitle').textContent = m.title || '';
  document.title = `s${id} ${m.title || ''}`;
}).catch(() => {});

(async () => {
  const base = `./sections/s${id}/`;
  const html = await (await fetch(base + 'section.html')).text();
  await new Promise(res => {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = base + 'section.css'; l.onload = l.onerror = res;
    document.head.appendChild(l);
  });
  const mount = document.getElementById('mount');
  mount.innerHTML = html;
  const root = mount.querySelector('[data-sec]');
  if (!root) throw new Error('section.html 에 [data-sec] 루트가 없다');
  const mod = await import(base + 'section.js');
  const cleanup = await mod.default(root, ctx);
  addEventListener('pagehide', () => typeof cleanup === 'function' && cleanup());
  // 폰트·이미지 로드로 높이가 바뀌어도 트리거 위치를 다시 잡는다
  addEventListener('load', () => ScrollTrigger.refresh());
  setTimeout(() => ScrollTrigger.refresh(), 400);
  window.__mounted = true;
})().catch(e => { console.error('MOUNT FAIL', e); window.__mountError = String(e); });
