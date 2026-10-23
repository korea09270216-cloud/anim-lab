export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const main = $('.s052__main'), detail = $('.s052__detail'), wrap = $('.s052__wrap'), halo = $('.s052__halo');
  const track = $('.s052__track'), no = $('.s052__no');
  const descs = [...root.querySelectorAll('.s052__descs p')];
  const bars = [...root.querySelectorAll('.s052__bars i')];
  const S = [
    { main: 'M60 340 C60 160 160 60 340 60 C340 240 240 340 60 340 Z', detail: 'M70 330 C140 240 220 160 320 80', bg: '#2f6b4f', fg: '#f4ecd8', ink: '#2f6b4f' },
    { main: 'M200 40 C300 40 340 130 330 220 C320 320 260 360 190 360 C100 360 60 280 70 190 C80 100 120 40 200 40 Z', detail: 'M200 62 C150 140 250 260 195 338', bg: '#3b2418', fg: '#f1d9b5', ink: '#3b2418' },
    { main: 'M200 30 C210 100 310 150 310 250 C310 320 260 370 200 370 C140 370 90 320 90 250 C90 200 120 170 140 140 C150 180 170 190 180 170 C195 140 180 80 200 30 Z', detail: 'M200 352 C160 352 150 318 172 290 C184 272 200 256 200 236 C232 272 250 318 236 340 C230 350 216 352 200 352', bg: '#e8552b', fg: '#fff1dc', ink: '#e8552b' },
    { main: 'M200 36 C230 110 330 190 330 250 C330 320 270 366 200 366 C130 366 70 320 70 250 C70 190 170 110 200 36 Z', detail: 'M122 262 C124 304 158 334 200 336', bg: '#1f4fa8', fg: '#e6f0ff', ink: '#1f4fa8' },
    { main: 'M70 150 H300 L300 166 C372 150 376 270 290 268 C275 322 245 340 190 340 C120 340 70 300 70 150 Z', detail: 'M140 112 C120 90 160 76 140 52 M196 112 C176 90 216 76 196 52', bg: '#f0b429', fg: '#2a1c0c', ink: '#f0b429' }
  ];
  const HOLD = 3.2;
  let cur = -1, call, barTw, tlGo;

  gsap.set(main, { attr: { d: S[0].main }, fill: S[0].fg });
  gsap.set(detail, { attr: { d: S[0].detail }, stroke: S[0].ink });
  gsap.set(root, { backgroundColor: S[0].bg, color: S[0].fg });
  gsap.set(descs[0], { opacity: 1 });

  function go(i) {
    if (i === cur) return;
    const prev = cur < 0 ? 0 : cur; cur = i;
    const s = S[i];
    tlGo && tlGo.kill();
    tlGo = gsap.timeline();
    tlGo.to(main, { morphSVG: { shape: s.main, shapeIndex: 'auto', type: 'rotational' }, fill: s.fg, duration: 1.3, ease: 'expo.inOut' }, 0)
      .to(detail, { morphSVG: { shape: s.detail }, stroke: s.ink, duration: 1.3, ease: 'expo.inOut' }, 0)
      .to(root, { backgroundColor: s.bg, color: s.fg, duration: 1.2, ease: 'power3.inOut' }, 0)
      .fromTo(wrap, { rotation: -14, scale: .86 }, { rotation: 0, scale: 1, duration: 1.5, ease: 'expo.out' }, 0)
      .to(track, { y: () => -i * track.firstElementChild.offsetHeight, duration: 1.1, ease: 'expo.inOut' }, 0)
      .to(descs[prev], { opacity: 0, y: -14, duration: .45, ease: 'power2.in' }, 0)
      .fromTo(descs[i], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .9, ease: 'expo.out' }, .55);
    no.textContent = String(i + 1).padStart(2, '0');
    bars.forEach((b, k) => { if (k !== i) gsap.to(b, { scaleX: k < i ? 1 : 0, duration: .5, overwrite: true }); });
    barTw && barTw.kill();
    barTw = gsap.fromTo(bars[i], { scaleX: 0 }, { scaleX: 1, duration: HOLD + 1, ease: 'none' });
  }
  const loop = () => { go((cur + 1) % S.length); call = gsap.delayedCall(HOLD + 1, loop); };
  go(0); call = gsap.delayedCall(HOLD + .6, loop);

  // 바 클릭으로 점프
  const jumps = bars.map((b, k) => {
    const li = b.parentElement, f = () => { call.kill(); go(k); call = gsap.delayedCall(HOLD + 1, loop); };
    li.style.cursor = 'pointer'; li.addEventListener('click', f); return [li, f];
  });

  // 후광 회전 + 커서 반응(감쇠)
  const haloTw = gsap.to(halo, { rotation: 360, svgOrigin: '200 200', duration: 40, repeat: -1, ease: 'none' });
  const qx = gsap.quickTo(wrap.parentNode, 'x', { duration: 1.2, ease: 'power3.out' });
  const qy = gsap.quickTo(wrap.parentNode, 'y', { duration: 1.2, ease: 'power3.out' });
  const off = ctx.tick(() => { qx((ctx.mouse.nx - .5) * 40); qy((ctx.mouse.ny - .5) * 30); });

  return () => { call.kill(); barTw && barTw.kill(); tlGo && tlGo.kill(); haloTw.kill(); off(); jumps.forEach(([el, f]) => el.removeEventListener('click', f)); };
}
