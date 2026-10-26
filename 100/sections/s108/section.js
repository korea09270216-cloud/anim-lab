export default function init(root, ctx) {
  const $ = (s, r = root) => r.querySelector(s);
  const $$ = (s, r = root) => [...r.querySelectorAll(s)];
  const DATA = {
    '서울': { sv: ['박소윤', '수도권 서부 담당', '02-555-0142'], gu: [['강남구', 'x'], ['마포구', 'o'], ['성동구', 'm'], ['송파구', 'o'], ['노원구', 'o']] },
    '경기': { sv: ['정민재', '경기 남부 담당', '031-555-0178'], gu: [['수원시', 'o'], ['성남시', 'm'], ['고양시', 'o'], ['용인시', 'x'], ['부천시', 'o']] },
    '인천': { sv: ['한지우', '인천·서해안 담당', '032-555-0119'], gu: [['남동구', 'o'], ['부평구', 'm'], ['연수구', 'x'], ['서구', 'o']] },
    '부산': { sv: ['오태현', '부산·경남 담당', '051-555-0136'], gu: [['해운대구', 'o'], ['수영구', 'x'], ['부산진구', 'm'], ['동래구', 'o']] },
    '대구': { sv: ['윤서진', '대구·경북 담당', '053-555-0127'], gu: [['수성구', 'o'], ['달서구', 'm'], ['중구', 'x'], ['북구', 'o']] },
    '대전': { sv: ['김도하', '충청권 담당', '042-555-0164'], gu: [['유성구', 'o'], ['서구', 'm'], ['중구', 'o'], ['동구', 'x']] },
    '광주': { sv: ['최나래', '호남권 담당', '062-555-0151'], gu: [['북구', 'o'], ['서구', 'o'], ['광산구', 'm'], ['남구', 'x']] }
  };
  const ST = { o: '가능', m: '협의', x: '마감' };
  const F = { sido: $('[data-f="sido"]'), gu: $('[data-f="gu"]') };
  const sel = k => $('.s108__sel', F[k]), menu = k => $('.s108__menu', F[k]);
  const paper = $('.s108__paper'), regionB = $('.s108__region b'), msg = $('.s108__msg'), alt = $('.s108__alt');
  const stamp = $('.s108__stamp'), stampB = $('.s108__stamp b'), ripple = $('.s108__ripple'), noEl = $('.s108__no');
  const sv = $('.s108__sv'), svName = $('.s108__sv-name'), svTel = $('.s108__sv-tel'), avatar = $('.s108__av'), book = $('.s108__book');
  const cursor = $('.s108__cursor');
  const state = { sido: null, gu: null, open: null };
  let demoOn = true, inView = false, dead = false, call = null, rtl = null;

  regionB.classList.add('is-empty');
  book.classList.add('is-off');

  /* 드롭다운 */
  function build(k, items) {
    menu(k).innerHTML = items.map(n => `<li role="option"><button type="button" data-v="${n}">${n}</button></li>`).join('');
  }
  build('sido', Object.keys(DATA));
  function openMenu(k) {
    if (state.open && state.open !== k) closeMenu(state.open);
    if (state.open === k) return;
    state.open = k;
    sel(k).setAttribute('aria-expanded', 'true');
    const m = menu(k);
    gsap.killTweensOf(m);
    gsap.set(m, { visibility: 'visible' });
    gsap.fromTo(m, { clipPath: 'inset(0 0 100% 0 round 18px)' }, { clipPath: 'inset(0 0 0% 0 round 18px)', duration: .6, ease: 'expo.out' });
    gsap.fromTo($$('button', m), { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: .55, stagger: .035, ease: 'expo.out' });
  }
  function closeMenu(k) {
    if (state.open !== k) return;
    state.open = null;
    sel(k).setAttribute('aria-expanded', 'false');
    const m = menu(k);
    gsap.killTweensOf(m);
    gsap.to(m, { clipPath: 'inset(0 0 100% 0 round 18px)', duration: .32, ease: 'power3.in', onComplete: () => gsap.set(m, { visibility: 'hidden' }) });
  }
  const setLabel = (k, text, on) => { const s = sel(k); $('b', s).textContent = text; s.classList.toggle('is-set', !!on); };

  /* 결과 */
  function clearResult() {
    if (rtl) rtl.kill();
    gsap.to([stamp, sv], { autoAlpha: 0, duration: .25 });
    gsap.to([msg, alt], { opacity: 0, duration: .2 });
    book.classList.add('is-off');
  }
  function showResult(si, gu, st) {
    const d = DATA[si];
    const sum = [...(si + gu)].reduce((a, c) => a + c.charCodeAt(0), 0);
    noEl.textContent = String(1000 + sum % 9000);
    regionB.classList.remove('is-empty');
    regionB.textContent = si + ' ' + gu;
    msg.textContent = st === 'o' ? `상담 가능 · 신규 가맹 잔여 ${sum % 3 + 1}점포` : st === 'm' ? '상권 조사 후 협의 · 담당 SV 가 현장을 검토합니다' : '현재 마감 · 대기 명단에 등록할 수 있어요';
    const near = d.gu.filter(g => g[1] === 'o' && g[0] !== gu).slice(0, 2).map(g => g[0]);
    alt.textContent = st === 'o' ? '인근 지역과 동시 오픈 상담도 가능합니다' : near.length ? '인근 가능 지역 · ' + near.join(', ') : '인근 가능 지역을 상담에서 안내드려요';
    stamp.className = 's108__stamp s108__stamp--' + st;
    stampB.textContent = ST[st];
    svName.firstChild.textContent = d.sv[0] + ' ';
    $('span', svName).textContent = d.sv[1];
    svTel.textContent = d.sv[2] + ' · 평일 09:00–18:00';
    avatar.textContent = d.sv[0].slice(0, 1);
    book.textContent = st === 'x' ? '대기 등록' : '상담 예약';
    book.classList.toggle('is-off', st === 'x');

    rtl = gsap.timeline();
    rtl.fromTo(regionB, { yPercent: 100, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .8, ease: 'expo.out' }, 0)
      .fromTo(stamp, { scale: 3.4, rotation: -28, autoAlpha: 0 }, { scale: 1, rotation: -9, autoAlpha: 1, duration: .27, ease: 'power4.in' }, .25)
      .fromTo(paper, { y: 0 }, { y: 9, duration: .06, repeat: 3, yoyo: true, ease: 'sine.inOut' }, .52)
      .fromTo(stamp, { scaleX: 1.09, scaleY: .91 }, { scaleX: 1, scaleY: 1, duration: .6, ease: 'elastic.out(1,.35)' }, .52)
      .fromTo(ripple, { scale: .3, opacity: .55, color: st === 'o' ? '#14815a' : st === 'm' ? '#d98a0b' : '#d3342b' }, { scale: 2.5, opacity: 0, duration: .9, ease: 'expo.out' }, .52)
      .fromTo([msg, alt], { opacity: 0, y: 14 }, { opacity: 1, y: 0, stagger: .1, duration: .7, ease: 'expo.out' }, .62)
      .fromTo(sv, { x: 110, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 1.1, ease: 'expo.out' }, .8)
      .fromTo([avatar, '.s108__sv-body > *', book], { opacity: 0, x: 24 }, { opacity: 1, x: 0, stagger: .06, duration: .8, ease: 'expo.out' }, '-=.9');
  }

  function pickSido(n) {
    closeMenu('sido');
    state.sido = n; state.gu = null;
    setLabel('sido', n, true);
    setLabel('gu', '시·군·구를 선택하세요', false);
    build('gu', DATA[n].gu.map(g => g[0]));
    F.gu.classList.remove('is-off');
    gsap.fromTo(F.gu, { y: 10 }, { y: 0, duration: .7, ease: 'expo.out' });
    clearResult();
    regionB.classList.add('is-empty'); regionB.textContent = n + ' · 시·군·구를 선택하세요';
  }
  function pickGu(n) {
    closeMenu('gu');
    state.gu = n;
    setLabel('gu', n, true);
    clearResult();
    const st = DATA[state.sido].gu.find(g => g[0] === n)[1];
    gsap.delayedCall(.35, () => showResult(state.sido, n, st));
  }

  /* 입력 */
  const stopDemo = () => { if (!demoOn) return; demoOn = false; if (call) call.kill(); gsap.to(cursor, { opacity: 0, duration: .3 }); $$('.is-hot').forEach(e => e.classList.remove('is-hot')); };
  const onClick = e => {
    const s = e.target.closest('.s108__sel');
    if (s) { const k = s.parentElement.dataset.f; return state.open === k ? closeMenu(k) : openMenu(k); }
    const b = e.target.closest('.s108__menu button');
    if (b) { const k = b.closest('.s108__field').dataset.f; return k === 'sido' ? pickSido(b.dataset.v) : pickGu(b.dataset.v); }
  };
  const onDoc = e => { if (state.open && !e.target.closest('.s108__field')) closeMenu(state.open); };
  const onKey = e => { if (e.key === 'Escape' && state.open) closeMenu(state.open); };
  root.addEventListener('click', onClick);
  root.addEventListener('pointerdown', stopDemo);
  document.addEventListener('pointerdown', onDoc);
  window.addEventListener('keydown', onKey);
  const io = new IntersectionObserver(es => { inView = es[0].isIntersecting; }, { threshold: .4 });
  io.observe(root);

  /* 자동 데모: 가상 커서가 직접 눌러본다 */
  const wait = s => new Promise(r => { call = gsap.delayedCall(s, r); });
  const wrap = $('.s108__wrap');
  const posOf = el => { const a = el.getBoundingClientRect(), b = wrap.getBoundingClientRect(); return { x: a.left - b.left + Math.min(a.width * .55, 90), y: a.top - b.top + a.height * .5 }; };
  async function moveTo(el, d = .9) {
    const p = posOf(el);
    await new Promise(r => { call = gsap.to(cursor, { x: p.x, y: p.y, duration: d, ease: 'expo.inOut', onComplete: r }); });
  }
  const press = () => gsap.fromTo(cursor, { scale: .78 }, { scale: 1, duration: .45, ease: 'back.out(3)' });
  async function demo() {
    const seq = [['서울', '마포구'], ['경기', '용인시'], ['부산', '해운대구'], ['경기', '성남시']];
    let n = 0;
    while (demoOn && !dead) {
      while (!inView) { await wait(.4); if (!demoOn || dead) return; }
      const [si, gu] = seq[n++ % seq.length];
      gsap.set(cursor, { x: 40, y: 380 }); gsap.to(cursor, { opacity: 1, duration: .4 });
      await moveTo(sel('sido')); if (!demoOn) return;
      press(); sel('sido').classList.add('is-hot'); openMenu('sido'); await wait(.9); if (!demoOn) return;
      const bs = $(`.s108__menu button[data-v="${si}"]`, F.sido);
      await moveTo(bs, .8); if (!demoOn) return;
      bs.classList.add('is-hot'); await wait(.35); press(); pickSido(si); sel('sido').classList.remove('is-hot'); await wait(.9); if (!demoOn) return;
      await moveTo(sel('gu')); if (!demoOn) return;
      press(); sel('gu').classList.add('is-hot'); openMenu('gu'); await wait(.9); if (!demoOn) return;
      const bg = $(`.s108__menu button[data-v="${gu}"]`, F.gu);
      await moveTo(bg, .8); if (!demoOn) return;
      bg.classList.add('is-hot'); await wait(.35); press(); pickGu(gu); sel('gu').classList.remove('is-hot');
      gsap.to(cursor, { x: '+=160', y: '+=90', opacity: 0, duration: 1, ease: 'power2.out' });
      await wait(4.6); if (!demoOn) return;
    }
  }
  call = gsap.delayedCall(1.2, demo);

  return () => {
    dead = true;
    root.removeEventListener('click', onClick);
    root.removeEventListener('pointerdown', stopDemo);
    document.removeEventListener('pointerdown', onDoc);
    window.removeEventListener('keydown', onKey);
    io.disconnect();
    if (call) call.kill(); if (rtl) rtl.kill();
    gsap.killTweensOf([cursor, stamp, sv, paper, ripple, regionB, F.gu, menu('sido'), menu('gu')]);
  };
}
