export default function init(root, ctx) {
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const stage = q('.s117__stage'), slot = q('.s117__slot'), panel = q('.s117__panel'), lbl = q('.s117__lbl');
  const form = q('.s117__form'), scrim = q('.s117__scrim'), xbtn = q('.s117__x'), send = q('.s117__send');
  const rows = qa('.s117__fh, .s117__f, .s117__send');
  const fills = qa('[data-fill]');
  const LIME = '#d6ff3d', PAPER = '#f6f1e4';
  let tl = null, isOpen = false, busy = false, auto = true, demo = null;

  const rel = el => { const a = el.getBoundingClientRect(), s = stage.getBoundingClientRect(); return { x: a.left - s.left, y: a.top - s.top, w: a.width, h: a.height }; };
  const sync = () => { const s = rel(slot); gsap.set(panel, { left: s.x, top: s.y, width: s.w, height: s.h }); };
  sync();
  const onResize = () => { if (!isOpen && !busy) sync(); };
  window.addEventListener('resize', onResize);

  function build() {
    const sr = stage.getBoundingClientRect();
    const W = Math.min(560, sr.width - 32), H = 560;
    const tx = (sr.width - W) / 2, cy = Math.max(16, (sr.height - H) / 2);
    const t = gsap.timeline({ paused: true, defaults: { ease: 'expo.out' } });
    // 순서 분리: 라벨이 먼저 사라지고 -> 패널 확장 -> 필드 등장
    t.to(lbl, { opacity: 0, scale: .9, duration: .22, ease: 'power2.in' }, 0)
      .to(scrim, { opacity: .9, duration: .7, ease: 'power2.out' }, .08)
      .to(panel, { left: tx, top: cy, width: W, height: H, borderRadius: 30, backgroundColor: PAPER, duration: 1, ease: 'expo.inOut' }, .12)
      .set(form, { opacity: 1 }, .62)
      .fromTo(rows, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .9, stagger: .075 }, .66)
      .fromTo(xbtn, { rotation: -120, scale: .4 }, { rotation: 0, scale: 1, duration: .9 }, .72);
    t.eventCallback('onComplete', () => { busy = false; isOpen = true; form.style.pointerEvents = 'auto'; });
    t.eventCallback('onReverseComplete', () => { busy = false; isOpen = false; sync(); });
    return t;
  }

  function open() {
    if (isOpen || busy) return;
    busy = true; sync();
    if (tl) tl.kill();
    tl = build(); tl.timeScale(1).play(0);
  }
  function close() {
    if (!isOpen || busy) return;
    busy = true; form.style.pointerEvents = 'none';
    tl.timeScale(1.45).reverse();
  }

  const fillDemo = () => {
    fills.forEach((f, i) => { f.value = ''; gsap.to(f, { duration: .9, delay: i * .5, ease: 'none', onUpdate() { const n = Math.round(this.progress() * f.dataset.fill.length); f.value = f.dataset.fill.slice(0, n); } }); });
  };
  const clearFills = () => fills.forEach(f => { f.value = ''; });

  function cycle() {
    if (!auto) return;
    demo = gsap.timeline();
    demo.call(open, null, 1.2)
      .call(() => { if (auto) fillDemo(); }, null, 3.0)
      .call(() => { if (auto) close(); }, null, 7.4)
      .call(() => { clearFills(); }, null, 8.8)
      .call(cycle, null, 9.4);
  }
  demo = gsap.delayedCall(.2, cycle);

  const stopAuto = () => { auto = false; if (demo) demo.kill(); gsap.killTweensOf(fills); };
  const onDown = e => { if (e.isTrusted) stopAuto(); };
  const onPanel = e => { if (!e.isTrusted) return; if (!isOpen) open(); };
  const onX = e => { if (e.isTrusted) { e.stopPropagation(); close(); } };
  const onScrim = e => { if (e.isTrusted && isOpen) close(); };
  const onKey = e => { if (e.key === 'Escape') close(); if ((e.key === 'Enter' || e.key === ' ') && e.target === panel && !isOpen) { e.preventDefault(); open(); } };
  root.addEventListener('pointerdown', onDown);
  panel.addEventListener('click', onPanel);
  xbtn.addEventListener('click', onX);
  send.addEventListener('click', onX);
  scrim.style.pointerEvents = 'none';
  stage.addEventListener('click', e => { if (e.isTrusted && isOpen && !panel.contains(e.target)) close(); });
  root.addEventListener('keydown', onKey);

  return () => {
    stopAuto(); window.removeEventListener('resize', onResize);
    root.removeEventListener('pointerdown', onDown); panel.removeEventListener('click', onPanel);
    xbtn.removeEventListener('click', onX); send.removeEventListener('click', onX); root.removeEventListener('keydown', onKey);
    tl && tl.kill();
    gsap.killTweensOf([lbl, scrim, panel, form, rows, xbtn]);
  };
}
