export default function init(root, ctx) {
  const sheet = root.querySelector('.s080__sheet');
  const pns = [...root.querySelectorAll('.s080__pn')];          // 바깥 → 안쪽 순서 (1,2,3,4번 패널)
  const faces = [...root.querySelectorAll('.s080__face')];
  const ease = gsap.parseEase('power3.inOut');
  const st = { p: 0, cp: 0 };
  const stt = ScrollTrigger.create({ trigger: root, start: 'top top', end: 'bottom bottom', onUpdate: s => { st.p = s.progress; } });
  const off = ctx.tick((t) => {
    st.cp += (st.p - st.cp) * .08;
    const e = ease(Math.min(1, Math.max(0, (st.cp - .04) / .78)));      // 0=완전 접힘, 1=펼침
    const idle = ctx.reduced ? .3 : 1;
    const a = 78 * (1 - e) + (1 - e) * Math.sin(t * .9) * 3.5 * idle;   // 접힘 각도(deg) — 접혀 있을 땐 숨쉬듯 흔들림
    // 지그재그: 1번 패널 +a, 이후 힌지마다 ∓2a
    pns.forEach((pn, i) => { const ang = i === 0 ? a : (i % 2 ? -2 * a : 2 * a); pn.style.transform = `rotateY(${ang}deg)`; });
    // 시트 전체를 펼친 폭 기준으로 가운데 정렬
    const w = pns[0].offsetWidth, ext = 4 * w * Math.cos(a * Math.PI / 180);
    const sway = Math.sin(t * .5) * 3 * idle + (ctx.mouse.nx - .5) * 10;
    sheet.style.transform = `translateX(${-ext / 2}px) rotateX(${8 - e * 6}deg) rotateY(${sway * (1 - e * .6)}deg)`;
    // 면 음영: 접힌 각도 + 위치(홀짝)로 어둡게. 펼쳐지면 사라진다
    faces.forEach((f, i) => f.style.setProperty('--sh', ((i % 2 ? .46 : .12) * (1 - e) + (i % 2 ? .02 : 0)).toFixed(3)));
  });
  return () => { off(); stt.kill(); };
}
