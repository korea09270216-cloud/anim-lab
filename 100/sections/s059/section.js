export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const NS = 'http://www.w3.org/2000/svg';
  const back = $('.s059__back'), front = $('.s059__front'), lclip = $('.s059__lclip');
  const num = $('.s059__num'), num2 = $('.s059__num2'), hEl = $('.s059__h');
  const stream = $('.s059__stream'), iceG = $('.s059__ice'), bubG = $('.s059__bubbles');
  const ice = [...iceG.children];
  const BOTTOM = 526, TOP = 92;

  const bubs = Array.from({ length: 12 }, (_, i) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('r', (2 + (i % 4) * 1.6).toFixed(1)); bubG.appendChild(c);
    return { c, x: 120 + (i * 37) % 160, y: BOTTOM - (i * 53) % 400, v: 22 + (i % 5) * 9 };
  });

  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom' });
  let p = 0, amp = 6, tilt = 0, last = -1, lastH = -1;

  const wave = (level, a, k, t, sp, ph, tl) => {
    let d = '';
    for (let x = 30; x <= 370; x += 8) {
      const y = level + a * Math.sin(x * k + t * sp + ph) + a * .4 * Math.sin(x * k * 2.3 - t * sp * .8) + tl * (x - 200);
      d += (x === 30 ? 'M' : 'L') + x + ' ' + y.toFixed(1);
    }
    return d + 'V600H30Z';
  };

  const off = ctx.tick((time, dt) => {
    const target = st.progress;
    p += (target - p) * .07;
    const vel = ctx.lenis ? Math.abs(ctx.lenis.velocity || 0) : 0;
    amp += ((5 + Math.min(24, vel * 1.4)) - amp) * .08;
    tilt += (((ctx.mouse.nx - .5) * .34) - tilt) * .06;
    const level = BOTTOM - p * (BOTTOM - TOP);
    front.setAttribute('d', wave(level, amp, .026, time, 2.2, 0, tilt));
    lclip.setAttribute('d', wave(level, amp, .026, time, 2.2, 0, tilt));
    back.setAttribute('d', wave(level - 6, amp * 1.15, .02, time, 1.5, 2, tilt * 1.2));

    const pc = Math.round(p * 100);
    if (pc !== last) { last = pc; num.textContent = num2.textContent = pc + '%'; }
    const h = Math.round(p * 12 * 10) / 10;
    if (h !== lastH) { lastH = h; hEl.textContent = h.toFixed(1); }

    // 얼음: 수면 위에서 출렁
    const iceP = gsap.utils.clamp(0, 1, (p - .22) / .25);
    ice.forEach((r, i) => {
      const x = 150 + i * 52, y = level + amp * Math.sin(x * .026 + time * 2.2) + tilt * (x - 200) - 6;
      r.setAttribute('transform', `translate(${x} ${y.toFixed(1)}) rotate(${(Math.sin(time * 1.3 + i * 2) * 10 + tilt * 60 + i * 14).toFixed(1)}) scale(${iceP.toFixed(2)})`);
    });
    // 기포
    bubs.forEach(b => {
      b.y -= b.v * dt / 1000; b.x += Math.sin(time * 2 + b.v) * .12;
      if (b.y < level + 6) { b.y = BOTTOM - Math.random() * 30; b.x = 118 + Math.random() * 164; }
      b.c.setAttribute('cx', b.x.toFixed(1)); b.c.setAttribute('cy', b.y.toFixed(1));
    });
    // 떨어지는 물줄기: 다 차면 사라진다
    const sh = p < .985 ? level + 10 : 0;
    stream.setAttribute('height', sh.toFixed(1));
    stream.setAttribute('opacity', p < .985 ? .85 : 0);
    stream.setAttribute('width', (6 + Math.sin(time * 9) * 1.2).toFixed(1));
    stream.setAttribute('x', (197 - Math.sin(time * 9) * .6).toFixed(1));
  });

  return () => { off(); st.kill(); };
}
