export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const lerp3 = (a, g) => g <= 1 ? a[0] + (a[1] - a[0]) * g : a[1] + (a[2] - a[1]) * (g - 1);
  const ITEMS = [
    { n: '가맹비', c: '#1d1a16', f: () => 1000 },
    { n: '교육비', c: '#ff5a1f', f: () => 500 },
    { n: '인테리어', c: '#e8a200', f: (py, g) => py * lerp3([200, 300, 440], g) },
    { n: '주방·설비', c: '#2e7d5b', f: (py, g) => 600 + py * lerp3([20, 26, 34], g) },
    { n: '보증금·권리금', c: '#5b4bd6', f: py => py * 120 },
    { n: '오픈 마케팅', c: '#8a8170', f: () => 300 },
  ];
  const GR = ['스탠다드', '프리미엄', '시그니처'];
  const inPy = $('[data-in=py]'), inGr = $('[data-in=gr]');
  const fill = el => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min) * 100) + '%');

  // 오도미터: 자릿수마다 0-9-0 스트립을 세로로 굴린다
  const odoHost = $('[data-odo]');
  const COLS = 5, cols = []; let sep;
  for (let i = COLS - 1; i >= 0; i--) {
    if (i === 2) { sep = document.createElement('span'); sep.className = 's101__sep'; sep.textContent = ','; odoHost.appendChild(sep); }
    const c = document.createElement('span'); c.className = 's101__col';
    const st = document.createElement('span'); st.className = 's101__strip';
    st.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<span>${d}</span>`).join('');
    c.appendChild(st); odoHost.appendChild(c); cols[i] = { c, st };
  }
  function odo(v) {
    for (let i = 0; i < COLS; i++) {
      const pos = i === 0 ? v % 10 : Math.floor(v / Math.pow(10, i)) % 10 + Math.max(0, (v / Math.pow(10, i - 1)) % 10 - 9);
      gsap.set(cols[i].st, { yPercent: -pos * 100 / 11 });
      cols[i].c.style.opacity = (v >= Math.pow(10, i) || i === 0) ? 1 : 0;
    }
    sep.style.opacity = v >= 1000 ? 1 : 0;
  }

  // 스택바 + 범례
  const bar = $('[data-bar]'), legend = $('[data-legend]');
  const segs = [], nums = [], lis = [];
  const hi = (on, i) => { segs.forEach((x, k) => { x.classList.toggle('is-dim', on && k !== i); lis[k].classList.toggle('is-dim', on && k !== i); }); };
  ITEMS.forEach((it, i) => {
    const s = document.createElement('div'); s.className = 's101__seg'; s.style.setProperty('--c', it.c); s.textContent = it.n; bar.appendChild(s); segs.push(s);
    const li = document.createElement('li'); li.style.setProperty('--c', it.c);
    li.innerHTML = `<i></i><span>${it.n}</span><b>0</b>`; legend.appendChild(li); lis.push(li); nums.push(li.querySelector('b'));
    [s, li].forEach(el => { el.addEventListener('pointerenter', () => hi(true, i)); el.addEventListener('pointerleave', () => hi(false, i)); });
  });
  const S = {}; ITEMS.forEach((_, i) => S['v' + i] = 0);
  function render() {
    let t = 0;
    ITEMS.forEach((_, i) => {
      const x = S['v' + i]; t += x;
      segs[i].style.flexGrow = Math.max(x, 0.001);
      nums[i].textContent = Math.round(x).toLocaleString('ko-KR') + '만';
    });
    odo(t);
  }
  function apply(py, g, dur) {
    const to = { duration: dur, ease: 'expo.out', overwrite: true, onUpdate: render };
    ITEMS.forEach((it, i) => to['v' + i] = it.f(py, g));
    gsap.to(S, to);
  }
  function readInputs() {
    const py = +inPy.value, g = +inGr.value;
    $('[data-val=py]').textContent = py + '평'; $('[data-val=gr]').textContent = GR[g];
    fill(inPy); fill(inGr);
    return [py, g];
  }
  const onInput = () => { const [py, g] = readInputs(); apply(py, g, .8); };
  inPy.addEventListener('input', onInput); inGr.addEventListener('input', onInput);
  readInputs(); render();

  // 데모 루프: 사용자가 건드리면 멈춘다
  let demo = null, touched = false;
  const stopDemo = () => { touched = true; demo && demo.kill(); };
  [inPy, inGr].forEach(el => { el.addEventListener('pointerdown', stopDemo); el.addEventListener('keydown', stopDemo); });
  const STEPS = [[30, 2], [12, 0], [24, 1], [38, 2], [16, 1]];
  function startDemo() {
    if (touched) return;
    const P = { py: +inPy.value };
    demo = gsap.timeline({ repeat: -1 });
    STEPS.forEach(([py, g]) => {
      demo.call(() => { inGr.value = g; })
        .to(P, { py, duration: 1.6, ease: 'power3.inOut', onUpdate: () => { inPy.value = Math.round(P.py); const [a, b] = readInputs(); apply(a, b, .7); } })
        .to({}, { duration: 1.1 });
    });
  }
  const st = ScrollTrigger.create({
    trigger: root, start: 'top 78%', once: true, onEnter: () => {
      const [py, g] = readInputs(); apply(py, g, 1.8);
      gsap.from(root.querySelectorAll('.s101__title, .s101__eyebrow'), { yPercent: 40, opacity: 0, duration: 1.2, ease: 'expo.out', stagger: .1 });
      gsap.delayedCall(2.2, startDemo);
    }
  });
  return () => { st.kill(); demo && demo.kill(); gsap.killTweensOf(S); inPy.removeEventListener('input', onInput); inGr.removeEventListener('input', onInput); };
}
