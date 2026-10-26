// 엘라스틱 그리드: ScrollSmoother(Lenis 와 병용 불가) 대신 열별 gsap.quickTo.
// 열마다 "지연된 스크롤 값"(proxy)을 quickTo 로 추종시키고, 실제 스크롤과의 차이만큼 열을 되밀어 놓는다.
// 중앙에서 멀수록 duration 이 길어 더 늦게 따라온다 → 스크롤이 멈추면 고무줄처럼 제자리로 복귀.
export default function init(root, ctx) {
  const cols = [...root.querySelectorAll('.s139__col')];
  const mid = (cols.length - 1) / 2;
  const MAXY = innerHeight * .34;
  const gain = ctx.reduced ? .25 : 1;
  const cur = () => (ctx.lenis ? ctx.lenis.scroll : scrollY);
  const px = cols.map(() => ({ v: cur() }));
  const tos = cols.map((el, i) => {
    const d = Math.abs(i - mid) / mid;                 // 0(중앙) ~ 1(가장자리)
    const dur = .1 + Math.pow(d, 1.3) * .95;          // 중앙은 빠르고 가장자리는 오래 늦게 따라온다
    return gsap.quickTo(px[i], 'v', { duration: dur, ease: 'power3.out' });
  });
  const onScroll = () => { const s = cur(); tos.forEach(f => f(s)); };
  const useLenis = ctx.lenis && ctx.lenis.on;
  if (useLenis) ctx.lenis.on('scroll', onScroll); else addEventListener('scroll', onScroll, { passive: true });
  const off = ctx.tick(() => {
    const s = cur();
    cols.forEach((el, i) => {
      const y = gsap.utils.clamp(-MAXY, MAXY, (s - px[i].v) * gain);
      el.style.transform = Math.abs(y) < .05 ? '' : `translate3d(0,${y.toFixed(2)}px,0)`;
    });
  });
  return () => {
    off();
    if (useLenis && ctx.lenis.off) ctx.lenis.off('scroll', onScroll); else removeEventListener('scroll', onScroll);
    gsap.killTweensOf(px);
    cols.forEach(el => { el.style.transform = ''; });
  };
}
