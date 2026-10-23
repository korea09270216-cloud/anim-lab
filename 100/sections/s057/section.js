export default function init(root, ctx) {
  const $ = s => root.querySelector(s);
  const svg = $('.s057__logo');
  const wipe = $('.s057__wipe'), spot = $('.s057__spot');
  const emblem = [...$('.s057__emblem').children];
  const stroke = $('.s057__stroke');
  const cap = $('.s057__cap'), tag = $('.s057__tag'), chips = [...root.querySelectorAll('.s057__chips li')];
  const word = document.getElementById('s057word');
  // <use> 로 복제된 윤곽선은 원본 path 의 길이를 공유하므로, 윤곽선 레이어만 DrawSVG 로 직접 제어하기 위해 path 사본을 만든다.
  const letters = [...word.children].map(p => {
    const c = p.cloneNode(true); c.removeAttribute('fill-rule'); stroke.appendChild(c); return c;
  });
  stroke.querySelector('use').remove();

  const build = () => {
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0 });
    tl.set(svg, { opacity: 1 })
      .set(wipe, { attr: { x: -1700 } })
      .set(letters, { drawSVG: '0%', stroke: '#f5ecd7' })
      .set(emblem, { drawSVG: '0%', opacity: 1, stroke: '#ffc94a' })
      .set([cap, tag], { opacity: 0, y: 14 })
      .set(chips, { opacity: 0, y: 14 })
      .to(cap, { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, 0)
      .to(emblem, { drawSVG: '100%', duration: 1.5, ease: 'expo.inOut', stagger: .1 }, .1)
      .to(letters, { drawSVG: '100%', duration: 1.7, ease: 'power3.inOut', stagger: .22 }, 1)
      .to(wipe, { attr: { x: 120 }, duration: 1.9, ease: 'expo.inOut' }, 2.7)
      .to(letters, { stroke: '#ffc94a', duration: .8 }, 3.6)
      .to(tag, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, 4.1)
      .to(chips, { opacity: 1, y: 0, duration: .9, ease: 'expo.out', stagger: .12 }, 4.3)
      .to(emblem, { stroke: '#f5ecd7', duration: .8 }, 4.1)
      .to({}, { duration: 2.6 })
      .to(svg, { opacity: 0, duration: .8, ease: 'power2.in' })
      .to([cap, tag, ...chips], { opacity: 0, duration: .5 }, '<');
    return tl;
  };
  const tl = build();
  tl.pause();
  // 화면에 들어왔을 때부터 재생, 벗어나면 정지
  const st = ScrollTrigger.create({ trigger: root, start: 'top 85%', end: 'bottom 5%', onToggle: self => self.isActive ? tl.play() : tl.pause() });

  // 클릭하면 처음부터
  const re = () => tl.restart();
  svg.addEventListener('click', re);

  // 커서 스포트: 채워진 로고 위에 황금빛 광원이 따라다닌다
  let sx = 500, sy = 260;
  const off = ctx.tick(() => {
    const r = svg.getBoundingClientRect(); if (!r.width) return;
    const tx = (ctx.mouse.x - r.left) / r.width * 1000, ty = (ctx.mouse.y - r.top) / r.height * 440 - 140;
    sx += (tx - sx) * .12; sy += (ty - sy) * .12;
    spot.setAttribute('cx', sx.toFixed(1)); spot.setAttribute('cy', sy.toFixed(1));
  });

  return () => { st.kill(); tl.kill(); off(); svg.removeEventListener('click', re); };
}
