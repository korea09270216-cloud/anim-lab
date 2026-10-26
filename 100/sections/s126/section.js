// 모션은 전부 CSS(animation-timeline: view()/named view-timeline). JS 는 지원 여부 표시만.
export default function (root) {
  const ok = CSS.supports('animation-timeline', 'view()');
  root.dataset.sdt = ok ? 'on' : 'off';
  return () => { delete root.dataset.sdt; };
}
