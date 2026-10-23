export default function init(root, ctx) {
  const btn = root.querySelector('.s047__btn');
  const bt = root.querySelector('.s047__bt');
  const ov = root.querySelector('.s047__ov');
  const p1 = root.querySelector('.s047__p1'), p2 = root.querySelector('.s047__p2');
  const links = root.querySelector('.s047__links');
  const lis = [...links.children];
  const ms = lis.map(li => li.querySelector('.s047__m>span'));
  const ns = lis.map(li => li.querySelector('.s047__n'));
  const pv = [...root.querySelectorAll('.s047__pv i')];
  const info = root.querySelector('.s047__info');
  const heroT = root.querySelector('.s047__hero');
  const ease = CustomEase.create('s047', 'M0,0 C0.76,0 0.24,1 1,1');
  let isOpen = false, busy = false, tl = null, timer = null, hotTimer = null, hot = -1, auto = true;

  const setHot = i => {
    if (i === hot) return;
    hot = i;
    lis.forEach((li, k) => li.classList.toggle('is-hot', k === i));
    links.classList.toggle('hot', i >= 0);
    pv.forEach((v, k) => gsap.to(v, { opacity: k === i ? 1 : 0, scale: k === i ? 1 : 1.12, duration: .8, ease: 'expo.out', overwrite: true }));
  };
  const autoHot = () => {
    let i = 0; setHot(0);
    hotTimer = gsap.delayedCall(.85, function again() { i = (i + 1) % lis.length; setHot(i); hotTimer = gsap.delayedCall(.85, again); });
  };

  const open = () => {
    if (busy || isOpen) return; busy = true; isOpen = true;
    btn.classList.add('is-x'); bt.textContent = 'CLOSE'; gsap.delayedCall(.35, () => isOpen && root.classList.add('is-menu'));
    ov.classList.add('is-on'); gsap.set(ov, { visibility: 'visible' });
    tl && tl.kill();
    tl = gsap.timeline({ onComplete: () => { busy = false; if (auto) { autoHot(); schedule(); } } });
    tl.fromTo(p1, { yPercent: -100 }, { yPercent: 0, duration: 1, ease }, 0);
    tl.fromTo(p2, { yPercent: 100 }, { yPercent: 0, duration: 1, ease }, .08);
    tl.fromTo(ms, { yPercent: 115, rotate: 4 }, { yPercent: 0, rotate: 0, duration: 1.1, ease: 'expo.out', stagger: .08 }, .55);
    tl.fromTo(ns, { opacity: 0, x: -14 }, { opacity: 1, x: 0, duration: .8, ease: 'power3.out', stagger: .08 }, .7);
    tl.fromTo(info, { opacity: 0, y: 20 }, { opacity: .9, y: 0, duration: .9, ease: 'power3.out' }, .9);
    tl.to(heroT, { scale: .94, opacity: .6, duration: 1, ease }, 0);
  };
  const close = () => {
    if (busy || !isOpen) return; busy = true; isOpen = false;
    hotTimer && hotTimer.kill(); setHot(-1);
    btn.classList.remove('is-x'); bt.textContent = 'MENU'; gsap.delayedCall(.5, () => !isOpen && root.classList.remove('is-menu'));
    tl && tl.kill();
    tl = gsap.timeline({ onComplete: () => { gsap.set(ov, { visibility: 'hidden' }); ov.classList.remove('is-on'); busy = false; if (auto) schedule(); } });
    tl.to(ms, { yPercent: -115, duration: .55, ease: 'power3.in', stagger: .04 }, 0);
    tl.to(p1, { yPercent: -100, duration: .9, ease }, .25);
    tl.to(p2, { yPercent: 100, duration: .9, ease }, .2);
    tl.to(heroT, { scale: 1, opacity: 1, duration: .9, ease }, .25);
  };
  const toggle = () => (isOpen ? close() : open());
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(isOpen ? 4.4 : 1.8, toggle); };

  const onBtn = () => { auto = false; timer && timer.kill(); hotTimer && hotTimer.kill(); toggle(); };
  btn.addEventListener('click', onBtn);
  const hs = lis.map((li, i) => { const f = () => { auto = false; timer && timer.kill(); hotTimer && hotTimer.kill(); setHot(i); }; li.addEventListener('pointerenter', f); return [li, f]; });
  gsap.set([p1, p2], { yPercent: 0 });
  gsap.set(ov, { visibility: 'hidden' });
  gsap.set(p1, { yPercent: -100 }); gsap.set(p2, { yPercent: 100 });
  schedule();
  return () => { timer && timer.kill(); hotTimer && hotTimer.kill(); tl && tl.kill(); btn.removeEventListener('click', onBtn); hs.forEach(([l, f]) => l.removeEventListener('pointerenter', f)); gsap.killTweensOf(root.querySelectorAll('*')); };
}
