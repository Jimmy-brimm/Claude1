'use strict';
/* Polyweb – a small isometric turn-based strategy game. No dependencies. */

/* ---------- data ---------- */
const TW = 64, TH = 32, LH = 8, WOFF = 7; // tile size, land thickness, how far water sits below land
const SAVE_KEY = 'polyweb-save-v2';
const MAX_LEVEL = 8, AI_DELAY = 170;

const TRIBES = [
  { name: 'Zephyr',  color: '#4a8cff', tech: 'riding',       unit: 'rider',   about: 'Horse-lords of the open plains' },
  { name: 'Ember',   color: '#e8503a', tech: 'hunting',      unit: 'warrior', about: 'Hunters of the deep woods' },
  { name: 'Verdant', color: '#2fbf63', tech: 'organization', unit: 'warrior', about: 'Patient gatherers and farmers' },
  { name: 'Solis',   color: '#f0b429', tech: 'fishing',      unit: 'warrior', about: 'Fisherfolk of the sunny coast' },
  { name: 'Granite', color: '#a070ff', tech: 'climbing',     unit: 'warrior', about: 'Mountain clans who mine the peaks' },
  { name: 'Frost',   color: '#40d0dc', tech: 'archery',      unit: 'archer',  about: 'Sharp-eyed archers of the tundra' },
];

const UNITS = {
  warrior:   { name: 'Warrior',   icon: '⚔️', cost: 2, atk: 2,   def: 2, hp: 10, mv: 1, range: 1, tech: null },
  rider:     { name: 'Rider',     icon: '🐎', cost: 3, atk: 2,   def: 1, hp: 10, mv: 2, range: 1, tech: 'riding' },
  archer:    { name: 'Archer',    icon: '🏹', cost: 3, atk: 2,   def: 1, hp: 10, mv: 1, range: 2, tech: 'archery' },
  defender:  { name: 'Defender',  icon: '🛡️', cost: 3, atk: 1,   def: 3, hp: 15, mv: 1, range: 1, tech: 'shields' },
  swordsman: { name: 'Swordsman', icon: '🗡️', cost: 5, atk: 3,   def: 3, hp: 15, mv: 1, range: 1, tech: 'smithery' },
  knight:    { name: 'Knight',    icon: '🏇', cost: 6, atk: 3.5, def: 1, hp: 15, mv: 3, range: 1, tech: 'chivalry' },
  catapult:  { name: 'Catapult',  icon: '🎯', cost: 6, atk: 4,   def: 0, hp: 10, mv: 1, range: 3, tech: 'mathematics' },
  giant:     { name: 'Giant',     icon: '🗿', cost: 0, atk: 5,   def: 4, hp: 40, mv: 1, range: 1, tech: null, train: false },
};
const BOAT = { name: 'Boat', icon: '⛵', atk: 1, def: 1, mv: 2, range: 2 };
const SHIP = { name: 'Ship', icon: '🚢', atk: 2, def: 2, mv: 3, range: 2 };

const TECHS = {
  riding:       { name: 'Riding',       icon: '🐴', tier: 1, req: null,           desc: 'Train Riders' },
  chivalry:     { name: 'Chivalry',     icon: '🏇', tier: 2, req: 'riding',       desc: 'Train Knights' },
  organization: { name: 'Organization', icon: '📜', tier: 1, req: null,           desc: 'Harvest fruit' },
  shields:      { name: 'Shields',      icon: '🛡️', tier: 2, req: 'organization', desc: 'Train Defenders' },
  farming:      { name: 'Farming',      icon: '🌾', tier: 2, req: 'organization', desc: 'Build farms on crops' },
  climbing:     { name: 'Climbing',     icon: '🧗', tier: 1, req: null,           desc: 'Walk on mountains, +50% defence there' },
  mining:       { name: 'Mining',       icon: '⛏️', tier: 2, req: 'climbing',     desc: 'Build mines on mountains' },
  smithery:     { name: 'Smithery',     icon: '⚒️', tier: 3, req: 'mining',       desc: 'Train Swordsmen' },
  fishing:      { name: 'Fishing',      icon: '🎣', tier: 1, req: null,           desc: 'Catch fish, build ports' },
  sailing:      { name: 'Sailing',      icon: '⛵', tier: 2, req: 'fishing',      desc: 'Units board boats on shallow water' },
  navigation:   { name: 'Navigation',   icon: '🧭', tier: 3, req: 'sailing',      desc: 'Ships cross deep ocean, faster and stronger' },
  hunting:      { name: 'Hunting',      icon: '🦌', tier: 1, req: null,           desc: 'Hunt wild animals' },
  archery:      { name: 'Archery',      icon: '🏹', tier: 2, req: 'hunting',      desc: 'Train Archers, +50% defence in forests' },
  forestry:     { name: 'Forestry',     icon: '🪓', tier: 2, req: 'hunting',      desc: 'Build lumber huts in forests' },
  mathematics:  { name: 'Mathematics',  icon: '📐', tier: 3, req: 'forestry',     desc: 'Train Catapults' },
};

// Tile improvements and harvests, all done from a city's territory.
const WORKS = {
  fruit:  { label: 'Harvest fruit', icon: '🍎', tech: 'organization', cost: 2, pop: 1, on: t => t.res === 'fruit' },
  animal: { label: 'Hunt',          icon: '🦌', tech: 'hunting',      cost: 2, pop: 1, on: t => t.res === 'animal' },
  fish:   { label: 'Fish',          icon: '🐟', tech: 'fishing',      cost: 2, pop: 1, on: t => t.res === 'fish' },
  farm:   { label: 'Farm',          icon: '🌾', tech: 'farming',      cost: 5, pop: 2, on: t => t.res === 'crop' },
  lumber: { label: 'Lumber hut',    icon: '🌲', tech: 'forestry',     cost: 3, pop: 1, on: t => t.res === 'forest' && !t.imp },
  mine:   { label: 'Mine',          icon: '⛏️', tech: 'mining',       cost: 5, pop: 2, on: t => t.t === 'mountain' && !t.imp },
  port:   { label: 'Port',          icon: '⚓', tech: 'fishing',      cost: 5, pop: 1, on: t => t.t === 'water' && !t.imp && !t.res },
};

const DIFF = { easy: { bonus: -1, start: 3 }, normal: { bonus: 0, start: 5 }, hard: { bonus: 1, start: 8 }, crazy: { bonus: 3, start: 12 } };
const SYL = ['ka', 'lo', 'ri', 'mu', 'te', 'sa', 'no', 'vi', 'ra', 'du', 'pe', 'zo', 'an', 'el', 'or', 'qui', 'ba', 'ny', 'ti', 'go', 'ma', 'shi'];
const DIRS = [];
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) DIRS.push([dx, dy]);

/* ---------- state ---------- */
let G = null;                 // game state (JSON-serialisable, saved to localStorage)
let busy = false;             // AI turns in progress
let cam = { x: 0, y: 0, z: 1 }, camGoal = null;
let sel = null, selMoves = [], selTargets = [], hover = null, fx = [], confirmDisband = null;
const anims = new Map(), labels = [];
const $ = id => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d');
let W = 0, H = 0, dpr = 1;

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
const inb = (x, y) => x >= 0 && y >= 0 && x < G.n && y < G.n;
const T = (x, y) => G.tiles[y][x];
const unitAt = (x, y) => G.units.find(u => u.x === x && u.y === y);
const unitById = id => G.units.find(u => u.id === id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rndInt = n => Math.floor(Math.random() * n);
const isWater = tl => tl.t === 'water' || tl.t === 'ocean';
const hasTech = (p, t) => G.players[p].techs.includes(t);
const techAvailable = (p, k) => !hasTech(p, k) && (!TECHS[k].req || hasTech(p, TECHS[k].req));
const unitUnlocked = (p, k) => !UNITS[k].tech || hasTech(p, UNITS[k].tech);
const maxHp = u => UNITS[u.type].hp + (u.vet ? 5 : 0);
const seenByView = (x, y) => G.vis[G.view][y][x] === 2;
const humanCount = () => G.players.filter(p => !p.ai && p.alive).length;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function cityName(rnd) {
  rnd = rnd || Math.random;
  let s = '';
  const k = 2 + Math.floor(rnd() * 2);
  for (let i = 0; i < k; i++) s += SYL[Math.floor(rnd() * SYL.length)];
  return s[0].toUpperCase() + s.slice(1);
}

/* ---------- map generation ---------- */
// cfg: { slots: [{ tribe, ai }], n, mapType, mode, diff, seed }
function newGame(cfg) {
  const { n, seed } = cfg;
  const rnd = mulberry32(seed);
  const np = cfg.slots.length;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const landP = { pangea: 0.7, continents: 0.6, archipelago: 0.47 }[cfg.mapType] || 0.6;

  // cellular-automata landmass
  let g = Array.from({ length: n }, () => Array.from({ length: n }, () => (rnd() < landP ? 1 : 0)));
  for (let it = 0; it < 3; it++) {
    const h = g.map(r => r.slice());
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      let c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx >= 0 && yy >= 0 && xx < n && yy < n) c += g[yy][xx];
      }
      h[y][x] = c >= 5 ? 1 : 0;
    }
    g = h;
  }

  const mid = Math.floor(n / 2);
  const S = shuffle([[2, 2], [n - 3, n - 3], [n - 3, 2], [2, n - 3], [mid, 2], [mid, n - 3]].slice(0, np));
  const protect = Array.from({ length: n }, () => Array(n).fill(false));
  for (const [sx, sy] of S) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    g[sy + dy][sx + dx] = 1; protect[sy + dy][sx + dx] = true;
  }
  // land bridges between capitals (archipelagos rely on boats instead)
  if (cfg.mapType !== 'archipelago') {
    for (let i = 1; i < np; i++) {
      let [x, y] = S[0]; const [bx, by] = S[i];
      while (x !== bx || y !== by) {
        const mx = x !== bx, my = y !== by;
        if (mx && (!my || rnd() < 0.5)) x += Math.sign(bx - x); else y += Math.sign(by - y);
        g[y][x] = 1; protect[y][x] = true;
        if (x + 1 < n && rnd() < 0.5) g[y][x + 1] = 1;
      }
    }
  }

  const tiles = g.map(row => row.map(v => ({ t: v ? 'land' : 'water', res: null, b: null, imp: null, c: 0 })));
  // each tile takes the climate of the nearest homeland, with ragged borders
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let best = 0, bd = Infinity;
    S.forEach(([sx, sy], p) => { const d = Math.hypot(x - sx, y - sy) + (rnd() - 0.5) * 2.4; if (d < bd) { bd = d; best = p; } });
    tiles[y][x].c = cfg.slots[best].tribe;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tl = tiles[y][x];
    if (tl.t !== 'land') continue;
    const r = rnd();
    if (r < 0.12) { if (!protect[y][x]) tl.t = 'mountain'; }
    else if (r < 0.28) tl.res = 'forest';
    else if (r < 0.36) tl.res = 'fruit';
    else if (r < 0.43) tl.res = 'animal';
    else if (r < 0.49) tl.res = 'crop';
  }
  // shallow coast vs deep ocean, fish in the shallows
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tl = tiles[y][x];
    if (tl.t !== 'water') continue;
    const coast = DIRS.some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < n && yy < n && g[yy][xx]; });
    if (!coast) tl.t = 'ocean';
    else if (rnd() < 0.16) tl.res = 'fish';
  }

  const units = []; let nextId = 1;
  S.forEach(([sx, sy], p) => {
    const tribe = TRIBES[cfg.slots[p].tribe];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tl = tiles[sy + dy][sx + dx]; tl.t = 'land'; tl.res = null; }
    tiles[sy][sx].b = { kind: 'city', owner: p, level: 1, pop: 0, capital: true, name: cityName(rnd), workshop: 0, park: 0, wall: false, border: 0 };
    const ring = shuffle(DIRS.slice());
    tiles[sy + ring[0][1]][sx + ring[0][0]].res = 'fruit';
    tiles[sy + ring[1][1]][sx + ring[1][0]].res = 'animal';
    tiles[sy + ring[2][1]][sx + ring[2][0]].res = rnd() < 0.5 ? 'forest' : 'crop';
    const ut = tribe.unit;
    units.push({ id: nextId++, type: ut, owner: p, x: sx + ring[3][0], y: sy + ring[3][1], hp: UNITS[ut].hp, moved: false, attacked: false, kills: 0, vet: false });
  });

  // neutral villages, then ruins
  const cand = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (tiles[y][x].t === 'land') cand.push({ x, y });
  shuffle(cand);
  const placed = S.map(([x, y]) => ({ x, y }));
  let villages = 0, ruins = 0;
  const vTarget = Math.floor(n * n / 14), rTarget = Math.max(2, Math.floor(n * n / 45));
  for (const c of cand) {
    if (villages >= vTarget) break;
    if (placed.some(p => cheb(p, c) < 3)) continue;
    tiles[c.y][c.x].b = { kind: 'village' }; tiles[c.y][c.x].res = null;
    placed.push(c); villages++;
  }
  for (const c of cand) {
    if (ruins >= rTarget) break;
    if (tiles[c.y][c.x].b || placed.some(p => cheb(p, c) < 2)) continue;
    tiles[c.y][c.x].b = { kind: 'ruin' }; tiles[c.y][c.x].res = null;
    placed.push(c); ruins++;
  }

  const diff = DIFF[cfg.diff] ? cfg.diff : 'normal';
  return {
    v: 2, n, seed, mode: cfg.mode, turnLimit: 30, diff, mapType: cfg.mapType,
    tiles, units, nextId, turn: 1, cur: 0, view: 0, over: null, rewards: [],
    players: cfg.slots.map((s, i) => {
      const tr = TRIBES[s.tribe];
      return { name: tr.name, color: tr.color, tribe: s.tribe, ai: !!s.ai, stars: s.ai ? DIFF[diff].start : 5, alive: true, techs: [tr.tech] };
    }),
    vis: cfg.slots.map(() => Array.from({ length: n }, () => Array(n).fill(0))),
  };
}

/* ---------- rules helpers ---------- */
function cityTiles(p) {
  const out = [];
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) {
    const b = T(x, y).b;
    if (b && b.kind === 'city' && (p === undefined || b.owner === p)) out.push({ x, y, b });
  }
  return out;
}
const radiusOf = b => 1 + (b.border || 0);
function cityFor(x, y, p) { // nearest city of p whose territory covers (x,y)
  let best = null, bd = 99;
  for (const c of cityTiles(p)) {
    const d = cheb(c, { x, y });
    if (d <= radiusOf(c.b) && d < bd) { best = c; bd = d; }
  }
  return best;
}
function tileOwner(x, y) {
  let best = -1, bd = 99;
  for (const c of cityTiles()) {
    const d = cheb(c, { x, y });
    if (d <= radiusOf(c.b) && d < bd) { best = c.b.owner; bd = d; }
  }
  return best;
}
function computeOwners() {
  const n = G.n, own = Array.from({ length: n }, () => Array(n).fill(-1)), bd = Array.from({ length: n }, () => Array(n).fill(99));
  for (const c of cityTiles()) {
    const r = radiusOf(c.b);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = c.x + dx, y = c.y + dy;
      if (!inb(x, y)) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      if (d < bd[y][x]) { bd[y][x] = d; own[y][x] = c.b.owner; }
    }
  }
  return own;
}
const income = p => cityTiles(p).reduce((s, c) => s + c.b.level + (c.b.workshop || 0) + (c.b.park || 0), 1);
const popNeeded = b => b.level + 1;
const unitCap = p => cityTiles(p).reduce((s, c) => s + c.b.level + 1, 0);
const unitCount = p => G.units.filter(u => u.owner === p).length;
const techCost = (p, k) => TECHS[k].tier * Math.max(1, cityTiles(p).length) + 4;

function canEnter(p, tl) {
  if (tl.t === 'land') return true;
  if (tl.t === 'mountain') return hasTech(p, 'climbing');
  if (tl.t === 'water') return hasTech(p, 'sailing');
  return hasTech(p, 'navigation');
}
function isCapturable(tl, p) { return !!tl.b && (tl.b.kind !== 'city' || tl.b.owner !== p); }
function stats(u) {
  if (isWater(T(u.x, u.y))) return hasTech(u.owner, 'navigation') ? SHIP : BOAT;
  return UNITS[u.type];
}

function defenseBonus(u) {
  const tl = T(u.x, u.y);
  if (tl.b && tl.b.kind === 'city' && tl.b.owner === u.owner) return tl.b.wall ? 3 : 1.5;
  if (tl.res === 'forest' && hasTech(u.owner, 'archery')) return 1.5;
  if (tl.t === 'mountain' && hasTech(u.owner, 'climbing')) return 1.5;
  return 1;
}
function combatCalc(a, d, dist) {
  const A = stats(a), D = stats(d);
  const af = A.atk * a.hp / maxHp(a);
  const df = D.def * d.hp / maxHp(d) * defenseBonus(d);
  const tot = af + df || 1;
  const dmg = Math.round(af / tot * A.atk * 4.5);
  let counter = 0;
  if (d.hp - dmg > 0 && dist <= D.range && D.def > 0) counter = Math.round(df / tot * D.def * 4.5);
  return { dmg, counter };
}

// Tiles a unit can move to this turn. Boarding/leaving boats, climbing a mountain
// and capturing all end the move.
function reach(u) {
  if (u.moved || u.attacked) return [];
  const startW = isWater(T(u.x, u.y)), mv = stats(u).mv;
  const dist = { [u.x + ',' + u.y]: 0 };
  const q = [{ x: u.x, y: u.y }], out = [];
  while (q.length) {
    const c = q.shift(), d = dist[c.x + ',' + c.y];
    if (d >= mv) continue;
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy, k = x + ',' + y;
      if (!inb(x, y) || k in dist) continue;
      const tl = T(x, y);
      if (unitAt(x, y) || !canEnter(u.owner, tl)) continue;
      dist[k] = d + 1; out.push({ x, y });
      const terminal = isWater(tl) !== startW || tl.t === 'mountain' || isCapturable(tl, u.owner);
      if (!terminal) q.push({ x, y });
    }
  }
  return out;
}
function targetsFor(u, viewOnly) {
  if (u.attacked) return [];
  const r = stats(u).range;
  return G.units.filter(e => e.owner !== u.owner && cheb(u, e) <= r && (!viewOnly || seenByView(e.x, e.y)));
}
function availableWorks(c, p) {
  const out = [], r = radiusOf(c.b);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (!inb(x, y)) continue;
    const owner = cityFor(x, y, p);
    if (!owner || owner.x !== c.x || owner.y !== c.y) continue;
    const tl = T(x, y), un = unitAt(x, y);
    if (un && un.owner !== p) continue;
    for (const k of Object.keys(WORKS)) if (WORKS[k].on(tl) && hasTech(p, WORKS[k].tech)) out.push({ x, y, key: k });
  }
  return out;
}

/* ---------- actions ---------- */
function popFx(x, y, text, color) { fx.push({ x, y, text, color, t0: performance.now() }); }
function sfxAt(kind, x, y) { if (G && seenByView(x, y)) sfx(kind); }
function tellOwner(p, msg) { if (p === G.view) toast(msg); }

function doMove(u, x, y) {
  anims.set(u.id, { x0: u.x, y0: u.y, t0: performance.now() });
  const dwx = wxOf(x, y) - wxOf(u.x, u.y);
  if (dwx) faces.set(u.id, dwx > 0 ? 1 : -1);
  const embark = isWater(T(u.x, u.y)) !== isWater(T(x, y));
  u.x = x; u.y = y; u.moved = true;
  const tl = T(x, y);
  if (embark) burst(x, y, 'splash');
  if (tl.b && tl.b.kind === 'village') {
    tl.b = { kind: 'city', owner: u.owner, level: 1, pop: 0, capital: false, name: cityName(), workshop: 0, park: 0, wall: false, border: 0 };
    u.attacked = true;
    sfxAt('capture', x, y); burst(x, y, 'capture', G.players[u.owner].color);
    tellOwner(u.owner, `${tl.b.name} joined your tribe! 🏙️`);
  } else if (tl.b && tl.b.kind === 'ruin') {
    u.attacked = true;
    ruinReward(u, x, y);
  } else if (tl.b && tl.b.owner !== u.owner) {
    const prev = tl.b.owner;
    tl.b.owner = u.owner; tl.b.pop = 0; tl.b.capital = false;
    u.attacked = true;
    sfxAt('capture', x, y); burst(x, y, 'capture', G.players[u.owner].color);
    toast(`${G.players[u.owner].name} captured ${tl.b.name} from ${G.players[prev].name}!`);
    checkElim();
  } else sfxAt('move', x, y);
  updateVis();
}

function ruinReward(u, x, y) {
  const p = u.owner, pl = G.players[p];
  T(x, y).b = null;
  const kinds = ['stars', 'tech', 'explore', 'unit'];
  let kind = kinds[rndInt(kinds.length)];
  const techs = Object.keys(TECHS).filter(k => techAvailable(p, k) && TECHS[k].tier <= 2);
  const spot = DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find(s => inb(s.x, s.y) && T(s.x, s.y).t === 'land' && !unitAt(s.x, s.y) && !T(s.x, s.y).b);
  if ((kind === 'tech' && !techs.length) || (kind === 'unit' && !spot)) kind = 'stars';
  sfxAt('tech', x, y); burst(x, y, 'level');
  if (kind === 'stars') { pl.stars += 10; popFx(x, y, '+10 ⭐', '#ffe27a'); tellOwner(p, 'The ruins held a hidden treasure: +10 ⭐'); }
  else if (kind === 'tech') { const k = techs[rndInt(techs.length)]; pl.techs.push(k); tellOwner(p, `Ancient scrolls taught you ${TECHS[k].icon} ${TECHS[k].name}!`); }
  else if (kind === 'explore') { reveal(p, x, y, 5); tellOwner(p, 'You found an old map of the surrounding lands.'); }
  else {
    G.units.push({ id: G.nextId++, type: 'swordsman', owner: p, x: spot.x, y: spot.y, hp: UNITS.swordsman.hp + 5, moved: true, attacked: true, kills: 0, vet: true });
    tellOwner(p, 'A veteran swordsman from the ruins joins your army!');
  }
}

function credit(k) {
  k.kills = (k.kills || 0) + 1;
  if (k.kills >= 3 && !k.vet) { k.vet = true; k.hp = maxHp(k); popFx(k.x, k.y, 'Veteran!', '#ffe27a'); }
}
function attack(a, d) {
  const r = combatCalc(a, d, cheb(a, d)), now = performance.now();
  const dwx = wxOf(d.x, d.y) - wxOf(a.x, a.y);
  if (dwx) { faces.set(a.id, dwx > 0 ? 1 : -1); faces.set(d.id, dwx > 0 ? -1 : 1); }
  hitAnims.set(a.id, { kind: 'lunge', dx: d.x - a.x, dy: d.y - a.y, t0: now, dur: 260 });
  hitAnims.set(d.id, { kind: 'shake', t0: now + 110, dur: 340 });
  d.hp -= r.dmg; popFx(d.x, d.y, '-' + r.dmg, '#ff6a5a'); burst(d.x, d.y, 'hit');
  if (r.counter) { a.hp -= r.counter; popFx(a.x, a.y, '-' + r.counter, '#ffb35a'); burst(a.x, a.y, 'hit'); }
  a.attacked = true; a.moved = true;
  sfxAt('attack', d.x, d.y);
  if (d.hp <= 0) {
    burst(d.x, d.y, 'death');
    G.units = G.units.filter(u => u !== d);
    credit(a);
    // melee winners advance into the empty tile, like in the board-game classics
    const tl = T(d.x, d.y);
    if (a.hp > 0 && stats(a).range === 1 && canEnter(a.owner, tl) && !isCapturable(tl, a.owner) && isWater(tl) === isWater(T(a.x, a.y))) {
      anims.set(a.id, { x0: a.x, y0: a.y, t0: performance.now() });
      a.x = d.x; a.y = d.y;
    }
  }
  if (a.hp <= 0) { burst(a.x, a.y, 'death'); G.units = G.units.filter(u => u !== a); if (d.hp > 0) credit(d); }
  updateVis();
}

function canTrain(c, type, p) {
  return unitUnlocked(p, type) && UNITS[type].train !== false && !unitAt(c.x, c.y) &&
    G.players[p].stars >= UNITS[type].cost && unitCount(p) < unitCap(p);
}
function train(c, type, p) {
  if (!canTrain(c, type, p)) return false;
  const def = UNITS[type];
  G.players[p].stars -= def.cost;
  G.units.push({ id: G.nextId++, type, owner: p, x: c.x, y: c.y, hp: def.hp, moved: true, attacked: true, kills: 0, vet: false });
  sfxAt('train', c.x, c.y); burst(c.x, c.y, 'train');
  updateVis();
  return true;
}
function doWork(x, y, key, p) {
  const w = WORKS[key], tl = T(x, y), pl = G.players[p];
  if (!w.on(tl) || !hasTech(p, w.tech) || pl.stars < w.cost) return false;
  const un = unitAt(x, y);
  if (un && un.owner !== p) return false;
  const c = cityFor(x, y, p);
  if (!c) return false;
  pl.stars -= w.cost;
  if (key === 'fruit' || key === 'animal' || key === 'fish') tl.res = null;
  else if (key === 'farm') { tl.res = null; tl.imp = 'farm'; }
  else tl.imp = key;
  popFx(x, y, `+${w.pop} pop`, '#8fe39a');
  sfxAt('work', x, y); burst(x, y, 'work');
  addPop(c, w.pop, p);
  return true;
}
function research(p, k) {
  const pl = G.players[p];
  if (!techAvailable(p, k) || pl.stars < techCost(p, k)) return false;
  pl.stars -= techCost(p, k); pl.techs.push(k);
  return true;
}

/* ---------- city growth ---------- */
function addPop(c, amount, p) {
  const b = c.b;
  b.pop += amount;
  while (b.level < MAX_LEVEL && b.pop >= popNeeded(b)) {
    b.pop -= popNeeded(b); b.level++;
    popFx(c.x, c.y, `Level ${b.level}!`, '#ffe27a');
    sfxAt('level', c.x, c.y); burst(c.x, c.y, 'level');
    if (G.players[p].ai) applyReward(c, aiPickReward(b.level), p);
    else G.rewards.push({ x: c.x, y: c.y, level: b.level, owner: p });
  }
}
function rewardOptions(level) {
  if (level === 2) return [['workshop', '🔨', 'Workshop', '+1 ⭐ every turn'], ['explorer', '🧭', 'Explorer', 'Reveal the lands around the city']];
  if (level === 3) return [['wall', '🧱', 'City wall', 'Units in the city defend at ×3'], ['resources', '💰', 'Resources', '+5 ⭐ right now']];
  if (level === 4) return [['popgrowth', '👥', 'Population growth', '+3 population'], ['border', '🗺️', 'Border growth', 'City borders grow by one ring']];
  return [['park', '🌳', 'Park', '+1 ⭐ every turn'], ['giant', '🗿', 'Super unit', 'A Giant joins you in this city']];
}
function aiPickReward(level) {
  if (level === 2) return 'workshop';
  if (level === 3) return Math.random() < 0.5 ? 'wall' : 'resources';
  if (level === 4) return Math.random() < 0.5 ? 'border' : 'popgrowth';
  return Math.random() < 0.6 ? 'giant' : 'park';
}
function applyReward(c, key, p) {
  const b = c.b, pl = G.players[p];
  if (key === 'workshop') b.workshop = (b.workshop || 0) + 1;
  else if (key === 'park') b.park = (b.park || 0) + 1;
  else if (key === 'explorer') reveal(p, c.x, c.y, 5);
  else if (key === 'wall') b.wall = true;
  else if (key === 'resources') pl.stars += 5;
  else if (key === 'popgrowth') addPop(c, 3, p);
  else if (key === 'border') b.border = Math.min(2, (b.border || 0) + 1);
  else if (key === 'giant') {
    const spots = [{ x: c.x, y: c.y }, ...DIRS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))];
    const s = spots.find(s => inb(s.x, s.y) && T(s.x, s.y).t === 'land' && !unitAt(s.x, s.y));
    if (s) G.units.push({ id: G.nextId++, type: 'giant', owner: p, x: s.x, y: s.y, hp: UNITS.giant.hp, moved: true, attacked: true, kills: 0, vet: false });
    else pl.stars += 10;
  }
  updateVis();
}

/* ---------- victory ---------- */
function checkElim() {
  for (let p = 0; p < G.players.length; p++) {
    const pl = G.players[p];
    if (pl.alive && cityTiles(p).length === 0) {
      pl.alive = false;
      G.units = G.units.filter(u => u.owner !== p);
      toast(`${pl.name} has been eliminated!`);
    }
  }
  const alive = G.players.map((p, i) => i).filter(i => G.players[i].alive);
  if (alive.length === 1) endGame(alive[0], 'domination');
  else if (humanCount() === 0) endGame(alive.sort((a, b) => score(b) - score(a))[0], 'domination');
}
function score(p) {
  const pl = G.players[p];
  if (!pl.alive) return 0;
  let s = 0;
  for (const c of cityTiles(p)) s += 100 * c.b.level + 50 * ((c.b.workshop || 0) + (c.b.park || 0));
  const own = computeOwners();
  for (const row of own) for (const o of row) if (o === p) s += 20;
  s += pl.techs.reduce((a, t) => a + 40 * TECHS[t].tier, 0);
  s += G.units.filter(u => u.owner === p).reduce((a, u) => a + 5 * (UNITS[u.type].cost || 10), 0);
  for (const row of G.vis[p]) for (const v of row) if (v > 0) s += 5;
  return s;
}
function endGame(winner, why) {
  if (G.over) return;
  G.over = { winner, why };
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  const w = G.players[winner];
  const solo = G.players.filter(p => !p.ai).length === 1;
  const youWon = !w.ai;
  $('go-title').textContent = solo ? (youWon ? '🏆 Victory!' : '💀 Defeat') : `🏆 ${w.name} wins!`;
  const lines = G.players.map((p, i) => ({ p, s: score(i) })).sort((a, b) => b.s - a.s)
    .map(({ p, s }) => `<li><span style="color:${p.color}">●</span> ${esc(p.name)}${p.ai ? '' : ' 👤'} <b>${s}</b>${p.alive ? '' : ' <span class="muted">(fallen)</span>'}</li>`).join('');
  const what = why === 'perfection' ? `${G.turnLimit} turns are over. Highest score wins.` :
    (youWon ? `${w.name} rules the world after ${G.turn} turns.` : `${w.name} has conquered the world.`);
  $('go-text').innerHTML = `${esc(what)}<ol class="scores-list">${lines}</ol>`;
  $('gameover').hidden = false;
  sfx(!w.ai ? 'win' : 'lose');
}

/* ---------- fog of war ---------- */
function markVis(V, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (inb(x, y)) V[y][x] = 2;
  }
}
function reveal(p, cx, cy, r) {
  const V = G.vis[p];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (inb(x, y) && V[y][x] === 0) V[y][x] = 1;
  }
}
function updateVis() {
  const cities = cityTiles();
  G.players.forEach((pl, p) => {
    const V = G.vis[p];
    for (const row of V) for (let x = 0; x < row.length; x++) if (row[x] === 2) row[x] = 1;
    if (!pl.alive) return;
    for (const u of G.units) if (u.owner === p) markVis(V, u.x, u.y, T(u.x, u.y).t === 'mountain' ? 3 : 2);
    for (const c of cities) if (c.b.owner === p) markVis(V, c.x, c.y, radiusOf(c.b) + 1);
  });
}

/* ---------- turn flow ---------- */
const canAct = () => G && !busy && !G.over && G.cur === G.view && !G.players[G.cur].ai &&
  $('pass').hidden && $('reward').hidden;

function startTurn(p) {
  const pl = G.players[p];
  pl.stars = Math.max(0, pl.stars + income(p) + (pl.ai ? DIFF[G.diff].bonus : 0));
  for (const u of G.units) if (u.owner === p) { u.moved = false; u.attacked = false; }
  updateVis();
}
function finishTurn(p) { // units that stayed idle recover
  for (const u of G.units) {
    if (u.owner !== p || u.moved || u.attacked) continue;
    const tl = T(u.x, u.y);
    u.hp = Math.min(maxHp(u), u.hp + (tl.b && tl.b.kind === 'city' && tl.b.owner === p ? 4 : 2));
  }
}
function nextPlayer() {
  do {
    G.cur = (G.cur + 1) % G.players.length;
    if (G.cur === 0) {
      G.turn++;
      if (G.mode === 'perfection' && G.turn > G.turnLimit) {
        G.turn = G.turnLimit;
        const ranked = G.players.map((_, i) => i).sort((a, b) => score(b) - score(a));
        endGame(ranked[0], 'perfection');
        return;
      }
    }
  } while (!G.players[G.cur].alive);
}
async function endTurn() {
  if (!canAct()) return;
  select(null);
  finishTurn(G.cur);
  await runTurns(false);
}
async function runTurns(resume) {
  busy = true; ui();
  for (;;) {
    if (!resume) { nextPlayer(); if (G.over) break; startTurn(G.cur); }
    resume = false;
    if (!G.players[G.cur].ai) break;
    ui();
    await aiTurn(G.cur);
    finishTurn(G.cur);
    if (G.over) break;
  }
  busy = false;
  if (!G.over) onHumanTurn();
  refreshSel(); ui();
}
function onHumanTurn() {
  const p = G.cur, hotseat = G.players.filter(pl => !pl.ai && pl.alive).length > 1;
  G.view = p;
  updateVis();
  save();
  if (hotseat) showPass();
  else { focusHome(false); banner(`Turn ${G.turn}`, `+${income(p)} ⭐ this turn`, G.players[p].color); showReward(); }
}

/* ---------- AI ---------- */
async function aiTurn(p) {
  aiResearch(p);
  aiEconomy(p);
  ui();
  for (const u of G.units.filter(x => x.owner === p)) {
    if (!G.units.includes(u) || G.over) continue;
    const wasSeen = seenByView(u.x, u.y);
    const acted = aiUnit(u);
    if (acted && (wasSeen || (G.units.includes(u) && seenByView(u.x, u.y)))) { ui(); await sleep(AI_DELAY); }
  }
  if (!G.over) aiEconomy(p);
}

function aiResearch(p) {
  const pl = G.players[p];
  const avail = Object.keys(TECHS).filter(k => techAvailable(p, k));
  if (!avail.length) return;
  const own = computeOwners();
  const mine = [];
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) if (own[y][x] === p) mine.push(T(x, y));
  const needSea = aiNeedsSea(p);
  let best = null, bs = -Infinity;
  for (const k of avail) {
    let s = Math.random() * 1.5 - techCost(p, k) * 0.12;
    if (Object.values(UNITS).some(u => u.tech === k)) s += 2;
    for (const w of Object.values(WORKS)) if (w.tech === k) s += 0.7 * mine.filter(tl => w.on(tl)).length;
    if (k === 'climbing') s += 0.3 * mine.filter(tl => tl.t === 'mountain').length;
    if (needSea && (k === 'fishing' || k === 'sailing')) s += 4;
    if (needSea && k === 'navigation') s += 1.5;
    if (s > bs) { bs = s; best = k; }
  }
  const cost = techCost(p, best);
  if (pl.stars >= cost && (unitCount(p) >= unitCap(p) - 1 || pl.stars >= cost + 3 || Math.random() < 0.35)) research(p, best);
}
function aiNeedsSea(p) {
  const field = aiGoalField(p);
  let anyGoal = false;
  for (const row of field) for (const v of row) if (v === 0) anyGoal = true;
  if (!anyGoal) return false;
  return !G.units.some(u => u.owner === p && field[u.y][u.x] < Infinity) &&
    !cityTiles(p).some(c => field[c.y][c.x] < Infinity);
}
function aiEconomy(p) {
  const pl = G.players[p];
  const weights = { warrior: 2, rider: 2, archer: 2, defender: 1, swordsman: 3, knight: 3, catapult: 1.5 };
  for (let guard = 0; guard < 30; guard++) {
    let did = false;
    for (const c of cityTiles(p)) {
      const free = !unitAt(c.x, c.y), capOk = unitCount(p) < unitCap(p);
      const works = availableWorks(c, p).filter(w => WORKS[w.key].cost <= pl.stars);
      if (works.length && (!free || !capOk || unitCount(p) >= 2) && Math.random() < 0.65) {
        works.sort((a, b) => WORKS[b.key].pop / WORKS[b.key].cost - WORKS[a.key].pop / WORKS[a.key].cost);
        doWork(works[0].x, works[0].y, works[0].key, p); did = true; continue;
      }
      if (free && capOk) {
        const opts = Object.keys(weights).filter(k => canTrain(c, k, p));
        if (opts.length) {
          const total = opts.reduce((s, k) => s + weights[k], 0);
          let r = Math.random() * total, pick = opts[0];
          for (const k of opts) { r -= weights[k]; if (r <= 0) { pick = k; break; } }
          train(c, pick, p); did = true;
        }
      }
    }
    if (!did) break;
  }
}
function aiPlan(u) {
  const R = stats(u).range;
  const spots = [{ x: u.x, y: u.y }, ...reach(u)];
  let best = null, bs = 0.4;
  for (const s of spots) {
    const here = s.x === u.x && s.y === u.y;
    const tl = T(s.x, s.y);
    if (!here && isCapturable(tl, u.owner)) {
      const sc = tl.b.kind === 'village' ? 7 : tl.b.kind === 'ruin' ? 6 : 12 + 2 * tl.b.level;
      if (sc > bs) { bs = sc; best = { s, target: null }; }
      continue; // capturing ends the unit's action
    }
    if (!here && tl.b && tl.b.kind === 'city' && tl.b.owner === u.owner &&
        G.units.some(e => e.owner !== u.owner && cheb(e, s) <= 2) && bs < 3) { bs = 3; best = { s, target: null }; }
    if (u.attacked) continue;
    for (const e of G.units) {
      if (e.owner === u.owner || cheb(s, e) > R) continue;
      const r = combatCalc(u, e, cheb(s, e));
      const sc = r.dmg + (r.dmg >= e.hp ? 8 : 0) - r.counter * 0.7 - (here ? 0 : 0.2);
      if (sc > bs) { bs = sc; best = { s, target: e }; }
    }
  }
  return best;
}
function aiGoalField(p) {
  const n = G.n, dist = Array.from({ length: n }, () => Array(n).fill(Infinity)), q = [];
  const add = (x, y) => { if (dist[y][x] === Infinity) { dist[y][x] = 0; q.push({ x, y }); } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (isCapturable(T(x, y), p)) add(x, y);
  for (const e of G.units) if (e.owner !== p) add(e.x, e.y);
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (!inb(x, y) || dist[y][x] !== Infinity || !canEnter(p, T(x, y))) continue;
      dist[y][x] = dist[c.y][c.x] + 1; q.push({ x, y });
    }
  }
  return dist;
}
function aiUnit(u) {
  let acted = false;
  const exec = plan => {
    if (plan.s.x !== u.x || plan.s.y !== u.y) doMove(u, plan.s.x, plan.s.y);
    if (plan.target && G.units.includes(plan.target) && G.units.includes(u) && !u.attacked) attack(u, plan.target);
    acted = true;
  };
  let plan = aiPlan(u);
  if (plan) { exec(plan); return acted; }
  if (!u.moved && !u.attacked) {
    const field = aiGoalField(u.owner), opts = reach(u);
    let bestD = field[u.y][u.x], pick = null;
    for (const o of opts) {
      const d = field[o.y][o.x];
      if (d < bestD || (d === bestD && pick && Math.random() < 0.3)) { bestD = d; pick = o; }
    }
    if (pick) {
      doMove(u, pick.x, pick.y); acted = true;
      if (G.units.includes(u) && !u.attacked) { plan = aiPlan(u); if (plan) exec(plan); }
    }
  }
  return acted;
}

/* ---------- persistence ---------- */
function save() {
  if (!G || G.over) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* ignore */ }
}
function loadSave() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    const g = s ? JSON.parse(s) : null;
    return g && g.v === 2 ? g : null;
  } catch (e) { return null; }
}

/* ---------- sound ---------- */
let actx = null, muted = false;
try { muted = localStorage.getItem('polyweb-muted') === '1'; } catch (e) { /* ignore */ }
const NOTES = {
  move: [[440, 0.04]], train: [[330, 0.06], [440, 0.08]], work: [[520, 0.05], [700, 0.07]],
  attack: [[190, 0.07, 'sawtooth'], [120, 0.1, 'sawtooth']], capture: [[523, 0.08], [659, 0.08], [784, 0.14]],
  level: [[659, 0.08], [880, 0.16]], tech: [[392, 0.07], [523, 0.07], [659, 0.13]], click: [[620, 0.03]],
  win: [[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.25]], lose: [[330, 0.2, 'triangle'], [220, 0.35, 'triangle']],
};
function sfx(kind) {
  if (muted || !NOTES[kind]) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    let t = actx.currentTime;
    for (const [f, d, type] of NOTES[kind]) {
      const o = actx.createOscillator(), gn = actx.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      gn.gain.setValueAtTime(0.045, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(gn).connect(actx.destination); o.start(t); o.stop(t + d);
      t += d * 0.9;
    }
  } catch (e) { /* audio unavailable */ }
}

/* ---------- UI ---------- */
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}
function select(s) { sel = s; confirmDisband = null; refreshSel(); ui(); }
function refreshSel() {
  selMoves = []; selTargets = [];
  if (!sel || !G) return;
  if (sel.kind === 'unit') {
    const u = unitById(sel.id);
    if (!u) { sel = null; return; }
    if (u.owner === G.view && canAct()) { selMoves = reach(u); selTargets = targetsFor(u, true); }
  }
}

function ui() {
  if (!G) return;
  const me = G.view, pl = G.players[me];
  $('turn').textContent = `Turn ${G.turn}${G.mode === 'perfection' ? ' / ' + G.turnLimit : ''}`;
  $('turn').style.color = pl.color;
  $('stars').textContent = `⭐ ${pl.stars} (+${income(me)})`;
  $('ucount').textContent = `⚔️ ${unitCount(me)}/${unitCap(me)}`;
  const showScore = G.mode === 'perfection';
  $('scores').innerHTML = G.players.map((p, i) =>
    `<span class="${p.alive ? '' : 'dead'} ${i === G.cur && busy ? 'thinking' : ''}" style="color:${p.color}">● ${esc(p.name)}${p.ai ? '' : ' 👤'} · 🏙️${cityTiles(i).length}${showScore ? ` · ${score(i)}` : ''}</span>`).join('');
  const ok = canAct();
  $('btn-end').disabled = !ok;
  $('btn-end').textContent = busy ? `${G.players[G.cur].name}…` : 'End turn';
  $('btn-next').disabled = !ok;
  $('btn-tech').disabled = !G || !!G.over;
  $('btn-sound').textContent = muted ? '🔇' : '🔊';
  renderPanel();
  if (!$('tech').hidden) renderTech();
}

function renderPanel() {
  const info = $('info'), act = $('actions');
  act.innerHTML = '';
  const me = G.view;
  if (!sel) {
    info.innerHTML = '<span class="muted">Tap a unit, city or tile. Capture villages, research tech, grow your cities and conquer the rival tribes.</span>';
    return;
  }
  const u0 = sel.kind === 'unit' ? unitById(sel.id) : null;
  const x = u0 ? u0.x : sel.x, y = u0 ? u0.y : sel.y;
  if (G.vis[me][y][x] === 0) { info.innerHTML = '<span class="muted">Unexplored. Send a unit to scout it.</span>'; return; }
  const tl = T(x, y), vis = seenByView(x, y);
  const u = u0 || (vis ? unitAt(x, y) : null);
  const mine = canAct();
  let html = '';
  if (u) {
    const d = UNITS[u.type], st = stats(u), pl = G.players[u.owner];
    const boat = st !== d ? ` <span class="muted">(${st.name} carrying ${d.name})</span>` : '';
    const status = u.owner !== me ? '' : u.attacked ? ' · done' : u.moved ? ' · can attack' : ' · ready';
    html += `<div class="row-info"><b style="color:${pl.color}">${st === d ? d.icon : st.icon} ${st === d ? d.name : st.name}</b>${boat} · ${esc(pl.name)} · ❤️ ${u.hp}/${maxHp(u)}${u.vet ? ' · ⭐ veteran' : ''}${status}<br>
      <span class="muted">Attack ${st.atk} · Defence ${st.def} · Move ${st.mv} · Range ${st.range}${u.kills ? ` · ${u.kills} kill${u.kills > 1 ? 's' : ''}` : ''}</span></div>`;
  }
  const b = tl.b;
  if (b && b.kind === 'village') html += '<div>🏘️ <b>Village</b> <span class="muted">Move a unit here to make it your city.</span></div>';
  else if (b && b.kind === 'ruin') html += '<div>🏛️ <b>Ancient ruins</b> <span class="muted">Explore with a unit for a surprise.</span></div>';
  else if (b) {
    const pl = G.players[b.owner];
    html += `<div>🏙️ <b style="color:${pl.color}">${esc(b.name)}</b>${b.capital ? ' (capital)' : ''} · ${esc(pl.name)} · level ${b.level}`;
    if (b.owner === me) {
      const extra = (b.workshop || 0) + (b.park || 0);
      html += `<br><span class="muted">Population ${b.pop}/${b.level >= MAX_LEVEL ? '–' : popNeeded(b)} · +${b.level + extra} ⭐/turn${b.wall ? ' · 🧱 walls' : ''}${b.border ? ' · wide borders' : ''}</span>`;
    }
    html += '</div>';
  }
  const resNames = { forest: '🌲 Forest', fruit: '🍎 Fruit', animal: '🦌 Wild animals', crop: '🌾 Crops', fish: '🐟 Fish' };
  const impNames = { farm: '🌾 Farm', lumber: '🌲 Lumber hut', mine: '⛏️ Mine', port: '⚓ Port' };
  const bits = [];
  if (tl.t === 'mountain') bits.push(hasTech(me, 'climbing') ? '⛰️ Mountain' : '⛰️ Mountain (needs 🧗 Climbing)');
  if (tl.t === 'water') bits.push('Shallow water');
  if (tl.t === 'ocean') bits.push('Deep ocean');
  if (tl.res) bits.push(resNames[tl.res]);
  if (tl.imp) bits.push(impNames[tl.imp]);
  if (!u && !b && !bits.length) bits.push('Open land');
  if (bits.length) html += `<div class="muted">${bits.join(' · ')}</div>`;
  info.innerHTML = html;

  if (!mine) return;
  const addBtn = (label, cost, disabled, fn, title) => {
    const el = document.createElement('button');
    el.innerHTML = `${label}${cost ? `<span class="cost">⭐${cost}</span>` : ''}`;
    el.disabled = disabled; el.onclick = fn;
    if (title) el.title = title;
    act.appendChild(el); return el;
  };
  const note = text => { const n = document.createElement('div'); n.className = 'muted note'; n.textContent = text; act.appendChild(n); };
  const pl = G.players[me];

  if (b && b.kind === 'city' && b.owner === me) {
    const blocked = !!unitAt(x, y), full = unitCount(me) >= unitCap(me);
    for (const k of Object.keys(UNITS)) {
      const d = UNITS[k];
      if (d.train === false) continue;
      if (!unitUnlocked(me, k)) { addBtn(`🔒 ${d.icon} ${d.name}`, 0, true, null, `Research ${TECHS[d.tech].name}`); continue; }
      addBtn(`${d.icon} ${d.name}`, d.cost, !canTrain({ x, y }, k, me), () => {
        if (train({ x, y }, k, me)) { const nu = unitAt(x, y); select({ kind: 'unit', id: nu.id }); }
      }, `Attack ${d.atk} · Defence ${d.def} · Move ${d.mv} · Range ${d.range} · HP ${d.hp}`);
    }
    if (blocked) note('Move the unit out of the city to train here.');
    else if (full) note(`Unit limit reached (${unitCap(me)}). Grow your cities to support more units.`);
  }
  if (tileOwner(x, y) === me && !(u && u.owner !== me)) {
    for (const k of Object.keys(WORKS)) {
      const w = WORKS[k];
      if (!w.on(tl)) continue;
      if (!hasTech(me, w.tech)) { addBtn(`🔒 ${w.icon} ${w.label}`, 0, true, null, `Research ${TECHS[w.tech].name}`); continue; }
      addBtn(`${w.icon} ${w.label} <span class="muted">+${w.pop} pop</span>`, w.cost, pl.stars < w.cost, () => {
        if (doWork(x, y, k, me)) { select(sel); showReward(); }
      });
    }
  }
  if (u && u.owner === me) {
    if (confirmDisband === u.id) {
      addBtn('Confirm disband', 0, false, () => { G.units = G.units.filter(z => z !== u); updateVis(); select(null); });
      addBtn('Keep unit', 0, false, () => { confirmDisband = null; ui(); });
    } else addBtn('Disband', 0, false, () => { confirmDisband = u.id; ui(); }, 'Remove this unit to free up space');
  }
}

function renderTech() {
  const me = G.view, pl = G.players[me], can = canAct();
  $('tech-stars').textContent = `⭐ ${pl.stars} to spend. Each city you own makes research a little pricier.`;
  const keys = Object.keys(TECHS);
  const kids = k => keys.filter(c => TECHS[c].req === k);
  const card = k => {
    const t = TECHS[k], owned = hasTech(me, k), avail = techAvailable(me, k), cost = techCost(me, k);
    const cls = owned ? 'owned' : avail ? (pl.stars >= cost ? 'avail' : 'avail short') : 'locked';
    const label = owned ? '✓ Known' : avail ? `⭐ ${cost}` : `🔒 needs ${TECHS[t.req].name}`;
    return `<button class="tech ${cls}" data-tech="${k}" style="--tier:${t.tier}" ${owned || !avail || pl.stars < cost || !can ? 'disabled' : ''}>
      <span class="t-name">${t.icon} ${t.name}</span><span class="t-desc">${t.desc}</span><span class="t-cost">${label}</span></button>`;
  };
  $('tech-tree').innerHTML = keys.filter(k => !TECHS[k].req).map(r => {
    const list = [];
    const walk = k => { list.push(card(k)); kids(k).forEach(walk); };
    walk(r);
    return `<div class="branch">${list.join('')}</div>`;
  }).join('');
}
$('tech-tree').addEventListener('click', e => {
  const btn = e.target.closest('button[data-tech]');
  if (!btn || !canAct()) return;
  const k = btn.dataset.tech;
  if (research(G.view, k)) { sfx('tech'); toast(`Discovered ${TECHS[k].icon} ${TECHS[k].name}: ${TECHS[k].desc}`); refreshSel(); ui(); }
});

function showReward() {
  if (!G || G.over || !G.rewards.length || G.cur !== G.view) return;
  const r = G.rewards[0], c = { x: r.x, y: r.y, b: T(r.x, r.y).b };
  if (!c.b || c.b.kind !== 'city' || c.b.owner !== r.owner) { G.rewards.shift(); showReward(); return; }
  $('reward-title').textContent = `${c.b.name} reached level ${r.level}!`;
  const box = $('reward-opts');
  box.innerHTML = '';
  for (const [key, icon, name, desc] of rewardOptions(r.level)) {
    const el = document.createElement('button');
    el.className = 'reward-opt';
    el.innerHTML = `<span class="r-icon">${icon}</span><b>${name}</b><span class="muted">${desc}</span>`;
    el.onclick = () => {
      G.rewards.shift();
      $('reward').hidden = true;
      applyReward(c, key, r.owner);
      sfx('click');
      refreshSel(); ui();
      showReward();
    };
    box.appendChild(el);
  }
  $('reward').hidden = false;
  refreshSel(); ui();
}
function showPass() {
  const pl = G.players[G.cur];
  $('pass-title').textContent = `${pl.name}'s turn`;
  $('pass-title').style.color = pl.color;
  $('pass-text').textContent = `Turn ${G.turn}. Hand the device to ${pl.name} and keep the screen hidden from the others.`;
  $('pass').hidden = false;
  ui();
}
$('btn-pass').onclick = () => {
  $('pass').hidden = true;
  focusHome(false);
  banner(`${G.players[G.cur].name} · Turn ${G.turn}`, `+${income(G.cur)} ⭐ this turn`, G.players[G.cur].color);
  refreshSel(); ui(); showReward();
};

function nextUnit() {
  if (!canAct()) return;
  const mine = G.units.filter(u => u.owner === G.view && (reach(u).length || targetsFor(u, true).length));
  if (!mine.length) { toast('All units have acted. End your turn when ready.'); return; }
  const cur = sel && sel.kind === 'unit' ? mine.findIndex(u => u.id === sel.id) : -1;
  const u = mine[(cur + 1) % mine.length];
  select({ kind: 'unit', id: u.id });
  camGoal = { x: wxOf(u.x, u.y), y: wyOf(u.x, u.y) + TH / 2 };
}

/* ---------- rendering ---------- */
// Every tribe's homeland has its own climate: ground, trees, rock and wildlife colours.
const CLIMATES = [
  { name: 'meadow', top: '#96d46d', top2: '#86c65e', side: '#62924a', side2: '#527d3d', tree: 'round', leaf: '#47a54c', leaf2: '#2f803a', rock: '#a3acb7', rock2: '#7f8996', snow: true, animal: '#a8703a', fruit: '#e8403a', tuft: '#6cae4c' },
  { name: 'autumn', top: '#dcbc63', top2: '#cdad55', side: '#a17e3a', side2: '#886a2f', tree: 'round', leaf: '#ea7a30', leaf2: '#bf5323', rock: '#a99484', rock2: '#857264', snow: false, animal: '#7a4a2a', fruit: '#a23bb6', tuft: '#b8933f' },
  { name: 'jungle', top: '#62c35d', top2: '#53b351', side: '#3f843d', side2: '#336f32', tree: 'jungle', leaf: '#33a34e', leaf2: '#1f7a39', rock: '#8e9e8c', rock2: '#6c7b6c', snow: false, animal: '#c98a3a', fruit: '#f5b71c', tuft: '#3b9a42' },
  { name: 'desert', top: '#f3da94', top2: '#e8cc82', side: '#c7a862', side2: '#ad8f4e', tree: 'palm', leaf: '#5cab4b', leaf2: '#3e8a3a', rock: '#d6aa72', rock2: '#b18656', snow: false, animal: '#d9a35e', fruit: '#e8403a', tuft: '#cbb36b' },
  { name: 'highland', top: '#acb995', top2: '#9eab88', side: '#768066', side2: '#656e57', tree: 'pine', leaf: '#3f735d', leaf2: '#2b5747', rock: '#918fa6', rock2: '#706e87', snow: true, animal: '#8d8d8d', fruit: '#c0392b', tuft: '#879872' },
  { name: 'tundra', top: '#f2f7fc', top2: '#e2ebf4', side: '#afbfd2', side2: '#98aac1', tree: 'snowpine', leaf: '#2f6b5c', leaf2: '#235246', rock: '#a6b6c8', rock2: '#8394a8', snow: true, animal: '#f6f6f2', fruit: '#4a6cf0', tuft: '#c3d1df' },
];
const SKIN = ['#f1c9a5', '#c98a5e', '#8d5a3b', '#e3b27c', '#d9b38c', '#f6dcc8'];
const hitAnims = new Map(), faces = new Map();
let parts = [], bgGrad = null, vignette = null, demo = null;

const hash = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const shadeCache = new Map();
function shade(hex, f) { // f < 0 darkens, f > 0 lightens
  const key = hex + f;
  let v = shadeCache.get(key);
  if (v) return v;
  let r, g, b;
  if (hex[0] === '#') { const n = parseInt(hex.slice(1, 7), 16); r = n >> 16; g = (n >> 8) & 255; b = n & 255; }
  else [r, g, b] = hex.match(/\d+/g).map(Number); // an rgb() string from an earlier shade()
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`;
  shadeCache.set(key, v);
  return v;
}
const climateOf = tl => CLIMATES[tl.c] || CLIMATES[0];

function resize() {
  dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0b2746'); bgGrad.addColorStop(1, '#061629');
  vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.78);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,8,22,.5)');
}
const wxOf = (x, y) => (x - y) * TW / 2;
const wyOf = (x, y) => (x + y) * TH / 2;
function pick(mx, my) {
  const wx = (mx - W / 2) / cam.z + cam.x, wy = (my - H / 2) / cam.z + cam.y;
  const a = wx / (TW / 2), b = (wy - TH / 2) / (TH / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/* drawing primitives */
function diamondPath(x, y, inset) {
  const i = inset || 0, hw = TW / 2 - i * 2;
  ctx.beginPath();
  ctx.moveTo(x, y + i); ctx.lineTo(x + hw, y + TH / 2); ctx.lineTo(x, y + TH - i); ctx.lineTo(x - hw, y + TH / 2); ctx.closePath();
}
function diamond(x, y, fill, stroke, lw, inset) {
  diamondPath(x, y, inset);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function poly(pts, fill, stroke, lw) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function ellipse(x, y, rx, ry, fill, stroke, lw, rot) {
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}
function line(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
function pill(x, y, w, h, fill) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2); else ctx.rect(x, y, w, h);
  ctx.fillStyle = fill; ctx.fill();
}
// A box standing on an iso footprint centred at (cx, cy), with an optional pyramid roof.
function isoBox(cx, cy, w, h, wall, wall2, roof, roofH) {
  const hh = w / 2;
  poly([[cx - w, cy - h], [cx, cy + hh - h], [cx, cy + hh], [cx - w, cy]], wall);
  poly([[cx, cy + hh - h], [cx + w, cy - h], [cx + w, cy], [cx, cy + hh]], wall2);
  if (roofH) {
    const ax = cx, ay = cy - h - roofH;
    poly([[cx - w - 1, cy - h + 0.5], [cx, cy + hh - h + 1], [ax, ay]], roof);
    poly([[cx, cy + hh - h + 1], [cx + w + 1, cy - h + 0.5], [ax, ay]], shade(roof, -0.22));
  } else poly([[cx - w, cy - h], [cx, cy - hh - h], [cx + w, cy - h], [cx, cy + hh - h]], roof);
}

/* terrain */
function drawLand(wx, wy, cl) {
  poly([[wx - TW / 2, wy + TH / 2], [wx, wy + TH], [wx, wy + TH + LH], [wx - TW / 2, wy + TH / 2 + LH]], cl.side);
  poly([[wx, wy + TH], [wx + TW / 2, wy + TH / 2], [wx + TW / 2, wy + TH / 2 + LH], [wx, wy + TH + LH]], cl.side2);
  diamond(wx, wy, cl.top2);
  poly([[wx, wy], [wx - TW / 2, wy + TH / 2], [wx, wy + TH]], cl.top);
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(wx - TW / 2 + 1, wy + TH / 2); ctx.lineTo(wx, wy + 0.5); ctx.lineTo(wx + TW / 2 - 1, wy + TH / 2); ctx.stroke();
}
function drawWater(x, y, wx, wy, deep, now) {
  diamond(wx, wy, deep ? '#2a6aa9' : '#3f9bd2');
  poly([[wx, wy], [wx - TW / 2, wy + TH / 2], [wx, wy + TH]], deep ? '#2f75b6' : '#4aa8dc');
  const ph = now / 1300 + hash(x, y) * 6.283;
  ctx.strokeStyle = deep ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.2;
  const ox = wx + (hash(x, y, 1) - 0.5) * 22 + Math.sin(ph) * 3, oy = wy + TH / 2 + (hash(x, y, 2) - 0.5) * 8;
  ctx.beginPath(); ctx.moveTo(ox - 5, oy); ctx.quadraticCurveTo(ox, oy - 2.5, ox + 5, oy); ctx.stroke();
  // surf where coastal cliffs face the viewer
  const land = (xx, yy) => inb(xx, yy) && !isWater(T(xx, yy));
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.22 * Math.sin(now / 650 + x * 1.3 + y)})`; ctx.lineWidth = 2;
  ctx.beginPath();
  if (land(x, y - 1)) { ctx.moveTo(wx + 3, wy + 5); ctx.lineTo(wx + 26, wy + 16.5); }
  if (land(x - 1, y)) { ctx.moveTo(wx - 26, wy + 16.5); ctx.lineTo(wx - 3, wy + 5); }
  ctx.stroke();
}
function drawTufts(x, y, cx, cy, cl) {
  const k = Math.floor(hash(x, y, 7) * 3);
  ctx.strokeStyle = cl.tuft; ctx.lineWidth = 1.2;
  for (let i = 0; i < k; i++) {
    const tx = cx + (hash(x, y, 10 + i) - 0.5) * 32, ty = cy + 2 + (hash(x, y, 20 + i) - 0.5) * 12;
    ctx.beginPath(); ctx.moveTo(tx - 2.5, ty - 3); ctx.lineTo(tx, ty); ctx.lineTo(tx + 2.5, ty - 3.5); ctx.moveTo(tx, ty); ctx.lineTo(tx, ty - 4.5); ctx.stroke();
  }
  if (cl.name !== 'tundra' && cl.name !== 'desert' && hash(x, y, 30) < 0.3)
    circle(cx + (hash(x, y, 31) - 0.5) * 28, cy + (hash(x, y, 32) - 0.5) * 10, 1.6, hash(x, y, 33) < 0.5 ? '#fff6c9' : '#ffc4d8');
  if (cl.name === 'desert' && hash(x, y, 34) < 0.25) ellipse(cx + (hash(x, y, 35) - 0.5) * 26, cy + 3, 3, 1.6, '#d2b06c');
}
function drawTree(cx, cy, cl, s) {
  if (cl.tree === 'palm') {
    ctx.strokeStyle = '#9a7442'; ctx.lineWidth = 2.6 * s;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + 5 * s, cy - 10 * s, cx + 1 * s, cy - 21 * s); ctx.stroke();
    const tx = cx + s, ty = cy - 21 * s;
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI + k * Math.PI / 4;
      ellipse(tx + Math.cos(a) * 6 * s, ty + Math.sin(a) * 3 * s + 2 * s, 7 * s, 2.2 * s, k % 2 ? cl.leaf : cl.leaf2, null, 0, a + (k < 2 ? 0.35 : k > 2 ? -0.35 : 0));
    }
    circle(tx - 1.5 * s, ty + 1.5 * s, 1.6 * s, '#7a5230'); circle(tx + 1.5 * s, ty + 2 * s, 1.6 * s, '#7a5230');
    return;
  }
  if (cl.tree === 'jungle') {
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(cx - 1.4 * s, cy - 16 * s, 2.8 * s, 16 * s);
    circle(cx - 5 * s, cy - 15 * s, 6 * s, cl.leaf2); circle(cx + 5 * s, cy - 16 * s, 6 * s, cl.leaf2);
    circle(cx, cy - 21 * s, 7 * s, cl.leaf);
    ctx.fillStyle = cl.leaf2; ctx.beginPath(); ctx.arc(cx, cy - 21 * s, 7 * s, -Math.PI / 2, Math.PI / 2); ctx.fill();
    circle(cx - 2.5 * s, cy - 24 * s, 2.2 * s, 'rgba(255,255,255,.18)');
    return;
  }
  if (cl.tree === 'pine' || cl.tree === 'snowpine') {
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(cx - 1.3 * s, cy - 4 * s, 2.6 * s, 5 * s);
    for (const [w, y0, y1] of [[8, -2, -14], [6.5, -8, -20], [5, -14, -26]]) {
      poly([[cx - w * s, cy + y0 * s], [cx, cy + y1 * s], [cx, cy + y0 * s]], cl.leaf);
      poly([[cx, cy + y0 * s], [cx, cy + y1 * s], [cx + w * s, cy + y0 * s]], cl.leaf2);
      if (cl.tree === 'snowpine') {
        const my = y1 + (y0 - y1) * 0.45;
        poly([[cx - w * 0.45 * s, cy + my * s], [cx, cy + y1 * s], [cx + w * 0.45 * s, cy + my * s], [cx, cy + (my - 1.5) * s]], '#ffffff');
      }
    }
    return;
  }
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(cx - 1.5 * s, cy - 7 * s, 3 * s, 8 * s);
  circle(cx, cy - 12 * s, 7.5 * s, cl.leaf2);
  ctx.fillStyle = cl.leaf; ctx.beginPath(); ctx.arc(cx, cy - 12 * s, 7.5 * s, Math.PI / 2, Math.PI * 1.5); ctx.fill();
  circle(cx - 2.5 * s, cy - 15 * s, 2.4 * s, 'rgba(255,255,255,.2)');
}
function drawForest(x, y, cx, cy, cl, hut) {
  const j = (k, r) => (hash(x, y, k) - 0.5) * r;
  drawTree(cx - 12 + j(40, 4), cy + 1 + j(41, 3), cl, 0.95);
  drawTree(cx + 11 + j(42, 4), cy + j(43, 3), cl, 1);
  if (hut) {
    isoBox(cx + 1, cy + 8, 5.5, 5, '#c39461', '#a07546', '#6b4a2b', 5);
    circle(cx - 8, cy + 9, 2, '#9a6a3a', '#5a3d24', 0.8); circle(cx - 4.5, cy + 9.5, 2, '#9a6a3a', '#5a3d24', 0.8);
  } else drawTree(cx + j(44, 4), cy + 7, cl, 1.1);
}
function drawMountain(cx, cy, cl, mine) {
  poly([[cx + 2, cy + 6], [cx + 16, cy - 14], [cx + 16, cy + 9]], cl.rock);
  poly([[cx + 16, cy - 14], [cx + 30, cy + 6], [cx + 16, cy + 9]], cl.rock2);
  poly([[cx - 26, cy + 6], [cx - 5, cy - 30], [cx - 1, cy + 11]], cl.rock);
  poly([[cx - 5, cy - 30], [cx + 20, cy + 6], [cx - 1, cy + 11]], cl.rock2);
  if (cl.snow) {
    poly([[cx - 5, cy - 30], [cx - 12.4, cy - 17.4], [cx - 8, cy - 15], [cx - 3.6, cy - 15.3]], '#ffffff');
    poly([[cx - 5, cy - 30], [cx - 3.6, cy - 15.3], [cx, cy - 16], [cx + 3.8, cy - 17.4]], '#dce6f1');
    poly([[cx + 16, cy - 14], [cx + 11.1, cy - 7], [cx + 16, cy - 6]], '#ffffff');
    poly([[cx + 16, cy - 14], [cx + 16, cy - 6], [cx + 20.9, cy - 7]], '#dce6f1');
  }
  if (mine) {
    poly([[cx - 14, cy + 9], [cx - 14, cy - 2], [cx - 3, cy - 2], [cx - 3, cy + 9]], '#7a5230');
    ctx.fillStyle = '#1c1410'; ctx.beginPath(); ctx.arc(cx - 8.5, cy + 9, 4.5, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 13, cy + 4, 9, 5);
    ellipse(cx + 6, cy + 9, 4, 2.2, '#5a5a62'); circle(cx + 5, cy + 7, 1.8, '#e2b13c'); circle(cx + 7.5, cy + 7.5, 1.5, '#e2b13c');
  }
}
function drawFruit(cx, cy, cl) {
  circle(cx, cy - 4, 10.5, cl.leaf2); circle(cx - 3.5, cy - 7.5, 7, cl.leaf);
  for (const [dx, dy] of [[-5, -4], [4, -7], [3, 0], [-1, -9]]) circle(cx + dx, cy + dy, 2.5, cl.fruit, shade(cl.fruit, -0.4), 0.8);
}
function drawAnimal(cx, cy, cl) {
  const c = cl.animal, d = shade(c, -0.3);
  ellipse(cx, cy + 3, 11, 3.5, 'rgba(0,0,0,.18)');
  ctx.strokeStyle = d; ctx.lineWidth = 2;
  for (const dx of [-6, -2, 3, 7]) line(cx + dx, cy - 3, cx + dx, cy + 3);
  ellipse(cx, cy - 6, 10, 5.5, c, d, 1);
  poly([[cx + 6, cy - 8], [cx + 9, cy - 15], [cx + 13, cy - 13], [cx + 10, cy - 5]], c, d);
  ellipse(cx + 12, cy - 14, 3.8, 2.6, c, d, 1);
  ctx.strokeStyle = cl.name === 'tundra' ? '#9aa6b4' : '#6b4a2b'; ctx.lineWidth = 1.5;
  line(cx + 10, cy - 16, cx + 8, cy - 22); line(cx + 12.5, cy - 16, cx + 14, cy - 22);
  ctx.fillStyle = '#111'; ctx.fillRect(cx + 13, cy - 15, 1.2, 1.2);
}
function drawCrop(cx, cy) {
  for (const [dx, dy] of [[-11, 1], [-5, -3], [2, 2], [8, -2], [-3, 6], [5, 7], [12, 3]]) {
    ctx.strokeStyle = '#b98e2a'; ctx.lineWidth = 1.3; line(cx + dx, cy + dy, cx + dx, cy + dy - 10);
    ellipse(cx + dx, cy + dy - 11, 1.9, 3.8, '#f2c95a', '#c99a2e', 0.6);
  }
}
function drawFarm(wx, wy) {
  diamond(wx, wy, '#e3c65e', '#c49c3a', 1, 3);
  ctx.save(); diamondPath(wx, wy, 3); ctx.clip();
  ctx.strokeStyle = '#c49c3a'; ctx.lineWidth = 1.6;
  for (let i = -4; i <= 4; i++) line(wx - 32 + i * 8, wy, wx + i * 8, wy + 32);
  ctx.restore();
}
function drawFish(cx, cy, now) {
  for (const [dx, dy, s] of [[-7, -1, 1], [6, 4, 0.8]]) {
    const w = Math.sin(now / 300 + dx) * 0.6;
    ellipse(cx + dx, cy + dy, 6 * s, 3 * s, '#e3f3ff');
    poly([[cx + dx + 5 * s, cy + dy], [cx + dx + 10 * s, cy + dy - 3 * s + w], [cx + dx + 10 * s, cy + dy + 3 * s + w]], '#e3f3ff');
  }
  circle(cx + 1, cy - 6 - ((now / 60) % 8), 1.2, 'rgba(255,255,255,.6)');
}
function drawPort(cx, cy, now) {
  isoBox(cx - 2, cy + 3, 13, 2.5, '#a0703f', '#86592f', '#b98551', 0);
  ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 2;
  line(cx - 13, cy + 3, cx - 13, cy + 8); line(cx + 9, cy + 3, cx + 9, cy + 8);
  const b = Math.sin(now / 500) * 1.2;
  poly([[cx + 6, cy - 6 + b], [cx + 22, cy - 6 + b], [cx + 19, cy - 1 + b], [cx + 9, cy - 1 + b]], '#8a5a33', '#4a2f1a');
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.2; line(cx + 14, cy - 6 + b, cx + 14, cy - 22 + b);
  poly([[cx + 15, cy - 21 + b], [cx + 22, cy - 8 + b], [cx + 15, cy - 8 + b]], '#f4efe2');
}
function drawRuin(cx, cy, now) {
  ellipse(cx, cy + 4, 16, 6, 'rgba(0,0,0,.12)');
  isoBox(cx - 10, cy + 1, 3.6, 13, '#cbc4b4', '#a8a091', '#dcd6c8', 0);
  isoBox(cx + 9, cy - 2, 3.6, 7, '#cbc4b4', '#a8a091', '#dcd6c8', 0);
  isoBox(cx + 2, cy + 8, 6, 2.6, '#bdb6a7', '#9c9486', '#d2ccbe', 0);
  circle(cx - 11, cy - 13, 2.2, '#6faa55'); circle(cx + 9, cy - 9, 1.8, '#6faa55');
  circle(cx - 1, cy - 2, 2.2 + Math.sin(now / 400), 'rgba(120,210,255,.9)');
  circle(cx - 1, cy - 2, 5 + Math.sin(now / 400) * 1.5, 'rgba(120,210,255,.18)');
}
function drawVillage(cx, cy) {
  ellipse(cx, cy + 4, 18, 6, 'rgba(0,0,0,.12)');
  isoBox(cx - 9, cy, 6.5, 6, '#e7d6ac', '#c9b68c', '#b07a3e', 8);
  isoBox(cx + 9, cy + 3, 5.5, 5, '#e7d6ac', '#c9b68c', '#9c6a33', 7);
  ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 1.2;
  line(cx - 16, cy + 8, cx - 4, cy + 13); line(cx - 13, cy + 8.5, cx - 13, cy + 11.5); line(cx - 8, cy + 10.5, cx - 8, cy + 13.5);
}
function wallEdges(wx, wy, front) {
  const i = 3, top = [wx, wy + i], right = [wx + TW / 2 - 2 * i, wy + TH / 2], bot = [wx, wy + TH - i], left = [wx - TW / 2 + 2 * i, wy + TH / 2];
  const segs = front ? [[right, bot], [bot, left]] : [[left, top], [top, right]];
  for (const [a, b] of segs) {
    poly([a, b, [b[0], b[1] - 6], [a[0], a[1] - 6]], front ? '#c3b9a3' : '#a99f8a', '#7f7666');
    ctx.fillStyle = '#ddd5c4';
    for (let k = 0; k <= 4; k++) { const t = k / 4; ctx.fillRect(a[0] + (b[0] - a[0]) * t - 1.5, a[1] + (b[1] - a[1]) * t - 8.5, 3, 3); }
  }
}
function drawCity(wx, wy, b, now) {
  const cx = wx, cy = wy + TH / 2, col = G.players[b.owner].color;
  if (b.level >= 2) diamond(wx, wy, 'rgba(240,230,205,.6)', 'rgba(150,135,110,.5)', 1, 6);
  if (b.wall) wallEdges(wx, wy, false);
  const slots = [[0, -8], [-13, -2], [13, -2], [-6, 4], [7, 5], [0, 10]];
  const items = [];
  const count = Math.min(6, b.level + 1);
  for (let i = 0; i < count; i++) items.push({ x: slots[i][0], y: slots[i][1], i });
  if (b.capital) items[0].tower = true;
  for (const it of items) {
    const px = cx + it.x, py = cy + it.y;
    if (it.tower) {
      const h = 15 + Math.min(b.level, 6) * 2.5;
      isoBox(px, py, 5.5, h, '#eee7d8', '#cfc6b3', shade(col, -0.15), 8);
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 1; line(px, py - h - 8, px, py - h - 20);
      const wv = Math.sin(now / 260) * 1.5;
      poly([[px, py - h - 20], [px + 10, py - h - 17 + wv], [px, py - h - 14]], col);
    } else {
      const h = 5 + (b.level >= 3 ? 3 : 0) + hash(b.level, it.i, 3) * 2;
      isoBox(px, py, 5.5, h, '#f5ecda', '#d9ceb6', it.i % 2 ? col : shade(col, -0.18), 6);
      ctx.fillStyle = 'rgba(40,30,20,.55)'; ctx.fillRect(px - 3.2, py - 3.5, 1.8, 3);
    }
  }
  if (b.wall) wallEdges(wx, wy, true);
}
function drawBuilding(wx, wy, b, now) {
  const cx = wx, cy = wy + TH / 2;
  if (b.kind === 'village') drawVillage(cx, cy);
  else if (b.kind === 'ruin') drawRuin(cx, cy, now);
  else {
    drawCity(wx, wy, b, now);
    labels.push({ x: cx, y: cy + 15, text: `${b.capital ? '★ ' : ''}${b.name}`, level: b.level, color: G.players[b.owner].color });
  }
}

/* clouds over unexplored land */
function puff(x, y, i, now) {
  return {
    x: wxOf(x, y) + (hash(x, y, i) - 0.5) * 24 + Math.sin(now / 2600 + i * 2 + x * 0.7) * 2,
    y: wyOf(x, y) + TH / 2 - 9 + (hash(x, y, i + 4) - 0.5) * 9 + Math.cos(now / 3100 + i + y) * 1.2,
    r: 11 + hash(x, y, i + 8) * 6,
  };
}
function drawClouds(list, now) {
  for (const [x, y] of list) for (let i = 0; i < 3; i++) {
    const p = puff(x, y, i, now);
    ellipse(p.x + p.r * 0.12, p.y + p.r * 0.24, p.r, p.r * 0.8, '#c2cedd');
    ellipse(p.x, p.y, p.r * 0.92, p.r * 0.74, '#edf2f8');
    if (i === 0) ellipse(p.x - p.r * 0.3, p.y - p.r * 0.26, p.r * 0.45, p.r * 0.32, 'rgba(255,255,255,.9)');
  }
}

/* units */
function person(col, skin, o) {
  const dark = shade(col, -0.38), mid = shade(col, -0.16);
  if (!o.noLegs) { ctx.fillStyle = '#3a2a22'; ctx.fillRect(-4, -6, 3, 6); ctx.fillRect(1, -6, 3, 6); }
  const w = o.big ? 7 : 6;
  poly([[-w, -5], [w, -5], [w - 1.5, -17], [-w + 1.5, -17]], col, dark, 1);
  poly([[0.5, -5], [w, -5], [w - 1.5, -17], [0.5, -17]], mid);
  ctx.fillStyle = dark; ctx.fillRect(-w + 0.8, -9.5, 2 * w - 1.6, 1.8);
  circle(0, -21.5, 4.8, skin, shade(skin, -0.32), 1);
  if (o.helmet) {
    ctx.fillStyle = '#aab3bd'; ctx.beginPath(); ctx.arc(0, -22.3, 5.3, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#7f8994'; ctx.fillRect(-5.3, -22.6, 10.6, 1.6);
    ctx.fillStyle = col; ctx.fillRect(-1, -30, 2, 4);
  } else if (o.hood) {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -22, 5.4, Math.PI * 0.92, Math.PI * 2.08); ctx.fill();
  } else {
    ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(0, -22.6, 5, Math.PI, 0); ctx.fill();
  }
  ctx.fillStyle = '#1b1b1b'; ctx.fillRect(1.8, -22, 1.3, 1.6);
}
function sword(skin) { ctx.strokeStyle = '#e8eef4'; ctx.lineWidth = 2; line(7, -11, 12, -25); ctx.strokeStyle = '#6b4a2b'; line(4.5, -12.5, 9.5, -10); circle(6.5, -11.5, 1.9, skin); }
function bigSword(skin) { ctx.strokeStyle = '#eef3f8'; ctx.lineWidth = 2.8; line(7, -10, 14, -30); ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.2; line(4, -13.5, 10.5, -10.5); circle(7, -12, 2, skin); }
function bow(skin) {
  ctx.strokeStyle = '#7a4d2a'; ctx.fillStyle = '#7a4d2a'; ctx.fillRect(-7.5, -18, 3, 9);
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(5, -14, 8, -1.25, 1.25); ctx.stroke();
  ctx.strokeStyle = '#f2ead8'; ctx.lineWidth = 0.8; line(5 + 8 * Math.cos(1.25), -14 - 8 * Math.sin(1.25), 5 + 8 * Math.cos(1.25), -14 + 8 * Math.sin(1.25));
  circle(7.5, -14, 1.9, skin);
}
function spear() { ctx.strokeStyle = '#7a4d2a'; ctx.lineWidth = 1.6; line(-7, 0, -7, -32); poly([[-9, -31], [-7, -37], [-5, -31]], '#dfe6ee'); }
function shield(col) {
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(1.5, -18.5, 9, 14, 3); else ctx.rect(1.5, -18.5, 9, 14);
  ctx.fillStyle = shade(col, 0.18); ctx.fill(); ctx.strokeStyle = shade(col, -0.45); ctx.lineWidth = 1.3; ctx.stroke();
  circle(6, -11.5, 2, '#ffe9a8');
}
function smallShield(col) { circle(-6.5, -12, 4.6, shade(col, 0.18), shade(col, -0.45), 1.2); circle(-6.5, -12, 1.5, '#ffe9a8'); }
function lance(col) { ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 2; line(-4, -12, 22, -27); poly([[21, -29], [26, -29.5], [22.5, -25]], '#dfe6ee'); poly([[14, -22.5], [19, -20], [14.5, -19]], col); }
function club(skin) { ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 3; line(6, -10, 11, -26); circle(11.5, -27, 3.4, '#7a5634'); circle(7, -11, 2.2, skin); }
function horse(coat, cap) {
  const dk = shade(coat, -0.32);
  ctx.strokeStyle = dk; ctx.lineWidth = 2.2;
  line(-7, -6, -8, 0); line(-3, -6, -3, 0); line(4, -6, 4, 0); line(8, -6, 9, 0);
  ellipse(0, -9, 11, 5, coat, dk, 1);
  poly([[6, -11], [10, -20], [14, -19], [11, -8]], coat, dk);
  ellipse(14.5, -19, 4.2, 2.6, coat, dk, 1, 0.2);
  poly([[11.5, -21.3], [12.4, -24.6], [13.6, -21]], coat);
  ctx.strokeStyle = shade(coat, -0.55); ctx.lineWidth = 2; line(7, -12, 10.5, -20.5);
  ctx.strokeStyle = dk; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(-10.5, -10); ctx.quadraticCurveTo(-15, -8, -13, -2); ctx.stroke();
  if (cap) poly([[-8, -13.5], [6, -13.5], [7, -5], [-9, -5]], cap, shade(cap, -0.4));
  ctx.fillStyle = '#111'; ctx.fillRect(15.2, -20, 1.2, 1.2);
}
function catapult(col) {
  poly([[-12, -9], [12, -9], [12, -4], [-12, -4]], '#8a5a33', '#4a2f1a');
  circle(-7, -2, 3.3, '#4a2f1a'); circle(7, -2, 3.3, '#4a2f1a'); circle(-7, -2, 1, '#b08850'); circle(7, -2, 1, '#b08850');
  ctx.strokeStyle = '#6b4426'; ctx.lineWidth = 2.2; line(-2, -9, 2, -19); line(5, -9, 2, -19);
  ctx.strokeStyle = '#8a5a33'; ctx.lineWidth = 2; line(-10, -11, 11, -23);
  circle(11.5, -24, 3, '#5a3a22'); circle(11.5, -25.2, 2, '#a3a3a3');
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1; line(-11, -9, -11, -23); poly([[-11, -23], [-3.5, -21], [-11, -18.5]], col);
}
function drawBody(type, col, skin, inBoat) {
  const helmet = type === 'defender' || type === 'swordsman' || type === 'knight';
  if (inBoat) { person(col, skin, { noLegs: true, helmet, hood: type === 'archer' }); if (type === 'archer') bow(skin); else sword(skin); return; }
  switch (type) {
    case 'archer': person(col, skin, { hood: true }); bow(skin); break;
    case 'defender': spear(); person(col, skin, { helmet: true }); shield(col); break;
    case 'swordsman': person(col, skin, { helmet: true, big: true }); bigSword(skin); smallShield(col); break;
    case 'rider': horse('#8a5a33'); ctx.save(); ctx.translate(-1, -9); person(col, skin, { noLegs: true }); sword(skin); ctx.restore(); break;
    case 'knight': horse('#e6e6e6', col); ctx.save(); ctx.translate(-1, -9); person(col, skin, { noLegs: true, helmet: true }); lance(col); ctx.restore(); break;
    case 'catapult': catapult(col); break;
    case 'giant': ctx.save(); ctx.scale(1.55, 1.55); person(col, shade(skin, -0.1), { big: true }); club(skin); ctx.restore(); break;
    default: person(col, skin, {}); sword(skin);
  }
}
function drawBoat(col, ship) {
  poly([[-17, -7], [17, -7], [12, 3], [-12, 3]], '#8a5a33', '#4a2f1a');
  ctx.fillStyle = '#6b4426'; ctx.fillRect(-17, -8, 34, 2);
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.5; line(6, -7, 6, ship ? -42 : -33);
  if (ship) {
    poly([[7, -40], [19, -12], [7, -12]], '#f4efe2', '#c9c0ad');
    poly([[5, -36], [5, -14], [-6, -14]], col);
    poly([[6, -42], [13, -40], [6, -38]], col);
  } else poly([[7, -32], [17, -11], [7, -11]], col, shade(col, -0.35));
}
function drawUnit(u, now, demoMode) {
  let gx = u.x, gy = u.y, ox = 0;
  const an = anims.get(u.id);
  if (an) {
    const t = Math.min(1, (now - an.t0) / 220);
    if (t >= 1) anims.delete(u.id);
    const e = t * (2 - t);
    gx = an.x0 + (u.x - an.x0) * e; gy = an.y0 + (u.y - an.y0) * e;
  }
  const ha = hitAnims.get(u.id);
  if (ha) {
    const t = (now - ha.t0) / ha.dur;
    if (t >= 1) hitAnims.delete(u.id);
    else if (t > 0 && ha.kind === 'lunge') { const k = Math.sin(Math.PI * t) * 0.32; gx += ha.dx * k; gy += ha.dy * k; }
    else if (t > 0) ox = Math.sin(t * 45) * 2.6 * (1 - t);
  }
  const water = isWater(T(u.x, u.y));
  const cx = wxOf(gx, gy) + ox, cy = wyOf(gx, gy) + TH / 2 + 3 + (water ? WOFF : 0);
  const pl = G.players[u.owner], col = pl.color;
  const isSel = !demoMode && sel && sel.kind === 'unit' && sel.id === u.id;
  const bob = isSel ? -Math.abs(Math.sin(now / 170)) * 3 : water ? Math.sin(now / 420 + u.id) * 1.2 : 0;
  if (!water) {
    ellipse(cx, cy, 13, 5.5, 'rgba(0,0,0,.25)');
    ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2.6 : 1.7; ctx.beginPath(); ctx.ellipse(cx, cy, 13, 5.5, 0, 0, 6.283); ctx.stroke();
    if (isSel) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(now / 200)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, 16, 7, 0, 0, 6.283); ctx.stroke(); }
  }
  const done = !demoMode && u.owner === G.view && G.cur === G.view && u.moved && u.attacked;
  ctx.globalAlpha = done ? 0.6 : 1;
  ctx.save();
  ctx.translate(cx, cy + bob);
  ctx.scale(faces.get(u.id) || (u.id % 3 ? 1 : -1), 1);
  const skin = SKIN[pl.tribe] || SKIN[0];
  if (water) { drawBoat(col, hasTech(u.owner, 'navigation')); ctx.translate(-5, -6); ctx.scale(0.82, 0.82); drawBody(u.type, col, skin, true); }
  else drawBody(u.type, col, skin, false);
  ctx.restore();
  ctx.globalAlpha = 1;
  // health badge, veteran star, ready marker
  const f = u.hp / maxHp(u), txt = String(u.hp), py = cy - 2 + bob;
  ctx.font = '800 9.5px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(txt).width + 8;
  pill(cx + 14 - tw / 2, py - 6, tw, 12, 'rgba(11,18,32,.88)');
  ctx.fillStyle = f > 0.5 ? '#86ffa0' : f > 0.25 ? '#ffd166' : '#ff6a5a'; ctx.fillText(txt, cx + 14, py + 0.5);
  const top = cy + bob - (u.type === 'giant' ? 52 : u.type === 'rider' || u.type === 'knight' ? 42 : 34) - (water ? 4 : 0);
  if (u.vet) { ctx.font = '13px system-ui,sans-serif'; ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#5a3d00'; ctx.lineWidth = 2.5; ctx.strokeText('★', cx, top); ctx.fillText('★', cx, top); }
  if (!demoMode && u.owner === G.view && G.cur === G.view && !u.attacked && !busy) circle(cx - 14, py, 3.2, '#6dff8a', '#0b1220', 1.2);
}

/* particles */
const BURSTS = {
  hit:     { n: 10, cols: ['#ffd166', '#ff8c42', '#fff1c1'], sp: 1.7, g: 0.07, s: 2.2, up: 0.6 },
  death:   { n: 16, cols: ['#e2e6ee', '#aab3c2', '#ffffff'], sp: 1.1, g: -0.015, s: 3.6, up: 0.3 },
  capture: { n: 28, cols: null, sp: 2.3, g: 0.08, s: 2.6, up: 2.2, confetti: true },
  level:   { n: 18, cols: ['#ffe27a', '#fff6c9', '#ffd54a'], sp: 1.1, g: -0.035, s: 2.2, up: 0.8 },
  work:    { n: 10, cols: ['#8fe39a', '#c9f2a8', '#ffffff'], sp: 1.1, g: -0.02, s: 2, up: 0.6 },
  train:   { n: 12, cols: ['#ffffff', '#dfe7f2'], sp: 1, g: -0.012, s: 3, up: 0.2 },
  splash:  { n: 12, cols: ['#ffffff', '#bfe6ff', '#8fd0ff'], sp: 1.6, g: 0.1, s: 2, up: 1.6 },
};
function burst(x, y, kind, color) {
  if (!G || !inb(x, y) || !seenByView(x, y)) return;
  const c = BURSTS[kind], now = performance.now();
  const wx = wxOf(x, y), wy = wyOf(x, y) + TH / 2 - 12 + (isWater(T(x, y)) ? WOFF : 0);
  const cols = c.cols || [color || '#ffffff', '#ffd54a', '#ffffff', '#ff7aa8'];
  for (let i = 0; i < c.n; i++) {
    const a = Math.random() * Math.PI * 2, v = c.sp * (0.4 + Math.random());
    parts.push({ x: wx, y: wy, vx: Math.cos(a) * v * 1.5, vy: Math.sin(a) * v * 0.8 - c.up, g: c.g, t0: now, life: 550 + Math.random() * 500,
      c: cols[i % cols.length], s: c.s * (0.6 + Math.random() * 0.8), conf: !!c.confetti, rot: Math.random() * 6 });
  }
  if (parts.length > 600) parts = parts.slice(-600);
}
function drawParticles(now) {
  parts = parts.filter(p => now - p.t0 < p.life);
  for (const p of parts) {
    p.x += p.vx; p.y += p.vy; p.vy += p.g; p.vx *= 0.98; p.rot += 0.2;
    ctx.globalAlpha = Math.max(0, 1 - (now - p.t0) / p.life);
    if (p.conf) { ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s, -p.s / 2, p.s * 2, p.s); ctx.restore(); }
    else circle(p.x, p.y, p.s, p.c);
  }
  ctx.globalAlpha = 1;
}

/* the menu's living backdrop */
function makeDemo() {
  const tribes = [0, 1, 2, 3, 4, 5].sort(() => Math.random() - 0.5).slice(0, 4);
  const d = newGame({ slots: tribes.map(t => ({ tribe: t, ai: true })), n: 16, mapType: 'continents', mode: 'domination', diff: 'normal', seed: (Math.random() * 2 ** 31) | 0 });
  const saved = G;
  G = d;
  try {
    const caps = cityTiles();
    for (const c of caps) { c.b.level = 3 + rndInt(3); c.b.wall = Math.random() < 0.5; c.b.border = 1; }
    for (let y = 0; y < d.n; y++) for (let x = 0; x < d.n; x++) {
      const tl = T(x, y);
      if (tl.b && tl.b.kind === 'village' && Math.random() < 0.7) {
        const near = caps.reduce((a, c) => (cheb(c, { x, y }) < cheb(a, { x, y }) ? c : a));
        tl.b = { kind: 'city', owner: near.b.owner, level: 1 + rndInt(3), pop: 0, capital: false, name: cityName(), workshop: 0, park: 0, wall: false, border: 0 };
      }
    }
    const own = computeOwners();
    for (let y = 0; y < d.n; y++) for (let x = 0; x < d.n; x++) {
      const tl = T(x, y);
      if (own[y][x] < 0 || tl.b) continue;
      if (tl.res === 'crop' && Math.random() < 0.6) { tl.res = null; tl.imp = 'farm'; }
      else if (tl.t === 'mountain' && Math.random() < 0.5) tl.imp = 'mine';
      else if (tl.res === 'forest' && Math.random() < 0.3) tl.imp = 'lumber';
      else if (tl.t === 'water' && !tl.res && Math.random() < 0.12) tl.imp = 'port';
    }
    d.players.forEach(p => { p.techs = Object.keys(TECHS); });
    const types = ['warrior', 'rider', 'archer', 'defender', 'swordsman', 'knight', 'catapult'];
    for (let k = 0; k < 400 && d.units.length < 34; k++) {
      const x = rndInt(d.n), y = rndInt(d.n), tl = T(x, y);
      if (unitAt(x, y) || tl.t === 'mountain' || tl.t === 'ocean' || (tl.t === 'water' && Math.random() < 0.7)) continue;
      const near = caps.reduce((a, c) => (cheb(c, { x, y }) < cheb(a, { x, y }) ? c : a));
      const type = Math.random() < 0.04 ? 'giant' : types[rndInt(types.length)];
      d.units.push({ id: d.nextId++, type, owner: near.b.owner, x, y, hp: Math.max(3, UNITS[type].hp - rndInt(6)), moved: false, attacked: false, kills: 0, vet: Math.random() < 0.15 });
    }
    d.vis[0] = d.vis[0].map(r => r.map(() => 2));
  } finally { G = saved; }
  return d;
}

function drawWorld(now, demoMode) {
  const n = G.n, V = G.vis[G.view], own = computeOwners();
  labels.length = 0;
  const pulse = 0.5 + 0.5 * Math.sin(now / 250);
  const selU = !demoMode && sel && sel.kind === 'unit' ? unitById(sel.id) : null;
  const selX = demoMode ? -9 : selU ? selU.x : sel ? sel.x : -9, selY = demoMode ? -9 : selU ? selU.y : sel ? sel.y : -9;
  const moveSet = new Set(demoMode ? [] : selMoves.map(m => m.x + ',' + m.y));
  const targetSet = new Set(demoMode ? [] : selTargets.map(e => e.x + ',' + e.y));
  // only draw what is on screen
  const vx0 = cam.x - W / 2 / cam.z - TW, vx1 = cam.x + W / 2 / cam.z + TW;
  const vy0 = cam.y - H / 2 / cam.z - TH * 3, vy1 = cam.y + H / 2 / cam.z + TH * 2;
  const onScreen = (x, y) => { const wx = wxOf(x, y), wy = wyOf(x, y); return wx > vx0 && wx < vx1 && wy > vy0 && wy < vy1; };
  const clouds = [];

  // pass 1: the sea
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, tl = T(x, y);
    if (V[y][x] === 0 || !isWater(tl) || !onScreen(x, y)) continue;
    drawWater(x, y, wxOf(x, y), wyOf(x, y) + WOFF, tl.t === 'ocean', now);
  }
  // pass 2: land, borders, objects and units, back to front
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x;
    if (!onScreen(x, y)) continue;
    const v = V[y][x];
    if (v === 0) { clouds.push([x, y]); continue; }
    const tl = T(x, y), water = isWater(tl), cl = climateOf(tl), key = x + ',' + y;
    const wx = wxOf(x, y), wy = wyOf(x, y) + (water ? WOFF : 0);
    if (!water) { drawLand(wx, wy, cl); if (tl.imp === 'farm') drawFarm(wx, wy); }
    const o = own[y][x];
    if (o >= 0) {
      const col = G.players[o].color;
      diamond(wx, wy, col + '1e');
      const ov = (xx, yy) => (inb(xx, yy) ? own[yy][xx] : -2);
      const i = 2, top = [wx, wy + i], right = [wx + TW / 2 - i * 2, wy + TH / 2], bot = [wx, wy + TH - i], left = [wx - TW / 2 + i * 2, wy + TH / 2];
      ctx.beginPath();
      if (ov(x, y - 1) !== o) { ctx.moveTo(...top); ctx.lineTo(...right); }
      if (ov(x + 1, y) !== o) { ctx.moveTo(...right); ctx.lineTo(...bot); }
      if (ov(x, y + 1) !== o) { ctx.moveTo(...bot); ctx.lineTo(...left); }
      if (ov(x - 1, y) !== o) { ctx.moveTo(...left); ctx.lineTo(...top); }
      ctx.strokeStyle = shade(col, -0.3); ctx.lineWidth = 4; ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.stroke();
    }
    if (moveSet.has(key)) diamond(wx, wy, 'rgba(255,255,255,.13)', 'rgba(255,255,255,.35)', 1, 3);
    if (targetSet.has(key)) diamond(wx, wy, `rgba(255,60,40,${0.18 + 0.16 * pulse})`, '#ff5a3c', 2, 2);
    if (hover && hover.x === x && hover.y === y) diamond(wx, wy, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.6)', 1.2, 1);
    if (x === selX && y === selY) {
      const c = [[wx, wy], [wx + TW / 2, wy + TH / 2], [wx, wy + TH], [wx - TW / 2, wy + TH / 2]];
      ctx.strokeStyle = '#ffe27a'; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const p = c[k], a = c[(k + 3) % 4], b = c[(k + 1) % 4];
        ctx.moveTo(p[0] + (a[0] - p[0]) * 0.3, p[1] + (a[1] - p[1]) * 0.3); ctx.lineTo(p[0], p[1]); ctx.lineTo(p[0] + (b[0] - p[0]) * 0.3, p[1] + (b[1] - p[1]) * 0.3);
      }
      ctx.stroke();
    }
    if (v === 1) diamond(wx, wy, 'rgba(10,22,44,.38)');

    const cx = wx, cy = wy + TH / 2;
    if (v === 1) ctx.globalAlpha = 0.72;
    if (tl.t === 'mountain') drawMountain(cx, cy, cl, tl.imp === 'mine');
    else if (tl.res === 'forest') drawForest(x, y, cx, cy, cl, tl.imp === 'lumber');
    else if (tl.res === 'fruit') drawFruit(cx, cy, cl);
    else if (tl.res === 'animal') drawAnimal(cx, cy, cl);
    else if (tl.res === 'crop') drawCrop(cx, cy);
    else if (tl.res === 'fish') drawFish(cx, cy, now);
    else if (!water && !tl.b && !tl.imp) drawTufts(x, y, cx, cy, cl);
    if (tl.imp === 'port') drawPort(cx, cy, now);
    if (tl.b) drawBuilding(wx, wy, tl.b, now);
    ctx.globalAlpha = 1;
    if (moveSet.has(key)) {
      const gold = isCapturable(tl, G.view);
      circle(cx, cy, 4.5 + pulse * 1.3, gold ? '#ffd54a' : 'rgba(255,255,255,.88)', 'rgba(0,0,0,.3)', 1);
    }
    const u = v === 2 ? unitAt(x, y) : null;
    if (u) drawUnit(u, now, demoMode);
    if (targetSet.has(key)) {
      const r = 16 + pulse * 2, ty = cy - 10;
      ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, ty, r, 0, 6.283); ctx.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(cx + dx * (r - 4), ty + dy * (r - 4), cx + dx * (r + 4), ty + dy * (r + 4));
    }
  }

  drawParticles(now);

  // city name plates
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of labels) {
    ctx.font = '800 9.5px Nunito, system-ui, sans-serif';
    const tw = ctx.measureText(l.text).width, w = tw + 22;
    pill(l.x - w / 2, l.y - 6.5, w, 13, 'rgba(11,18,32,.84)');
    circle(l.x + w / 2 - 7, l.y, 5.2, l.color, '#0b1220', 1);
    ctx.fillStyle = '#fff'; ctx.fillText(l.text, l.x - 5, l.y + 0.5);
    ctx.font = '800 8px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#0b1220'; ctx.fillText(String(l.level), l.x + w / 2 - 7, l.y + 0.5);
  }

  // clouds over the unexplored world and a ring of them around its edge
  for (let s = -4; s <= 2 * n + 2; s++) for (let x = s - n - 1; x <= n + 1; x++) {
    const y = s - x;
    if (x < -2 || y < -2 || y > n + 1 || (x >= 0 && y >= 0 && x < n && y < n)) continue;
    if (onScreen(x, y)) clouds.push([x, y]);
  }
  clouds.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  drawClouds(clouds, now);

  // floating numbers
  fx = fx.filter(f => now - f.t0 < 1200);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const f of fx) {
    if (!inb(f.x, f.y) || V[f.y][f.x] !== 2) continue;
    const t = (now - f.t0) / 1200;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = '17px "Lilita One", system-ui, sans-serif';
    const px = wxOf(f.x, f.y), py = wyOf(f.x, f.y) - 16 - t * 30;
    ctx.strokeStyle = '#0b1220'; ctx.lineWidth = 4; ctx.strokeText(f.text, px, py);
    ctx.fillStyle = f.color; ctx.fillText(f.text, px, py);
  }
  ctx.globalAlpha = 1;
}

function draw(now) {
  requestAnimationFrame(draw);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = bgGrad || '#0b2746'; ctx.fillRect(0, 0, W, H);
  const menuOpen = !$('menu').hidden;
  const useDemo = !G || (G.over && menuOpen);
  if (useDemo && !demo) demo = makeDemo();
  const realG = G, realCam = cam;
  if (useDemo) {
    G = demo;
    const n = demo.n;
    cam = { x: Math.sin(now / 9000) * n * 7, y: n * 16 + 16 + Math.cos(now / 11000) * n * 3, z: Math.min(W, H) < 600 ? 0.72 : 1.05 };
  } else {
    if (camGoal) {
      cam.x += (camGoal.x - cam.x) * 0.16; cam.y += (camGoal.y - cam.y) * 0.16;
      if (camGoal.z) cam.z += (camGoal.z - cam.z) * 0.08;
      if (Math.abs(camGoal.x - cam.x) + Math.abs(camGoal.y - cam.y) < 0.5 && (!camGoal.z || Math.abs(camGoal.z - cam.z) < 0.005)) camGoal = null;
    }
    const lim = G.n * TW / 2;
    cam.x = Math.max(-lim, Math.min(lim, cam.x)); cam.y = Math.max(-TH * 2, Math.min(G.n * TH + TH * 2, cam.y));
  }
  try {
    ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.x * cam.z), dpr * (H / 2 - cam.y * cam.z));
    drawWorld(now, useDemo);
  } finally { G = realG; cam = realCam; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
}

/* ---------- input ---------- */
function onTap(mx, my) {
  if (!G || G.over) return;
  const { x, y } = pick(mx, my);
  if (!inb(x, y)) { select(null); return; }
  const V = G.vis[G.view];
  if (V[y][x] === 0) { select({ kind: 'tile', x, y }); return; }
  if (canAct() && sel && sel.kind === 'unit') {
    const u = unitById(sel.id);
    if (u && u.owner === G.view) {
      if (selMoves.some(m => m.x === x && m.y === y)) { doMove(u, x, y); refreshSel(); ui(); return; }
      const tg = selTargets.find(e => e.x === x && e.y === y);
      if (tg) { attack(u, tg); refreshSel(); ui(); return; }
    }
  }
  const un = V[y][x] === 2 ? unitAt(x, y) : null;
  if (un && un.owner === G.view && !(sel && sel.kind === 'unit' && sel.id === un.id)) select({ kind: 'unit', id: un.id });
  else select({ kind: 'tile', x, y }); // tapping a selected unit again shows the tile beneath it
}

const pointers = new Map();
let dragMoved = 0, pinchDist = 0;
cv.addEventListener('pointerdown', e => {
  cv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  dragMoved = 0; pinchDist = 0;
});
cv.addEventListener('pointermove', e => {
  const p = pointers.get(e.pointerId);
  if (!p) { if (G) hover = pick(e.clientX, e.clientY); return; }
  if (pointers.size === 1) {
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    if (dragMoved > 6) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; camGoal = null; }
  } else if (pointers.size === 2) {
    dragMoved = 99;
    const other = [...pointers.entries()].find(([id]) => id !== e.pointerId)[1];
    const d = Math.hypot(e.clientX - other.x, e.clientY - other.y);
    if (pinchDist) zoomAt(d / pinchDist, (e.clientX + other.x) / 2, (e.clientY + other.y) / 2);
    pinchDist = d;
  }
  p.x = e.clientX; p.y = e.clientY;
});
function endPointer(e, tap) {
  if (!pointers.has(e.pointerId)) return;
  pointers.delete(e.pointerId);
  if (tap && pointers.size === 0 && dragMoved <= 6) onTap(e.clientX, e.clientY);
  pinchDist = 0;
}
cv.addEventListener('pointerup', e => endPointer(e, true));
cv.addEventListener('pointercancel', e => endPointer(e, false));
cv.addEventListener('pointerleave', () => { hover = null; });
function zoomAt(f, sx, sy) { // keep the point under the cursor still
  const nz = Math.min(2.2, Math.max(0.35, cam.z * f));
  const wx = (sx - W / 2) / cam.z + cam.x, wy = (sy - H / 2) / cam.z + cam.y;
  cam.z = nz; cam.x = wx - (sx - W / 2) / nz; cam.y = wy - (sy - H / 2) / nz; camGoal = null;
}
cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.1 : 1 / 1.1, e.clientX, e.clientY); }, { passive: false });
addEventListener('resize', resize);
addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (!$('help').hidden) { $('help').hidden = true; return; }
    if (!$('tech').hidden) { $('tech').hidden = true; return; }
    if (G) select(null);
    return;
  }
  if (!G || !$('menu').hidden || e.target.tagName === 'SELECT') return;
  const k = e.key.toLowerCase();
  if (k === 'e') endTurn();
  else if (k === 'n') nextUnit();
  else if (k === 't') toggleTech();
});

/* ---------- menus ---------- */
const MAX_TRIBES = { 12: 4, 16: 6, 20: 6, 24: 6 };
let slots = [{ tribe: 0, ai: false }, { tribe: 1, ai: true }, { tribe: 2, ai: true }];
function renderSlots() {
  const n = +$('opt-size').value;
  const max = MAX_TRIBES[n] || 6;
  const want = Math.min(+$('opt-count').value, max);
  [...$('opt-count').options].forEach(o => { o.disabled = +o.value > max; });
  $('opt-count').value = String(want);
  while (slots.length < want) {
    const used = slots.map(s => s.tribe);
    slots.push({ tribe: TRIBES.findIndex((_, i) => !used.includes(i)), ai: true });
  }
  slots.length = want;
  $('slots').innerHTML = slots.map((s, i) => `
    <div class="slot">
      <span class="dot" style="background:${TRIBES[s.tribe].color}"></span>
      <select id="slot-tribe-${i}" data-i="${i}" class="slot-tribe" aria-label="Tribe for player ${i + 1}">
        ${TRIBES.map((t, k) => `<option value="${k}" ${k === s.tribe ? 'selected' : ''}>${t.name} · ${TECHS[t.tech].name}</option>`).join('')}
      </select>
      ${i === 0 ? '<span class="you">You</span>' : `<select id="slot-ctrl-${i}" data-i="${i}" class="slot-ctrl" aria-label="Controller for player ${i + 1}">
        <option value="ai" ${s.ai ? 'selected' : ''}>Computer</option><option value="human" ${s.ai ? '' : 'selected'}>Human (pass &amp; play)</option></select>`}
    </div>`).join('');
  $('tribe-about').textContent = `${TRIBES[slots[0].tribe].name}: ${TRIBES[slots[0].tribe].about}. Starts with ${TECHS[TRIBES[slots[0].tribe].tech].name}.`;
}
$('slots').addEventListener('change', e => {
  const i = +e.target.dataset.i;
  if (e.target.classList.contains('slot-tribe')) {
    const k = +e.target.value, other = slots.findIndex((s, j) => j !== i && s.tribe === k);
    if (other >= 0) slots[other].tribe = slots[i].tribe; // swap so every tribe stays unique
    slots[i].tribe = k;
  } else slots[i].ai = e.target.value === 'ai';
  renderSlots();
});
$('opt-size').onchange = renderSlots;
$('opt-count').onchange = renderSlots;

let bannerTimer = 0;
function banner(title, sub, color) {
  const el = $('banner');
  $('banner-title').textContent = title; $('banner-title').style.color = color || '';
  $('banner-sub').textContent = sub || '';
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => { el.hidden = true; }, 2000);
}
function showGame(show) { $('hud').hidden = !show; $('panel').hidden = !show; $('menu').hidden = show; }
function focusHome(instant) {
  const c = cityTiles(G.view)[0] || G.units.find(u => u.owner === G.view);
  if (!c) return;
  const goal = { x: wxOf(c.x, c.y), y: wyOf(c.x, c.y) + TH / 2 };
  if (instant) { cam.x = goal.x; cam.y = goal.y; camGoal = null; } else camGoal = goal;
}
function begin(state, resumed) {
  G = state; busy = false; sel = null; selMoves = []; selTargets = []; fx = []; parts = []; anims.clear(); hitAnims.clear();
  if (G.tiles[0][0].c === undefined) { // saves from before climates existed
    const caps = cityTiles();
    for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) {
      const near = caps.reduce((a, c) => (!a || cheb(c, { x, y }) < cheb(a, { x, y }) ? c : a), null);
      T(x, y).c = near ? G.players[near.b.owner].tribe : 0;
    }
  }
  ['gameover', 'reward', 'pass', 'tech', 'help'].forEach(id => { $(id).hidden = true; });
  if (G.players[G.cur].ai) { // restored mid-way through the computer's turn
    updateVis(); focusHome(true); cam.z = W < 700 ? 0.8 : 1.05; showGame(true); ui();
    runTurns(true);
    return;
  }
  G.view = G.cur;
  updateVis(); focusHome(true); showGame(true); ui();
  const z = W < 700 ? 0.8 : 1.05;
  cam.z = z * 0.55; camGoal = { x: cam.x, y: cam.y, z };
  if (humanCount() > 1) showPass();
  else {
    banner(G.turn === 1 && !resumed ? G.players[G.cur].name : `Turn ${G.turn}`, G.turn === 1 && !resumed ? TRIBES[G.players[G.cur].tribe].about : 'Welcome back', G.players[G.cur].color);
    showReward();
  }
}
$('btn-new').onclick = () => {
  const cfg = {
    slots: slots.map(s => ({ ...s })), n: +$('opt-size').value, mapType: $('opt-map').value,
    mode: $('opt-mode').value, diff: $('opt-diff').value, seed: (Math.random() * 2 ** 31) | 0,
  };
  const s = newGame(cfg);
  G = s; startTurn(0);
  begin(s, false);
  save();
};
$('btn-continue').onclick = () => { const s = loadSave(); if (s) begin(s, true); };
$('btn-resume').onclick = () => showGame(true);
$('btn-menu').onclick = () => { $('menu').hidden = false; refreshMenu(); };
$('btn-end').onclick = endTurn;
$('btn-next').onclick = nextUnit;
function toggleTech() { if (!G || G.over) return; $('tech').hidden = !$('tech').hidden; if (!$('tech').hidden) renderTech(); }
$('btn-tech').onclick = toggleTech;
$('btn-tech-close').onclick = () => { $('tech').hidden = true; };
$('btn-sound').onclick = () => {
  muted = !muted;
  try { localStorage.setItem('polyweb-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!muted) sfx('click');
  ui();
};
const openHelp = () => { $('help').hidden = false; };
$('btn-help').onclick = openHelp;
$('link-help').onclick = e => { e.preventDefault(); openHelp(); };
$('btn-help-close').onclick = () => { $('help').hidden = true; };
$('btn-again').onclick = () => { $('gameover').hidden = true; showGame(false); refreshMenu(); };
$('btn-view').onclick = () => { $('gameover').hidden = true; };
function refreshMenu() {
  $('btn-continue').hidden = !loadSave();
  $('btn-resume').hidden = !(G && !G.over);
}

/* ---------- boot ---------- */
resize(); renderSlots(); refreshMenu(); requestAnimationFrame(draw);
// Keep a game in progress when this page is hot-reloaded inside an artifact viewer.
window.claude?.hot?.snapshot?.(() => (G && !G.over ? { G } : {}));
function start(data) { if (data && data.G && data.G.v === 2) begin(data.G, true); }
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
