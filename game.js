/* Rain's World — a tiny pixel world for Rain the cat. Vanilla JS, no build, no backend. */
(() => {
'use strict';

// ---------- constants & palette ----------
const T = 16, MW = 64, MH = 48, WW = MW * T, WH = MH * T;
const C = {
  void: '#070912', star: '#3a4470', shore: '#2bb894',
  g1: '#171d30', g2: '#1a2135', g3: '#1d2539', tuft: '#24343c', tuft2: '#2d4446',
  vil1: '#18302d', vil2: '#1c3632', vilTuft: '#2a4d42',
  path: '#272e47', path2: '#2c3450', edge: '#3a4364', lane: '#2bb894',
  plaza: '#2a3152', plaza2: '#323a5e',
  desk1: '#1f1b38', desk2: '#25203f',
  mint: '#5ef2c2', mint2: '#2bb894', mint3: '#17614f',
  ink: '#e8f0ff', out: '#0b0d18', wall: '#2a3150', wall2: '#343c60', wall3: '#1f2442',
  pink: '#ff8fb1', orange: '#f6a04d', orange2: '#c46a1c', purple: '#9b6bff', purple2: '#5b3bb0',
  yellow: '#ffd66b', sky: '#6bc6ff', red: '#ff5a6e', glass: '#123a40', glass2: '#1b5a5c'
};

// ---------- tiny 3x5 pixel font ----------
const FONT = {
  A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',
  F:'111100110100100',G:'011100101101011',H:'101101111101101',I:'111010010010111',J:'001001001101010',
  K:'101101110101101',L:'100100100100111',M:'101111101101101',N:'111101101101101',O:'010101101101010',
  P:'110101110100100',Q:'010101101110011',R:'110101110101101',S:'011100010001110',T:'111010010010010',
  U:'101101101101111',V:'101101101101010',W:'101101111111101',X:'101101010101101',Y:'101101010010010',
  Z:'111001010100111','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
  '4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111',
  '9':'111101111001110','$':'011110010011110','!':'010010010000010','?':'110001010000010','.':'000000000000010',
  '-':'000000111000000',"'":'010010000000000',' ':'000000000000000','&':'010101010101011',':':'000010000010000'
};
function text(ctx, s, x, y, col, sc = 1) {
  ctx.fillStyle = col;
  s = s.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    const g = FONT[s[i]] || FONT[' '];
    for (let b = 0; b < 15; b++) if (g[b] === '1') ctx.fillRect(x + (b % 3) * sc + i * 4 * sc, y + ((b / 3) | 0) * sc, sc, sc);
  }
}
const textW = (s, sc = 1) => s.length * 4 * sc - sc;

// ---------- helpers ----------
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.imageSmoothingEnabled = false; return [c, x]; }
function R(ctx, x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
function box(ctx, x, y, w, h, fill, line = C.out) { R(ctx, x, y, w, h, line); R(ctx, x + 1, y + 1, w - 2, h - 2, fill); }
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const rand = rng(20261103);
function ring(ctx, cx, cy, r, col) { ctx.fillStyle = col; const n = Math.max(12, Math.round(r * 6)); for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.6), 1, 1); } }
function glow(ctx, x, y, r, col, a) { ctx.fillStyle = col; for (let i = 3; i >= 1; i--) { ctx.globalAlpha = a / 3; ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), Math.round(r * i / 3), 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }

// ---------- cat sprites ----------
const FRONT = ['........','..oo....','..ofo...','..ofpooo','..offfff','.offffff','.offeeff','.offkeff','.offffff','.offflll','..occccc','..offlll','..offlll','..offfff','..offoff','..oooooo'];
const mirror = r => r + r.split('').reverse().join('');
function catRows(dir) {
  let rows = FRONT.map(mirror).map(r => r.split(''));
  if (dir === 'down') { rows[8][7] = 'n'; rows[8][8] = 'n'; }
  if (dir === 'up') { [6, 7, 8, 9].forEach(i => rows[i] = mirror('.offffff').split('')); rows[11] = mirror('..offfff').split(''); rows[12] = mirror('..offfff').split('');
    rows[9][14] = 'o'; rows[10][14] = 'o'; rows[11][14] = 'o'; rows[8][15] = 'o'; }
  if (dir === 'side') {
    rows[6] = '.offffeefffeefo.'.split(''); rows[7] = '.offffekfffekfo.'.split('');
    rows[8] = '.offffffffnfffo.'.split(''); rows[9] = '.offffffllllllo.'.split('');
    rows[8][0] = 'o'; rows[9][0] = 'o'; rows[10][0] = 'o'; rows[10][1] = 'o'; rows[11][1] = 'o';
  }
  return rows;
}
const catCache = new Map();
const CAT_RAINBOW = ['#ff5a6e', '#f6a04d', '#ffd66b', '#7ad97a', '#6bc6ff', '#b78bff'];
function catGrid(look, d) {
  const rows = catRows(d), G = [];
  for (let y = 0; y < 16; y++) { G[y] = []; for (let x = 0; x < 16; x++) {
    const ch = rows[y][x]; let col = null;
    if (ch === 'o') col = look.o || C.out; else if (ch === 'f') col = look.f; else if (ch === 'l') col = look.l;
    else if (ch === 'e') col = look.e2 && x >= 8 ? look.e2 : look.e; else if (ch === 'k') col = C.out; else if (ch === 'n') col = C.pink;
    else if (ch === 'p') col = look.ear || C.pink; else if (ch === 'c') col = look.rainbow ? CAT_RAINBOW[x % 6] : (look.c || look.f);
    if (ch === 'f' && look.rainbowFur) col = CAT_RAINBOW[Math.floor((y - 1) / 2.5) % 6];
    G[y][x] = col; } }
  const isF = (x, y) => rows[y] && rows[y][x] === 'f';
  const set = (pts, col) => pts.forEach(([x, y]) => { if (isF(x, y)) G[y][x] = col; });
  if (look.earTip) set([[3, 2], [12, 2], [3, 3], [12, 3]], look.earTip);
  if (look.calico) { set([[4, 4], [5, 4], [4, 5], [5, 5], [11, 12], [12, 12], [12, 11]], '#e08a3c'); set([[10, 4], [11, 4], [11, 5], [3, 12], [4, 12], [3, 13]], '#2e3150'); }
  if (look.galaxy) set([[5, 4], [10, 5], [3, 9], [12, 9], [6, 12], [11, 13], [8, 4], [13, 6]], '#ffffff'), set([[7, 5], [4, 13], [12, 4]], C.mint);
  const m = look.mark, W = '#f4f6fb', all = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) all.push([x, y]);
  switch (look.pattern) {
    case 'spots': set([[5, 4], [6, 4], [12, 5], [3, 11], [4, 11], [12, 13], [11, 13], [9, 12]], m); break;
    case 'tabby': if (d === 'up') set(all.filter(([x, y]) => (y === 5 || y === 8 || y === 12) && x > 2 && x < 13), m);
      else set([[5, 4], [7, 4], [8, 4], [10, 4], [7, 5], [8, 5], [2, 6], [13, 6], [2, 8], [13, 8], [3, 11], [12, 11], [3, 13], [12, 13]], m); break;
    case 'tuxedo': set(all.filter(([x, y]) => (y >= 9 && y <= 14 && x >= 5 && x <= 10 && d !== 'up') || y === 14), W); break;
    case 'socks': set(all.filter(([x, y]) => y === 14 || (y === 13 && (x < 5 || x > 10))), W); break;
    case 'patch': if (d !== 'up') set(all.filter(([x, y]) => y >= 4 && y <= 8 && (d === 'side' ? x >= 5 && x <= 8 : x >= 2 && x <= 6)), m); break;
  }
  if (look.sparkle) set([[4, 4], [11, 5], [2, 8], [13, 9], [5, 12], [10, 13], [7, 5]], look.sparkle);
  if (look.spots) set([[4, 4], [5, 4], [4, 5], [5, 5], [10, 11], [11, 11], [10, 12], [11, 12]], look.spots);
  if (d !== 'up' && look.face && look.face !== 'none') {
    const EL = d === 'side' ? [6, 7] : [4, 5], ER = d === 'side' ? [11, 12] : [10, 11], o = look.o || C.out;
    const shut = cols => cols.forEach(x => { G[6][x] = look.f; G[7][x] = o; });
    if (look.face === 'blush') set(d === 'side' ? [[6, 8], [7, 8], [12, 8], [13, 8]] : [[3, 8], [4, 8], [11, 8], [12, 8]], '#ff6f9a');
    if (look.face === 'whiskers') { const wc = '#cfd8ee'; G[8][15] = wc; G[9][15] = wc; if (d !== 'side') { G[8][0] = wc; G[9][0] = wc; } }
    if (look.face === 'sleepy') { shut(EL); shut(ER); }
    if (look.face === 'wink') shut(ER);
    if (look.face === 'glasses') {
      const gc = look.dark ? '#cfd8ee' : '#1b1d33';
      [EL, ER].forEach(([a, b]) => { for (let x = a - 1; x <= b + 1; x++) { if (G[5][x]) G[5][x] = gc; if (d !== 'side' && G[8][x] && rows[8][x] === 'f') G[8][x] = gc; } [6, 7].forEach(y => { G[y][a - 1] = gc; G[y][b + 1] = gc; }); });
      G[6][EL[1] + 2] = gc; if (EL[1] + 3 < ER[0] - 1) G[6][EL[1] + 3] = gc;
    }
  }
  return G;
}
function catSprite(pal, dir, frame) {
  const key = pal.name + dir + frame;
  if (catCache.has(key)) return catCache.get(key);
  const d = dir === 'left' || dir === 'right' ? 'side' : dir;
  const G = catGrid(pal, d);
  const [c, x] = mk(16, 16);
  const off = frame ? 1 : 0;
  for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
    let col = G[y][i];
    if (frame && y === 14 && (i === 5 || i === 10)) col = G[14][i === 5 ? 4 : 11];
    if (col) { x.fillStyle = col; x.fillRect(dir === 'left' ? 15 - i : i, y - (y < 14 ? off : 0), 1, 1); }
  }
  catCache.set(key, c);
  return c;
}
const RAIN = { name: 'rain', f: '#8ea6d6', l: '#dfe8fb', e: C.mint, c: C.mint };
const VILLAGE_PALS = [
  { name: 'ginger', f: '#f0a050', l: '#fde2c0', e: '#ffe66b', c: '#ff6b6b' },
  { name: 'snow', f: '#e6e9f3', l: '#ffffff', e: '#6bc6ff', c: C.purple },
  { name: 'ink', f: '#2e3150', l: '#4d5175', e: C.yellow, c: C.yellow, o: '#04050a' },
  { name: 'calico', f: '#f3e6d3', l: '#ffffff', e: '#7ad97a', c: C.mint, spots: '#e08a3c' },
  { name: 'smoke', f: '#9aa0b3', l: '#cfd4e2', e: '#ffb86b', c: C.pink }
];

// ---------- the world layout (tiles) ----------
const isVoid = (tx, ty) => tx < 2 || tx > 61 || ty < 2 || ty > 45;
const inR = (tx, ty, x0, y0, x1, y1) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1;
const PLAZA = { x: 32, y: 30, r: 4.6 };
function tileKind(tx, ty) {
  if (isVoid(tx, ty)) return 'void';
  if (Math.hypot(tx + 0.5 - PLAZA.x, ty + 0.5 - PLAZA.y) < PLAZA.r) return 'plaza';
  if (inR(tx, ty, 30, 17, 33, 45)) return 'avenue';
  if (inR(tx, ty, 4, 29, 60, 31)) return 'road';
  if (inR(tx, ty, 11, 17, 13, 28)) return 'path';
  if (inR(tx, ty, 10, 32, 12, 39)) return 'path';
  if (inR(tx, ty, 51, 24, 53, 28)) return 'path';
  if (inR(tx, ty, 40, 17, 42, 28)) return 'path';
  if (inR(tx, ty, 49, 32, 50, 41)) return 'path';
  if (inR(tx, ty, 45, 16, 60, 28)) return 'desk';
  if (inR(tx, ty, 2, 2, 21, 17)) return 'village';
  return 'ground';
}

const solids = [];
const props = [];      // {y (baseline), draw(ctx,t)}
const overhead = [];   // drawn above entities
const lights = [];     // {x,y,r,col,a, flick}
const targets = [];    // interaction points
const npcs = [];
const solid = (x, y, w, h) => solids.push({ x, y, w, h });

// ---------- ground prerender ----------
const [ground, gx] = mk(WW, WH);
(function paintGround() {
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    const k = tileKind(tx, ty), X = tx * T, Y = ty * T;
    if (k === 'void') {
      R(gx, X, Y, T, T, C.void);
      for (let i = 0; i < 2; i++) if (rand() < 0.35) R(gx, X + (rand() * 16 | 0), Y + (rand() * 16 | 0), 1, 1, rand() < 0.2 ? C.mint3 : C.star);
      continue;
    }
    if (k === 'ground' || k === 'village') {
      const v = k === 'village';
      R(gx, X, Y, T, T, (tx + ty) % 2 ? (v ? C.vil1 : C.g1) : (v ? C.vil2 : C.g2));
      for (let i = 0; i < 3; i++) if (rand() < 0.5) { const a = X + (rand() * 14 | 0), b = Y + (rand() * 14 | 0); R(gx, a, b, 1, 2, v ? C.vilTuft : C.tuft); R(gx, a + 1, b + 1, 1, 1, v ? C.vilTuft : C.tuft2); }
      if (!v && rand() < 0.04) R(gx, X + 7, Y + 7, 2, 2, C.mint3);
      if (v && rand() < 0.08) { R(gx, X + 5, Y + 9, 1, 1, C.pink); R(gx, X + 11, Y + 4, 1, 1, C.yellow); }
    } else if (k === 'desk') {
      R(gx, X, Y, T, T, (tx + ty) % 2 ? C.desk1 : C.desk2);
      R(gx, X, Y, T, 1, '#2c2650'); R(gx, X, Y, 1, T, '#2c2650');
    } else if (k === 'plaza') {
      R(gx, X, Y, T, T, (tx + ty) % 2 ? C.plaza : C.plaza2);
      R(gx, X + 7, Y + 7, 2, 2, '#3c4570');
    } else {
      R(gx, X, Y, T, T, (tx * 7 + ty * 3) % 5 ? C.path : C.path2);
      R(gx, X + 3, Y + 5, 2, 1, C.edge); R(gx, X + 10, Y + 11, 2, 1, C.edge);
    }
  }
  // shoreline glow
  for (let ty = 0; ty < MH; ty++) for (let tx = 0; tx < MW; tx++) {
    if (isVoid(tx, ty)) continue;
    const X = tx * T, Y = ty * T;
    if (isVoid(tx, ty - 1)) { R(gx, X, Y, T, 2, C.mint2); R(gx, X, Y - 2, T, 2, C.mint3); }
    if (isVoid(tx, ty + 1)) { R(gx, X, Y + 14, T, 2, C.mint2); R(gx, X, Y + 16, T, 3, '#0c2a28'); }
    if (isVoid(tx - 1, ty)) R(gx, X, Y, 2, T, C.mint2);
    if (isVoid(tx + 1, ty)) R(gx, X + 14, Y, 2, T, C.mint2);
  }
  // lane dashes on the avenue & road
  for (let y = 17 * T; y < 46 * T; y += 12) if (Math.hypot(32 - 32, y / T - PLAZA.y) > PLAZA.r) R(gx, 32 * T - 1, y, 2, 6, C.lane);
  for (let x = 4 * T; x < 61 * T; x += 12) if (Math.abs(x / T - 32) > PLAZA.r) R(gx, x, 30 * T + 7, 6, 2, C.lane);
  // plaza ring
  ring(gx, PLAZA.x * T, PLAZA.y * T + 8, PLAZA.r * T - 6, C.mint2);
  ring(gx, PLAZA.x * T, PLAZA.y * T + 8, PLAZA.r * T - 9, C.mint3);
})();

// ---------- building sprites ----------
function windowGrid(x, X, Y, cols, rows, w, h, gapx, gapy, col) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { box(x, X + c * (w + gapx), Y + r * (h + gapy), w, h, col); R(x, X + c * (w + gapx) + 1, Y + r * (h + gapy) + 1, 2, 1, '#bfffe9'); }
}

// Rooms studio + radio tower
const TOWER = { x: 26 * T, y: 16 * T, w: 12 * T, h: 184 };
(function rooms() {
  const [c, x] = mk(TOWER.w, TOWER.h);
  const W = TOWER.w, H = TOWER.h, bodyTop = 84;
  // antenna lattice
  const cx = W / 2, top = 10, base = bodyTop - 2;
  for (let y = top; y <= base; y++) {
    const half = 2 + Math.round((y - top) / (base - top) * 18);
    R(x, cx - half, y, 1, 1, '#9aa6cc'); R(x, cx + half - 1, y, 1, 1, '#9aa6cc');
    if ((y - top) % 8 === 0) R(x, cx - half, y, half * 2, 1, '#6c789e');
    if ((y - top) % 8 < 8) { const k = (y - top) % 8 / 8; R(x, Math.round(cx - half + k * half * 2), y, 1, 1, '#56618a'); }
  }
  R(x, cx - 1, 2, 2, 10, '#c9d3ea');
  // dishes
  box(x, cx - 26, 46, 8, 6, '#c9d3ea'); box(x, cx + 18, 56, 8, 6, '#c9d3ea');
  // body
  box(x, 2, bodyTop, W - 4, H - bodyTop, C.wall);
  R(x, 3, bodyTop + 1, W - 6, 6, C.wall2);
  R(x, 3, bodyTop + 7, W - 6, 2, C.mint);
  R(x, 3, H - 6, W - 6, 5, C.wall3);
  windowGrid(x, 12, bodyTop + 16, 4, 3, 10, 9, 6, 6, C.glass2);
  windowGrid(x, W - 12 - 4 * 16 + 6, bodyTop + 16, 4, 3, 10, 9, 6, 6, C.glass2);
  // big sign
  box(x, cx - 34, bodyTop + 14, 68, 20, '#0d1124', C.mint);
  text(x, 'ROOMS', cx - textW('ROOMS', 3) / 2, bodyTop + 17, C.mint, 3);
  // on air
  box(x, cx - 16, bodyTop + 40, 32, 10, '#2a0d18', C.red);
  text(x, 'ON AIR', cx - textW('ON AIR') / 2, bodyTop + 43, C.pink);
  // door
  box(x, cx - 12, H - 30, 24, 28, '#0d1124', C.mint);
  R(x, cx - 1, H - 29, 2, 26, C.mint3);
  R(x, cx - 6, H - 18, 2, 2, C.mint); R(x, cx + 4, H - 18, 2, 2, C.mint);
  // cat ear rooftop accents
  [[10, 0], [W - 26, 0]].forEach(([ex]) => { for (let i = 0; i < 8; i++) R(x, ex + i, bodyTop - i, 16 - i * 2, 1, C.wall2); });
  props.push({ y: TOWER.y, draw: g => g.drawImage(c, TOWER.x, TOWER.y - H) });
  solid(TOWER.x + 2, TOWER.y - 68, W - 4, 66);
  const top0 = { x: TOWER.x + cx, y: TOWER.y - H + 3 };
  lights.push({ x: top0.x, y: top0.y, r: 26, col: C.mint, a: 0.5, pulse: 1 });
  lights.push({ x: TOWER.x + cx, y: TOWER.y - 70, r: 60, col: C.mint, a: 0.18 });
  lights.push({ x: TOWER.x + cx, y: TOWER.y - 10, r: 22, col: C.mint, a: 0.3 });
  overhead.push((g, t) => {
    const p = (Math.sin(t * 3) + 1) / 2;
    R(g, top0.x - 2, top0.y - 2, 4, 4, p > 0.5 ? '#ffffff' : C.mint);
    for (let i = 0; i < 3; i++) { const r = ((t * 22 + i * 18) % 54) + 4; g.globalAlpha = 1 - r / 58; ring(g, top0.x, top0.y + 2, r, C.mint); }
    g.globalAlpha = 1;
  });
})();

// Ask Rain booth
const BOOTH = { x: 39 * T, y: 16 * T + 8 };
(function booth() {
  const [c, x] = mk(64, 64);
  box(x, 6, 30, 52, 34, C.wall);
  for (let i = 0; i < 6; i++) R(x, 4 + i * 9, 24, 9, 8, i % 2 ? C.ink : C.mint);
  R(x, 4, 32, 56, 2, C.out);
  box(x, 10, 40, 44, 14, '#0d1124', C.mint2);
  box(x, 4, 52, 56, 10, '#3a4170');
  text(x, 'ASK RAIN', 32 - textW('ASK RAIN') / 2, 44, C.mint);
  // bubble with cat
  box(x, 18, 0, 28, 20, C.ink);
  R(x, 28, 19, 4, 3, C.ink); R(x, 29, 21, 2, 2, C.ink);
  const cat = catSprite(RAIN, 'down', 0); x.drawImage(cat, 24, 2);
  props.push({ y: BOOTH.y, draw: (g, t) => { g.drawImage(c, BOOTH.x, BOOTH.y - 64 + (Math.sin(t * 2) > 0.95 ? -1 : 0)); } });
  solid(BOOTH.x + 4, BOOTH.y - 22, 56, 22);
  lights.push({ x: BOOTH.x + 32, y: BOOTH.y - 20, r: 24, col: C.mint, a: 0.3 });
})();

// Cinema
const CINE = { x: 6 * T, y: 39 * T + 8, w: 160, h: 112 };
(function cinema() {
  const [c, x] = mk(CINE.w, CINE.h);
  const W = CINE.w, H = CINE.h;
  box(x, 4, 20, W - 8, H - 20, '#2b2346');
  R(x, 5, 21, W - 10, 4, '#3a2f5e');
  box(x, 0, 30, W, 22, '#1a1430', C.yellow);
  text(x, 'CINEMA', W / 2 - textW('CINEMA', 2) / 2, 36, C.yellow, 2);
  // posters
  box(x, 14, 60, 26, 36, '#0d1124', C.mint); text(x, 'ROOMS', 15, 66, C.mint); R(x, 20, 76, 14, 14, C.mint3); R(x, 24, 80, 6, 6, C.mint);
  box(x, W - 40, 60, 26, 36, '#0d1124', C.pink); text(x, '15S', W - 33, 66, C.pink); R(x, W - 34, 76, 14, 14, '#4a1c36'); R(x, W - 30, 80, 6, 6, C.pink);
  // door
  box(x, W / 2 - 16, H - 34, 32, 34, '#120d22', C.yellow);
  R(x, W / 2 - 1, H - 33, 2, 33, '#2a2040');
  // roof
  box(x, 10, 6, W - 20, 16, '#3a2f5e'); text(x, 'NOW SHOWING', W / 2 - textW('NOW SHOWING') / 2, 11, C.ink);
  props.push({ y: CINE.y, draw: (g, t) => {
    g.drawImage(c, CINE.x, CINE.y - H);
    const on = Math.floor(t * 4) % 2;
    for (let i = 0; i < 20; i++) R(g, CINE.x + 3 + i * 8, CINE.y - H + 31, 2, 2, (i % 2) === on ? '#fff3b0' : '#6b5a20');
    for (let i = 0; i < 20; i++) R(g, CINE.x + 3 + i * 8, CINE.y - H + 49, 2, 2, (i % 2) !== on ? '#fff3b0' : '#6b5a20');
  } });
  solid(CINE.x + 4, CINE.y - 56, W - 8, 54);
  lights.push({ x: CINE.x + W / 2, y: CINE.y - H + 40, r: 70, col: C.yellow, a: 0.18 });
  lights.push({ x: CINE.x + W / 2, y: CINE.y - 12, r: 22, col: C.yellow, a: 0.25 });
})();

// Solana trading desk
const DESK = { x: 47 * T, y: 23 * T + 4, w: 192, h: 104 };
const chart = Array.from({ length: 40 }, (_, i) => 0.3 + i * 0.008 + Math.sin(i * 0.7) * 0.05);
(function desk() {
  const [c, x] = mk(DESK.w, DESK.h);
  const W = DESK.w, H = DESK.h;
  box(x, 2, 14, W - 4, H - 14, '#241f44');
  R(x, 3, 15, W - 6, 5, '#30295a');
  for (let i = 0; i < W - 6; i++) R(x, 3 + i, 20, 1, 2, i < (W - 6) / 2 ? C.purple : C.mint);
  box(x, 30, 0, W - 60, 16, '#120f26', C.purple);
  text(x, 'SOL DESK', W / 2 - textW('SOL DESK', 2) / 2, 3, C.ink, 2);
  // big screen frame
  box(x, 16, 28, W - 32, 40, '#06070f', '#5b5590');
  // goal banner
  box(x, 16, 72, 52, 12, '#2a1d00', C.yellow); text(x, 'GOAL $3K', 18, 76, C.yellow);
  box(x, W - 68, 72, 52, 12, '#0d1124', C.mint); text(x, 'BOTS: 7', W - 64, 76, C.mint);
  // door
  box(x, W / 2 - 12, H - 22, 24, 22, '#120f26', C.purple);
  props.push({ y: DESK.y, draw: (g, t) => {
    g.drawImage(c, DESK.x, DESK.y - H);
    const sx = DESK.x + 18, sy = DESK.y - H + 30, sw = W - 36, sh = 36;
    for (let i = 0; i < 6; i++) R(g, sx, sy + i * 7, sw, 1, '#141833');
    let px = null, py = null;
    for (let i = 0; i < chart.length; i++) {
      const X = sx + Math.round(i * (sw - 1) / (chart.length - 1)), Y = sy + sh - 2 - Math.round(chart[i] * (sh - 4));
      if (px !== null) { const steps = Math.max(Math.abs(X - px), Math.abs(Y - py)); for (let s = 0; s <= steps; s++) R(g, Math.round(px + (X - px) * s / steps), Math.round(py + (Y - py) * s / steps), 1, 1, C.mint); }
      px = X; py = Y;
    }
    if (Math.floor(t * 2) % 2) R(g, px - 1, py - 1, 3, 3, '#ffffff');
  } });
  solid(DESK.x + 2, DESK.y - 50, W - 4, 48);
  lights.push({ x: DESK.x + W / 2, y: DESK.y - H + 48, r: 60, col: C.purple, a: 0.2 });
})();
setInterval(() => { const last = chart[chart.length - 1]; let n = last + (Math.random() - 0.42) * 0.06; if (n > 0.95) n = 0.55; if (n < 0.05) n = 0.2; chart.shift(); chart.push(n); }, 700);

// Bots at their desks
const BOTS = [
  ['Scout', C.sky, 'Scans the Solana markets for fresh candidates and brings them to the desk.'],
  ['Guard', C.red, 'Runs the safety checks before the desk touches anything.'],
  ['Trader', C.mint, 'Places the trades the desk agrees on.'],
  ['Desk Coach', C.yellow, 'Reviews the desk\'s calls and keeps every bot sharp.'],
  ['Account Advisor', C.purple, 'Keeps an eye on the account and the plan toward the goal.'],
  ['Gambler', C.pink, 'Takes the small, high-risk swings, on a short leash.'],
  ['Twitter Pulse', '#1d9bf0', 'Listens to the chatter on X and reports the mood.']
];
function drawBot(g, x, y, col, t, i) {
  const bob = Math.sin(t * 3 + i) > 0 ? 0 : 1;
  R(g, x - 1, y - 22 + bob, 1, 4, '#c9d3ea'); R(g, x - 2, y - 24 + bob, 3, 2, col);
  box(g, x - 7, y - 19 + bob, 14, 10, '#c9d3ea');
  R(g, x - 5, y - 17 + bob, 10, 6, '#0b0d18');
  const blink = (t * 1.3 + i * 0.7) % 4 < 0.12;
  if (!blink) { R(g, x - 4, y - 15 + bob, 2, 2, col); R(g, x + 2, y - 15 + bob, 2, 2, col); }
  box(g, x - 6, y - 9 + bob, 12, 9, col);
  R(g, x - 2, y - 7 + bob, 4, 2, C.out);
}
BOTS.forEach(([name, col, line], i) => {
  const x = 46 * T + 14 + i * 28, y = 26 * T + 4;
  props.push({ y: y - 6, draw: (g, t) => drawBot(g, x, y - 4, col, t, i) });
  props.push({ y: y + 4, draw: (g, t) => {
    box(g, x - 10, y - 6, 20, 10, '#3a3260');
    R(g, x - 9, y - 5, 18, 2, '#4a4180');
    box(g, x - 5, y - 13, 10, 8, '#0b0d18', '#6c789e');
    const k = Math.floor(t * 2 + i) % 3; R(g, x - 3, y - 11 + k, 6, 1, col); R(g, x - 3, y - 9, 3, 1, C.mint3);
  } });
  solid(x - 10, y - 14, 20, 18);
  lights.push({ x, y: y - 10, r: 10, col, a: 0.25 });
  targets.push({ id: 'bot-' + i, x, y: y + 14, r: 13, name, label: name, kind: 'bot', col, card: {
    tag: 'SOLANA DESK · BOT', title: name, body: line + ' One of seven bots on the desk working together toward a $3k goal.', icon: ['bot', col] } });
});

// Grok Cats village
const HOUSES = [[4, 6, C.pink], [9, 4, C.purple], [15, 5, C.orange], [5, 12, C.sky], [16, 11, C.yellow]];
HOUSES.forEach(([tx, ty, roof], i) => {
  const X = tx * T, Y = ty * T + 40;
  const [c, x] = mk(48, 44);
  box(x, 4, 18, 40, 26, '#3a3550');
  for (let r = 0; r < 14; r++) { const w = 14 + r * 2; R(x, 24 - w / 2, 4 + r, w, 1, r % 4 === 3 ? C.out : roof); }
  for (let r = 0; r < 4; r++) { R(x, 17 + (r >> 1), 4 - r, 4 - (r >> 1) * 2, 1, roof); R(x, 27 + (r >> 1), 4 - r, 4 - (r >> 1) * 2, 1, roof); }
  R(x, 18, 3, 1, 1, C.pink); R(x, 29, 3, 1, 1, C.pink);
  R(x, 4, 18, 40, 2, C.out);
  box(x, 19, 28, 10, 16, '#1a1428'); R(x, 23, 30, 2, 2, roof);
  box(x, 8, 24, 8, 7, '#ffe9a8'); box(x, 32, 24, 8, 7, '#ffe9a8');
  props.push({ y: Y, draw: g => g.drawImage(c, X, Y - 44) });
  solid(X + 4, Y - 22, 40, 22);
  lights.push({ x: X + 12, y: Y - 16, r: 12, col: '#ffe9a8', a: 0.3 });
  lights.push({ x: X + 36, y: Y - 16, r: 12, col: '#ffe9a8', a: 0.3 });
});
function signpost(px, py, label, col, kind) {
  props.push({ y: py, draw: g => {
    R(g, px - 1, py - 14, 3, 14, '#6a5a45');
    const w = Math.max(24, textW(label) + 8);
    box(g, px - w / 2, py - 26, w, 13, '#0d1124', col);
    text(g, label, px - textW(label) / 2 + 1, py - 22, col);
  } });
  solid(px - 2, py - 3, 5, 3);
}
signpost(12 * T + 8, 17 * T + 12, 'GROK CATS', C.yellow);
lights.push({ x: 12 * T + 8, y: 17 * T - 8, r: 16, col: C.yellow, a: 0.25 });

// Cloudflare gate
const GATE = { y: 43 * T };
(function gate() {
  const lx = 28 * T + 4, rx = 34 * T + 4;
  [lx, rx].forEach(px => {
    const [c, x] = mk(24, 56);
    box(x, 0, 6, 24, 50, '#3a4170'); R(x, 1, 7, 22, 3, '#4a5390');
    R(x, 4, 18, 16, 2, C.orange); R(x, 4, 40, 16, 2, C.orange);
    box(x, -2, 0, 28, 8, '#4a5390');
    props.push({ y: GATE.y, draw: g => g.drawImage(c, px, GATE.y - 56) });
    solid(px, GATE.y - 14, 24, 14);
    lights.push({ x: px + 12, y: GATE.y - 30, r: 16, col: C.orange, a: 0.25 });
  });
  const [a, ax] = mk(rx + 24 - lx, 34);
  box(ax, 0, 16, a.width, 14, '#2a2f55', C.orange);
  text(ax, 'CLOUDFLARE', a.width / 2 - textW('CLOUDFLARE') / 2, 21, C.ink);
  // shield
  const sx = a.width / 2 - 7;
  for (let r = 0; r < 15; r++) { const w = r < 8 ? 14 : 14 - (r - 7) * 2; if (w > 0) R(ax, sx + (14 - w) / 2, r, w, 1, r === 0 ? C.orange2 : C.orange); }
  R(ax, sx + 6, 2, 2, 7, '#fff4e0'); R(ax, sx + 4, 4, 6, 2, '#fff4e0');
  // re-draw text below shield
  overhead.push((g, t) => {
    g.drawImage(a, lx, GATE.y - 70);
    const k = (Math.sin(t * 2) + 1) / 2;
    const by = GATE.y - 40 + Math.round(k * 26);
    g.globalAlpha = 0.6; R(g, lx + 24, by, rx - lx - 24, 1, C.orange); g.globalAlpha = 0.25; R(g, lx + 24, by - 1, rx - lx - 24, 3, C.orange); g.globalAlpha = 1;
  });
})();

// Home screen icon monument
const MON = { x: PLAZA.x * T, y: PLAZA.y * T + 14 };
const iconImg = new Image();
let iconPix = null;
iconImg.onload = () => { const [c, x] = mk(28, 28); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(iconImg, 0, 0, 28, 28); iconPix = c; };
iconImg.src = 'assets/rooms-icon.png';
props.push({ y: MON.y, draw: (g, t) => {
  box(g, MON.x - 22, MON.y - 10, 44, 10, '#4a5390'); R(g, MON.x - 21, MON.y - 9, 42, 2, '#5c66a8');
  box(g, MON.x - 18, MON.y - 46, 36, 37, '#2a3150', C.mint2);
  const bob = Math.round(Math.sin(t * 1.5) * 1);
  if (iconPix) g.drawImage(iconPix, MON.x - 14, MON.y - 42 + bob);
  if (Math.floor(t * 3) % 5 === 0) R(g, MON.x + 10, MON.y - 44 + bob, 2, 2, '#ffffff');
  if (Math.floor(t * 3 + 2) % 7 === 0) R(g, MON.x - 13, MON.y - 18 + bob, 1, 1, '#ffffff');
} });
solid(MON.x - 22, MON.y - 12, 44, 12);
lights.push({ x: MON.x, y: MON.y - 28, r: 34, col: C.mint, a: 0.3 });

// Rooms feature signposts along the avenue
const FEATURES = [
  ['FEED', 'Feed', 'The public Rooms Feed: posts, announcements, animated GIFs and token communities, open to guests before they connect a wallet.', 'feed'],
  ['CHARTS', 'Solana charts', 'Public Solana charts for tokens used in Rooms. Pick a cashtag and attach the exact token chart to a Feed post.', 'chart'],
  ['JUPITER', 'Jupiter trading', 'Jupiter Solana trading embedded right inside live rooms and token charts.', 'jup'],
  ['GIFS', 'GIF picker', 'A searchable stock GIF picker with 24 reactions, plus animated GIF uploads in Feed posts.', 'gif'],
  ['PEOPLE', 'People search', 'Find people by name or handle. Profiles can wear any color, gradient, or photo card look.', 'search'],
  ['SOUNDS', 'Soundboard', 'A synchronized room soundboard: claps, boos and a horn that everyone in the room hears at once.', 'sound']
];
FEATURES.forEach(([lab, title, body, icon], i) => {
  const left = i % 2 === 0, row = (i / 2) | 0;
  const px = (left ? 28 : 36) * T + (left ? 6 : 10), py = (19 + row * 3) * T + 10;
  signpost(px, py, lab, C.mint);
  lights.push({ x: px, y: py - 20, r: 14, col: C.mint, a: 0.22 });
  targets.push({ id: 'sign-' + icon, x: px + (left ? 18 : -18), y: py, r: 20, name: title, label: title, kind: 'sign', card: {
    tag: 'ROOMS DISTRICT · FEATURE', title, body, icon: [icon], links: [{ label: 'Open Rooms', href: 'https://www.intherooms.xyz' }] } });
});

// lamps & trees
function lamp(px, py) {
  props.push({ y: py, draw: (g, t) => { R(g, px, py - 20, 2, 20, '#5c66a8'); box(g, px - 2, py - 24, 6, 5, '#0d1124', C.mint2); R(g, px - 1, py - 23, 4, 3, Math.sin(t * 5 + px) > -0.97 ? '#c8fff0' : C.mint3); } });
  solid(px - 1, py - 3, 4, 3);
  lights.push({ x: px + 1, y: py - 21, r: 22, col: C.mint, a: 0.28, flick: 1 });
}
for (let y = 19; y <= 43; y += 4) { if (Math.abs(y - PLAZA.y) < 5) continue; lamp(29 * T + 10, y * T + 14); lamp(34 * T + 4, y * T + 14); }
for (let x = 6; x <= 58; x += 6) { if (Math.abs(x - 32) < 6) continue; lamp(x * T + 4, 29 * T - 1); lamp(x * T + 4, 32 * T + 14); }

function tree(px, py, v) {
  const tones = [['#1e5c4f', '#2b7a64', '#123d36'], ['#3d3a7a', '#5752a8', '#26244f'], ['#1f4f62', '#2b6d85', '#143644']][v % 3];
  props.push({ y: py, draw: (g, t) => {
    R(g, px - 1, py - 6, 3, 6, '#4a3b30');
    const sway = Math.sin(t * 1.2 + px * 0.1) > 0.6 ? 1 : 0;
    box(g, px - 7 + sway, py - 20, 15, 14, tones[0], tones[2]);
    box(g, px - 5 + sway, py - 25, 11, 7, tones[0], tones[2]);
    R(g, px - 4 + sway, py - 22, 4, 2, tones[1]); R(g, px - 5 + sway, py - 17, 3, 2, tones[1]);
    if (v % 4 === 0) { R(g, px + 2 + sway, py - 15, 1, 1, C.pink); R(g, px - 2 + sway, py - 12, 1, 1, C.yellow); }
  } });
  solid(px - 3, py - 4, 7, 4);
}
const RESERVED = [[25, 4, 38, 17], [38, 12, 45, 18], [5, 31, 17, 40], [45, 15, 61, 29], [27, 39, 37, 46], [26, 17, 38, 28], [43, 32, 57, 43]];
const reserved = (tx, ty) => RESERVED.some(([a, b, c, d]) => inR(tx, ty, a, b, c, d)) || HOUSES.some(([hx, hy]) => inR(tx, ty, hx - 1, hy - 1, hx + 3, hy + 3)) || inR(tx, ty, 10, 16, 14, 18);
for (let i = 0; i < 140; i++) {
  const tx = 2 + (rand() * 60 | 0), ty = 3 + (rand() * 43 | 0);
  const k = tileKind(tx, ty);
  if ((k !== 'ground' && k !== 'village') || reserved(tx, ty)) continue;
  const near = (dx, dy) => { const kk = tileKind(tx + dx, ty + dy); return kk === 'void' || kk === 'path' || kk === 'road' || kk === 'avenue' || kk === 'plaza' || kk === 'desk'; };
  if (near(0, 1) || near(0, -1) || near(1, 0) || near(-1, 0)) continue;
  if (k === 'village' && ty > 8 && rand() < 0.6) continue;
  tree(tx * T + 8, ty * T + 14, (rand() * 12) | 0);
}

// ---------- landmark targets ----------
targets.push({ id: 'rooms', x: TOWER.x + TOWER.w / 2, y: TOWER.y + 12, r: 28, name: 'Rooms', label: 'Rooms studio', kind: 'main', card: {
  tag: 'THE MAIN ONE · LIVE AUDIO', title: 'Rooms',
  body: 'Clubhouse-style live audio rooms. Sign in with Phantom on Solana, show up as a cat avatar, fire off emoji reactions, tip speakers in SOL, bring up co-hosts, and get help any time from the Ask Rain support bubble.',
  media: { type: 'img', src: 'assets/rooms-icon.png', alt: 'Rooms app icon' },
  links: [{ label: 'Open intherooms.xyz', href: 'https://www.intherooms.xyz' }, { label: 'GitHub repo', href: 'https://github.com/samsagewize/Rooms', alt: 1 }],
  credit: 'Made by Urua Labs', icon: ['tower'] } });
targets.push({ id: 'askrain', x: BOOTH.x + 32, y: BOOTH.y + 12, r: 22, name: 'Ask Rain', label: 'Ask Rain booth', kind: 'main', card: {
  tag: 'ROOMS · SUPPORT', title: 'Ask Rain', body: 'My support bubble inside Rooms. It floats in the corner of the app, and you can ask it how anything in Rooms works, from connecting Phantom to starting a room.',
  links: [{ label: 'Try it in Rooms', href: 'https://www.intherooms.xyz' }], icon: ['rain'] } });
targets.push({ id: 'cinema', x: CINE.x + CINE.w / 2, y: CINE.y + 12, r: 26, name: 'Rooms promo cinema', label: 'Cinema', kind: 'main', card: {
  tag: 'NOW SHOWING · 15 SECONDS', title: 'Rooms promo', body: 'The 15-second promo video we made for Rooms. Press play.',
  media: { type: 'video', src: 'assets/rooms-promo.mp4' }, links: [{ label: 'Open Rooms', href: 'https://www.intherooms.xyz' }], icon: ['film'] } });
targets.push({ id: 'gate', mdy: 62, x: 32 * T, y: GATE.y - 20, r: 26, name: 'Cloudflare shield gate', label: 'Cloudflare gate', kind: 'main', card: {
  tag: 'SECURITY · THE FRONT GATE', title: 'Cloudflare shield', body: 'intherooms.xyz sits behind Cloudflare with Bot Fight Mode turned on, so automated bots get challenged at the gate before they ever reach a room.',
  links: [{ label: 'intherooms.xyz', href: 'https://www.intherooms.xyz' }], icon: ['shield'] } });
targets.push({ id: 'grokcats', mdy: 46, x: 12 * T + 8, y: 18 * T + 10, r: 24, name: 'Grok Cats village', label: 'Grok Cats village', kind: 'main', card: {
  tag: 'VILLAGE · OPEN TO OTHER BOTS', title: 'Grok Cats', body: 'A cozy pixel garden where every cat is a Grok agent. They wander, sit, and work, and other Grok bots can join over HTTP and walk around as their own cat.',
  links: [{ label: 'GitHub repo', href: 'https://github.com/samsagewize/grok-cats' }], icon: ['cat'] } });
targets.push({ id: 'desk', x: DESK.x + DESK.w / 2, y: DESK.y + 10, r: 22, name: 'Solana trading desk', label: 'Solana trading desk', kind: 'main', card: {
  tag: 'TRADING FLOOR · 7 BOTS', title: 'Solana trading desk', body: 'A little trading floor of bots that work together on Solana: Scout, Guard, Trader, Desk Coach, Account Advisor, Gambler and Twitter Pulse, all working toward a $3k goal. Walk along the desks to meet each one.',
  icon: ['chart'] } });
targets.push({ id: 'icon', mdy: 74, x: MON.x, y: MON.y + 12, r: 22, name: 'Home screen icon monument', label: 'Icon monument', kind: 'main', card: {
  tag: 'MONUMENT · HOME SCREEN', title: 'The Rooms app icon', body: 'The home screen icon we gave Rooms, along with a web app manifest, so it sits on an iPhone home screen like a real app.',
  media: { type: 'img', src: 'assets/rooms-icon.png', alt: 'Rooms home screen icon' }, links: [{ label: 'Add Rooms to your home screen', href: 'https://www.intherooms.xyz' }], icon: ['icon'] } });

// ---------- village cats ----------
VILLAGE_PALS.forEach((pal, i) => {
  npcs.push({ pal, x: (5 + i * 3) * T, y: (9 + (i % 3) * 2) * T + 8, tx: 0, ty: 0, wait: rand() * 2, dir: 'down', frame: 0, ft: 0, bounds: [3 * T, 3 * T + 8, 21 * T, 17 * T], meow: 0 });
});

// ---------- player ----------
const player = { x: 32 * T, y: 37 * T, dir: 'up', frame: 0, ft: 0, moving: false };
const SPEED = 72;

// ---------- collision ----------
function blocked(x, y, w = 10, h = 5) {
  const L = x - w / 2, Rr = x + w / 2, Tp = y - h, B = y;
  for (const [cx, cy] of [[L, Tp], [Rr, Tp], [L, B], [Rr, B]]) if (isVoid(Math.floor(cx / T), Math.floor(cy / T))) return true;
  for (const s of solids) if (L < s.x + s.w && Rr > s.x && Tp < s.y + s.h && B > s.y) return true;
  return false;
}
function moveEnt(e, dx, dy) {
  let moved = false;
  if (dx && !blocked(e.x + dx, e.y)) { e.x += dx; moved = true; }
  if (dy && !blocked(e.x, e.y + dy)) { e.y += dy; moved = true; }
  return moved;
}

// ---------- input ----------
const keys = new Set();
const padDirs = new Set();
let tapTarget = null;
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
addEventListener('keydown', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  if (document.body.classList.contains('rc')) { if (e.code === 'Escape' && window.RainCats) window.RainCats.close(); return; }
  if (cmIsOpen()) { if (e.code === 'Escape') cmClose(); else if (e.code === 'KeyR') { e.preventDefault(); cmRandomize(); } return; }
  const d = KEYMAP[e.code];
  if (d) { keys.add(d); tapTarget = null; e.preventDefault(); hideToast(); }
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { if (document.activeElement && document.activeElement.tagName === 'A') return; e.preventDefault(); interact(); }
  else if (e.code === 'Escape') { closeDialog(true); closePlaces(); }
  else if (e.code === 'KeyM') togglePlaces();
  else if (e.code === 'KeyR') toggleRain();
  else if (e.code === 'KeyN') toggleSound();
});
addEventListener('keyup', e => { const d = KEYMAP[e.code]; if (d) keys.delete(d); });
addEventListener('blur', () => { keys.clear(); padDirs.clear(); });

const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (isTouch) document.body.classList.add('touch');
document.querySelectorAll('#pad .pb').forEach(b => {
  const d = b.dataset.dir;
  const on = e => { e.preventDefault(); padDirs.add(d); b.classList.add('active'); tapTarget = null; hideToast(); };
  const off = e => { e.preventDefault(); padDirs.delete(d); b.classList.remove('active'); };
  b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  b.addEventListener('contextmenu', e => e.preventDefault());
});
const btnA = document.getElementById('btnA');
btnA.addEventListener('pointerdown', e => { e.preventDefault(); btnA.classList.add('active'); interact(); });
btnA.addEventListener('pointerup', () => btnA.classList.remove('active'));

// ---------- canvas & camera ----------
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let S = 2, VW = 0, VH = 0;
function resize() {
  const w = innerWidth, h = innerHeight;
  S = Math.max(2, Math.round(Math.min(w, h) / 260));
  VW = Math.ceil(w / S); VH = Math.ceil(h / S);
  cv.width = VW; cv.height = VH;
  ctx.imageSmoothingEnabled = false;
  initRain();
}
addEventListener('resize', resize);
const cam = { x: 0, y: 0 };
function updateCam() {
  cam.x = WW <= VW ? (WW - VW) / 2 : Math.max(0, Math.min(WW - VW, player.x - VW / 2));
  cam.y = WH <= VH ? (WH - VH) / 2 : Math.max(0, Math.min(WH - VH, player.y - 10 - VH / 2));
  cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);
}
cv.addEventListener('pointerdown', e => {
  const wx = e.clientX / S + cam.x, wy = e.clientY / S + cam.y;
  // tapped near a landmark? walk to its spot
  let best = null, bd = 30;
  for (const t of targets) { const d = Math.hypot(t.x - wx, t.y - 14 - wy); if (d < bd) { bd = d; best = t; } }
  tapTarget = best ? { x: best.x, y: best.y, stuck: 0 } : { x: wx, y: wy + 2, stuck: 0 };
  hideToast();
});

// ---------- rain particles ----------
let raining = true, drops = [], splashes = [];
function initRain() { const n = Math.round(VW * VH / 900); drops = Array.from({ length: n }, () => ({ x: Math.random() * VW, y: Math.random() * VH, v: 120 + Math.random() * 80, end: Math.random() * VH })); }
function stepRain(dt) {
  for (const d of drops) {
    d.y += d.v * dt; d.x -= d.v * dt * 0.18;
    if (d.y > d.end) { if (splashes.length < 80) splashes.push({ x: d.x, y: d.y, t: 0 }); d.y = -6; d.x = Math.random() * (VW + 40); d.end = 20 + Math.random() * VH; }
  }
  splashes = splashes.filter(s => (s.t += dt) < 0.25);
}
function drawRain() {
  ctx.fillStyle = 'rgba(170,200,255,0.45)';
  for (const d of drops) { ctx.fillRect(d.x | 0, d.y | 0, 1, 3); }
  ctx.fillStyle = 'rgba(190,220,255,0.5)';
  for (const s of splashes) { const k = s.t < 0.12 ? 1 : 2; ctx.fillRect((s.x - k) | 0, s.y | 0, 1, 1); ctx.fillRect((s.x + k) | 0, s.y | 0, 1, 1); }
}
// Rain's personal little cloud drizzle
const myDrops = [];

// ---------- dialog ----------
const $ = id => document.getElementById(id);
const dlg = $('dialog');
let openId = null; const dismissed = new Set();
function drawIcon(kind, col) {
  const ic = $('dlgIcon').getContext('2d'); ic.imageSmoothingEnabled = false; ic.clearRect(0, 0, 16, 16);
  const r = (x, y, w, h, c) => R(ic, x, y, w, h, c);
  switch (kind) {
    case 'tower': for (let y = 3; y < 15; y++) { const h = 1 + ((y - 3) / 2 | 0); r(8 - h, y, 1, 1, '#9aa6cc'); r(7 + h, y, 1, 1, '#9aa6cc'); } r(7, 1, 2, 2, C.mint); ring(ic, 8, 3, 4, C.mint2); r(3, 14, 10, 2, C.mint); break;
    case 'rain': case 'cat': ic.drawImage(catSprite(kind === 'rain' ? RAIN : VILLAGE_PALS[0], 'down', 0), 0, 0); if (kind === 'rain') { r(10, 0, 6, 3, C.ink); r(11, 3, 1, 1, C.sky); r(14, 3, 1, 1, C.sky); } break;
    case 'film': r(1, 3, 14, 10, C.yellow); r(2, 4, 12, 8, '#120d22'); for (let i = 0; i < 4; i++) { r(2 + i * 3, 4, 2, 1, C.yellow); r(2 + i * 3, 11, 2, 1, C.yellow); } r(6, 6, 1, 4, C.ink); r(7, 7, 1, 2, C.ink); r(8, 8, 1, 1, C.ink); break;
    case 'shield': for (let y = 0; y < 15; y++) { const w = y < 8 ? 12 : 12 - (y - 7) * 2; r((16 - w) / 2, 1 + y, w, 1, C.orange); } r(7, 4, 2, 6, '#fff4e0'); r(5, 6, 6, 2, '#fff4e0'); break;
    case 'chart': r(1, 1, 14, 14, '#06070f'); [[2, 12], [4, 10], [6, 11], [8, 7], [10, 8], [12, 4], [13, 3]].forEach(([x, y]) => r(x, y, 2, 1, C.mint)); r(1, 14, 14, 1, C.purple); break;
    case 'bot': r(7, 0, 2, 3, '#c9d3ea'); r(3, 3, 10, 7, '#c9d3ea'); r(4, 4, 8, 5, C.out); r(5, 5, 2, 2, col); r(9, 5, 2, 2, col); r(4, 10, 8, 6, col); break;
    case 'catmaker': ic.drawImage(catSprite(lookFrom(cmWindowCats[Math.floor(Date.now() / 1000) % 8 || 0]), 'down', 0), 0, 0); break;
    case 'icon': if (iconPix) ic.drawImage(iconPix, 0, 0, 16, 16); break;
    case 'feed': r(2, 2, 12, 12, C.ink); for (let i = 0; i < 3; i++) { r(4, 4 + i * 3, 2, 2, C.mint); r(7, 4 + i * 3, 5, 1, '#6c789e'); } break;
    case 'jup': ring(ic, 8, 8, 6, C.mint); ring(ic, 8, 8, 4, C.yellow); ring(ic, 8, 8, 2, C.sky); r(7, 7, 2, 2, C.ink); break;
    case 'gif': r(1, 4, 14, 8, C.pink); text(ic, 'GIF', 2, 6, C.out); break;
    case 'search': ring(ic, 7, 7, 4, C.ink); ring(ic, 7, 7, 3.5, C.ink); r(10, 10, 2, 2, C.ink); r(12, 12, 2, 2, C.ink); r(5, 6, 2, 2, C.mint); break;
    case 'sound': r(2, 6, 3, 4, C.ink); r(5, 4, 2, 8, C.ink); r(7, 2, 2, 12, C.ink); r(11, 5, 1, 6, C.mint); r(13, 3, 1, 10, C.mint2); break;
  }
}
function openDialog(t) {
  openId = t.id; const c = t.card;
  $('dlgTag').textContent = c.tag; $('dlgTitle').textContent = c.title; $('dlgBody').textContent = c.body;
  const media = $('dlgMedia'); media.innerHTML = '';
  if (c.media && c.media.type === 'img') { const im = new Image(); im.src = c.media.src; im.alt = c.media.alt || ''; media.appendChild(im); }
  if (c.media && c.media.type === 'video') { const v = document.createElement('video'); v.src = c.media.src; v.controls = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.muted = !soundOn; v.preload = 'metadata'; media.appendChild(v); }
  const links = $('dlgLinks'); links.innerHTML = '';
  (c.links || []).forEach(l => { if (l.action) { const b = document.createElement('button'); b.className = 'act'; b.textContent = l.label; b.addEventListener('click', () => l.action === 'catmaker' ? cmOpen() : rcOpen(l.action)); links.appendChild(b); return; } const a = document.createElement('a'); a.href = l.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l.label; if (l.alt) a.className = 'alt'; links.appendChild(a); });
  $('dlgCredit').textContent = c.credit || '';
  drawIcon(c.icon[0], c.icon[1]);
  dlg.classList.remove('hidden'); document.body.classList.add('dlg');
  blip(660);
}
function closeDialog(user) {
  if (!openId) return;
  if (user) dismissed.add(openId);
  const v = dlg.querySelector('video'); if (v) v.pause();
  openId = null; dlg.classList.add('hidden'); document.body.classList.remove('dlg');
}
$('dlgClose').addEventListener('click', () => closeDialog(true));
function nearest() {
  let best = null, bd = Infinity;
  for (const t of targets) { const d = Math.hypot(t.x - player.x, t.y - player.y); if (d < t.r && d < bd) { bd = d; best = t; } }
  return best;
}
function interact() {
  const n = nearest();
  if (n) { if (openId === n.id && n.id === 'catmaker') cmOpen(); else if (openId === n.id) closeDialog(true); else { dismissed.delete(n.id); openDialog(n); } }
}
let nearT = null;
function updateProximity() {
  const n = nearest(); nearT = n;
  for (const id of [...dismissed]) { const t = targets.find(x => x.id === id); if (Math.hypot(t.x - player.x, t.y - player.y) > t.r * 1.3) dismissed.delete(id); }
  if (openId) { const t = targets.find(x => x.id === openId); if (Math.hypot(t.x - player.x, t.y - player.y) > t.r * 1.5 || (n && n.id !== openId)) closeDialog(false); }
  if (n && !openId && !dismissed.has(n.id)) openDialog(n);
  const p = $('prompt');
  if (n && !openId) { p.textContent = (isTouch ? 'A' : 'E') + ': ' + n.label; p.classList.remove('hidden'); } else p.classList.add('hidden');
}

// ---------- places (fast travel) ----------
const places = $('places');
function buildPlaces() {
  const list = $('placesList'); list.innerHTML = '';
  targets.filter(t => t.kind !== 'bot').sort((a, b) => (a.kind === 'main' ? 0 : 1) - (b.kind === 'main' ? 0 : 1)).forEach(t => {
    const b = document.createElement('button');
    b.innerHTML = '';
    b.textContent = t.name; const s = document.createElement('small'); s.textContent = t.card.tag; b.appendChild(s);
    b.addEventListener('click', () => { closePlaces(); closeDialog(false); player.x = t.x; player.y = t.y; player.dir = 'up'; tapTarget = null; dismissed.delete(t.id); updateCam(); });
    list.appendChild(b);
  });
}
function togglePlaces() { places.classList.contains('hidden') ? (places.classList.remove('hidden'), hideToast()) : closePlaces(); }
function closePlaces() { places.classList.add('hidden'); }
$('btnPlaces').addEventListener('click', togglePlaces); $('placesClose').addEventListener('click', closePlaces);

// ---------- toggles ----------
function toggleRain() { raining = !raining; $('btnRain').classList.toggle('off', !raining); }
$('btnRain').addEventListener('click', toggleRain);

// ---------- gentle chiptune (muted by default) ----------
let soundOn = false, actx = null, master = null, nextNote = 0, step = 0, timer = null;
const BPM = 84, STEP = 60 / BPM / 2;
const MEL = [69, 72, 76, 79, 76, 72, 74, 76, 72, 69, 67, 69, 72, 74, 72, 0];
const BASS = [45, 45, 41, 41, 43, 43, 40, 40];
const hz = n => 440 * Math.pow(2, (n - 69) / 12);
function note(f, t, d, type, vol) {
  const o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function schedule() {
  while (nextNote < actx.currentTime + 0.2) {
    const m = MEL[step % 16]; if (m && (step % 32 < 16 || step % 2 === 0)) note(hz(m), nextNote, STEP * 0.9, 'square', 0.035);
    if (step % 4 === 0) note(hz(BASS[(step / 4 | 0) % 8]), nextNote, STEP * 3.5, 'triangle', 0.08);
    if (step % 8 === 4) note(hz(MEL[(step * 3) % 16] + 12 || 81), nextNote, STEP * 0.5, 'square', 0.015);
    nextNote += STEP; step++;
  }
}
function toggleSound() {
  soundOn = !soundOn; $('btnSound').classList.toggle('on', soundOn);
  if (soundOn) {
    if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; actx = new AC(); master = actx.createGain(); master.gain.value = 0.7; master.connect(actx.destination); }
    actx.resume(); nextNote = actx.currentTime + 0.05; timer = setInterval(schedule, 60);
  } else { clearInterval(timer); if (actx) actx.suspend(); }
  const v = dlg.querySelector('video'); if (v) v.muted = !soundOn;
}
$('btnSound').addEventListener('click', toggleSound);
function blip(f) { if (!soundOn || !actx) return; note(f, actx.currentTime, 0.08, 'square', 0.03); note(f * 1.5, actx.currentTime + 0.06, 0.08, 'square', 0.025); }

// ---------- toast ----------
const toast = $('toast');
function showToast(msg, ms) { toast.textContent = msg; toast.classList.remove('hidden'); clearTimeout(showToast.t); showToast.t = setTimeout(hideToast, ms); }
function hideToast() { toast.classList.add('hidden'); }

// ---------- update ----------
let last = performance.now(), time = 0;
function update(dt) {
  time += dt;
  let dx = 0, dy = 0;
  const dirs = new Set([...keys, ...padDirs]);
  if (dirs.has('left')) dx -= 1; if (dirs.has('right')) dx += 1; if (dirs.has('up')) dy -= 1; if (dirs.has('down')) dy += 1;
  if (!dx && !dy && tapTarget) {
    const ex = tapTarget.x - player.x, ey = tapTarget.y - player.y, d = Math.hypot(ex, ey);
    if (d < 2) tapTarget = null; else { dx = ex / d; dy = ey / d; }
  }
  const len = Math.hypot(dx, dy);
  player.moving = len > 0;
  if (player.moving) {
    dx /= len; dy /= len;
    const moved = moveEnt(player, dx * SPEED * dt, dy * SPEED * dt);
    if (tapTarget && !moved && ++tapTarget.stuck > 12) tapTarget = null;
    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left'; else player.dir = dy > 0 ? 'down' : 'up';
    player.ft += dt; if (player.ft > 0.14) { player.ft = 0; player.frame ^= 1; }
  } else player.frame = 0;

  for (const n of npcs) {
    if (n.wait > 0) { n.wait -= dt; n.frame = 0; }
    else {
      if (!n.tx) { const [x0, y0, x1, y1] = n.bounds; n.tx = x0 + Math.random() * (x1 - x0); n.ty = y0 + Math.random() * (y1 - y0); n.stuck = 0; }
      const ex = n.tx - n.x, ey = n.ty - n.y, d = Math.hypot(ex, ey);
      if (d < 2 || n.stuck > 20) { n.tx = 0; n.wait = 1.5 + Math.random() * 3.5; }
      else {
        const sp = 20 * dt, mx = ex / d * sp, my = ey / d * sp;
        if (!moveEnt(n, mx, my)) n.stuck++;
        n.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
        n.ft += dt; if (n.ft > 0.2) { n.ft = 0; n.frame ^= 1; }
      }
    }
    const pd = Math.hypot(n.x - player.x, n.y - player.y);
    if (pd < 22 && n.meow <= 0) { n.meow = 1.6; n.dir = player.x > n.x ? 'right' : 'left'; n.wait = Math.max(n.wait, 1.2); n.tx = 0; }
    if (n.meow > -3) n.meow -= dt;
  }
  // personal cloud drizzle
  if (Math.random() < dt * 10) myDrops.push({ x: player.x - 5 + Math.random() * 10, y: player.y - 22, t: 0 });
  for (const d of myDrops) { d.t += dt; d.y += 40 * dt; }
  while (myDrops.length && myDrops[0].t > 0.35) myDrops.shift();

  if (raining) stepRain(dt);
  updateCam();
  updateProximity();
}

// ---------- render ----------
function drawCloud(g, x, y, a = '#f3f6ff', b = '#c9d3ea', c = '#b4c1e2') {
  R(g, x - 6, y - 2, 12, 4, a); R(g, x - 4, y - 4, 5, 2, a); R(g, x + 1, y - 5, 4, 3, a);
  R(g, x - 7, y - 1, 1, 2, b); R(g, x + 6, y - 1, 1, 2, b); R(g, x - 6, y + 2, 12, 1, c);
}
function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  R(ctx, 0, 0, VW, VH, C.void);
  ctx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
  ctx.drawImage(ground, 0, 0);
  // twinkling void stars & mint water shimmer
  const tw = Math.floor(time * 2);
  for (let i = 0; i < 40; i++) { const x = (i * 97 + tw * 13) % WW, y = (i * 53) % 30; if ((i + tw) % 3 === 0) R(ctx, x, y, 1, 1, '#9fb0ff'); }

  const ents = props.slice();
  for (const n of npcs) ents.push({ y: n.y, draw: g => {
    R(g, n.x - 5, n.y - 1, 10, 2, 'rgba(0,0,0,0.35)');
    g.drawImage(catSprite(n.pal, n.dir, n.frame), Math.round(n.x - 8), Math.round(n.y - 15));
    if (n.pal.acc && n.pal.acc !== 'none') drawAcc(g, n.pal.acc, Math.round(n.x - 8), Math.round(n.y - 15) - (n.frame ? 1 : 0), time);
    if (n.meow > 0) { const s = n.label || 'MEOW', w = textW(s) + 6, by = Math.round(n.y - (n.pal.acc && n.pal.acc !== 'none' ? 38 : 28)); box(g, Math.round(n.x - w / 2), by, w, 9, C.ink); text(g, s, Math.round(n.x - w / 2 + 3), by + 2, C.out); }
  } });
  ents.push({ y: player.y, draw: g => {
    const px = Math.round(player.x), py = Math.round(player.y);
    R(g, px - 6, py - 1, 12, 2, 'rgba(0,0,0,0.4)');
    const look = meLook || RAIN, acc = meLook ? meLook.acc : 'rain';
    g.drawImage(catSprite(look, player.dir, player.frame), px - 8, py - 15);
    if (acc === 'rain') { g.fillStyle = '#9cc4ff'; for (const d of myDrops) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 2); }
    const floaty = acc === 'rain' || acc === 'snow' || acc === 'storm' || acc === 'sun' || acc === 'star';
    drawAcc(g, acc, px - 8 + (floaty && Math.sin(time * 2) > 0 ? 1 : 0), py - 15 + (floaty ? Math.round(Math.sin(time * 2.4)) : (player.frame ? -1 : 0)), time, true);
  } });
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) e.draw(ctx, time);
  for (const o of overhead) o(ctx, time);

  // name tags & "!" markers
  let closestBot = null, cbd = 50;
  for (const t of targets) if (t.kind === 'bot') { const d = Math.hypot(t.x - player.x, t.y - player.y); if (d < cbd) { cbd = d; closestBot = t; } }
  for (const t of targets) {
    const near = nearT && nearT.id === t.id;
    if (t.kind === 'bot') {
      if (t === closestBot) { const w = textW(t.name) + 6; box(ctx, Math.round(t.x - w / 2), t.y - 54, w, 9, '#0d1124', t.col); text(ctx, t.name, Math.round(t.x - w / 2 + 3), t.y - 52, t.col); }
    } else if (t.kind === 'main' && !near) {
      const b = Math.round(Math.sin(time * 4 + t.x) * 1.5);
      const mx = Math.round(t.x), my = t.y - (t.mdy || 30) + b;
      if (Math.hypot(t.x - player.x, t.y - player.y) < 160) { box(ctx, mx - 3, my - 9, 7, 9, C.mint); R(ctx, mx, my - 7, 1, 4, C.out); R(ctx, mx, my - 2, 1, 1, C.out); }
    }
  }

  // day / night
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const cyc = (Math.sin(time / 240 * Math.PI * 2 - Math.PI / 2) + 1) / 2; // 0 dusk -> 1 night
  const dark = 0.12 + cyc * 0.38;
  ctx.fillStyle = `rgba(6,8,30,${dark})`; ctx.fillRect(0, 0, VW, VH);
  ctx.globalCompositeOperation = 'lighter';
  ctx.setTransform(1, 0, 0, 1, -cam.x, -cam.y);
  for (const l of lights) {
    if (l.x < cam.x - 80 || l.x > cam.x + VW + 80 || l.y < cam.y - 80 || l.y > cam.y + VH + 80) continue;
    let a = l.a * (0.5 + cyc);
    if (l.pulse) a *= 0.6 + 0.4 * Math.sin(time * 3);
    if (l.flick && Math.sin(time * 5 + l.x) < -0.97) a *= 0.3;
    glow(ctx, l.x, l.y, l.r, l.col, a * 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (raining) drawRain();
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  update(dt); render();
  requestAnimationFrame(loop);
}

// ======================================================================
// ---------- CAT MAKER ----------
// ======================================================================
const RAINBOW = ['#ff5a6e', '#f6a04d', '#ffd66b', '#7ad97a', '#6bc6ff', '#b78bff'];
const CM = {
  fur: [
    { n: 'Rain blue-gray', c: '#8ea6d6', m: '#5f77a8', t: 0 }, { n: 'Ginger', c: '#f0a050', m: '#c06a28', t: 0 },
    { n: 'Black', c: '#2e3150', m: '#1b1d33', o: '#04050a', dark: 1, t: 0 }, { n: 'White', c: '#e6e9f3', m: '#b9bfd3', t: 0 },
    { n: 'Cream', c: '#f3dcb0', m: '#d2ad74', t: 0 }, { n: 'Smoke gray', c: '#9aa0b3', m: '#6c7286', t: 0 },
    { n: 'Calico', c: '#f3e6d3', m: '#e08a3c', calico: 1, t: 1 }, { n: 'Lilac', c: '#b9a2e0', m: '#8c71c2', t: 1 },
    { n: 'Mint', c: '#7fe8c4', m: '#3fb98f', t: 2 }, { n: 'Pink', c: '#ff9ec0', m: '#e06c96', t: 2 },
    { n: 'Gold', c: '#f2c94c', m: '#c99a1e', t: 3 }, { n: 'Galaxy', c: '#3a2a6e', m: '#5b3bb0', o: '#06040f', galaxy: 1, dark: 1, t: 3 }],
  belly: [
    { n: 'Cloud white', c: '#dfe8fb', t: 0 }, { n: 'Cream', c: '#fde2c0', t: 0 }, { n: 'Snow', c: '#ffffff', t: 0 },
    { n: 'Peach', c: '#ffc8a8', t: 1 }, { n: 'Lavender', c: '#e2d6ff', t: 1 }, { n: 'Same as fur', c: null, t: 1 },
    { n: 'Mint', c: '#c8fff0', t: 2 }, { n: 'Gold', c: '#ffe9a8', t: 2 }],
  eyes: [
    { n: 'Mint', c: C.mint, t: 0 }, { n: 'Gold', c: '#ffd66b', t: 0 }, { n: 'Sky blue', c: '#6bc6ff', t: 0 }, { n: 'Green', c: '#7ad97a', t: 0 },
    { n: 'Amber', c: '#ffb86b', t: 1 }, { n: 'Pink', c: '#ff8fb1', t: 1 }, { n: 'Violet', c: '#b78bff', t: 2 }, { n: 'Ruby', c: '#ff5a6e', t: 2 },
    { n: 'Odd eyes', c: '#6bc6ff', c2: '#ffd66b', t: 3 }],
  collar: [
    { n: 'Mint', c: C.mint, t: 0 }, { n: 'Pink', c: C.pink, t: 0 }, { n: 'Red', c: '#ff6b6b', t: 0 }, { n: 'Purple', c: C.purple, t: 0 },
    { n: 'Yellow', c: C.yellow, t: 0 }, { n: 'Sky', c: C.sky, t: 0 }, { n: 'Navy', c: '#2a3150', t: 1 }, { n: 'No collar', c: null, t: 1 },
    { n: 'Rainbow', rainbow: 1, c: '#ffd66b', t: 3 }],
  pattern: [
    { n: 'None', id: 'none', t: 0 }, { n: 'Spots', id: 'spots', t: 1 }, { n: 'Tabby stripes', id: 'tabby', t: 0 },
    { n: 'Tuxedo', id: 'tuxedo', t: 1 }, { n: 'Socks', id: 'socks', t: 1 }, { n: 'Eye patch', id: 'patch', t: 2 }],
  ears: [
    { n: 'Classic pink', ear: C.pink, t: 0 }, { n: 'Mint tips', ear: C.mint, tip: C.mint, t: 1 }, { n: 'Black tips', ear: '#2e3150', tip: '#1b1d33', t: 1 },
    { n: 'White tips', ear: '#ffffff', tip: '#ffffff', t: 1 }, { n: 'Lilac tips', ear: '#b78bff', tip: '#b78bff', t: 1 }, { n: 'Gold tips', ear: C.yellow, tip: C.yellow, t: 2 }],
  acc: [
    { n: 'Rain cloud', id: 'rain', t: 1 }, { n: 'Sun', id: 'sun', t: 1 }, { n: 'Lightning cloud', id: 'storm', t: 2 }, { n: 'Snow cloud', id: 'snow', t: 1 },
    { n: 'Star', id: 'star', t: 1 }, { n: 'Crown', id: 'crown', t: 3 }, { n: 'Halo', id: 'halo', t: 2 }, { n: 'Headphones', id: 'phones', t: 1 },
    { n: 'Party hat', id: 'party', t: 1 }, { n: 'Flower', id: 'flower', t: 0 }, { n: 'Nothing', id: 'none', t: 0 }],
  face: [
    { n: 'None', id: 'none', t: 0 }, { n: 'Blush', id: 'blush', t: 0 }, { n: 'Whiskers', id: 'whiskers', t: 0 },
    { n: 'Sleepy eyes', id: 'sleepy', t: 1 }, { n: 'Wink', id: 'wink', t: 1 }, { n: 'Glasses', id: 'glasses', t: 2 }],
  bg: [{ n: 'Dark navy', id: 'navy' }, { n: 'Mint glow', id: 'mint' }, { n: 'Sunset', id: 'sunset' }, { n: 'Galaxy', id: 'galaxy' }, { n: 'Transparent', id: 'clear' }],
  title: ['', '', '', '', 'Sir', 'Lady', 'Captain', 'Professor', 'Little', 'Big', 'DJ', 'Agent', 'Lord', 'Duchess'],
  first: ['Rain', 'Mochi', 'Pixel', 'Biscuit', 'Nimbus', 'Pebble', 'Sprout', 'Waffle', 'Comet', 'Noodle', 'Juniper', 'Tofu', 'Ziggy', 'Bean', 'Echo', 'Mango',
    'Pudding', 'Sable', 'Cosmo', 'Miso', 'Clover', 'Pip', 'Taro', 'Boba', 'Luna', 'Olive', 'Peanut', 'Fig', 'Sushi', 'Nova', 'Maple', 'Gizmo', 'Toast', 'Kiwi', 'Momo', 'Yuzu'],
  last: ['', '', '', 'Paws', 'Whiskers', 'McFluff', 'Moonbeam', 'Purrington', 'Sparks', 'Drizzle', 'von Meow', 'Jr', 'Beans', 'Sprinkles', 'Starlight', 'Thunderpaw', 'Puddles', 'Fuzz']
};
const CM_KEYS = ['fur', 'belly', 'eyes', 'collar', 'pattern', 'ears', 'acc', 'face', 'bg', 'title', 'first', 'last'];
const CM_ROWS = [['fur', 'FUR'], ['belly', 'BELLY'], ['eyes', 'EYES'], ['collar', 'COLLAR'], ['pattern', 'PATTERN'], ['ears', 'EAR TIPS'], ['acc', 'ON TOP'], ['face', 'FACE'], ['bg', 'BACKDROP']];
const RAIN_V = { fur: 0, belly: 0, eyes: 0, collar: 0, pattern: 0, ears: 0, acc: 0, face: 0, bg: 0, title: 0, first: 0, last: 0 };
const cmCode = v => CM_KEYS.map(k => v[k].toString(36)).join('');
function cmParse(s) {
  if (!s || !/^[0-9a-z]{12}$/.test(s)) return null;
  const v = {};
  for (let i = 0; i < 12; i++) { const k = CM_KEYS[i], n = parseInt(s[i], 36); if (n >= CM[k].length) return null; v[k] = n; }
  return v;
}
const cmName = v => [CM.title[v.title], CM.first[v.first], CM.last[v.last]].filter(Boolean).join(' ');
function cmRarity(v) {
  const s = ['fur', 'belly', 'eyes', 'collar', 'pattern', 'ears', 'acc', 'face'].reduce((a, k) => a + CM[k][v[k]].t, 0);
  return s >= 8 ? 'Legendary' : s >= 6 ? 'Epic' : s >= 4 ? 'Rare' : 'Common';
}
function cmPick(k) {
  const list = CM[k];
  if (typeof list[0] !== 'object' || k === 'bg') return Math.floor(Math.random() * list.length);
  const W = [8, 4, 2, 1]; let sum = 0; for (const o of list) sum += W[o.t];
  let r = Math.random() * sum; for (let i = 0; i < list.length; i++) { r -= W[list[i].t]; if (r <= 0) return i; }
  return 0;
}
const lookCache = new Map();
function lookFrom(v) {
  const code = cmCode(v);
  if (lookCache.has(code)) return lookCache.get(code);
  const fur = CM.fur[v.fur], b = CM.belly[v.belly], e = CM.eyes[v.eyes], co = CM.collar[v.collar], ea = CM.ears[v.ears];
  const look = { name: 'cm' + code, code, f: fur.c, o: fur.o, l: b.c || fur.c, e: e.c, e2: e.c2, c: co.c || fur.c, rainbow: co.rainbow,
    ear: ea.ear, earTip: ea.tip, mark: fur.m, galaxy: fur.galaxy, calico: fur.calico, dark: fur.dark,
    pattern: CM.pattern[v.pattern].id, face: CM.face[v.face].id, acc: CM.acc[v.acc].id };
  lookCache.set(code, look);
  return look;
}

// ---- Rain Cats NFT super rares (1/1s) and DNA helpers ----
// DNA is either a 12-char Cat Maker code or 'sr-<id>' for a hand-designed super rare.
const SR = [
  { id: 'og', n: 'Rain (OG)', name: 'Rain', bg: 'og', look: { f: '#8ea6d6', l: '#dfe8fb', e: C.mint, c: C.mint, acc: 'rain', face: 'none', pattern: 'none' },
    t: { Fur: 'Rain blue-gray (OG)', Belly: 'Cloud white', Eyes: 'Mint', Collar: 'Mint', Pattern: 'None', 'Ear Tips': 'Classic pink', 'On Top': 'Rain cloud', Face: 'None', Backdrop: 'Origin' } },
  { id: 'golden', n: 'Golden Rain', name: 'Golden Rain', bg: 'gold', look: { f: '#f2c94c', o: '#5a3a00', l: '#fff3b0', e: C.mint, c: '#ffffff', ear: '#fff3b0', earTip: '#fff3b0', sparkle: '#ffffff', acc: 'halo', face: 'blush', pattern: 'none' },
    t: { Fur: 'Solid gold', Belly: 'Gold', Eyes: 'Mint', Collar: 'Pearl', Pattern: 'Sparkles', 'Ear Tips': 'Gold tips', 'On Top': 'Halo', Face: 'Blush', Backdrop: 'Golden rays' } },
  { id: 'cosmic', n: 'Cosmic King', name: 'Cosmo the Infinite', bg: 'galaxy', look: { f: '#3a2a6e', o: '#06040f', l: '#5b3bb0', e: '#6bc6ff', e2: '#ffd66b', c: '#ffd66b', rainbow: 1, galaxy: 1, dark: 1, ear: '#b78bff', earTip: '#b78bff', acc: 'crown', face: 'none', pattern: 'none' },
    t: { Fur: 'Deep galaxy', Belly: 'Nebula', Eyes: 'Odd eyes', Collar: 'Rainbow', Pattern: 'Stars', 'Ear Tips': 'Lilac tips', 'On Top': 'Crown', Face: 'None', Backdrop: 'Galaxy' } },
  { id: 'diamond', n: 'Diamond Cat', name: 'Duchess Diamond', bg: 'ice', look: { f: '#a8ecff', o: '#1d5f86', l: '#e8fbff', e: '#3a7bd5', c: '#ffffff', ear: '#e8fbff', earTip: '#ffffff', sparkle: '#ffffff', acc: 'star', face: 'none', pattern: 'none' },
    t: { Fur: 'Diamond', Belly: 'Crystal', Eyes: 'Sapphire', Collar: 'Pearl', Pattern: 'Sparkles', 'Ear Tips': 'White tips', 'On Top': 'Star', Face: 'None', Backdrop: 'Ice' } },
  { id: 'ghost', n: 'Ghost Cat', name: 'Boo', bg: 'navy', look: { f: 'rgba(225,232,255,0.55)', o: 'rgba(150,170,220,0.85)', l: 'rgba(255,255,255,0.75)', e: '#6bc6ff', c: 'rgba(225,232,255,0.55)', ear: 'rgba(255,170,210,0.6)', acc: 'none', face: 'blush', pattern: 'none' },
    t: { Fur: 'Ghost', Belly: 'Mist', Eyes: 'Sky blue', Collar: 'No collar', Pattern: 'None', 'Ear Tips': 'Faded pink', 'On Top': 'Nothing', Face: 'Blush', Backdrop: 'Dark navy' } },
  { id: 'rainbowstorm', n: 'Rainbow Storm', name: 'Thunderpaw', bg: 'sunset', look: { f: '#ffd66b', rainbowFur: 1, l: '#ffffff', e: '#2a3150', c: '#2a3150', ear: '#ffffff', earTip: '#ffffff', acc: 'storm', face: 'none', pattern: 'none' },
    t: { Fur: 'Rainbow', Belly: 'Snow', Eyes: 'Storm', Collar: 'Navy', Pattern: 'None', 'Ear Tips': 'White tips', 'On Top': 'Lightning cloud', Face: 'None', Backdrop: 'Sunset' } },
  { id: 'neon', n: 'Neon Cat', name: 'DJ Neon', bg: 'galaxy', look: { f: '#1b1d33', o: '#ff5ad1', l: '#2e3150', e: C.mint, c: C.mint, ear: '#ff5ad1', earTip: '#ff5ad1', dark: 1, acc: 'phones', face: 'glasses', pattern: 'none' },
    t: { Fur: 'Neon midnight', Belly: 'Midnight', Eyes: 'Mint', Collar: 'Mint', Pattern: 'Neon outline', 'Ear Tips': 'Neon pink', 'On Top': 'Headphones', Face: 'Glasses', Backdrop: 'Galaxy' } },
  { id: 'lava', n: 'Lava Cat', name: 'Captain Magma', bg: 'sunset', look: { f: '#ff5a3c', o: '#3a0a0a', l: '#ffd66b', mark: '#ffd66b', e: '#ffd66b', c: '#2e1010', ear: '#ffd66b', acc: 'sun', face: 'none', pattern: 'tabby' },
    t: { Fur: 'Lava', Belly: 'Magma', Eyes: 'Gold', Collar: 'Obsidian', Pattern: 'Lava stripes', 'Ear Tips': 'Classic', 'On Top': 'Sun', Face: 'None', Backdrop: 'Sunset' } },
  { id: 'snowqueen', n: 'Snow Queen', name: 'Lady Frost', bg: 'ice', look: { f: '#ffffff', o: '#4a6a9a', l: '#e6f4ff', e: '#6bc6ff', c: '#6bc6ff', ear: '#bfe6ff', earTip: '#bfe6ff', acc: 'snow', face: 'blush', pattern: 'none' },
    t: { Fur: 'Snow', Belly: 'Ice', Eyes: 'Sky blue', Collar: 'Sky', Pattern: 'None', 'Ear Tips': 'Frost tips', 'On Top': 'Snow cloud', Face: 'Blush', Backdrop: 'Ice' } },
];
SR.forEach(r => { r.look.name = 'sr-' + r.id; r.look.code = 'sr-' + r.id; });
function dnaInfo(dna) {
  if (typeof dna === 'object' && dna) return { look: lookFrom(dna), bg: CM.bg[dna.bg].id, v: dna };
  const v = cmParse(dna); if (v) return { look: lookFrom(v), bg: CM.bg[v.bg].id, v };
  const r = typeof dna === 'string' && SR.find(x => 'sr-' + x.id === dna);
  return r ? { look: r.look, bg: r.bg, sr: r } : null;
}
const lookFromDNA = dna => { const i = dnaInfo(dna); return i && i.look; };
const dnaName = dna => { const i = dnaInfo(dna); return !i ? '' : i.sr ? i.sr.name : cmName(i.v); };

// accessories, drawn relative to the 16x16 sprite's top-left (ox, oy)
function drawAcc(g, id, ox, oy, t, noDrops) {
  const cx = ox + 8;
  switch (id) {
    case 'rain': drawCloud(g, cx, oy - 9); if (!noDrops) for (let i = 0; i < 3; i++) R(g, ox + 4 + i * 4, oy - 6 + Math.floor((t * 18 + i * 3) % 7), 1, 2, '#9cc4ff'); break;
    case 'snow': drawCloud(g, cx, oy - 9); for (let i = 0; i < 3; i++) R(g, ox + 4 + i * 4 + (Math.floor(t * 3 + i) % 2), oy - 6 + Math.floor((t * 8 + i * 3) % 7), 1, 1, '#ffffff'); break;
    case 'storm': drawCloud(g, cx, oy - 9, '#8a93ad', '#6c7590', '#5a6380');
      if (Math.floor(t * 3) % 4 !== 3) { R(g, cx, oy - 6, 2, 1, C.yellow); R(g, cx - 1, oy - 5, 2, 1, C.yellow); R(g, cx, oy - 4, 2, 1, C.yellow); R(g, cx - 1, oy - 3, 1, 1, C.yellow); } break;
    case 'sun': { const y = oy - 8, k = Math.floor(t * 2) % 2;
      R(g, cx - 2, y - 2, 5, 5, C.yellow); R(g, cx - 1, y - 3, 3, 1, C.yellow); R(g, cx - 1, y + 3, 3, 1, C.yellow); R(g, cx - 3, y - 1, 1, 3, C.yellow); R(g, cx + 3, y - 1, 1, 3, C.yellow);
      R(g, cx - 1, y - 1, 2, 2, '#fff3b0');
      const rays = k ? [[0, -5], [0, 5], [-5, 0], [5, 0]] : [[-4, -4], [4, -4], [-4, 4], [4, 4]];
      rays.forEach(([dx, dy]) => R(g, cx + dx, y + dy, 1, 1, C.orange)); break; }
    case 'star': { const y = oy - 7;
      [[-3, 0, 0], [-2, 0, 0], [-1, -3, 3], [0, -2, 2], [1, -1, 1], [2, -2, -1], [2, 1, 2], [3, -2, -2], [3, 2, 2]].forEach(([dy, a, b2]) => R(g, cx + a, y + dy, b2 - a + 1, 1, C.yellow));
      R(g, cx, y - 1, 1, 1, '#fff3b0'); if (Math.floor(t * 2) % 3 === 0) { R(g, cx + 5, y - 4, 1, 1, '#ffffff'); R(g, cx - 5, y + 2, 1, 1, '#ffffff'); } break; }
    case 'crown': R(g, ox + 5, oy + 1, 6, 2, C.yellow); R(g, ox + 5, oy - 1, 1, 2, C.yellow); R(g, ox + 7, oy - 2, 2, 3, C.yellow); R(g, ox + 10, oy - 1, 1, 2, C.yellow);
      R(g, ox + 7, oy + 1, 2, 1, C.red); R(g, ox + 5, oy + 2, 6, 1, '#c99a1e'); if (Math.floor(t * 2) % 3 === 0) R(g, ox + 8, oy - 2, 1, 1, '#ffffff'); break;
    case 'halo': R(g, ox + 4, oy - 4, 8, 1, C.yellow); R(g, ox + 3, oy - 3, 1, 1, C.yellow); R(g, ox + 12, oy - 3, 1, 1, C.yellow); R(g, ox + 4, oy - 2, 8, 1, '#fff3b0'); break;
    case 'phones': R(g, ox + 2, oy - 1, 12, 1, '#2a3150'); R(g, ox + 3, oy - 2, 10, 1, '#4a5390'); R(g, ox + 1, oy, 1, 5, '#2a3150'); R(g, ox + 14, oy, 1, 5, '#2a3150');
      box(g, ox - 1, oy + 4, 3, 5, C.pink); box(g, ox + 14, oy + 4, 3, 5, C.pink); break;
    case 'party': [2, 2, 4, 4, 6, 6].forEach((w, r) => R(g, cx - w / 2, oy - 5 + r, w, 1, r % 2 ? C.pink : C.yellow)); R(g, cx - 4, oy + 1, 8, 1, C.mint); R(g, cx - 1, oy - 7, 2, 2, '#ffffff'); break;
    case 'flower': R(g, ox + 12, oy - 1, 1, 1, '#ffffff'); R(g, ox + 11, oy, 1, 1, '#ffffff'); R(g, ox + 13, oy, 1, 1, '#ffffff'); R(g, ox + 12, oy + 1, 1, 1, '#ffffff'); R(g, ox + 12, oy, 1, 1, C.yellow); R(g, ox + 10, oy + 1, 1, 1, '#7ad97a'); break;
  }
}

// backdrop + cat at 32x32 (the "portrait")
function pxCircle(g, cx, cy, r, col) { g.fillStyle = col; for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r) g.fillRect(cx + x, cy + y, 1, 1); }
function renderPortrait(g, v, t) {
  g.clearRect(0, 0, 32, 32);
  const info = dnaInfo(v); if (!info) return;
  const bg = info.bg;
  if (bg === 'og') { R(g, 0, 0, 32, 32, '#0d1020'); [[3, 4], [27, 6], [6, 22], [24, 2], [29, 19], [14, 3]].forEach(([x, y]) => R(g, x, y, 1, 1, '#3a4470')); R(g, 0, 30, 32, 2, '#151a2e');
    g.fillStyle = C.yellow; g.fillRect(0, 0, 32, 1); g.fillRect(0, 31, 32, 1); g.fillRect(0, 0, 1, 32); g.fillRect(31, 0, 1, 32); R(g, 1, 1, 1, 1, '#fff3b0'); R(g, 30, 1, 1, 1, '#fff3b0'); R(g, 1, 30, 1, 1, '#fff3b0'); R(g, 30, 30, 1, 1, '#fff3b0'); }
  if (bg === 'gold') { R(g, 0, 0, 32, 32, '#3a2600'); pxCircle(g, 16, 18, 15, '#5a3c00'); pxCircle(g, 16, 18, 11, '#7a5400'); pxCircle(g, 16, 18, 7, '#9a6c08');
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; R(g, Math.round(16 + Math.cos(a) * 14), Math.round(18 + Math.sin(a) * 14), 1, 1, '#ffd66b'); } }
  if (bg === 'ice') { ['#0e2a44', '#123552', '#164262', '#1b5074', '#215f86', '#2a7099', '#3684ad', '#4a9cc4'].forEach((c, i) => R(g, 0, i * 4, 32, 4, c));
    [[4, 5], [26, 3], [9, 12], [22, 10], [3, 20], [28, 22], [15, 4]].forEach(([x, y]) => { R(g, x, y, 1, 1, '#ffffff'); R(g, x - 1, y, 1, 1, '#bfe6ff'); R(g, x + 1, y, 1, 1, '#bfe6ff'); R(g, x, y - 1, 1, 1, '#bfe6ff'); R(g, x, y + 1, 1, 1, '#bfe6ff'); }); }
  if (bg === 'navy') { R(g, 0, 0, 32, 32, '#0d1020'); [[3, 4], [27, 6], [6, 22], [24, 2], [29, 19], [14, 3]].forEach(([x, y]) => R(g, x, y, 1, 1, '#3a4470')); R(g, 0, 30, 32, 2, '#151a2e'); }
  if (bg === 'mint') { R(g, 0, 0, 32, 32, '#0b1f22'); pxCircle(g, 16, 20, 15, '#0f2b2c'); pxCircle(g, 16, 20, 12, '#13413b'); pxCircle(g, 16, 20, 9, '#17614f'); }
  if (bg === 'sunset') { ['#2b1d4f', '#4a2466', '#7a3070', '#b0436c', '#e0605e', '#f0884f', '#f6a04d', '#ffd66b'].forEach((c, i) => R(g, 0, i * 4, 32, 4, c)); }
  if (bg === 'galaxy') { R(g, 0, 0, 32, 32, '#120a2a'); pxCircle(g, 8, 9, 6, '#24134f'); pxCircle(g, 25, 24, 7, '#2a1656'); pxCircle(g, 24, 8, 3, '#3b1e70');
    [[3, 3], [12, 2], [28, 4], [20, 12], [5, 16], [29, 14], [2, 27], [18, 29], [10, 25]].forEach(([x, y], i) => R(g, x, y, 1, 1, i % 3 === 0 ? C.mint : i % 3 === 1 ? '#ffffff' : C.pink)); }
  const look = info.look, ox = 8, oy = 14;
  if (bg !== 'clear') R(g, ox + 3, oy + 15, 10, 1, 'rgba(0,0,0,0.35)');
  g.drawImage(catSprite(look, 'down', 0), ox, oy);
  drawAcc(g, look.acc, ox, oy, t);
}

// ---- building ----
const CMB = { x: 728, y: 41 * T, w: 144, h: 104 };
const cmWindowCats = Array.from({ length: 8 }, () => { const v = {}; CM_KEYS.forEach(k => v[k] = cmPick(k)); return v; });
(function catMakerBuilding() {
  const [c, x] = mk(CMB.w, CMB.h);
  const W = CMB.w, H = CMB.h;
  // cat-ear roof
  for (let i = 0; i < 26; i++) { const w = Math.round(i * 1.4); R(x, 16 + 18 - w, 8 + i, w * 2 + 1, 1, '#5b3bb0'); R(x, W - 16 - 18 - w - 1, 8 + i, w * 2 + 1, 1, '#5b3bb0'); }
  for (let i = 6; i < 24; i++) { const w = Math.round((i - 6) * 0.8); R(x, 34 - w, 8 + i, w * 2 + 1, 1, C.pink); R(x, W - 35 - w, 8 + i, w * 2 + 1, 1, C.pink); }
  box(x, 4, 32, W - 8, 12, '#6e4cc8'); R(x, 5, 33, W - 10, 2, '#8a6be0');
  // walls
  box(x, 8, 44, W - 16, H - 44, '#3b2f5c'); R(x, 9, 45, W - 18, 3, '#4a3b72');
  for (let i = 0; i < W - 18; i += 6) R(x, 9 + i, H - 6, 3, 5, '#33284f');
  // sign
  box(x, W / 2 - 26, 16, 52, 14, '#0d1124', C.pink);
  text(x, 'CAT MAKER', W / 2 - textW('CAT MAKER') / 2, 21, C.ink);
  // windows
  box(x, 16, 54, 30, 26, '#0b0e1c', C.mint); box(x, W - 46, 54, 30, 26, '#0b0e1c', C.mint);
  // palette dots in right window
  [[C.pink, 6, 8], [C.yellow, 12, 6], [C.mint, 18, 9], [C.sky, 10, 14], [C.purple, 17, 16]].forEach(([col, dx, dy]) => R(x, W - 46 + dx, 54 + dy, 3, 3, col));
  // door with paw
  box(x, W / 2 - 13, H - 34, 26, 34, '#1a1430', C.pink);
  R(x, W / 2 - 3, H - 22, 6, 5, C.pink); R(x, W / 2 - 5, H - 26, 2, 2, C.pink); R(x, W / 2 - 1, H - 28, 2, 2, C.pink); R(x, W / 2 + 3, H - 26, 2, 2, C.pink);
  props.push({ y: CMB.y, draw: (g, t) => {
    g.drawImage(c, CMB.x, CMB.y - H);
    const on = Math.floor(t * 2) % 2;
    R(g, CMB.x + W / 2 - 26, CMB.y - H + 16, 52, 1, on ? C.pink : C.mint); R(g, CMB.x + W / 2 - 26, CMB.y - H + 29, 52, 1, on ? C.mint : C.pink);
    // a different cat in the window every second
    const v = cmWindowCats[(((Math.floor(t / 1.1) % 8) + 8) % 8) || 0];
    g.drawImage(catSprite(lookFrom(v), 'down', 0), CMB.x + 23, CMB.y - H + 61);
    // sparkles from the roof
    for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; R(g, CMB.x + W / 2 - 20 + i * 20 + Math.round(Math.sin(t * 3 + i) * 2), CMB.y - H + 12 - Math.round(k * 14), 1, 1, i === 1 ? C.yellow : C.mint); }
  } });
  solid(CMB.x + 8, CMB.y - 50, W - 16, 48);
  lights.push({ x: CMB.x + W / 2, y: CMB.y - H + 22, r: 40, col: C.pink, a: 0.3 });
  lights.push({ x: CMB.x + 31, y: CMB.y - H + 67, r: 16, col: C.mint, a: 0.3 });
  lights.push({ x: CMB.x + W - 31, y: CMB.y - H + 67, r: 16, col: C.mint, a: 0.3 });
  lights.push({ x: CMB.x + W / 2, y: CMB.y - 12, r: 20, col: C.pink, a: 0.25 });
})();
targets.push({ id: 'catmaker', mdy: 40, x: CMB.x + CMB.w / 2, y: CMB.y + 12, r: 24, name: 'Cat Maker', label: 'Cat Maker', kind: 'main', card: {
  tag: 'WORKSHOP · MAKE A CAT', title: 'Cat Maker', body: 'My cat workshop. Roll a random cat in my exact pixel style, with different fur, eyes, collars, patterns and hats. Lock the traits you love, re-roll the rest, then download it, share the link, or let it loose in the world. New: mint a mystery Rain Cat NFT on Solana, then walk around as it.',
  links: [{ label: 'Open Cat Maker', action: 'catmaker' }, { label: 'Mint a mystery cat \u00b7 0.03 SOL', action: 'mint' }, { label: 'My Rain Cats', action: 'mine' }], icon: ['catmaker'] } });

// ---- panel ----
const cmEl = $('catmaker'), cmPrev = $('cmPreview'), cmPctx = cmPrev.getContext('2d');
cmPctx.imageSmoothingEnabled = false;
let cmV = Object.assign({}, RAIN_V); const cmLocks = new Set(); let cmTimer = null, cmRolling = false;
const cmSwatch = (k, o) => k === 'fur' || k === 'belly' || k === 'eyes' || k === 'collar' ? (o.rainbow ? 'linear-gradient(90deg,#ff5a6e,#ffd66b,#7ad97a,#6bc6ff,#b78bff)' : (o.c || CM.fur[cmV.fur].c)) : k === 'ears' ? o.ear : null;
function cmBuildUI() {
  const box_ = $('cmTraits'); box_.innerHTML = '';
  const rows = CM_ROWS.concat([['name', 'NAME']]);
  rows.forEach(([k, label]) => {
    const row = document.createElement('div'); row.className = 'trait'; row.dataset.k = k;
    row.innerHTML = '<span class="tl"></span><button class="arr" data-d="-1" aria-label="Previous">&#9664;</button><span class="tv"><i></i><b></b></span><button class="arr" data-d="1" aria-label="Next">&#9654;</button><button class="lock" aria-label="Lock">&#128275;</button>';
    row.querySelector('.tl').textContent = label;
    row.querySelectorAll('.arr').forEach(b => b.addEventListener('click', () => {
      const d = +b.dataset.d;
      if (k === 'name') { cmV.title = cmPick('title'); cmV.first = cmPick('first'); cmV.last = cmPick('last'); }
      else cmV[k] = (cmV[k] + d + CM[k].length) % CM[k].length;
      cmRender(); blip(520);
    }));
    row.querySelector('.lock').addEventListener('click', () => { cmLocks.has(k) ? cmLocks.delete(k) : cmLocks.add(k); cmRender(); });
    box_.appendChild(row);
  });
}
function cmRender() {
  renderPortrait(cmPctx, cmV, time);
  $('cmName').textContent = cmName(cmV);
  const rar = cmRarity(cmV), rt = $('cmRarity');
  rt.textContent = rar.toUpperCase(); rt.className = 'rar-' + rar.toLowerCase();
  document.querySelectorAll('#cmTraits .trait').forEach(row => {
    const k = row.dataset.k, locked = cmLocks.has(k);
    row.classList.toggle('locked', locked);
    const lk = row.querySelector('.lock'); lk.innerHTML = locked ? '&#128274;' : '&#128275;'; lk.classList.toggle('on', locked); lk.setAttribute('aria-pressed', locked);
    const o = k === 'name' ? null : CM[k][cmV[k]];
    row.querySelector('.tv b').textContent = k === 'name' ? cmName(cmV) : o.n;
    const sw = o && cmSwatch(k, o), i = row.querySelector('.tv i');
    i.style.display = sw ? 'inline-block' : 'none'; if (sw) i.style.background = sw;
  });
  const me = localStorage.getItem('rainworld.me');
  $('cmBack').classList.toggle('hidden', !me);
  if (!cmEl.classList.contains('hidden')) history.replaceState(null, '', location.pathname + '?cat=' + cmCode(cmV));
}
function cmRandomize() {
  if (cmRolling) return;
  cmRolling = true;
  const stage = $('cmStage'), dice = $('cmDice');
  stage.classList.remove('shake'); dice.classList.remove('roll'); void stage.offsetWidth;
  stage.classList.add('shake'); dice.classList.add('roll');
  let n = 0;
  const roll = () => {
    CM_KEYS.forEach(k => { const base = k === 'title' || k === 'first' || k === 'last' ? 'name' : k; if (!cmLocks.has(base)) cmV[k] = cmPick(k); });
    cmRender(); blip(380 + n * 60);
    if (++n < 7) setTimeout(roll, 65); else cmRolling = false;
  };
  roll();
}
function cmOpen(v) {
  if (v) cmV = Object.assign({}, v);
  closeDialog(false); closePlaces(); keys.clear(); padDirs.clear(); tapTarget = null; hideToast();
  cmEl.classList.remove('hidden'); document.body.classList.add('cm');
  cmRender(); clearInterval(cmTimer); cmTimer = setInterval(() => renderPortrait(cmPctx, cmV, time), 120);
}
function cmClose() {
  if (cmEl.classList.contains('hidden')) return;
  cmEl.classList.add('hidden'); document.body.classList.remove('cm'); clearInterval(cmTimer);
  dismissed.add('catmaker');
  history.replaceState(null, '', location.pathname);
}
const cmIsOpen = () => !cmEl.classList.contains('hidden');
function cmDataURL(v) {
  const [p, px] = mk(32, 32); renderPortrait(px, v, 0.3);
  const [c, x] = mk(1024, 1024); x.imageSmoothingEnabled = false; x.drawImage(p, 0, 0, 1024, 1024);
  return c.toDataURL('image/png');
}
function cmDownload() {
  const url = cmDataURL(cmV);
  const bin = atob(url.split(',')[1]), arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  const blob = new Blob([arr], { type: 'image/png' });
  const fname = cmName(cmV).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + cmCode(cmV) + '.png';
  let file = null; try { file = new File([blob], fname, { type: 'image/png' }); } catch (e) { /* old Safari */ }
  if (isTouch && file && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: cmName(cmV), text: 'My cat from Rain\'s World' }).catch(() => {});
    return;
  }
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = href; a.download = fname; a.rel = 'noopener';
  if (!('download' in a)) a.target = '_blank';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 60000);
  showToast('Saved ' + fname, 2500);
}
function cmCopyLink() {
  const url = location.origin + location.pathname + '?cat=' + cmCode(cmV);
  const done = () => showToast('Link copied! Anyone who opens it sees ' + cmName(cmV) + '.', 2600);
  const fallback = () => { const ta = document.createElement('textarea'); ta.value = url; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); ta.setSelectionRange(0, url.length); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ } ta.remove(); ok ? done() : window.prompt('Copy this link', url); };
  if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(url).then(done, fallback); else fallback();
}
// cats released into the village
function spawnMade(v) {
  const look = lookFromDNA(v); if (!look) return;
  npcs.push({ pal: look, label: dnaName(v), made: true, x: (6 + Math.random() * 12) * T, y: (9 + Math.random() * 6) * T, tx: 0, ty: 0, wait: 0.5, dir: 'down', frame: 0, ft: 0, bounds: [3 * T, 3 * T + 8, 21 * T, 17 * T], meow: 0 });
}
function released() { try { return (JSON.parse(localStorage.getItem('rainworld.cats') || '[]')).filter(c => dnaInfo(c)); } catch (e) { return []; } }
function releaseDNA(code, label) {
  let list = released().filter(c => c !== code); list.push(code); list = list.slice(-6);
  localStorage.setItem('rainworld.cats', JSON.stringify(list));
  for (let i = npcs.length - 1; i >= 0; i--) if (npcs[i].made) npcs.splice(i, 1);
  list.forEach(c => spawnMade(c));
  showToast((label || dnaName(code)) + ' is now roaming the Grok Cats village! Use Places to visit.', 4000);
}
function cmRelease() { cmClose(); releaseDNA(cmCode(cmV)); }
let meLook = null;
function setMe(code) {
  if (code) localStorage.setItem('rainworld.me', code); else localStorage.removeItem('rainworld.me');
  meLook = code ? lookFromDNA(code) : null;
  $('btnMe').classList.toggle('hidden', !meLook);
}
function cmPlayAs() { setMe(cmCode(cmV)); cmClose(); showToast('You are playing as ' + cmName(cmV) + '. Tap RAIN at the top to turn back into Rain.', 4000); }
$('cmClose').addEventListener('click', cmClose);
$('cmRandom').addEventListener('click', cmRandomize);
$('cmDownload').addEventListener('click', cmDownload);
$('cmCopy').addEventListener('click', cmCopyLink);
$('cmRelease').addEventListener('click', cmRelease);
$('cmPlay').addEventListener('click', cmPlayAs);
$('cmMint').addEventListener('click', () => { cmClose(); rcOpen('mint'); });
$('cmBack').addEventListener('click', () => { setMe(null); cmRender(); showToast('Back to Rain!', 1800); });
$('btnMe').addEventListener('click', () => { setMe(null); showToast('Back to Rain!', 1800); });
cmBuildUI();
released().forEach(c => spawnMade(cmParse(c)));
setMe(localStorage.getItem('rainworld.me'));

// Rain Cats mint panel: the Solana bundle is loaded only when someone opens it
let rcLoading = null;
function rcOpen(which) {
  if (window.RainCats) return window.RainCats.open(which);
  showToast('Loading the Rain Cats mint\u2026', 1500);
  if (!rcLoading) rcLoading = new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'raincats/mint.js?v=' + ((window.RAINCATS_CONFIG || {}).version || 1); s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  rcLoading.then(() => { hideToast(); window.RainCats.open(which); }, () => { rcLoading = null; showToast('Could not load the mint. Check your connection and try again.', 3000); });
}

// ---------- boot ----------
resize(); buildPlaces(); updateCam();
const sharedCat = cmParse(new URLSearchParams(location.search).get('cat'));
const mintParam = new URLSearchParams(location.search).get('mint');
if (mintParam !== null) rcOpen(mintParam === 'mine' ? 'mine' : 'mint'); else if (sharedCat) cmOpen(sharedCat); else showToast("Hi, I'm Rain! This is my world, full of the things Christian and I built. Walk up to any place to learn about it." + (isTouch ? ' Use the pad or tap to walk.' : ' Arrows/WASD to walk, E to talk, M for places.'), 7000);
// debug/test hooks (used by the screenshot script)
window.rainWorld = { player, targets, nft: { SR, CM, CM_KEYS, cmName, cmRarity, cmCode, cmParse, dnaInfo, png32: dna => { const [p, px] = mk(32, 32); renderPortrait(px, dna, 0.3); return p.toDataURL('image/png'); } },
  world: { rcOpen, releaseDNA, setMe, lookFromDNA, dnaName, renderPortrait, showToast, blip, closeDialog, closePlaces, keys, padDirs, mk, get time() { return time; } }, catMaker: { open: cmOpen, close: cmClose, randomize: cmRandomize, code: () => cmCode(cmV), rarity: () => cmRarity(cmV), name: () => cmName(cmV), dataURL: () => cmDataURL(cmV), locks: cmLocks }, open: id => { const t = targets.find(x => x.id === id); player.x = t.x; player.y = t.y; dismissed.clear(); }, setTime: t => { time = t; } };
requestAnimationFrame(loop);
})();
