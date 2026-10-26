export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const form = q('.s123__form'), btn = q('.s123__btn'), bw = q('.s123__bw'), lab = q('.s123__lab');
  const sp = q('.s123__sp'), ok = q('.s123__ok path'), okS = q('.s123__ok'), no = q('.s123__no'), noP = qa('.s123__no path'), res = q('.s123__res');
  const F = {}; qa('.s123__f').forEach(f => { F[f.dataset.k] = { el: f, inp: f.querySelector('input'), ck: f.querySelector('.s123__ck path'), msg: f.querySelector('.s123__msg'), valid: false }; });
  const keys = Object.keys(F);
  const RULE = {
    name: v => v.trim().length >= 2 ? '' : '이름을 2자 이상 입력해주세요',
    phone: v => /^01\d-\d{3,4}-\d{4}$/.test(v) ? '' : '연락처를 끝까지 입력해주세요',
    region: v => v.trim().length >= 2 ? '' : '희망 지역을 입력해주세요',
  };
  const fmt = v => { const d = v.replace(/\D/g, '').slice(0, 11); if (d.length <= 3) return d; if (d.length <= 7) return d.slice(0, 3) + '-' + d.slice(3); return d.slice(0, 3) + '-' + d.slice(3, 7) + '-' + d.slice(7); };
  gsap.set(Object.values(F).map(o => o.ck), { drawSVG: '0%' });
  gsap.set([ok, ...noP], { drawSVG: '0%' });

  let user = false, busy = false, vis = false, demo = null;
  const up = k => F[k].el.classList.toggle('is-up', document.activeElement === F[k].inp || F[k].el.classList.contains('is-focus') || F[k].inp.value !== '');
  function setValid(k, ok_) {
    const o = F[k]; if (o.valid === ok_) return; o.valid = ok_;
    gsap.to(o.ck, { drawSVG: ok_ ? '100%' : '0%', duration: ok_ ? .55 : .25, ease: ok_ ? 'power3.out' : 'power2.in', overwrite: 'auto' });
  }
  function showErr(k, text) {
    const o = F[k]; o.el.classList.toggle('is-err', !!text);
    if (text) { o.msg.textContent = text; gsap.fromTo(o.msg, { opacity: 0, y: -6 }, { opacity: 1, y: 0, duration: .5, ease: 'expo.out', overwrite: 'auto' }); }
    else gsap.to(o.msg, { opacity: 0, duration: .25, overwrite: 'auto' });
  }
  function onInput(k) {
    const o = F[k]; if (k === 'phone') o.inp.value = fmt(o.inp.value);
    const bad = RULE[k](o.inp.value);
    setValid(k, !bad); if (!bad) showErr(k, ''); up(k);
  }
  function shake(els) { gsap.fromTo(els, { x: 0 }, { keyframes: [{ x: -6, duration: .06 }, { x: 6, duration: .08 }, { x: -5, duration: .08 }, { x: 5, duration: .08 }, { x: -3, duration: .07 }, { x: 0, duration: .08 }], ease: 'power1.inOut', overwrite: 'auto' }); }

  // 버튼 모프
  let bt = null;
  const full = () => bw.offsetWidth;
  function toIdle(delay = 0) {
    if (bt) bt.kill();
    bt = gsap.timeline({ delay });
    bt.to([sp, okS, no], { opacity: 0, duration: .2 }, 0)
      .to(btn, { width: full(), borderRadius: 18, backgroundColor: '#3d4bff', duration: .7, ease: 'expo.inOut' }, .05)
      .to(lab, { opacity: 1, scale: 1, duration: .4 }, .45)
      .set(btn, { width: '100%' }).set([ok, ...noP], { drawSVG: '0%' });
    return bt;
  }
  function toLoading() {
    if (bt) bt.kill();
    bt = gsap.timeline();
    bt.set(btn, { width: full() })
      .to(lab, { opacity: 0, scale: .8, duration: .2 }, 0)
      .to(btn, { width: 68, borderRadius: 34, duration: .6, ease: 'expo.inOut' }, 0)
      .to(sp, { opacity: 1, duration: .25 }, .35)
      .fromTo(sp, { rotation: 0 }, { rotation: 360, duration: .8, ease: 'none', repeat: -1 }, .35);
    return bt;
  }
  function toResult(good) {
    const el = good ? okS : no;
    gsap.killTweensOf(sp, 'rotation');
    const t = gsap.timeline();
    t.to(sp, { opacity: 0, duration: .2 }, 0)
      .to(btn, { backgroundColor: good ? '#12b886' : '#ff3b5c', duration: .35 }, 0)
      .set(el, { opacity: 1 }, .15)
      .to(good ? ok : noP, { drawSVG: '100%', duration: .5, ease: 'power3.out', stagger: .12 }, .2)
      .fromTo(btn, { scale: .9 }, { scale: 1, duration: .8, ease: 'elastic.out(1,.4)' }, .1);
    if (!good) t.add(() => toIdle(), 1.3);
    return t;
  }
  function submit() {
    if (busy) return; busy = true;
    const bad = keys.filter(k => RULE[k](F[k].inp.value));
    toLoading();
    gsap.delayedCall(.95, () => {
      if (bad.length) {
        bad.forEach(k => showErr(k, RULE[k](F[k].inp.value)));
        shake(bad.map(k => F[k].el)); toResult(false); res.textContent = '';
        gsap.delayedCall(1.4, () => { busy = false; });
      } else {
        toResult(true);
        res.textContent = '접수 완료 · 접수번호 #NR-' + (2000 + Math.floor(Math.random() * 900)) + ' · 영업일 1일 내 연락드립니다';
        gsap.fromTo(res, { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out' });
        gsap.delayedCall(4.5, () => { if (!demo) { clearAll(); } busy = false; });
      }
    });
  }
  function clearAll() {
    keys.forEach(k => { const o = F[k]; o.inp.value = ''; o.el.classList.remove('is-up', 'is-focus', 'is-err'); setValid(k, false); gsap.set(o.msg, { opacity: 0 }); });
    res.textContent = ''; toIdle();
  }

  // 실제 입력
  const offs = [];
  keys.forEach(k => {
    const o = F[k];
    const inp = () => onInput(k), foc = () => { o.el.classList.add('is-focus'); up(k); }, blur = () => { o.el.classList.remove('is-focus'); up(k); const b = RULE[k](o.inp.value); if (o.inp.value && b) showErr(k, b); };
    o.inp.addEventListener('input', inp); o.inp.addEventListener('focus', foc); o.inp.addEventListener('blur', blur);
    offs.push(() => { o.inp.removeEventListener('input', inp); o.inp.removeEventListener('focus', foc); o.inp.removeEventListener('blur', blur); });
  });
  const onSubmit = e => { e.preventDefault(); stopDemo(); submit(); };
  form.addEventListener('submit', onSubmit);
  const stopDemo = () => { if (user) return; user = true; if (demo) { demo.kill(); demo = null; } gsap.killTweensOf(btn); busy = false; clearAll(); };
  const onDown = () => stopDemo();
  form.addEventListener('pointerdown', onDown); form.addEventListener('keydown', onDown);

  // 자동 데모 (가상 입력 → 오류 → 수정 → 성공)
  const type = (tl, k, text, per = .11) => {
    tl.call(() => { F[k].el.classList.add('is-focus'); up(k); });
    for (const ch of text) tl.call(() => { F[k].inp.value += ch; onInput(k); }, null, '+=' + per);
    tl.call(() => { F[k].el.classList.remove('is-focus'); up(k); }, null, '+=.35');
  };
  const press = tl => tl.to(btn, { scale: .94, duration: .12, ease: 'power2.in' }).to(btn, { scale: 1, duration: .5, ease: 'elastic.out(1,.4)' }).call(() => { busy = false; submit(); });
  demo = gsap.timeline({ repeat: -1, paused: true, repeatDelay: 0 });
  demo.call(() => { clearAll(); busy = false; }).to({}, { duration: .7 });
  type(demo, 'name', '김민준');
  type(demo, 'phone', '01012');
  demo.to({}, { duration: .5 });
  press(demo);
  demo.to({}, { duration: 3 });
  demo.call(() => { busy = false; F.phone.el.classList.add('is-focus'); up('phone'); });
  for (const ch of '345678') demo.call(() => { F.phone.inp.value += ch; onInput('phone'); }, null, '+=.12');
  demo.call(() => { F.phone.el.classList.remove('is-focus'); });
  type(demo, 'region', '서울 강남');
  demo.to({}, { duration: .5 });
  press(demo);
  demo.to({}, { duration: 5.6 });
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (demo) demo.paused(!vis); }, { threshold: .25 });
  io.observe(root);
  return () => { io.disconnect(); if (demo) demo.kill(); offs.forEach(f => f()); form.removeEventListener('submit', onSubmit); form.removeEventListener('pointerdown', onDown); form.removeEventListener('keydown', onDown); gsap.killTweensOf([btn, sp, res]); };
}
