export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const L = q('.s095__door--l'), R = q('.s095__door--r'), shade = qa('.s095__sh'), scene = q('.s095__scene'), moon = q('.s095__moon');
  const sp = new SplitText(q('.s095__h'), { type: 'chars' });
  const parts = qa('.s095__eyebrow,.s095__p,.s095__cta');
  const door = CustomEase.create('s095d', 'M0,0 C0.78,0 0.18,1 1,1');
  gsap.set(sp.chars, { yPercent: 120 });
  gsap.set(parts, { autoAlpha: 0, y: 22 });

  // 열림 → 머무름 → 닫힘 무한 루프. 문은 바깥 모서리를 축으로 안쪽으로 회전
  const tl = gsap.timeline({ repeat: -1, delay: 1.1 });
  tl.fromTo(L, { rotateY: 0 }, { rotateY: 104, duration: 2.3, ease: door }, 0)
    .fromTo(R, { rotateY: 0 }, { rotateY: -104, duration: 2.3, ease: door }, 0)
    .fromTo(shade, { opacity: 0 }, { opacity: .8, duration: 2.3, ease: door }, 0)
    .fromTo(scene, { scale: 1.2 }, { scale: 1, duration: 3, ease: 'expo.out' }, 0)
    .fromTo(moon, { yPercent: 28, scale: .7 }, { yPercent: 0, scale: 1, duration: 2.8, ease: 'expo.out' }, .2)
    .to(sp.chars, { yPercent: 0, duration: 1.5, stagger: { each: .09, from: 'center' }, ease: 'expo.out' }, 1.05)
    .to(parts, { autoAlpha: 1, y: 0, duration: 1.1, stagger: .14, ease: 'expo.out' }, 1.7)
    .to({}, { duration: 3.4 })
    .to(parts, { autoAlpha: 0, y: -14, duration: .5, stagger: .05, ease: 'power3.in' })
    .to(sp.chars, { yPercent: -120, duration: .7, stagger: { each: .05, from: 'edges' }, ease: 'expo.in' }, '<')
    .to([L, R], { rotateY: 0, duration: 1.7, ease: door }, '<.2')
    .to(shade, { opacity: 0, duration: 1.7, ease: door }, '<')
    .set(sp.chars, { yPercent: 120 })
    .to({}, { duration: .9 });
  // 포인터가 있으면 달이 살짝 따라온다 (idle 에서는 CSS 호흡)
  const off = ctx.tick(() => {
    gsap.to(moon, { x: (ctx.mouse.nx - .5) * 36, duration: 1.2, ease: 'power3.out', overwrite: 'auto' });
  });
  return () => { off(); tl.kill(); sp.revert(); };
}
