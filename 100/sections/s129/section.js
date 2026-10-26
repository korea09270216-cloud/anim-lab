// 탭 전환 = View Transition. 방향(types)만 JS 가 정하고, 슬라이드 방향·곡선은 CSS 가 소유.
export default function (root, ctx) {
  const tabs = [...root.querySelectorAll('.s129__tab')];
  const panels = [...root.querySelectorAll('.s129__panel')];
  const ind = root.querySelector('.s129__ind');
  let cur = 0, busy = false, dirAuto = 1, timer = 0, alive = true, visible = false;

  function apply(i) {
    tabs.forEach((t, k) => { t.classList.toggle('is-active', k === i); t.setAttribute('aria-selected', k === i); });
    tabs[i].prepend(ind);
    panels.forEach((p, k) => { p.hidden = k !== i; });
    root.dataset.tab = i;
  }
  async function go(i) {
    if (i === cur || busy) return;
    const type = i > cur ? 's129-fwd' : 's129-back';
    cur = i;
    if (!document.startViewTransition) { apply(i); return; }
    busy = true;
    const vt = document.startViewTransition({ update: () => apply(i), types: [type] });
    try { await vt.finished; } catch (e) { /* skipped */ }
    busy = false;
  }

  const onTab = e => { const t = e.target.closest('.s129__tab'); if (t) { go(+t.dataset.i); rearm(5000); } };
  root.querySelector('.s129__tabs').addEventListener('click', onTab);

  // 자동 데모: 0→3 앞으로, 3→0 뒤로 (두 방향 모두 보여 줌)
  function step() {
    if (!alive) return;
    if (visible && !document.hidden) {
      let n = cur + dirAuto;
      if (n > tabs.length - 1 || n < 0) { dirAuto *= -1; n = cur + dirAuto; }
      go(n);
    }
    timer = setTimeout(step, 2400);
  }
  function rearm(ms) { clearTimeout(timer); timer = setTimeout(step, ms); }
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .35 });
  io.observe(root);
  if (!ctx.reduced) rearm(1600);

  return () => { alive = false; clearTimeout(timer); io.disconnect(); root.querySelector('.s129__tabs').removeEventListener('click', onTab); };
}
