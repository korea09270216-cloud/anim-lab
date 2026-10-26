const ICONS = [
  // 토마토
  '<svg viewBox="0 0 64 64"><circle cx="32" cy="36" r="22" fill="#e8372c"/><ellipse cx="25" cy="28" rx="6" ry="4" fill="#fff" opacity=".35"/><path d="M32 16l-4 6-8-2 6 5-2 6 8-4 8 4-2-6 6-5-8 2z" fill="#2f9e44"/></svg>',
  // 고추
  '<svg viewBox="0 0 64 64"><path d="M16 14c18-4 34 8 34 28 0 8-4 12-8 12 2-14-8-24-26-26z" fill="#d9232d"/><path d="M16 14c-2-6 2-8 6-8" stroke="#2f9e44" stroke-width="5" fill="none" stroke-linecap="round"/></svg>',
  // 양파 링
  '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="24" fill="#f4e4f0"/><circle cx="32" cy="32" r="18" fill="none" stroke="#b772a6" stroke-width="3"/><circle cx="32" cy="32" r="11" fill="none" stroke="#b772a6" stroke-width="3"/><circle cx="32" cy="32" r="4" fill="#b772a6"/></svg>',
  // 마늘
  '<svg viewBox="0 0 64 64"><path d="M32 6c3 8 20 14 20 32 0 12-9 20-20 20S12 50 12 38C12 20 29 14 32 6z" fill="#f8f2e3" stroke="#d6c9a8" stroke-width="2"/><path d="M32 12v44M22 22c-4 10-4 24 2 34M42 22c4 10 4 24-2 34" stroke="#d6c9a8" stroke-width="2" fill="none"/></svg>',
  // 레몬
  '<svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="25" fill="#fff4b0" stroke="#f2c500" stroke-width="5"/><g stroke="#f2c500" stroke-width="2.5"><path d="M32 10v44M10 32h44M16 16l32 32M48 16L16 48"/></g></svg>',
  // 버섯
  '<svg viewBox="0 0 64 64"><path d="M8 30C8 14 20 6 32 6s24 8 24 24z" fill="#c65b3a"/><circle cx="22" cy="20" r="4" fill="#fff" opacity=".8"/><circle cx="38" cy="16" r="3" fill="#fff" opacity=".8"/><circle cx="44" cy="25" r="3" fill="#fff" opacity=".8"/><path d="M24 30h16l-2 24H26z" fill="#f3e6d0"/></svg>',
  // 달걀
  '<svg viewBox="0 0 64 64"><path d="M32 6C20 6 12 26 12 38c0 12 9 20 20 20s20-8 20-20C52 26 44 6 32 6z" fill="#fff8ec" stroke="#e8d7b4" stroke-width="2"/><circle cx="32" cy="38" r="9" fill="#ffb300"/></svg>',
  // 바질 잎
  '<svg viewBox="0 0 64 64"><path d="M10 54C8 24 28 6 56 8c2 28-14 48-46 46z" fill="#3aa655"/><path d="M12 52C26 38 38 26 50 12" stroke="#1f7a3a" stroke-width="2.5" fill="none"/></svg>',
  // 새우
  '<svg viewBox="0 0 64 64"><path d="M14 20c14-10 36-4 38 16 0 10-8 16-18 14l4-8c6 0 8-4 6-8-4-10-18-8-26-2z" fill="#ff8a5c"/><path d="M14 20l-6-8M18 16l-2-8" stroke="#ff8a5c" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="24" r="2.5" fill="#2b1a05"/></svg>',
];

export default function init(root, ctx) {
  const layer = root.querySelector('.s150__layer');
  const cur = root.querySelector('.s150__cursor');
  const board = root.querySelector('.s150__board');
  const G = 1900, POOL = 24;
  const pool = [], busy = new Set();
  for (let i = 0; i < POOL; i++) {
    const el = document.createElement('div'); el.className = 's150__it';
    el.innerHTML = ICONS[i % ICONS.length];
    layer.appendChild(el); pool.push(el);
  }
  let vis = true, idx = 0, lx = null, ly = null, lt = 0, lastReal = -1e9;
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; }); io.observe(root);
  const floorY = () => root.clientHeight - board.clientHeight + 6 - 30;

  function release(el) {
    gsap.killTweensOf(el); gsap.set(el, { opacity: 0, x: 0, y: 0, rotation: 0, scale: 1 }); busy.delete(el);
  }
  function fly(el, vx, vy, floor, n) {
    const y0 = gsap.getProperty(el, 'y');
    const disc = vy * vy + 2 * G * Math.max(0, floor - y0);
    const t = Math.max(.05, (-vy + Math.sqrt(disc)) / G);
    gsap.to(el, {
      physics2D: { velocity: Math.hypot(vx, vy), angle: Math.atan2(vy, vx) * 180 / Math.PI, gravity: G },
      duration: t, ease: 'none',
      onComplete() {
        const vEnd = vy + G * t;
        gsap.fromTo(el.firstChild, { scaleY: .62, scaleX: 1.28 }, { scaleY: 1, scaleX: 1, duration: .55, ease: 'elastic.out(1.1,.35)', overwrite: true });
        if (n < 3 && vEnd > 340) fly(el, vx * .72, -vEnd * .5, floor, n + 1);
        else gsap.to(el, { opacity: 0, scale: .6, duration: .5, delay: 1.1, ease: 'power3.in', onComplete: () => release(el) });
      }
    });
  }
  function spawn(x, y, mvx, mvy) {
    const el = pool[idx++ % POOL];
    if (busy.has(el)) release(el);
    busy.add(el);
    const floor = floorY();
    const vx = Math.max(-420, Math.min(420, mvx * .3 + gsap.utils.random(-130, 130)));
    const vy = Math.max(-900, Math.min(200, mvy * .25 - gsap.utils.random(420, 760)));
    const sy = Math.min(y, floor - 4);
    gsap.killTweensOf(el);
    gsap.set(el, { x, y: sy, rotation: gsap.utils.random(-30, 30), scale: gsap.utils.random(.8, 1.15), opacity: 1 });
    gsap.set(el.firstChild, { scaleX: 1, scaleY: 1 });
    gsap.to(el, { rotation: '+=' + gsap.utils.random(-540, 540), duration: 1.6, ease: 'power1.out' });
    fly(el, vx, vy, floor, 0);
  }
  function feed(x, y, now, force) {
    if (lx === null) { lx = x; ly = y; lt = now; return; }
    const dx = x - lx, dy = y - ly, d = Math.hypot(dx, dy);
    if (d < 70 && !force) return;
    const dtm = Math.max(16, now - lt);
    spawn(x, y, dx / dtm * 1000, dy / dtm * 1000);
    lx = x; ly = y; lt = now;
  }

  const onMove = e => {
    const r = root.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    lastReal = performance.now();
    gsap.set(cur, { x, y, opacity: 1 });
    if (vis) feed(x, y, lastReal);
  };
  const onLeave = () => { gsap.set(cur, { opacity: 0 }); };
  root.addEventListener('pointermove', onMove); root.addEventListener('pointerleave', onLeave);

  // 마우스가 없을 때 가상 커서가 자동으로 재료를 뿌린다
  function frame() {
    if (!vis) return;
    const now = performance.now();
    if (now - lastReal < 1800) return;
    const w = root.clientWidth, h = root.clientHeight, t = now / 1000;
    const x = w / 2 + Math.sin(t * .9) * w * .38, y = h * .3 + Math.sin(t * 1.7 + 1) * h * .16;
    gsap.set(cur, { x, y, opacity: .8 });
    feed(x, y, now);
  }
  const off = ctx.tick(frame);

  const tl = gsap.from(root.querySelectorAll('.s150__title,.s150__eyebrow,.s150__sub'), { y: 40, opacity: 0, duration: 1.2, stagger: .12, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 75%' } });

  return () => {
    off(); io.disconnect();
    root.removeEventListener('pointermove', onMove); root.removeEventListener('pointerleave', onLeave);
    pool.forEach(el => gsap.killTweensOf(el)); tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill();
  };
}
