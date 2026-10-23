export default function init(root, ctx) {
  const stage = root.querySelector('.s046__stage');
  const tabs = [...root.querySelectorAll('.s046__tabs button')];
  const ind = root.querySelector('.s046__ind');
  const tpls = [...stage.querySelectorAll('template')];
  const N = 8;
  const ease = CustomEase.create('s046', 'M0,0 C0.85,0 0.15,1 1,1');
  let idx = 0, busy = false, layer = null, tl = null, timer = null;

  const build = i => {
    const L = document.createElement('div'); L.className = 's046__layer';
    for (let k = 0; k < N; k++) {
      const s = document.createElement('div'); s.className = 's046__slice';
      s.style.clipPath = `inset(${(k / N * 100).toFixed(3)}% 0 ${((N - k - 1) / N * 100).toFixed(3)}% 0)`;
      s.appendChild(tpls[i].content.firstElementChild.cloneNode(true));
      L.appendChild(s);
    }
    stage.appendChild(L);
    return L;
  };
  const moveInd = (n, animate) => {
    const b = tabs[n], y = b.offsetTop + b.offsetHeight - 3;
    animate ? gsap.to(ind, { y, duration: .9, ease: 'expo.out', overwrite: true }) : gsap.set(ind, { y });
  };

  const go = n => {
    n = (n + tpls.length) % tpls.length;
    if (busy || n === idx) return;
    busy = true;
    const old = layer, fresh = build(n);
    const os = [...old.children], ns = [...fresh.children];
    const dir = n > idx ? 1 : -1;
    tabs.forEach((b, i) => b.classList.toggle('is-on', i === n));
    moveInd(n, true);
    tl = gsap.timeline({ onComplete: () => { old.remove(); layer = fresh; idx = n; busy = false; schedule(); } });
    gsap.set(ns, { xPercent: i => (i % 2 ? -1 : 1) * 105 * dir });
    tl.to(os, { xPercent: i => (i % 2 ? 1 : -1) * 105 * dir, duration: 1.05, ease, stagger: { each: .055, from: dir > 0 ? 'start' : 'end' } }, 0);
    tl.to(ns, { xPercent: 0, duration: 1.05, ease, stagger: { each: .055, from: dir > 0 ? 'start' : 'end' } }, .12);
    tl.fromTo(ns.map(s => s.querySelector('.s046__art')), { rotate: 8 * dir, scale: .92 }, { rotate: 0, scale: 1, duration: 1.4, ease: 'expo.out' }, .3);
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(2.4, () => go(idx + 1)); };

  layer = build(0);
  moveInd(0, false);
  const hs = tabs.map((b, i) => { const f = () => { timer && timer.kill(); go(i); }; b.addEventListener('click', f); return [b, f]; });
  schedule();
  return () => { timer && timer.kill(); tl && tl.kill(); hs.forEach(([b, f]) => b.removeEventListener('click', f)); gsap.killTweensOf(root.querySelectorAll('*')); };
}
