export default function init(root, ctx) {
  const grid = root.querySelector('.s114__grid');
  const numEl = root.querySelector('.s114__num');
  const meter = root.querySelector('.s114__left-n');
  const cta = root.querySelector('.s114__cta');
  const tag = root.querySelector('.s114__tag');
  const TOTAL = 20;
  const pad = n => String(n).padStart(2, '0');

  grid.innerHTML = Array.from({ length: TOTAL }, (_, i) => `<div class="s114__cell is-open" data-i="${i}"><i class="s114__fill"></i><span>${pad(i + 1)}</span></div>`).join('');
  const cells = [...grid.children];
  const fills = cells.map(c => c.querySelector('.s114__fill'));
  const breath = new Array(TOTAL).fill(null);
  let filled = 0, blink = null, blinkCell = null, started = false;

  function setNum(n, animate) {
    if (!animate) { numEl.textContent = n; return; }
    gsap.fromTo(numEl, { yPercent: 100 }, { yPercent: 0, duration: .7, ease: 'expo.out', onStart: () => { numEl.textContent = n; } });
  }
  function startBreath(i, d) {
    if (breath[i]) breath[i].kill();
    breath[i] = gsap.fromTo(cells[i], { scale: 1, opacity: 1 }, { scale: .9, opacity: .72, duration: 1.15, ease: 'sine.inOut', yoyo: true, repeat: -1, delay: d, overwrite: true });
  }
  function updateHot() {
    const rem = TOTAL - filled;
    meter.classList.toggle('is-hot', rem <= 5);
    cta.classList.toggle('is-hot', rem <= 5);
    // 마지막 칸 깜빡임: 남은 칸이 4 이하이면 가장 앞 빈 칸을 경고색으로 점멸
    if (blink) { blink.kill(); blink = null; }
    if (blinkCell) { blinkCell.classList.remove('is-last'); gsap.set(blinkCell, { opacity: 1, scale: 1 }); blinkCell = null; }
    if (rem <= 4 && rem > 0) {
      const idx = cells.findIndex(c => c.classList.contains('is-open'));
      if (idx >= 0) {
        if (breath[idx]) breath[idx].kill();
        blinkCell = cells[idx]; blinkCell.classList.add('is-last');
        gsap.set(blinkCell, { scale: 1 });
        blink = gsap.fromTo(blinkCell, { opacity: 1 }, { opacity: .25, duration: .38, ease: 'steps(1)', yoyo: true, repeat: -1 });
      }
    }
  }
  function fill(i) {
    const c = cells[i];
    if (!c.classList.contains('is-open')) return;
    if (breath[i]) { breath[i].kill(); breath[i] = null; }
    if (c === blinkCell) { blink && blink.kill(); blink = null; c.classList.remove('is-last'); blinkCell = null; }
    c.classList.remove('is-open'); c.classList.add('is-filled');
    filled++;
    gsap.set(c, { opacity: 1 });
    gsap.fromTo(fills[i], { scaleY: 0 }, { scaleY: 1, duration: .75, ease: 'expo.out' });
    gsap.fromTo(c, { scale: .8 }, { scale: 1, duration: .8, ease: 'back.out(3)' });
    setNum(TOTAL - filled, true);
    updateHot();
  }
  function reset() {
    if (blink) { blink.kill(); blink = null; } blinkCell = null;
    filled = 0;
    cells.forEach((c, i) => {
      if (breath[i]) breath[i].kill();
      c.classList.remove('is-filled', 'is-last'); c.classList.add('is-open');
      gsap.killTweensOf([c, fills[i]]);
      gsap.set(c, { scale: 1, opacity: 1 }); gsap.set(fills[i], { scaleY: 0 });
    });
    cells.forEach((_, i) => startBreath(i, i * .08));
    setNum(TOTAL, false); meter.classList.remove('is-hot'); cta.classList.remove('is-hot');
  }
  reset();

  const order = [...Array(13).keys(), 16, 13, 18, 14];
  const tl = gsap.timeline({ paused: true, repeat: -1, repeatDelay: 3.2, onRepeat: reset });
  order.forEach((ci, k) => tl.call(() => fill(ci), null, k < 13 ? .4 + k * .13 : 2.9 + (k - 13) * 2.3));
  tl.to({}, { duration: .1 }, 12.4);

  const st = ScrollTrigger.create({ trigger: root, start: 'top 75%', once: true, onEnter: () => { started = true; tl.play(); } });

  // 사용자가 직접 칸을 누르면 데모 중단
  const onClick = e => {
    const c = e.target.closest('.s114__cell'); if (!c) return;
    tl.pause(); fill(+c.dataset.i);
  };
  grid.addEventListener('pointerdown', onClick);

  // 카운트다운(실시간)
  const end = Date.now() + ((2 * 24 + 13) * 3600 + 42 * 60 + 5) * 1000;
  const ds = { d: root.querySelector('.s114__d'), h: root.querySelector('.s114__h'), m: root.querySelector('.s114__m'), s: root.querySelector('.s114__s') };
  let lastS = -1;
  const tickTimer = () => {
    const left = Math.max(0, Math.floor((end - Date.now()) / 1000));
    const s = left % 60;
    if (s === lastS) return; lastS = s;
    ds.d.textContent = pad(Math.floor(left / 86400));
    ds.h.textContent = pad(Math.floor(left / 3600) % 24);
    ds.m.textContent = pad(Math.floor(left / 60) % 60);
    ds.s.textContent = pad(s);
    gsap.fromTo(ds.s, { yPercent: -35, opacity: .3 }, { yPercent: 0, opacity: 1, duration: .45, ease: 'expo.out', overwrite: true });
    if (s === 59) gsap.fromTo(ds.m, { yPercent: -35, opacity: .3 }, { yPercent: 0, opacity: 1, duration: .45, ease: 'expo.out' });
  };
  tickTimer();
  const iv = setInterval(tickTimer, 200);

  return () => {
    clearInterval(iv); st.kill(); tl.kill(); if (blink) blink.kill();
    breath.forEach(b => b && b.kill()); grid.removeEventListener('pointerdown', onClick);
    gsap.killTweensOf([...cells, ...fills, numEl, ds.s, ds.m]);
  };
}
