export default function init(root, ctx) {
  const p = root.querySelector('.s018__text');
  const html0 = p.innerHTML;
  let split = null, tl = null, visible = false, lastW = root.offsetWidth;
  const build = () => {
    tl && tl.kill(); split && split.revert(); p.innerHTML = html0;
    split = new SplitText(p, { type: 'lines', mask: 'lines', linesClass: 's018__line' });
    const lines = split.lines, marks = [...p.querySelectorAll('mark')];
    tl = gsap.timeline({ repeat: -1, paused: !visible });
    tl.set(lines, { yPercent: 115 }).set(marks, { '--hl': 0 })
      .to(lines, { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: .14 })
      .to(marks, { '--hl': 1, duration: .9, ease: 'power3.inOut', stagger: .35 }, '-=.5')
      .to({}, { duration: 2.6 })
      .to(marks, { '--hl': 0, duration: .5, ease: 'power3.in', stagger: .06, transformOrigin: '100% 50%' })
      .to(lines, { yPercent: -115, duration: .8, ease: 'expo.in', stagger: .08 }, '-=.2');
  };
  build();
  const st = ScrollTrigger.create({ trigger: root, start: 'top 80%', end: 'bottom 10%', onToggle: s => { visible = s.isActive; tl && (visible ? tl.play() : tl.pause()); } });
  let rt; const ro = new ResizeObserver(() => { if (Math.abs(root.offsetWidth - lastW) < 4) return; lastW = root.offsetWidth; clearTimeout(rt); rt = setTimeout(build, 200); });
  ro.observe(root);
  return () => { clearTimeout(rt); ro.disconnect(); st.kill(); tl && tl.kill(); split && split.revert(); };
}
