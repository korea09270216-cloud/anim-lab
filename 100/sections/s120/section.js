export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const card = q('.s120__card'), grid = q('.s120__grid'), sel = q('.s120__sel');
  const slots = q('.s120__slots'), sd = q('.s120__sd'), sg = q('.s120__sg'), sum = q('.s120__sum');
  const ok = q('.s120__ok'), okl = q('.s120__okl'), okc = q('.s120__ok svg'), okp = q('.s120__ok svg path');
  const fDate = q('[data-f="date"]'), fTime = q('[data-f="time"]');
  const dl = [...sum.querySelectorAll('.s120__dl div')];
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  const W = [420, 720, 1010];
  const TIMES = ['10:00', '10:30', '11:00', '11:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const CLOSED = new Set([4, 5, 12, 13, 19, 20, 26]);

  // 2026-11 : 1일 = 일요일
  const days = [];
  for (let d = 1; d <= 30; d++) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 's120__d'; b.textContent = d;
    const wd = (d - 1) % 7;
    if (wd === 0 || wd === 6) b.classList.add('is-wk');
    else if (CLOSED.has(d)) b.classList.add('is-off');
    b.dataset.d = d; grid.appendChild(b); days.push(b);
  }
  const live = days.filter(b => !b.classList.contains('is-wk') && !b.classList.contains('is-off'));

  let step = 0, day = null, time = null, auto = true, demo = null, done = false;
  gsap.set(slots, { opacity: 0 }); gsap.set(sum, { opacity: 0 });
  gsap.set(okp, { drawSVG: '0% 0%' });

  const ripple = (host, x, y, dur = .9) => {
    const s = document.createElement('i'); s.className = 's120__rp'; s.style.left = x + 'px'; s.style.top = y + 'px';
    host.prepend(s);
    gsap.fromTo(s, { scale: 0 }, { scale: 1.6, duration: dur, ease: 'expo.out' });
    return s;
  };
  const setWidth = (i, d = 1) => { step = Math.max(step, i); return gsap.to(card, { width: W[i], duration: d, ease: 'expo.inOut' }); };

  function moveSel(b, first) {
    const g = grid.getBoundingClientRect(), r = b.getBoundingClientRect();
    const x = r.left - g.left + (r.width - 44) / 2, y = r.top - g.top + (r.height - 44) / 2;
    if (first) gsap.set(sel, { x, y, scale: .3, opacity: 0 });
    gsap.to(sel, { x, y, scale: 1, opacity: 1, duration: first ? .6 : .7, ease: 'expo.out', overwrite: 'auto' });
  }

  function buildSlots(d) {
    sg.innerHTML = '';
    TIMES.forEach((t, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 's120__t';
      if ((d * 7 + i * 5) % 6 === 0 || (d + i) % 7 === 3) b.classList.add('is-off');
      b.innerHTML = '<span>' + t + '</span>'; b.dataset.t = t; sg.appendChild(b);
    });
    // 3열 x 4행 대신 3열 x 4행: 열 단위(axis x)로 stagger
    const els = [...sg.children];
    gsap.fromTo(els, { opacity: 0, y: 18, scale: .94 }, { opacity: 1, y: 0, scale: 1, duration: .8, ease: 'expo.out', stagger: { each: .05, grid: [4, 3], from: 'start', axis: 'x' } });
  }

  function pickDay(b, fromDemo) {
    if (done) resetConfirm();
    const d = +b.dataset.d, wd = WD[(d - 1) % 7];
    days.forEach(x => x.classList.toggle('is-on', x === b));
    moveSel(b, day === null);
    day = d; time = null;
    sd.textContent = '11월 ' + d + '일 ' + wd + '요일';
    fDate.textContent = '11월 ' + d + '일 (' + wd + ')'; fTime.textContent = '-';
    if (step < 1) { gsap.to(slots, { opacity: 1, duration: .6, delay: .35, ease: 'power2.out' }); setWidth(1, 1.05); gsap.delayedCall(.5, () => buildSlots(d)); }
    else { if (step >= 2) gsap.to(sum, { opacity: .35, duration: .3 }); buildSlots(d); }
  }

  function pickTime(b) {
    if (b.classList.contains('is-off')) return;
    if (done) resetConfirm();
    [...sg.children].forEach(x => x.classList.remove('is-on'));
    const r = b.getBoundingClientRect(), br = b.getBoundingClientRect();
    ripple(b, r.width / 2, r.height / 2, .7);
    b.classList.add('is-on'); time = b.dataset.t;
    fTime.textContent = (+time.slice(0, 2) < 12 ? '오전 ' : '오후 ') + time;
    if (step < 2) {
      gsap.to(sum, { opacity: 1, duration: .6, delay: .4, ease: 'power2.out' });
      setWidth(2, 1.05);
      gsap.fromTo([...dl, ok], { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .07, delay: .6, ease: 'expo.out' });
    } else gsap.to(sum, { opacity: 1, duration: .3 });
  }

  function confirm() {
    if (done || !time) return;
    done = true;
    const r = ok.getBoundingClientRect();
    ripple(ok, r.width / 2, r.height / 2, 1);
    gsap.to(okl, { opacity: 0, y: -10, duration: .25, ease: 'power2.in' });
    gsap.set(okc, { opacity: 1 });
    gsap.to(okp, { drawSVG: '0% 100%', duration: .55, delay: .45, ease: 'power3.out' });
    gsap.delayedCall(.5, () => { ok.classList.add('is-done'); okl.textContent = '예약 확정'; gsap.fromTo(okl, { opacity: 0, x: 8 }, { opacity: 1, x: 12, y: 0, duration: .5, ease: 'expo.out' }); gsap.to(okc, { x: -48, duration: .6, ease: 'expo.out' }); });
  }
  function resetConfirm() {
    done = false; ok.classList.remove('is-done'); okl.textContent = '이 일정으로 확정';
    gsap.set(okl, { opacity: 1, x: 0, y: 0 }); gsap.set(okc, { opacity: 0, x: 0 }); gsap.set(okp, { drawSVG: '0% 0%' });
    ok.querySelectorAll('.s120__rp').forEach(n => n.remove());
  }
  function resetAll(instant) {
    const tl = gsap.timeline();
    tl.to([slots, sum], { opacity: 0, duration: .35, ease: 'power2.in' })
      .to(card, { width: W[0], duration: .9, ease: 'expo.inOut' }, '>-.05')
      .to(sel, { opacity: 0, scale: .3, duration: .4, ease: 'power2.in' }, 0)
      .call(() => { days.forEach(x => x.classList.remove('is-on')); sg.innerHTML = ''; sd.textContent = '날짜를 선택해 주세요'; resetConfirm(); step = 0; day = null; time = null; });
    return tl;
  }

  const onDay = e => { const b = e.currentTarget; if (b.classList.contains('is-off') || b.classList.contains('is-wk')) return; if (e.isTrusted) stopAuto(); pickDay(b); };
  days.forEach(b => b.addEventListener('click', onDay));
  const onSlot = e => { const b = e.target.closest('.s120__t'); if (b && e.isTrusted) { stopAuto(); pickTime(b); } };
  sg.addEventListener('click', onSlot);
  const onOk = e => { if (e.isTrusted) { stopAuto(); confirm(); } };
  ok.addEventListener('click', onOk);

  // 자동 데모 (날짜 번갈아)
  const picks = [[18, '14:30'], [25, '11:00'], [10, '15:00']];
  let pi = 0;
  const cycle = () => {
    if (!auto) return;
    const [d, t] = picks[pi++ % picks.length];
    demo = gsap.timeline({ onComplete: cycle });
    demo.call(() => pickDay(live.find(b => +b.dataset.d === d)), null, 1.0)
      .call(() => { const b = [...sg.children].find(x => x.dataset.t === t && !x.classList.contains('is-off')) || [...sg.children].find(x => !x.classList.contains('is-off')); b && pickTime(b); }, null, 3.4)
      .call(confirm, null, 6.2)
      .add(resetAll(), 9.0)
      .to({}, { duration: .5 }, '>');
  };
  const stopAuto = () => { auto = false; if (demo) demo.kill(); };
  root.addEventListener('pointerdown', e => { if (e.isTrusted) stopAuto(); }, { once: false });
  demo = gsap.delayedCall(.4, cycle);

  return () => {
    stopAuto();
    days.forEach(b => b.removeEventListener('click', onDay)); sg.removeEventListener('click', onSlot); ok.removeEventListener('click', onOk);
    gsap.killTweensOf([card, slots, sum, sel, ok, okl, okc, okp, ...dl]);
  };
}
