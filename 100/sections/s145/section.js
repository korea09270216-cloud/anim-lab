export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const tiles = [...root.querySelectorAll('.s145__tile')];
  const win = q('.s145__win'), scene = q('.s145__scene'), cap = q('.s145__cap');
  const tl_ = q('.s145__txt--l'), tr_ = q('.s145__txt--r');

  // 타일마다 화면 중심에서의 거리에 비례해 z 도착값을 다르게 → 바깥쪽 타일이 먼저 카메라를 지나친다
  const info = tiles.map(el => {
    const cx = parseFloat(el.style.left) / 100 - .5, cy = parseFloat(el.style.top) / 100 - .5;
    return { el, d: Math.hypot(cx, cy) };
  });
  const maxD = Math.max(...info.map(i => i.d));
  const z0 = info.map(({ d }) => -250 - (1 - d / maxD) * 380);
  gsap.set(tiles, { xPercent: -50, yPercent: -50, z: (i) => z0[i] });
  gsap.set(cap, { opacity: 0 });

  const tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });
  info.forEach(({ el, d }, i) => {
    const r = d / maxD, st = .05 + (1 - r) * .3, dur = 1.5 - r * .45;
    // 바깥 타일이 먼저·빠르게 카메라를 지나친다. 지나치기 직전에 사라짐
    tl.fromTo(el, { z: z0[i] }, { z: 780, duration: dur, ease: 'power2.in' }, st)
      .to(el, { opacity: 0, duration: .2, ease: 'power1.in' }, st + dur - .22);
  });
  // 갈라지는 분할 텍스트
  tl.fromTo([tl_, tr_], { opacity: 0 }, { opacity: 1, duration: .3, ease: 'power2.out' }, .1)
    .to(tl_, { x: () => -innerWidth * .62, duration: 1.1, ease: 'power3.in' }, 1.0)
    .to(tr_, { x: () => innerWidth * .62, duration: 1.1, ease: 'power3.in' }, 1.0)
    // 마스크 창이 열린다
    .to(win, { width: '100vw', height: '100vh', borderRadius: 0, duration: 1.2, ease: 'power3.inOut' }, 1.15)
    // 안쪽 장면은 늦게 따라 줌 (trailing zoom)
    .fromTo(scene, { scale: 1 }, { scale: 1.9, duration: 2.0, ease: 'power2.out' }, 1.15)
    .to(cap, { opacity: 1, duration: .6, ease: 'power2.out' }, 2.5);

  const stt = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1.1, animation: tl
  });

  // idle: 창 안 장면이 숨쉬고 타일이 천천히 흔들린다 (스크롤이 없어도 화면이 변함)
  const idle = [
    gsap.to(q('.s145__sun'), { yPercent: 24, duration: 3.2, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    gsap.to(q('.s145__hill--a'), { xPercent: 3, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    gsap.to(q('.s145__hill--b'), { xPercent: -4, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 }),
    gsap.to(tiles, { rotation: (i) => (i % 2 ? 2.5 : -2.5), duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .15 })
  ];
  // 포인터 시차: perspective-origin 이 마우스를 살짝 따라간다
  const world = q('.s145__world'), o = { x: 0, y: 0 };
  const qx = gsap.quickTo(o, 'x', { duration: 1.2, ease: 'power3.out' });
  const qy = gsap.quickTo(o, 'y', { duration: 1.2, ease: 'power3.out' });
  let off = () => {};
  if (ctx.fine) off = ctx.tick(() => { qx((ctx.mouse.nx - .5) * 14); qy((ctx.mouse.ny - .5) * 14); world.style.perspectiveOrigin = (50 + o.x) + '% ' + (50 + o.y) + '%'; });

  return () => { off(); stt.kill(); tl.kill(); idle.forEach(t => t.kill()); };
}
