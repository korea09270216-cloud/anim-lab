export default function init(root, ctx) {
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const road = $('.s053__road'), bike = $('.s053__bike');
  const lms = $$('.s053__lm'), card = $('.s053__card');
  const km = $('.s053__km b'), place = $('.s053__place'), txt = $('.s053__txt');
  const STOPS = [
    { p: .17, place: '경남 하동 · 새벽 5시', txt: '그날 새벽 수확한 채소를 밭에서 바로 상자에 담습니다.', km: 128 },
    { p: .44, place: '성수 센트럴 키친 · 오전 8시', txt: '씻고 썰고 소스를 입히는 데 걸리는 시간은 딱 40분.', km: 74 },
    { p: .70, place: '초록상점 · 오전 10시', txt: '진열대를 거치지 않고 라이더 박스로 곧장 출발합니다.', km: 21 },
    { p: .93, place: '당신의 식탁 · 오전 10시 32분', txt: '문 앞에 놓이는 순간까지 차가움을 지킵니다.', km: 0 }
  ];
  let cur = -1;
  const len = road.getTotalLength();

  // 랜드마크를 도로 위 지점 위쪽에 배치 (위쪽 여백이 있는 쪽으로)
  lms.forEach((g, i) => {
    const pt = road.getPointAtLength(len * STOPS[i].p);
    const lift = i === 3 ? -52 : -58;
    gsap.set(g, { x: pt.x, y: pt.y + lift, transformOrigin: '0px 0px', opacity: 0, scale: .2 });
  });

  // 스쿠터: 도로를 따라 이동 (스크롤 스크럽)
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: root, start: 'top top', end: 'bottom bottom', scrub: 1,
      onUpdate(self) {
        const p = self.progress; let idx = 0;
        STOPS.forEach((s, i) => { if (p >= s.p - .08) idx = i; });
        if (idx !== cur) setStop(idx);
        km.textContent = String(Math.max(0, Math.round(gsap.utils.mapRange(0, 1, 140, 0, p)))).padStart(1, '0');
      }
    }
  });
  tl.fromTo(bike, { opacity: 1 }, {
    motionPath: { path: road, align: road, alignOrigin: [.5, .78], autoRotate: true, start: .02, end: .985 },
    duration: 1, ease: 'none'
  }, 0);
  STOPS.forEach((s, i) => {
    tl.to(lms[i], { opacity: 1, scale: 1, duration: .09, ease: 'expo.out' }, Math.max(0, s.p - .16));
  });

  // 카드 문구 전환

  function setStop(i) {
    cur = i;
    gsap.timeline()
      .to([place, txt], { opacity: 0, y: -10, duration: .25, ease: 'power2.in' })
      .add(() => { place.textContent = STOPS[i].place; txt.textContent = STOPS[i].txt; })
      .fromTo([place, txt], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .7, ease: 'expo.out', stagger: .08 });
    gsap.fromTo(card, { rotation: -1.6 }, { rotation: 0, duration: 1, ease: 'expo.out' });
  }
  setStop(0);

  // 아이들 모션: 바퀴·덜컹·구름·해·연기
  const wheels = gsap.to($$('.s053__wh'), { rotation: 360, duration: .5, ease: 'none', repeat: -1 });
  const bob = gsap.to($('.s053__bob'), { y: -2.5, duration: .16, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  const rays = gsap.to($('.s053__rays'), { rotation: 360, duration: 24, ease: 'none', repeat: -1 });
  const clouds = $$('.s053__cloud').map((c, i) => gsap.to(c, { x: '+=' + (i % 2 ? -140 : 180), duration: 16 + i * 5, ease: 'sine.inOut', yoyo: true, repeat: -1 }));
  const smoke = gsap.fromTo($('.s053__smoke'), { y: 0, opacity: 1 }, { y: -14, opacity: .1, duration: 1.8, ease: 'sine.out', repeat: -1 });

  return () => { tl.scrollTrigger && tl.scrollTrigger.kill(); tl.kill(); wheels.kill(); bob.kill(); rays.kill(); clouds.forEach(c => c.kill()); smoke.kill(); };
}
