export default function init(root, ctx) {
  const page = root.querySelector('.s093__page');
  const foot = root.querySelector('.s093__foot');
  const inner = root.querySelector('.s093__in');
  const letters = [...root.querySelectorAll('.s093__logo span')];
  const cols = root.querySelectorAll('.s093__cols>div');
  const cta = root.querySelector('.s093__cta');
  const ctaT = cta.querySelector('span');

  // 커튼: 위 페이지가 걷히는 동안 푸터가 뒤에서 스케일업, 거대 로고가 아래서 올라온다
  gsap.set(letters, { yPercent: 105 });
  gsap.set(cta, { scale: 0 });
  gsap.set(cols, { y: 40, autoAlpha: 0 });
  gsap.set(inner, { scale: .9, transformOrigin: '50% 100%' });
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: .6 } });
  tl.to(inner, { scale: 1, duration: 1 }, 0)
    .to(page, { filter: 'brightness(.88)', duration: 1 }, 0)
    .to(letters, { yPercent: 0, duration: .7, stagger: { each: .06, ease: 'power2.in' }, ease: 'expo.out' }, .3)
    .to(cols, { y: 0, autoAlpha: 1, stagger: .08, duration: .3, ease: 'power3.out' }, .55)
    .to(cta, { scale: 1, duration: .3, ease: 'back.out(1.8)' }, .8);

  // 마그네틱 CTA: 포인터가 가까우면 끌려오고, 없으면 스스로 부유(idle 루프)
  const qx = gsap.quickTo(cta, 'x', { duration: 1.1, ease: 'elastic.out(1,.45)' });
  const qy = gsap.quickTo(cta, 'y', { duration: 1.1, ease: 'elastic.out(1,.45)' });
  const tx = gsap.quickTo(ctaT, 'x', { duration: .8, ease: 'expo.out' });
  const ty = gsap.quickTo(ctaT, 'y', { duration: .8, ease: 'expo.out' });
  let near = false, t0 = 0;
  const off = ctx.tick(time => {
    const r = cta.getBoundingClientRect();
    const cx = r.left + r.width / 2 - (gsap.getProperty(cta, 'x') || 0), cy = r.top + r.height / 2 - (gsap.getProperty(cta, 'y') || 0);
    const dx = ctx.mouse.x - cx, dy = ctx.mouse.y - cy, d = Math.hypot(dx, dy), R = r.width * 1.1;
    const fr = ctx.fine && d < R && r.width > 20 && (r.top < innerHeight && r.bottom > 0);
    if (fr) { near = true; qx(dx * .45); qy(dy * .45); tx(dx * .22); ty(dy * .22); }
    else {
      if (near) { near = false; tx(0); ty(0); }
      const a = time * .9; // 부유 궤도
      qx(Math.cos(a) * 26); qy(Math.sin(a * 1.3) * 22);
    }
  });
  const hov = () => gsap.to(cta, { backgroundColor: '#fff3e4', color: '#1d1a16', duration: .5, ease: 'expo.out' });
  const out = () => gsap.to(cta, { backgroundColor: '#1d1a16', color: '#f4eee3', duration: .6, ease: 'expo.out' });
  cta.addEventListener('pointerenter', hov); cta.addEventListener('pointerleave', out);
  return () => { off(); tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); cta.removeEventListener('pointerenter', hov); cta.removeEventListener('pointerleave', out); };
}
