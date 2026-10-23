export default function init(root, ctx) {
  const track = root.querySelector('.s004__track');
  const cards = [...root.querySelectorAll('.s004__card')];
  const big = root.querySelector('.s004__big');
  const cnt = root.querySelector('.s004__count b');
  const N = cards.length;
  const win = (p, a, b) => Math.max(0, Math.min(1, (p - a) / (b - a)));
  const e3 = gsap.parseEase('power3.inOut');
  const eSoft = gsap.parseEase('power2.inOut');
  let H = 0, step = 0;
  const size = () => {
    H = root.querySelector('.s004__stage').clientHeight;
    step = Math.max(300, Math.min(H * .86, innerWidth * .6));
    const cw = step * .86, ch = Math.min(H * .66, step * .8);
    cards.forEach(c => { c.style.width = cw + 'px'; c.style.height = ch + 'px'; c.style.marginLeft = -cw / 2 + 'px'; c.style.marginTop = -ch / 2 + 'px'; });
  };
  size();
  addEventListener('resize', size);
  let target = 0, cur = 0, last = '';
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const A1 = .46, R0 = .5, R1 = .64;
  const off = ctx.tick(() => {
    cur += (target - cur) * .1;
    const p = cur;
    // a: 트랙 좌표 (가로 구간 0→3, 회전 중 정지, 세로 구간 3→7)
    const a = p < R0 ? 3 * eSoft(win(p, .02, A1)) : 3 + 4 * eSoft(win(p, R1 + .02, .97));
    const rot = 90 * e3(win(p, R0, R1));
    const zoom = 1 - .22 * Math.sin(Math.PI * win(p, R0 - .02, R1 + .02));
    track.style.transform = `scale(${zoom}) rotate(${rot}deg)`;
    cards.forEach((c, i) => {
      const d = i - a, ad = Math.min(1, Math.abs(d));
      const s = 1 - .1 * ad;
      c.style.transform = `translate3d(${d * step}px,0,0) rotate(${-rot}deg) scale(${s})`;
      c.style.opacity = 1 - .3 * ad;
      c.style.zIndex = 10 - Math.round(Math.abs(d));
    });
    big.style.transform = `translate(-50%,-50%) rotate(${rot * .6}deg) translateX(${(-a * 120) * (1 - rot / 90)}px)`;
    const n = String(Math.max(1, Math.min(N, Math.round(a) + 1))).padStart(2, '0');
    if (n !== last) { last = n; cnt.textContent = n; gsap.fromTo(cnt, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .5, ease: 'expo.out' }); }
  });
  return () => { off(); st.kill(); removeEventListener('resize', size); };
}
