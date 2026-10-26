export default function init(root, ctx) {
  // 이음매 없는 무한 순환: 패널 N 장의 y 를 (스크롤 mod N·vh) 로 배치하고,
  // 스크롤 위치가 한 주기(P=N·vh)를 넘으면 Lenis 를 한 주기만큼 즉시 되돌린다 → 화면은 동일해서 점프가 안 보인다.
  const panels = [...root.querySelectorAll('.s143__p')];
  const N = panels.length;
  const cntEl = root.querySelector('.s143__cnt');
  const L = panels.map(p => ({
    bg: p.querySelector('.s143__bg'), num: p.querySelector('.s143__num'),
    body: p.querySelector('.s143__body'), fg: p.querySelector('.s143__fg')
  }));
  let top = 0, vh = innerHeight, P = N * vh, looped = false, loops = 0, drift = 0, vis = true;
  const measure = () => { vh = innerHeight; P = N * vh; top = root.getBoundingClientRect().top + scrollY; };
  measure();
  const onResize = () => measure();
  addEventListener('resize', onResize);
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; });
  io.observe(root);

  const jump = (dy) => {
    const y = scrollY + dy;
    if (ctx.lenis) ctx.lenis.scrollTo(y, { immediate: true, force: true }); else scrollTo(0, y);
  };
  const mod = (a, n) => ((a % n) + n) % n;

  const off = ctx.tick((time, dt) => {
    if (!vis) return;
    drift += (dt || 16) * .045 * (ctx.reduced ? .3 : 1);        // idle: 천천히 흘러가는 환경 드리프트
    let local = scrollY - top;
    if (local > 2 * P) { jump(-P); local -= P; looped = true; loops++; cntEl.textContent = loops; }
    else if (looped && local < .75 * P) { jump(P); local += P; loops = Math.max(0, loops - 1); cntEl.textContent = loops; }
    const s = local + drift;
    for (let i = 0; i < N; i++) {
      const y = mod(i * vh - s + vh, P) - vh;                    // [-vh, (N-1)·vh)
      const o = y / vh;                                           // 화면 중심 대비 -1 ~ 1 (넘어가면 화면 밖)
      if (o > 1.05 || o < -1.05) { panels[i].style.visibility = 'hidden'; continue; }
      panels[i].style.visibility = 'visible';
      gsap.set(panels[i], { y });
      // 레이어별 속도 차 — 패널이 올라가는 동안 각 레이어가 다른 비율로 어긋난다
      gsap.set(L[i].bg, { y: o * vh * .42, scale: 1 + o * .06 });
      gsap.set(L[i].num, { y: o * vh * .22, x: o * -vw() * .06 });
      gsap.set(L[i].body, { y: o * vh * -.10 });
      gsap.set(L[i].fg, { y: o * vh * -.34 });
    }
  });
  function vw() { return innerWidth; }

  return () => { off(); io.disconnect(); removeEventListener('resize', onResize); };
}
