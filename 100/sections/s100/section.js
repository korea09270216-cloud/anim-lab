export default function init(root, ctx) {
  const { lenis } = ctx;
  const q = s => root.querySelector(s), qa = s => [...root.querySelectorAll(s)];
  const hd = q('.s100__hd'), dock = q('.s100__dock'), prog = q('.s100__prog u'), no = q('.s100__no'), ttl = q('.s100__ttl');
  const arts = qa('.s100__art');
  const EZ = CustomEase.create('s100', 'M0,0 C0.16,1 0.3,1 1,1');
  let hdOn = true, dockOn = false, cur = 0;
  gsap.set(dock, { yPercent: 160, autoAlpha: 0 });

  const showHd = on => { if (on === hdOn) return; hdOn = on; gsap.to(hd, { yPercent: on ? 0 : -105, duration: on ? .8 : .6, ease: on ? EZ : 'power3.in', overwrite: 'auto' }); };
  const showDock = on => { if (on === dockOn) return; dockOn = on; gsap.to(dock, { yPercent: on ? 0 : 160, autoAlpha: on ? 1 : 0, duration: on ? .9 : .5, ease: on ? 'back.out(1.5)' : 'power3.in', overwrite: 'auto' }); };
  const setChap = i => {
    if (i === cur) return; const dir = i > cur ? 1 : -1; cur = i;
    gsap.fromTo(no, { yPercent: 90 * dir, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: .7, ease: 'expo.out' });
    no.textContent = String(i + 1).padStart(2, '0');
    gsap.to(ttl, { scrambleText: { text: arts[i].dataset.ttl, chars: '가나다라마바사아자차', speed: 1 }, duration: .8, ease: 'none', overwrite: 'auto' });
  };

  // 방향 반응: 내려가면 헤더가 올라가 숨고, 올라가면 헤더와 하단 독이 같이 나타난다
  const st = ScrollTrigger.create({
    trigger: root, start: 'top top', end: 'bottom bottom',
    onUpdate: self => {
      const y = self.scroll() - self.start, atEnd = self.progress > .965;
      gsap.set(prog, { scaleX: self.progress });
      if (y < 60) { showHd(true); showDock(false); }
      else if (self.direction === 1) { showHd(false); showDock(atEnd); }
      else { showHd(true); showDock(true); }
    }
  });
  const sts = arts.map((a, i) => ScrollTrigger.create({ trigger: a, start: 'top 55%', end: 'bottom 55%', onToggle: s => s.isActive && setChap(i) }));
  // 각 기사 진입 시 큰 타이틀이 라인 마스크로 올라옴
  arts.forEach(a => {
    const t = a.querySelector('.s100__h,.s100__h2');
    gsap.fromTo(t, { yPercent: 18, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: a, start: 'top 60%', toggleActions: 'play none none reverse' } });
  });
  gsap.to(q('.s100__badge'), { y: () => innerHeight * 3, ease: 'none', scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: true } });

  // 자동 데모: 입력이 멈추면 아래로 읽다가 잠깐 되돌아 올려 헤더/독 반응을 보여준다
  let last = performance.now(), auto = null;
  const poke = () => { last = performance.now(); if (auto) { auto.kill(); auto = null; } };
  addEventListener('wheel', poke, { passive: true }); addEventListener('touchstart', poke, { passive: true }); addEventListener('keydown', poke);
  const demo = setInterval(() => {
    const r = root.getBoundingClientRect();
    if (auto || performance.now() - last < 2600) return;
    if (r.top > innerHeight * .6 || r.bottom < innerHeight * .4) return;
    const T = scrollY - r.top, vh = innerHeight, max = root.offsetHeight - vh;
    const p = { y: scrollY };
    const go = (y, d) => tl.to(p, { y: T + Math.min(max, y), duration: d, ease: 'power2.inOut', onUpdate: () => lenis.scrollTo(p.y, { immediate: true, force: true }) });
    const tl = gsap.timeline({ onComplete: () => { auto = null; last = performance.now() - 1600; } });
    go(vh * 1.1, 2.4); tl.to({}, { duration: .6 });
    go(vh * 2.4, 2.4); tl.to({}, { duration: .5 });
    go(vh * 1.7, 1.6); tl.to({}, { duration: 1.2 });
    go(vh * 4.1, 3.6); tl.to({}, { duration: 1.6 });
    go(0, 3);
    auto = tl;
  }, 900);
  return () => { clearInterval(demo); auto && auto.kill(); st.kill(); sts.forEach(s => s.kill()); removeEventListener('wheel', poke); removeEventListener('touchstart', poke); removeEventListener('keydown', poke); };
}
