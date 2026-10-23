const R = [
  ['김', '#ff6b4a', '김서윤 · 배달의민족', '5', '야식으로 시켰는데 식어도 바삭해서 놀랐어요. 마늘간장 소스가 진짜 중독이에요. 다음 주에 또 시킬 거예요.', '마늘간장 반반'],
  ['박', '#2f6bff', '박도현 · 네이버 플레이스', '5', '매장에서 먹으면 갓 튀긴 소리부터 달라요. 직원분이 닭 부위까지 취향 물어봐 주셔서 감동.', '가마 후라이드'],
  ['이', '#00a58e', '이하린 · 인스타그램', '5', '가족 모임 때 3마리 시켰는데 조카들이 무 하나 안 남기고 다 먹었어요. 양념이 달지 않아서 어른들도 좋아하세요.', '패밀리 세트'],
  ['정', '#8a4dff', '정민재 · 쿠팡이츠', '4', '배달 25분 만에 도착. 박스 포장이 깔끔하고 소스가 따로 와서 눅눅해지지 않았어요. 별 하나는 가격 때문에…', '순살 파닭'],
  ['최', '#ff9f1c', '최유진 · 배달의민족', '5', '혼닭용 반마리 메뉴가 있어서 좋아요. 1인 가구한테 이런 배려 흔치 않죠. 닭다리만 따로 추가 가능한 것도 최고.', '1인 반마리'],
  ['한', '#e5384f', '한지훈 · 네이버 플레이스', '5', '튀김옷이 얇고 기름 냄새가 안 나요. 닭 크기도 일정하고, 먹을 때마다 맛이 같다는 게 프랜차이즈의 힘인 듯.', '가마 후라이드'],
  ['오', '#00b4d8', '오세아 · 인스타그램', '5', '야구 보면서 시킨 치맥 세트. 생맥주 500cc 포함이라 가성비 미쳤어요. 사장님이 서비스로 치즈볼도 주셨어요!', '치맥 세트'],
  ['윤', '#6a994e', '윤태오 · 요기요', '5', '닭 육즙이 살아 있어요. 부위별로 소금 간이 다르게 되어 있어서 이유가 궁금했는데 조리법 설명서까지 들어 있더라고요.', '소금구이 치킨'],
  ['강', '#f72585', '강나리 · 배달의민족', '4', '고추바사삭 매운맛 2단계로 시켰는데 딱 좋았어요. 3단계는 못 먹을 듯. 무 대신 피클을 더 주면 좋겠어요.', '고추바사삭'],
  ['서', '#3a86ff', '서준호 · 네이버 플레이스', '5', '창업 상담 받으려고 방문했다가 먹어보고 반했어요. 본사 직원이 직접 튀겨 주신 닭이 이 가격이라니 놀랍습니다.', '가마 후라이드'],
  ['문', '#ff7a3d', '문가은 · 인스타그램', '5', '치킨무가 직접 담근 맛이라 입가심이 완벽해요. 포장 쇼핑백도 예뻐서 선물용으로 들고 가기 좋아요.', '선물 박스'],
  ['류', '#2b9348', '류성훈 · 쿠팡이츠', '5', '재주문 7번째. 한 번도 맛이 흔들린 적이 없어요. 배달 기사님 연락도 항상 친절하게 와서 감사합니다.', '순살 크리스피'],
];
const stars = n => '★'.repeat(+n) + '☆'.repeat(5 - n);
const card = r => `<article class="s067__card"><div class="s067__top"><span class="s067__av" style="background:${r[1]}">${r[0]}</span><div class="s067__who">${r[2].split(' · ')[0]}<small>${r[2].split(' · ')[1]}</small></div><span class="s067__st">${stars(r[3])}</span></div><p class="s067__txt">${r[4]}</p><span class="s067__menu">${r[5]}</span></article>`;

export default function init(root, ctx) {
  const cols = [...root.querySelectorAll('.s067__col')];
  const wall = root.querySelector('[data-wall]');
  const state = cols.map((col, k) => {
    const inner = col.querySelector('[data-inner]');
    const pick = R.filter((_, i) => i % 3 === k);
    const html = pick.map(card).join('');
    inner.innerHTML = html + html + html; // 복제로 무한 루프(3벌)
    return { inner, dir: +col.dataset.dir, pos: k * 140, H: 0, base: 42 + k * 9 };
  });
  const measure = () => state.forEach(s => { s.H = s.inner.scrollHeight / 3; });
  measure();
  const ro = new ResizeObserver(measure); ro.observe(wall);
  let speed = 1, hover = false, vis = true;
  wall.addEventListener('pointerenter', () => { hover = true; }); wall.addEventListener('pointerleave', () => { hover = false; });
  const io = new IntersectionObserver(e => { vis = e[0].isIntersecting; }, { threshold: 0 }); io.observe(root);
  const off = ctx.tick((t, dt) => {
    if (!vis) return;
    const sec = Math.min(.05, (dt || 16) / 1000);
    const lv = ctx.lenis ? Math.abs(ctx.lenis.velocity || 0) : 0;
    const target = hover ? 0 : 1 + Math.min(lv * .35, 7);
    speed += (target - speed) * (hover ? .06 : .12); // 호버 시 느리게 감속
    state.forEach(s => {
      if (!s.H) return;
      s.pos = (s.pos + s.base * speed * sec) % s.H;
      const y = s.dir < 0 ? -s.pos : s.pos - s.H;
      s.inner.style.transform = `translate3d(0,${y.toFixed(2)}px,0)`;
    });
  });
  gsap.from(wall, { autoAlpha: 0, x: 80, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: root, start: 'top 70%', once: true } });
  return () => { off(); ro.disconnect(); io.disconnect(); gsap.killTweensOf(wall); };
}
