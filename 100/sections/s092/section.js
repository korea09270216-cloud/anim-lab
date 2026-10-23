export default function init(root, ctx) {
  const { lenis, reduced } = ctx;
  const bands = [...root.querySelectorAll('.s092__band')];
  const bar = root.querySelector('.fbar') || root.querySelector('.s092__ring .fbar');
  const pct = root.querySelector('.s092__pct');
  const C = 2 * Math.PI * 36;
  bar.style.strokeDasharray = C; bar.style.strokeDashoffset = C;
  const setBar = gsap.quickSetter(bar, 'strokeDashoffset');
  let shown = -1;
  gsap.set(root, { '--hfg': bands[0].dataset.hfg, '--hbg': bands[0].dataset.hbg });

  const sts = [];
  // 배경 명도가 바뀌는 순간 헤더·원형 버튼 색을 반전
  bands.forEach((b, i) => {
    sts.push(ScrollTrigger.create({
      trigger: b, start: 'top 38px', end: 'bottom 38px',
      onToggle: s => { if (s.isActive) gsap.to(root, { '--hfg': b.dataset.hfg, '--hbg': b.dataset.hbg, duration: .7, ease: 'expo.out', overwrite: 'auto' }); }
    }));
    const lines = b.querySelectorAll('.ln>span');
    gsap.set(lines, { yPercent: 110 });
    gsap.set(b.querySelectorAll('.s092__chap,.s092__p'), { autoAlpha: 0, y: 24 });
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } })
      .to(lines, { yPercent: 0, duration: 1.4, stagger: .12 })
      .to(b.querySelectorAll('.s092__chap,.s092__p'), { autoAlpha: b.querySelector('.s092__p') ? 1 : 1, y: 0, duration: 1.1, stagger: .15 }, .25);
    sts.push(ScrollTrigger.create({ trigger: b, start: 'top 62%', end: 'bottom 30%', onToggle: s => s.isActive ? tl.play() : tl.reverse() }));
    const orb = b.querySelector('.s092__orb');
    gsap.to(orb, { y: -34, rotate: i % 2 ? -14 : 14, duration: 3.6 + i * .4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    if (!reduced) gsap.fromTo(orb, { scale: .82 }, { scale: 1.08, ease: 'none', scrollTrigger: { trigger: b, start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // 첫 밴드는 바로 보이게
  sts[1] && null;

  // 전체 스크롤 진행 → 원형 게이지
  sts.push(ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    onUpdate: s => {
      setBar(C * (1 - s.progress));
      const v = Math.round(s.progress * 100);
      if (v !== shown) { shown = v; pct.textContent = v; }
    }
  }));
  const fab = root.querySelector('.s092__fab');
  const toTop = () => lenis.scrollTo(root.getBoundingClientRect().top + scrollY, { duration: 1.6, easing: t => 1 - Math.pow(1 - t, 4) });
  fab.addEventListener('click', toTop);
  return () => { fab.removeEventListener('click', toTop); sts.forEach(s => s.kill()); gsap.killTweensOf(root); };
}
