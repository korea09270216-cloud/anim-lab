export default function init(root, ctx) {
  const { lenis } = ctx;
  const slides = [...root.querySelectorAll('.s091__slide')];
  const btns = [...root.querySelectorAll('.s091__idx button')];
  const bar = root.querySelector('.s091__bar u');
  const n = slides.length;
  let cur = 0, busy = false, last = performance.now(), active = false, released = false;
  const splits = slides.map(s => new SplitText(s.querySelector('.s091__title'), { type: 'chars' }));
  const parts = s => [s.querySelector('.s091__eyebrow'), s.querySelector('.s091__desc'), s.querySelector('.s091__cta')];
  slides.forEach((s, i) => { gsap.set(s, { zIndex: i }); if (i) { gsap.set(splits[i].chars, { yPercent: 110 }); gsap.set(parts(s), { autoAlpha: 0, y: 30 }); } });
  const beans = slides.map(s => s.querySelector('.s091__bean'));
  const idle = beans.map((b, i) => gsap.to(b, { rotate: 18 + (i % 2 ? -10 : 10), duration: 4.5, ease: 'sine.inOut', yoyo: true, repeat: -1 }));

  const mark = () => { btns.forEach((b, i) => b.classList.toggle('on', i === cur)); gsap.to(bar, { scaleY: (cur + 1) / n, duration: 1, ease: 'expo.out' }); };
  mark();

  const goTo = (i, dir) => {
    if (i === cur) return;
    busy = true;
    const prev = slides[cur], next = slides[i], pc = cur;
    gsap.set(next, { zIndex: n + 5 });
    const tl = gsap.timeline({ defaults: { ease: 'expo.inOut', duration: 1.15 }, onComplete: () => { busy = false; slides.forEach((s, k) => gsap.set(s, { zIndex: k === i ? 2 : 0 })); gsap.set(prev, { clipPath: 'inset(100% 0% 0% 0%)' }); } });
    tl.fromTo(next, { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)' }, 0);
    tl.fromTo(next.querySelector('.s091__bean'), { yPercent: dir > 0 ? 30 : -30, scale: 1.25 }, { yPercent: 0, scale: 1 }, 0);
    tl.to(prev.querySelector('.s091__in'), { yPercent: dir > 0 ? -18 : 18, autoAlpha: .2, duration: 1.1 }, 0);
    tl.fromTo(splits[i].chars, { yPercent: dir > 0 ? 115 : -115 }, { yPercent: 0, stagger: { each: .035, from: dir > 0 ? 'start' : 'end' }, ease: 'expo.out', duration: 1.2 }, .35);
    tl.fromTo(parts(next), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, stagger: .1, ease: 'expo.out', duration: 1 }, .6);
    tl.set(prev.querySelector('.s091__in'), { yPercent: 0, autoAlpha: 1 }, 1.2);
    tl.set(splits[pc].chars, { yPercent: 110 }, 1.2);
    tl.set(parts(prev), { autoAlpha: 0, y: 30 }, 1.2);
    cur = i; mark();
  };

  const st = ScrollTrigger.create({
    trigger: root, start: 'top top', end: () => '+=' + (n - 1) * innerHeight * 0.8, pin: true, anticipatePin: 1,
    onToggle: self => {
      active = self.isActive;
      if (active && !released) { obs.enable(); lenis.stop(); } else { obs.disable(); lenis.start(); }
      if (!active) released = false;
    }
  });
  const posOf = i => st.start + (st.end - st.start) * (i / (n - 1));
  const release = dir => { released = true; obs.disable(); lenis.start(); lenis.scrollTo(dir > 0 ? st.end + 4 : st.start - 4, { duration: 1, force: true }); };
  const step = d => {
    if (busy) return;
    last = performance.now();
    const t = cur + d;
    if (t < 0) return release(-1);
    if (t > n - 1) return release(1);
    goTo(t, d);
    lenis.scrollTo(posOf(t), { duration: 1.1, force: true });
  };
  const obs = Observer.create({ type: 'wheel,touch,pointer', tolerance: 24, preventDefault: true, wheelSpeed: -1, onUp: () => step(1), onDown: () => step(-1) });
  obs.disable();
  btns.forEach((b, i) => b.addEventListener('click', () => { if (!busy && i !== cur) { last = performance.now(); goTo(i, i > cur ? 1 : -1); if (active) lenis.scrollTo(posOf(i), { duration: 1.1, force: true }); } }));
  const poke = () => { last = performance.now(); };
  addEventListener('wheel', poke, { passive: true }); addEventListener('touchstart', poke, { passive: true }); addEventListener('keydown', poke);
  // 자동 데모: 사용자 입력이 없으면 스스로 다음 슬라이드로
  const demo = setInterval(() => {
    const r = root.getBoundingClientRect();
    if (busy || performance.now() - last < 2600) return;
    if (r.top > innerHeight * .25 || r.bottom < innerHeight * .75) return;
    if (!active) { lenis.scrollTo(st.start + 2, { duration: 1, force: true }); return; }
    if (cur === n - 1) { goTo(0, -1); lenis.scrollTo(posOf(0), { duration: 1.2, force: true }); } else step(1);
    last = performance.now() - 1200;
  }, 1200);
  return () => { clearInterval(demo); obs.kill(); st.kill(); lenis.start(); idle.forEach(t => t.kill()); splits.forEach(s => s.revert()); removeEventListener('wheel', poke); removeEventListener('touchstart', poke); removeEventListener('keydown', poke); };
}
