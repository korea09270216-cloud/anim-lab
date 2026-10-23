export default function init(root, ctx) {
  const btns = [...root.querySelectorAll('.s039__btn')].map(el => {
    const r = el.getBoundingClientRect(), D = Math.hypot(r.width, r.height) * 2.1;
    const drops = [...el.querySelectorAll('.s039__wrap i')];
    drops.forEach((d, k) => { const s = D * (k === 0 ? 1 : .42 - k * .08); d.style.width = d.style.height = s + 'px'; d.style.marginLeft = d.style.marginTop = -s / 2 + 'px'; });
    return { el, drops, on: false, qsk: gsap.quickTo(el, 'skewX', { duration: .6, ease: 'power3.out' }), qx: gsap.quickTo(el, 'x', { duration: .7, ease: 'expo.out' }), qy: gsap.quickTo(el, 'y', { duration: .7, ease: 'expo.out' }) };
  });
  const ghost = root.querySelector('.s039__ghost');
  let visible = true, lastMove = -1e9, lx = ctx.mouse.x, ly = ctx.mouse.y, vx = 0, gp = { x: 0, y: 0 };
  const t0 = performance.now();
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); io.observe(root);

  function place(b, x, y, k) {
    const r = b.el.getBoundingClientRect();
    b.drops.forEach((d, i) => {
      const jx = (i ? (i === 1 ? -1 : 1) * 26 * (k ? -1 : 1) : 0), jy = i ? (i === 1 ? 14 : -14) : 0;
      gsap.set(d, { left: x - r.left + jx, top: y - r.top + jy });
    });
  }
  function enter(b, x, y) {
    b.on = true; b.el.classList.add('is-on');
    place(b, x, y, 0);
    b.drops.forEach((d, i) => gsap.fromTo(d, { scale: 0 }, { scale: 1, duration: 1.1, delay: i * .05, ease: 'expo.out', overwrite: true }));
  }
  function leave(b, x, y) {
    b.on = false; b.el.classList.remove('is-on');
    place(b, x, y, 1);
    b.drops.forEach((d, i) => gsap.to(d, { scale: 0, duration: .8, delay: (2 - i) * .04, ease: 'expo.inOut', overwrite: true }));
    b.qx(0); b.qy(0);
  }
  const off = ctx.tick(() => {
    if (!visible) return;
    const now = performance.now();
    const mv = Math.abs(ctx.mouse.x - lx) + Math.abs(ctx.mouse.y - ly);
    vx = vx * .75 + (ctx.mouse.x - lx) * .25;
    if (mv > 1) { lastMove = now; lx = ctx.mouse.x; ly = ctx.mouse.y; }
    let x, y, idle = now - lastMove > 2200;
    if (!idle) { x = ctx.mouse.x; y = ctx.mouse.y; }
    else {
      const t = (now - t0) / 1000, rr = btns.map(b => b.el.getBoundingClientRect());
      const ph = (t * .26) % btns.length, i = Math.floor(ph), f = ph - i, r = rr[i], nx = rr[(i + 1) % btns.length];
      const inside = Math.min(1, f * 1.7), hop = Math.max(0, (f - .62) / .38);
      x = r.left + r.width * (.1 + .8 * inside); y = r.top + r.height * .5;
      if (hop > 0) { x = r.left + r.width * (.9 - .55 * hop); y = r.top + r.height * (.5 + (nx.top - r.top) * hop / r.height - 0); }
      vx = Math.cos(t * 3) * 10;
    }
    gp.x += (x - gp.x) * .2; gp.y += (y - gp.y) * .2;
    if (idle) { const rr = root.getBoundingClientRect(); ghost.style.opacity = 1; ghost.style.transform = `translate(${gp.x - rr.left}px,${gp.y - rr.top}px)`; } else ghost.style.opacity = 0;
    const px = idle ? gp.x : x, py = idle ? gp.y : y;
    btns.forEach(b => {
      const r = b.el.getBoundingClientRect(), hit = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom;
      if (hit && !b.on) enter(b, px, py);
      else if (!hit && b.on) leave(b, px, py);
      if (b.on) { b.qsk(gsap.utils.clamp(-9, 9, -vx * .35)); b.qx((px - (r.left + r.width / 2)) * .05); b.qy((py - (r.top + r.height / 2)) * .12); }
      else b.qsk(0);
    });
  });
  return () => { off(); io.disconnect(); };
}
