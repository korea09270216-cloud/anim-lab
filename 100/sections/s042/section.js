export default function init(root, ctx) {
  const list = root.querySelector('.s042__list');
  const items = [...list.children];
  const btns = [...root.querySelectorAll('.s042__tog button')];
  const pill = root.querySelector('.s042__pill');
  const ease = CustomEase.create('s042', 'M0,0 C0.83,0 0.17,1 1,1');
  let mode = 'grid', timer = null, busy = false, flip = null;

  const movePill = (animate) => {
    const b = btns.find(x => x.classList.contains('is-on'));
    const vars = { x: b.offsetLeft - 5, width: b.offsetWidth };
    animate ? gsap.to(pill, { ...vars, duration: .7, ease: 'expo.out' }) : gsap.set(pill, vars);
  };

  const set = (m) => {
    if (m === mode || busy) return;
    busy = true;
    const texts = items.flatMap(i => [...i.querySelectorAll('.s042__tx > *, .s042__pr')]);
    const state = Flip.getState([...items, ...items.map(i => i.querySelector('.s042__sw'))]);
    mode = m;
    list.classList.toggle('is-list', m === 'list');
    btns.forEach(b => b.classList.toggle('is-on', b.dataset.v === m));
    movePill(true);
    gsap.set(texts, { opacity: 0 });
    flip = Flip.from(state, {
      duration: 1.15, ease, stagger: { each: .045, from: m === 'list' ? 'start' : 'end' }, nested: false, simple: false,
      onComplete: () => { busy = false; schedule(); }
    });
    gsap.fromTo(texts, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .8, ease: 'power4.out', stagger: .02, delay: .65 });
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(2.6, () => set(mode === 'grid' ? 'list' : 'grid')); };

  const hs = btns.map(b => { const f = () => { timer && timer.kill(); set(b.dataset.v); }; b.addEventListener('click', f); return [b, f]; });
  movePill(false);
  gsap.from(items, { opacity: 0, y: 40, duration: 1.1, ease: 'expo.out', stagger: .06, scrollTrigger: { trigger: root, start: 'top 80%' } });
  schedule();
  return () => { timer && timer.kill(); flip && flip.kill(); hs.forEach(([b, f]) => b.removeEventListener('click', f)); gsap.killTweensOf(items); };
}
