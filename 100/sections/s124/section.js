export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const list = q('.s124__list'), num = q('.s124__num'), state = q('.s124__state'), stateT = state.querySelector('span');
  const form = q('.s124__form'), inN = q('#s124n'), inT = q('#s124t'), fN = inN.parentElement, fT = inT.parentElement;
  const REG = ['서울 강남', '부산 해운대', '대구 수성', '인천 송도', '광주 상무', '대전 둔산', '수원 영통', '창원 상남', '제주 노형', '울산 삼산', '청주 복대', '전주 효자', '성남 분당', '천안 불당'];
  const SUR = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오'];
  const VERB = ['방금 상담 신청', '가맹 상담 신청', '창업 상담 예약'];
  const GAP = 92, MAXV = 4, LIFE = 9.5; // 슬롯 간격 / 최대 표시 / 수명(초, 일시정지 중엔 흐르지 않음)
  const OP = [1, .82, .55, .28];
  let items = [], paused = false, realFocus = false, virt = false, acc = 0, ri = 0, si = 0, count = 128, vis = false, user = false;

  function layout() {
    items.forEach((it, i) => {
      gsap.to(it.el, { y: -i * GAP, opacity: OP[Math.min(i, 3)] * (it.dying ? 0 : 1), scale: 1 - Math.min(i, 3) * .03, duration: 1.1, ease: 'expo.out', overwrite: 'auto' });
    });
  }
  function push(reg, name, verb) {
    const el = document.createElement('div'); el.className = 's124__t';
    el.innerHTML = `<span class="s124__av">${name[0]}</span><div class="s124__tx"><strong>${reg} ${name}님 ${verb}</strong><span class="s124__tm">방금</span></div>`;
    list.appendChild(el);
    const it = { el, age: 0, mins: 1 + Math.floor(Math.random() * 8), tm: el.querySelector('.s124__tm'), dying: false };
    items.unshift(it);
    gsap.set(el, { y: 90, opacity: 0, scale: .94 });
    layout();
    count++; bump(count);
    while (items.filter(x => !x.dying).length > MAXV) kill(items.filter(x => !x.dying).pop());
  }
  function kill(it) {
    if (!it || it.dying) return; it.dying = true;
    gsap.to(it.el, { opacity: 0, y: '-=26', duration: .8, ease: 'power2.in', overwrite: 'auto', onComplete: () => { it.el.remove(); items = items.filter(x => x !== it); } });
  }
  function bump(n) {
    gsap.fromTo(num, { yPercent: 90, opacity: 0 }, { yPercent: 0, opacity: 1, duration: .8, ease: 'expo.out', onStart: () => { num.textContent = n; } });
  }
  function setPause() {
    const p = realFocus || virt; if (p === paused) return; paused = p;
    state.classList.toggle('is-pause', p); stateT.textContent = p ? '입력 중 · 알림 일시정지' : '알림 재생 중';
    gsap.to(list, { opacity: p ? .55 : 1, duration: .4 });
  }
  function rnd() { const r = REG[ri++ % REG.length], n = SUR[si++ % SUR.length] + '○○'; return [r, n, VERB[(ri + si) % VERB.length]]; }
  const tick = (t, dt) => {
    if (!vis || paused) return;
    const d = Math.min(dt, 100) / 1000;
    acc += d;
    if (acc >= 2.6) { acc = 0; const [r, n, v] = rnd(); push(r, n, v); }
    items.forEach(it => {
      if (it.dying) return; it.age += d;
      it.tm.textContent = it.age < 2.5 ? '방금' : it.mins + '분 전';
      if (it.age > LIFE) { kill(it); layout(); }
    });
  };
  const off = ctx.tick(tick);
  // 초기 3건 채움
  [0, 1, 2].forEach(() => { const [r, n, v] = rnd(); push(r, n, v); });
  items.slice().reverse().forEach((it, i) => { it.age = (2 - i) * 2.8 + 2.6; });
  count = 128; num.textContent = count;

  // 실제 포커스 → 일시정지
  const fin = () => { realFocus = true; setPause(); }, fout = () => { realFocus = document.activeElement === inN || document.activeElement === inT; setPause(); };
  [inN, inT].forEach(i => { i.addEventListener('focus', fin); i.addEventListener('blur', fout); });
  const onSub = e => {
    e.preventDefault(); const nm = inN.value.trim(); if (!nm) return;
    push('내 신청', nm[0] + '○○', '접수 완료'); inN.value = inT.value = ''; inN.blur(); inT.blur(); realFocus = false; setPause();
  };
  form.addEventListener('submit', onSub);
  const stop = () => { if (user) return; user = true; demo.kill(); fN.classList.remove('is-focus'); fT.classList.remove('is-focus'); virt = false; inN.value = ''; setPause(); };
  form.addEventListener('pointerdown', stop);

  // 데모: 가끔 가상 포커스 → 일시정지 시연
  const demo = gsap.timeline({ repeat: -1, paused: true });
  demo.to({}, { duration: 9 })
    .call(() => { virt = true; fN.classList.add('is-focus'); setPause(); })
    .call(() => { inN.value = '홍'; }, null, '+=.5').call(() => { inN.value = '홍길'; }, null, '+=.4').call(() => { inN.value = '홍길동'; }, null, '+=.4')
    .to({}, { duration: 3 })
    .call(() => { virt = false; fN.classList.remove('is-focus'); inN.value = ''; setPause(); });
  const io = new IntersectionObserver(es => { vis = es[0].isIntersecting; if (!user) demo.paused(!vis); }, { threshold: .2 });
  io.observe(root);
  return () => { io.disconnect(); off(); demo.kill(); [inN, inT].forEach(i => { i.removeEventListener('focus', fin); i.removeEventListener('blur', fout); }); form.removeEventListener('submit', onSub); form.removeEventListener('pointerdown', stop); gsap.killTweensOf([list, num, ...items.map(i => i.el)]); };
}
