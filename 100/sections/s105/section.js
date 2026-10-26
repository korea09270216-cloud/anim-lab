export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const fmt = n => Math.round(n).toLocaleString('ko-KR');
  const TYPES = [
    { n: '인테리어·시공', int: 1600, eq: 700, sign: 200 },
    { n: '인테리어·시공', int: 3000, eq: 900, sign: 350 },
    { n: '인테리어·시공', int: 5400, eq: 1300, sign: 600 },
  ];
  const OPTS = [{ n: '테라스 좌석', v: 900 }, { n: '키오스크·POS 도입', v: 450 }, { n: '배달 전용 주방', v: 1100 }];
  const typeIn = [...root.querySelectorAll('input[name=s105t]')], optIn = [...root.querySelectorAll('[data-opts] input')];
  const paper = $('[data-paper]'), rowsUl = $('[data-rows]'), feed = $('[data-feed]');
  const stamp = $('[data-stamp]'), ring = $('[data-ring]'), led = $('[data-led]');
  const d = new Date();
  $('[data-meta]').textContent = `NO.${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-0317 · ${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;

  function config() {
    const t = +typeIn.find(i => i.checked).value, T = TYPES[t];
    const rows = [['가맹비', 1000], ['교육비', 500], ['인테리어·시공', T.int], ['주방·설비', T.eq], ['간판·사인', T.sign]];
    optIn.forEach(o => { if (o.checked) rows.push([OPTS[+o.value].n, OPTS[+o.value].v, true]); });
    const sub = rows.reduce((a, r) => a + r[1], 0), vat = sub * .1;
    return { rows, sub, vat, total: sub + vat };
  }
  let cur = null, tl = null;
  const T = { t: 0 };
  function build() {
    cur = config();
    rowsUl.innerHTML = cur.rows.map(r => `<li class="${r[2] ? 'is-opt' : ''}"><span>${r[0]}</span><b data-v="${fmt(r[1])}">${fmt(r[1])}</b></li>`).join('');
    $('[data-sub]').textContent = fmt(cur.sub); $('[data-vat]').textContent = fmt(cur.vat);
  }
  function setTotal() { $('[data-total]').innerHTML = `${fmt(T.t)}<small>만원</small>`; }

  // 프린트: clip-path 가 위에서 아래로 계단식(프린터 헤드 스텝)으로 열리며 각 줄이 지나갈 때 금액이 찍힌다
  function print(retract) {
    tl && tl.kill();
    if (retract) {
      tl = gsap.timeline().to(paper, { clipPath: 'inset(0% 0% 100% 0%)', duration: .5, ease: 'expo.in' }).to(stamp, { opacity: 0, duration: .2 }, 0).call(run);
    } else run();
  }
  function run() {
    build(); T.t = 0; setTotal(); gsap.set(stamp, { opacity: 0 }); gsap.set(paper, { clipPath: 'inset(0% 0% 100% 0%)' });
    const H = paper.offsetHeight, dur = 1.5 + H / 700;
    tl = gsap.timeline();
    tl.to(paper, { clipPath: 'inset(0% 0% 0% 0%)', duration: dur, ease: 'steps(26)' }, 0)
      .fromTo(feed, { y: -26 }, { y: 0, duration: dur, ease: 'steps(26)' }, 0);
    [...rowsUl.children].forEach(li => {
      const b = li.querySelector('b'), at = (li.offsetTop + li.offsetHeight) / H * dur;
      tl.fromTo(li, { opacity: .15 }, { opacity: 1, duration: .25 }, at - .05)
        .to(b, { scrambleText: { text: b.dataset.v, chars: '0123456789', speed: .8 }, duration: .6, ease: 'none' }, at - .05);
    });
    tl.to(T, { t: cur.total, duration: .9, ease: 'expo.out', onUpdate: setTotal }, dur * .8);
    const ts = dur + .15;
    tl.fromTo(stamp, { scale: 2.8, opacity: 0, rotation: -34 }, { scale: 1, opacity: .9, rotation: -14, duration: .24, ease: 'power4.in' }, ts)
      .fromTo(ring, { scale: .7, opacity: .7 }, { scale: 2.1, opacity: 0, duration: .7, ease: 'expo.out' }, ts + .24)
      .fromTo(feed, { y: 0 }, { y: 5, duration: .07, yoyo: true, repeat: 3, ease: 'power1.inOut' }, ts + .22);
  }

  // 대기 모션: LED 점멸
  const ledTl = gsap.timeline({ repeat: -1, yoyo: true }).to(led, { opacity: .25, duration: .6, ease: 'sine.inOut' });

  const swayTl = gsap.timeline({ repeat: -1, yoyo: true }).fromTo(paper, { rotation: -.5, transformOrigin: '50% 0' }, { rotation: .5, duration: 2.2, ease: 'sine.inOut' });
  let started = false, demo = null, touched = false;
  const onChange = () => { if (!started) return; print(true); };
  typeIn.forEach(i => i.addEventListener('change', onChange)); optIn.forEach(i => i.addEventListener('change', onChange));
  const stop = () => { touched = true; demo && demo.kill(); };
  const left = $('.s105__left'); left.addEventListener('pointerdown', stop); left.addEventListener('keydown', stop);

  const CONF = [[2, [0, 2]], [0, []], [2, [0, 1, 2]], [1, [1]]];
  function startDemo() {
    let k = 0;
    const step = () => {
      if (touched) return;
      const [t, os] = CONF[k++ % CONF.length];
      typeIn.forEach(i => i.checked = +i.value === t); optIn.forEach(i => i.checked = os.includes(+i.value));
      print(true);
      demo = gsap.delayedCall(4.8, step);
    };
    demo = gsap.delayedCall(.5, step);
  }
  build();
  const st = ScrollTrigger.create({ trigger: root, start: 'top 78%', once: true, onEnter: () => {
    started = true; print(false);
    gsap.from(root.querySelectorAll('.s105__title,.s105__eyebrow'), { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
    gsap.delayedCall(5, startDemo);
  } });
  return () => { st.kill(); tl && tl.kill(); ledTl.kill(); swayTl.kill(); demo && demo.kill(); typeIn.forEach(i => i.removeEventListener('change', onChange)); optIn.forEach(i => i.removeEventListener('change', onChange)); left.removeEventListener('pointerdown', stop); left.removeEventListener('keydown', stop); };
}
