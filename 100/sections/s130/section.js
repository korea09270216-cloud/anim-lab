// 열기/닫기는 HTML(command/commandfor, popovertarget, form method=dialog)만으로 동작한다.
// 아래 JS 는 마우스 없는 환경을 위한 "자동 데모" 토글뿐(popover 열고 → 닫고 → 드로어 열고 → 닫고).
export default function (root, ctx) {
  const dlg = root.querySelector('.s130__drawer');
  const pop = root.querySelector('.s130__pop');
  let timer = 0, alive = true, visible = false, phase = 0;
  const safe = fn => { try { fn(); } catch (e) { /* 이미 열림/닫힘 */ } };

  function step() {
    if (!alive) return;
    if (!visible || document.hidden || dlg.matches(':modal') && phase % 2 === 0) { timer = setTimeout(step, 900); return; }
    let wait = 2200;
    if (phase === 0) { safe(() => pop.showPopover()); wait = 2600; }
    else if (phase === 1) { safe(() => pop.hidePopover()); wait = 900; }
    else if (phase === 2) { safe(() => dlg.showModal()); wait = 4200; }
    else { safe(() => dlg.close()); wait = 1800; }
    phase = (phase + 1) % 4;
    timer = setTimeout(step, wait);
  }
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .4 });
  io.observe(root);
  if (!ctx.reduced) timer = setTimeout(step, 1800);

  return () => { alive = false; clearTimeout(timer); io.disconnect(); safe(() => dlg.close()); safe(() => pop.hidePopover()); };
}
