export default function init(root, ctx) {
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const items = $$('.s055__it'), goo = $('.s055__goo');
  const A = $('.s055__bA'), B = $('.s055__bB'), C = $('.s055__bC');
  const drips = $$('.s055__drip');
  const turb = $('.s055__wturb'), disp = $('.s055__wdisp');
  const big = $('.s055__big'), desc = $('.s055__desc'), price = $('.s055__price b');
  const F = [
    { n: '피스타치오', c: '#b9e36a', bg: '#1b1236', d: '시칠리아산 브론테 피스타치오를 껍질째 갈아 넣은 진득한 초록.', p: '5,800' },
    { n: '솔티카라멜', c: '#f2b76b', bg: '#2a1620', d: '소금 한 꼬집을 넣고 나흘 숙성한 버터 카라멜, 끝맛이 짭짤합니다.', p: '5,600' },
    { n: '블러드오렌지', c: '#ff7a4d', bg: '#2a1530', d: '타로코 블러드오렌지 과즙 60%, 얼음 알갱이처럼 시원하게 녹아요.', p: '5,600' },
    { n: '흑임자', c: '#b9a6ff', bg: '#171238', d: '직접 볶아 곱게 간 흑임자와 우유만으로 낸 고소한 보라.', p: '5,800' },
    { n: '요거베리', c: '#ff8fc0', bg: '#2b1030', d: '그릭요거트에 산딸기를 통째로 눌러 담은 새콤한 분홍.', p: '6,000' }
  ];
  let swapTl, cur = -1, lastUser = -1e9, warpS = 0, W = 0;
  const warp = { s: 0 };
  const cx = i => { const g = goo.getBoundingClientRect(), r = items[i].getBoundingClientRect(); return r.left - g.left + r.width / 2; };
  const bw = () => A.offsetWidth / 2;

  function set(i, user) {
    if (user) lastUser = performance.now();
    if (i === cur) return;
    const first = cur < 0; cur = i; const f = F[i];
    items.forEach((b, k) => b.classList.toggle('is-on', k === i));
    gsap.to(A, { x: cx(i) - bw(), duration: first ? 0 : .55, ease: 'expo.out', overwrite: 'auto' });
    gsap.to(B, { x: cx(i) - bw(), duration: first ? 0 : 1.15, ease: 'power3.out', overwrite: 'auto' });
    gsap.to([A, B, C], { backgroundColor: f.c, duration: .5 });
    gsap.to(root, { backgroundColor: f.bg, duration: 1.2, ease: 'power2.out' });
    gsap.to(big, { color: f.c, duration: .6 });
    if (first) { big.textContent = f.n; desc.textContent = f.d; price.textContent = f.p; return; }
    swapTl && swapTl.kill();
    swapTl = gsap.timeline()
      .to(warp, { s: 120, duration: .32, ease: 'power3.in' })
      .add(() => { big.textContent = f.n; desc.textContent = f.d; price.textContent = f.p; })
      .to(warp, { s: 0, duration: 1.25, ease: 'expo.out' });
    gsap.fromTo(desc, { opacity: 0, y: 14 }, { opacity: .8, y: 0, duration: .9, delay: .35, ease: 'expo.out' });
    gsap.fromTo(price.parentNode, { opacity: 0, y: 14 }, { opacity: .75, y: 0, duration: .9, delay: .45, ease: 'expo.out' });
  }
  set(0, false);

  const offs = items.map((b, i) => {
    const f = () => set(i, true);
    b.addEventListener('pointerenter', f); b.addEventListener('click', f);
    return () => { b.removeEventListener('pointerenter', f); b.removeEventListener('click', f); };
  });
  const onResize = () => { const x = cx(cur) - bw(); gsap.set([A, B], { x }); };
  addEventListener('resize', onResize);

  // 녹아내리는 방울: 트랙 아래로 늘어나며 떨어졌다가 다시 붙는다
  const dripTls = drips.map((d, i) => gsap.timeline({ repeat: -1, delay: i * .7 })
    .fromTo(d, { y: 0, scaleX: 1, scaleY: .7, opacity: 1 }, { y: 54 + (i % 3) * 14, scaleX: .72, scaleY: 1.5, duration: 2 + (i % 2) * .6, ease: 'power2.in' })
    .to(d, { y: 120, scaleY: .6, scaleX: .5, opacity: 0, duration: .5, ease: 'power1.in' })
    .set(d, { y: 0, scaleX: 1, scaleY: .7, opacity: 1 }).to(d, { duration: 1.2 + (i % 3) * .5 }));

  // 커서 블롭 + 헤드라인 왜곡 (느린 프레임으로 갱신해 부하를 줄인다)
  let n = 0, t = 0, bx = 0, by = 0, bs = 0;
  const off = ctx.tick((time, dt) => {
    t += (dt || 16) / 1000; n++;
    const g = goo.getBoundingClientRect();
    const m = ctx.mouse, inside = m.x > g.left - 70 && m.x < g.right + 70 && m.y > g.top - 80 && m.y < g.bottom + 120;
    const tx = m.x - g.left - 35, ty = m.y - g.top - 35;
    if (inside) { if (bs < .05) { bx = tx; by = ty; } bx += (tx - bx) * .16; by += (ty - by) * .16; }
    bs += ((inside ? 1 : 0) - bs) * .1;
    gsap.set(C, { x: bx, y: by, scale: bs });
    if (n % 3 === 0) {
      const s = warp.s + 7 + Math.sin(t * 1.6) * 5;
      disp.setAttribute('scale', s.toFixed(1));
      turb.setAttribute('baseFrequency', (0.012 + Math.sin(t * .7) * .003).toFixed(4) + ' ' + (0.05 + Math.cos(t * .9) * .012 + warp.s * .0002).toFixed(4));
    }
  });

  // 마우스가 없을 때: 자동으로 다음 맛으로
  const auto = gsap.delayedCall(3, function tick() {
    if (performance.now() - lastUser > 5000) set((cur + 1) % F.length, false);
    auto.restart(true);
  });

  return () => { offs.forEach(f => f()); removeEventListener('resize', onResize); dripTls.forEach(t => t.kill()); off(); auto.kill(); };
}
