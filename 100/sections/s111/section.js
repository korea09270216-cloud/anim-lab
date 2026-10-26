export default function init(root, ctx) {
  const list = root.querySelector('.s111__list');
  const rows = [...root.querySelectorAll('.s111__row')];
  const tabs = [...root.querySelectorAll('.s111__tab')];
  const bars = rows.map(r => r.querySelector('.s111__bar'));
  const vals = rows.map(r => r.querySelector('.s111__val em'));
  const ranks = rows.map(r => r.querySelector('.s111__rank'));
  const nums = rows.map(() => ({ v: 0 }));
  const P = [
    [9820, 9410, 8975, 8630, 8240, 7960, 7710, 7350],
    [9150, 9890, 8410, 9020, 7980, 8520, 7690, 7840],
    [8820, 9360, 10240, 8700, 9050, 7740, 8330, 7480],
    [10110, 8940, 9480, 9790, 8200, 8860, 8050, 7930]
  ];
  const MAX = 10500, fmt = n => Math.round(n).toLocaleString('ko-KR');
  let cur = 0, auto = true, call = null, started = false;

  const scaleOf = v => .1 + .9 * (v / MAX);
  function apply(p, first) {
    const d = P[p];
    const order = d.map((_, i) => i).sort((a, b) => d[b] - d[a]);
    const st = first ? null : Flip.getState(rows);
    order.forEach(i => list.appendChild(rows[i]));
    order.forEach((i, r) => {
      ranks[i].textContent = r + 1;
      rows[i].classList.toggle('is-top', r === 0);
      rows[i].classList.toggle('is-podium', r === 1 || r === 2);
    });
    if (st) Flip.from(st, { duration: 1.15, ease: 'expo.inOut', stagger: .035, absolute: false });
    order.forEach((i, r) => {
      const delay = first ? .25 + r * .1 : r * .045;
      gsap.to(bars[i], { scaleX: scaleOf(d[i]), duration: first ? 1.6 : 1.3, delay, ease: 'expo.out', overwrite: true });
      gsap.to(nums[i], { v: d[i], duration: first ? 1.6 : 1.3, delay, ease: 'power3.out', overwrite: true, onUpdate: () => { vals[i].textContent = fmt(nums[i].v); } });
    });
    tabs.forEach((t, k) => t.classList.toggle('is-on', k === p));
    cur = p;
  }

  function loop() {
    call = gsap.delayedCall(3.4, () => { if (!auto) return; apply((cur + 1) % P.length); loop(); });
  }

  // 초기: 카드 숨김 → 스크롤 진입 시 스태거 입장
  gsap.set(rows, { opacity: 0, x: 90 });
  const st = ScrollTrigger.create({
    trigger: root, start: 'top 75%', once: true,
    onEnter: () => {
      if (started) return; started = true;
      gsap.to(rows, { opacity: 1, x: 0, duration: 1.1, stagger: .07, ease: 'expo.out' });
      apply(0, true);
      call = gsap.delayedCall(3.2, () => { if (auto) { apply(1); loop(); } });
    }
  });

  const clicks = tabs.map((t, k) => {
    const f = () => { auto = false; if (call) call.kill(); if (k !== cur) apply(k); };
    t.addEventListener('click', f); return () => t.removeEventListener('click', f);
  });
  const hov = rows.map(r => {
    const a = () => gsap.to(r, { x: -10, duration: .5, ease: 'expo.out', overwrite: 'auto' });
    const b = () => gsap.to(r, { x: 0, duration: .7, ease: 'expo.out', overwrite: 'auto' });
    r.addEventListener('pointerenter', a); r.addEventListener('pointerleave', b);
    return () => { r.removeEventListener('pointerenter', a); r.removeEventListener('pointerleave', b); };
  });

  return () => { st.kill(); if (call) call.kill(); clicks.forEach(f => f()); hov.forEach(f => f()); gsap.killTweensOf([...rows, ...bars, ...nums]); };
}
