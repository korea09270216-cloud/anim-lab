export default function init(root, ctx) {
  const NS = 'http://www.w3.org/2000/svg';
  const DATA = {
    stores: [312, 148, 205, 96],
    royalty: [20, 45, 38, 55],
    cost: [7800, 9400, 8900, 11200]
  };
  const NAMES = ['비빔공방', 'A브랜드', 'B브랜드', 'C브랜드'];
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };

  const BASE = 188, MAXH = 128, W = 56, STEP = 82, X0 = 29;
  const charts = [...root.querySelectorAll('.s112__chart')].map(fig => {
    const key = fig.dataset.key, unit = fig.dataset.unit, low = fig.dataset.better === 'low';
    const d = DATA[key], max = Math.max(...d);
    const svg = fig.querySelector('svg');
    [.33, .66, 1].forEach(r => el('line', { class: 'grid', x1: 8, x2: 352, y1: BASE - MAXH * r, y2: BASE - MAXH * r }, svg));
    el('line', { class: 'base', x1: 8, x2: 352, y1: BASE, y2: BASE }, svg);
    const bars = d.map((v, i) => {
      const h = v / max * MAXH, x = X0 + i * STEP, us = i === 0 ? ' us' : '';
      const rect = el('rect', { class: 'bar' + us, x, y: BASE - h, width: W, height: h, rx: 8 }, svg);
      gsap.set(rect, { svgOrigin: (x + W / 2) + ' ' + BASE });
      const val = el('text', { class: 'val' + us, x: x + W / 2, y: BASE - h - 10 }, svg);
      el('text', { class: 'lab' + us, x: x + W / 2, y: BASE + 24 }, svg).textContent = NAMES[i];
      return { rect, val, v, h, unit };
    });
    const avg = d.slice(1).reduce((a, b) => a + b, 0) / 3;
    fig.querySelector('.s112__delta').textContent = low ? `경쟁사 평균 대비 ${Math.round((d[0] / avg - 1) * 100)}%` : `경쟁사 평균의 ${(d[0] / avg).toFixed(1)}배`;
    return { bars, delta: fig.querySelector('.s112__delta'), fig };
  });

  const table = root.querySelector('.s112__table');
  const hl = root.querySelector('.s112__hl');
  const rows = [...table.querySelectorAll('.s112__row:not(.s112__row--head)')];
  const usStamps = rows.map(r => r.querySelector('.s112__stamp--us'));
  const otherStamps = rows.map(r => [...r.querySelectorAll('.s112__stamp:not(.s112__stamp--us)')]);
  let hovering = false;

  function moveHl(row, force) {
    if (hovering && !force) return;
    const was = parseFloat(hl.style.opacity) > .05;
    if (!was) gsap.set(hl, { y: row.offsetTop, height: row.offsetHeight });
    gsap.to(hl, { y: row.offsetTop, height: row.offsetHeight, opacity: 1, duration: .7, ease: 'expo.out', overwrite: true });
  }
  function hideHl() { if (!hovering) gsap.to(hl, { opacity: 0, duration: .5, overwrite: true }); }

  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 2.4 });
  charts.forEach((c, ci) => {
    const at = ci * .38;
    c.bars.forEach((b, k) => {
      const at2 = at + k * .13, p = { t: 0 };
      tl.fromTo(b.rect, { scaleY: 0 }, { scaleY: 1, duration: 1.35, ease: k === 0 ? 'expo.out' : 'power4.out' }, at2);
      tl.fromTo(p, { t: 0 }, {
        t: 1, duration: 1.35, ease: k === 0 ? 'expo.out' : 'power4.out',
        onUpdate: () => { b.val.setAttribute('y', 188 - b.h * p.t - 10); b.val.textContent = fmt(b.v * p.t) + (p.t > .98 ? b.unit : ''); }
      }, at2);
    });
    tl.fromTo(c.delta, { scale: .5, opacity: 0, transformOrigin: '100% 50%' }, { scale: 1, opacity: 1, duration: .7, ease: 'back.out(2.4)' }, at + 1.1);
  });
  tl.fromTo(rows, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: .8, ease: 'expo.out', stagger: .07 }, 1.4);
  rows.forEach((r, i) => {
    const t0 = 2.3 + i * .34;
    tl.fromTo(usStamps[i], { scale: 0, rotation: -50, opacity: 0, transformOrigin: '50% 50%' }, { scale: 1, rotation: 0, opacity: 1, duration: .6, ease: 'back.out(3.2)' }, t0);
    tl.fromTo(otherStamps[i], { scale: .5, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'power3.out', stagger: .06 }, t0 + .12);
  });
  rows.forEach((r, i) => tl.call(() => moveHl(r), null, 4.7 + i * .9));
  tl.call(hideHl, null, 4.7 + rows.length * .9 + .3);
  tl.to({}, { duration: .2 }, 4.7 + rows.length * .9 + .6);

  const st = ScrollTrigger.create({ trigger: root, start: 'top 70%', once: true, onEnter: () => tl.play() });

  const offs = rows.map(r => {
    const a = () => { hovering = true; moveHl(r, true); };
    r.addEventListener('pointerenter', a);
    return () => r.removeEventListener('pointerenter', a);
  });
  const leave = () => { hovering = false; gsap.to(hl, { opacity: 0, duration: .5, overwrite: true }); };
  table.addEventListener('pointerleave', leave);

  return () => { st.kill(); tl.kill(); offs.forEach(f => f()); table.removeEventListener('pointerleave', leave); gsap.killTweensOf(hl); };
}
