export default function init(root, ctx) {
  const { lenis } = ctx;
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const items = qa('.s096__li'), arts = qa('.s096__art'), dets = qa('.s096__d'), ul = q('.s096__ul'), cnt = q('.s096__cnt');
  const n = items.length;
  // 새 이미지가 들어올 때의 마스크 모양 (장마다 다름)
  const mask = [
    ['circle(0% at 50% 100%)', 'circle(150% at 50% 100%)'],
    ['inset(0% 0% 100% 0%)', 'inset(0% 0% 0% 0%)'],
    ['circle(0% at 100% 0%)', 'circle(150% at 100% 0%)'],
    ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'],
    ['polygon(0 100%,0 100%,0 100%)', 'polygon(0 100%,0 -140%,280% 100%)']
  ];
  let cur = 0, z = 1, last = performance.now();
  gsap.set(arts, { zIndex: 0 }); gsap.set(arts[0], { zIndex: 1 });
  gsap.set(arts.slice(1), { clipPath: (i) => mask[i + 1][0] });
  gsap.set(dets.slice(1).map(d => d.children), { autoAlpha: 0 });
  const paint = (i, dur) => gsap.to(items, {
    opacity: k => k === i ? 1 : Math.max(.1, .32 - Math.abs(k - i) * .08), x: k => k === i ? 24 : 0,
    duration: dur, ease: 'expo.out', overwrite: 'auto', stagger: 0
  });
  const place = (i, dur) => {
    const h = items[0].offsetHeight;
    gsap.to(ul, { y: () => -(i + .5) * h, yPercent: 0, duration: dur, ease: 'expo.out', overwrite: 'auto' });
  };
  gsap.set(ul, { yPercent: 0, y: -.5 * items[0].offsetHeight });
  paint(0, 0);

  const show = i => {
    if (i === cur) return;
    const dir = i > cur ? 1 : -1, old = cur; cur = i;
    const a = arts[i];
    gsap.set(a, { zIndex: ++z });
    gsap.fromTo(a, { clipPath: mask[i][0] }, { clipPath: mask[i][1], duration: 1.3, ease: 'expo.inOut', overwrite: 'auto' });
    gsap.fromTo(a.querySelector('.in'), { scale: 1.4, rotate: dir * 8 }, { scale: 1, rotate: 0, duration: 1.6, ease: 'expo.out' });
    gsap.to(dets[old].children, { autoAlpha: 0, y: -26 * dir, duration: .5, ease: 'power3.in', stagger: .04, onComplete: () => gsap.set(dets[old], { visibility: 'hidden' }) });
    gsap.set(dets[i], { visibility: 'visible' });
    gsap.fromTo(dets[i].children, { autoAlpha: 0, y: 36 * dir }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: .08, delay: .35 });
    paint(i, 1); place(i, 1.1);
    cnt.textContent = String(i + 1).padStart(2, '0');
  };

  const st = ScrollTrigger.create({
    trigger: root, start: 'top top', end: () => '+=' + n * innerHeight * .7, pin: true, anticipatePin: 1,
    onUpdate: s => show(Math.min(n - 1, Math.floor(s.progress * n)))
  });
  // 자동 데모: 입력이 멈춰 있으면 다음 항목 위치로 스스로 스크롤
  const poke = () => { last = performance.now(); };
  addEventListener('wheel', poke, { passive: true }); addEventListener('touchstart', poke, { passive: true }); addEventListener('keydown', poke);
  const posOf = i => st.start + (st.end - st.start) * ((i + .5) / n);
  const demo = setInterval(() => {
    const r = root.getBoundingClientRect();
    if (performance.now() - last < 2800) return;
    if (r.top > innerHeight * .3 || r.bottom < innerHeight * .7) return;
    lenis.scrollTo(posOf((cur + 1) % n), { duration: 1.6, force: true });
    last = performance.now() - 1000;
  }, 2200);
  return () => { clearInterval(demo); st.kill(); removeEventListener('wheel', poke); removeEventListener('touchstart', poke); removeEventListener('keydown', poke); };
}
