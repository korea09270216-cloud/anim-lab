export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const fields = qa('.s097__f'), form = q('.s097__form'), btn = q('.s097__btn'), bt = q('.s097__bt'), ck = q('.s097__ck path'), sp = q('.s097__sp');
  const ok = q('.s097__ok'), cv = q('.s097__cv'), g = cv.getContext('2d');
  const GLY = '가나다라마바사아자차카타파하빵굽오븐';
  const EZ = 'expo.out';
  const el = f => f.querySelector('input,textarea');
  const lab = f => f.querySelector('label');
  const lift = (f, on) => {
    const L = lab(f), u = f.querySelector('u'), text = on ? f.dataset.short : f.dataset.long;
    gsap.to(L, { y: on ? -34 : 0, scale: on ? .52 : 1, color: on ? '#ff4a1c' : 'rgba(29,26,22,.4)', letterSpacing: on ? '.12em' : '-0.03em', duration: .7, ease: EZ, overwrite: 'auto' });
    gsap.to(L, { scrambleText: { text, chars: GLY, speed: .8, revealDelay: .05 }, duration: .6, ease: 'none', overwrite: false });
    gsap.to(u, { scaleX: on ? 1 : 0, duration: .8, ease: on ? EZ : 'expo.in', transformOrigin: on ? 'left' : 'right', overwrite: 'auto' });
  };
  const state = new Map(fields.map(f => [f, false]));
  const sync = f => {
    const want = document.activeElement === el(f) || el(f).value.length > 0;
    if (state.get(f) !== want) { state.set(f, want); lift(f, want); }
    if (document.activeElement !== el(f)) gsap.to(f.querySelector('u'), { scaleX: 0, duration: .5, ease: 'expo.in', transformOrigin: 'right', overwrite: 'auto' });
    else gsap.to(f.querySelector('u'), { scaleX: 1, duration: .8, ease: EZ, transformOrigin: 'left', overwrite: 'auto' });
  };
  const offs = [];
  fields.forEach(f => {
    const i = el(f);
    const fn = () => sync(f);
    ['focus', 'blur', 'input'].forEach(e => { i.addEventListener(e, fn); offs.push(() => i.removeEventListener(e, fn)); });
  });

  // 컨페티 (DPR 1, 입자 110개, 끝나면 루프 정지)
  let parts = [], live = false;
  const fit = () => { cv.width = root.clientWidth; cv.height = root.clientHeight; };
  fit();
  const ro = new ResizeObserver(fit); ro.observe(root);
  const cols = ['#ff4a1c', '#1d1a16', '#fffaf0', '#2f6bff', '#ff8fb1', '#7dff9e'];
  const burst = () => {
    const r = btn.getBoundingClientRect(), rr = root.getBoundingClientRect();
    const ox = r.left - rr.left + r.width / 2, oy = r.top - rr.top + r.height / 2;
    for (let k = 0; k < 110; k++) {
      const a = -Math.PI / 2 + (Math.random() - .5) * 2.4, v = 7 + Math.random() * 15;
      parts.push({ x: ox, y: oy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: 6 + Math.random() * 8, h: 4 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, c: cols[k % cols.length], life: 0 });
    }
    live = true;
  };
  const off = ctx.tick(() => {
    if (!live) return;
    g.clearRect(0, 0, cv.width, cv.height);
    parts.forEach(p => {
      p.vy += .42; p.vx *= .985; p.vy *= .985; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.scale(1, Math.abs(Math.cos(p.life * .15))); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); g.restore();
    });
    parts = parts.filter(p => p.y < cv.height + 20);
    if (!parts.length) { live = false; g.clearRect(0, 0, cv.width, cv.height); }
  });

  // 제출 시퀀스: 버튼 → 원형 로딩 → 체크 드로우 → 컨페티 → 성공 메시지
  let busy = false;
  const submit = () => {
    if (busy) return; busy = true;
    const tl = gsap.timeline();
    tl.to(btn, { width: 62, duration: .6, ease: 'expo.inOut' })
      .to(bt, { autoAlpha: 0, duration: .2 }, 0)
      .to(sp, { autoAlpha: 1, duration: .2 }, .3)
      .to(sp, { autoAlpha: 0, duration: .2 }, 1.5)
      .set(ck, { strokeDasharray: 40, strokeDashoffset: 40 }, 1.5)
      .to(ck.parentNode, { opacity: 1, duration: .1 }, 1.5)
      .to(ck, { strokeDashoffset: 0, duration: .5, ease: 'power2.out' }, 1.55)
      .to(btn, { backgroundColor: '#1f9d55', duration: .4 }, 1.55)
      .call(burst, null, 2.0)
      .to(fields, { autoAlpha: 0, y: -20, stagger: .05, duration: .5, ease: 'power3.in' }, 2.1)
      .to(btn, { autoAlpha: 0, duration: .4 }, 2.2)
      .set(ok, { visibility: 'visible' }, 2.6)
      .fromTo(ok.children, { y: 40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: .12, duration: 1, ease: EZ }, 2.6);
    return tl;
  };
  const reset = () => {
    busy = false;
    gsap.killTweensOf([btn, bt, sp, ck, ck.parentNode, ok, ok.children, fields]);
    gsap.set(ok, { visibility: 'hidden' });
    gsap.set([btn, fields], { clearProps: 'all' });
    gsap.set([bt], { clearProps: 'all' }); gsap.set(sp, { autoAlpha: 0 }); gsap.set(ck.parentNode, { opacity: 0 });
    fields.forEach(f => { el(f).value = ''; state.set(f, false); lab(f).textContent = f.dataset.long; gsap.set(lab(f), { clearProps: 'all' }); gsap.set(f.querySelector('u'), { scaleX: 0 }); });
  };
  const onSubmit = e => { e.preventDefault(); user = true; submit(); };
  form.addEventListener('submit', onSubmit);

  // 자동 데모: 사용자가 건드리기 전까지 스스로 입력 → 제출 → 컨페티 → 리셋을 반복
  let user = false, alive = true;
  const stop = () => { if (!user) { user = true; reset(); } };
  const kd = () => stop();
  root.querySelector('.s097__card').addEventListener('pointerdown', kd);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const type = async (f, txt) => { const i = el(f); i.focus({ preventScroll: true }); sync(f); await sleep(500); for (const ch of txt) { if (user || !alive) return; i.value += ch; sync(f); await sleep(85); } await sleep(250); i.blur(); sync(f); await sleep(250); };
  const data = ['김소리', '010-4821-3305', '11월 2일 토요일 오전', '크루아상 60개, 마들렌 100개 가능할까요?'];
  (async () => {
    while (alive && !user) {
      await sleep(1200);
      for (let k = 0; k < 4 && !user && alive; k++) await type(fields[k], data[k]);
      if (user || !alive) break;
      submit(); await sleep(7200);
      if (user || !alive) break;
      reset(); await sleep(400);
    }
  })();
  return () => { alive = false; off(); ro.disconnect(); offs.forEach(f => f()); form.removeEventListener('submit', onSubmit); root.querySelector('.s097__card').removeEventListener('pointerdown', kd); };
}
