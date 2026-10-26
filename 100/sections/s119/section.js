export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const scr = q('.s119__scr'), bar = q('.s119__bar'), btns = qa('.s119__b');
  const hero = q('.s119__hero'), foot = q('.s119__foot'), zones = qa('.s119__zones li');
  let shown = false, auto = true, demo = null;

  gsap.set(bar, { yPercent: 140, opacity: 0 });

  const show = () => {
    if (shown) return; shown = true;
    gsap.to(bar, { yPercent: 0, opacity: 1, duration: .95, ease: 'expo.out', overwrite: 'auto' });
    gsap.fromTo(btns, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .07, ease: 'expo.out', overwrite: 'auto' });
  };
  const hide = () => {
    if (!shown) return; shown = false;
    gsap.to(bar, { yPercent: 140, opacity: 0, duration: .6, ease: 'expo.in', overwrite: 'auto' });
  };

  // 히어로 하단이 화면 78% 지점에 닿으면 인, 푸터 상단이 86% 지점에 닿으면 아웃
  const st = ScrollTrigger.create({
    scroller: scr, trigger: hero, start: 'bottom 78%', endTrigger: foot, end: 'top 86%',
    onToggle: self => { self.isActive ? show() : hide(); }
  });

  const zoneOf = () => {
    const vh = scr.clientHeight, t = scr.scrollTop;
    if (t + vh * .78 < hero.offsetHeight) return 'hero';
    if (t + vh * .86 > foot.offsetTop) return 'foot';
    return 'body';
  };
  let lastZ = '';
  const onScroll = () => {
    const z = zoneOf(); if (z === lastZ) return; lastZ = z;
    zones.forEach(li => li.classList.toggle('is-on', li.dataset.z === z));
  };
  scr.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const ripple = (b, x, y) => {
    const s = document.createElement('span'); s.className = 's119__rp'; s.style.left = x + 'px'; s.style.top = y + 'px';
    b.appendChild(s);
    gsap.fromTo(s, { scale: 0, opacity: .3 }, { scale: 1.5, opacity: 0, duration: 1, ease: 'expo.out', onComplete: () => s.remove() });
    gsap.fromTo(b, { scale: 1 }, { scale: .95, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: 'auto' });
  };
  const onDown = e => { const b = e.currentTarget, r = b.getBoundingClientRect(); ripple(b, e.clientX - r.left, e.clientY - r.top); };
  btns.forEach(b => b.addEventListener('pointerdown', onDown));

  const stopAuto = () => { auto = false; if (demo) demo.kill(); gsap.killTweensOf(scr); };
  const onUser = e => { if (e.isTrusted) stopAuto(); };
  scr.addEventListener('wheel', onUser, { passive: true });
  scr.addEventListener('touchstart', onUser, { passive: true });
  scr.addEventListener('pointerdown', onUser);
  btns.forEach(b => b.addEventListener('pointerdown', onUser));

  const cycle = () => {
    if (!auto) return;
    const max = scr.scrollHeight - scr.clientHeight, hh = hero.offsetHeight;
    const go = baseEl => { const r = baseEl.getBoundingClientRect(); ripple(baseEl, r.width * .5, r.height * .5); };
    demo = gsap.timeline({ onComplete: cycle });
    demo.to(scr, { scrollTo: hh * .95, duration: 1.8, ease: 'power3.inOut' }, 1.0)
      .call(() => go(btns[2]), null, 3.0)
      .to(scr, { scrollTo: hh + 520, duration: 1.6, ease: 'power2.inOut' }, 3.3)
      .to(scr, { scrollTo: max, duration: 2.2, ease: 'power2.inOut' }, 5.3)
      .to(scr, { scrollTo: max - 220, duration: .9, ease: 'power2.inOut' }, 8.2)
      .to(scr, { scrollTo: 0, duration: 2.6, ease: 'expo.inOut' }, 9.4)
      .to({}, { duration: .8 }, 12.0);
  };
  demo = gsap.delayedCall(.4, cycle);

  return () => {
    stopAuto(); st.kill();
    scr.removeEventListener('scroll', onScroll); scr.removeEventListener('wheel', onUser);
    scr.removeEventListener('touchstart', onUser); scr.removeEventListener('pointerdown', onUser);
    btns.forEach(b => { b.removeEventListener('pointerdown', onDown); b.removeEventListener('pointerdown', onUser); });
    gsap.killTweensOf([bar, btns, scr]);
  };
}
