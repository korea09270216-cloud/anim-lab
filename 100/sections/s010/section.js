export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const stage = $('.s010__stage'), world = $('.s010__world'), svg = $('.s010__svg');
  const draw = $('.s010__draw'), hd = $('.s010__hd');
  const nodes = [...root.querySelectorAll('.s010__nodes li')];
  const yearEl = $('.s010__year span'), bar = $('.s010__bar i');
  const VW = 1440, VH = 3200;
  const len = draw.getTotalLength();
  draw.style.strokeDasharray = len; draw.style.strokeDashoffset = len;
  let W = 0, Hh = 0, scale = 1;
  const nodeLen = nodes.map(n => +n.dataset.f);
  const layout = () => {
    W = stage.clientWidth; scale = W / VW; Hh = VH * scale * 1;
    world.style.height = Hh + 'px';
    nodes.forEach((n, i) => {
      const pt = draw.getPointAtLength(nodeLen[i] * len);
      n.style.left = pt.x * scale + 'px'; n.style.top = pt.y * scale + 'px';
      n.classList.toggle('r', pt.x < VW / 2 + 5); n.classList.toggle('l', pt.x >= VW / 2 + 5);
    });
  };
  layout();
  addEventListener('resize', layout);
  let target = 0, cur = 0, ty = 0, curYear = '1987', lastL = -9;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const off = ctx.tick(() => {
    cur += (target - cur) * .09;
    const f = Math.max(0, Math.min(1, (cur - .01) / .97));
    const L = f * len;
    if (Math.abs(L - lastL) > .5) { draw.style.strokeDashoffset = len - L; lastL = L; }
    const pt = draw.getPointAtLength(Math.max(.01, L));
    hd.style.transform = `translate3d(${pt.x * scale}px,${pt.y * scale}px,0)`;
    const vh = stage.clientHeight;
    const goal = Math.max(-(Hh - vh), Math.min(0, vh * .5 - pt.y * scale));
    ty += (goal - ty) * .12;
    world.style.transform = `translate3d(0,${ty}px,0)`;
    let lastLit = -1;
    nodes.forEach((n, i) => {
      const on = f >= nodeLen[i] - .004;
      if (on) lastLit = i;
      if (on !== n.classList.contains('lit')) {
        n.classList.toggle('lit', on);
        if (on) gsap.fromTo(n.querySelector('i'), { scale: .4 }, { scale: 1, duration: 1.1, ease: 'elastic.out(1,.45)' });
      }
    });
    const y = nodes[Math.max(0, lastLit)].dataset.y;
    if (y !== curYear) { curYear = y; gsap.fromTo(yearEl, { yPercent: 30, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .9, ease: 'expo.out' }); yearEl.textContent = y; }
    bar.style.transform = `scaleX(${f})`;
  });
  return () => { off(); st.kill(); removeEventListener('resize', layout); };
}
