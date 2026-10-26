export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const panels = $$('.s106__panel');
  const bar = $('.s106__bar'), cur = $('.s106__cur'), back = $('.s106__back');
  const typeEl = $('.s106__type');
  const TYPES = ['부업 병행형', '부부 동행형', '여유 은퇴형', '다점포 확장형'];
  const LAST = panels.length - 1;
  let idx = 0, answers = [], busy = false, demoOn = true, inView = false, call = null;

  gsap.set(panels, { autoAlpha: 0 });
  gsap.set(panels[0], { autoAlpha: 1 });
  gsap.set(bar, { scaleX: .25 });

  function enter(p, dir) {
    const q = $('.s106__q', p), no = $('.s106__q-no', p), opts = $$('.s106__opt', p);
    gsap.set(p, { autoAlpha: 1, y: dir * 110 });
    const tl = gsap.timeline();
    tl.to(p, { y: 0, duration: .95, ease: 'expo.out' }, 0)
      .fromTo([no, q], { opacity: 0, y: dir * 36 }, { opacity: 1, y: 0, duration: .8, stagger: .07, ease: 'expo.out' }, 0);
    if (opts.length) tl.fromTo(opts, { opacity: 0, y: dir * 90, rotate: dir * 2.5 }, { opacity: 1, y: 0, rotate: 0, duration: .9, stagger: .07, ease: 'expo.out', clearProps: 'rotate' }, .06);
    return tl;
  }
  function leave(p, dir) {
    return gsap.to(p, { y: -dir * 120, opacity: 0, duration: .55, ease: 'power4.in', onComplete: () => gsap.set(p, { autoAlpha: 0, y: 0, opacity: 1 }) });
  }

  function result() {
    const t = [0, 0, 0, 0];
    answers.forEach(a => t[a]++);
    const top = t.indexOf(Math.max(...t));
    const pct = t.map((n, i) => Math.min(96, Math.round(n / 4 * 64 + (i === top ? 24 : 8) + (i * 3 % 5))));
    typeEl.textContent = TYPES[top];
    $$('.s106__match li').forEach((li, i) => {
      li.classList.toggle('is-top', i === top);
      const b = $('b', li), em = $('em', li), o = { v: 0 };
      gsap.set(b, { scaleX: 0 });
      gsap.to(b, { scaleX: pct[i] / 100, duration: 1.3, delay: .5 + i * .1, ease: 'expo.out' });
      gsap.to(o, { v: pct[i], duration: 1.3, delay: .5 + i * .1, ease: 'expo.out', onUpdate: () => { em.textContent = Math.round(o.v) + '%'; } });
    });
    gsap.fromTo([$('.s106__desc'), $('.s106__go'), $('.s106__again')], { opacity: 0, y: 24 }, { opacity: 1, y: 0, stagger: .1, delay: .8, duration: .9, ease: 'expo.out' });
  }

  function go(next, dir) {
    if (next < 0 || next > LAST) return;
    busy = true;
    const from = panels[idx];
    idx = next;
    leave(from, dir);
    enter(panels[idx], dir);
    cur.textContent = Math.min(idx + 1, 4);
    gsap.to(bar, { scaleX: idx >= 4 ? 1 : (idx + 1) / 4, duration: 1, ease: 'expo.out' });
    back.disabled = idx === 0;
    if (idx === LAST) result();
    gsap.delayedCall(.5, () => { busy = false; });
  }

  function resetOpts(p) {
    $$('.s106__opt', p).forEach(o => { o.classList.remove('is-pick', 'is-hot'); gsap.set(o, { opacity: 1 }); });
  }
  function choose(i) {
    if (busy || idx > 3) return;
    const opts = $$('.s106__opt', panels[idx]);
    if (!opts[i]) return;
    busy = true;
    answers[idx] = i;
    opts.forEach((o, k) => { o.classList.toggle('is-pick', k === i); o.classList.remove('is-hot'); });
    gsap.timeline()
      .to(opts[i], { scale: 1.05, duration: .16, ease: 'power3.out' })
      .to(opts[i], { scale: 1, duration: .5, ease: 'elastic.out(1,.5)' })
      .to(opts.filter((_, k) => k !== i), { opacity: .28, duration: .35 }, 0);
    gsap.delayedCall(.62, () => { busy = false; go(idx + 1, 1); });
  }
  function prev() {
    if (busy || idx === 0) return;
    answers.length = Math.min(idx, 4) - 1;
    resetOpts(panels[idx - 1]);
    go(idx - 1, -1);
  }
  function restart() {
    if (busy) return;
    answers = [];
    panels.forEach(resetOpts);
    go(0, -1);
  }

  const stopDemo = () => { demoOn = false; if (call) call.kill(); };
  const onClick = e => {
    const o = e.target.closest('.s106__opt');
    if (o) return choose(+o.dataset.i);
    if (e.target.closest('.s106__back')) return prev();
    if (e.target.closest('.s106__again')) return restart();
    if (e.target.closest('.s106__go')) e.preventDefault();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', stopDemo);
  const onKey = e => {
    if (!inView) return;
    if (/^[1-4]$/.test(e.key)) { stopDemo(); choose(+e.key - 1); }
    else if (e.key === 'ArrowLeft' || e.key === 'Backspace') { stopDemo(); prev(); }
  };
  window.addEventListener('keydown', onKey);

  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: .35 });
  io.observe(root);

  /* 자동 데모: 사용자가 누르거나 키를 치면 영구 중단 */
  const scripts = [[1, 1, 1, 1], [0, 0, 0, 0], [3, 3, 3, 3], [2, 2, 2, 2]];
  let run = 0;
  function step() {
    if (!demoOn) return;
    if (!inView) { call = gsap.delayedCall(.5, step); return; }
    if (idx <= 3) {
      const pick = scripts[run % scripts.length][idx];
      const o = $$('.s106__opt', panels[idx])[pick];
      o.classList.add('is-hot');
      call = gsap.delayedCall(.9, () => { choose(pick); call = gsap.delayedCall(1.9, step); });
    } else {
      call = gsap.delayedCall(3.6, () => { run++; restart(); call = gsap.delayedCall(1.8, step); });
    }
  }
  call = gsap.delayedCall(1.2, step);

  return () => {
    root.removeEventListener('click', onClick);
    root.removeEventListener('pointerdown', stopDemo);
    window.removeEventListener('keydown', onKey);
    io.disconnect();
    if (call) call.kill();
    gsap.killTweensOf(panels);
  };
}
