export default function init(root, ctx) {
  const word = root.querySelector('.s077__word');
  const TEXT = 'FRESH', N = 44;
  const front = [255, 225, 74], mid = [255, 106, 61], back = [91, 15, 106];
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
  const col = t => { const c = t < .5 ? mix(front, mid, t * 2) : mix(mid, back, (t - .5) * 2); return `rgb(${c})`; };
  const layers = [];
  for (let i = N - 1; i >= 0; i--) {     // 뒤쪽부터 DOM 에 넣어 깊이 정렬이 자연스럽게
    const d = document.createElement('div'); d.className = 's077__ly';
    d.textContent = TEXT; d.style.setProperty('--c', i === 0 ? '#ffe14a' : col(Math.min(1, i / (N - 1))));
    word.appendChild(d); layers[i] = d;
  }
  layers[0].style.textShadow = '0 0 0 #fff';
  const st = { p: 0, cp: 0, mx: 0, my: 0 };
  const stt = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { st.p = s.progress; } });
  const ease = gsap.parseEase('power3.inOut');
  const off = ctx.tick((t) => {
    st.cp += (st.p - st.cp) * .08;
    st.mx += ((ctx.mouse.nx - .5) - st.mx) * .06; st.my += ((ctx.mouse.ny - .5) - st.my) * .06;
    const e = ease(Math.min(1, st.cp * 1.25));              // 0~1: 두께 + 굴림
    const gap = 1 + e * 5.2;                                // 레이어 간격(px) = 두께
    const idle = ctx.reduced ? .3 : 1;
    const ry = st.mx * 46 + Math.sin(t * .7) * 9 * idle - 14 + e * 18;
    const rx = st.my * -26 + Math.cos(t * .55) * 5 * idle + e * -32 + Math.sin(st.cp * Math.PI * 2) * 0;
    word.style.transform = `translateZ(${-gap * N / 2}px) rotateX(${rx}deg) rotateY(${ry}deg)`;
    for (let i = 0; i < N; i++) layers[i].style.transform = `translate(-50%,-50%) translateZ(${(N - 1 - i) * gap}px)`;
  });
  return () => { off(); stt.kill(); };
}
