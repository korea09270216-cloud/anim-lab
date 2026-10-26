// 스티키 그리드: 스크롤은 장면이 아니라 "메인 타임라인의 시간"을 진행한다.
// 메인 tl(scrub) 이 5개 위상(정렬 → 흩어짐 → 링 → 부채꼴 → 컨택트시트)을 순서대로 호출하고,
// 각 위상은 이전 상태/다음 상태를 명시한 fromTo 라 어느 지점으로 점프해도 같은 장면이 나온다.
export default function init(root, ctx) {
  const pin = root.querySelector('.s140__pin');
  const grid = root.querySelector('.s140__grid');
  const tiles = [...grid.children];
  const caps = [...root.querySelectorAll('.s140__cap')];
  const cta = root.querySelector('.s140__cta');
  const rail = root.querySelector('.s140__rail i');
  const N = tiles.length;
  const rand = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(5);
  const scat = tiles.map(() => ({ x: rand() * 2 - 1, y: rand() * 2 - 1, r: (rand() * 2 - 1) * 48, s: .72 + rand() * .55 }));
  let home = [], W = 0, H = 0, tw = 0, th = 0;

  const layout = () => {
    W = innerWidth; H = innerHeight;
    const gw = grid.clientWidth, gh = grid.clientHeight;
    tw = tiles[0].offsetWidth; th = tiles[0].offsetHeight;
    home = tiles.map(t => ({ x: t.offsetLeft - grid.offsetLeft + t.offsetWidth / 2 - gw / 2, y: t.offsetTop - grid.offsetTop + t.offsetHeight / 2 - gh / 2 }));
  };
  layout();

  // 위상별 목표 상태(그리드 중심 기준 절대 좌표 → 타일 자연 위치에 대한 상대 좌표로 환산)
  const abs = (k, i) => {
    switch (k) {
      case 0: return { x: home[i].x, y: home[i].y, r: 0, s: 1, z: 1 };
      case 1: return { x: scat[i].x * W * .34, y: scat[i].y * H * .3, r: scat[i].r, s: scat[i].s, z: 1 + (i % 5) };
      case 2: { const a = i / N * Math.PI * 2 - Math.PI / 2; return { x: Math.cos(a) * Math.min(W * .3, 500), y: Math.sin(a) * H * .31, r: a * 180 / Math.PI + 90, s: .5, z: 1 }; }
      case 3: { const u = (i - (N - 1) / 2) / ((N - 1) / 2); return { x: u * W * .34, y: u * u * H * .15 - H * .04, r: u * 30, s: .84, z: 1 + i }; }
      default: { const s = .9, sx = tw * s + 12, sy = th * s + 12, c = i % 6, r = Math.floor(i / 6); return { x: (c - 2.5) * sx, y: (r - .5) * sy, r: 0, s, z: 1 }; }
    }
  };
  const rel = (k, i, p) => { const a = abs(k, i); return p === 'x' ? a.x - home[i].x : p === 'y' ? a.y - home[i].y : p === 'r' ? a.r : p === 's' ? a.s : a.z; };
  const st = k => ({ x: i => rel(k, i, 'x'), y: i => rel(k, i, 'y'), rotation: i => rel(k, i, 'r'), scale: i => rel(k, i, 's'), zIndex: i => rel(k, i, 'z') });

  gsap.set(tiles, st(0));
  gsap.set(caps.slice(1), { autoAlpha: 0, y: 14 });

  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: root.querySelector('.s140__stage'), start: 'top top', end: 'bottom bottom', scrub: .7, invalidateOnRefresh: true }
  });
  const eases = ['expo.inOut', 'power4.inOut', 'expo.inOut', 'power4.inOut'];
  const T = [.5, 1.5, 2.5, 3.5];
  T.forEach((t, k) => {
    tl.fromTo(tiles, st(k), { ...st(k + 1), duration: .66, ease: eases[k], stagger: { each: .03, from: k % 2 ? 'edges' : 'center' }, immediateRender: false }, t);
    tl.to(caps[k], { autoAlpha: 0, y: -14, duration: .22, ease: 'power2.in' }, t - .02);
    tl.fromTo(caps[k + 1], { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .3, ease: 'power3.out', immediateRender: false }, t + .12);
  });
  tl.fromTo(cta, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: .35, ease: 'power3.out', immediateRender: false }, 4.55);
  tl.fromTo(rail, { scaleX: 0 }, { scaleX: 1, duration: 5, ease: 'none' }, 0);
  tl.to({}, { duration: 5 }, 0);

  const onRefresh = () => layout();
  ScrollTrigger.addEventListener('refreshInit', onRefresh);
  const io = new IntersectionObserver(e => {
    const st2 = e[0].isIntersecting ? '' : 'paused';
    tiles.forEach(t => { t.firstElementChild.style.animationPlayState = st2; });
  }, { threshold: 0 });
  io.observe(root);

  return () => {
    io.disconnect();
    ScrollTrigger.removeEventListener('refreshInit', onRefresh);
    tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill();
    gsap.set([...tiles, ...caps, cta, rail], { clearProps: 'all' });
  };
}
