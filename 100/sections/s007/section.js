export default function init(root, ctx) {
  const l = root.querySelector('.s007__col--l'), r = root.querySelector('.s007__col--r');
  const tiles = [...root.querySelectorAll('.s007__tile')];
  const stage = root.querySelector('.s007__stage');
  let span = 0;
  let pos = [];
  const size = () => {
    span = Math.max(l.offsetHeight, r.offsetHeight) - stage.clientHeight;
    pos = tiles.map(t => t.offsetTop + t.offsetHeight / 2);
  };
  size();
  addEventListener('resize', size);
  let target = 0, cur = 0, prev = 0, skew = 0;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  const t0 = performance.now();
  const off = ctx.tick(() => {
    cur += (target - cur) * .1;
    const v = (cur - prev) * 90; prev = cur;
    skew += (Math.max(-9, Math.min(9, v * 30)) - skew) * .12;
    const t = (performance.now() - t0) / 1000, d = ctx.reduced ? 0 : Math.sin(t * .8) * 14;
    const ly = -cur * span + d, ry = -(1 - cur) * span - d;
    l.style.transform = `translate3d(0,${ly}px,0) skewY(${skew * -.5}deg)`;
    r.style.transform = `translate3d(0,${ry}px,0) skewY(${skew * .5}deg)`;
    const vh = stage.clientHeight, c = vh / 2;
    tiles.forEach((el, i) => {
      const ty = (i < 5 ? ly : ry) + pos[i];
      const k = Math.min(1, Math.abs(ty - c) / vh);
      el.style.transform = `scale(${(1 - .09 * k).toFixed(3)})`;
    });
  });
  return () => { off(); st.kill(); removeEventListener('resize', size); };
}
