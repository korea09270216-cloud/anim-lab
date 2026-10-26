export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const page = q('.s118__page'), main = q('.s118__main'), txt = q('.s118__txt'), plus = q('.s118__plus svg');
  const items = qa('.s118__item'), tips = qa('.s118__tip');
  const R = 150, A0 = 180, STEP = 30;
  const pos = items.map((_, i) => { const a = (A0 + STEP * i) * Math.PI / 180; return { x: Math.cos(a) * R, y: Math.sin(a) * R }; });
  const FULL = 176, MINI = 64;
  let open = false, compact = false, lastTop = 0, auto = true, demo = null, fanTl = null;

  gsap.set(items, { x: 0, y: 0, scale: .4, opacity: 0 });
  gsap.set(tips, { opacity: 0, x: 14, yPercent: -50 });
  gsap.set(tips[3], { yPercent: 0, x: 0, y: 0 });

  const setCompact = on => {
    if (on === compact || open) return;
    compact = on;
    gsap.to(main, { width: on ? MINI : FULL, scale: on ? .88 : 1, duration: .7, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(txt, { opacity: on ? 0 : 1, duration: on ? .2 : .5, delay: on ? 0 : .12, ease: 'power2.out', overwrite: 'auto' });
  };

  function openFan() {
    if (open) return; open = true;
    main.setAttribute('aria-expanded', 'true');
    gsap.to(main, { width: MINI, scale: 1, duration: .6, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(txt, { opacity: 0, duration: .15, overwrite: 'auto' });
    gsap.to(plus, { rotation: 135, duration: .7, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(main, { backgroundColor: '#2b2118', duration: .4, overwrite: false });
    fanTl && fanTl.kill();
    fanTl = gsap.timeline();
    items.forEach((it, i) => {
      fanTl.to(it, { x: pos[i].x, y: pos[i].y, scale: 1, opacity: 1, duration: .8, ease: 'expo.out', onStart: () => { it.style.pointerEvents = 'auto'; } }, i * .06)
        .to(tips[i], { opacity: 1, x: 0, duration: .5, ease: 'expo.out' }, i * .06 + .28);
    });
  }
  function closeFan() {
    if (!open) return; open = false;
    main.setAttribute('aria-expanded', 'false');
    fanTl && fanTl.kill();
    fanTl = gsap.timeline();
    items.forEach((it, i) => {
      const k = (items.length - 1 - i) * .04;
      it.style.pointerEvents = 'none';
      fanTl.to(tips[i], { opacity: 0, x: 14, duration: .2, ease: 'power2.in' }, k)
        .to(it, { x: 0, y: 0, scale: .4, opacity: 0, duration: .5, ease: 'expo.inOut' }, k);
    });
    gsap.to(plus, { rotation: 0, duration: .6, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(main, { backgroundColor: '#e8512f', duration: .4, overwrite: false });
    const wantCompact = compact; compact = !wantCompact; setCompact(wantCompact);
  }

  // 스크롤 방향: 내려가면 축소(열려 있으면 접기), 올라가면 확장
  const onScroll = () => {
    const t = page.scrollTop, d = t - lastTop;
    if (Math.abs(d) < 3) return;
    lastTop = t;
    if (d > 0 && t > 60) { if (open) closeFan(); setCompact(true); }
    else if (d < 0 || t <= 60) setCompact(false);
  };
  page.addEventListener('scroll', onScroll, { passive: true });

  const onMain = e => { if (e.isTrusted) stopAuto(); open ? closeFan() : openFan(); };
  const press = it => { gsap.fromTo(it, { scale: 1 }, { scale: .86, duration: .12, yoyo: true, repeat: 1, ease: 'power2.out', overwrite: false }); };
  const onItem = e => {
    const it = e.currentTarget; if (e.isTrusted) stopAuto();
    press(it);
    if (it.dataset.k === 'top') gsap.to(page, { scrollTo: 0, duration: 1.2, ease: 'expo.inOut', overwrite: true });
  };
  main.addEventListener('click', onMain);
  items.forEach(it => it.addEventListener('click', onItem));

  // 자동 데모: 열기 -> 접기 -> 스크롤 다운(축소) -> 업(확장) -> 열고 TOP
  const cycle = () => {
    if (!auto) return;
    demo = gsap.timeline({ onComplete: cycle });
    demo.call(openFan, null, 1.0)
      .call(closeFan, null, 4.0)
      .to(page, { scrollTo: 520, duration: 1.8, ease: 'power2.inOut' }, 4.8)
      .to(page, { scrollTo: 900, duration: 1.4, ease: 'power2.inOut' }, 7.0)
      .to(page, { scrollTo: 700, duration: 1.0, ease: 'power2.inOut' }, 8.8)
      .call(openFan, null, 10.2)
      .call(() => press(items[3]), null, 12.6)
      .to(page, { scrollTo: 0, duration: 1.4, ease: 'expo.inOut' }, 12.8)
      .call(closeFan, null, 14.2)
      .to({}, { duration: .6 }, 14.2);
  };
  const stopAuto = () => { auto = false; if (demo) demo.kill(); gsap.killTweensOf(page); };
  const onUser = e => { if (e.isTrusted) stopAuto(); };
  page.addEventListener('wheel', onUser, { passive: true });
  page.addEventListener('pointerdown', onUser);
  page.addEventListener('touchstart', onUser, { passive: true });
  demo = gsap.delayedCall(.3, cycle);

  return () => {
    stopAuto();
    page.removeEventListener('scroll', onScroll); page.removeEventListener('wheel', onUser);
    page.removeEventListener('pointerdown', onUser); page.removeEventListener('touchstart', onUser);
    main.removeEventListener('click', onMain); items.forEach(it => it.removeEventListener('click', onItem));
    fanTl && fanTl.kill(); gsap.killTweensOf([main, txt, plus, items, tips, page]);
  };
}
