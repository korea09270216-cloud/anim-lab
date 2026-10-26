// 카드 ↔ 상세 morph = same-document View Transition. JS 는 "어느 요소에 이름을 줄지"와 자동 데모 타이머뿐.
export default function (root, ctx) {
  const stage = root.querySelector('.s128__stage');
  const cards = [...root.querySelectorAll('.s128__card')];
  const detail = root.querySelector('.s128__detail');
  const q = s => detail.querySelector(s);
  const KEYS = ['shell', 'vis', 'ttl'];
  const cardEls = c => [c, c.querySelector('.s128__vis'), c.querySelector('.s128__ttl')];
  const detailEls = [q('.s128__dshell'), q('.s128__dvis'), q('.s128__dttl')];
  const name = (els, on) => els.forEach((el, i) => { el.style.viewTransitionName = on ? 's128-' + KEYS[i] : ''; });

  let cur = -1, busy = false, timer = 0, alive = true, visible = false;

  function fill(c) {
    const d = c.dataset;
    detail.style.setProperty('--c1', c.style.getPropertyValue('--c1'));
    detail.style.setProperty('--c2', c.style.getPropertyValue('--c2'));
    detail.style.setProperty('--c3', c.style.getPropertyValue('--c3'));
    q('.s128__dno').textContent = c.querySelector('.s128__meta b').textContent;
    q('.s128__dttl').textContent = c.querySelector('.s128__ttl').textContent;
    q('.s128__ddesc').textContent = d.desc;
    q('.s128__sl1').textContent = d.al; q('.s128__sv1').textContent = d.a;
    q('.s128__sl2').textContent = d.bl; q('.s128__sv2').textContent = d.b;
    q('.s128__sv3').textContent = d.p;
  }

  async function morph(from, to, update) {
    if (busy) return;
    if (!document.startViewTransition) { update(); return; }
    busy = true;
    name(from, true);
    const vt = document.startViewTransition(() => { name(from, false); update(); name(to, true); });
    try { await vt.finished; } catch (e) { /* skipped */ }
    name(to, false); busy = false;
  }

  function open(i) {
    if (cur !== -1) return;
    const c = cards[i];
    cur = i; fill(c);
    morph(cardEls(c), detailEls, () => { stage.dataset.view = 'detail'; detail.hidden = false; });
  }
  function close() {
    if (cur === -1) return;
    const c = cards[cur];
    morph(detailEls, cardEls(c), () => { stage.dataset.view = 'grid'; detail.hidden = true; });
    cur = -1;
  }

  const onCard = e => { const b = e.target.closest('.s128__card'); if (b) { open(+b.dataset.i); rearm(6000); } };
  const onClose = () => { close(); rearm(6000); };
  stage.addEventListener('click', onCard);
  q('.s128__close').addEventListener('click', onClose);

  // 자동 데모: 열고(3.2s) → 닫고(1.8s) → 다음 카드
  let next = 0;
  function step() {
    if (!alive) return;
    if (visible && !document.hidden) {
      if (cur === -1) { open(next); next = (next + 1) % cards.length; timer = setTimeout(step, 3400); return; }
      close(); timer = setTimeout(step, 1900); return;
    }
    timer = setTimeout(step, 800);
  }
  function rearm(ms) { clearTimeout(timer); timer = setTimeout(step, ms); }

  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold: .35 });
  io.observe(root);
  if (!ctx.reduced) rearm(1500);

  return () => { alive = false; clearTimeout(timer); io.disconnect(); stage.removeEventListener('click', onCard); };
}
