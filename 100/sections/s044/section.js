export default function init(root, ctx) {
  const slides = [...root.querySelectorAll('.s044__slide')];
  const dots = [...root.querySelectorAll('.s044__dots button')];
  const stripe = root.querySelector('.s044__stripe');
  const countB = root.querySelector('.s044__count b');
  const SK = 30; // 사선 기울기(%)
  let idx = 0, busy = false, tl = null, timer = null;

  // 왼쪽 앵커 폴리곤: e = 사선 경계 위치(%)
  const left = e => `polygon(0 0,${e}% 0,${e - SK}% 100%,0 100%)`;
  const band = (a, b) => `polygon(${a}% 0,${b}% 0,${b - SK}% 100%,${a - SK}% 100%)`;

  const enter = s => {
    gsap.fromTo(s.querySelectorAll('.ln>span'), { xPercent: -105, skewX: 12 }, { xPercent: 0, skewX: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
    gsap.fromTo(s.querySelectorAll('.s044__kicker,.s044__sub'), { opacity: 0, x: -40 }, { opacity: s.querySelector('.s044__sub').style.opacity || .85, x: 0, duration: 1, ease: 'power4.out', stagger: .12, delay: .25 });
    gsap.fromTo(s.querySelectorAll('.s044__shape, .s044__shape i'), { scale: .7, rotate: -14, opacity: 0 }, { scale: 1, rotate: 0, opacity: 1, duration: 1.5, ease: 'expo.out', stagger: .06, delay: .15 });
  };
  gsap.set(root.querySelectorAll('.s044__sub'), { opacity: .85 });

  const go = n => {
    n = (n + slides.length) % slides.length;
    if (busy || n === idx) return;
    busy = true;
    const prev = slides[idx], next = slides[n];
    const o = { e: -30, s: -30 }; // e: 새 슬라이드 경계, s: 스트라이프 선행 경계
    stripe.style.background = getComputedStyle(next).getPropertyValue('--ac');
    next.classList.add('is-on'); next.style.zIndex = 2; prev.style.zIndex = 1;
    next.style.clipPath = left(-30);
    gsap.set(next.querySelectorAll('.ln>span'), { xPercent: -105 });
    gsap.set(next.querySelectorAll('.s044__kicker,.s044__sub,.s044__shape'), { opacity: 0 });
    const upd = () => { next.style.clipPath = left(o.e); stripe.style.clipPath = band(o.e, o.s); };
    tl = gsap.timeline({ onComplete: () => {
      prev.classList.remove('is-on'); prev.style.zIndex = ''; next.style.zIndex = ''; next.style.clipPath = ''; stripe.style.clipPath = band(-60, -60);
      busy = false; schedule();
    } });
    tl.to(o, { s: 135, duration: 1.15, ease: 'expo.inOut', onUpdate: upd }, 0);
    tl.to(o, { e: 135, duration: 1.15, ease: 'expo.inOut', onUpdate: upd }, .16);
    tl.add(() => enter(next), .55);
    dots.forEach((d, i) => d.classList.toggle('is-on', i === n));
    gsap.to({ v: idx + 1 }, { v: n + 1, duration: .6, onUpdate() { countB.textContent = String(Math.round(this.targets()[0].v)).padStart(2, '0'); } });
    idx = n;
  };
  const schedule = () => { timer && timer.kill(); timer = gsap.delayedCall(3.2, () => go(idx + 1)); };

  const onClick = () => { timer && timer.kill(); go(idx + 1); };
  root.addEventListener('click', onClick);
  const ds = dots.map((d, i) => { const f = e => { e.stopPropagation(); go(i); }; d.addEventListener('click', f); return [d, f]; });
  enter(slides[0]);
  schedule();
  return () => { timer && timer.kill(); tl && tl.kill(); root.removeEventListener('click', onClick); ds.forEach(([d, f]) => d.removeEventListener('click', f)); gsap.killTweensOf(root.querySelectorAll('*')); };
}
