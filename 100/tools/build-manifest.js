// node C:/Users/H/Desktop/anim-lab/100/tools/build-manifest.js  → 100/manifest.json
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const dir = path.join(root, 'sections');
const list = [];
for (const d of fs.readdirSync(dir).filter(d => /^s\d{3}$/.test(d)).sort()) {
  const mp = path.join(dir, d, 'meta.json');
  if (!fs.existsSync(mp) || !fs.existsSync(path.join(dir, d, 'section.js'))) continue;
  if (d === 's000') continue; // 계약 샘플은 갤러리에서 제외
  const m = JSON.parse(fs.readFileSync(mp, 'utf8'));
  list.push({ id: d.slice(1), title: m.title, category: m.category, tech: m.tech || [], desc: m.desc || '', use: m.use || '',
    thumb: fs.existsSync(path.join(root, 'shots', d + '_a.jpg')) });
}
fs.writeFileSync(path.join(root, 'manifest.json'), JSON.stringify(list, null, 1));
console.log('manifest', list.length);
