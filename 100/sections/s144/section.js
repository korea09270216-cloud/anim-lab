export default function init(root, ctx) {
  const cv = root.querySelector('.s144__cv');
  const g = cv.getContext && cv.getContext('2d');
  if (!g) return;
  const stage = root.querySelector('.s144__stage');
  // 트윈 대상은 "숫자 값"뿐 — 렌더러(Canvas2D)가 이 값만 읽는다
  const S = { p: 0, spread: 0 };
  const LINES = ['깊은 국물', '긴 시간'];
  const TR = 9;                                    // 외곽선 잔상 복제 수
  const SCALE = .8;                                // 렌더 해상도 스케일 (성능)
  const FILL = '#1d1a17', INK = '#e2381b';
  let W = 0, H = 0, fs = 0, t = 0, vis = true, px = 0, pv = 0;
  const FONT = (s) => '900 ' + s + 'px Pretendard,"Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';

  const resize = () => {
    const r = stage.getBoundingClientRect();
    W = cv.width = Math.max(320, Math.round(r.width * SCALE));
    H = cv.height = Math.max(240, Math.round(r.height * SCALE));
    fs = Math.min(W * .17, H * .30);
  };
  resize();
  addEventListener('resize', resize);

  const easeO = x => 1 - Math.pow(1 - x, 4);
  const clamp = (x) => Math.max(0, Math.min(1, x));

  let lastMx = ctx.mouse.nx;
  const draw = (dt) => {
    // 포인터 속도 → 잔상 간격(감쇠)
    const dx = ctx.mouse.nx - lastMx; lastMx = ctx.mouse.nx;
    pv += (dx * 60 - pv) * .12; pv *= .94;
    g.clearRect(0, 0, W, H);
    g.font = FONT(fs); g.textBaseline = 'middle'; g.textAlign = 'center'; g.lineJoin = 'round';
    LINES.forEach((txt, li) => {
      const y = H * (.40 + li * .30);
      const dir = li ? -1 : 1;
      const start = li * .22, end = start + .62;
      const lp = clamp((S.p - start) / (end - start));        // 줄별 진행값
      const travel = W * .75 * dir;
      for (let k = TR - 1; k >= 0; k--) {
        const e = easeO(clamp(lp * 1.4 - k * .045));          // k 가 클수록 늦게 따라온다 = 꼬리
        let x = W / 2 + (1 - e) * travel;
        const idle = lp >= 1 ? Math.sin(t * 1.3 - k * .42 + li) * (k * 2.2 + 2) : 0;   // 정지 후에도 잔상이 숨쉼
        x += idle + k * pv * fs * .06;
        const yy = y + Math.sin(t * .9 + k * .5) * k * 1.2;
        g.globalAlpha = (.9 - k * .085) * (lp > 0 ? 1 : 0);
        g.lineWidth = Math.max(1.5, fs * .012);
        g.strokeStyle = INK;
        g.strokeText(txt, x, yy);
      }
      // 도착하면 채운 글자가 나타난다
      const fa = clamp((lp - .82) / .18);
      if (fa > 0) { g.globalAlpha = fa; g.fillStyle = FILL; g.fillText(txt, W / 2 + Math.sin(t * .7 + li) * 1.2, y); }
    });
    g.globalAlpha = 1;
  };

  const stt = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    onUpdate: s => gsap.to(S, { p: s.progress * 1.12, duration: .9, ease: 'power3.out', overwrite: true })
  });
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; });
  io.observe(root);

  // idle 데모: 스크롤이 맨 처음일 때도 첫 줄이 한 번 들어왔다 나간다
  const intro = gsap.timeline({ repeat: -1, repeatDelay: 1.2, delay: .4 })
    .to(S, { spread: 1, duration: 1.8, ease: 'expo.out' }).to(S, { spread: 0, duration: 1, ease: 'power2.inOut' }, '+=.8');

  const off = ctx.tick((time, dt) => {
    if (!vis) return;
    t += (dt || 16) / 1000;
    const keep = S.p;
    if (keep < .02) S.p = .02 + S.spread * .5;              // 스크롤 전: 자동 리빌 루프
    draw();
    S.p = keep;
  });

  return () => { off(); stt.kill(); intro.kill(); io.disconnect(); removeEventListener('resize', resize); gsap.killTweensOf(S); };
}
