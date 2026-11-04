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
  ctx.fillStyle = col; x = Math.round(x); y = Math.round(y);
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
// Two buildings only: Rooms HQ (west) and the Rain Cats Mint (east), joined by one front walk.
const isVoid = (tx, ty) => tx < 15 || tx > 48 || ty < 6 || ty > 42;
const inR = (tx, ty, x0, y0, x1, y1) => tx >= x0 && tx <= x1 && ty >= y0 && ty <= y1;
const PLAZA = { x: 32, y: 30, r: 3.6 };
function tileKind(tx, ty) {
  if (isVoid(tx, ty)) return 'void';
  if (Math.hypot(tx + 0.5 - PLAZA.x, ty + 0.5 - PLAZA.y) < PLAZA.r) return 'plaza';
  if (inR(tx, ty, 17, 21, 46, 23)) return 'road';      // front walk past both doors
  if (inR(tx, ty, 30, 24, 33, 41)) return 'avenue';    // from the start up to the front walk
  if (inR(tx, ty, 16, 34, 27, 41) || inR(tx, ty, 37, 34, 47, 41)) return 'village'; // flower meadows
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
      if (v && rand() < 0.12) { R(gx, X + 5, Y + 9, 1, 1, C.pink); R(gx, X + 11, Y + 4, 1, 1, C.yellow); }
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
  // lane dashes on the avenue & front walk
  for (let y = 24 * T; y < 42 * T; y += 12) if (Math.abs(y / T - PLAZA.y) > PLAZA.r) R(gx, 32 * T - 1, y, 2, 6, C.lane);
  for (let x = 17 * T; x < 47 * T; x += 12) R(gx, x, 22 * T + 7, 6, 2, C.lane);
  // plaza ring
  ring(gx, PLAZA.x * T, PLAZA.y * T + 8, PLAZA.r * T - 6, C.mint2);
  ring(gx, PLAZA.x * T, PLAZA.y * T + 8, PLAZA.r * T - 9, C.mint3);
})();

// ---------- building sprites ----------
function windowGrid(x, X, Y, cols, rows, w, h, gapx, gapy, col) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { box(x, X + c * (w + gapx), Y + r * (h + gapy), w, h, col); R(x, X + c * (w + gapx) + 1, Y + r * (h + gapy) + 1, 2, 1, '#bfffe9'); }
}

// Rooms HQ: studio + radio tower
const TOWER = { x: 19 * T, y: 21 * T - 4, w: 12 * T, h: 184 };
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

// Rain Cats Mint footprint (the sprite is drawn after the cat tables, further down)
const MINTB = { x: 34 * T, y: 21 * T - 4, w: 160, h: 128 };

function signpost(px, py, label, col) {
  props.push({ y: py, draw: g => {
    R(g, px - 1, py - 14, 3, 14, '#6a5a45');
    const w = Math.max(24, textW(label) + 8);
    box(g, Math.round(px - w / 2), py - 26, w, 13, '#0d1124', col);
    text(g, label, px - textW(label) / 2 + 1, py - 22, col);
  } });
  solid(px - 2, py - 3, 5, 3);
}
// plaza signposts pointing at the two doors
signpost(29 * T + 4, 26 * T + 10, 'ROOMS', C.mint);
signpost(35 * T + 12, 26 * T + 10, 'MINT', C.pink);
lights.push({ x: 29 * T + 4, y: 26 * T - 10, r: 14, col: C.mint, a: 0.22 });
lights.push({ x: 35 * T + 12, y: 26 * T - 10, r: 14, col: C.pink, a: 0.22 });

// lamps & trees
function lamp(px, py) {
  props.push({ y: py, draw: (g, t) => { R(g, px, py - 20, 2, 20, '#5c66a8'); box(g, px - 2, py - 24, 6, 5, '#0d1124', C.mint2); R(g, px - 1, py - 23, 4, 3, Math.sin(t * 5 + px) > -0.97 ? '#c8fff0' : C.mint3); } });
  solid(px - 1, py - 3, 4, 3);
  lights.push({ x: px + 1, y: py - 21, r: 22, col: C.mint, a: 0.28, flick: 1 });
}
for (let y = 25; y <= 41; y += 4) { if (Math.abs(y - PLAZA.y) < 4) continue; lamp(29 * T + 10, y * T + 14); lamp(34 * T + 4, y * T + 14); }
[17, 46].forEach(x => lamp(x * T + 4, 24 * T + 2));

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
// keep trees off the buildings, the plaza, the signposts and the paths between them
const RESERVED = [[18, 6, 31, 24], [33, 10, 45, 24], [27, 24, 37, 34], [16, 24, 18, 26], [45, 24, 47, 26]];
const reserved = (tx, ty) => RESERVED.some(([a, b, c, d]) => inR(tx, ty, a, b, c, d));
for (let i = 0; i < 160; i++) {
  const tx = 15 + (rand() * 34 | 0), ty = 6 + (rand() * 37 | 0);
  const k = tileKind(tx, ty);
  if ((k !== 'ground' && k !== 'village') || reserved(tx, ty)) continue;
  const near = (dx, dy) => { const kk = tileKind(tx + dx, ty + dy); return kk === 'void' || kk === 'road' || kk === 'avenue' || kk === 'plaza'; };
  if (near(0, 1) || near(0, -1) || near(1, 0) || near(-1, 0)) continue;
  if (k === 'village' && rand() < 0.7) continue; // meadows stay open for the cats
  tree(tx * T + 8, ty * T + 14, (rand() * 12) | 0);
}

// ---------- landmark targets ----------
const ROOMS_URL = 'https://www.intherooms.xyz';
targets.push({ id: 'rooms', mdy: 46, x: TOWER.x + TOWER.w / 2, y: TOWER.y + 12, r: 30, name: 'Rooms HQ', label: 'Rooms HQ', kind: 'main', go: ROOMS_URL, card: {
  tag: 'ROOMS HQ · LIVE AUDIO', title: 'Rooms',
  body: 'Clubhouse-style live audio rooms on Solana. Sign in with Phantom, show up as a cat avatar, react, tip speakers in SOL and bring up co-hosts. Rooms check-mark members also get a free Rain Cat.',
  media: { type: 'img', src: 'assets/rooms-icon.png', alt: 'Rooms app icon' },
  links: [{ label: 'Open intherooms.xyz', href: ROOMS_URL }],
  credit: 'Made by Urua Labs', icon: ['tower'] } });

// ---------- roaming cats in the meadows ----------
const MEADOWS = [[16 * T + 8, 34 * T + 8, 27 * T + 8, 41 * T + 8], [37 * T + 8, 34 * T + 8, 47 * T + 8, 41 * T + 8]];
VILLAGE_PALS.forEach((pal, i) => {
  const b = MEADOWS[i % 2];
  npcs.push({ pal, x: b[0] + 16 + (i * 37) % (b[2] - b[0] - 32), y: b[1] + 8 + (i * 23) % (b[3] - b[1] - 16), tx: 0, ty: 0, wait: rand() * 2, dir: 'down', frame: 0, ft: 0, bounds: b, meow: 0 });
});

// ---------- player ----------
const player = { x: 32 * T, y: 26 * T + 4, dir: 'up', frame: 0, ft: 0, moving: false };
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
  if (!picker.classList.contains('hidden')) { if (e.code === 'Escape') closePicker(); return; }
  const d = KEYMAP[e.code];
  if (d) { keys.add(d); tapTarget = null; e.preventDefault(); hideToast(); }
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { if (document.activeElement && document.activeElement.tagName === 'A') return; e.preventDefault(); interact(); }
  else if (e.code === 'Escape') { closeDialog(true); closePlaces(); }
  else if (e.code === 'KeyC') openPicker(true);
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
    case 'mint': { const s = SR[Math.floor(Date.now() / 1500) % SR.length]; ic.drawImage(catSprite(s.look, 'down', 0), 0, 0); break; }
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
  (c.links || []).forEach(l => { if (l.action) { const b = document.createElement('button'); b.className = 'act'; b.textContent = l.label; if (l.cls) b.classList.add(l.cls); b.addEventListener('click', () => l.action === 'pick' ? openPicker(true) : rcOpen(l.action)); links.appendChild(b); return; } const a = document.createElement('a'); a.href = l.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l.label; if (l.alt) a.className = 'alt'; if (l.cls) a.classList.add(l.cls); links.appendChild(a); });
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
  if (!n) return;
  // second press at a door goes inside: Rooms HQ opens intherooms.xyz, the Mint opens the mint panel
  if (openId === n.id && n.go) { window.open(n.go, '_blank', 'noopener'); closeDialog(true); }
  else if (openId === n.id && n.action) rcOpen(n.action);
  else if (openId === n.id) closeDialog(true); else { dismissed.delete(n.id); openDialog(n); }
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
    b.addEventListener('click', () => goTo(t.id));
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
// ---------- CAT TRAITS (Rain Cats DNA) ----------
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

// ---- Rain Cats Mint building ----
const mintWindowCats = SR.map(s => s.look).concat(Array.from({ length: 9 }, () => { const v = {}; CM_KEYS.forEach(k => v[k] = cmPick(k)); return lookFrom(v); }));
(function mintBuilding() {
  const [c, x] = mk(MINTB.w, MINTB.h);
  const W = MINTB.w, H = MINTB.h;
  // cat ears on the roof sign
  [22, W - 22].forEach(ex => { for (let r = 0; r < 13; r++) { const w = 2 + r * 2; R(x, ex - w / 2, r, w, 1, C.pink); if (r > 4) R(x, ex - (r - 4) / 2, r, (r - 4) | 0, 1, '#ffb3c9'); } });
  // body
  box(x, 4, 40, W - 8, H - 40, '#2b2346');
  R(x, 5, 41, W - 10, 4, '#3a2f5e');
  R(x, 5, H - 6, W - 10, 5, '#1f1838');
  // big roof sign
  box(x, 6, 12, W - 12, 26, '#0d1124', C.pink);
  text(x, 'RAIN CATS', W / 2 - textW('RAIN CATS', 2) / 2, 18, C.ink, 2);
  // striped awning
  for (let i = 0; i * 10 < W - 4; i++) { const col = i % 2 ? C.ink : C.pink; R(x, 2 + i * 10, 38, 10, 9, col); R(x, 4 + i * 10, 47, 6, 3, col); }
  R(x, 2, 38, W - 4, 1, C.out);
  // price sign
  box(x, W / 2 - 31, 54, 62, 11, '#0d1124', C.mint);
  text(x, 'MINT 0.04 SOL', W / 2 - textW('MINT 0.04 SOL') / 2, 57, C.mint);
  // display windows
  box(x, 12, 70, 40, 34, '#0b0e1c', C.mint); box(x, W - 52, 70, 40, 34, '#0b0e1c', C.mint);
  R(x, 13, 102, 38, 1, C.mint3); R(x, W - 51, 102, 38, 1, C.mint3);
  // door with a paw
  box(x, W / 2 - 14, H - 38, 28, 38, '#1a1430', C.yellow);
  R(x, W / 2 - 3, H - 24, 6, 5, C.pink); R(x, W / 2 - 5, H - 28, 2, 2, C.pink); R(x, W / 2 - 1, H - 30, 2, 2, C.pink); R(x, W / 2 + 3, H - 28, 2, 2, C.pink);
  props.push({ y: MINTB.y, draw: (g, t) => {
    const X = MINTB.x, Y = MINTB.y - H;
    g.drawImage(c, X, Y);
    const on = Math.floor(t * 2) % 2;
    R(g, X + 6, Y + 12, W - 12, 1, on ? C.pink : C.mint); R(g, X + 6, Y + 37, W - 12, 1, on ? C.mint : C.pink);
    // a different Rain Cat in the left window, a mystery box in the right one
    const n = mintWindowCats.length, look = mintWindowCats[((Math.floor(t / 1.2) % n) + n) % n] || RAIN;
    g.drawImage(catSprite(look, 'down', 0), X + 24, Y + 85);
    drawAcc(g, look.acc, X + 24, Y + 85, t);
    const by = Y + 84 + (Math.sin(t * 3) > 0 ? 0 : 1), bx = X + W - 40;
    R(g, bx, by + 4, 16, 11, '#04050a'); R(g, bx + 1, by + 5, 14, 9, '#b78bff'); R(g, bx - 1, by, 18, 5, '#04050a'); R(g, bx, by + 1, 16, 3, C.pink);
    R(g, bx + 7, by, 2, 15, C.yellow); R(g, bx + 1, by + 8, 14, 2, C.yellow);
    if (on) { R(g, bx + 3, by + 6, 1, 1, '#ffffff'); R(g, bx + 12, by + 11, 1, 1, '#ffffff'); }
    for (let i = 0; i < 4; i++) { const k = (t * 0.7 + i / 4) % 1; R(g, X + 24 + i * 36 + Math.round(Math.sin(t * 3 + i) * 2), Y + 10 - Math.round(k * 14), 1, 1, i % 2 ? C.yellow : C.mint); }
  } });
  solid(MINTB.x + 4, MINTB.y - 60, W - 8, 58);
  lights.push({ x: MINTB.x + W / 2, y: MINTB.y - H + 24, r: 50, col: C.pink, a: 0.3 });
  lights.push({ x: MINTB.x + 32, y: MINTB.y - H + 88, r: 18, col: C.mint, a: 0.3 });
  lights.push({ x: MINTB.x + W - 32, y: MINTB.y - H + 88, r: 18, col: C.mint, a: 0.3 });
  lights.push({ x: MINTB.x + W / 2, y: MINTB.y - 14, r: 22, col: C.yellow, a: 0.25 });
})();
const VERIFIED_LABEL = 'Verified \u2713? Claim your free cat at intherooms.xyz/mint';
targets.push({ id: 'mint', mdy: 46, x: MINTB.x + MINTB.w / 2, y: MINTB.y + 12, r: 30, name: 'Rain Cats Mint', label: 'Rain Cats Mint', kind: 'main', action: 'mint', card: {
  tag: 'RAIN CATS · SOLANA NFT', title: 'Rain Cats Mint',
  body: '1,000 pixel cats in my exact style, with 9 one-of-one Super Rares. Mint a mystery cat for 0.04 SOL and see it only after you pay. Then connect your wallet and walk around my world as your own cat.',
  links: [{ label: 'Mint a mystery cat \u00b7 0.04 SOL', action: 'mint' }, { label: 'My Rain Cats', action: 'mine', cls: 'alt' }, { label: 'Walk as my cat', action: 'pick', cls: 'alt' },
    { label: VERIFIED_LABEL, href: ROOMS_URL + '/mint', cls: 'verified' }], icon: ['mint'] } });

// cats released into the meadows
function spawnMade(v) {
  const look = lookFromDNA(v); if (!look) return;
  const b = MEADOWS[npcs.filter(n => n.made).length % 2];
  npcs.push({ pal: look, label: dnaName(v), made: true, x: b[0] + 16 + Math.random() * (b[2] - b[0] - 32), y: b[1] + 8 + Math.random() * (b[3] - b[1] - 16), tx: 0, ty: 0, wait: 0.5, dir: 'down', frame: 0, ft: 0, bounds: b, meow: 0 });
}
function released() { try { return (JSON.parse(localStorage.getItem('rainworld.cats') || '[]')).filter(c => dnaInfo(c)); } catch (e) { return []; } }
function releaseDNA(code, label) {
  let list = released().filter(c => c !== code); list.push(code); list = list.slice(-6);
  try { localStorage.setItem('rainworld.cats', JSON.stringify(list)); } catch (e) { /* private mode */ }
  for (let i = npcs.length - 1; i >= 0; i--) if (npcs[i].made) npcs.splice(i, 1);
  list.forEach(c => spawnMade(c));
  showToast((label || dnaName(code)) + ' is now roaming the meadows by the plaza!', 4000);
}

// ======================================================================
// ---------- WALLET: walk as your own Rain Cat ----------
// ======================================================================
let meLook = null;          // the look the player is drawn with (null = Rain)
let myWallet = null;        // connected (or remembered) wallet address
let myCat = null;           // the chosen Rain Cat {asset, dna, name, nickname, number, rarity}
const LS = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};
const catKey = w => 'rainworld.cat.' + w;
const B58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const isMobileUA = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const phantom = () => (window.phantom && window.phantom.solana && window.phantom.solana.isPhantom ? window.phantom.solana : (window.solana && window.solana.isPhantom ? window.solana : null));
const shortAddr = a => a.slice(0, 4) + '\u2026' + a.slice(-4);
const roomsApi = () => String((window.RAINCATS_CONFIG || {}).rooms || ROOMS_URL).replace(/\/$/, '');
const TRAIT_MAP = { fur: 'Fur', belly: 'Belly', eyes: 'Eyes', collar: 'Collar', pattern: 'Pattern', ears: 'Ear Tips', acc: 'On Top', face: 'Face', bg: 'Backdrop' };
function catDNA(c) { // the DNA attribute, or rebuilt from the labelled traits
  if (c.dna && dnaInfo(c.dna)) return c.dna;
  const at = {}; (c.traits || []).forEach(t => at[t.trait] = t.value);
  const v = { title: 0, first: 0, last: 0 };
  for (const [k, label] of Object.entries(TRAIT_MAP)) { const i = CM[k].findIndex(o => o.n === at[label]); if (i < 0) return null; v[k] = i; }
  return cmCode(v);
}
const catLabel = c => (c.nickname ? c.nickname + ' (' + (c.number ? '#' + c.number : c.name) + ')' : c.name || 'your Rain Cat');

// Read-only lookup through Rooms (public chain data, cached briefly)
const ownedCache = new Map();
function roomsInfo(wallet, fresh) {
  const hit = ownedCache.get(wallet);
  if (hit && !fresh && Date.now() - hit.at < 30000) return hit.p;
  const p = fetch(roomsApi() + '/api/raincats/owned?wallet=' + encodeURIComponent(wallet), { headers: { accept: 'application/json' } })
    .then(r => r.json().catch(() => ({})).then(j => { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }))
    .then(j => ({ wallet, verified: !!j.verified, cats: (j.cats || []).map(c => Object.assign({}, c, { dna: catDNA(c) })) }));
  ownedCache.set(wallet, { at: Date.now(), p });
  p.catch(() => { if (ownedCache.get(wallet) && ownedCache.get(wallet).p === p) ownedCache.delete(wallet); });
  return p;
}

function applyLook(cat) {
  myCat = cat || null;
  meLook = cat && cat.dna ? lookFromDNA(cat.dna) : null;
  updateWalletBtn();
}
// Session-only look (old ?cat= links, the mint panel's "Play as" before ownership is known)
function setMe(code) { applyLook(code ? { dna: code, name: dnaName(code) } : null); }
function chooseCat(cat, wallet) {
  wallet = wallet || myWallet;
  if (wallet && wallet !== myWallet) setWallet(wallet, true);
  if (wallet) LS.set(catKey(wallet), cat ? cat.asset : null);
  applyLook(cat);
  showToast(cat ? "You're walking as " + catLabel(cat) + '!' : 'Back to Rain!', cat ? 3500 : 1800);
  if (!picker.classList.contains('hidden')) renderPicker();
}
// On load: only wear the saved cat if this wallet still owns it; otherwise stay Rain.
async function restoreCat(wallet) {
  const asset = LS.get(catKey(wallet)); if (!asset) return;
  try {
    const info = await roomsInfo(wallet, true);
    if (wallet !== myWallet) return;
    if (myCat && !myCat.asset) return; // visiting as a ?cat= link for this session
    const cat = info.cats.find(c => c.asset === asset && c.dna);
    if (cat) applyLook(cat);
    else { LS.set(catKey(wallet), null); if (myCat) applyLook(null); showToast('Your saved Rain Cat is no longer in this wallet, so you are Rain again.', 4000); }
  } catch (e) { /* offline: stay Rain until ownership can be checked */ }
}
function setWallet(w, keepLook) {
  if (w === myWallet) return;
  const prev = myWallet; myWallet = w; LS.set('rainworld.wallet', w);
  // switching wallets drops the old wallet's cat; a session-only look (?cat= link) stays
  if (!keepLook && (prev || (myCat && myCat.asset))) applyLook(null);
  updateWalletBtn();
  if (w && !keepLook) restoreCat(w);
}
async function connectWallet() {
  const p = phantom();
  if (!p) {
    if (isMobileUA) { location.href = 'https://phantom.app/ul/browse/' + encodeURIComponent(location.href.split('#')[0]) + '?ref=' + encodeURIComponent(location.origin); return false; }
    window.open('https://phantom.com/download', '_blank', 'noopener'); pkNote('Install the Phantom extension, then reload this page.'); return false;
  }
  try { const r = await p.connect(); setWallet(String((r && r.publicKey) || p.publicKey)); return true; }
  catch (e) { pkNote('Wallet connection was cancelled.'); return false; }
}
async function disconnectWallet() {
  const p = phantom(); try { if (p) await p.disconnect(); } catch (e) { /* ignore */ }
  myWallet = null; LS.set('rainworld.wallet', null); applyLook(null); renderPicker();
}

// HUD button
const btnWallet = $('btnWallet'), btnWalletCat = $('btnWalletCat').getContext('2d');
btnWalletCat.imageSmoothingEnabled = false;
function updateWalletBtn() {
  const label = !myWallet ? (phantom() || !isMobileUA ? 'CONNECT WALLET' : 'OPEN IN PHANTOM') : myCat && myCat.number ? 'MY CAT #' + myCat.number : shortAddr(myWallet);
  btnWallet.querySelector('span').textContent = label;
  btnWallet.classList.toggle('on', !!myWallet);
  btnWallet.setAttribute('aria-label', myWallet ? 'Choose your cat' : 'Connect wallet');
  btnWalletCat.clearRect(0, 0, 16, 16);
  if (myWallet) btnWalletCat.drawImage(catSprite(meLook || RAIN, 'down', 0), 0, 0);
}
btnWallet.addEventListener('click', () => openPicker(true));

// Picker panel
const picker = $('picker');
function pkNote(msg) { $('pkNote').textContent = msg || ''; }
function closePicker() { picker.classList.add('hidden'); document.body.classList.remove('pk'); }
function openPicker(autoConnect) {
  closeDialog(false); closePlaces(); keys.clear(); padDirs.clear(); tapTarget = null; hideToast();
  picker.classList.remove('hidden'); document.body.classList.add('pk');
  renderPicker();
  if (autoConnect && !myWallet && phantom()) connectWallet().then(ok => ok && renderPicker());
}
function goTo(id) {
  const t = targets.find(x => x.id === id); if (!t) return;
  closeDialog(false); closePlaces(); closePicker();
  player.x = t.x; player.y = t.y; player.dir = 'up'; tapTarget = null; dismissed.delete(t.id); updateCam();
}
let pkSeq = 0;
function renderPicker() {
  const seq = ++pkSeq, list = $('pkList'), acts = $('pkActs');
  list.innerHTML = ''; acts.innerHTML = '';
  $('pkAddr').textContent = myWallet ? 'Wallet: ' + shortAddr(myWallet) : (phantom() || !isMobileUA ? 'Wallet not connected' : 'On iPhone, open Rain\'s World in the Phantom app');
  const cb = $('pkConnect'); cb.textContent = myWallet ? 'Disconnect' : (phantom() || !isMobileUA ? 'Connect Phantom' : 'Open in Phantom');
  if (!myWallet) { pkNote('Connect your Phantom wallet to pick one of your Rain Cats. Your cat becomes the one walking around my world.'); return; }
  pkNote('Looking for your Rain Cats\u2026');
  const wallet = myWallet;
  roomsInfo(wallet, true).then(info => {
    if (seq !== pkSeq) return;
    const cats = info.cats.filter(c => c.dna);
    if (info.verified) { const a = document.createElement('a'); a.className = 'verified'; a.href = ROOMS_URL + '/mint'; a.target = '_blank'; a.rel = 'noopener'; a.textContent = VERIFIED_LABEL; acts.appendChild(a); }
    if (!cats.length) {
      pkNote(info.cats.length ? 'Your Rain Cats are still syncing. Try again in a minute.' : 'No Rain Cats in this wallet yet. Mint a mystery cat at the Rain Cats Mint, then come back and walk as it!');
      const b = document.createElement('button'); b.className = 'go'; b.textContent = 'Go to the Mint building'; b.addEventListener('click', () => goTo('mint')); acts.prepend(b);
      return;
    }
    pkNote('You own ' + cats.length + ' Rain Cat' + (cats.length > 1 ? 's' : '') + '. Pick the one you want to walk around as.');
    cats.forEach(c => {
      const card = document.createElement('div'); card.className = 'rcCard pkCard'; card.dataset.asset = c.asset;
      const pic = document.createElement('canvas'); pic.width = 32; pic.height = 32; renderPortrait(pic.getContext('2d'), c.dna, 0.3);
      if (c.image) { const im = new Image(); im.alt = c.name || 'Rain Cat'; im.decoding = 'async'; im.onerror = () => im.replaceWith(pic); im.src = c.image; card.appendChild(im); } else card.appendChild(pic);
      const nm = document.createElement('div'); nm.className = 'pkName'; nm.textContent = c.name || 'Rain Cat'; card.appendChild(nm);
      if (c.nickname) { const nn = document.createElement('div'); nn.className = 'pkNick'; nn.textContent = c.nickname; card.appendChild(nn); }
      const rr = document.createElement('span'); rr.className = 'pkRar rar-' + String(c.rarity || 'common').toLowerCase().replace(/\s+/g, '-'); rr.textContent = String(c.rarity || '').toUpperCase(); card.appendChild(rr);
      if (c.listed) { const ls = document.createElement('div'); ls.className = 'pkListed'; ls.textContent = 'Listed on Tensor'; card.appendChild(ls); }
      const on = myCat && myCat.asset === c.asset;
      const b = document.createElement('button'); b.textContent = on ? '\u2713 Walking' : 'Walk as this cat'; b.className = on ? 'on' : ''; b.addEventListener('click', () => { chooseCat(c, wallet); closePicker(); });
      card.appendChild(b); list.appendChild(card);
    });
    if (myCat && myCat.asset) { const b = document.createElement('button'); b.className = 'alt'; b.textContent = 'Be Rain again'; b.addEventListener('click', () => chooseCat(null, wallet)); acts.prepend(b); }
  }, e => {
    if (seq !== pkSeq) return;
    pkNote('Could not load your Rain Cats right now. Check your connection and try again.');
    const b = document.createElement('button'); b.textContent = 'Retry'; b.addEventListener('click', renderPicker); acts.appendChild(b);
  });
}
$('pkConnect').addEventListener('click', () => myWallet ? disconnectWallet() : connectWallet().then(ok => ok && renderPicker()));
$('pickerClose').addEventListener('click', closePicker);

(function bootWallet() {
  LS.set('rainworld.me', null); // the old Cat Maker "play as" choice (Cat Maker is gone)
  updateWalletBtn();
  const saved = LS.get('rainworld.wallet');
  const fallback = () => { if (saved && B58.test(saved)) setWallet(saved); };
  const p = phantom();
  if (p) {
    try { if (p.on) p.on('accountChanged', pk => { if (pk && myWallet) setWallet(String(pk)); }); } catch (e) { /* older wallets */ }
    p.connect({ onlyIfTrusted: true }).then(r => setWallet(String((r && r.publicKey) || p.publicKey)), fallback);
  } else fallback();
})();
released().forEach(c => spawnMade(c));

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
const params = new URLSearchParams(location.search);
const sharedCat = cmParse(params.get('cat'));
const mintParam = params.get('mint');
if (sharedCat) { // old Cat Maker share links: you visit as that cat (not saved)
  setMe(cmCode(sharedCat));
  showToast("You're visiting as " + cmName(sharedCat) + '. Connect your wallet to walk as your own Rain Cat.', 6000);
}
if (mintParam !== null) { goTo('mint'); closeDialog(false); rcOpen(mintParam === 'mine' ? 'mine' : 'mint'); }
else if (!sharedCat) showToast("Hi, I'm Rain! Visit Rooms HQ or the Rain Cats Mint, or connect your wallet to walk as your own Rain Cat." + (isTouch ? ' Use the pad or tap to walk.' : ' Arrows/WASD to walk, E to talk, M for places.'), 7000);
// debug/test hooks (used by the screenshot script)
window.rainWorld = { player, targets, nft: { SR, CM, CM_KEYS, cmName, cmRarity, cmCode, cmParse, dnaInfo, png32: dna => { const [p, px] = mk(32, 32); renderPortrait(px, dna, 0.3); return p.toDataURL('image/png'); } },
  world: { rcOpen, releaseDNA, setMe, chooseCat, setWallet, roomsInfo, openPicker, closePicker, goTo, lookFromDNA, dnaName, renderPortrait, showToast, blip, closeDialog, closePlaces, keys, padDirs, mk, get time() { return time; }, get wallet() { return myWallet; }, get cat() { return myCat; }, get look() { return meLook; } },
  open: id => { const t = targets.find(x => x.id === id); player.x = t.x; player.y = t.y; dismissed.clear(); }, setTime: t => { time = t; } };
requestAnimationFrame(loop);
})();
