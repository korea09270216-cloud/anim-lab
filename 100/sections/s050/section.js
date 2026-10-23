export default function init(root, ctx) {
  const row = root.querySelector('.s050__row');
  const ps = [...row.children];
  const ease = CustomEase.create('s050', 'M0,0 C0.8,0 0.12,1 1,1');
  let cur = 0, timer = null, hoverOff = null, tl = null, hovering = false;

  const lab = p => p.querySelector('.s050__lab');
  const body = p => p.querySelector('.s050__body');

  const activate = (n, first) => {
    if (n === cur && !first) return;
    const old = ps[cur], next = ps[n];
    cur = n;
    tl && tl.kill();
    ps.forEach((p, i) => p.classList.toggle('is-on', i === n));
    tl = gsap.timeline();
    tl.to(ps, { flexGrow: (i) => (i === n ? 5.6 : 1), duration: first ? 0 : 1.15, ease }, 0);
    tl.to(lab(old), { opacity: 1, yPercent: 0, duration: .5, ease: 'power3.out' }, .2);
    tl.to(body(old), { opacity: 0, y: 20, duration: .3, ease: 'power2.in', onComplete: () => gsap.set(body(old), { visibility: 'hidden' }) }, 0);
    tl.to(lab(next), { opacity: 0, yPercent: 30, duration: .3, ease: 'power2.in' }, 0);
    tl.set(body(next), { visibility: 'visible' }, .4);
    const items = body(next).querySelectorAll('h3,p,li');
    tl.fromTo(items, { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .07 }, .45);
    tl.fromTo(body(next), { opacity: 0 }, { opacity: 1, duration: .1 }, .4);
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(2.2, () => { if (!hovering) activate((cur + 1) % ps.length); schedule(); }); };

  // 접힌 패널은 창문처럼: art 가 패널의 화면 위치에 고정된 것처럼 보이도록 left 보정
  const off = ctx.tick(() => {
    const rr = row.getBoundingClientRect();
    ps.forEach(p => {
      const r = p.getBoundingClientRect();
      p.firstElementChild.style.transform = `translate3d(${(rr.left - r.left).toFixed(1)}px,0,0)`;
    });
  });

  const hs = ps.map((p, i) => {
    const en = () => { hovering = true; activate(i); };
    const lv = () => { hovering = false; schedule(); };
    p.addEventListener('pointerenter', en); p.addEventListener('pointerleave', lv); p.addEventListener('click', en);
    return [p, en, lv];
  });
  gsap.set(ps, { flexGrow: 1 });
  ps.forEach((p, i) => { gsap.set(body(p), { visibility: 'hidden', opacity: 0 }); });
  activate(0, true);
  gsap.set(body(ps[0]), { visibility: 'visible', opacity: 1 }); gsap.set(lab(ps[0]), { opacity: 0 });
  gsap.set(ps[0], { flexGrow: 5.6 });
  gsap.from(ps, { yPercent: 14, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: root, start: 'top 80%' } });
  schedule();
  return () => { timer && timer.kill(); tl && tl.kill(); off && off(); hs.forEach(([p, en, lv]) => { p.removeEventListener('pointerenter', en); p.removeEventListener('pointerleave', lv); p.removeEventListener('click', en); }); gsap.killTweensOf(root.querySelectorAll('*')); };
}
