export default function init(root, ctx) {
  const q = s => root.querySelector(s);
  const form = q('.s115__form'), nameI = q('input[name="name"]'), emailI = q('input[name="email"]'), agree = q('input[name="agree"]');
  const openBtn = q('.s115__open'), dl = q('.s115__dl'), toast = q('.s115__toast');
  const flap = q('.s115__flap'), doc = q('.s115__doc'), seal = q('.s115__seal'), env = q('.s115__env');
  const float = q('.s115__float'), shadow = q('.s115__shadow');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  gsap.set(flap, { transformPerspective: 900, transformOrigin: '50% 0%' });
  gsap.set(float, { transformPerspective: 1300 });

  // 봉투 열림 타임라인 (play = 열기, reverse = 닫기)
  const open = gsap.timeline({ paused: true });
  open.to(seal, { scale: 0, rotation: 70, opacity: 0, duration: .4, ease: 'power3.in' }, 0)
    .to(flap, { rotationX: 180, duration: 1, ease: 'expo.inOut' }, .15)
    .set(flap, { zIndex: 2 }, .65)
    .to(doc, { y: () => -env.offsetHeight * .8, rotation: -1.8, duration: 1.3, ease: 'expo.out' }, .9)
    .to(shadow, { scaleX: 1.12, opacity: .75, duration: 1.2, ease: 'expo.out' }, .9)
    .to({}, { duration: .2 }, 2.2);
  let ready = false;
  function setReady(on) {
    if (on === ready) return; ready = on;
    dl.classList.toggle('is-off', !on); dl.classList.toggle('is-ready', on);
    dl.setAttribute('aria-disabled', on ? 'false' : 'true');
    if (on) gsap.fromTo(dl, { scale: .94 }, { scale: 1, duration: .8, ease: 'back.out(3)' });
  }
  open.eventCallback('onUpdate', () => setReady(open.time() > 1.9));

  function valid() { return nameI.value.trim().length >= 2 && EMAIL.test(emailI.value.trim()) && agree.checked; }
  let demoMode = true, demo = null, demoFilled = false;
  function sync() {
    const v = valid(); openBtn.disabled = !v;
    if (!demoMode && !v && open.progress() > 0 && !open.reversed()) { open.timeScale(1.8).reverse(); }
  }
  [nameI, emailI].forEach(i => i.addEventListener('input', sync));
  agree.addEventListener('change', sync);

  const onSubmit = e => {
    e.preventDefault();
    if (!valid()) return;
    gsap.fromTo(openBtn, { scale: .96 }, { scale: 1, duration: .6, ease: 'back.out(3)' });
    open.timeScale(1).play();
  };
  form.addEventListener('submit', onSubmit);
  const onDl = e => {
    e.preventDefault(); if (!ready) return;
    gsap.killTweensOf(toast);
    gsap.timeline().fromTo(toast, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .5, ease: 'expo.out' }).to(toast, { opacity: 0, y: 10, duration: .5, delay: 2.2 });
  };
  dl.addEventListener('click', onDl);

  // 자동 데모: 입력 → 봉투 열림 → 다시 닫힘 (사용자 조작 시 중단)
  function clearFields() { nameI.value = ''; emailI.value = ''; agree.checked = false; nameI.classList.remove('is-demo'); emailI.classList.remove('is-demo'); openBtn.disabled = true; }
  function startDemo() {
    const n = { a: 0 }, m = { a: 0 };
    const NAME = '김하늘', MAIL = 'haneul@mail.kr';
    demo = gsap.timeline({ repeat: -1, repeatDelay: .6 });
    demo.call(() => { clearFields(); demoFilled = true; nameI.classList.add('is-demo'); })
      .to(n, { a: NAME.length, duration: .7, ease: 'none', onUpdate: () => { nameI.value = NAME.slice(0, Math.round(n.a)); sync(); } }, '+=.3')
      .call(() => emailI.classList.add('is-demo'))
      .to(m, { a: MAIL.length, duration: 1.1, ease: 'none', onUpdate: () => { emailI.value = MAIL.slice(0, Math.round(m.a)); sync(); } }, '+=.15')
      .call(() => { agree.checked = true; sync(); }, null, '+=.3')
      .call(() => { gsap.fromTo(openBtn, { scale: .95 }, { scale: 1, duration: .6, ease: 'back.out(3)' }); open.timeScale(1).play(); }, null, '+=.5')
      .to({}, { duration: 4 })
      .call(() => { open.timeScale(1.5).reverse(); })
      .to({}, { duration: 1.9 })
      .call(clearFields);
  }
  function stopDemo() {
    if (!demoMode) return;
    demoMode = false;
    if (demo) { demo.kill(); demo = null; }
    if (demoFilled) { clearFields(); demoFilled = false; }
    open.timeScale(2.2).reverse();
  }
  const first = () => stopDemo();
  form.addEventListener('pointerdown', first); form.addEventListener('focusin', first); form.addEventListener('keydown', first);

  const st = ScrollTrigger.create({ trigger: root, start: 'top 70%', once: true, onEnter: () => { if (demoMode) startDemo(); } });
  sync();

  // 유휴 부유 + 포인터 틸트
  const idle = gsap.to(float, { y: -10, duration: 2.4, ease: 'sine.inOut', yoyo: true, repeat: -1 });
  const rx = gsap.quickTo(float, 'rotationX', { duration: .9, ease: 'power3.out' });
  const ry = gsap.quickTo(float, 'rotationY', { duration: .9, ease: 'power3.out' });
  const onMove = e => {
    const r = root.getBoundingClientRect();
    ry(((e.clientX - r.left) / r.width - .5) * 14);
    rx(-((e.clientY - r.top) / r.height - .5) * 10);
  };
  root.addEventListener('pointermove', onMove);

  return () => {
    st.kill(); open.kill(); idle.kill(); if (demo) demo.kill();
    root.removeEventListener('pointermove', onMove);
    form.removeEventListener('submit', onSubmit); dl.removeEventListener('click', onDl);
    form.removeEventListener('pointerdown', first); form.removeEventListener('focusin', first); form.removeEventListener('keydown', first);
    gsap.killTweensOf([float, toast, dl, openBtn]);
  };
}
