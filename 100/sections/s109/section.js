export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const T = [
    { n: '부업형', col: '#ff6b2c', invest: 6800, sales: 2400, payback: 19, size: 8, staff: 1, mode: '퇴근 후 · 주말 중심 운영', sup: '무인 키오스크 · 원팩 조리 세팅' },
    { n: '부부형', col: '#e23d72', invest: 9500, sales: 3800, payback: 16, size: 12, staff: 2, mode: '부부 교대 근무 · 주 6일', sup: '동반 교육 2주 · 인건비 절감 동선' },
    { n: '은퇴형', col: '#0f9d8a', invest: 13200, sales: 4100, payback: 20, size: 15, staff: 2, mode: '오전 오픈 · 주 5일 운영', sup: '저체력 동선 설계 · 사후 케어' },
    { n: '다점포형', col: '#4a5be0', invest: 24000, sales: 8200, payback: 22, size: 22, staff: 6, mode: '점장 체제 · 관리 위주', sup: '2호점 로열티 감면 · 전담 SV' }
  ];
  const KEYS = ['invest', 'sales', 'payback', 'size', 'staff'];
  const MAX = {}; KEYS.forEach(k => { MAX[k] = Math.max(...T.map(t => t[k])); });
  const seg = $('.s109__seg'), btns = $$('.s109__seg button'), ind = $('.s109__ind'), badge = $('.s109__badge');
  const range = $('.s109__range'), bv = $('.s109__bv');
  const rows = $$('.s109__row');
  let cur = -1, rec = -1, demoOn = true, inView = false, call = null, dead = false;
  let indX = 0, indW = 100;

  const fmtBudget = m => {
    if (m < 10000) return m.toLocaleString() + '만원';
    const e = Math.floor(m / 10000), r = m % 10000;
    return e + '억' + (r ? ' ' + r.toLocaleString() + '만원' : '원');
  };
  const recommend = b => { let k = 0; T.forEach((t, i) => { if (t.invest <= b) k = i; }); return k; };

  /* 숫자 릴 */
  function setReel(el, val, delay) {
    const str = val.toLocaleString();
    const sig = [...str].map(c => /\d/.test(c) ? 'd' : 'c').join('');
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig;
      el.innerHTML = [...str].map(c => /\d/.test(c)
        ? `<span class="d"><i>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<span>${n}</span>`).join('')}</i></span>`
        : `<span class="c">${c}</span>`).join('');
      $$('.d i', el).forEach(s => gsap.set(s, { yPercent: -((Math.random() * 9 | 0) + 1) * 10 }));
    }
    let k = 0;
    $$('.d i', el).forEach(s => {
      const digit = +[...str].filter(c => /\d/.test(c))[k++];
      gsap.to(s, { yPercent: -digit * 10, duration: 1.15, delay: delay + k * .05, ease: 'expo.out', overwrite: true });
    });
  }
  function swapText(el, text, delay) {
    const old = $('.s109__txt:last-child', el);
    if (old && old.textContent === text) return;
    const nw = document.createElement('span'); nw.className = 's109__txt'; nw.textContent = text;
    if (!old) { el.appendChild(nw); return; }
    nw.style.position = 'absolute'; nw.style.left = 0; nw.style.top = 0;
    el.appendChild(nw);
    gsap.fromTo(nw, { yPercent: 110 }, { yPercent: 0, duration: .8, delay, ease: 'expo.out' });
    gsap.to(old, { yPercent: -110, duration: .6, delay, ease: 'expo.in', onComplete: () => { old.remove(); nw.style.position = ''; } });
  }

  function render(i) {
    const t = T[i];
    rows.forEach((row, ri) => {
      const k = row.dataset.k, d = ri * .07;
      if (row.dataset.kind === 'num') {
        setReel($('.s109__reel', row), t[k], d);
        gsap.to($('.s109__bar b', row), { scaleX: Math.max(.08, t[k] / MAX[k]), duration: 1.1, delay: d, ease: 'expo.out' });
      } else swapText($('.s109__v', row), t[k], d);
    });
  }

  function place(i, animate) {
    const b = btns[i], x1 = b.offsetLeft, w1 = b.offsetWidth;
    gsap.killTweensOf(ind);
    if (!animate) { gsap.set(ind, { x: x1, width: w1, backgroundColor: T[i].col }); indX = x1; indW = w1; return; }
    const lo = Math.min(indX, x1), span = Math.abs(x1 - indX) + w1;
    gsap.timeline()
      .to(ind, { x: lo, width: span, duration: .28, ease: 'power3.in' })
      .to(ind, { x: x1, width: w1, duration: .6, ease: 'expo.out' })
      .to(ind, { backgroundColor: T[i].col, duration: .5 }, 0);
    indX = x1; indW = w1;
  }
  function select(i, animate = true) {
    if (i === cur) return;
    cur = i;
    btns.forEach((b, k) => b.classList.toggle('is-on', k === i));
    place(i, animate);
    root.style.setProperty('--acc', T[i].col);
    render(i);
  }
  function moveBadge(animate = true) {
    const b = btns[rec];
    const x = b.offsetLeft + b.offsetWidth / 2;
    if (!animate) { gsap.set(badge, { x }); return; }
    gsap.to(badge, { x, duration: .8, ease: 'expo.out', overwrite: true });
    gsap.fromTo(badge, { y: -8 }, { y: 0, duration: .7, ease: 'elastic.out(1,.5)' });
  }
  function setBudget(v, fromUser) {
    range.value = v;
    const val = +range.value;
    bv.textContent = fmtBudget(val);
    range.style.setProperty('--p', ((val - +range.min) / (+range.max - +range.min) * 100) + '%');
    const r = recommend(val);
    if (r !== rec) { rec = r; moveBadge(); }
  }

  /* 입력 */
  const stopDemo = () => { demoOn = false; if (call) call.kill(); gsap.killTweensOf(prox); };
  const onTab = e => { const b = e.target.closest('button[data-i]'); if (b) { stopDemo(); select(+b.dataset.i); } };
  const onRange = () => { stopDemo(); setBudget(+range.value, true); };
  seg.addEventListener('click', onTab);
  range.addEventListener('input', onRange);
  root.addEventListener('pointerdown', e => { if (e.target.closest('.s109__panel,.s109__budget')) stopDemo(); });
  const onResize = () => { place(cur, false); moveBadge(false); };
  window.addEventListener('resize', onResize);
  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: .35 });
  io.observe(root);

  /* 초기 + 자동 데모 */
  gsap.set(badge, { xPercent: -50 });
  setBudget(12000);
  select(1, false); moveBadge(false);
  const prox = { v: 12000 };
  const budgets = [9000, 20000, 7000, 14000];
  let n = 0;
  function step() {
    if (!demoOn || dead) return;
    if (!inView) { call = gsap.delayedCall(.5, step); return; }
    const i = n % 4;
    select(i);
    prox.v = +range.value;
    gsap.to(prox, { v: budgets[n % 4], duration: 1.4, ease: 'power2.inOut', onUpdate: () => setBudget(Math.round(prox.v / 500) * 500) });
    n++;
    call = gsap.delayedCall(2.5, step);
  }
  call = gsap.delayedCall(1.4, () => { n = 2; step(); });

  return () => {
    dead = true;
    seg.removeEventListener('click', onTab);
    range.removeEventListener('input', onRange);
    window.removeEventListener('resize', onResize);
    io.disconnect();
    if (call) call.kill();
    gsap.killTweensOf([ind, badge, prox]);
    $$('.d i, .s109__bar b, .s109__txt', root).forEach(e => gsap.killTweensOf(e));
  };
}
