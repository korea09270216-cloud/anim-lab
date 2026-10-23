export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const hero = q('.s094__hero'), art = q('.s094__art'), numw = q('.s094__numw'), num = q('.s094__num'), bar = q('.s094__bar');
  const lines = qa('.s094__h .ln>span'), meta = qa('.s094__top,.s094__nav a'), caps = qa('.s094__cap');

  // 롤링 숫자: 백/십/일 자리 컬럼. 일의 자리는 연속 롤, 십의 자리는 9→10 구간에서만 따라 굴러간다
  const mk = glyphs => {
    const d = document.createElement('div'); d.className = 's094__dg';
    const st = document.createElement('span'); st.className = 's094__st';
    st.innerHTML = glyphs.map(g => `<i>${g}</i>`).join(''); d.appendChild(st); num.appendChild(d);
    return { st, len: glyphs.length };
  };
  const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
  const H = mk(['&nbsp;', '1']), T = mk(digits), O = mk(digits);
  const put = (c, p) => gsap.set(c.st, { yPercent: -(p / c.len) * 100 });
  const o = { v: 0 };
  const upd = () => {
    const v = o.v, ones = v % 10, base = Math.floor(v / 10);
    put(O, ones);
    put(T, (base % 10) + Math.min(1, Math.max(0, ones - 9)));
    put(H, Math.min(1, Math.max(0, v - 99)));
  };
  upd();
  const stutter = CustomEase.create('s094n', 'M0,0 C0.18,0 0.12,0.32 0.3,0.38 0.48,0.44 0.52,0.78 0.72,0.88 0.85,0.95 0.9,1 1,1');

  const tl = gsap.timeline({ repeat: -1, delay: .4 });
  tl.fromTo(o, { v: 0 }, { v: 100, duration: 3, ease: stutter, onUpdate: upd }, 0)
    .fromTo(hero, { clipPath: 'inset(46% 41% 46% 41% round 6px)' }, { clipPath: 'inset(39% 35% 39% 35% round 6px)', duration: 3, ease: 'power1.inOut' }, 0)
    .fromTo(art, { scale: 1.9 }, { scale: 1.6, duration: 3, ease: 'power1.inOut' }, 0)
    .fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 3, ease: stutter }, 0)
    .to(numw, { yPercent: -115, duration: .9, ease: 'expo.in' }, 3.15)
    .to(caps, { autoAlpha: 0, duration: .6 }, 3.2)
    .to(bar, { scaleX: 0, transformOrigin: 'right', duration: .8, ease: 'expo.inOut' }, 3.15)
    .to(hero, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.7, ease: 'expo.inOut' }, 3.3)
    .to(art, { scale: 1, duration: 2.4, ease: 'expo.out' }, 3.3)
    .fromTo(lines, { yPercent: 115 }, { yPercent: 0, duration: 1.5, stagger: .12, ease: 'expo.out' }, 4.4)
    .fromTo(meta, { autoAlpha: 0, y: 18 }, { autoAlpha: 1, y: 0, stagger: .07, duration: 1, ease: 'expo.out' }, 4.7)
    .to({}, { duration: 3.4 })
    .to(lines, { yPercent: -115, duration: .8, stagger: .06, ease: 'expo.in' })
    .to(meta, { autoAlpha: 0, duration: .4 }, '<')
    .to(hero, { clipPath: 'inset(46% 41% 46% 41% round 6px)', duration: 1.3, ease: 'expo.inOut' }, '<.3')
    .to(art, { scale: 1.9, duration: 1.3, ease: 'expo.inOut' }, '<')
    .call(() => { o.v = 0; upd(); gsap.set(bar, { transformOrigin: 'left', scaleX: 0 }); gsap.set(caps, { autoAlpha: 1 }); }, null, '>-.3')
    .fromTo(numw, { yPercent: 115 }, { yPercent: 0, duration: 1, ease: 'expo.out' }, '>-.2');
  return () => tl.kill();
}
