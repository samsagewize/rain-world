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
function catSprite(pal, dir, frame) {
  const key = pal.name + dir + frame;
  if (catCache.has(key)) return catCache.get(key);
  const d = dir === 'left' || dir === 'right' ? 'side' : dir;
  const rows = catRows(d);
  const [c, x] = mk(16, 16);
  const map = { o: pal.o || C.out, f: pal.f, l: pal.l, e: pal.e, k: C.out, n: C.pink, p: C.pink, c: pal.c };
  const off = frame ? 1 : 0;
  for (let y = 0; y < 16; y++) for (let i = 0; i < 16; i++) {
    let ch = rows[y][i];
    if (frame && y === 14) ch = (i === 5 || i === 10) ? 'f' : ch; // stride
    if (ch !== '.' && map[ch]) { x.fillStyle = map[ch]; x.fillRect(dir === 'left' ? 15 - i : i, y - (y < 14 ? off : 0), 1, 1); }
  }
  if (pal.spots) { x.fillStyle = pal.spots; x.fillRect(4, 4 - off, 2, 2); x.fillRect(10, 11 - off, 2, 2); }
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
const RESERVED = [[25, 4, 38, 17], [38, 12, 45, 18], [5, 31, 17, 40], [45, 15, 61, 29], [27, 39, 37, 46], [26, 17, 38, 28]];
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
  (c.links || []).forEach(l => { const a = document.createElement('a'); a.href = l.href; a.target = '_blank'; a.rel = 'noopener'; a.textContent = l.label; if (l.alt) a.className = 'alt'; links.appendChild(a); });
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
  if (n) { if (openId === n.id) closeDialog(true); else { dismissed.delete(n.id); openDialog(n); } }
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
  targets.filter(t => t.kind !== 'bot').forEach(t => {
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
function drawCloud(g, x, y) {
  R(g, x - 6, y - 2, 12, 4, '#f3f6ff'); R(g, x - 4, y - 4, 5, 2, '#f3f6ff'); R(g, x + 1, y - 5, 4, 3, '#f3f6ff');
  R(g, x - 7, y - 1, 1, 2, '#c9d3ea'); R(g, x + 6, y - 1, 1, 2, '#c9d3ea'); R(g, x - 6, y + 2, 12, 1, '#b4c1e2');
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
    if (n.meow > 0) { const w = textW('MEOW') + 6; box(g, Math.round(n.x - w / 2), Math.round(n.y - 28), w, 9, C.ink); text(g, 'MEOW', Math.round(n.x - w / 2 + 3), Math.round(n.y - 26), C.out); }
  } });
  ents.push({ y: player.y, draw: g => {
    const px = Math.round(player.x), py = Math.round(player.y);
    R(g, px - 6, py - 1, 12, 2, 'rgba(0,0,0,0.4)');
    g.drawImage(catSprite(RAIN, player.dir, player.frame), px - 8, py - 15);
    g.fillStyle = '#9cc4ff'; for (const d of myDrops) g.fillRect(Math.round(d.x), Math.round(d.y), 1, 2);
    drawCloud(g, px + (Math.sin(time * 2) > 0 ? 1 : 0), py - 24 + Math.round(Math.sin(time * 2.4)));
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

// ---------- boot ----------
resize(); buildPlaces(); updateCam();
showToast("Hi, I'm Rain! This is my world, full of the things Christian and I built. Walk up to any place to learn about it." + (isTouch ? ' Use the pad or tap to walk.' : ' Arrows/WASD to walk, E to talk, M for places.'), 7000);
// debug/test hooks (used by the screenshot script)
window.rainWorld = { player, targets, open: id => { const t = targets.find(x => x.id === id); player.x = t.x; player.y = t.y; dismissed.clear(); }, setTime: t => { time = t; } };
requestAnimationFrame(loop);
})();
