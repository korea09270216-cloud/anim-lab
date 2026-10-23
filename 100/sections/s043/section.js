export default function init(root, ctx) {
  const cards = [...root.querySelectorAll('.s043__card')];
  const ease = CustomEase.create('s043', 'M0,0 C0.9,0 0.1,1 1,1');
  let open = null, busy = false, timer = null, order = 0, tl = null;

  const toggle = (card) => {
    if (busy) return;
    busy = true; timer && timer.kill();
    const opening = !card.classList.contains('is-open');
    const detail = card.querySelectorAll('.s043__big, .s043__dd, .s043__spec li, .s043__x');
    const state = Flip.getState(card.querySelectorAll('.s043__orb, .s043__no, .s043__nm'));
    const cs = Flip.getState(card, { props: 'borderRadius' });
    if (!opening) gsap.to(detail, { opacity: 0, y: 20, duration: .3, ease: 'power3.in' });
    const run = () => {
      card.classList.toggle('is-open', opening);
      open = opening ? card : null;
      Flip.from(cs, { duration: 1.05, ease, absolute: false, props: 'borderRadius', onComplete: () => { busy = false; schedule(); } });
      Flip.from(state, { duration: 1.05, ease, scale: false });
      if (opening) {
        gsap.fromTo(detail, { opacity: 0, y: 50 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: .08, delay: .7 });
        gsap.fromTo(card.querySelector('.s043__big'), { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1.1, ease: 'expo.out', delay: .65 });
      }
    };
    opening ? run() : gsap.delayedCall(.3, run);
  };
  const schedule = () => {
    timer && timer.kill();
    timer = gsap.delayedCall(open ? 2.4 : 1.4, () => {
      if (open) toggle(open); else { toggle(cards[order % cards.length]); order++; }
    });
  };

  const hs = cards.map(c => {
    const f = e => { if (e.target.closest('.s043__x') || !c.classList.contains('is-open')) toggle(c); };
    c.addEventListener('click', f); return [c, f];
  });
  gsap.from(cards, { opacity: 0, scale: .92, y: 30, duration: 1.1, ease: 'expo.out', stagger: .08, scrollTrigger: { trigger: root, start: 'top 80%' } });
  schedule();
  return () => { timer && timer.kill(); hs.forEach(([c, f]) => c.removeEventListener('click', f)); gsap.killTweensOf(root.querySelectorAll('*')); };
}
