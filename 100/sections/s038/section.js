export default function init(root, ctx) {
  const list = root.querySelector('.s038__list'), rows = [...root.querySelectorAll('.s038__row')];
  const pv = root.querySelector('.s038__pv'), layers = [...root.querySelectorAll('.s038__layer')];
  gsap.set(pv, { xPercent: -50, yPercent: -50, x: 300, y: 300, scale: .7 });
  const qx = gsap.quickTo(pv, 'x', { duration: .7, ease: 'expo.out' });
  const qy = gsap.quickTo(pv, 'y', { duration: .7, ease: 'expo.out' });
  const qr = gsap.quickTo(pv, 'rotation', { duration: .6, ease: 'power3.out' });
  let cur = -1, z = 1, visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y, pvx = 0;
  const t0 = performance.now();
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);

  function enter(i, fromTop) {
    const l = layers[i];
    gsap.killTweensOf(l);
    l.style.zIndex = ++z;
    gsap.fromTo(l, { clipPath: fromTop ? 'inset(0% 0% 100% 0%)' : 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: .85, ease: 'expo.out' });
    // 이전 레이어는 새 레이어가 덮은 뒤 리셋
    layers.forEach((o, k) => { if (k !== i) gsap.set(o, { clipPath: 'inset(0 0 100% 0)', delay: .9 }); });
    rows[i].classList.add('is-active');
  }
  function leaveAll() {
    rows.forEach(r => r.classList.remove('is-active')); list.classList.remove('is-on');
    gsap.to(pv, { opacity: 0, scale: .7, duration: .6, ease: 'expo.out', overwrite: 'auto' });
  }
  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now(), rect = root.getBoundingClientRect();
    const mv = Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly);
    const dx = ctx.mouse.x - lx; pvx = pvx * .8 + dx * .2;
    if (mv > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let x, y;
    if (now - lastMove < 2200) { x = ctx.mouse.x; y = ctx.mouse.y; }
    else {
      const t = (now - t0) / 1000, lr = list.getBoundingClientRect();
      const ph = (t * .32) % 1, k = Math.floor(ph * 6) % 6, tri = Math.abs(((t * .32 * 6) % 2) - 1);
      y = lr.top + lr.height * (.08 + .84 * (ph)) ; x = lr.left + lr.width * (.25 + .5 * Math.abs(Math.sin(t * .6))) ; pvx = Math.cos(t * .6) * 6;
    }
    qx(x - rect.left); qy(y - rect.top); qr(Math.max(-14, Math.min(14, pvx * .7)));
    let hit = -1;
    rows.forEach((r, i) => { const b = r.getBoundingClientRect(); if (y >= b.top && y < b.bottom && x >= b.left - 40 && x <= b.right + 40) hit = i; });
    if (hit !== cur) {
      if (hit < 0) leaveAll();
      else {
        const b = rows[hit].getBoundingClientRect();
        const fromTop = cur < 0 ? y < b.top + b.height / 2 : hit > cur;
        if (cur < 0) { list.classList.add('is-on'); gsap.to(pv, { opacity: 1, scale: 1, duration: .8, ease: 'expo.out', overwrite: 'auto' }); }
        rows[cur]?.classList.remove('is-active');
        enter(hit, fromTop);
      }
      cur = hit;
    }
  });
  return () => { off(); io.disconnect(); };
}
