export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const SIZES = [
    { n: '소형 테이크아웃', big: '10평', d: '역세권 · 오피스 상권', fee: 1100, py: 10 },
    { n: '일반 카페', big: '18평', d: '주거 · 근린 상권', fee: 1500, py: 18 },
    { n: '대형 플래그십', big: '30평', d: '대로변 · 복합 상권', fee: 2000, py: 30 }
  ];
  const INTS = [
    { n: '스탠다드', big: '200', d: '평당 약 200만원 · 깔끔한 기본형', u: 200 },
    { n: '프리미엄', big: '280', d: '평당 약 280만원 · 포인트 마감재', u: 280 },
    { n: '시그니처', big: '380', d: '평당 약 380만원 · 브랜드 전용 연출', u: 380 }
  ];
  const EQ = [
    { n: '베이직 머신', big: 'BASIC', d: '에스프레소 1대 · 기본 장비', c: 1400, sizes: [0, 1, 2] },
    { n: '풀 바리스타 바', big: 'PRO', d: '머신 2대 · 그라인더 · 제빙기', c: 2300, sizes: [0, 1, 2] },
    { n: '베이커리 주방', big: 'FULL', d: '오븐 · 발효기 · 쇼케이스 라인', c: 3600, sizes: [1, 2] }
  ];
  const OPT = [
    { n: '무인 키오스크', c: 450, sizes: [0, 1, 2] },
    { n: '배달 설비', c: 600, sizes: [0, 1, 2] },
    { n: '테라스 시공', c: 900, sizes: [1, 2] },
    { n: '디저트 쇼케이스', c: 700, eq: [1, 2] },
    { n: '멤버십 앱 연동', c: 350, sizes: [0, 1, 2] }
  ];
  const WHEN = ['즉시', '3개월 내', '6개월 내'];
  const fmt = n => Math.round(n).toLocaleString();

  const panels = $$('.s110__panel');
  const sel = { size: -1, int: -1, eq: -1, opts: [], name: '', tel: '', when: -1 };
  let step = 0, busy = false, demoOn = true, inView = false, call = null, dead = false, run = 0;
  const stepNo = $('.s110__step-no b'), segs = $$('.s110__segs i'), back = $('.s110__back');
  const savedEl = $('.s110__saved'), savedTxt = $('.s110__saved span'), toast = $('.s110__toast');
  const KEY = 's110-wizard', DKEY = 's110-demo';

  /* 옵션 카드 생성 */
  const card = (o, k, i, extra) => `<button type="button" class="s110__opt" data-k="${k}" data-i="${i}">${o.big ? `<big>${o.big}</big>` : ''}<strong>${o.n}</strong>${extra}</button>`;
  $('[data-k="size"]').innerHTML = SIZES.map((o, i) => card(o, 'size', i, `<em>${o.d}</em>`)).join('');
  $('[data-k="int"]').innerHTML = INTS.map((o, i) => card(o, 'int', i, `<em>${o.d}</em>`)).join('');
  $('[data-k="eq"]').innerHTML = EQ.map((o, i) => card(o, 'eq', i, `<em>${o.d}</em>`)).join('');
  $('[data-k="opt"]').innerHTML = OPT.map((o, i) => card(o, 'opt', i, `<em>+${fmt(o.c)}만</em>`)).join('');

  const allowed = el => {
    const k = el.dataset.k, i = +el.dataset.i;
    if (k === 'eq') return EQ[i].sizes.includes(sel.size);
    if (k === 'opt') { const o = OPT[i]; return (!o.sizes || o.sizes.includes(sel.size)) && (!o.eq || o.eq.includes(sel.eq)); }
    return true;
  };

  /* 견적 */
  const est = { lo: 0, hi: 0, fee: 0, build: 0, eq: 0, opt: 0 };
  const loEl = $('.s110__lo'), hiEl = $('.s110__hi');
  const bd = {}; $$('.s110__bd li').forEach(li => { bd[li.dataset.b] = { em: $('em', li), bar: $('i b', li) }; });
  function calc() {
    if (sel.size < 0) return { fee: 0, build: 0, eq: 0, opt: 0, total: 0 };
    const s = SIZES[sel.size];
    const fee = s.fee, build = s.py * INTS[Math.max(0, sel.int)].u;
    const eq = EQ[sel.eq >= 0 ? sel.eq : 0].c;
    const opt = sel.opts.reduce((a, i) => a + OPT[i].c, 0);
    return { fee, build, eq, opt, total: fee + build + eq + opt };
  }
  function paint() {
    loEl.textContent = fmt(est.lo); hiEl.textContent = fmt(est.hi);
    for (const k of ['fee', 'build', 'eq', 'opt']) { bd[k].em.textContent = fmt(est[k]) + '만'; gsap.set(bd[k].bar, { scaleX: Math.max(0, Math.min(1, est[k] / 11000)) }); }
  }
  function updateEst() {
    const c = calc();
    const lo = c.total ? Math.floor(c.total * .93 / 10) * 10 : 0, hi = c.total ? Math.ceil(c.total * 1.07 / 10) * 10 : 0;
    gsap.to(est, { lo, hi, fee: c.fee, build: c.build, eq: c.eq, opt: c.opt, duration: 1.5, ease: 'elastic.out(1,.55)', overwrite: true, onUpdate: paint });
    const sum = $('.s110__sum'); const tags = [];
    if (sel.size >= 0) tags.push(SIZES[sel.size].n);
    if (sel.int >= 0) tags.push(INTS[sel.int].n);
    if (sel.eq >= 0) tags.push(EQ[sel.eq].n);
    sel.opts.forEach(i => tags.push(OPT[i].n));
    sum.innerHTML = tags.map(t => `<span>${t}</span>`).join('');
    gsap.from($$('span', sum).slice(-1), { scale: .5, opacity: 0, duration: .6, ease: 'back.out(2.4)' });
  }

  /* 저장 */
  function save(flash) {
    const key = demoOn ? DKEY : KEY;
    try { sessionStorage.setItem(key, JSON.stringify({ step, ...sel })); } catch (e) { }
    const d = new Date();
    savedTxt.textContent = '임시저장됨 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    if (flash !== false) gsap.fromTo($('em', savedEl), { scale: 2.4 }, { scale: 1, duration: .6, ease: 'expo.out' });
  }
  function say(t) { toast.textContent = t; gsap.fromTo(toast, { opacity: 0, x: -10 }, { opacity: 1, x: 0, duration: .6, ease: 'expo.out' }); gsap.to(toast, { opacity: 0, delay: 3, duration: .6 }); }

  /* 필터링 (Flip) */
  function applyFilter(i) {
    const p = panels[i]; if (!p) return;
    const items = $$('.s110__opt', p); if (!items.length) return;
    const state = Flip.getState(items);
    let hid = 0;
    items.forEach(el => { const h = !allowed(el); if (h) hid++; el.classList.toggle('is-hide', h); });
    Flip.from(state, { duration: .8, ease: 'expo.out', absolute: true, onLeave: els => gsap.to(els, { opacity: 0, scale: .6, duration: .4 }) });
    const f = $('.s110__filt', p); if (f) gsap.to(f, { opacity: hid ? 1 : 0, duration: .6, delay: .4 });
  }
  function syncMarks() {
    $$('.s110__opt', root).forEach(el => {
      const k = el.dataset.k, i = +el.dataset.i;
      el.classList.toggle('is-on', k === 'opt' ? sel.opts.includes(i) : sel[k] === i);
    });
    $$('.s110__when button').forEach((b, i) => b.classList.toggle('is-on', sel.when === i));
  }

  /* 단계 이동 */
  function go(n, dir) {
    if (n < 0 || n > 5) return;
    busy = true;
    const from = panels[step]; step = n;
    gsap.to(from, { x: -dir * 70, opacity: 0, duration: .45, ease: 'power3.in', onComplete: () => gsap.set(from, { autoAlpha: 0, x: 0, opacity: 1 }) });
    if (n === 2 || n === 3) applyFilter(n);
    const p = panels[n];
    gsap.set(p, { autoAlpha: 1 });
    gsap.fromTo(p, { x: dir * 80, opacity: 0 }, { x: 0, opacity: 1, duration: .9, ease: 'expo.out', delay: .2 });
    gsap.fromTo($$('.s110__opt,.s110__form>*,.s110__next,.s110__check,.s110__sub,.s110__again', p), { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: .8, stagger: .05, delay: .3, ease: 'expo.out', clearProps: 'transform' });
    const shown = Math.min(n + 1, 5);
    gsap.to(stepNo, { yPercent: -dir * 100, duration: .25, ease: 'power2.in', onComplete: () => { stepNo.textContent = shown; gsap.fromTo(stepNo, { yPercent: dir * 100 }, { yPercent: 0, duration: .55, ease: 'expo.out' }); } });
    segs.forEach((s, i) => gsap.to(s, { '--f': i < shown ? 1 : 0, duration: .8, ease: 'expo.out' }));
    back.disabled = n === 0 || n === 5;
    gsap.delayedCall(.5, () => { busy = false; });
    save();
  }
  function pick(k, i) {
    if (busy) return;
    if (k === 'opt') {
      const at = sel.opts.indexOf(i);
      if (at >= 0) sel.opts.splice(at, 1); else sel.opts.push(i);
      syncMarks(); updateEst(); save(); return;
    }
    const prev = sel[k]; sel[k] = i;
    if (k === 'size' && prev !== i) { sel.eq = EQ[sel.eq] && EQ[sel.eq].sizes.includes(i) ? sel.eq : -1; sel.opts = sel.opts.filter(o => !OPT[o].sizes || OPT[o].sizes.includes(i)); }
    if (k === 'eq') sel.opts = sel.opts.filter(o => !OPT[o].eq || OPT[o].eq.includes(i));
    syncMarks(); updateEst(); save();
    const el = $(`.s110__opt[data-k="${k}"][data-i="${i}"]`);
    gsap.fromTo(el, { scale: .96 }, { scale: 1, duration: .6, ease: 'elastic.out(1,.5)' });
    gsap.delayedCall(.55, () => go(step + 1, 1));
  }
  function submit() {
    const nm = $('.s110__in-name').value.trim(), tel = $('.s110__in-tel').value.replace(/\D/g, '');
    if (nm.length < 2 || tel.length < 9) { gsap.fromTo($('.s110__submit'), { x: -8 }, { x: 0, duration: .6, ease: 'elastic.out(1,.2)' }); say('성함과 연락처를 확인해 주세요'); return; }
    go(5, 1);
    gsap.fromTo($('.s110__check circle'), { drawSVG: '0%' }, { drawSVG: '100%', duration: .8, delay: .5, ease: 'power2.out' });
    gsap.fromTo($('.s110__check path'), { drawSVG: '0%' }, { drawSVG: '100%', duration: .6, delay: 1.1, ease: 'power2.out' });
    try { sessionStorage.removeItem(KEY); } catch (e) { }
  }
  function reset() {
    sel.size = sel.int = sel.eq = sel.when = -1; sel.opts = []; sel.name = sel.tel = '';
    $('.s110__in-name').value = ''; $('.s110__in-tel').value = '';
    $$('.s110__opt').forEach(el => el.classList.remove('is-hide'));
    syncMarks(); updateEst(); go(0, -1);
  }

  /* 입력 */
  const stopDemo = () => { if (!demoOn) return; demoOn = false; if (call) call.kill(); $$('.is-hot').forEach(e => e.classList.remove('is-hot')); };
  const onClick = e => {
    const o = e.target.closest('.s110__opt'); if (o) { return pick(o.dataset.k, +o.dataset.i); }
    if (e.target.closest('.s110__next')) { if (!busy) go(4, 1); return; }
    if (e.target.closest('.s110__back')) { if (!busy && step > 0) go(step - 1, -1); return; }
    const w = e.target.closest('.s110__when button'); if (w) { sel.when = +w.dataset.w; syncMarks(); save(); return; }
    if (e.target.closest('.s110__submit')) return submit();
    if (e.target.closest('.s110__again')) return reset();
  };
  const onInput = e => {
    if (e.target.classList.contains('s110__in-tel')) {
      const d = e.target.value.replace(/\D/g, '').slice(0, 11);
      e.target.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
    }
    sel.name = $('.s110__in-name').value; sel.tel = $('.s110__in-tel').value; save(false);
  };
  root.addEventListener('click', onClick);
  root.addEventListener('input', onInput);
  root.addEventListener('pointerdown', stopDemo);
  root.addEventListener('keydown', stopDemo);
  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: .35 });
  io.observe(root);

  /* 초기화 + 임시저장 복원 */
  gsap.set(panels, { autoAlpha: 0 });
  let restored = false;
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (d && d.size >= 0 && d.step < 5) {
        Object.assign(sel, { size: d.size, int: d.int, eq: d.eq, opts: d.opts || [], name: d.name || '', tel: d.tel || '', when: d.when ?? -1 });
        $('.s110__in-name').value = sel.name; $('.s110__in-tel').value = sel.tel;
        step = d.step; restored = true;
        $$('.s110__opt').forEach(el => el.classList.toggle('is-hide', !allowed(el)));
      }
    }
  } catch (e) { }
  gsap.set(panels[step], { autoAlpha: 1 });
  const shown0 = Math.min(step + 1, 5);
  stepNo.textContent = shown0; segs.forEach((s, i) => gsap.set(s, { '--f': i < shown0 ? 1 : 0 }));
  back.disabled = step === 0;
  syncMarks(); updateEst(); savedTxt.textContent = '임시저장 대기';
  if (restored) { demoOn = false; say('이전에 입력한 내용을 불러왔어요'); save(false); }

  /* 자동 데모 */
  const wait = s => new Promise(r => { call = gsap.delayedCall(s, r); });
  async function hot(k, i) {
    const el = $(`.s110__opt[data-k="${k}"][data-i="${i}"]`);
    el.classList.add('is-hot'); await wait(.85); if (!demoOn || dead) return false;
    el.classList.remove('is-hot'); return true;
  }
  async function typeInto(input, text, key) {
    const o = { n: 0 };
    await new Promise(r => { call = gsap.to(o, { n: text.length, duration: text.length * .09, ease: 'none', onUpdate: () => { input.value = text.slice(0, Math.round(o.n)); sel[key] = input.value; }, onComplete: r }); });
  }
  async function demo() {
    const scripts = [
      { size: 1, int: 1, eq: 1, opts: [0, 1], name: '김하늘', tel: '010-5521-8830', when: 1 },
      { size: 2, int: 2, eq: 2, opts: [2, 3, 4], name: '이도윤', tel: '010-3307-1294', when: 0 },
      { size: 0, int: 0, eq: 0, opts: [0], name: '박서연', tel: '010-9184-4417', when: 2 }
    ];
    while (demoOn && !dead) {
      while (!inView) { await wait(.4); if (!demoOn || dead) return; }
      const sc = scripts[run++ % scripts.length];
      for (const k of ['size', 'int', 'eq']) { if (!(await hot(k, sc[k]))) return; pick(k, sc[k]); await wait(1.5); if (!demoOn) return; }
      for (const i of sc.opts) { if (!(await hot('opt', i))) return; pick('opt', i); await wait(.3); }
      await wait(.7); if (!demoOn) return;
      $('.s110__next').classList.add('is-hot'); go(4, 1); await wait(1.1); if (!demoOn) return;
      await typeInto($('.s110__in-name'), sc.name, 'name'); if (!demoOn) return;
      await typeInto($('.s110__in-tel'), sc.tel, 'tel'); if (!demoOn) return;
      sel.when = sc.when; syncMarks(); save(false); await wait(2.6); if (!demoOn) return;
      reset(); await wait(1.6);
    }
  }
  if (demoOn) call = gsap.delayedCall(1.4, demo);

  return () => {
    dead = true;
    root.removeEventListener('click', onClick);
    root.removeEventListener('input', onInput);
    root.removeEventListener('pointerdown', stopDemo);
    root.removeEventListener('keydown', stopDemo);
    io.disconnect();
    if (call) call.kill();
    gsap.killTweensOf([est, panels, stepNo, toast]);
  };
}
