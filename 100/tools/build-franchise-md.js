// node 100/tools/build-franchise-md.js → 100/FRANCHISE.md (manifest.json 의 fran 분류에서 생성)
const fs = require('fs'), path = require('path');
const M = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'manifest.json'), 'utf8'));
const t = {}; M.list.forEach(s => t[s.id] = s.title.replace(/\|/g, '/'));
const star = n => '★'.repeat(n), fr = M.list.filter(s => s.fran), non = M.list.filter(s => !s.fran);
let md = `# 창업문의 · 프랜차이즈 홈페이지용 분류

${M.list.length}개 섹션 중 **${fr.length}개**를 창업·프랜차이즈 홈페이지(브이웍스 포트폴리오 유형)에 맞춰 따로 분류했다. 갤러리: \`100/#franchise\` ( 🏪 창업·프랜차이즈 추천 탭 ).

## 분류 기준 (4축)
1. **창업 퍼널 단계** — 방문자가 문의까지 가는 순서대로 8단계 (아래 표)
2. **적합 등급** — ★★★ 핵심(창업문의 페이지에 바로) · ★★ 추천(컨셉 맞으면) · ★ 조건부(톤·업종 맞을 때만)
3. **업종** — 브이웹 포트폴리오 분류 그대로: ${M.axes.ind.join(' · ')}. 표기 없으면 전업종
4. **페이지 유형** — 랜딩 최적(단일 롱스크롤, 문의 중심) / 브랜드 전용(서브페이지·내비 전제) / 둘 다
출처: 브이웹 포트폴리오(랜딩페이지·브랜드페이지 × 업종) 분류 체계 차용. s101~s150 은 \`research/R1~R5.md\`(웹 조사 160여 회)를 근거로 퍼널의 빈 곳(비용·수익 시뮬레이터, 진단, 지역 확인, 신뢰 증거, 접수 완료 연출)과 순수 CSS 모션을 채웠다.

> ⚠️ 비용·수익·대출 계산류(s101~s105 등)는 **가상 브랜드·가상 수식의 예시 시뮬레이션**이다. 실제 적용 시 정보공개서 기준 수치와 "예상치이며 수익을 보장하지 않음" 면책 문구가 필요하고, 가맹사업법상 예상수익 표시 요건은 별도 확인이 필요하다. 실시간 상담 티커(s124)는 데모 데이터이며 실서비스에서는 실제 집계만 써야 한다.

## 추천 랜딩 구성안
${M.flow.map((f, i) => `${i + 1}. [${f[0]}] **s${f[1]}** ${t[f[1]]} — ${f[2]}`).join('\n')}

`;
for (const s of M.stages) {
  const items = fr.filter(x => x.fran.stage === s.key).sort((a, b) => b.fran.fit - a.fran.fit || a.id - b.id);
  md += `## ${s.key} ${s.name} (${items.length})\n> ${s.q}\n\n| 섹션 | 등급 | 활용 | 업종 | 유형 |\n|---|---|---|---|---|\n`;
  for (const x of items) md += `| s${x.id} ${t[x.id]} | ${star(x.fran.fit)} | ${x.fran.note} | ${x.fran.ind.join('·')} | ${x.fran.pt === 'both' ? '둘 다' : x.fran.pt === 'landing' ? '랜딩 최적' : '브랜드 전용'} |\n`;
  md += '\n';
}
md += `## 분류에서 제외한 ${non.length}개\n프랜차이즈 창업문의 맥락과 거리가 먼 것(패션 룩북, 천문대·항공·전시 같은 타업종 컨셉, 장식성 강한 WebGL 배경 등). 다른 프로젝트용으로는 그대로 쓸 수 있다.\n\n${non.map(s => 's' + s.id).join(' ')}\n`;
fs.writeFileSync(path.join(__dirname, '..', 'FRANCHISE.md'), md);
console.log('FRANCHISE.md', md.length, 'bytes');
