export default function init(root, ctx) {
  const $$ = s => [...root.querySelectorAll(s)];
  const spans = $$('.a');
  const turb = root.querySelector('.s054__turb');
  const all = spans.map(s => [...s.querySelectorAll('path')]);
  gsap.set(all.flat(), { drawSVG: '0%' });

  // 스크롤 스크럽: 낙서가 읽는 순서대로 그려진다
  const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: .7 } });
  const dur = { strike: .8, circle: 1.1, under: 1, marker: 1.2, star: 1.2 };
  spans.forEach((s, i) => {
    const k = s.dataset.k, ps = all[i];
    tl.to(ps, { drawSVG: '100%', duration: dur[k], ease: k === 'marker' ? 'none' : 'power2.inOut', stagger: k === 'star' ? .35 : .22 }, i * 1.15 + .1);
  });
  tl.to({}, { duration: .5 });

  // 선이 살아있는 듯 떨리는 "라인 보일" — 시간 기반 아이들 모션
  let seed = 1;
  const boil = gsap.delayedCall(.12, function tick() { seed = seed % 9 + 1; turb.setAttribute('seed', seed); boil.restart(true); });

  // 호버하면 해당 낙서를 다시 한 번 그린다
  const offs = spans.map((s, i) => {
    const f = () => { if (tl.scrollTrigger.progress < (i + 1) / 5.4) return; gsap.fromTo(all[i], { drawSVG: '0%' }, { drawSVG: '100%', duration: .9, ease: 'expo.out', stagger: .12, overwrite: 'auto' }); };
    s.addEventListener('pointerenter', f); return () => s.removeEventListener('pointerenter', f);
  });

  return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); boil.kill(); offs.forEach(f => f()); };
}
