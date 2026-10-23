export default function init(root, ctx) {
  const odos = [...root.querySelectorAll('.odo')];
  const made = odos.map(el => {
    const str = Number(el.dataset.v).toLocaleString('en-US');
    el.textContent = '';
    const cols = [];
    [...str].forEach(ch => {
      if (ch === ',') { const s = document.createElement('span'); s.className = 'odo__s'; s.textContent = ','; el.appendChild(s); return; }
      const c = document.createElement('span'); c.className = 'odo__c';
      const r = document.createElement('span'); r.className = 'odo__r';
      r.innerHTML = Array.from({ length: 11 }, (_, i) => `<i>${i % 10}</i>`).join('');
      c.appendChild(r); el.appendChild(c);
      cols.push({ r, o: { p: 0 } });
    });
    return { el, cols, value: Number(el.dataset.v) };
  });
  const render = col => { const p = ((col.o.p % 10) + 10) % 10; gsap.set(col.r, { yPercent: -(p / 11) * 100 }); };
  made.forEach(m => m.cols.forEach(render));

  // 목표 숫자로 굴리기. big=true 면 오른쪽 자릿수일수록 더 많이 회전
  const setDigits = (m, v, dur, big) => {
    const n = m.cols.length;
    const s = String(v).padStart(n, '0').slice(-n);
    m.cols.forEach((col, i) => {
      const d = +s[i];
      const cur = ((col.o.p % 10) + 10) % 10;
      const delta = (d - cur + 10) % 10;
      if (delta === 0 && !big) return;
      const turns = big ? 10 * (1 + Math.round((n - i) / 2)) : 0;
      gsap.to(col.o, { p: col.o.p + delta + turns, duration: big ? dur + (n - 1 - i) * .06 + .6 : dur, ease: big ? 'expo.out' : 'power3.inOut', onUpdate: () => render(col), overwrite: true });
    });
  };

  const st = ScrollTrigger.create({
    trigger: root, start: 'top 80%', once: true,
    onEnter: () => made.forEach((m, k) => gsap.delayedCall(k * .12, () => setDigits(m, m.value, 1.6, true)))
  });
  // 라이브 카운터: 오른쪽 몇 자리가 계속 굴러간다
  const hero = made[0]; let live = hero.value;
  const iv = setInterval(() => { live += 1 + (Math.random() * 6 | 0); setDigits(hero, live, .8 + Math.random() * .4, false); }, 1300);
  // 카드 숫자도 가끔 한 바퀴 굴러 살아있음을 보여줌
  let k = 1;
  const iv2 = setInterval(() => {
    const m = made[1 + (k++ % 3)];
    m.cols.forEach((col, i) => gsap.to(col.o, { p: col.o.p + 10, duration: 1.4 + i * .25, ease: 'expo.inOut', onUpdate: () => render(col), overwrite: true }));
  }, 4200);

  return () => { st.kill(); clearInterval(iv); clearInterval(iv2); gsap.killTweensOf(made.flatMap(m => m.cols.map(c => c.o))); };
}
