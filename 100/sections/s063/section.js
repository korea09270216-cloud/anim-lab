export default function init(root, ctx) {
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const steps = $$('.s063__step'), layers = $$('.s063__layer');
  const fill = $('.s063__barfill'), chip = $('[data-chip]'), sticky = $('.s063__sticky');
  const bgs = ['#f2d3ab', '#f0a37c', '#d3e4c8'];
  const labels = ['STEP 01 · 숙성', 'STEP 02 · 굽기', 'STEP 03 · 식탁'];
  gsap.set(root, { backgroundColor: bgs[0] });
  // 초기: 1막만 보이고 2,3막 레이어는 아래로 접힘
  gsap.set(layers[1], { clipPath: 'inset(100% 0 0 0)' });
  gsap.set(layers[2], { clipPath: 'inset(100% 0 0 0)' });
  gsap.set(steps.slice(1), { autoAlpha: 0, yPercent: 8 });
  const stepsInner = steps.map(s => [...s.children]);

  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: .8 } });
  // 전환 구간: [0.28,0.40], [0.62,0.74] (총 길이 1)
  const trans = (a, b, at) => {
    const t = at;
    tl.to(layers[b], { clipPath: 'inset(0% 0 0 0)', duration: .14, ease: 'power3.inOut' }, t)
      .fromTo(layers[b].querySelector('svg'), { scale: 1.25, yPercent: 8 }, { scale: 1, yPercent: 0, duration: .14, ease: 'power3.inOut' }, t)
      .to(layers[a].querySelector('svg'), { scale: .94, yPercent: -6, duration: .14, ease: 'power3.inOut' }, t)
      .to(root, { backgroundColor: bgs[b], duration: .14 }, t)
      .to(stepsInner[a], { yPercent: -40, autoAlpha: 0, stagger: .008, duration: .08, ease: 'power3.in' }, t)
      .set(steps[a], { autoAlpha: 0 }, t + .09)
      .set(steps[b], { autoAlpha: 1 }, t + .05)
      .fromTo(stepsInner[b], { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, stagger: .012, duration: .1, ease: 'power3.out' }, t + .05)
      .call(() => { chip.textContent = labels[b]; }, null, t + .07)
      .call(() => { chip.textContent = labels[a]; }, null, t + .06);
  };
  // 편향 방지: 정방향/역방향 모두 chip 갱신을 위해 onUpdate 로 처리
  trans(0, 1, .26);
  trans(1, 2, .62);
  tl.to({}, { duration: 1 - .76 }, .76);
  tl.to(fill, { scaleY: 1, duration: 1 }, 0);
  tl.eventCallback('onUpdate', () => {
    const p = tl.progress();
    chip.textContent = p < .33 ? labels[0] : p < .69 ? labels[1] : labels[2];
  });

  // idle 모션: 먼지/증기/회전/가격표
  const idle = [
    gsap.to($$('.s063__spin'), { rotation: 360, duration: 40, repeat: -1, ease: 'none', transformOrigin: '50% 50%' }),
    gsap.to($$('.s063__dust circle'), { y: -26, x: 'random(-14,14)', duration: 'random(2,3.4)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: .2 }),
    gsap.to($$('.s063__steam path'), { y: -20, opacity: .15, duration: 2.2, repeat: -1, ease: 'sine.inOut', stagger: .45, yoyo: true }),
    gsap.to($$('.s063__tag'), { rotation: 6, duration: 1.6, repeat: -1, yoyo: true, ease: 'sine.inOut' }),
  ];
  // 포인터 시차(비주얼만)
  const vis = $('.s063__vis');
  const qx = gsap.quickTo(vis, 'rotationY', { duration: .9, ease: 'power3' }), qy = gsap.quickTo(vis, 'rotationX', { duration: .9, ease: 'power3' });
  gsap.set(vis, { transformPerspective: 900 });
  const off = ctx.tick(() => { qx((ctx.mouse.nx - .5) * 8); qy(-(ctx.mouse.ny - .5) * 6); });

  return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); idle.forEach(t => t.kill()); off(); };
}
