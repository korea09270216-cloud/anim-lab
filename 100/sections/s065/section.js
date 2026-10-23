export default function init(root, ctx) {
  CustomBounce.create('s065land', { strength: .55, squash: 2, squashID: 's065land-sq' });
  const cards = [...root.querySelectorAll('[data-card]')];
  const state = cards.map(el => ({ el, flip: el.querySelector('.s065__flip'), face: false, busy: null }));
  gsap.set(cards, { transformPerspective: 1600 });

  // 뒤집기: 들려 올라 → 회전 → 바운스 착지
  const flipTo = (s, face) => {
    if (s.face === face && !s.busy) return;
    s.face = face;
    s.busy && s.busy.kill();
    s.busy = gsap.timeline({ onComplete: () => { s.busy = null; } })
      .to(s.el, { y: -42, scale: 1.05, duration: .38, ease: 'power3.out' }, 0)
      .to(s.flip, { rotationY: face ? 180 : 0, duration: 1.05, ease: 'expo.inOut' }, 0)
      .to(s.el, { y: 0, scale: 1, duration: .9, ease: 's065land' }, .55);
  };

  // 포인터 틸트(카드 자체) — 뒤집기와 독립 축
  const tilts = state.map(s => ({ x: gsap.quickTo(s.el, 'rotationX', { duration: .7, ease: 'power3' }), y: gsap.quickTo(s.el, 'rotationY', { duration: .7, ease: 'power3' }) }));
  const handlers = state.map((s, i) => {
    const move = e => { const r = s.el.getBoundingClientRect(); tilts[i].y(((e.clientX - r.left) / r.width - .5) * 14); tilts[i].x(-((e.clientY - r.top) / r.height - .5) * 12); };
    const leave = () => { tilts[i].x(0); tilts[i].y(0); hover = false; };
    const enter = () => { hover = true; };
    const click = () => { userAt = performance.now(); flipTo(s, !s.face); };
    s.el.addEventListener('pointermove', move); s.el.addEventListener('pointerleave', leave); s.el.addEventListener('pointerenter', enter); s.el.addEventListener('click', click);
    return () => { s.el.removeEventListener('pointermove', move); s.el.removeEventListener('pointerleave', leave); s.el.removeEventListener('pointerenter', enter); s.el.removeEventListener('click', click); };
  });
  let hover = false, userAt = -1e9, vis = false, k = 0;
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .3 }); io.observe(root);

  // 자동 루프: 카드가 차례로 뒤집혔다가 돌아온다
  const iv = setInterval(() => {
    if (!vis || hover || performance.now() - userAt < 5000) return;
    const s = state[k++ % 3];
    flipTo(s, true);
    gsap.delayedCall(2.4, () => { if (!hover) flipTo(s, false); });
  }, 3600);

  // 배경 원 idle
  const bg = gsap.to(root.querySelectorAll('.s065__bg i'), { x: 'random(-30,30)', y: 'random(-24,24)', duration: 'random(4,6)', repeat: -1, yoyo: true, ease: 'sine.inOut', stagger: .6 });
  // 진입: 카드 3장이 뒤에서 일어서듯
  gsap.from(cards, { rotationX: -70, y: 120, autoAlpha: 0, duration: 1.4, ease: 'expo.out', stagger: .14, transformOrigin: '50% 100%', scrollTrigger: { trigger: root, start: 'top 65%', once: true } });

  return () => { clearInterval(iv); io.disconnect(); handlers.forEach(f => f()); bg.kill(); state.forEach(s => { s.busy && s.busy.kill(); }); gsap.killTweensOf(cards); };
}
