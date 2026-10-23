export default function init(root, ctx) {
  const frs = [...root.querySelectorAll('.s003__fr')];
  const dots = [...root.querySelectorAll('.s003__dots li')];
  const core = root.querySelector('.s003__core');
  const N = frs.length, RHO = .6;
  let target = 0, cur = 0, vel = 0, off = 0, lastOn = -1;
  const st = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { target = s.progress; } });
  let prevCur = 0, mx = 0, my = 0;
  const off_ = ctx.tick((time, dt) => {
    cur += (target - cur) * .09;
    vel = (cur - prevCur) * 60; prevCur = cur;
    mx += ((ctx.mouse.nx - .5) - mx) * .06; my += ((ctx.mouse.ny - .5) - my) * .06;
    off += (ctx.reduced ? 0 : .0022);
    const o = cur * (N + 2.5) + off;
    let front = 0, fu = 99;
    frs.forEach((f, i) => {
      const u = (((i - o + 1) % N) + N) % N - 1;      // -1 ~ N-1
      const s = Math.pow(RHO, u);
      if (u >= -.2 && u < fu) { fu = u; front = i; }
      const far = Math.min(1, Math.max(0, (N - 1 - u) / 1.6));    // 멀리서 서서히 등장
      const close = Math.min(1, Math.max(0, (u + 1) / .5));       // 화면 밖으로 사라지는 순간 정리
      f.style.opacity = Math.min(far, close);
      f.style.zIndex = Math.round(s * 100);
      const k = (1 - s);
      f.style.transform = `translate3d(${-mx * 160 * k}px,${-my * 110 * k}px,0) scale(${s})`;
    });
    if (front !== lastOn) { lastOn = front; dots.forEach((d, i) => d.classList.toggle('on', i === front)); }
    core.style.transform = `scale(${1 + Math.min(.5, Math.abs(vel) * 6)})`;
  });
  return () => { off_(); st.kill(); };
}
