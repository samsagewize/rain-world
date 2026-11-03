// Deterministic Rain Cats generator: 991 unique regular cats + 9 hand-designed Super Rares = 1,000.
// Renders with the game's own sprite code (headless Chromium), writes 32x32 PNGs + Metaplex JSON.
const { chromium } = require('/workspace/rainworld/tools/node_modules/playwright');
const fs = require('fs');
const OUT = '/workspace/rainworld/raincats';
const SITE = process.env.SITE || 'http://localhost:8765/';
const TOTAL = 1000, SEED = 1000;
// rarity quotas for the 991 regular cats (Super Rares are the 9 hand-made 1/1s)
const QUOTA = { Common: 450, Rare: 320, Epic: 160, Legendary: 61 };
const CREATOR = '4GaueHtYpPLbPKdgPR5JMpkxtoFNmwXceAojdo3ce5aC';
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
(async () => {
  fs.rmSync(OUT + '/png32', { recursive: true, force: true }); fs.rmSync(OUT + '/images', { recursive: true, force: true }); fs.mkdirSync(OUT + '/png32', { recursive: true }); fs.mkdirSync(OUT + '/json', { recursive: true });
  const browser = await chromium.launch(); const page = await browser.newPage();
  await page.goto(SITE, { waitUntil: 'networkidle' });
  const { CM, KEYS, SR } = await page.evaluate(() => ({ CM: rainWorld.nft.CM, KEYS: rainWorld.nft.CM_KEYS, SR: rainWorld.nft.SR.map(r => ({ id: r.id, n: r.n, name: r.name, t: r.t })) }));
  const R = rng(SEED);
  const W = [8, 4, 2, 1];
  const pick = k => { const l = CM[k]; if (typeof l[0] !== 'object') return Math.floor(R() * l.length);
    if (k === 'bg') return Math.floor(R() * 4); // no transparent backdrop in the collection
    let sum = l.reduce((a, o) => a + W[o.t], 0), r = R() * sum; for (let i = 0; i < l.length; i++) { r -= W[l[i].t]; if (r <= 0) return i; } return 0; };
  const VIS = ['fur', 'belly', 'eyes', 'collar', 'pattern', 'ears', 'acc', 'face', 'bg'];
  const seen = new Set(), names = new Set(), cats = [], have = {};
  SR.forEach(r => names.add(r.name)); // regular cats never reuse a 1/1 name
  if (Object.values(QUOTA).reduce((a, b) => a + b, 0) !== TOTAL - SR.length) throw new Error('quota mismatch');
  const tierSum = v => ['fur', 'belly', 'eyes', 'collar', 'pattern', 'ears', 'acc', 'face'].reduce((a, k) => a + CM[k][v[k]].t, 0);
  const rarity = s => s >= 8 ? 'Legendary' : s >= 6 ? 'Epic' : s >= 4 ? 'Rare' : 'Common';
  const nameOf = v => [CM.title[v.title], CM.first[v.first], CM.last[v.last]].filter(Boolean).join(' ');
  while (cats.length < TOTAL - SR.length) {
    const v = {}; KEYS.forEach(k => v[k] = pick(k));
    const vis = VIS.map(k => v[k]).join(',');
    // keep Rain's own look (and anything visually identical to the OG 1/1) out of the regular set
    if (seen.has(vis) || VIS.slice(0, 8).every(k => v[k] === 0)) continue;
    const rr = rarity(tierSum(v)); if ((have[rr] || 0) >= QUOTA[rr]) continue;
    let tries = 0; while (names.has(nameOf(v)) && tries++ < 50) { v.title = pick('title'); v.first = pick('first'); v.last = pick('last'); }
    if (names.has(nameOf(v))) continue;
    seen.add(vis); names.add(nameOf(v)); have[rr] = (have[rr] || 0) + 1;
    const dna = KEYS.map(k => v[k].toString(36)).join('');
    cats.push({ dna, name: nameOf(v), rarity: rarity(tierSum(v)), attrs: { Fur: CM.fur[v.fur].n, Belly: CM.belly[v.belly].n, Eyes: CM.eyes[v.eyes].n, Collar: CM.collar[v.collar].n, Pattern: CM.pattern[v.pattern].n, 'Ear Tips': CM.ears[v.ears].n, 'On Top': CM.acc[v.acc].n, Face: CM.face[v.face].n, Backdrop: CM.bg[v.bg].n } });
  }
  SR.forEach(r => cats.push({ dna: 'sr-' + r.id, name: r.name, rarity: 'Super Rare', attrs: r.t, title: r.n }));
  // blind order: seeded Fisher-Yates shuffle
  for (let i = cats.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [cats[i], cats[j]] = [cats[j], cats[i]]; }
  // render 32x32 art with the game's sprite code
  for (let i = 0; i < cats.length; i += 200) {
    const batch = cats.slice(i, i + 200).map(c => c.dna);
    const urls = await page.evaluate(b => b.map(d => rainWorld.nft.png32(d)), batch);
    urls.forEach((u, j) => fs.writeFileSync(`${OUT}/png32/${i + j}.png`, Buffer.from(u.split(',')[1], 'base64')));
  }
  await browser.close();
  const manifest = cats.map((c, i) => ({ index: i, number: i + 1, ...c }));
  fs.writeFileSync(OUT + '/manifest.json', JSON.stringify(manifest, null, 1));
  // rarity report
  const report = { total: cats.length, rarity: {}, traits: {} };
  manifest.forEach(c => { report.rarity[c.rarity] = (report.rarity[c.rarity] || 0) + 1;
    Object.entries(c.attrs).forEach(([k, val]) => { report.traits[k] = report.traits[k] || {}; report.traits[k][val] = (report.traits[k][val] || 0) + 1; }); });
  Object.keys(report.traits).forEach(k => report.traits[k] = Object.fromEntries(Object.entries(report.traits[k]).sort((a, b) => b[1] - a[1])));
  fs.writeFileSync(OUT + '/rarity-report.json', JSON.stringify(report, null, 2));
  let md = `# Rain Cats rarity report\n\nTotal: ${cats.length} (unique visual trait combos: ${new Set(manifest.map(c => VIS.map(k => c.attrs[k]).join())).size})\n\n## Rarity\n\n| Rarity | Count | % |\n|---|---|---|\n`;
  ['Common', 'Rare', 'Epic', 'Legendary', 'Super Rare'].forEach(r => md += `| ${r} | ${report.rarity[r] || 0} | ${(100 * (report.rarity[r] || 0) / cats.length).toFixed(2)}% |\n`);
  md += `\n## Super Rares (1/1)\n\n` + manifest.filter(c => c.rarity === 'Super Rare').map(c => `- Rain Cat #${String(c.number).padStart(4, '0')}: ${c.title} ("${c.name}")`).join('\n') + '\n';
  for (const [k, vals] of Object.entries(report.traits)) { md += `\n## ${k}\n\n| Value | Count | % |\n|---|---|---|\n`; for (const [val, n] of Object.entries(vals)) md += `| ${val} | ${n} | ${(100 * n / cats.length).toFixed(2)}% |\n`; }
  fs.writeFileSync(OUT + '/rarity-report.md', md);
  console.log('generated', cats.length, JSON.stringify(report.rarity));
})();
