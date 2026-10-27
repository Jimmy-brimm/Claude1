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

  const tiles = g.map(row => row.map(v => ({ t: v ? 'land' : 'water', res: null, b: null, imp: null })));
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
  u.x = x; u.y = y; u.moved = true;
  const tl = T(x, y);
  if (tl.b && tl.b.kind === 'village') {
    tl.b = { kind: 'city', owner: u.owner, level: 1, pop: 0, capital: false, name: cityName(), workshop: 0, park: 0, wall: false, border: 0 };
    u.attacked = true;
    sfxAt('capture', x, y);
    tellOwner(u.owner, `${tl.b.name} joined your tribe! 🏙️`);
  } else if (tl.b && tl.b.kind === 'ruin') {
    u.attacked = true;
    ruinReward(u, x, y);
  } else if (tl.b && tl.b.owner !== u.owner) {
    const prev = tl.b.owner;
    tl.b.owner = u.owner; tl.b.pop = 0; tl.b.capital = false;
    u.attacked = true;
    sfxAt('capture', x, y);
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
  sfxAt('tech', x, y);
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
  const r = combatCalc(a, d, cheb(a, d));
  d.hp -= r.dmg; popFx(d.x, d.y, '-' + r.dmg, '#ff6a5a');
  if (r.counter) { a.hp -= r.counter; popFx(a.x, a.y, '-' + r.counter, '#ffb35a'); }
  a.attacked = true; a.moved = true;
  sfxAt('attack', d.x, d.y);
  if (d.hp <= 0) {
    G.units = G.units.filter(u => u !== d);
    credit(a);
    // melee winners advance into the empty tile, like in the board-game classics
    const tl = T(d.x, d.y);
    if (a.hp > 0 && stats(a).range === 1 && canEnter(a.owner, tl) && !isCapturable(tl, a.owner) && isWater(tl) === isWater(T(a.x, a.y))) {
      anims.set(a.id, { x0: a.x, y0: a.y, t0: performance.now() });
      a.x = d.x; a.y = d.y;
    }
  }
  if (a.hp <= 0) { G.units = G.units.filter(u => u !== a); if (d.hp > 0) credit(d); }
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
  sfxAt('train', c.x, c.y);
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
  sfxAt('work', x, y);
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
    sfxAt('level', c.x, c.y);
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
  else { focusHome(true); toast(`Turn ${G.turn}: your move (+${income(p)} ⭐)`); showReward(); }
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
  toast(`${G.players[G.cur].name}: your move (+${income(G.cur)} ⭐)`);
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
function resize() {
  dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
}
const wxOf = (x, y) => (x - y) * TW / 2;
const wyOf = (x, y) => (x + y) * TH / 2;
function pick(mx, my) {
  const wx = (mx - W / 2) / cam.z + cam.x, wy = (my - H / 2) / cam.z + cam.y;
  const a = wx / (TW / 2), b = (wy - TH / 2) / (TH / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}
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
function poly(pts, fill, stroke) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}
function circle(x, y, r, fill, stroke, lw) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.stroke(); }
}

function drawTree(cx, cy, s) {
  ctx.fillStyle = '#6b4a2b'; ctx.fillRect(cx - 1.5 * s, cy - 2 * s, 3 * s, 5 * s);
  poly([[cx - 8 * s, cy - 1 * s], [cx, cy - 16 * s], [cx + 8 * s, cy - 1 * s]], '#2f7d3b');
  poly([[cx - 6 * s, cy - 8 * s], [cx, cy - 22 * s], [cx + 6 * s, cy - 8 * s]], '#3b9a4a');
}
function drawMountain(cx, cy, mine) {
  poly([[cx - 26, cy + 8], [cx - 4, cy - 28], [cx + 20, cy + 8]], '#8d96a3', '#6f7886');
  poly([[cx - 4, cy - 28], [cx + 20, cy + 8], [cx + 4, cy + 8]], '#6f7886');
  poly([[cx - 4, cy - 28], [cx - 11, cy - 15], [cx - 4, cy - 18], [cx + 2, cy - 14]], '#f2f6fb');
  poly([[cx + 6, cy + 8], [cx + 18, cy - 10], [cx + 30, cy + 8]], '#a0a9b5', '#7e8794');
  if (mine) {
    ctx.fillStyle = '#7a5230'; ctx.fillRect(cx - 13, cy - 7, 14, 14);
    ctx.fillStyle = '#1c1410'; ctx.beginPath(); ctx.arc(cx - 6, cy + 7, 5.5, Math.PI, 0); ctx.fill(); ctx.fillRect(cx - 11.5, cy + 2, 11, 5);
    circle(cx + 8, cy + 6, 2.5, '#e2b13c');
  }
}
function drawFruit(cx, cy) {
  circle(cx, cy - 4, 11, '#3f9a4d'); circle(cx - 4, cy - 8, 7, '#4cb35c');
  for (const [dx, dy] of [[-5, -4], [4, -7], [3, 0]]) circle(cx + dx, cy + dy, 2.6, '#e8403a', '#8c1d18', 0.8);
}
function drawAnimal(cx, cy) {
  ctx.fillStyle = '#a8703a'; ctx.beginPath(); ctx.ellipse(cx, cy - 6, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a5a2c';
  for (const dx of [-6, -2, 3, 7]) ctx.fillRect(cx + dx - 1, cy - 3, 2, 8);
  circle(cx + 10, cy - 12, 4, '#a8703a');
  ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx + 9, cy - 15); ctx.lineTo(cx + 7, cy - 22); ctx.moveTo(cx + 12, cy - 15); ctx.lineTo(cx + 14, cy - 22); ctx.stroke();
}
function drawCrop(cx, cy) {
  ctx.strokeStyle = '#c99a2e'; ctx.lineWidth = 1.4;
  for (const [dx, dy] of [[-10, 2], [-4, -2], [3, 3], [9, -1], [-2, 6], [6, 7]]) {
    ctx.beginPath(); ctx.moveTo(cx + dx, cy + dy); ctx.lineTo(cx + dx, cy + dy - 11); ctx.stroke();
    ctx.fillStyle = '#f0c95a'; ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy - 12, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
  }
}
function drawFarm(wx, wy) {
  diamond(wx, wy, '#d8bf5a', null, 0, 4);
  ctx.save(); diamondPath(wx, wy, 4); ctx.clip();
  ctx.strokeStyle = '#a8852f'; ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(wx - 32 + i * 10, wy + 16 - 16); ctx.lineTo(wx + i * 10, wy + 32); ctx.stroke(); }
  ctx.restore();
}
function drawFish(cx, cy) {
  for (const [dx, dy, s] of [[-7, -1, 1], [6, 4, 0.8]]) {
    ctx.fillStyle = '#d8eefc';
    ctx.beginPath(); ctx.ellipse(cx + dx, cy + dy, 6 * s, 3 * s, 0, 0, Math.PI * 2); ctx.fill();
    poly([[cx + dx + 5 * s, cy + dy], [cx + dx + 10 * s, cy + dy - 3 * s], [cx + dx + 10 * s, cy + dy + 3 * s]], '#d8eefc');
  }
}
function drawPort(cx, cy) {
  ctx.fillStyle = '#8a5a2c';
  poly([[cx - 16, cy + 2], [cx, cy - 6], [cx + 16, cy + 2], [cx, cy + 10]], '#9b6a3a', '#6b4a2b');
  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(cx + 4, cy); ctx.lineTo(cx + 4, cy - 22); ctx.stroke();
  poly([[cx + 5, cy - 21], [cx + 15, cy - 6], [cx + 5, cy - 6]], '#f4efe2');
}
function drawRuin(cx, cy) {
  ctx.fillStyle = '#9a9488'; ctx.fillRect(cx - 12, cy - 16, 6, 18); ctx.fillRect(cx + 6, cy - 12, 6, 14);
  ctx.fillStyle = '#b5afa2'; ctx.fillRect(cx - 14, cy - 19, 16, 4);
  ctx.fillStyle = '#7d776c'; ctx.fillRect(cx - 3, cy + 1, 7, 4); ctx.fillRect(cx + 12, cy + 2, 5, 3);
  ctx.fillStyle = '#58c0ff'; ctx.beginPath(); ctx.arc(cx - 1, cy - 4, 2, 0, Math.PI * 2); ctx.fill();
}
function drawHut(cx, cy, wall, roof, s) {
  ctx.fillStyle = wall; ctx.fillRect(cx - 7 * s, cy - 8 * s, 14 * s, 10 * s);
  poly([[cx - 9 * s, cy - 8 * s], [cx, cy - 17 * s], [cx + 9 * s, cy - 8 * s]], roof);
  ctx.fillStyle = '#0006'; ctx.fillRect(cx - 2 * s, cy - 4 * s, 4 * s, 6 * s);
}
function drawBuilding(wx, wy, b) {
  const cx = wx, cy = wy + TH / 2;
  if (b.kind === 'village') { drawHut(cx - 9, cy + 1, '#d9c9a3', '#8b5a2b', 1); drawHut(cx + 9, cy + 3, '#cdbb92', '#7a4c22', 0.9); return; }
  if (b.kind === 'ruin') { drawRuin(cx, cy); return; }
  const col = G.players[b.owner].color;
  if (b.wall) diamond(wx, wy, null, '#c9c0ad', 4, 4);
  drawHut(cx - 12, cy + 3, '#e6e0d0', col, 1);
  drawHut(cx + 12, cy + 3, '#e6e0d0', col, 1);
  const lv = Math.min(b.level, 6), h = 12 + lv * 4;
  ctx.fillStyle = '#f2ecdc'; ctx.fillRect(cx - 8, cy - h, 16, h + 2);
  poly([[cx - 11, cy - h], [cx, cy - h - 11], [cx + 11, cy - h]], col);
  ctx.fillStyle = '#0005'; ctx.fillRect(cx - 2.5, cy - 7, 5, 9);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - h - 11); ctx.lineTo(cx, cy - h - 21); ctx.stroke();
  poly([[cx, cy - h - 21], [cx + 9, cy - h - 18], [cx, cy - h - 15]], col);
  labels.push({ x: cx, y: cy + 20, text: `${b.capital ? '★ ' : ''}${b.name} ${b.level}`, color: col });
}
function drawUnit(u, now) {
  let gx = u.x, gy = u.y;
  const an = anims.get(u.id);
  if (an) {
    const t = Math.min(1, (now - an.t0) / 200);
    if (t >= 1) anims.delete(u.id);
    const e = t * (2 - t);
    gx = an.x0 + (u.x - an.x0) * e; gy = an.y0 + (u.y - an.y0) * e;
  }
  const water = isWater(T(u.x, u.y));
  const cx = wxOf(gx, gy), cy = wyOf(gx, gy) + TH / 2 + 2 + (water ? WOFF : 0), pl = G.players[u.owner];
  const isSel = sel && sel.kind === 'unit' && sel.id === u.id;
  const bob = isSel ? Math.sin(now / 160) * 2 : water ? Math.sin(now / 400 + u.id) * 1.5 : 0;
  const R = u.type === 'giant' ? 17 : 13;
  if (water) {
    poly([[cx - 17, cy - 8 + bob], [cx + 17, cy - 8 + bob], [cx + 11, cy + 2 + bob], [cx - 11, cy + 2 + bob]], '#7a4d2a', '#4a2f1a');
    if (hasTech(u.owner, 'navigation')) {
      ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx + 12, cy - 8 + bob); ctx.lineTo(cx + 12, cy - 36 + bob); ctx.stroke();
      poly([[cx + 13, cy - 35 + bob], [cx + 24, cy - 14 + bob], [cx + 13, cy - 14 + bob]], '#f4efe2');
    }
  } else { ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(cx, cy, R, 6, 0, 0, Math.PI * 2); ctx.fill(); }
  const done = u.owner === G.view && G.cur === G.view && u.moved && u.attacked;
  ctx.globalAlpha = done ? 0.6 : 1;
  circle(cx, cy - R + bob, R, pl.color, isSel ? '#fff' : '#0b1220', isSel ? 3 : 2);
  ctx.font = `${u.type === 'giant' ? 20 : 15}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(UNITS[u.type].icon, cx, cy - R + 1 + bob);
  ctx.globalAlpha = 1;
  const f = Math.max(0, u.hp / maxHp(u));
  ctx.fillStyle = '#000b'; ctx.fillRect(cx - 13, cy + 5, 26, 5);
  ctx.fillStyle = f > 0.5 ? '#4cd964' : f > 0.25 ? '#ffcc33' : '#ff5a4a'; ctx.fillRect(cx - 12, cy + 6, 24 * f, 3);
  if (u.vet) { ctx.font = 'bold 11px system-ui,sans-serif'; ctx.fillStyle = '#ffe27a'; ctx.fillText('★', cx - R, cy - 2 * R + 2 + bob); }
  if (u.owner === G.view && G.cur === G.view && !u.attacked && !busy) circle(cx + R - 1, cy - 2 * R + 1 + bob, 3.5, '#6dff8a', '#0b1220', 1);
}

function draw(now) {
  requestAnimationFrame(draw);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0d1a2c'); grd.addColorStop(1, '#14304e');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  if (camGoal) {
    cam.x += (camGoal.x - cam.x) * 0.18; cam.y += (camGoal.y - cam.y) * 0.18;
    if (Math.abs(camGoal.x - cam.x) + Math.abs(camGoal.y - cam.y) < 0.5) camGoal = null;
  }
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.x * cam.z), dpr * (H / 2 - cam.y * cam.z));
  const n = G.n, V = G.vis[G.view], own = computeOwners();
  labels.length = 0;
  const pulse = 0.5 + 0.5 * Math.sin(now / 250);
  const selU = sel && sel.kind === 'unit' ? unitById(sel.id) : null;
  const selX = selU ? selU.x : sel ? sel.x : -1, selY = selU ? selU.y : sel ? sel.y : -1;

  // pass 1: sea floor and unexplored tiles
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, wx = wxOf(x, y), wy = wyOf(x, y), v = V[y][x], tl = T(x, y);
    if (v === 0) diamond(wx, wy, '#15223a', '#1c2b46');
    else if (isWater(tl)) {
      const deep = tl.t === 'ocean';
      diamond(wx, wy + WOFF, deep ? ((x + y) % 2 ? '#2a68a8' : '#2c6daf') : ((x + y) % 2 ? '#3b88c9' : '#4190d4'), deep ? '#255f9c' : '#3379b8');
    }
  }
  // pass 2: everything else, back to front
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, v = V[y][x];
    if (v === 0) continue;
    const tl = T(x, y), water = isWater(tl);
    const wx = wxOf(x, y), wy = wyOf(x, y) + (water ? WOFF : 0);
    if (!water) {
      poly([[wx - TW / 2, wy + TH / 2], [wx, wy + TH], [wx, wy + TH + LH], [wx - TW / 2, wy + TH / 2 + LH]], '#6a9a49');
      poly([[wx, wy + TH], [wx + TW / 2, wy + TH / 2], [wx + TW / 2, wy + TH / 2 + LH], [wx, wy + TH + LH]], '#587f3d');
      diamond(wx, wy, tl.t === 'mountain' ? '#93a07f' : ((x * 7 + y * 13) % 3 === 0 ? '#8ecb62' : '#86c35b'), '#6aa44a', 0.5);
      if (tl.imp === 'farm') drawFarm(wx, wy);
    }
    // territory tint and borders (only on edges facing a different owner)
    const o = own[y][x];
    if (o >= 0) {
      const col = G.players[o].color;
      diamond(wx, wy, col + '22');
      ctx.strokeStyle = col; ctx.lineWidth = 2.5;
      const ov = (xx, yy) => (inb(xx, yy) ? own[yy][xx] : -2);
      const i = 2, top = [wx, wy + i], right = [wx + TW / 2 - i * 2, wy + TH / 2], bot = [wx, wy + TH - i], left = [wx - TW / 2 + i * 2, wy + TH / 2];
      ctx.beginPath();
      if (ov(x, y - 1) !== o) { ctx.moveTo(...top); ctx.lineTo(...right); }
      if (ov(x + 1, y) !== o) { ctx.moveTo(...right); ctx.lineTo(...bot); }
      if (ov(x, y + 1) !== o) { ctx.moveTo(...bot); ctx.lineTo(...left); }
      if (ov(x - 1, y) !== o) { ctx.moveTo(...left); ctx.lineTo(...top); }
      ctx.stroke();
    }
    if (selMoves.some(m => m.x === x && m.y === y)) diamond(wx, wy, `rgba(255,255,255,${0.22 + 0.2 * pulse})`, '#fff', 1.5, 3);
    if (selTargets.some(e => e.x === x && e.y === y)) diamond(wx, wy, `rgba(255,70,50,${0.3 + 0.25 * pulse})`, '#ff4a3a', 2, 2);
    if (hover && hover.x === x && hover.y === y) diamond(wx, wy, null, 'rgba(255,255,255,.7)', 1.5, 1);
    if (x === selX && y === selY) diamond(wx, wy, null, '#ffe27a', 2.5, 1);
    if (v === 1) diamond(wx, wy, 'rgba(8,16,32,.4)');

    const cx = wx, cy = wy + TH / 2;
    if (v === 1) ctx.globalAlpha = 0.72;
    if (tl.t === 'mountain') drawMountain(cx, cy, tl.imp === 'mine');
    else if (tl.res === 'forest') {
      drawTree(cx - 12, cy + 2, 1); drawTree(cx + 11, cy + 1, 1);
      if (tl.imp === 'lumber') drawHut(cx + 1, cy + 8, '#b88a55', '#6b4a2b', 0.8); else drawTree(cx, cy + 6, 1.1);
    }
    else if (tl.res === 'fruit') drawFruit(cx, cy);
    else if (tl.res === 'animal') drawAnimal(cx, cy);
    else if (tl.res === 'crop') drawCrop(cx, cy);
    else if (tl.res === 'fish') drawFish(cx, cy);
    if (tl.imp === 'port') drawPort(cx, cy);
    if (tl.b) drawBuilding(wx, wy, tl.b);
    ctx.globalAlpha = 1;
    if (v === 2) { const u = unitAt(x, y); if (u) drawUnit(u, now); }
  }

  // city name plates on top of everything
  ctx.font = 'bold 10.5px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of labels) {
    const w = ctx.measureText(l.text).width + 10;
    ctx.fillStyle = '#0b1220d0'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(l.x - w / 2, l.y - 7, w, 14, 7); else ctx.rect(l.x - w / 2, l.y - 7, w, 14); ctx.fill();
    ctx.fillStyle = l.color; ctx.fillRect(l.x - w / 2 + 5, l.y + 5, w - 10, 1.5);
    ctx.fillStyle = '#fff'; ctx.fillText(l.text, l.x, l.y);
  }

  // floating text
  fx = fx.filter(f => now - f.t0 < 1200);
  for (const f of fx) {
    if (!inb(f.x, f.y) || V[f.y][f.x] !== 2) continue;
    const t = (now - f.t0) / 1200;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = 'bold 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = wxOf(f.x, f.y), py = wyOf(f.x, f.y) - 14 - t * 30;
    ctx.strokeStyle = '#000c'; ctx.lineWidth = 3; ctx.strokeText(f.text, px, py);
    ctx.fillStyle = f.color; ctx.fillText(f.text, px, py);
  }
  ctx.globalAlpha = 1;
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
    if (pinchDist) zoomBy(d / pinchDist);
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
function zoomBy(f) { cam.z = Math.min(2.2, Math.max(0.35, cam.z * f)); }
cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
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

function showGame(show) { $('hud').hidden = !show; $('panel').hidden = !show; $('menu').hidden = show; }
function focusHome(instant) {
  const c = cityTiles(G.view)[0] || G.units.find(u => u.owner === G.view);
  if (!c) return;
  const goal = { x: wxOf(c.x, c.y), y: wyOf(c.x, c.y) + TH / 2 };
  if (instant) { cam.x = goal.x; cam.y = goal.y; camGoal = null; } else camGoal = goal;
}
function begin(state, resumed) {
  G = state; busy = false; sel = null; selMoves = []; selTargets = []; fx = []; anims.clear();
  ['gameover', 'reward', 'pass', 'tech', 'help'].forEach(id => { $(id).hidden = true; });
  if (G.players[G.cur].ai) { // restored mid-way through the computer's turn
    updateVis(); focusHome(true); cam.z = W < 700 ? 0.75 : 1; showGame(true); ui();
    runTurns(true);
    return;
  }
  G.view = G.cur;
  updateVis(); focusHome(true); cam.z = W < 700 ? 0.75 : 1; showGame(true); ui();
  if (humanCount() > 1) showPass();
  else { toast(G.turn === 1 && !resumed ? 'Capture villages, research tech and build an army!' : 'Welcome back!'); showReward(); }
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
