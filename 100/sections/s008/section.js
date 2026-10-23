export default function init(root, ctx) {
  const stage = root.querySelector('.s008__stage');
  const N = 9;
  const layers = {};
  const slicesOf = {};
  const inners = [];
  const build = () => {
    const w = stage.clientWidth;
    inners.forEach(i => { i.style.width = w + 'px'; i.style.left = -i._k * (w / N) + 'px'; });
  };
  root.querySelectorAll('[data-slices]').forEach(layer => {
    const key = layer.className.match(/--(\w)\b/)[1];
    const art = layer.querySelector('.s008__art');
    layer.removeChild(art);
    slicesOf[key] = [];
    for (let k = 0; k < N; k++) {
      const sl = document.createElement('div'); sl.className = 's008__sl';
      sl.style.left = (k * 100 / N) + '%'; sl.style.width = (100 / N + .06) + '%';
      const inn = document.createElement('div'); inn.className = 's008__in'; inn._k = k;
      inn.appendChild(art.cloneNode(true));
      sl.appendChild(inn); layer.appendChild(sl);
      slicesOf[key].push({ sl, inn }); inners.push(inn);
    }
  });
  build();
  addEventListener('resize', build);
  const dots = [...root.querySelectorAll('.s008__dots li')];
  const c1 = [...root.querySelectorAll('.s008__c1 i')];
  gsap.set(c1, { yPercent: 105 });
  const tl = gsap.timeline({ defaults: { ease: 'none' } });
  // A → B : 교대로 위/아래로 빠짐, 가운데부터 퍼지는 스태거
  tl.to(slicesOf.a.map(o => o.sl), { yPercent: i => (i % 2 ? 101 : -101), duration: 1, ease: 'expo.inOut', stagger: { each: .09, from: 'center' } }, 0)
    .to(slicesOf.a.map(o => o.inn), { yPercent: i => (i % 2 ? -45 : 45), duration: 1, ease: 'expo.inOut', stagger: { each: .09, from: 'center' } }, 0)
    // B → C : 전부 위로, 왼쪽부터 순차. 안쪽은 반대로 끌려가는 시차
    .to(slicesOf.b.map(o => o.sl), { yPercent: -101, duration: 1, ease: 'power4.inOut', stagger: { each: .1, from: 'start' } }, 1.5)
    .to(slicesOf.b.map(o => o.inn), { yPercent: 55, duration: 1, ease: 'power4.inOut', stagger: { each: .1, from: 'start' } }, 1.5)
    .to(c1, { yPercent: 0, duration: .7, ease: 'expo.out', stagger: .12 }, 3.0)
    .to({}, { duration: .5 });
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', scrub: .6, animation: tl,
    onUpdate: s => { const k = s.progress < .33 ? 0 : s.progress < .72 ? 1 : 2; dots.forEach((d, i) => d.classList.toggle('on', i === k)); } });
  return () => { st.kill(); tl.kill(); removeEventListener('resize', build); };
}
