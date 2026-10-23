// 계약: export default function(root, ctx) — root=[data-sec], ctx={mouse,lenis,reduced,fine,tick}. 전역 gsap/ScrollTrigger/THREE/Matter 사용 가능. cleanup 함수 반환(선택).
export default function (root, ctx) {
  const spans = [...root.querySelectorAll('span')];
  const offs = spans.map(s => {
    const a = s.parentElement;
    const over = () => gsap.to(s, { yPercent: -100, duration: .6, ease: 'expo.out' });
    const out = () => gsap.to(s, { yPercent: 0, duration: .6, ease: 'expo.out' });
    a.addEventListener('pointerenter', over); a.addEventListener('pointerleave', out);
    return () => { a.removeEventListener('pointerenter', over); a.removeEventListener('pointerleave', out); };
  });
  // 스크롤 진입 + 데모용 자동 롤링(마우스 없는 환경에서도 움직임이 보이게)
  gsap.from(spans, { yPercent: 110, stagger: .12, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%' } });
  const tl = gsap.timeline({ repeat: -1, repeatDelay: .8, delay: 1.5 });
  spans.forEach(s => tl.to(s, { yPercent: -100, duration: .6, ease: 'expo.out' }).to(s, { yPercent: 0, duration: .6, ease: 'expo.out' }, '+=.6'));
  return () => { offs.forEach(f => f()); tl.kill(); };
}
