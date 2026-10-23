export default function init(root, ctx) {
  const hero = root.querySelector('.s048__hero');
  const inner = root.querySelector('.s048__inner');
  const count = root.querySelector('.s048__count');
  const load = root.querySelector('.s048__load');
  const cols = ['.c0', '.c1', '.c2'].map(c => root.querySelector('.s048__col' + c + ' > div'));
  const lines = root.querySelectorAll('.s048__title .l>span');
  const ease = CustomEase.create('s048', 'M0,0 C0.9,0 0.1,1 1,1');
  let tl = null, again = null;
  const last = [-1, -1, -1];

  const show = p => {
    p = Math.round(p);
    const d = [p >= 100 ? 1 : 0, Math.floor(p / 10) % 10, p % 10];
    d.forEach((v, i) => {
      if (v === last[i]) return;
      last[i] = v;
      gsap.to(cols[i], { yPercent: -v * (i === 0 ? 50 : 10), duration: .45, ease: 'expo.out', overwrite: true });
    });
  };
  const win = { p: 0 };
  const clip = h => { // h: 창 높이(%)  p=0 -> 얇은 선, p=100 -> 중간 카드
    const v = 49.6 - h * .31;
    hero.style.clipPath = `inset(${v}% ${36 - h * .08}% ${v}% ${36 - h * .08}% round 4px)`;
  };

  const play = () => {
    tl && tl.kill();
    last.fill(-1); show(0); win.p = 0; clip(0);
    gsap.set(count, { opacity: 1, yPercent: 0, color: '#f7efe6' });
    gsap.set(load, { opacity: 1 });
    gsap.set(lines, { yPercent: 118 });
    gsap.set(inner, { scale: 1.18, x: () => -root.clientWidth * .25, transformOrigin: '50% 50%' });
    gsap.set(root.querySelectorAll('.s048__sub,.s048__cta,.s048__nav'), { opacity: 0, y: 24 });
    gsap.set(root.querySelector('.s048__cone'), { y: 0, opacity: 1, rotate: 0 });
    tl = gsap.timeline({ onComplete: () => { again = gsap.delayedCall(2.4, play); } });
    const prog = { v: 0 };
    const upd = () => { show(prog.v); win.p = prog.v; clip(prog.v); };
    tl.to(prog, { v: 34, duration: .8, ease: 'power3.out', onUpdate: upd }, .2);
    tl.to(prog, { v: 71, duration: .9, ease: 'power2.inOut', onUpdate: upd }, '+=.25');
    tl.to(prog, { v: 100, duration: .7, ease: 'power4.out', onUpdate: upd }, '+=.1');
    // 100% -> 창이 전체 화면으로 팽창
    const open = { t: 0 };
    tl.to(open, {
      t: 1, duration: 1.25, ease,
      onUpdate: () => {
        const t = open.t;
        const v = 18.6 * (1 - t), h = 28 * (1 - t);
        hero.style.clipPath = `inset(${v}% ${h}% ${v}% ${h}% round ${(4 * (1 - t)).toFixed(1)}px)`;
      }
    }, '+=.35');
    tl.to(inner, { scale: 1, x: 0, duration: 1.8, ease: 'expo.out' }, '<');
    tl.to(count, { yPercent: 120, opacity: 0, duration: .7, ease: 'power3.in' }, '<.1');
    tl.to(lines, { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: .12 }, '<.7');
    tl.to(root.querySelectorAll('.s048__nav,.s048__sub,.s048__cta'), { opacity: (i, el) => (el.className.includes('sub') ? .75 : 1), y: 0, duration: 1, ease: 'power4.out', stagger: .1 }, '<.2');
    tl.fromTo(root.querySelector('.s048__cone'), { rotate: -6 }, { rotate: 0, duration: 1.6, ease: 'expo.out' }, '<-.2');
    tl.to({}, { duration: 1.6 });
  };
  const onReplay = () => { again && again.kill(); play(); };
  root.addEventListener('click', onReplay);
  play();
  return () => { tl && tl.kill(); again && again.kill(); root.removeEventListener('click', onReplay); gsap.killTweensOf(root.querySelectorAll('*')); };
}
