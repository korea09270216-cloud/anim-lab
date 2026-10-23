export default function init(root, ctx) {
  const pages = [...root.querySelectorAll('.s041__page')];
  const btns = [...root.querySelectorAll('.s041__nav button')];
  const cur = root.querySelector('.s041__curtain');
  const label = root.querySelector('.s041__label');
  const nextBtn = root.querySelector('.s041__next');
  const names = ['SINGLE ORIGIN', 'BLEND LAB', 'COLD BREW'];
  const panels = Array.from({ length: 8 }, () => cur.appendChild(document.createElement('i')));
  const ease = CustomEase.create('s041', 'M0,0 C0.87,0 0.13,1 1,1');
  let idx = 0, busy = false, tl = null, timer = null;

  const enter = p => {
    gsap.fromTo(p.querySelectorAll('.ln>span'), { yPercent: 118 }, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
    gsap.fromTo(p.querySelectorAll('.fx'), { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.1, ease: 'power4.out', stagger: .08, delay: .2 });
    gsap.fromTo(p.querySelector('.s041__art'), { scale: .8, rotate: -10 }, { scale: 1, rotate: 0, duration: 1.8, ease: 'expo.out' });
    gsap.fromTo(p.querySelectorAll('.s041__art i'), { scale: .6, opacity: 0 }, { scale: 1, opacity: 1, duration: 1.2, ease: 'expo.out', stagger: .08 });
  };

  const go = n => {
    n = (n + pages.length) % pages.length;
    if (busy || n === idx) return;
    busy = true;
    const next = pages[n], cs = getComputedStyle(next);
    const ac = cs.getPropertyValue('--ac').trim(), ink = cs.getPropertyValue('--ink').trim(), bg = cs.getPropertyValue('--bg').trim();
    label.textContent = String(n + 1).padStart(2, '0') + ' ' + names[n];
    label.style.color = bg;
    tl = gsap.timeline({ onComplete: () => { busy = false; schedule(); } });
    tl.set(panels, { transformOrigin: '50% 100%', scaleY: 0, backgroundColor: i => (i % 2 ? ac : ink) });
    tl.to(panels, { scaleY: 1, duration: .85, ease, stagger: { each: .06, from: 'center' } });
    tl.fromTo(label, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: .6, ease: 'expo.out' }, '<.35');
    tl.add(() => {
      pages[idx].classList.remove('is-on'); next.classList.add('is-on');
      gsap.set(next.querySelectorAll('.ln>span'), { yPercent: 118 });
      gsap.set(next.querySelectorAll('.fx'), { opacity: 0 });
      root.style.setProperty('--ink', ink); root.style.setProperty('--rbg', bg);
      btns.forEach((b, i) => b.classList.toggle('is-on', i === n));
      idx = n;
    }, '+=.25');
    tl.set(panels, { transformOrigin: '50% 0%' });
    tl.to(label, { opacity: 0, y: -40, duration: .45, ease: 'power3.in' }, '<');
    tl.to(panels, { scaleY: 0, duration: .85, ease, stagger: { each: .06, from: 'edges' } }, '<.1');
    tl.add(() => enter(next), '<.3');
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(3.6, () => go(idx + 1)); };

  const onNav = btns.map((b, i) => { const f = () => go(i); b.addEventListener('click', f); return [b, f]; });
  const onNext = () => go(idx + 1);
  nextBtn.addEventListener('click', onNext);
  enter(pages[0]);
  schedule();
  return () => {
    timer && timer.kill(); tl && tl.kill();
    onNav.forEach(([b, f]) => b.removeEventListener('click', f));
    nextBtn.removeEventListener('click', onNext);
    gsap.killTweensOf(root.querySelectorAll('*'));
  };
}
