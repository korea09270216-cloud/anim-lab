export default function init(root, ctx) {
  const { lenis } = ctx;
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const bgs = [q('.s099__bg--1'), q('.s099__bg--2'), q('.s099__bg--3')];
  const chs = qa('.s099__ch'), fill = q('.s099__fill');
  // idle: 아웃라인 연도가 천천히 떠다닌다 (합성 레이어 이동만)
  const idle = gsap.to(qa('.s099__yr'), { xPercent: -6, yPercent: 3, duration: 5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  const lines = c => c.querySelectorAll('.ln>span');
  const rest = c => c.querySelectorAll('.s099__d,.s099__yr');
  chs.forEach((c, i) => { if (i) { gsap.set(lines(c), { yPercent: 115 }); gsap.set(rest(c), { autoAlpha: 0, y: 40 }); } });

  // 컬러 와이프 3종 (사선 → 원 확장 → 가로) 을 스크롤에 스크럽. 텍스트는 와이프 중간에 교체.
  const wipe = [
    ['polygon(0 0,0 0,-30% 100%,-30% 100%)', 'polygon(0 0,130% 0,100% 100%,-30% 100%)'],
    ['circle(0% at 0% 100%)', 'circle(150% at 0% 100%)'],
    ['inset(0 0 0 100%)', 'inset(0 0 0 0%)']
  ];
  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: root, start: 'top top', end: () => '+=' + innerHeight * 3.4, pin: true, scrub: 1, anticipatePin: 1 } });
  tl.to(fill, { scaleX: 1, duration: 4, ease: 'none' }, 0);
  for (let k = 0; k < 3; k++) {
    const t = k * 1.3 + .3;
    tl.fromTo(bgs[k], { clipPath: wipe[k][0] }, { clipPath: wipe[k][1], duration: 1, ease: 'power3.inOut' }, t)
      .to(lines(chs[k]), { yPercent: -115, duration: .45, stagger: .05, ease: 'power3.in' }, t)
      .to(rest(chs[k]), { autoAlpha: 0, y: -30, duration: .35, ease: 'power2.in' }, t)
      .to(lines(chs[k + 1]), { yPercent: 0, duration: .7, stagger: .08, ease: 'expo.out' }, t + .55)
      .to(rest(chs[k + 1]), { autoAlpha: 1, y: 0, duration: .6, stagger: .08, ease: 'expo.out' }, t + .7);
  }
  // 브랜드/레일 색을 배경 와이프에 맞춰 교체 (blend-mode 대신 값 트윈)
  const ui = [q('.s099__brand'), q('.s099__rail')], cs = ['#2a1a0e', '#fff1e0', '#e6f2d0', '#2a1a0e'];
  for (let k = 0; k < 3; k++) tl.to(ui, { color: cs[k + 1], duration: .3, ease: 'none' }, k * 1.3 + .6);
  tl.to({}, { duration: .1 });
  // 와이프 사이에 정지 구간이 생기도록 전체 길이를 맞춘다
  const st = tl.scrollTrigger;

  // 자동 데모: 입력이 멈추면 스토리를 천천히 자동 스크롤 (사용자가 만지면 즉시 포기)
  let last = performance.now(), auto = null;
  const poke = () => { last = performance.now(); if (auto) { auto.kill(); auto = null; } };
  addEventListener('wheel', poke, { passive: true }); addEventListener('touchstart', poke, { passive: true }); addEventListener('keydown', poke);
  const demo = setInterval(() => {
    const r = root.getBoundingClientRect();
    if (auto || performance.now() - last < 2400) return;
    if (r.top > innerHeight * .3 || r.bottom < innerHeight * .7) return;
    const from = Math.max(st.start, scrollY), to = st.end - 2, p = { y: from };
    const dur = Math.max(2, (to - from) / (innerHeight * .22));
    if (to - from < 20) { auto = { kill() { } }; lenis.scrollTo(st.start + 1, { duration: 2, force: true }); setTimeout(() => { auto = null; last = performance.now() - 1500; }, 2400); return; }
    auto = gsap.to(p, { y: to, duration: dur, ease: 'none', onUpdate: () => lenis.scrollTo(p.y, { immediate: true, force: true }), onComplete: () => { auto = null; last = performance.now() + 1500; } });
  }, 800);
  return () => { idle.kill(); clearInterval(demo); auto && auto.kill(); removeEventListener('wheel', poke); removeEventListener('touchstart', poke); removeEventListener('keydown', poke); tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); };
}
