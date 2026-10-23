export default function init(root, ctx) {
  const q = s => [...root.querySelectorAll(s)];
  const st = k => q(`[data-st="${k}"]`).flatMap(e => e.tagName === 'g' ? [...e.children] : [e]);
  const i = st('i'), b = st('b'), dots = st('dots'), n = st('n'), t = st('t'), sc = st('sc'), c = st('c'), s = st('s'), x = st('x');
  const strokes = [...i, ...b, ...n, ...t.filter(e => !e.dataset.accent || true), ...c, ...s, ...x];
  const fills = q('[data-fill]').flatMap(e => e.tagName === 'g' ? [...e.children] : [e]);
  const steps = q('.s051__steps li');
  const prog = root.querySelector('.s051__prog i');

  // 초기 상태
  gsap.set(strokes, { drawSVG: '0%' });
  gsap.set(dots, { scale: 0, transformOrigin: '50% 50%' });
  gsap.set(sc, { scale: 0, transformOrigin: '50% 50%' });
  fills.forEach(e => { e.style.fill = e.dataset.fill || e.parentNode.dataset.fill; });
  gsap.set(fills, { fillOpacity: 0 });
  q('[data-accent]').forEach(e => (e.style.stroke = '#d6402b'));

  // 시간 기반 인트로 (스크롤 없이도 그려진다)
  const introTl = gsap.timeline({ scrollTrigger: { trigger: root, start: 'top 85%', once: true } });
  introTl.to(i, { drawSVG: '100%', duration: 2.2, ease: 'expo.inOut', stagger: .18 })
    .to(i.filter(e => e.dataset.fill), { fillOpacity: 1, duration: 1.2, ease: 'power3.out', stagger: .2 }, '-=.9');

  // 스크롤 스크럽: 문양 → 면 → 토핑 → 젓가락 → 김 → 채색
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: root, start: 'top top', end: 'bottom bottom', scrub: .8,
      onUpdate(self) {
        const p = self.progress;
        const idx = p < .22 ? 0 : p < .5 ? 1 : p < .74 ? 2 : 3;
        steps.forEach((li, k) => li.classList.toggle('is-on', k === idx));
        gsap.set(prog, { scaleX: p });
      }
    }
  });
  tl.to(b, { drawSVG: '100%', duration: 1.2, stagger: .2 }, 0)
    .to(dots, { scale: 1, duration: .6, stagger: .08, ease: 'back.out(2)' }, .8)
    .to(n.filter(e => !e.dataset.fill), { drawSVG: '100%', duration: 1.6, stagger: .22, ease: 'power2.inOut' }, 1.8)
    .to(n.filter(e => e.dataset.fill), { drawSVG: '100%', duration: 1.2 }, 1.6)
    .to(t, { drawSVG: '100%', duration: 1.4, stagger: .22, ease: 'power2.inOut' }, 3.6)
    .to(sc, { scale: 1, duration: .5, stagger: .1 }, 5.2)
    .to(c, { drawSVG: '100%', duration: 1.4, stagger: .3, ease: 'power3.out' }, 5.4)
    .to(s, { drawSVG: '100%', duration: 1.8, stagger: .35, ease: 'power1.inOut' }, 6.8)
    .to(x, { drawSVG: '100%', duration: .8, stagger: .15 }, 7.6)
    .to(fills.filter(e => !i.includes(e)), { fillOpacity: 1, duration: 1.4, stagger: .12, ease: 'power2.out' }, 8.2)
    .to(root.querySelector('.s051__title em'), { color: '#1d1a17', duration: 1 }, 9)
    .to({}, { duration: .6 });

  // 아이들: 김이 계속 흔들리고, 인장은 계속 돈다
  const seal = gsap.to(root.querySelector('.s051__rot'), { rotation: 360, svgOrigin: '100 100', duration: 26, ease: 'none', repeat: -1 });
  const steam = gsap.to(s, { y: -9, opacity: .55, duration: 2.6, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: { each: .5, from: 'start' } });
  const spark = gsap.to(x, { rotation: 90, duration: 4, ease: 'sine.inOut', yoyo: true, repeat: -1, stagger: .4, transformOrigin: '50% 50%' });

  return () => { introTl.kill(); tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); seal.kill(); steam.kill(); spark.kill(); };
}
