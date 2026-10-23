const PLUS = 'M-3 -10h6v7h7v6h-7v7h-6v-7h-7v-6h7z';
const MINUS = 'M-3 -3h6v0h7v6h-7v0h-6v0h-7v-6h7z'; // 가로 막대(점 개수 동일)
const BLOBS = [
  'M100 14C146 10 190 48 188 98C186 150 150 190 100 188C50 186 12 148 14 100C16 54 56 18 100 14Z',
  'M96 8C150 22 196 62 182 116C170 168 120 196 78 180C30 164 4 120 22 72C36 36 62 2 96 8Z',
  'M112 16C160 28 194 70 184 120C174 168 136 192 92 190C44 188 10 150 16 102C22 58 66 4 112 16Z',
];

export default function init(root, ctx) {
  const items = [...root.querySelectorAll('.s069__item')];
  const S = items.map(el => ({ el, a: el.querySelector('.s069__a'), ic: el.querySelector('[data-ic]'), icBox: el.querySelector('.s069__ic'), open: false, tw: null }));
  gsap.set(S.map(s => s.ic), { transformOrigin: '50% 50%' });
  const setOpen = (s, open) => {
    if (s.open === open) return;
    s.open = open; s.el.classList.toggle('is-open', open);
    s.tw && s.tw.kill();
    s.tw = gsap.timeline();
    if (open) {
      s.tw.to(s.el, { borderRadius: 34, duration: .7, ease: 'expo.out' }, 0)
        .to(s.a, { height: 'auto', duration: 1.3, ease: 'elastic.out(1,.62)' }, 0)
        .fromTo(s.a.firstElementChild, { opacity: 0, y: -14 }, { opacity: 1, y: 0, duration: .8, ease: 'expo.out' }, .12)
        .to(s.ic, { morphSVG: MINUS, duration: .7, ease: 'expo.inOut' }, 0)
        .to(s.icBox, { rotation: 180, duration: .8, ease: 'back.out(1.8)' }, 0);
    } else {
      s.tw.to(s.a, { height: 0, duration: .65, ease: 'expo.inOut' }, 0)
        .to(s.el, { borderRadius: 60, duration: .7, ease: 'expo.inOut' }, .1)
        .to(s.ic, { morphSVG: PLUS, duration: .6, ease: 'expo.inOut' }, 0)
        .to(s.icBox, { rotation: 0, duration: .7, ease: 'expo.inOut' }, 0);
    }
  };
  let auto = true, userAt = -1e9, vis = false, k = 0;
  const hs = S.map((s, i) => {
    const btn = s.el.querySelector('.s069__q');
    const click = () => { auto = false; userAt = performance.now(); const to = !s.open; S.forEach(o => o !== s && setOpen(o, false)); setOpen(s, to); };
    btn.addEventListener('click', click);
    return () => btn.removeEventListener('click', click);
  });
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .3 }); io.observe(root);
  // 자동 개폐: 사용자 조작 5초 뒤 재개
  const iv = setInterval(() => {
    if (!vis) return;
    if (!auto && performance.now() - userAt > 5000) auto = true;
    if (!auto) return;
    const s = S[k++ % S.length]; S.forEach(o => o !== s && setOpen(o, false)); setOpen(s, true);
  }, 3600);
  setTimeout(() => { if (auto) setOpen(S[0], true); }, 700);

  // 블롭 몰핑 루프 + 회전
  const blob = root.querySelector('[data-blob]');
  const bl = gsap.timeline({ repeat: -1 });
  BLOBS.slice(1).concat(BLOBS[0]).forEach(d => bl.to(blob, { morphSVG: d, duration: 2.6, ease: 'sine.inOut' }));
  const rot = gsap.to(blob.parentNode, { rotation: 360, duration: 30, repeat: -1, ease: 'none', transformOrigin: '50% 50%' });
  gsap.from(items, { x: 100, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: root, start: 'top 70%', once: true } });

  return () => { clearInterval(iv); io.disconnect(); hs.forEach(f => f()); bl.kill(); rot.kill(); S.forEach(s => s.tw && s.tw.kill()); gsap.killTweensOf(items); };
}
