// 캐러셀 자체는 CSS 가 소유한다(scroll-snap · scroll-state · ::scroll-marker · ::scroll-button).
// 여기서는 마우스 없는 환경에서도 보이도록 "자동 재생" 데모 스크롤만 건다.
export default function init(root, ctx) {
  const row = root.querySelector('.s136__row');
  const items = [...row.children];
  let i = 0, hover = false, vis = false, t = 0;
  const go = n => {
    const el = items[n];
    row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: ctx.reduced ? 'auto' : 'smooth' });
  };
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: .15 });
  io.observe(root);
  const enter = () => { hover = true; }, leave = () => { hover = false; };
  row.addEventListener('pointerenter', enter); row.addEventListener('pointerleave', leave);
  const sync = () => {
    const c = row.scrollLeft + row.clientWidth / 2;
    let b = 0, d = 1e9;
    items.forEach((el, k) => { const m = Math.abs(el.offsetLeft + el.offsetWidth / 2 - c); if (m < d) { d = m; b = k; } });
    i = b;
  };
  row.addEventListener('scrollend', sync);
  row.scrollLeft = 0;
  t = setInterval(() => { if (!vis || hover) return; sync(); i = (i + 1) % items.length; go(i); }, 1500);
  return () => { clearInterval(t); io.disconnect(); row.removeEventListener('pointerenter', enter); row.removeEventListener('pointerleave', leave); row.removeEventListener('scrollend', sync); };
}
