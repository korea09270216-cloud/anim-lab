// node C:/Users/H/Desktop/anim-lab/100/tools/build-manifest.js  → 100/manifest.json
// sections/*/meta.json + franchise.json(창업·프랜차이즈 분류) 를 합쳐 갤러리용 manifest 를 만든다.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'sections');
const fp = path.join(root, 'franchise.json');
const fr = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, 'utf8')) : { items: {}, ind: {}, pt: {}, stages: [] };
const list = [];
for (const d of fs.readdirSync(dir).filter(d => /^s\d{3}$/.test(d)).sort()) {
  const mp = path.join(dir, d, 'meta.json');
  if (!fs.existsSync(mp) || !fs.existsSync(path.join(dir, d, 'section.js'))) continue;
  if (d === 's000') continue; // 계약 샘플은 갤러리에서 제외
  const id = d.slice(1);
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  const f = fr.items[id] || m.fran; // 라운드2 섹션은 meta.json 의 fran 필드를 직접 쓴다
  list.push({ id, title: m.title, category: m.category, tech: m.tech || [], desc: m.desc || '', use: m.use || '',
    fran: f ? { ...f, ind: fr.ind[id] || f.ind || ['전업종'], pt: fr.pt[id] || f.pt || 'both' } : null,
    thumb: fs.existsSync(path.join(root, 'shots', d + '_a.jpg')) });
}
fs.writeFileSync(path.join(root, 'manifest.json'),
  JSON.stringify({ stages: fr.stages, fit: fr.fit, axes: fr.axes, flow: fr.flow, list }, null, 1));
console.log('manifest', list.length, '· franchise', list.filter(s => s.fran).length);
