'use strict';
/* Polyweb – a small isometric turn-based strategy game. No dependencies. */

/* ---------- data ---------- */
const TW = 64, TH = 32, LH = 10, WOFF = 7; // tile size, land thickness, how far water sits below land
const SAVE_KEY = 'polyweb-save-v3';
const MAX_LEVEL = 8, AI_DELAY = 170;

const TRIBES = [
  { name: 'Zephyr',  color: '#4a8cff', tech: 'riding',       unit: 'warrior', about: 'Horse-lords of the open plains' },
  { name: 'Ember',   color: '#e8503a', tech: 'hunting',      unit: 'warrior', about: 'Hunters of the deep woods' },
  { name: 'Verdant', color: '#2fbf63', tech: 'organization', unit: 'warrior', about: 'Patient gatherers and farmers' },
  { name: 'Solis',   color: '#f0b429', tech: 'fishing',      unit: 'warrior', about: 'Fisherfolk of the sunny coast' },
  { name: 'Granite', color: '#a070ff', tech: 'climbing',     unit: 'warrior', about: 'Mountain clans who mine the peaks' },
  { name: 'Frost',   color: '#40d0dc', tech: 'archery',      unit: 'archer',  about: 'Sharp-eyed archers of the tundra' },
];

// Unit skills: dash (attack after moving), escape (move after attacking), persist (attack again after a kill),
// fortify (defence bonus in cities), heal (mends neighbours), convert (turns enemies to your side).
const UNITS = {
  warrior:    { name: 'Warrior',     icon: '⚔️', cost: 2, atk: 2,   def: 2, hp: 10, mv: 1, range: 1, tech: null,          skills: ['dash', 'fortify'] },
  rider:      { name: 'Rider',       icon: '🐎', cost: 3, atk: 2,   def: 1, hp: 10, mv: 2, range: 1, tech: 'riding',      skills: ['dash', 'escape', 'fortify'] },
  archer:     { name: 'Archer',      icon: '🏹', cost: 3, atk: 2,   def: 1, hp: 10, mv: 1, range: 2, tech: 'archery',     skills: ['dash', 'fortify'] },
  defender:   { name: 'Defender',    icon: '🛡️', cost: 3, atk: 1,   def: 3, hp: 15, mv: 1, range: 1, tech: 'strategy',    skills: ['fortify'] },
  swordsman:  { name: 'Swordsman',   icon: '🗡️', cost: 5, atk: 3,   def: 3, hp: 15, mv: 1, range: 1, tech: 'smithery',    skills: ['dash'] },
  mindbender: { name: 'Mind Bender', icon: '🔮', cost: 5, atk: 0,   def: 1, hp: 10, mv: 1, range: 1, tech: 'philosophy',  skills: ['heal', 'convert'] },
  catapult:   { name: 'Catapult',    icon: '🎯', cost: 8, atk: 4,   def: 0, hp: 10, mv: 1, range: 3, tech: 'mathematics', skills: [] },
  knight:     { name: 'Knight',      icon: '🏇', cost: 8, atk: 3.5, def: 1, hp: 10, mv: 3, range: 1, tech: 'chivalry',    skills: ['dash', 'persist', 'fortify'] },
  giant:      { name: 'Giant',       icon: '🗿', cost: 0, atk: 5,   def: 4, hp: 40, mv: 1, range: 1, tech: null, train: false, skills: [] },
};
// Units afloat take the shape of their boat; upgrades are bought at sea.
const BOATS = [
  { name: 'Boat',       icon: '⛵', atk: 1, def: 1, mv: 2, range: 2, skills: ['dash'] },
  { name: 'Ship',       icon: '🚢', atk: 2, def: 2, mv: 3, range: 2, skills: ['dash'], cost: 5, tech: 'sailing' },
  { name: 'Battleship', icon: '⚓', atk: 4, def: 3, mv: 3, range: 2, skills: ['dash'], cost: 15, tech: 'navigation' },
];
const SKILL_INFO = {
  dash: 'Dash: can attack after moving', escape: 'Escape: can move after attacking', persist: 'Persist: attacks again after a kill',
  fortify: 'Fortify: defence bonus in cities', heal: 'Heal: mends nearby friends', convert: 'Convert: wins enemies over',
};

const TECHS = {
  riding:       { name: 'Riding',       icon: '🐴', tier: 1, req: null,           desc: 'Train Riders' },
  roads:        { name: 'Roads',        icon: '🛤️', tier: 2, req: 'riding',       desc: 'Build roads that halve movement costs' },
  trade:        { name: 'Trade',        icon: '💰', tier: 3, req: 'roads',        desc: 'Build markets that earn stars from nearby industry' },
  freespirit:   { name: 'Free Spirit',  icon: '🕊️', tier: 2, req: 'riding',       desc: 'Build temples; disbanding refunds half the cost' },
  chivalry:     { name: 'Chivalry',     icon: '🏇', tier: 3, req: 'freespirit',   desc: 'Train Knights' },
  organization: { name: 'Organization', icon: '📜', tier: 1, req: null,           desc: 'Harvest fruit' },
  farming:      { name: 'Farming',      icon: '🌾', tier: 2, req: 'organization', desc: 'Build farms on crops' },
  construction: { name: 'Construction', icon: '🏗️', tier: 3, req: 'farming',      desc: 'Build windmills; burn forests into fields' },
  strategy:     { name: 'Strategy',     icon: '🛡️', tier: 2, req: 'organization', desc: 'Train Defenders' },
  diplomacy:    { name: 'Diplomacy',    icon: '🤝', tier: 3, req: 'strategy',     desc: '+1 star each turn for every tribe you have met' },
  climbing:     { name: 'Climbing',     icon: '🧗', tier: 1, req: null,           desc: 'Move onto mountains and defend there' },
  mining:       { name: 'Mining',       icon: '⛏️', tier: 2, req: 'climbing',     desc: 'Build mines on mountains with metal' },
  smithery:     { name: 'Smithery',     icon: '⚒️', tier: 3, req: 'mining',       desc: 'Train Swordsmen; build forges' },
  meditation:   { name: 'Meditation',   icon: '🧘', tier: 2, req: 'climbing',     desc: 'Build mountain temples' },
  philosophy:   { name: 'Philosophy',   icon: '🔮', tier: 3, req: 'meditation',   desc: 'Train Mind Benders; research costs a third less' },
  fishing:      { name: 'Fishing',      icon: '🎣', tier: 1, req: null,           desc: 'Catch fish; build ports to board boats' },
  sailing:      { name: 'Sailing',      icon: '⛵', tier: 2, req: 'fishing',      desc: 'Boats can cross the ocean and become Ships' },
  navigation:   { name: 'Navigation',   icon: '🧭', tier: 3, req: 'sailing',      desc: 'Ships can become Battleships' },
  whaling:      { name: 'Whaling',      icon: '🐋', tier: 2, req: 'fishing',      desc: 'Hunt whales for 10 stars' },
  aquatism:     { name: 'Aquatism',     icon: '🌊', tier: 3, req: 'whaling',      desc: 'Water temples; boats defend better' },
  hunting:      { name: 'Hunting',      icon: '🦌', tier: 1, req: null,           desc: 'Hunt wild animals' },
  archery:      { name: 'Archery',      icon: '🏹', tier: 2, req: 'hunting',      desc: 'Train Archers; units defend better in forests' },
  spiritualism: { name: 'Spiritualism', icon: '🌳', tier: 3, req: 'archery',      desc: 'Forest temples; grow new forests' },
  forestry:     { name: 'Forestry',     icon: '🪓', tier: 2, req: 'hunting',      desc: 'Build lumber huts; clear forests for a star' },
  mathematics:  { name: 'Mathematics',  icon: '📐', tier: 3, req: 'forestry',     desc: 'Train Catapults; build sawmills' },
};

// Everything a city can do to a tile in its borders. pop: population gained; gain: stars gained.
const plainLand = t => t.t === 'land' && !t.res && !t.imp && !t.b;
const WORKS = {
  fruit:    { label: 'Harvest fruit',  icon: '🍎', tech: 'organization', cost: 2, pop: 1, on: t => t.res === 'fruit' },
  animal:   { label: 'Hunt',           icon: '🦌', tech: 'hunting',      cost: 2, pop: 1, on: t => t.res === 'animal' },
  fish:     { label: 'Fish',           icon: '🐟', tech: 'fishing',      cost: 2, pop: 1, on: t => t.res === 'fish' },
  whale:    { label: 'Whaling',        icon: '🐋', tech: 'whaling',      cost: 0, gain: 10, on: t => t.res === 'whale' },
  farm:     { label: 'Farm',           icon: '🌾', tech: 'farming',      cost: 5, pop: 2, on: t => t.res === 'crop' },
  lumber:   { label: 'Lumber hut',     icon: '🌲', tech: 'forestry',     cost: 3, pop: 1, on: t => t.res === 'forest' && !t.imp },
  clear:    { label: 'Clear forest',   icon: '🪓', tech: 'forestry',     cost: 0, gain: 1, on: t => t.res === 'forest' && !t.imp },
  burn:     { label: 'Burn forest',    icon: '🔥', tech: 'construction', cost: 5, on: t => t.res === 'forest' && !t.imp },
  grow:     { label: 'Grow forest',    icon: '🌱', tech: 'spiritualism', cost: 5, on: plainLand },
  mine:     { label: 'Mine',           icon: '⛏️', tech: 'mining',       cost: 5, pop: 2, on: t => t.t === 'mountain' && t.res === 'metal' && !t.imp },
  port:     { label: 'Port',           icon: '⚓', tech: 'fishing',      cost: 7, pop: 1, on: t => t.t === 'water' && !t.imp && !t.res },
  road:     { label: 'Road',           icon: '🛤️', tech: 'roads',        cost: 2, on: t => t.t === 'land' && !t.road && !t.b },
  windmill: { label: 'Windmill',       icon: '🌬️', tech: 'construction', cost: 5, near: 'farm', each: 1, on: plainLand },
  sawmill:  { label: 'Sawmill',        icon: '🪚', tech: 'mathematics',  cost: 5, near: 'lumber', each: 1, on: plainLand },
  forge:    { label: 'Forge',          icon: '🔥', tech: 'smithery',     cost: 5, near: 'mine', each: 2, on: plainLand },
  market:   { label: 'Market',         icon: '🏪', tech: 'trade',        cost: 5, on: plainLand },
  temple:   { label: 'Temple',         icon: '⛩️', tech: 'freespirit',   cost: 10, pop: 1, on: plainLand },
  mtemple:  { label: 'Mountain temple', icon: '🏔️', tech: 'meditation',  cost: 10, pop: 1, on: t => t.t === 'mountain' && !t.imp && !t.res },
  ftemple:  { label: 'Forest temple',  icon: '🌳', tech: 'spiritualism', cost: 10, pop: 1, on: t => t.res === 'forest' && !t.imp },
  wtemple:  { label: 'Water temple',   icon: '🌊', tech: 'aquatism',     cost: 10, pop: 1, on: t => isWater(t) && !t.imp && !t.res },
};
const ONE_PER_CITY = ['windmill', 'sawmill', 'forge', 'market'];
const INDUSTRY = { farm: 'windmill', lumber: 'sawmill', mine: 'forge' };

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
const cv = $('c');
let ctx = cv.getContext('2d'); // swapped briefly when painting button icons
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
    if (r < 0.12) { if (!protect[y][x]) { tl.t = 'mountain'; if (rnd() < 0.5) tl.res = 'metal'; } }
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
    if (!coast) { tl.t = 'ocean'; if (rnd() < 0.08) tl.res = 'whale'; }
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
    units.push({ id: nextId++, type: ut, owner: p, x: sx + ring[3][0], y: sy + ring[3][1], hp: UNITS[ut].hp, moved: false, attacked: false, done: false, kills: 0, vet: false, home: { x: sx, y: sy } });
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
    v: 3, n, seed, mode: cfg.mode, turnLimit: 30, diff, mapType: cfg.mapType,
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
function cityLand(c, p) { // tiles that belong to this city
  const out = [], r = radiusOf(c.b);
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (!inb(x, y)) continue;
    const o = cityFor(x, y, p);
    if (o && o.x === c.x && o.y === c.y) out.push({ x, y });
  }
  return out;
}
const popNeeded = b => b.level + 1;
const cityHas = (c, p, imp) => cityLand(c, p).some(t => T(t.x, t.y).imp === imp);
function countNear(x, y, imp, p) {
  let n = 0;
  for (const [dx, dy] of DIRS) { const xx = x + dx, yy = y + dy; if (inb(xx, yy) && T(xx, yy).imp === imp && tileOwner(xx, yy) === p) n++; }
  return n;
}
function marketStars(c, p) {
  let s = 0;
  for (const t of cityLand(c, p)) if (T(t.x, t.y).imp === 'market') s += ['windmill', 'sawmill', 'forge'].reduce((a, k) => a + countNear(t.x, t.y, k, p), 0);
  return s;
}
const cityIncome = (c, p) => c.b.level + (c.b.capital ? 1 : 0) + (c.b.workshop || 0) + (c.b.park || 0) + marketStars(c, p);
function metTribes(p) { // rival tribes whose cities or units this player has seen
  const V = G.vis[p], met = new Set();
  for (const c of cityTiles()) if (c.b.owner !== p && V[c.y][c.x]) met.add(c.b.owner);
  for (const u of G.units) if (u.owner !== p && V[u.y][u.x] === 2) met.add(u.owner);
  return [...met].filter(q => G.players[q].alive).length;
}
const income = p => cityTiles(p).reduce((s, c) => s + cityIncome(c, p), 0) + (hasTech(p, 'diplomacy') ? metTribes(p) : 0);
const unitCount = p => G.units.filter(u => u.owner === p).length;
const unitCap = p => cityTiles(p).reduce((s, c) => s + c.b.level + 1, 0);
const supported = (c, p) => G.units.filter(u => u.owner === p && u.home && u.home.x === c.x && u.home.y === c.y).length;
function techCost(p, k) {
  const base = TECHS[k].tier * Math.max(1, cityTiles(p).length) + 4;
  return hasTech(p, 'philosophy') ? Math.ceil(base * 2 / 3) : base;
}

// terrain a unit may stand on; afloat units use the sea, everyone else the land
function terrainOk(p, tl, afloat) {
  if (tl.t === 'land') return true;
  if (tl.t === 'mountain') return hasTech(p, 'climbing');
  if (!afloat) return false;
  return tl.t === 'water' || hasTech(p, 'sailing');
}
const isPortFor = (x, y, p) => T(x, y).imp === 'port' && tileOwner(x, y) === p;
function isCapturable(tl, p) { return !!tl.b && (tl.b.kind !== 'city' || tl.b.owner !== p); }
const afloat = u => isWater(T(u.x, u.y));
const stats = u => (afloat(u) ? BOATS[u.boat || 0] : UNITS[u.type]);
const has = (u, s) => stats(u).skills.includes(s);
const canMove = u => !u.done && !u.moved && (!u.attacked || has(u, 'escape'));
const canAttack = u => !u.done && !u.attacked && (!u.moved || has(u, 'dash')) && (stats(u).atk > 0 || has(u, 'convert'));
const canCapture = u => { const b = T(u.x, u.y).b; return !u.done && !u.moved && !u.attacked && !!b && (b.kind === 'village' || (b.kind === 'city' && b.owner !== u.owner)); };
const canExamine = u => { const b = T(u.x, u.y).b; return !u.done && !u.attacked && !!b && b.kind === 'ruin'; };
const canRecover = u => !u.done && !u.moved && !u.attacked && u.hp < maxHp(u);
const canHeal = u => has(u, 'heal') && !u.done && !u.attacked && G.units.some(f => f.owner === u.owner && f !== u && cheb(f, u) <= 1 && f.hp < maxHp(f));
const canPromote = u => (u.kills || 0) >= 3 && !u.vet;
function nextBoat(u) { // the upgrade on offer to a unit at sea, if any
  if (!afloat(u) || (u.boat || 0) >= 2) return null;
  const b = BOATS[(u.boat || 0) + 1];
  return hasTech(u.owner, b.tech) ? b : null;
}

function defenseBonus(u) {
  const tl = T(u.x, u.y);
  let b = 1;
  if (tl.b && tl.b.kind === 'city' && tl.b.owner === u.owner && has(u, 'fortify')) b = tl.b.wall ? 4 : 1.5;
  if (tl.res === 'forest' && hasTech(u.owner, 'archery')) b = Math.max(b, 1.5);
  if (tl.t === 'mountain' && hasTech(u.owner, 'climbing')) b = Math.max(b, 1.5);
  if (isWater(tl) && hasTech(u.owner, 'aquatism')) b = Math.max(b, 1.5);
  return b;
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

// Tiles a unit can reach this turn. Forests and mountains stop movement unless a road leads in,
// stepping next to an enemy stops it, roads halve the cost, and units board boats only at their own ports.
function reach(u) {
  if (!canMove(u)) return [];
  const p = u.owner, startW = afloat(u), mv = stats(u).mv;
  const zoc = new Set();
  for (const e of G.units) if (e.owner !== p) for (const [dx, dy] of DIRS) zoc.add((e.x + dx) + ',' + (e.y + dy));
  const roadish = (x, y) => { const t = T(x, y); return !!t.road || (!!t.b && t.b.kind === 'city'); };
  const best = new Map([[u.x + ',' + u.y, 0]]), out = [], q = [[0, u.x, u.y]];
  while (q.length) {
    let bi = 0;
    for (let i = 1; i < q.length; i++) if (q[i][0] < q[bi][0]) bi = i;
    const [d, cx, cy] = q.splice(bi, 1)[0];
    if (d > best.get(cx + ',' + cy)) continue;
    for (const [dx, dy] of DIRS) {
      const x = cx + dx, y = cy + dy, k = x + ',' + y;
      if (!inb(x, y) || (x === u.x && y === u.y) || unitAt(x, y)) continue;
      const tl = T(x, y), w = isWater(tl);
      const ok = startW ? terrainOk(p, tl, w) : (w ? isPortFor(x, y, p) : terrainOk(p, tl, false));
      if (!ok) continue;
      const road = !startW && !w && roadish(cx, cy) && roadish(x, y);
      const nd = d + (road ? 0.5 : 1);
      if (nd > mv + 1e-9 || (best.has(k) && best.get(k) <= nd)) continue;
      if (!best.has(k)) out.push({ x, y });
      best.set(k, nd);
      const stop = w !== startW || (!road && (tl.t === 'mountain' || tl.res === 'forest')) || zoc.has(k);
      if (!stop) q.push([nd, x, y]);
    }
  }
  return out;
}
function targetsFor(u, viewOnly) {
  if (!canAttack(u)) return [];
  const r = stats(u).range;
  return G.units.filter(e => e.owner !== u.owner && cheb(u, e) <= r && (!viewOnly || seenByView(e.x, e.y)));
}
function workAllowed(c, p, x, y, k) {
  const w = WORKS[k], tl = T(x, y), un = unitAt(x, y);
  if (!w.on(tl) || !hasTech(p, w.tech) || (un && un.owner !== p)) return false;
  return !ONE_PER_CITY.includes(k) || !cityHas(c, p, k);
}
function availableWorks(c, p) {
  const out = [];
  for (const { x, y } of cityLand(c, p)) for (const k of Object.keys(WORKS)) if (workAllowed(c, p, x, y, k)) out.push({ x, y, key: k });
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
  const embark = afloat(u) !== isWater(T(x, y));
  u.x = x; u.y = y; u.moved = true;
  if (embark) { u.boat = 0; burst(x, y, 'splash'); }
  if (u.attacked) u.done = true; // an escape move ends the unit's turn
  sfxAt('move', x, y);
  updateVis();
}
function capture(u) {
  if (!canCapture(u)) return false;
  const tl = T(u.x, u.y), p = u.owner;
  if (tl.b.kind === 'village') {
    tl.b = { kind: 'city', owner: p, level: 1, pop: 0, capital: false, name: cityName(), workshop: 0, park: 0, wall: false, border: 0 };
    tellOwner(p, `${tl.b.name} joined your tribe! 🏙️`);
  } else {
    const prev = tl.b.owner;
    tl.b.owner = p; tl.b.capital = false;
    for (const v of G.units) if (v.home && v.home.x === u.x && v.home.y === u.y) v.home = null; // their city is gone
    toast(`${G.players[p].name} captured ${tl.b.name} from ${G.players[prev].name}!`);
  }
  u.done = true;
  sfxAt('capture', u.x, u.y); burst(u.x, u.y, 'capture', G.players[p].color);
  updateVis();
  checkElim();
  return true;
}
function examine(u) {
  if (!canExamine(u)) return false;
  u.done = true;
  ruinReward(u, u.x, u.y);
  updateVis();
  return true;
}
function explorerWalk(p, x, y, steps) { // a scout wanders off and maps what it passes
  let cx = x, cy = y;
  for (let i = 0; i < steps; i++) {
    const opts = DIRS.map(([dx, dy]) => [cx + dx, cy + dy]).filter(([a, b]) => inb(a, b) && !isWater(T(a, b)));
    if (!opts.length) break;
    const unseen = opts.filter(([a, b]) => !G.vis[p][b][a]);
    [cx, cy] = (unseen.length ? unseen : opts)[rndInt((unseen.length ? unseen : opts).length)];
    reveal(p, cx, cy, 1);
  }
}
function ruinReward(u, x, y) {
  const p = u.owner, pl = G.players[p];
  T(x, y).b = null;
  const techs = Object.keys(TECHS).filter(k => techAvailable(p, k));
  const spot = DIRS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).find(s => inb(s.x, s.y) && T(s.x, s.y).t === 'land' && !unitAt(s.x, s.y));
  const cap = cityTiles(p).find(c => c.b.capital) || cityTiles(p)[0];
  const kinds = ['stars', 'tech', 'explorer', 'unit', 'pop'].filter(k => (k !== 'tech' || techs.length) && (k !== 'unit' || spot) && (k !== 'pop' || cap));
  const kind = kinds[rndInt(kinds.length)];
  sfxAt('tech', x, y); burst(x, y, 'level');
  if (kind === 'stars') { pl.stars += 10; popFx(x, y, '+10 ⭐', '#ffe27a'); tellOwner(p, 'The ruins held a hidden treasure: +10 ⭐'); }
  else if (kind === 'tech') { const k = techs[rndInt(techs.length)]; pl.techs.push(k); tellOwner(p, `Ancient scrolls taught you ${TECHS[k].icon} ${TECHS[k].name}!`); }
  else if (kind === 'explorer') { explorerWalk(p, x, y, 15); tellOwner(p, 'An explorer joins you and maps the nearby lands.'); }
  else if (kind === 'pop') { addPop(cap, 3, p); tellOwner(p, `Refugees settle in ${cap.b.name}: +3 population.`); }
  else {
    G.units.push({ id: G.nextId++, type: 'swordsman', owner: p, x: spot.x, y: spot.y, hp: UNITS.swordsman.hp + 5, moved: true, attacked: true, done: true, kills: 3, vet: true, home: null });
    tellOwner(p, 'A veteran swordsman from the ruins joins your army!');
  }
}
function credit(k) { k.kills = (k.kills || 0) + 1; if (canPromote(k) && G.players[k.owner].ai) promote(k); }
function promote(u) { // three kills earn a veteran: +5 health and fully healed
  if (!canPromote(u)) return false;
  u.vet = true; u.hp = maxHp(u);
  popFx(u.x, u.y, 'Veteran!', '#ffe27a'); sfxAt('level', u.x, u.y);
  return true;
}
function recover(u) {
  if (!canRecover(u)) return false;
  const amount = tileOwner(u.x, u.y) === u.owner ? 4 : 2;
  u.hp = Math.min(maxHp(u), u.hp + amount); u.done = true;
  popFx(u.x, u.y, '+' + amount, '#86ffa0'); sfxAt('work', u.x, u.y);
  return true;
}
function healOthers(u) {
  if (!canHeal(u)) return false;
  for (const f of G.units) if (f.owner === u.owner && f !== u && cheb(f, u) <= 1 && f.hp < maxHp(f)) { f.hp = Math.min(maxHp(f), f.hp + 4); popFx(f.x, f.y, '+4', '#86ffa0'); }
  u.done = true; u.attacked = true;
  sfxAt('work', u.x, u.y); burst(u.x, u.y, 'work');
  return true;
}
function upgradeBoat(u) {
  const b = nextBoat(u), pl = G.players[u.owner];
  if (!b || pl.stars < b.cost) return false;
  pl.stars -= b.cost; u.boat = (u.boat || 0) + 1;
  sfxAt('train', u.x, u.y); burst(u.x, u.y, 'train');
  return true;
}
function disband(u) {
  if (hasTech(u.owner, 'freespirit')) G.players[u.owner].stars += Math.floor(UNITS[u.type].cost / 2);
  G.units = G.units.filter(z => z !== u);
  updateVis();
}
function convert(a, d) { // a mind bender wins the enemy over
  d.owner = a.owner; d.home = a.home ? { ...a.home } : null;
  d.moved = d.attacked = d.done = true;
  a.moved = a.attacked = a.done = true;
  popFx(d.x, d.y, 'Converted!', '#d7a6ff'); sfxAt('capture', d.x, d.y); burst(d.x, d.y, 'capture', G.players[a.owner].color);
  updateVis();
}
function attack(a, d) {
  if (has(a, 'convert')) return convert(a, d);
  const r = combatCalc(a, d, cheb(a, d)), now = performance.now();
  const dwx = wxOf(d.x, d.y) - wxOf(a.x, a.y);
  if (dwx) { faces.set(a.id, dwx > 0 ? 1 : -1); faces.set(d.id, dwx > 0 ? -1 : 1); }
  hitAnims.set(a.id, { kind: 'lunge', dx: d.x - a.x, dy: d.y - a.y, t0: now, dur: 260 });
  hitAnims.set(d.id, { kind: 'shake', t0: now + 110, dur: 340 });
  d.hp -= r.dmg; popFx(d.x, d.y, '-' + r.dmg, '#ff6a5a'); burst(d.x, d.y, 'hit');
  if (r.counter) { a.hp -= r.counter; popFx(a.x, a.y, '-' + r.counter, '#ffb35a'); burst(a.x, a.y, 'hit'); }
  sfxAt('attack', d.x, d.y);
  const killed = d.hp <= 0;
  if (killed) {
    burst(d.x, d.y, 'death'); addGhost(d);
    G.units = G.units.filter(u => u !== d);
    credit(a);
    const tl = T(d.x, d.y), same = isWater(tl) === afloat(a);
    if (a.hp > 0 && stats(a).range === 1 && same && terrainOk(a.owner, tl, isWater(tl))) { // melee winners advance
      anims.set(a.id, { x0: a.x, y0: a.y, t0: performance.now() });
      a.x = d.x; a.y = d.y;
    }
  }
  if (a.hp <= 0) { burst(a.x, a.y, 'death'); addGhost(a); G.units = G.units.filter(u => u !== a); if (!killed) credit(d); }
  else if (killed && has(a, 'persist')) { a.attacked = false; a.moved = true; }  // free to strike again
  else if (has(a, 'escape')) { a.attacked = true; a.moved = false; }          // free to move once more
  else { a.attacked = true; a.moved = true; a.done = true; }
  updateVis();
}

function canTrain(c, type, p) {
  return unitUnlocked(p, type) && UNITS[type].train !== false && !unitAt(c.x, c.y) &&
    G.players[p].stars >= UNITS[type].cost && supported(c, p) < c.b.level + 1;
}
function train(c, type, p) {
  if (!canTrain(c, type, p)) return false;
  const def = UNITS[type];
  G.players[p].stars -= def.cost;
  G.units.push({ id: G.nextId++, type, owner: p, x: c.x, y: c.y, hp: def.hp, moved: true, attacked: true, done: true, kills: 0, vet: false, home: { x: c.x, y: c.y } });
  sfxAt('train', c.x, c.y); burst(c.x, c.y, 'train');
  updateVis();
  return true;
}
function doWork(x, y, key, p) {
  const w = WORKS[key], tl = T(x, y), pl = G.players[p], c = cityFor(x, y, p);
  if (!c || !workAllowed(c, p, x, y, key) || pl.stars < w.cost) return false;
  pl.stars -= w.cost;
  let pop = w.pop || 0;
  switch (key) {
    case 'fruit': case 'animal': case 'fish': case 'whale': case 'clear': tl.res = null; break;
    case 'farm': tl.res = null; tl.imp = 'farm'; break;
    case 'burn': tl.res = 'crop'; break;
    case 'grow': tl.res = 'forest'; break;
    case 'mine': tl.res = null; tl.imp = 'mine'; break;
    case 'road': tl.road = true; break;
    case 'windmill': case 'sawmill': case 'forge': pop = w.each * countNear(x, y, w.near, p); tl.imp = key; break;
    default: tl.imp = key;
  }
  if (w.gain) { pl.stars += w.gain; popFx(x, y, `+${w.gain} ⭐`, '#ffe27a'); }
  if (INDUSTRY[key]) for (const [dx, dy] of DIRS) { // a neighbouring windmill, sawmill or forge grows with it
    const xx = x + dx, yy = y + dy;
    if (!inb(xx, yy) || T(xx, yy).imp !== INDUSTRY[key]) continue;
    const cc = cityFor(xx, yy, p);
    if (cc) { addPop(cc, WORKS[INDUSTRY[key]].each, p); popFx(xx, yy, `+${WORKS[INDUSTRY[key]].each} pop`, '#8fe39a'); }
  }
  if (pop) popFx(x, y, `+${pop} pop`, '#8fe39a');
  sfxAt('work', x, y); burst(x, y, 'work');
  if (pop) addPop(c, pop, p);
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
  if (level === 2) return [['workshop', '🔨', 'Workshop', '+1 ⭐ every turn'], ['explorer', '🧭', 'Explorer', 'A scout maps the lands around the city']];
  if (level === 3) return [['wall', '🧱', 'City wall', 'Fortified units in the city defend at ×4'], ['resources', '💰', 'Resources', '+5 ⭐ right now']];
  if (level === 4) return [['popgrowth', '👥', 'Population growth', '+3 population'], ['border', '🗺️', 'Border growth', 'City borders grow by one ring']];
  return [['park', '🌳', 'Park', '+1 ⭐ every turn and 250 points'], ['giant', '🗿', 'Super unit', 'A Giant joins you in this city']];
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
  else if (key === 'explorer') explorerWalk(p, c.x, c.y, 15);
  else if (key === 'wall') b.wall = true;
  else if (key === 'resources') pl.stars += 5;
  else if (key === 'popgrowth') addPop(c, 3, p);
  else if (key === 'border') b.border = Math.min(2, (b.border || 0) + 1);
  else if (key === 'giant') {
    const spots = [{ x: c.x, y: c.y }, ...DIRS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy }))];
    const s = spots.find(s => inb(s.x, s.y) && T(s.x, s.y).t === 'land' && !unitAt(s.x, s.y));
    if (s) G.units.push({ id: G.nextId++, type: 'giant', owner: p, x: s.x, y: s.y, hp: UNITS.giant.hp, moved: true, attacked: true, done: true, kills: 0, vet: false, home: { x: c.x, y: c.y } });
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
const TEMPLES = ['temple', 'mtemple', 'ftemple', 'wtemple'];
function score(p) { // exploration, territory, cities, technology, army, parks and temples
  const pl = G.players[p];
  if (!pl.alive) return 0;
  let s = 0;
  for (const c of cityTiles(p)) s += 100 * c.b.level + 250 * (c.b.park || 0);
  const own = computeOwners();
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) if (own[y][x] === p) { s += 20; if (TEMPLES.includes(T(x, y).imp)) s += 100; }
  s += pl.techs.reduce((a, t) => a + 100 * TECHS[t].tier, 0);
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
function markVis(V, cx, cy, r, p) {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!inb(x, y)) continue;
    if (V[y][x] === 0 && p === G.view) revealAt.set(x + ',' + y, performance.now()); // clouds part here
    V[y][x] = 2;
  }
}
function reveal(p, cx, cy, r) {
  const V = G.vis[p];
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const x = cx + dx, y = cy + dy;
    if (!inb(x, y) || V[y][x] !== 0) continue;
    if (p === G.view) revealAt.set(x + ',' + y, performance.now());
    V[y][x] = 1;
  }
}
function updateVis() { // units see one tile around them (two from a mountain); cities see past their borders
  const cities = cityTiles();
  G.players.forEach((pl, p) => {
    const V = G.vis[p];
    for (const row of V) for (let x = 0; x < row.length; x++) if (row[x] === 2) row[x] = 1;
    if (!pl.alive) return;
    for (const u of G.units) if (u.owner === p) markVis(V, u.x, u.y, T(u.x, u.y).t === 'mountain' ? 2 : 1, p);
    for (const c of cities) if (c.b.owner === p) markVis(V, c.x, c.y, radiusOf(c.b) + 1, p);
  });
}

/* ---------- turn flow ---------- */
const canAct = () => G && !busy && !G.over && G.cur === G.view && !G.players[G.cur].ai &&
  $('pass').hidden && $('reward').hidden;

function startTurn(p) {
  const pl = G.players[p];
  pl.stars = Math.max(0, pl.stars + income(p) + (pl.ai ? DIFF[G.diff].bonus : 0));
  for (const u of G.units) if (u.owner === p) { u.moved = false; u.attacked = false; u.done = false; }
  updateVis();
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
  const own = computeOwners(), mine = [];
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) if (own[y][x] === p) mine.push(T(x, y));
  const needSea = aiNeedsSea(p);
  let best = null, bs = -Infinity;
  for (const k of avail) {
    let s = Math.random() * 1.5 - techCost(p, k) * 0.12;
    if (Object.values(UNITS).some(u => u.tech === k)) s += 2;
    for (const w of Object.values(WORKS)) if (w.tech === k && (w.pop || w.gain)) s += 0.7 * mine.filter(tl => w.on(tl)).length;
    if (k === 'climbing') s += 0.3 * mine.filter(tl => tl.t === 'mountain').length;
    if (needSea && (k === 'fishing' || k === 'sailing')) s += 4;
    if (TECHS[k].req && !hasTech(p, TECHS[k].req)) s -= 9;
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
  return !G.units.some(u => u.owner === p && field[u.y][u.x] < Infinity) && !cityTiles(p).some(c => field[c.y][c.x] < Infinity);
}
function aiEconomy(p) {
  const pl = G.players[p], needSea = hasTech(p, 'fishing') && aiNeedsSea(p);
  const weights = { warrior: 2, rider: 2, archer: 2, defender: 1, swordsman: 3, knight: 3, catapult: 1.5, mindbender: 0.6 };
  const worth = it => { // population (or stars) per star spent, counting what neighbouring industry adds
    const w = WORKS[it.key];
    let pop = w.pop || 0, gain = w.gain || 0;
    if (w.near) pop = w.each * countNear(it.x, it.y, w.near, p);
    if (INDUSTRY[it.key]) pop += WORKS[INDUSTRY[it.key]].each * countNear(it.x, it.y, INDUSTRY[it.key], p);
    if (it.key === 'market') gain = 4 * ['windmill', 'sawmill', 'forge'].reduce((a, k) => a + countNear(it.x, it.y, k, p), 0);
    if (w.near && pop < 2) pop = 0; // wait until the neighbourhood pays off
    return (pop + gain * 0.3) / Math.max(1, w.cost);
  };
  for (const u of G.units) if (u.owner === p) { if (canPromote(u)) promote(u); const b = nextBoat(u); if (b && pl.stars >= b.cost + 3) upgradeBoat(u); }
  for (let guard = 0; guard < 30; guard++) {
    let did = false;
    for (const c of cityTiles(p)) {
      const free = !unitAt(c.x, c.y), capOk = supported(c, p) < c.b.level + 1;
      const works = availableWorks(c, p).filter(w => WORKS[w.key].cost <= pl.stars && (worth(w) > 0 || (w.key === 'port' && needSea)));
      if (needSea) { const port = works.find(w => w.key === 'port'); if (port) { doWork(port.x, port.y, 'port', p); did = true; continue; } }
      if (works.length && (!free || !capOk || unitCount(p) >= 2) && Math.random() < 0.65) {
        works.sort((a, b) => worth(b) - worth(a));
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
// distance to the nearest thing worth going for, following the same movement rules as the units
function aiGoalField(p) {
  const n = G.n, dist = Array.from({ length: n }, () => Array(n).fill(Infinity)), q = [];
  const add = (x, y) => { if (dist[y][x] === Infinity) { dist[y][x] = 0; q.push({ x, y }); } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (isCapturable(T(x, y), p)) add(x, y);
  for (const e of G.units) if (e.owner !== p) add(e.x, e.y);
  for (let i = 0; i < q.length; i++) {
    const c = q[i], ct = T(c.x, c.y), cw = isWater(ct), goal = dist[c.y][c.x] === 0;
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (!inb(x, y) || dist[y][x] !== Infinity) continue;
      const nt = T(x, y), nw = isWater(nt);
      if (!terrainOk(p, nt, nw)) continue; // somewhere a unit can stand
      // can a unit standing on (x, y) step into c?
      const ok = goal || (!cw ? terrainOk(p, ct, false) : nw ? terrainOk(p, ct, true) : isPortFor(c.x, c.y, p));
      if (!ok) continue;
      dist[y][x] = dist[c.y][c.x] + 1; q.push({ x, y });
    }
  }
  return dist;
}
function aiTargetScore(u, e, from) {
  if (has(u, 'convert')) return e.type === 'giant' ? 14 : 4 + UNITS[e.type].cost;
  const saved = [u.x, u.y];
  u.x = from.x; u.y = from.y;
  const r = combatCalc(u, e, cheb(from, e));
  u.x = saved[0]; u.y = saved[1];
  return r.dmg + (r.dmg >= e.hp ? 8 : 0) - r.counter * 0.7;
}
function aiBestTarget(u) {
  let best = null, bs = 0.4;
  for (const e of targetsFor(u, false)) { const s = aiTargetScore(u, e, u); if (s > bs) { bs = s; best = e; } }
  return best;
}
function aiPlan(u) {
  const R = stats(u).range, here = { x: u.x, y: u.y };
  const spots = [here, ...reach(u)];
  let best = null, bs = 0.4;
  for (const s of spots) {
    const isHere = s === here, tl = T(s.x, s.y);
    if (!isHere && tl.b && (tl.b.kind === 'village' || tl.b.kind === 'ruin' || (tl.b.kind === 'city' && tl.b.owner !== u.owner))) {
      const sc = tl.b.kind === 'village' ? 7 : tl.b.kind === 'ruin' ? 6 : 12 + 2 * tl.b.level; // stand there and take it next turn
      if (sc > bs) { bs = sc; best = { s, target: null }; }
    }
    if (!isHere && tl.b && tl.b.kind === 'city' && tl.b.owner === u.owner && G.units.some(e => e.owner !== u.owner && cheb(e, s) <= 2) && bs < 3) { bs = 3; best = { s, target: null }; }
    const canHit = isHere ? canAttack(u) : (!u.attacked && has(u, 'dash') && (stats(u).atk > 0 || has(u, 'convert')));
    if (!canHit) continue;
    for (const e of G.units) {
      if (e.owner === u.owner || cheb(s, e) > R) continue;
      const sc = aiTargetScore(u, e, s) - (isHere ? 0 : 0.2);
      if (sc > bs) { bs = sc; best = { s, target: e }; }
    }
  }
  return best;
}
function aiRetreat(u) { // step away from the nearest enemy, preferring home ground
  let best = null, bs = -Infinity;
  for (const o of reach(u)) {
    const d = Math.min(99, ...G.units.filter(e => e.owner !== u.owner).map(e => cheb(e, o)));
    const s = d + (tileOwner(o.x, o.y) === u.owner ? 0.5 : 0);
    if (s > bs) { bs = s; best = o; }
  }
  if (best) doMove(u, best.x, best.y);
}
function aiUnit(u) {
  const p = u.owner;
  if (canPromote(u)) promote(u);
  if (canCapture(u)) return capture(u);
  if (canExamine(u)) return examine(u);
  if (canHeal(u) && G.units.filter(f => f.owner === p && cheb(f, u) <= 1 && f.hp < maxHp(f)).length >= 2) return healOthers(u);
  let acted = false;
  const plan = aiPlan(u);
  const threatened = G.units.some(e => e.owner !== p && cheb(e, u) <= 2);
  if (plan && plan.target) {
    if (plan.s.x !== u.x || plan.s.y !== u.y) doMove(u, plan.s.x, plan.s.y);
    if (G.units.includes(plan.target) && canAttack(u)) attack(u, plan.target);
    acted = true;
  } else if (u.hp < maxHp(u) * 0.5 && canRecover(u) && !threatened) {
    return recover(u);
  } else if (plan) {
    doMove(u, plan.s.x, plan.s.y); acted = true;
    if (canExamine(u)) examine(u);
  } else if (canMove(u)) {
    const field = aiGoalField(p);
    let bestD = field[u.y][u.x], pick = null;
    for (const o of reach(u)) {
      const d = field[o.y][o.x];
      if (d < bestD || (d === bestD && pick && Math.random() < 0.3)) { bestD = d; pick = o; }
    }
    if (pick) { doMove(u, pick.x, pick.y); acted = true; }
    else if (canRecover(u)) return recover(u);
  }
  if (!G.units.includes(u)) return true;
  for (let guard = 0; guard < 4 && canAttack(u); guard++) { // dash attacks after moving, persist chains kills
    const t = aiBestTarget(u);
    if (!t) break;
    attack(u, t); acted = true;
    if (!G.units.includes(u)) return true;
  }
  if (has(u, 'escape') && u.attacked && canMove(u)) aiRetreat(u);
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
    return g && g.v === 3 ? g : null;
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
let toastTimer = 0, gameShown = false, techSel = null;
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

const STAR_SVG = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z"/></svg>';
const CROWN_SVG = '<svg class="crown" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V8l5 4 4-7 4 7 5-4v10z"/></svg>';
const STAT_SVG = {
  hp: '<svg viewBox="0 0 24 24" fill="#ff6b7a"><path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 5 6.6 5c2 0 3.4 1.1 5.4 3 2-1.9 3.4-3 5.4-3 3.4 0 5.6 3.4 4.1 6.8C19.5 16.4 12 21 12 21z"/></svg>',
  atk: '<svg viewBox="0 0 24 24" fill="#ffd166"><path d="M14 3h7v7L10.5 20.5l-2-2-2.5 2.5L4 19l2.5-2.5-2-2z"/></svg>',
  def: '<svg viewBox="0 0 24 24" fill="#7ec8ff"><path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z"/></svg>',
  mv: '<svg viewBox="0 0 24 24" fill="#9ff09a"><path d="M4 18h10l6-3v-3h-6l-2-7H7v9l-3 1z"/></svg>',
  rng: '<svg viewBox="0 0 24 24" fill="none" stroke="#ffb1e0" stroke-width="2.6"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2" fill="#ffb1e0"/></svg>',
};
const starCost = n => `<span class="cost">${STAR_SVG}${n}</span>`;

// Button pictures, painted with the same routines as the map.
const iconCache = new Map();
function iconURL(key, paint) {
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const saved = ctx;
  ctx = c.getContext('2d');
  try { ctx.translate(64, 64); paint(); } finally { ctx = saved; }
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}
const unitIcon = (type, tribe) => iconURL(`u-${type}-${tribe}`, () => {
  ellipse(0, 41, 30, 10, 'rgba(0,0,0,.16)');
  ctx.translate(0, 42);
  const s = type === 'giant' ? 1.25 : type === 'knight' || type === 'rider' ? 1.6 : type === 'catapult' ? 2.1 : 1.9;
  ctx.scale(s, s);
  paintUnit(type, tribe, 'land');
});
const workIcon = (key, cl) => iconURL(`w-${key}-${cl.name}`, () => {
  if (key === 'mine') { ctx.translate(0, 16); ctx.scale(1.45, 1.45); paintMountain(cl, true); return; }
  if (key === 'fish') { ellipse(0, 8, 54, 30, '#4aa8dc'); ctx.scale(2.6, 2.6); drawFish(0, 0, 0, 3, 1400, false); return; }
  if (key === 'port') { ctx.translate(-6, 14); ctx.scale(1.7, 1.7); ellipse(6, 6, 30, 13, '#4aa8dc'); paintPort('#3aa4ee'); return; }
  if (key === 'lumber') { ctx.translate(0, 20); ctx.scale(1.55, 1.55); paintForest(cl, 1, true); return; }
  ctx.translate(0, 20); ctx.scale(2, 2);
  if (key === 'fruit') paintFruit(cl);
  else if (key === 'animal') paintAnimal(cl, false);
  else paintCrop(cl);
});
const tribeIcon = t => iconURL(`t-${t}`, () => {
  const cl = CLIMATES[t];
  ctx.scale(1.5, 1.5);
  paintLandBlock(cl, 0, -14);
  ctx.save(); ctx.translate(-15, 4); paintTreeFor(cl, 0, 0, 0.8, 3); ctx.restore();
  ctx.save(); ctx.translate(6, 12); paintUnit(TRIBES[t].unit, t, 'land'); ctx.restore();
});

function ui() {
  if (!G) return;
  const me = G.view, pl = G.players[me];
  $('st-score').textContent = score(me).toLocaleString('en-US');
  $('st-turn').textContent = G.mode === 'perfection' ? `${G.turn}/${G.turnLimit}` : G.turn;
  $('st-stars').textContent = pl.stars;
  $('st-income').textContent = income(me);
  const t = $('turn-of');
  if (busy && gameShown && G.players[G.cur]) {
    const p = G.players[G.cur];
    t.innerHTML = `<i style="background:${p.color}"></i>${esc(p.name)} is playing<span class="dots"></span>`;
    t.hidden = false;
  } else t.hidden = true;
  const ok = canAct();
  $('btn-end').disabled = !ok;
  $('btn-end').classList.toggle('ready', ok && !G.units.some(u => u.owner === me && (reach(u).length || targetsFor(u, true).length)));
  $('btn-tech').disabled = !!G.over;
  renderSheet();
  if (!$('tech').hidden) renderTech();
  if (!$('game-menu').hidden) renderGameMenu();
}

function renderSheet() {
  $('bottom').hidden = !gameShown || !!sel;
  $('sheet').hidden = !gameShown || !sel;
  if (!gameShown || !sel) return;
  const act = $('actions'), me = G.view;
  act.innerHTML = '';
  const setInfo = (title, text) => { $('info-title').innerHTML = title; $('info-text').innerHTML = text; };
  const u0 = sel.kind === 'unit' ? unitById(sel.id) : null;
  const x = u0 ? u0.x : sel.x, y = u0 ? u0.y : sel.y;
  if (G.vis[me][y][x] === 0) { setInfo('Clouds', 'Unexplored land. Send a unit to scout it.'); return; }
  const tl = T(x, y), vis = seenByView(x, y);
  const u = u0 || (vis ? unitAt(x, y) : null);
  const b = tl.b, mine = canAct(), pl = G.players[me];
  const hints = [];
  let title = '', text = '';

  if (u) {
    const d = UNITS[u.type], st = stats(u), owner = G.players[u.owner];
    title = `<i class="dot" style="background:${owner.color}"></i>${st === d ? d.name : `${st.name} <small>carrying a ${d.name}</small>`}${u.vet ? ' <small class="vet">★ Veteran</small>' : ''}`;
    text = `<span class="chips"><span>${STAT_SVG.hp}${u.hp}/${maxHp(u)}</span><span>${STAT_SVG.atk}${st.atk}</span><span>${STAT_SVG.def}${st.def}</span><span>${STAT_SVG.mv}${st.mv}</span><span>${STAT_SVG.rng}${st.range}</span></span>`;
    const status = u.owner !== me ? esc(owner.name) : u.done || (!canMove(u) && !canAttack(u)) ? 'Done for this turn' : canMove(u) && canAttack(u) ? 'Ready' : canMove(u) ? 'Can still move' : 'Can still attack';
    text += `<span class="status">${status}</span>`;
    if (st.skills.length) text += `<span class="skills">${st.skills.map(k => `<span title="${SKILL_INFO[k]}">${SKILL_INFO[k].split(':')[0]}</span>`).join('')}</span>`;
  } else if (b && b.kind === 'city') {
    const owner = G.players[b.owner];
    title = `${b.capital ? CROWN_SVG : `<i class="dot" style="background:${owner.color}"></i>`}${esc(b.name)} <small>${b.capital ? 'Capital' : 'City'} · level ${b.level}${b.owner === me ? '' : ` · ${esc(owner.name)}`}</small>`;
    if (b.owner === me) {
      const need = b.level >= MAX_LEVEL ? 0 : popNeeded(b), c = { x, y, b };
      const pips = need ? `<span class="pips" title="Population ${b.pop} of ${need}">${Array.from({ length: need }, (_, i) => `<i class="${i < b.pop ? 'on' : ''}"></i>`).join('')}</span>` : '';
      text = `${pips}<span>+${cityIncome(c, me)} ${STAR_SVG} per turn</span><span>Units ${supported(c, me)}/${b.level + 1}</span>${b.wall ? '<span>City walls</span>' : ''}`;
    } else text = `<span>Stand a unit in the city for a turn, then capture it.</span>`;
  } else if (b && b.kind === 'village') { title = 'Village'; text = 'Move a unit here; next turn it can capture the village.'; }
  else if (b && b.kind === 'ruin') { title = 'Ancient Ruins'; text = 'Move a unit here and examine them for a reward.'; }
  else {
    const names = { forest: 'Forest', fruit: 'Wild Fruit', animal: 'Wild Animals', crop: 'Crops', fish: 'Fish', whale: 'Whales', metal: 'Metal Ore' };
    const imps = { farm: 'Farm', lumber: 'Lumber Hut', mine: 'Mine', port: 'Port', windmill: 'Windmill', sawmill: 'Sawmill', forge: 'Forge', market: 'Market', temple: 'Temple', mtemple: 'Mountain Temple', ftemple: 'Forest Temple', wtemple: 'Water Temple' };
    title = tl.imp ? imps[tl.imp] : tl.res ? names[tl.res] : tl.t === 'mountain' ? 'Mountain' : tl.t === 'water' ? 'Shallow Water' : tl.t === 'ocean' ? 'Ocean' : 'Field';
    if (tl.road) title += ' <small>with a road</small>';
    const tips = {
      forest: (hasTech(me, 'archery') ? 'Units here defend 50% better.' : 'Research Archery for a defence bonus here.') + ' Entering a forest ends a move.',
      mountain: hasTech(me, 'climbing') ? 'Units here see further and defend 50% better. Entering ends a move.' : 'Research Climbing to move here.',
      metal: hasTech(me, 'mining') ? 'Build a mine here.' : 'Research Mining to dig for metal.',
      water: hasTech(me, 'fishing') ? 'Units board boats at your ports.' : 'Research Fishing to build ports and sail.',
      ocean: hasTech(me, 'sailing') ? 'Boats can cross the ocean.' : 'Research Sailing to cross the ocean.',
      market: 'Earns a star each turn for every windmill, sawmill or forge next to it.',
    };
    text = tips[tl.imp] || tips[tl.res] || tips[tl.t] || (tl.imp ? 'Adds population to the nearby city.' : tl.res ? 'Harvest it from inside your borders.' : 'Open land.');
  }
  setInfo(title, text);
  if (!mine) return;

  const addAct = o => {
    const el = document.createElement('button');
    el.className = 'act' + (o.locked ? ' locked' : '') + (o.cls ? ' ' + o.cls : '');
    el.disabled = !!o.disabled;
    el.innerHTML = `<span class="disc">${o.img ? `<img src="${o.img}" alt="">` : `<span class="glyph">${o.glyph}</span>`}${o.cost ? starCost(o.cost) : ''}${o.locked ? '<span class="lock">🔒</span>' : ''}</span><span class="lbl">${o.label}</span>`;
    if (o.title) el.title = o.title;
    el.onclick = o.onClick;
    act.appendChild(el);
  };
  const after = () => { refreshSel(); ui(); showReward(); };

  if (u && u.owner === me) { // what this unit can do besides moving and attacking
    if (canCapture(u)) addAct({ glyph: '🚩', label: 'Capture', cls: 'go', onClick: () => { capture(u); after(); } });
    else if (T(u.x, u.y).b && isCapturable(T(u.x, u.y), me) && T(u.x, u.y).b.kind !== 'ruin') hints.push('This unit can capture here at the start of your next turn.');
    if (canExamine(u)) addAct({ glyph: '🔍', label: 'Examine', cls: 'go', onClick: () => { examine(u); after(); } });
    if (canPromote(u)) addAct({ glyph: '⭐', label: 'Promote', title: 'Veteran: +5 health and fully healed', onClick: () => { promote(u); after(); } });
    if (canHeal(u)) addAct({ glyph: '💞', label: 'Heal others', onClick: () => { healOthers(u); after(); } });
    if (canRecover(u)) addAct({ glyph: '❤️', label: `Recover +${tileOwner(u.x, u.y) === me ? 4 : 2}`, onClick: () => { recover(u); after(); } });
    const nb = afloat(u) && (u.boat || 0) < 2 ? BOATS[(u.boat || 0) + 1] : null;
    if (nb) {
      if (hasTech(me, nb.tech)) addAct({ glyph: nb.icon, label: nb.name, cost: nb.cost, disabled: pl.stars < nb.cost, onClick: () => { upgradeBoat(u); after(); } });
      else addAct({ glyph: nb.icon, label: nb.name, locked: true, onClick: () => toast(`Research ${TECHS[nb.tech].name} to upgrade to a ${nb.name}.`) });
    }
    const refund = hasTech(me, 'freespirit') ? Math.floor(UNITS[u.type].cost / 2) : 0;
    if (confirmDisband === u.id) {
      addAct({ glyph: '✔', label: refund ? `Confirm +${refund}⭐` : 'Confirm', cls: 'danger', onClick: () => { disband(u); select(null); } });
      addAct({ glyph: '↩', label: 'Keep', onClick: () => { confirmDisband = null; ui(); } });
    } else addAct({ glyph: '✖', label: 'Disband', title: 'Remove this unit to free up space', onClick: () => { confirmDisband = u.id; ui(); } });
  }
  if (b && b.kind === 'city' && b.owner === me && !(u && u.owner !== me)) {
    const c = { x, y, b }, blocked = !!unitAt(x, y), full = supported(c, me) >= b.level + 1;
    for (const k of Object.keys(UNITS)) {
      const d = UNITS[k];
      if (d.train === false) continue;
      if (!unitUnlocked(me, k)) {
        addAct({ img: unitIcon(k, pl.tribe), label: d.name, locked: true, title: `Research ${TECHS[d.tech].name}`,
          onClick: () => toast(`Research ${TECHS[d.tech].icon} ${TECHS[d.tech].name} in the Tech Tree to train ${d.name}s.`) });
        continue;
      }
      addAct({ img: unitIcon(k, pl.tribe), label: d.name, cost: d.cost, disabled: !canTrain(c, k, me),
        title: `Attack ${d.atk} · Defence ${d.def} · Move ${d.mv} · Range ${d.range} · Health ${d.hp}${d.skills.length ? ' · ' + d.skills.join(', ') : ''}`,
        onClick: () => { if (train(c, k, me)) { const nu = unitAt(x, y); select({ kind: 'unit', id: nu.id }); } } });
    }
    if (blocked && !u) hints.push('Move the unit out of the city to train here.');
    else if (blocked) hints.push('Move this unit out of the city to train here.');
    else if (full) hints.push(`${b.name} supports ${b.level + 1} units. Grow it to support more.`);
  }
  const c = cityFor(x, y, me);
  if (c && !(u && u.owner !== me)) {
    const cl = climateOf(tl), pics = ['fruit', 'animal', 'fish', 'farm', 'lumber', 'mine', 'port'];
    for (const k of Object.keys(WORKS)) {
      const w = WORKS[k];
      if (!w.on(tl)) continue;
      const pic = pics.includes(k) ? { img: workIcon(k, cl) } : { glyph: w.icon };
      if (!hasTech(me, w.tech)) {
        addAct({ ...pic, label: w.label, locked: true, title: `Research ${TECHS[w.tech].name}`,
          onClick: () => toast(`Research ${TECHS[w.tech].icon} ${TECHS[w.tech].name} in the Tech Tree first.`) });
        continue;
      }
      if (ONE_PER_CITY.includes(k) && cityHas(c, me, k)) continue;
      const pop = w.near ? w.each * countNear(x, y, w.near, me) : w.pop;
      const extra = pop ? ` +${pop}` : w.gain ? ` +${w.gain}⭐` : '';
      addAct({ ...pic, label: w.label + extra, cost: w.cost, disabled: pl.stars < w.cost || !workAllowed(c, me, x, y, k),
        onClick: () => { if (doWork(x, y, k, me)) { refreshSel(); ui(); showReward(); } } });
    }
  }
  if (hints.length) $('info-text').insertAdjacentHTML('beforeend', `<span>${hints.join(' ')}</span>`);
}
$('btn-deselect').onclick = () => select(null);

/* radial tech tree */
function renderTech() {
  const me = G.view, pl = G.players[me];
  $('tech-stars').innerHTML = `${STAR_SVG}${pl.stars}`;
  const keys = Object.keys(TECHS), roots = keys.filter(k => !TECHS[k].req);
  const kids = k => keys.filter(c => TECHS[c].req === k);
  const R = [0, 128, 232, 332], pos = {};
  roots.forEach((r, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / roots.length;
    pos[r] = { a, t: 1 };
    const k2 = kids(r);
    k2.forEach((c, j) => {
      const a2 = a + (k2.length > 1 ? (j - (k2.length - 1) / 2) * 0.44 : 0);
      pos[c] = { a: a2, t: 2 };
      kids(c).forEach(g => { pos[g] = { a: a2, t: 3 }; });
    });
  });
  const xy = k => [Math.cos(pos[k].a) * R[pos[k].t], Math.sin(pos[k].a) * R[pos[k].t]];
  // names sit on the side facing the centre, in the gap before the next node out
  const labelY = k => { const sn = Math.sin(pos[k].a); return Math.abs(sn) < 0.35 || sn < 0 ? 52 : -46; };
  let lines = '', nodes = '';
  for (const k of keys) {
    const [x, y] = xy(k), [px, py] = TECHS[k].req ? xy(TECHS[k].req) : [0, 0];
    const owned = hasTech(me, k), avail = techAvailable(me, k), cost = techCost(me, k);
    lines += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="${owned ? 'on' : ''}"/>`;
    const cls = owned ? 'owned' : avail ? (pl.stars >= cost ? 'avail' : 'avail short') : 'locked';
    nodes += `<g class="node ${cls}" data-tech="${k}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0" role="button" aria-label="${TECHS[k].name}${owned ? ', researched' : avail ? `, costs ${cost} stars` : ', locked'}">
      <circle r="34"/><text class="ic">${TECHS[k].icon}</text><text class="nm" y="${labelY(k)}">${TECHS[k].name}</text>
      ${owned ? '' : `<g class="price" transform="translate(27,-27)"><rect x="-18" y="-11" width="36" height="22" rx="11"/><text>${avail ? cost : '🔒'}</text></g>`}
    </g>`;
  }
  const center = `<g class="center"><circle r="50" fill="${pl.color}"/><image href="${tribeIcon(pl.tribe)}" x="-46" y="-50" width="92" height="92"/></g>`;
  $('tech-svg').innerHTML = `<g transform="translate(400,400)">${lines}${center}${nodes}</g>`;
  if (techSel && !$('tech-pop').hidden) showTechPop(techSel);
}
function showTechPop(k) {
  techSel = k;
  const t = TECHS[k], me = G.view, pl = G.players[me];
  const owned = hasTech(me, k), avail = techAvailable(me, k), cost = techCost(me, k);
  $('tp-title').textContent = `${t.icon} ${t.name}`;
  $('tp-desc').textContent = `${t.desc}.`;
  const cl = CLIMATES[pl.tribe];
  $('tp-unlocks').innerHTML = [
    ...Object.entries(UNITS).filter(([, u]) => u.tech === k).map(([uk, u]) => `<figure><img src="${unitIcon(uk, pl.tribe)}" alt=""><figcaption>${u.name}</figcaption></figure>`),
    ...Object.entries(WORKS).filter(([, w]) => w.tech === k).map(([wk, w]) => `<figure><img src="${workIcon(wk, cl)}" alt=""><figcaption>${w.label}</figcaption></figure>`),
  ].join('');
  const btn = $('tp-research');
  btn.innerHTML = owned ? 'Researched' : avail ? `Research ${STAR_SVG}${cost}` : `Needs ${TECHS[t.req].name}`;
  btn.disabled = owned || !avail || pl.stars < cost || !canAct();
  $('tech-pop').hidden = false;
}
$('tech-svg').addEventListener('click', e => {
  const n = e.target.closest('[data-tech]');
  if (n) { sfx('click'); showTechPop(n.dataset.tech); }
});
$('tech-svg').addEventListener('keydown', e => {
  const n = e.target.closest('[data-tech]');
  if (n && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); showTechPop(n.dataset.tech); }
});
$('tp-close').onclick = () => { $('tech-pop').hidden = true; techSel = null; };
$('tp-research').onclick = () => {
  const k = techSel;
  if (!k || !canAct()) return;
  if (research(G.view, k)) { sfx('tech'); toast(`Discovered ${TECHS[k].icon} ${TECHS[k].name}!`); refreshSel(); ui(); }
};

function renderGameMenu() {
  $('gm-title').textContent = `${G.mode === 'perfection' ? `Perfection · turn ${G.turn} of ${G.turnLimit}` : `Domination · turn ${G.turn}`} · ${G.diff[0].toUpperCase() + G.diff.slice(1)}`;
  $('gm-tribes').innerHTML = G.players.map((p, i) => ({ p, i, s: score(i) })).sort((a, b) => b.s - a.s).map(({ p, i, s }) =>
    `<div class="trow ${p.alive ? '' : 'dead'}"><img src="${tribeIcon(p.tribe)}" alt=""><b style="color:${p.color}">${esc(p.name)}${p.ai ? '' : ' 👤'}</b><span>${cityTiles(i).length} cities</span><span>${p.techs.length} techs</span><span class="num">${s.toLocaleString('en-US')}</span></div>`).join('');
  $('gm-sound').textContent = muted ? 'Sound: off' : 'Sound: on';
}

function showReward() {
  if (!G || G.over || !G.rewards.length || G.cur !== G.view) return;
  const r = G.rewards[0], c = { x: r.x, y: r.y, b: T(r.x, r.y).b };
  if (!c.b || c.b.kind !== 'city' || c.b.owner !== r.owner) { G.rewards.shift(); showReward(); return; }
  $('reward-title').textContent = `${c.b.name} · Level ${r.level}`;
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
  $('pass-img').src = tribeIcon(pl.tribe);
  $('pass-title').textContent = `${pl.name}'s turn`;
  $('pass-title').style.color = pl.color;
  $('pass-text').textContent = `Turn ${G.turn}. Hand the device to ${pl.name} and keep the screen hidden from the others.`;
  $('pass').hidden = false;
  ui();
}
$('btn-pass').onclick = () => {
  $('pass').hidden = true;
  focusHome(false);
  banner(`${G.players[G.cur].name}: turn ${G.turn}`, `+${income(G.cur)} stars`);
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
// Every tribe's homeland has its own climate: ground, cliffs, trees, rock, wildlife and fruit.
const CLIMATES = [
  { name: 'meadow', top: '#98d56d', top2: '#89c75f', side: '#8c6b46', side2: '#6f5437', lip: '#6ea94c', speck: '#7dbd58', tuft: '#5e9f45',
    tree: 'round', leaf: ['#70c459', '#52a84b', '#3a8a3f'], trunk: '#6b4a2b', rock: ['#bac2cc', '#959fac', '#727d8c'], peak: 'snow',
    animal: 'deer', fruit: 'berry', berry: '#e8403a', crop: '#f0c75a', flowers: ['#fff6c9', '#ffc4d8', '#cfe6ff'] },
  { name: 'autumn', top: '#e1bf65', top2: '#d2af57', side: '#9c6b3b', side2: '#7f5530', lip: '#b8933f', speck: '#c9a24c', tuft: '#ae873a',
    tree: 'autumn', leaf: ['#f49c3c', '#dd6b2d', '#b94a22'], leafAlt: [['#f6c444', '#e2a231', '#c07a22'], ['#ea583b', '#c8402c', '#9e2f24']],
    trunk: '#5e4128', rock: ['#bba490', '#978171', '#766253'], peak: 'bare', animal: 'boar', fruit: 'plum', berry: '#8e3bb0', crop: '#f2c04e', flowers: ['#ffdf7a', '#ff9f5a'] },
  { name: 'jungle', top: '#63c65e', top2: '#54b652', side: '#6c4b30', side2: '#563b26', lip: '#3f9c44', speck: '#56b852', tuft: '#399940',
    tree: 'jungle', leaf: ['#50be57', '#319c46', '#207b37'], trunk: '#5a3d24', rock: ['#98a995', '#778874', '#5c6c5d'], peak: 'moss',
    animal: 'tapir', fruit: 'banana', berry: '#ffd23f', crop: '#e9c95a', flowers: ['#ff6fa8', '#ffd23f', '#ffffff'] },
  { name: 'desert', top: '#f5dc99', top2: '#e9cd85', side: '#d39d5f', side2: '#b78149', lip: '#e4c380', speck: '#e0c07e', tuft: '#c8ad66',
    tree: 'palm', leaf: ['#6fbc54', '#4d9b44', '#367d37'], trunk: '#a07746', rock: ['#e7b175', '#c98b57', '#a46c43'], peak: 'mesa',
    animal: 'camel', fruit: 'cactus', berry: '#ff5c8a', crop: '#e8c46a', flowers: [] },
  { name: 'highland', top: '#afbc98', top2: '#a1ae8a', side: '#7f7c89', side2: '#676470', lip: '#8d9d77', speck: '#98a585', tuft: '#7e8f6a',
    tree: 'pine', leaf: ['#4c8c70', '#376e58', '#275041'], trunk: '#5a3d24', rock: ['#acaac1', '#88869f', '#67657e'], peak: 'snow',
    animal: 'goat', fruit: 'berry', berry: '#c0392b', crop: '#dcc56a', flowers: ['#d9c7ff', '#ffffff'] },
  { name: 'tundra', top: '#f4f9fd', top2: '#e4edf6', side: '#a3b7cc', side2: '#879db6', lip: '#ffffff', speck: '#d5e2ef', tuft: '#b6c6d7',
    tree: 'snowpine', leaf: ['#3c7c6a', '#2b6052', '#1e473d'], trunk: '#4a3324', rock: ['#bdccdc', '#99abc0', '#788aa0'], peak: 'ice',
    animal: 'reindeer', fruit: 'blueberry', berry: '#4a6cf0', crop: '#e9dfb0', flowers: [] },
];
const SKIN = ['#f1c9a5', '#c98a5e', '#8d5a3b', '#e3b27c', '#d9b38c', '#f6dcc8'];
const EMBLEMS = ['chevron', 'flame', 'leaf', 'sun', 'peak', 'flake'];
const DEPTH_COLS = ['#6ad9e3', '#5ccde0', '#48b2e2', '#3d96d7', '#3583ca', '#2e71b8'];
const CITY_SLOTS = [[0, -9], [-14, -2], [14, -2], [-7, 5], [8, 6], [0, 11]];
const hitAnims = new Map(), faces = new Map(), revealAt = new Map();
let parts = [], ambient = [], ghosts = [], bgGrad = null, vignette = null, demo = null;
const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();

const hash = (x, y, k = 0) => {
  let h = (x * 374761393 + y * 668265263 + k * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const colorCache = new Map();
function rgbOf(c) {
  if (c[0] === '#') { const n = parseInt(c.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  const m = c.match(/[\d.]+/g); // an rgb() string from an earlier shade() or mix()
  return [+m[0], +m[1], +m[2]];
}
function shade(c, f) { // f < 0 darkens, f > 0 lightens
  const key = c + '|' + f;
  let v = colorCache.get(key);
  if (v) return v;
  let [r, g, b] = rgbOf(c);
  if (f < 0) { r *= 1 + f; g *= 1 + f; b *= 1 + f; } else { r += (255 - r) * f; g += (255 - g) * f; b += (255 - b) * f; }
  v = `rgb(${r | 0},${g | 0},${b | 0})`;
  colorCache.set(key, v);
  return v;
}
function mix(a, b, t) {
  const key = a + '>' + b + '|' + t;
  let v = colorCache.get(key);
  if (v) return v;
  const A = rgbOf(a), B = rgbOf(b);
  v = `rgb(${(A[0] + (B[0] - A[0]) * t) | 0},${(A[1] + (B[1] - A[1]) * t) | 0},${(A[2] + (B[2] - A[2]) * t) | 0})`;
  colorCache.set(key, v);
  return v;
}
const climateOf = tl => CLIMATES[tl.c] || CLIMATES[0];

function resize() {
  dpr = window.devicePixelRatio || 1; W = innerWidth; H = innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0b2746'); bgGrad.addColorStop(1, '#061629');
  vignette = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.8);
  vignette.addColorStop(0, 'rgba(0,0,0,0)'); vignette.addColorStop(1, 'rgba(0,8,22,.45)');
}
const wxOf = (x, y) => (x - y) * TW / 2;
const wyOf = (x, y) => (x + y) * TH / 2;
function pick(mx, my) {
  const wx = (mx - W / 2) / cam.z + cam.x, wy = (my - H / 2) / cam.z + cam.y;
  const a = wx / (TW / 2), b = (wy - TH / 2) / (TH / 2);
  return { x: Math.round((a + b) / 2), y: Math.round((b - a) / 2) };
}

/* sprite cache: objects are painted once into small canvases and stamped onto the map */
const SPRITE_BUCKETS = [1.5, 2.5, 4];
let sprBucket = 2.5, sprBucketSince = 0, sprPurged = true, sprBudget = 0;
const spriteCache = new Map(), spriteLatest = new Map();
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return c;
}
function withCtx(c, fn) { // point the shared painters at another canvas for a moment
  const saved = ctx;
  ctx = c.getContext('2d');
  try { fn(); } finally { ctx = saved; }
}
function pickBucket(now) { // sprite resolution follows the zoom, one step at a time
  const want = cam.z * dpr, i = SPRITE_BUCKETS.indexOf(sprBucket);
  let b = sprBucket;
  if (want > sprBucket * 1.02 && i < SPRITE_BUCKETS.length - 1) b = SPRITE_BUCKETS[i + 1];
  else if (i > 0 && want < SPRITE_BUCKETS[i - 1] * 0.85) b = SPRITE_BUCKETS[i - 1];
  if (b !== sprBucket) { sprBucket = b; sprBucketSince = now; sprPurged = false; }
  if (!sprPurged && now - sprBucketSince > 2000) {
    for (const k of [...spriteCache.keys()]) if (!k.endsWith('@' + sprBucket)) spriteCache.delete(k);
    sprPurged = true;
  }
}
// box = [left, top, width, height] in world units around the anchor (the object's ground point)
function getSprite(key, box, paint, opts) {
  const k = key + '@' + sprBucket;
  let s = spriteCache.get(k);
  if (s) return s;
  const old = spriteLatest.get(key);
  if (old && sprBudget <= 0) return old; // keep using the old resolution until there is time to repaint
  sprBudget--;
  s = buildSprite(box, paint, sprBucket, opts || {});
  spriteCache.set(k, s); spriteLatest.set(key, s);
  return s;
}
function buildSprite(box, paint, scale, opts) {
  const [bx, by, bw, bh] = box, pw = Math.ceil(bw * scale), ph = Math.ceil(bh * scale);
  const art = makeCanvas(pw, ph);
  withCtx(art, () => { ctx.setTransform(scale, 0, 0, scale, -bx * scale, -by * scale); paint(); });
  if (opts.ao) withCtx(art, () => { // darken towards the ground
    ctx.setTransform(scale, 0, 0, scale, -bx * scale, -by * scale);
    ctx.globalCompositeOperation = 'source-atop';
    const g = ctx.createLinearGradient(0, opts.ao[0], 0, opts.ao[1]);
    g.addColorStop(0, 'rgba(20,30,40,0)'); g.addColorStop(1, 'rgba(20,30,40,.3)');
    ctx.fillStyle = g; ctx.fillRect(bx, by, bw, bh);
  });
  if (!opts.shadow) return { c: art, x: bx, y: by, w: bw, h: bh };
  // cast shadow: the silhouette flattened onto the ground away from the light, blurred by painting it small
  const q = 0.25, sw = Math.ceil(pw * q), sh = Math.ceil(ph * q), low = makeCanvas(sw, sh);
  withCtx(low, () => {
    ctx.setTransform(scale * q, 0, 0, scale * q, -bx * scale * q, -by * scale * q);
    ctx.transform(1, 0, -0.85, -0.34, 0, 0);
    ctx.drawImage(art, bx, by, bw, bh);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#0a1923'; ctx.fillRect(0, 0, sw, sh);
  });
  const out = makeCanvas(pw, ph);
  withCtx(out, () => {
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = opts.shadow; ctx.drawImage(low, 0, 0, pw, ph);
    ctx.globalAlpha = 1; ctx.drawImage(art, 0, 0);
  });
  return { c: out, x: bx, y: by, w: bw, h: bh };
}
function dimSprite(s, key) { // explored but out of sight: a darker copy
  const k = key + '|dim@' + sprBucket;
  let d = spriteCache.get(k);
  if (d) return d;
  const c = makeCanvas(s.c.width, s.c.height);
  withCtx(c, () => {
    ctx.drawImage(s.c, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(12,24,46,.42)'; ctx.fillRect(0, 0, c.width, c.height);
  });
  d = { c, x: s.x, y: s.y, w: s.w, h: s.h };
  spriteCache.set(k, d);
  return d;
}
function blit(s, x, y) { ctx.drawImage(s.c, x + s.x, y + s.y, s.w, s.h); }
function blitScaled(s, x, y, k) { ctx.drawImage(s.c, x + s.x * k, y + s.y * k, s.w * k, s.h * k); }
const BOX = {
  forest: [-40, -48, 108, 66], mountain: [-42, -54, 116, 74], fruit: [-26, -38, 70, 50], animal: [-30, -36, 76, 48],
  crop: [-30, -24, 70, 40], village: [-36, -42, 92, 60], ruin: [-34, -42, 86, 58], city: [-42, -80, 112, 102],
  port: [-36, -44, 84, 56], unit: [-38, -68, 76, 80],
};
const OPTS = {
  forest: { shadow: 0.28, ao: [-6, 12] }, mountain: { shadow: 0.24, ao: [-8, 14] }, fruit: { shadow: 0.24 }, animal: { shadow: 0.24 },
  crop: { shadow: 0.14 }, village: { shadow: 0.28 }, ruin: { shadow: 0.26 }, city: { shadow: 0.28 }, port: { shadow: 0.18 },
};
function objSprite(kind, key, paint, dim) {
  const s = getSprite(key, BOX[kind], paint, OPTS[kind]);
  return dim ? dimSprite(s, key) : s;
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
// A box with a pitched roof; the ridge runs from the left gable to the back right.
function gableBox(x, y, w, h, wall, wall2, roof, roof2, rh) {
  const hh = w / 2, L = [x - w, y - h], F = [x, y + hh - h], R = [x + w, y - h], B = [x, y - hh - h];
  poly([[x - w, y], [x, y + hh], F, L], wall);
  poly([[x, y + hh], [x + w, y], R, F], wall2);
  const M1 = [(L[0] + F[0]) / 2, (L[1] + F[1]) / 2 - rh], M2 = [(B[0] + R[0]) / 2, (B[1] + R[1]) / 2 - rh];
  poly([[L[0] - 0.8, L[1] + 0.4], B, M2, M1], roof);
  poly([L, F, M1], wall);
  poly([F, [R[0] + 0.8, R[1] + 0.4], M2, M1], roof2);
  ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 0.7; line(M1[0], M1[1], M2[0], M2[1]);
}
function cylinder(x, y, r, h, light, dark) {
  ctx.beginPath();
  ctx.moveTo(x - r, y - h); ctx.lineTo(x - r, y);
  ctx.ellipse(x, y, r, r / 2, 0, Math.PI, 0, true);
  ctx.lineTo(x + r, y - h);
  ctx.ellipse(x, y - h, r, r / 2, 0, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = light; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = dark; ctx.fillRect(x + r * 0.2, y - h - r, r, h + r * 2); ctx.restore();
}
function cone(x, y, r, h, light, dark) {
  const ry = r / 2, split = 0.42 * Math.PI;
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.lineTo(x - r, y); ctx.ellipse(x, y, r, ry, 0, Math.PI, split, true); ctx.closePath();
  ctx.fillStyle = light; ctx.fill();
  ctx.beginPath(); ctx.moveTo(x, y - h); ctx.ellipse(x, y, r, ry, 0, split, 0, true); ctx.closePath();
  ctx.fillStyle = dark; ctx.fill();
}
function dome(x, y, r, light, dark, k) {
  ctx.beginPath();
  ctx.ellipse(x, y, r, r * (k || 0.95), 0, Math.PI, 0, false);
  ctx.ellipse(x, y, r, r / 2, 0, 0, Math.PI, false);
  ctx.closePath();
  ctx.fillStyle = light; ctx.fill();
  ctx.save(); ctx.clip();
  ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x + r * 0.55, y - r * 0.1, r * 0.8, r * 1.2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  circle(x - r * 0.38, y - r * 0.5, r * 0.18, 'rgba(255,255,255,.55)');
}
// A rounded clump split into facets, each lit by how much it faces the upper-left light.
function lowBlob(x, y, rx, ry, cols, seed, n) {
  n = n || 8;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + hash(seed, i, 3) * 0.4, k = 0.86 + hash(seed, i, 5) * 0.22;
    pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]);
  }
  poly(pts, cols[1]);
  const c = [x - rx * 0.22, y - ry * 0.28];
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const mx = (p[0] + q[0]) / 2 - x, my = (p[1] + q[1]) / 2 - y;
    const lit = -(mx / rx) * 0.62 - (my / ry) * 0.78;
    poly([c, p, q], lit > 0.35 ? cols[0] : lit > -0.3 ? cols[1] : cols[2]);
  }
}
function rock(x, y, s, cols) {
  poly([[x - 5 * s, y + 1], [x - 3 * s, y - 4 * s], [x + 1 * s, y - 5.5 * s], [x + 5 * s, y - 2 * s], [x + 4 * s, y + 1.5]], cols[1]);
  poly([[x - 5 * s, y + 1], [x - 3 * s, y - 4 * s], [x + 1 * s, y - 5.5 * s], [x - 0.5 * s, y - 1 * s]], cols[0]);
  poly([[x + 1 * s, y - 5.5 * s], [x + 5 * s, y - 2 * s], [x + 4 * s, y + 1.5], [x - 0.5 * s, y - 1 * s]], cols[2]);
}
// A leaf or palm frond from (tx, ty) towards angle a, drooping at the tip; the upper half catches the light.
function frond(tx, ty, a, L, w, light, dark) {
  const dx = Math.cos(a), dy = Math.sin(a), nx = -dy, ny = dx;
  const tip = [tx + dx * L, ty + dy * L + L * 0.32], mid = [tx + dx * L * 0.52, ty + dy * L * 0.52 - L * 0.06];
  let up = [mid[0] + nx * w, mid[1] + ny * w], dn = [mid[0] - nx * w, mid[1] - ny * w];
  if (up[1] > dn[1]) [up, dn] = [dn, up];
  poly([[tx, ty], up, tip, mid], light);
  poly([[tx, ty], mid, tip, dn], dark);
}

/* terrain painters */
function sideFace(a, b, col, lip) {
  const d = LH, g = ctx.createLinearGradient(0, Math.min(a[1], b[1]), 0, Math.max(a[1], b[1]) + d);
  g.addColorStop(0, shade(col, 0.04)); g.addColorStop(1, shade(col, -0.34));
  poly([a, b, [b[0], b[1] + d], [a[0], a[1] + d]], g);
  ctx.strokeStyle = 'rgba(0,0,0,.13)'; ctx.lineWidth = 0.8;
  line(a[0], a[1] + d * 0.56, b[0], b[1] + d * 0.56);
  line(a[0], a[1] + d * 0.8, b[0], b[1] + d * 0.8);
  poly([a, b, [b[0], b[1] + 2.6], [a[0], a[1] + 2.6]], lip);
}
// One land slab: earthy cliff sides, a faceted top, fine texture and small ground details.
function paintLandTile(x, y, wx, wy, cl, tl) {
  const L = [wx - 32, wy + 16], Tp = [wx, wy], R = [wx + 32, wy + 16], B = [wx, wy + 32];
  sideFace(L, B, cl.side, cl.lip);
  sideFace(B, R, cl.side2, shade(cl.lip, -0.14));
  const j = (k, r) => (hash(x, y, k) - 0.5) * r;
  const C = [wx + j(1, 10), wy + 16 + j(2, 5)], tone = j(3, 0.07);
  const rocky = tl.t === 'mountain';
  const top = rocky ? mix(cl.top, cl.rock[0], 0.22) : cl.top, top2 = rocky ? mix(cl.top2, cl.rock[1], 0.25) : cl.top2;
  diamond(wx, wy, shade(top, tone));
  poly([Tp, L, C], shade(top, 0.05 + tone));
  poly([Tp, R, C], shade(top, tone));
  poly([L, B, C], shade(top2, tone + 0.01));
  poly([R, B, C], shade(top2, tone - 0.04));
  for (let i = 0; i < 10; i++) {
    const px = wx + j(10 + i, 48), py = wy + 16 + j(30 + i, 22);
    if (Math.abs(px - wx) / 30 + Math.abs(py - wy - 16) / 15 > 0.86) continue;
    ellipse(px, py, 1.3, 0.65, i % 2 ? shade(cl.speck, 0.12) : shade(cl.speck, rocky ? -0.25 : -0.1));
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255,255,255,.26)';
  ctx.beginPath(); ctx.moveTo(L[0] + 1, L[1]); ctx.lineTo(Tp[0], Tp[1] + 0.5); ctx.lineTo(R[0] - 1, R[1]); ctx.stroke();
  ctx.strokeStyle = 'rgba(30,20,10,.14)';
  ctx.beginPath(); ctx.moveTo(L[0] + 1, L[1]); ctx.lineTo(B[0], B[1] - 0.5); ctx.lineTo(R[0] - 1, R[1]); ctx.stroke();
  if (tl.imp === 'farm') paintFarm(wx, wy, cl);
  else if (tl.t === 'land' && !tl.res && !tl.b && !tl.imp) paintDecor(x, y, wx, wy + 16, cl);
}
function paintLandBlock(cl, wx, wy) { paintLandTile(3, 5, wx, wy, cl, { t: 'land' }); }
function paintDecor(x, y, cx, cy, cl) {
  const j = (k, r) => (hash(x, y, k) - 0.5) * r;
  if (cl.name === 'desert') {
    ctx.strokeStyle = 'rgba(255,248,225,.6)'; ctx.lineWidth = 1;
    for (let i = 0; i < 2; i++) {
      const ox = cx + j(70 + i, 18), oy = cy + j(72 + i, 8);
      ctx.beginPath(); ctx.moveTo(ox - 9, oy); ctx.quadraticCurveTo(ox, oy - 2.6, ox + 9, oy); ctx.stroke();
    }
    if (hash(x, y, 74) < 0.35) rock(cx + j(75, 24), cy + j(76, 8), 0.45, cl.rock);
    return;
  }
  if (cl.name === 'tundra') {
    for (let i = 0; i < 5; i++) {
      const px = cx + j(80 + i, 40), py = cy + j(85 + i, 16);
      if (Math.abs(px - cx) / 30 + Math.abs(py - cy) / 15 > 0.8) continue;
      poly([[px, py - 1.6], [px + 0.8, py], [px, py + 1.6], [px - 0.8, py]], 'rgba(255,255,255,.95)');
    }
    if (hash(x, y, 90) < 0.3) rock(cx + j(91, 24), cy + j(92, 8), 0.5, cl.rock);
    return;
  }
  const k = Math.floor(hash(x, y, 7) * 4);
  ctx.strokeStyle = cl.tuft; ctx.lineWidth = 1.2;
  for (let i = 0; i < k; i++) {
    const tx = cx + j(10 + i, 34), ty = cy + 2 + j(20 + i, 12);
    ctx.beginPath(); ctx.moveTo(tx - 2.6, ty - 3.4); ctx.lineTo(tx, ty); ctx.lineTo(tx + 2.6, ty - 3.8); ctx.moveTo(tx, ty); ctx.lineTo(tx - 0.4, ty - 5); ctx.stroke();
  }
  if (cl.flowers.length && hash(x, y, 30) < 0.45) for (let i = 0; i < 3; i++) {
    const fx = cx + j(31 + i, 28), fy = cy + j(34 + i, 11);
    circle(fx, fy, 1.5, cl.flowers[Math.floor(hash(x, y, 37 + i) * cl.flowers.length)]);
    circle(fx, fy, 0.6, '#ffd84a');
  }
  if (hash(x, y, 40) < 0.18) rock(cx + j(41, 24), cy + j(42, 9), 0.42, cl.rock);
}
function paintFarm(wx, wy, cl) {
  const T0 = [wx, wy + 3], R0 = [wx + 26, wy + 16], B0 = [wx, wy + 29], L0 = [wx - 26, wy + 16], C0 = [wx, wy + 16];
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const plots = [[T0, mid(T0, R0), C0, mid(L0, T0)], [mid(T0, R0), R0, mid(R0, B0), C0], [C0, mid(R0, B0), B0, mid(B0, L0)], [mid(L0, T0), C0, mid(B0, L0), L0]];
  const tints = cl.name === 'tundra' ? ['#e9dfb0', '#d9cf9c', '#c8d9a0', '#bda07a'] : ['#edca5d', '#ddb24a', '#b9cf62', '#b98a52'];
  plots.forEach((p, i) => {
    poly(p, tints[i]);
    ctx.save(); poly(p); ctx.clip();
    ctx.strokeStyle = shade(tints[i], -0.18); ctx.lineWidth = 0.9;
    for (let k = -7; k <= 7; k++) {
      if (i % 2) line(wx + k * 6 - 40, wy - 4, wx + k * 6 + 40, wy + 36);
      else line(wx + k * 6 - 40, wy + 36, wx + k * 6 + 40, wy - 4);
    }
    ctx.restore();
  });
  ctx.strokeStyle = '#8a6a3e'; ctx.lineWidth = 1;
  for (const [px, py] of [T0, R0, B0, L0]) line(px, py, px, py - 3.5);
}

/* trees */
function treeRound(x, y, s, cols, trunk, seed) {
  poly([[x - 1.7 * s, y + 0.5], [x + 1.7 * s, y + 0.5], [x + 1.2 * s, y - 10 * s], [x - 1.2 * s, y - 10 * s]], trunk);
  poly([[x + 0.2 * s, y + 0.5], [x + 1.7 * s, y + 0.5], [x + 1.2 * s, y - 10 * s], [x + 0.2 * s, y - 10 * s]], shade(trunk, -0.28));
  lowBlob(x, y - 15.5 * s, 9 * s, 8.2 * s, cols, seed, 9);
  lowBlob(x - 1.8 * s, y - 20.5 * s, 5.4 * s, 4.6 * s, [shade(cols[0], 0.1), cols[0], cols[1]], seed + 11, 7);
}
function treePine(x, y, s, cols, trunk, snowy) {
  poly([[x - 1.4 * s, y + 0.5], [x + 1.4 * s, y + 0.5], [x + 1.1 * s, y - 5 * s], [x - 1.1 * s, y - 5 * s]], trunk);
  for (const [w, yb, yt] of [[9.6, -3, -16], [7.6, -10, -23.5], [5.6, -17.5, -31]]) {
    const b0 = y + yb * s, t0 = y + yt * s, wd = w * s, dip = 1.9 * s;
    poly([[x - wd, b0], [x, t0], [x, b0 + dip]], cols[0]);
    poly([[x - wd * 0.42, b0 + dip * 0.4], [x, t0], [x, b0 + dip]], cols[1]);
    poly([[x, b0 + dip], [x, t0], [x + wd, b0]], cols[2]);
    if (snowy) {
      const sy = t0 + (b0 - t0) * 0.42;
      poly([[x - wd * 0.42, sy], [x, t0], [x, sy + dip * 0.42]], '#ffffff');
      poly([[x, sy + dip * 0.42], [x, t0], [x + wd * 0.42, sy]], '#d3e1ee');
      poly([[x - wd, b0], [x - wd * 0.5, b0 - 1.4 * s], [x, b0 + dip - 1.2 * s], [x, b0 + dip]], 'rgba(255,255,255,.9)');
    }
  }
}
function treePalm(x, y, s, cols, trunk) {
  const tx = x + 5 * s, ty = y - 23 * s, qx = x + 7 * s, qy = y - 11 * s;
  const P = t => [(1 - t) * (1 - t) * x + 2 * (1 - t) * t * qx + t * t * tx, (1 - t) * (1 - t) * y + 2 * (1 - t) * t * qy + t * t * ty];
  for (let i = 0; i < 7; i++) {
    const t0 = i / 7, t1 = (i + 1) / 7, [ax, ay] = P(t0), [bx, by] = P(t1), w0 = (2.4 - t0) * s, w1 = (2.4 - t1) * s;
    poly([[ax - w0, ay + 0.3], [ax + w0, ay + 0.3], [bx + w1, by], [bx - w1, by]], i % 2 ? trunk : shade(trunk, 0.14));
    poly([[ax + w0 * 0.25, ay + 0.3], [ax + w0, ay + 0.3], [bx + w1, by], [bx + w1 * 0.25, by]], shade(trunk, -0.24));
  }
  for (const [a, len] of [[-3.0, 12], [-2.45, 13], [-1.95, 11], [-1.2, 11.5], [-0.6, 12.5], [-0.05, 12]]) frond(tx, ty, a, len * s, 2.3 * s, cols[0], cols[2]);
  circle(tx - 1.4 * s, ty + 1.8 * s, 1.5 * s, '#7a5230'); circle(tx + 1.4 * s, ty + 2.2 * s, 1.5 * s, '#6b4626'); circle(tx, ty + 3.2 * s, 1.4 * s, '#7a5230');
}
function treeJungle(x, y, s, cols, trunk, seed) {
  ctx.strokeStyle = trunk; ctx.lineWidth = 2.8 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 3 * s, y - 13 * s, x - 0.5 * s, y - 25 * s); ctx.stroke();
  ctx.strokeStyle = shade(trunk, -0.3); ctx.lineWidth = 1 * s;
  ctx.beginPath(); ctx.moveTo(x + 1 * s, y); ctx.quadraticCurveTo(x - 1.8 * s, y - 13 * s, x + 0.6 * s, y - 24 * s); ctx.stroke();
  lowBlob(x - 6.5 * s, y - 23 * s, 7.2 * s, 5.6 * s, cols, seed, 8);
  lowBlob(x + 6.5 * s, y - 24 * s, 7.2 * s, 5.6 * s, cols, seed + 3, 8);
  lowBlob(x, y - 28.5 * s, 8.2 * s, 6.2 * s, [shade(cols[0], 0.08), cols[0], cols[1]], seed + 5, 9);
  ctx.strokeStyle = cols[2]; ctx.lineWidth = 0.9 * s;
  for (const vx of [-9, -3, 7]) {
    ctx.beginPath(); ctx.moveTo(x + vx * s, y - 21 * s); ctx.quadraticCurveTo(x + (vx + 1.5) * s, y - 15 * s, x + (vx - 0.5) * s, y - 11 * s); ctx.stroke();
  }
}
function fern(x, y, s, cols) { for (const a of [-2.75, -2.25, -1.55, -0.9, -0.4]) frond(x, y - s, a, 8.5 * s, 1.9 * s, cols[0], cols[2]); }
function cactus(x, y, s, cols, fruit) {
  const col = (cx, by, w, h) => {
    ctx.beginPath(); ctx.moveTo(cx - w, by); ctx.lineTo(cx - w, by - h + w); ctx.arc(cx, by - h + w, w, Math.PI, 0); ctx.lineTo(cx + w, by); ctx.closePath();
    ctx.fillStyle = cols[0]; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = cols[2]; ctx.fillRect(cx + w * 0.15, by - h, w, h); ctx.restore();
  };
  col(x - 6 * s, y - 7 * s, 1.7 * s, 9 * s);
  ctx.fillStyle = cols[1]; ctx.fillRect(x - 6 * s, y - 9.6 * s, 6 * s, 3 * s);
  col(x + 6 * s, y - 10 * s, 1.6 * s, 8 * s);
  ctx.fillStyle = cols[2]; ctx.fillRect(x, y - 12.6 * s, 6 * s, 2.8 * s);
  col(x, y, 2.9 * s, 22 * s);
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 0.6 * s; line(x - 1.2 * s, y - 1, x - 1.2 * s, y - 19 * s);
  if (fruit) for (const [fx, fy] of [[x, y - 22 * s], [x - 6 * s, y - 16 * s], [x + 6 * s, y - 18 * s]]) circle(fx, fy, 1.7 * s, '#ff5c8a', '#b02a55', 0.6);
}
function bush(x, y, s, cols, seed) { lowBlob(x, y - 3.5 * s, 6 * s, 4.5 * s, cols, seed, 7); }
function paintTreeFor(cl, x, y, s, seed) {
  switch (cl.tree) {
    case 'pine': return treePine(x, y, s, cl.leaf, cl.trunk, false);
    case 'snowpine': return treePine(x, y, s, cl.leaf, cl.trunk, true);
    case 'palm': return treePalm(x, y, s, cl.leaf, cl.trunk);
    case 'jungle': return treeJungle(x, y, s, cl.leaf, cl.trunk, seed);
    case 'autumn': { const sets = [cl.leaf, ...cl.leafAlt]; return treeRound(x, y, s, sets[seed % sets.length], cl.trunk, seed); }
    default: return treeRound(x, y, s, cl.leaf, cl.trunk, seed);
  }
}
function paintCabin(x, y, cl) {
  gableBox(x, y, 6, 5, '#bb8c57', '#9a6b3e', '#7a5230', '#58391f', 5.2);
  ctx.strokeStyle = 'rgba(60,35,15,.45)'; ctx.lineWidth = 0.6;
  for (let k = 1; k < 4; k++) { const yy = y - k * 1.25; line(x - 6, yy, x, yy + 3); line(x, yy + 3, x + 6, yy); }
  poly([[x + 2, y + 2], [x + 4, y + 1], [x + 4, y - 2.6], [x + 2, y - 1.6]], '#3a2616');
  if (cl.name === 'tundra') poly([[x, y - 2], [x + 6.8, y - 4.6], [x + 3.4, y - 10.5], [x - 3, y - 7.4]], 'rgba(255,255,255,.92)');
  for (const [lx, ly] of [[x - 10, y + 2], [x - 7.4, y + 2.6], [x - 8.7, y + 0.2]]) { circle(lx, ly, 1.7, '#c99a62', '#7a5230', 0.6); circle(lx, ly, 0.6, '#9a6d3f'); }
}
function paintForest(cl, v, hut) {
  const spots = [[-13, 1], [12, -1], [-1, 8], [2, -7]];
  const count = cl.tree === 'palm' || cl.tree === 'jungle' ? 3 : 4;
  const items = [];
  for (let i = 0; i < count; i++) items.push({ x: spots[i][0] + (hash(v, i, 1) - 0.5) * 6, y: spots[i][1] + (hash(v, i, 2) - 0.5) * 3, s: 0.8 + hash(v, i, 3) * 0.32, seed: v * 7 + i });
  if (hut) { items.splice(2, 1); items.push({ x: 3, y: 8, hut: true }); }
  items.push({ x: hash(v, 9, 1) < 0.5 ? -20 : 19, y: 4 + hash(v, 9, 2) * 3, under: true, seed: v + 40 });
  if (cl.name === 'autumn') for (let i = 0; i < 8; i++) ellipse((hash(v, i, 20) - 0.5) * 40, (hash(v, i, 21) - 0.5) * 16 + 2, 1.6, 0.8, [cl.leaf[0], cl.leaf[1], cl.leafAlt[0][0]][i % 3]);
  if (cl.name === 'tundra') for (const [mx, my] of [[-8, 5], [9, 3]]) ellipse(mx, my, 9, 3.2, 'rgba(255,255,255,.9)');
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.hut) paintCabin(it.x, it.y, cl);
    else if (it.under) {
      if (cl.tree === 'jungle') fern(it.x, it.y, 0.9, cl.leaf);
      else if (cl.tree === 'palm') cactus(it.x, it.y, 0.42, cl.leaf, false);
      else if (cl.name === 'tundra') { bush(it.x, it.y, 0.8, cl.leaf, it.seed); ellipse(it.x - 0.6, it.y - 5.4, 4.4, 1.8, '#ffffff'); }
      else if (cl.name === 'highland') rock(it.x, it.y, 0.7, cl.rock);
      else bush(it.x, it.y, 0.85, cl.leaf, it.seed);
    } else paintTreeFor(cl, it.x, it.y, it.s, it.seed);
  }
}

/* mountains */
function snowCap(A, base, k) {
  const pts = base.map(p => [A[0] + (p[0] - A[0]) * k, A[1] + (p[1] - A[1]) * k]), fills = ['#ffffff', '#e9f0f8', '#cddbea'];
  for (let i = 0; i < pts.length - 1; i++) {
    const p = pts[i], q = pts[i + 1], m = [(p[0] + q[0]) / 2 + 1, (p[1] + q[1]) / 2 + 3];
    poly([A, p, m, q], fills[Math.min(i, 2)]);
  }
}
function sandstonePeak(ax, ay, base, cl, seed) { // a weathered, flat-topped butte with layered rock
  const [r0, r1, r2] = cl.rock, [L, FL, FR, R] = base, j = k => (hash(seed, k, 11) - 0.5) * 3;
  const T1 = [ax - 5 + j(1), ay + j(2) * 0.4], T2 = [ax + 4 + j(3), ay + 1 + j(4) * 0.4];
  poly([T1, L, FL, [ax - 1, ay + 3]], r0);
  poly([[ax - 1, ay + 3], FL, FR, T2], mix(r0, r1, 0.5));
  poly([T2, FR, R], r2);
  poly([T1, [ax - 1, ay + 3], T2, [ax + 1, ay - 2.6]], shade(r0, 0.12));
  ctx.lineWidth = 1;
  for (let k = 1; k <= 4; k++) {
    const t = k / 5, at = (p, q) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    ctx.strokeStyle = k % 2 ? 'rgba(130,50,15,.28)' : 'rgba(255,235,200,.32)';
    ctx.beginPath(); const a1 = at(T1, L), a2 = at([ax - 1, ay + 3], FL), a3 = at(T2, FR), a4 = at(T2, R);
    ctx.moveTo(...a1); ctx.lineTo(...a2); ctx.lineTo(...a3); ctx.lineTo(...a4); ctx.stroke();
  }
}
function paintMesa(cl) {
  sandstonePeak(16, -15, [[2, 4], [12, 9], [20, 9], [31, 3]], cl, 2);
  sandstonePeak(-5, -27, [[-29, 6], [-12, 12], [6, 12], [24, 4]], cl, 1);
  rock(-22, 10, 0.7, cl.rock); rock(21, 9, 0.55, cl.rock); rock(4, 13, 0.45, cl.rock);
  bush(-17, 12, 0.55, cl.leaf, 7); cactus(25, 7, 0.32, cl.leaf, false);
}
function paintMineEntrance() {
  const x = -13, y = 10;
  poly([[x - 6, y + 0.5], [x - 6, y - 8], [x + 6, y - 8], [x + 6, y + 0.5]], '#5a3d24');
  ctx.fillStyle = '#140d09'; ctx.beginPath(); ctx.moveTo(x - 4.3, y + 0.5); ctx.lineTo(x - 4.3, y - 4); ctx.quadraticCurveTo(x, y - 8, x + 4.3, y - 4); ctx.lineTo(x + 4.3, y + 0.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#7a5230'; ctx.fillRect(x - 6.5, y - 9, 13, 2); ctx.fillRect(x - 6, y - 8, 1.8, 8.5); ctx.fillRect(x + 4.2, y - 8, 1.8, 8.5);
  ctx.strokeStyle = '#4a3a30'; ctx.lineWidth = 0.8; line(x + 2, y + 1.5, x + 18, y + 6); line(x + 1, y + 3, x + 17, y + 7.5);
  isoBox(x + 13, y + 6, 4, 3.4, '#6d6f78', '#55575f', '#3c3d44', 0);
  circle(x + 12.2, y + 1.8, 1.5, '#ffd34d'); circle(x + 14.4, y + 2.2, 1.3, '#f2b632'); circle(x + 13.4, y + 1, 1.2, '#ffe27a');
  circle(x + 10.6, y + 6.4, 1.2, '#2b2b2f'); circle(x + 15.6, y + 6.8, 1.2, '#2b2b2f');
}
function paintMountain(cl, mine) {
  const [r0, r1, r2] = cl.rock;
  if (cl.peak === 'mesa') paintMesa(cl);
  else {
    const B = [15, -21], L2 = [1, 4], F2 = [14, 9], R2 = [31, 3];
    poly([B, L2, F2], r1); poly([B, F2, R2], r2);
    const A = [-4, -38], L = [-29, 6], FL = [-11, 12], FR = [9, 12], R = [25, 4];
    poly([A, L, FL], r0); poly([A, FL, FR], mix(r0, r1, 0.55)); poly([A, FR, R], r2);
    poly([A, [-17, -6], L], shade(r0, 0.07));
    ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 0.9; line(A[0], A[1], FL[0], FL[1]);
    const cap = cl.peak === 'ice' ? 0.66 : cl.peak === 'snow' ? 0.4 : 0;
    if (cap) { snowCap(A, [L, FL, FR, R], cap); snowCap(B, [L2, F2, R2], cap * 0.85); }
    if (cl.peak === 'moss') {
      poly([[-27, 5], [-17, -7], [-10, 2], [-12, 11]], cl.leaf[1]);
      poly([[-12, 11], [-10, 2], [-2, -4], [4, 12]], cl.leaf[2]);
      poly([[9, 12], [14, 0], [22, 4], [24, 4]], cl.leaf[2]);
      poly([[-6, -18], [-3, -25], [1, -16]], cl.leaf[1]);
      bush(-20, 9, 0.7, cl.leaf, 3); bush(16, 10, 0.6, cl.leaf, 5);
    }
    if (cl.peak === 'bare') {
      ctx.strokeStyle = 'rgba(90,50,30,.25)'; ctx.lineWidth = 1;
      line(-22, 0, -8, 3); line(-15, -10, -6, -8); line(4, -6, 16, -2);
      treeRound(22, 9, 0.55, cl.leafAlt[0], cl.trunk, 9);
    }
    rock(-20, 9, 0.8, cl.rock); rock(21, 8, 0.6, cl.rock);
  }
  if (mine) paintMineEntrance();
}

/* fruit, wildlife and crops */
function paintBanana(cl) {
  ctx.strokeStyle = '#6f8d3c'; ctx.lineWidth = 2.2; line(0, 3, -1, -15);
  for (const a of [-2.8, -2.05, -1.15, -0.35]) frond(-1, -15, a, 13, 3.2, cl.leaf[0], cl.leaf[2]);
  for (let k = 0; k < 5; k++) ellipse(3 + k * 0.4, -10 + k * 1.6, 3.2, 1.3, k % 2 ? '#ffd23f' : '#f2c12e', '#b58a10', 0.4, -0.5);
  ctx.fillStyle = '#9b2335'; ctx.beginPath(); ctx.moveTo(4.5, -2.6); ctx.quadraticCurveTo(6.5, 0.5, 4.5, 2.2); ctx.quadraticCurveTo(2.5, 0.5, 4.5, -2.6); ctx.fill();
}
function paintFruit(cl) {
  if (cl.fruit === 'cactus') { cactus(-1, 6, 1.05, cl.leaf, true); cactus(-13, 8, 0.55, cl.leaf, true); rock(11, 8, 0.5, cl.rock); return; }
  if (cl.fruit === 'banana') { paintBanana(cl); return; }
  const big = cl.fruit === 'plum';
  lowBlob(1, -6, 11.5, 8.5, cl.leaf, 21, 9);
  lowBlob(-4, -10.5, 6.5, 5, [shade(cl.leaf[0], 0.08), cl.leaf[0], cl.leaf[1]], 22, 7);
  if (cl.fruit === 'blueberry') { ellipse(-2, -12.5, 6.5, 2.4, '#ffffff'); ellipse(5, -10, 4, 1.6, '#eef4fa'); }
  for (const [bx, by] of [[-6, -5], [4, -8], [6, -2], [-1, -10], [-3, -1], [9, -6]]) {
    circle(bx, by, big ? 2.5 : 2, cl.berry, shade(cl.berry, -0.45), 0.6);
    circle(bx - 0.6, by - 0.7, big ? 0.8 : 0.6, 'rgba(255,255,255,.75)');
  }
}
function legs(xs, top, cols, len) {
  xs.forEach((x, i) => {
    poly([[x - 1, top], [x + 1, top], [x + 0.8, 3], [x - 0.8, 3]], cols[i % cols.length]);
    ellipse(x, 3, 1.2, 0.6, '#2b211b');
  });
}
function deer(rein) {
  const c = rein ? '#9c8775' : '#b9814a', c2 = shade(c, -0.25), belly = rein ? '#efe6da' : '#ecd2a6';
  legs([-6.5, 6], -6, [c2]);
  poly([[-10, -9], [-7.5, -13], [5.5, -13.5], [9.5, -10.5], [8, -6], [-8.5, -5.5]], c);
  poly([[-8.5, -5.5], [8, -6], [7, -8.5], [-8, -8]], belly);
  poly([[-10, -9], [-7.5, -13], [-2, -13.4], [-6, -9.5]], shade(c, 0.1));
  if (!rein) for (const [sx, sy] of [[-4, -10.5], [-1, -11.5], [2.5, -10.5]]) circle(sx, sy, 0.8, 'rgba(255,255,255,.75)');
  poly([[5, -12.5], [8.5, -20], [11.5, -19], [9.5, -10]], c);
  if (rein) poly([[6, -11], [9.5, -15.5], [11.2, -12], [8.5, -8.5]], '#f3ece2');
  poly([[8.5, -20.5], [13.5, -20], [15.5, -17.4], [12, -16.6], [11.2, -19.4]], c);
  poly([[13.5, -18.6], [15.5, -17.4], [13.6, -16.6]], '#2b211b');
  poly([[9.2, -20.6], [7.4, -23], [10.2, -21.4]], c2);
  circle(12.2, -19.1, 0.6, '#1b1b1b');
  const k = rein ? 1.3 : 1, by = -20.8;
  ctx.strokeStyle = rein ? '#efe2c8' : '#d9c09a'; ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(10.6, by); ctx.lineTo(9, by - 4.7 * k); ctx.lineTo(7.2, by - 7.7 * k);
  ctx.moveTo(9, by - 4.7 * k); ctx.lineTo(11, by - 6.8 * k);
  ctx.moveTo(8, by - 6.4 * k); ctx.lineTo(8.8, by - 9.2 * k);
  ctx.moveTo(11.8, by + 0.2); ctx.lineTo(11.6, by - 4.2 * k); ctx.lineTo(12.8, by - 7.2 * k);
  ctx.moveTo(11.6, by - 4.2 * k); ctx.lineTo(13.8, by - 5.2 * k);
  ctx.stroke();
  legs([-4.5, 8], -6, [c, c2]);
  ellipse(-10.5, -10.5, 1.4, 1.1, '#ffffff');
}
function boar() {
  const c = '#5e3d2a', c2 = shade(c, -0.25);
  legs([-6, 5.5], -5, [c2]);
  poly([[-10, -7], [-8, -12], [3, -13], [9, -10], [10, -5.5], [-9, -4.5]], c);
  poly([[-10, -7], [-8, -12], [-2, -12.8], [-5, -7.5]], shade(c, 0.15));
  const ridge = [[-8, -12]];
  for (let i = 0; i <= 6; i++) ridge.push([-8 + i * 2, -12.6 - (i % 2 ? 1.6 : 0) - i * 0.12]);
  ridge.push([4, -12.4]);
  poly(ridge, '#3a2418');
  poly([[7, -11], [12.5, -9], [14.5, -6], [10, -4.5], [8, -6]], c);
  poly([[13.6, -8.2], [15.6, -7.4], [15.2, -5.4], [13.6, -5.8]], '#d79a8a');
  ctx.strokeStyle = '#fff6e0'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(13, -5.4); ctx.quadraticCurveTo(14.8, -6.2, 14.4, -8); ctx.stroke();
  poly([[8.6, -11], [9.4, -14], [10.6, -10.6]], c2);
  circle(11.4, -8.8, 0.55, '#111');
  legs([-4, 7.5], -5, [c, c2]);
  ctx.strokeStyle = c2; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(-10.6, -8.4, 1.3, 0.5, 4); ctx.stroke();
}
function tapir() {
  const dk = '#2d2b33', wh = '#ebe8e2';
  legs([-6, 5.5], -5, ['#1f1d24']);
  poly([[-10, -7], [-8.5, -12], [4.5, -12.5], [9, -9.5], [9, -5], [-9, -4.5]], dk);
  poly([[-4.5, -12.3], [2.5, -12.6], [3.5, -5], [-5, -4.8]], wh);
  poly([[-4.5, -12.3], [-1, -12.5], [-1.6, -5], [-5, -4.8]], '#ffffff');
  poly([[7.5, -11.5], [12, -10], [13.5, -7], [9.5, -5]], dk);
  poly([[12.5, -9], [15.5, -8.4], [15.2, -6.6], [13.2, -6.8]], '#3a3742');
  circle(10.6, -9.3, 0.55, '#ddd');
  poly([[8, -11.5], [8.6, -13.8], [9.8, -11.6]], dk);
  legs([-4, 7.5], -5, [dk, '#1f1d24']);
}
function camel() {
  const c = '#dba765', c2 = shade(c, -0.22), c3 = shade(c, 0.12);
  const leg = (x, col) => { poly([[x - 0.9, -9], [x + 0.9, -9], [x + 0.7, 3], [x - 0.7, 3]], col); ellipse(x, 3, 1.3, 0.6, '#5a4630'); };
  leg(-6.5, c2); leg(5, c2);
  poly([[-10, -12], [-8, -15], [6, -15.5], [9.5, -12.5], [8, -8.5], [-8.5, -8]], c);
  poly([[-5, -15], [-2, -21.5], [2.5, -15.5]], c3);
  poly([[-2, -21.5], [2.5, -15.5], [0.5, -15.4]], c2);
  poly([[6.5, -14.5], [9, -16.5], [11.5, -22], [13, -21], [11, -14]], c);
  poly([[11.5, -22.5], [15.5, -22], [16.5, -20], [13, -19.5]], c);
  circle(13.6, -21.4, 0.55, '#111');
  poly([[11.8, -22.6], [11.4, -24.6], [12.8, -22.8]], c2);
  leg(-4.5, c); leg(7, c2);
  ctx.strokeStyle = c2; ctx.lineWidth = 1; line(-10, -12, -11.6, -7.5);
}
function goat() {
  const c = '#eceae4', c2 = '#c9c6bd', horn = '#6d6a62';
  legs([-6, 5], -5, [c2]);
  poly([[-9.5, -7], [-7.5, -12], [4.5, -12.5], [8.5, -9.5], [7.5, -5], [-8.5, -4.6]], c);
  poly([[1, -12.5], [4.5, -12.5], [8.5, -9.5], [7.5, -5], [2, -5]], c2);
  poly([[6, -11.5], [9.5, -17], [12, -16], [10, -9.5]], c);
  poly([[9.5, -17.5], [14, -16.6], [14.5, -14.4], [11.2, -14]], c);
  poly([[12.6, -14.2], [13.6, -14], [13, -11.4]], '#bdb8ac');
  circle(12, -16.2, 0.55, '#111');
  ctx.strokeStyle = horn; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(10.6, -17.4); ctx.quadraticCurveTo(8.6, -22, 6.6, -18.6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(11.8, -17.4); ctx.quadraticCurveTo(10.6, -21.6, 8.8, -19.8); ctx.stroke();
  legs([-4, 7], -5, [c, c2]);
  ellipse(-9.4, -9, 1.1, 1.4, c2);
}
function paintAnimal(cl, flip) {
  if (flip) ctx.scale(-1, 1);
  switch (cl.animal) {
    case 'boar': return boar();
    case 'tapir': return tapir();
    case 'camel': return camel();
    case 'goat': return goat();
    case 'reindeer': return deer(true);
    default: return deer(false);
  }
}
function paintCrop(cl) {
  poly([[-21, 2], [-2, -8], [21, 2], [2, 12]], '#8a6a3e');
  poly([[-21, 2], [-2, -8], [1.5, -7], [-16.5, 2.8]], '#a07c4a');
  const head = cl.crop, dark = shade(cl.crop, -0.24), stalk = shade(cl.crop, -0.38);
  for (let sum = 0; sum <= 8; sum++) for (let u = 0; u <= 4; u++) {
    const v = sum - u;
    if (v < 0 || v > 4) continue;
    const bx = (u - v) * 4.4, by = (u + v) * 2.2 - 6;
    ctx.strokeStyle = stalk; ctx.lineWidth = 1; line(bx, by + 1, bx, by - 7);
    ellipse(bx, by - 8.4, 1.6, 3.1, head);
    ellipse(bx + 0.6, by - 8.2, 0.9, 2.8, dark);
  }
}

/* buildings: every tribe builds in its own style */
const WALL_MAT = ['wood', 'stone', 'wood', 'adobe', 'stone', 'ice'];
const PAVING = ['#cdb98f', '#d9d0be', '#bf9563', '#ecd7a9', '#c6c4ce', '#eef5fb'];
function hallFlag(style, level) { // top of the capital's flagpole, relative to the city's ground point
  const [sx, sy] = CITY_SLOTS[0], lv = Math.min(level, 6);
  switch (style) {
    case 0: return [sx, sy - (7 + lv * 0.6) - 10.5 - 9];
    case 1: return [sx + 6.5, sy - 3 - (18 + lv * 0.7) - 5 - 7];
    case 2: return [sx - 12, sy + 4 - (21 + lv) - 7];
    case 3: return [sx + 9.5, sy - 1 - (20 + lv * 0.6) - 2.4 - 6];
    case 4: return [sx, sy - (15 + lv * 1.3) - 11.6];
    default: return [sx + 9.5, sy - 2 - (19 + lv) - 6];
  }
}
function pole(x, y1, y2) { ctx.strokeStyle = '#3c3c3c'; ctx.lineWidth = 1; line(x, y1, x, y2); circle(x, y2, 0.9, '#ffd34d'); }
function yurt(x, y, pal, r, h, rh) {
  cylinder(x, y, r, h, '#f6f1e6', '#d6cebe');
  ctx.strokeStyle = pal.roof2; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(x, y - h * 0.42, r, r / 2, 0, 0.05, Math.PI - 0.05); ctx.stroke();
  cone(x, y - h, r + 0.9, rh, pal.roof, pal.roof2);
  const dx = x + r * 0.3, dy = y + r * 0.46;
  poly([[dx - 1.3, dy], [dx - 1.3, dy - 3.4], [dx + 1.3, dy - 3.7], [dx + 1.3, dy - 0.3]], '#6b4a2b');
  circle(x, y - h - rh, 0.9, shade(pal.roof, -0.4));
}
function timberBeams(x, y, w, h) {
  const hh = w / 2;
  ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 0.75;
  line(x - w * 0.5, y + hh * 0.5, x - w * 0.5, y + hh * 0.5 - h);
  line(x - w, y, x - w * 0.5, y + hh * 0.5 - h);
  line(x - w * 0.5, y + hh * 0.5, x, y + hh - h);
  line(x - w, y - h * 0.5, x, y + hh - h * 0.5);
  line(x + w * 0.5, y + hh * 0.5, x + w * 0.5, y + hh * 0.5 - h);
  poly([[x + w * 0.62, y + hh * 0.38 - h * 0.35], [x + w * 0.86, y + hh * 0.14 - h * 0.35], [x + w * 0.86, y + hh * 0.14 - h * 0.7], [x + w * 0.62, y + hh * 0.38 - h * 0.7]], '#3d5a7a');
}
function timberHouse(x, y, pal, w, h) {
  gableBox(x, y, w, h, '#f4e8ce', '#dbcaa7', pal.roof, pal.roof2, w * 0.95);
  timberBeams(x, y, w, h);
}
function stiltHut(x, y, pal, w, sh, h, rh) {
  ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 1.2;
  for (const [dx, dy] of [[-w + 1, -0.5], [0, w / 2 - 0.8], [w - 1, -0.5]]) line(x + dx, y + dy, x + dx, y + dy - sh);
  isoBox(x, y - sh, w, h, '#d6b072', '#b58f58', '#caa24c', rh);
  const ay = y - sh - h - rh;
  ctx.strokeStyle = 'rgba(120,80,30,.4)'; ctx.lineWidth = 0.6;
  line(x - w * 0.5, y - sh - h - rh * 0.5 + w * 0.25, x, y - sh - h + w * 0.5 - rh * 0.5);
  poly([[x - 2, ay + 3.4], [x, ay], [x + 2, ay + 3.4], [x, ay + 4.4]], pal.roof);
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.7;
  line(x + 1, y + w / 2 + 1.5, x + 2.4, y + w / 2 - sh + 1); line(x + 3, y + w / 2 + 1.2, x + 4.2, y + w / 2 - sh + 0.6);
}
function adobeHouse(x, y, pal, w, h) {
  isoBox(x, y, w, h, '#eed2a4', '#d3b281', '#f5dfb6', 0);
  const hh = w / 2, top = y - h;
  poly([[x - w, top], [x, top + hh], [x, top + hh - 1.4], [x - w, top - 1.4]], '#e2c290');
  poly([[x, top + hh], [x + w, top], [x + w, top - 1.4], [x, top + hh - 1.4]], '#c8a575');
  ctx.strokeStyle = '#fff0d2'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(x - w, top - 1.4); ctx.lineTo(x, top - hh - 1.4); ctx.lineTo(x + w, top - 1.4); ctx.stroke();
  poly([[x - w * 0.7, y + hh * 0.3 - h * 0.45], [x - w * 0.45, y + hh * 0.55 - h * 0.45], [x - w * 0.45, y + hh * 0.55 - h * 0.75], [x - w * 0.7, y + hh * 0.3 - h * 0.75]], '#6b4a2b');
  const dx = x + w * 0.45, dy = y + hh * 0.55;
  poly([[dx - 1.4, dy + 0.7], [dx + 1.4, dy - 0.7], [dx + 1.4, dy - 4], [dx - 1.4, dy - 2.6]], '#5a3d24');
  poly([[dx - 2.6, dy - 3.2], [dx + 2.6, dy - 5.8], [dx + 3.4, dy - 4.2], [dx - 1.8, dy - 1.6]], pal.roof);
}
function stoneLines(x, y, w, h) {
  const hh = w / 2;
  ctx.strokeStyle = 'rgba(70,65,80,.35)'; ctx.lineWidth = 0.55;
  for (let k = 1; k < 4; k++) { const d = h * k / 4; line(x - w, y - d, x, y + hh - d); line(x, y + hh - d, x + w, y - d); }
}
function stoneHouse(x, y, pal, w, h) {
  const slate = mix(pal.roof, '#5d5a70', 0.5);
  gableBox(x, y, w, h, '#d3d0da', '#aeabb8', slate, shade(slate, -0.25), w * 0.9);
  stoneLines(x, y, w, h);
  const hh = w / 2;
  poly([[x + w * 0.55, y + hh * 0.45 - h * 0.35], [x + w * 0.8, y + hh * 0.2 - h * 0.35], [x + w * 0.8, y + hh * 0.2 - h * 0.7], [x + w * 0.55, y + hh * 0.45 - h * 0.7]], '#3b3a4a');
}
function igloo(x, y, r) {
  dome(x, y, r, '#f7fbff', '#d2e2f0', 0.82);
  ctx.strokeStyle = 'rgba(120,150,180,.45)'; ctx.lineWidth = 0.6;
  for (const k of [0.34, 0.64]) {
    const s = Math.sqrt(1 - k * k);
    ctx.beginPath(); ctx.ellipse(x, y - r * 0.82 * k, r * s, r * 0.5 * s, 0, 0.15, Math.PI - 0.15); ctx.stroke();
  }
  line(x - r * 0.45, y + r * 0.2, x - r * 0.35, y - r * 0.28); line(x + r * 0.05, y + r * 0.45, x + r * 0.05, y - r * 0.05);
  const ex = x + r * 0.32, ey = y + r * 0.42;
  dome(ex, ey + 0.5, r * 0.42, '#eef5fc', '#c9dbeb', 0.9);
  ctx.fillStyle = '#2c3e50'; ctx.beginPath(); ctx.ellipse(ex + 0.6, ey + 0.6, r * 0.2, r * 0.26, 0, Math.PI, 0); ctx.fill();
}
function hallYurt(x, y, pal, lv) {
  const h = 7 + lv * 0.6, rh = 10.5;
  yurt(x, y, pal, 8, h, rh);
  pole(x, y - h - rh, hallFlag(0, lv)[1]);
}
function hallTimber(x, y, pal, lv) {
  const h = 9 + lv * 0.7, th = h + 9;
  isoBox(x + 6.5, y - 3, 3.2, th, '#f0e2c4', '#d4c09a', shade(pal.roof, -0.1), 5);
  pole(x + 6.5, y - 3 - th - 5, hallFlag(1, lv)[1]);
  gableBox(x, y, 8, h, '#f4e8ce', '#dbcaa7', pal.roof, pal.roof2, 8);
  timberBeams(x, y, 8, h);
}
function hallStilt(x, y, pal, lv) {
  stiltHut(x, y, pal, 8.5, 4, 6 + lv * 0.5, 11);
  const tx = x - 12, ty = y + 4, th = 21 + lv;
  for (let k = 0; k < 4; k++) {
    const y0 = ty - k * th / 4, odd = k % 2;
    isoBox(tx, y0, 1.9, th / 4 - 0.3, odd ? pal.roof : '#8a5a33', odd ? pal.roof2 : '#6b4626', odd ? shade(pal.roof, 0.15) : '#a0703f', 0);
    circle(tx - 0.9, y0 - th / 8 + 0.4, 0.45, '#ffffff'); circle(tx + 0.5, y0 - th / 8 + 0.8, 0.45, '#ffffff');
  }
  pole(tx, ty - th, hallFlag(2, lv)[1]);
}
function hallAdobe(x, y, pal, lv) {
  const h = 8 + lv * 0.6, mx = x + 9.5, my = y - 1, mh = h + 12, gold = mix(pal.roof, '#ffd34d', 0.45);
  cylinder(mx, my, 2, mh, '#f1d7ab', '#d3b281');
  dome(mx, my - mh, 2.4, gold, shade(gold, -0.25));
  pole(mx, my - mh - 2.4, hallFlag(3, lv)[1]);
  adobeHouse(x, y, pal, 8, h);
  dome(x, y - h - 1.4, 5.6, gold, shade(gold, -0.25));
}
function hallStone(x, y, pal, lv) {
  const w = 6.5, h = 15 + lv * 1.3, hh = w / 2, c1 = '#d3d0da', c2 = '#aeabb8', c3 = '#c4c1cc';
  isoBox(x, y, w, h, c1, c2, c3, 0);
  stoneLines(x, y, w, h);
  poly([[x - w * 0.75, y + hh * 0.25 - h * 0.9], [x - w * 0.35, y + hh * 0.65 - h * 0.9], [x - w * 0.35, y + hh * 0.65 - h * 0.45], [x - w * 0.55, y + hh * 0.45 - h * 0.38], [x - w * 0.75, y + hh * 0.25 - h * 0.45]], pal.roof);
  for (const [mx, my] of [[x, y - hh - h], [x - w, y - h], [x + w, y - h], [x - w / 2, y - h + hh / 2], [x + w / 2, y - h + hh / 2], [x, y + hh - h]]) isoBox(mx, my, 1.3, 2.6, c1, c2, c3, 0);
  pole(x, y - h, hallFlag(4, lv)[1]);
}
function hallFrost(x, y, pal, lv) {
  const sx = x + 9.5, sy = y - 2, sh = 19 + lv;
  poly([[sx - 3, sy], [sx - 0.5, sy - sh], [sx + 3, sy]], '#bfe6fb');
  poly([[sx, sy + 1.2], [sx - 0.5, sy - sh], [sx + 3, sy]], '#8fd0f2');
  poly([[sx - 3, sy], [sx - 0.5, sy - sh], [sx - 1, sy + 1]], '#e8f7ff');
  pole(sx - 0.5, sy - sh, hallFlag(5, lv)[1]);
  igloo(x, y, 8.5);
  poly([[x - 6, y - 4], [x - 2, y - 6], [x - 2, y - 3], [x - 6, y - 1]], pal.roof);
}
function building(style, x, y, kind, pal, level, i) {
  const lv = Math.min(level, 6);
  if (kind === 'hall') return [hallYurt, hallTimber, hallStilt, hallAdobe, hallStone, hallFrost][style](x, y, pal, lv);
  switch (style) {
    case 0: return yurt(x, y, pal, 5.3 + (i % 2) * 0.5, 4.2 + lv * 0.15, 6.2);
    case 1: return timberHouse(x, y, pal, 5.4, 5.2 + lv * 0.3);
    case 2: return stiltHut(x, y, pal, 5, 3.2, 4.3, 7);
    case 3: return adobeHouse(x, y, pal, 5.4, 5 + lv * 0.35 + (i % 3 === 1 ? 2.6 : 0));
    case 4: return stoneHouse(x, y, pal, 5.4, 5.6 + lv * 0.3);
    default: return igloo(x, y, 5.6 + (i % 2) * 0.4);
  }
}
function cityWalls(style, front) {
  const mat = WALL_MAT[style], i = 3;
  const top = [0, -16 + i], right = [32 - 2 * i, 0], bot = [0, 16 - i], left = [-32 + 2 * i, 0];
  for (const [a, b] of front ? [[right, bot], [bot, left]] : [[left, top], [top, right]]) {
    if (mat === 'wood') {
      for (let k = 0; k <= 9; k++) {
        const t = k / 9, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t;
        poly([[px - 1.2, py], [px - 1.2, py - 6], [px, py - 7.8], [px + 1.2, py - 6], [px + 1.2, py]], k % 2 ? '#8a5a33' : '#a0703f');
      }
      ctx.strokeStyle = '#5a3b22'; ctx.lineWidth = 0.8; line(a[0], a[1] - 3, b[0], b[1] - 3);
    } else {
      const c1 = mat === 'ice' ? '#e3f3fc' : mat === 'adobe' ? '#ecca97' : '#d4cbb7';
      const c2 = mat === 'ice' ? '#b9d8ec' : mat === 'adobe' ? '#cfaa76' : '#b2a995';
      poly([a, b, [b[0], b[1] - 6], [a[0], a[1] - 6]], front ? c1 : c2, shade(c2, -0.2), 0.6);
      poly([[a[0], a[1] - 6], [b[0], b[1] - 6], [b[0], b[1] - 7], [a[0], a[1] - 7]], shade(c1, 0.1));
      for (let k = 0; k <= 4; k++) {
        const t = k / 4;
        isoBox(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 6.5, 1.4, 2.4, c1, c2, shade(c1, 0.1), 0);
      }
    }
  }
}
function paintPlaza(style) {
  const c = PAVING[style];
  poly([[0, -11], [22, 0], [0, 11], [-22, 0]], c);
  poly([[0, -11], [-22, 0], [0, 11], [-2, 0]], shade(c, 0.05));
  ctx.strokeStyle = shade(c, -0.14); ctx.lineWidth = 0.5;
  for (let k = 1; k < 4; k++) { const t = k / 4; line(-22 + 22 * t, -11 * t, 22 * t, 11 - 11 * t); }
}
function paintCity(tribe, level, capital, wall) {
  const col = TRIBES[tribe].color, pal = { roof: col, roof2: shade(col, -0.24) };
  if (level >= 2) paintPlaza(tribe);
  if (wall) cityWalls(tribe, false);
  const items = [];
  for (let i = 0; i < Math.min(6, level + 1); i++) items.push({ x: CITY_SLOTS[i][0], y: CITY_SLOTS[i][1], i, hall: capital && i === 0 });
  items.sort((a, b) => a.y - b.y || a.x - b.x);
  for (const it of items) building(tribe, it.x, it.y, it.hall ? 'hall' : 'house', pal, level, it.i);
  if (wall) cityWalls(tribe, true);
}
function paintVillage(style) {
  const pal = { roof: '#b5803f', roof2: '#8f6430' };
  poly([[5, -10], [16, -4.5], [10, -1.5], [-1, -7]], '#8a6a3e');
  for (let k = 0; k < 4; k++) for (let m = 0; m < 3; m++) circle(2 + k * 3 + m * 1.6, -7 + k * 1.4 - m * 0.8 + 1.6, 0.9, '#6fb24f');
  building(style, -9, -1, 'house', pal, 1, 0);
  building(style, 9, 4, 'house', pal, 1, 1);
  const fx = -3, fy = 10;
  for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; circle(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 1.3, 0.8, '#8d8d8d'); }
  ctx.fillStyle = '#ff9a2e'; ctx.beginPath(); ctx.moveTo(fx, fy - 4.2); ctx.quadraticCurveTo(fx + 2, fy - 1, fx, fy + 0.4); ctx.quadraticCurveTo(fx - 2, fy - 1, fx, fy - 4.2); ctx.fill();
  ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.moveTo(fx, fy - 2.4); ctx.quadraticCurveTo(fx + 1, fy - 0.8, fx, fy + 0.2); ctx.quadraticCurveTo(fx - 1, fy - 0.8, fx, fy - 2.4); ctx.fill();
}
function brokenColumn(x, y, r, h) {
  cylinder(x, y, r, h, '#dcd6c8', '#b4ad9e');
  poly([[x - r, y - h], [x - r * 0.3, y - h - 2], [x + r * 0.2, y - h - 0.6], [x + r * 0.7, y - h - 2.4], [x + r, y - h], [x, y - h + r * 0.5]], '#e8e3d8');
  ellipse(x - r * 0.2, y - h - 0.6, r * 0.75, r * 0.32, '#6faa55');
}
function paintRuin() {
  poly([[-21, 4], [-3, -5], [17, 4], [-1, 13]], '#aba597');
  poly([[-21, 4], [-1, 13], [-1, 15.5], [-21, 6.5]], '#8d8779');
  poly([[-1, 13], [17, 4], [17, 6.5], [-1, 15.5]], '#77715f');
  ctx.strokeStyle = 'rgba(60,55,45,.35)'; ctx.lineWidth = 0.6; line(-12, 3, -4, 7); line(4, 1, 9, 6); line(-6, -1, 0, 2);
  brokenColumn(-11, 2, 2.6, 16);
  brokenColumn(10, 0, 2.6, 8);
  ctx.save(); ctx.translate(5, 8.5); ctx.rotate(-0.42);
  poly([[-6, -2.4], [6, -2.4], [6, 2.4], [-6, 2.4]], '#cfc8b9'); poly([[-6, 0.6], [6, 0.6], [6, 2.4], [-6, 2.4]], '#aaa394');
  ellipse(6, 0, 1.2, 2.4, '#e2ddd1'); ctx.restore();
  ctx.strokeStyle = '#4f8f45'; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(-13, -13); ctx.quadraticCurveTo(-9, -8, -12.4, -3); ctx.quadraticCurveTo(-10, 0, -11.6, 3); ctx.stroke();
  poly([[-2, 3], [0, -7], [2, 3]], '#8fe4ff'); poly([[0, 4], [0, -7], [2, 3]], '#4fb8e8'); poly([[-4.6, 4], [-3.6, -2], [-2.2, 4]], '#bdf0ff');
}
function paintPort(col) {
  ctx.strokeStyle = '#4a3220'; ctx.lineWidth = 1.4;
  for (const [px, py] of [[-15, 5], [-2, 11.5], [11, 5], [-2, -1.5]]) line(px, py, px, py + 6);
  isoBox(-2, 5, 13, 2.4, '#a8763f', '#8a5d30', '#c18b51', 0);
  ctx.strokeStyle = 'rgba(90,55,25,.4)'; ctx.lineWidth = 0.6;
  for (let k = 1; k < 7; k++) { const t = k / 7; line(-15 + 13 * t, 2.6 - 6.5 * t, -2 + 13 * t, 9.1 - 6.5 * t); }
  isoBox(-8, 2, 2.6, 2.6, '#c9965a', '#a87a45', '#d9a868', 0);
  cylinder(-4.5, 0.5, 1.6, 3.2, '#9a6a3a', '#7a5230');
  poly([[6, -6], [22, -6], [19, -1], [9, -1]], '#8a5a33', '#4a2f1a', 0.6);
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.1; line(14, -6, 14, -23);
  poly([[15, -22], [21.5, -8], [15, -8]], col); poly([[15, -22], [17, -8], [15, -8]], shade(col, -0.2));
}

/* units: chunky figures with tribal headgear */
function emblem(tribe, x, y, s, color) {
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineWidth = 1.1 * s; ctx.lineCap = 'round';
  switch (EMBLEMS[tribe]) {
    case 'chevron': ctx.beginPath(); ctx.moveTo(x - 2.6 * s, y + 1.4 * s); ctx.lineTo(x, y - 1.6 * s); ctx.lineTo(x + 2.6 * s, y + 1.4 * s); ctx.stroke(); break;
    case 'flame': ctx.beginPath(); ctx.moveTo(x, y - 3 * s); ctx.quadraticCurveTo(x + 2.6 * s, y, x, y + 2.4 * s); ctx.quadraticCurveTo(x - 2.6 * s, y, x, y - 3 * s); ctx.fill(); break;
    case 'leaf': ellipse(x, y, 1.5 * s, 2.8 * s, color, null, 0, 0.5); break;
    case 'sun':
      circle(x, y, 1.3 * s, color);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(x + Math.cos(a) * 1.9 * s, y + Math.sin(a) * 1.9 * s, x + Math.cos(a) * 2.9 * s, y + Math.sin(a) * 2.9 * s); }
      break;
    case 'peak': poly([[x - 3 * s, y + 2 * s], [x - 0.6 * s, y - 2.4 * s], [x + 1 * s, y + 0.2 * s], [x + 1.8 * s, y - 0.9 * s], [x + 3 * s, y + 2 * s]], color); break;
    default: for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3; line(x - Math.cos(a) * 2.8 * s, y - Math.sin(a) * 2.8 * s, x + Math.cos(a) * 2.8 * s, y + Math.sin(a) * 2.8 * s); }
  }
  ctx.lineCap = 'butt';
}
function headgear(tribe, phase, hx, hy, r, helmet, col) {
  if (helmet) {
    if (phase === 'back') return;
    ctx.beginPath(); ctx.arc(hx, hy - 0.4, r + 0.9, Math.PI, 0); ctx.closePath();
    ctx.fillStyle = '#b9c2cc'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#8f9aa8'; ctx.fillRect(hx + 1.6, hy - r - 2, r + 2, r + 2); ctx.restore();
    ctx.fillStyle = '#7d8896'; ctx.fillRect(hx - r - 0.9, hy - 1.4, 2 * r + 1.8, 1.7); ctx.fillRect(hx + 3.4, hy - 1.4, 1.3, 4.2);
    poly([[hx - 0.6, hy - r - 1.2], [hx - 7.5, hy - r - 2.6], [hx - 7, hy - r + 1.6], [hx + 1.4, hy - r + 0.6]], col);
    poly([[hx - 7.5, hy - r - 2.6], [hx - 7, hy - r + 1.6], [hx - 4, hy - r + 0.8]], shade(col, -0.25));
    return;
  }
  switch (tribe) {
    case 0: // tall felt hat with a feather
      if (phase === 'back') { ellipse(hx - 4.4, hy - 9.5, 1.3, 5, '#ffffff', null, 0, -0.45); return; }
      ellipse(hx, hy - 3.6, r + 3.4, 2.1, shade(col, -0.38));
      poly([[hx - 4.9, hy - 4.2], [hx + 4.9, hy - 4.2], [hx + 0.6, hy - 15]], col);
      poly([[hx + 0.6, hy - 15], [hx + 4.9, hy - 4.2], [hx + 1.2, hy - 4.2]], shade(col, -0.22));
      ctx.fillStyle = '#ffd34d'; ctx.fillRect(hx - 4.4, hy - 6.2, 8.8, 1.3);
      return;
    case 1: // fox-fur hood with ears
      if (phase === 'back') { circle(hx - 1, hy - 0.2, r + 1.7, '#c4622a'); return; }
      ctx.beginPath(); ctx.arc(hx, hy - 0.6, r + 1.3, Math.PI * 1.05, Math.PI * 1.95); ctx.quadraticCurveTo(hx + 1, hy - 3.2, hx - r - 1.2, hy - 1.4); ctx.closePath();
      ctx.fillStyle = '#d4702f'; ctx.fill();
      poly([[hx - 4.4, hy - 5.6], [hx - 5.6, hy - 11.6], [hx - 1.2, hy - 7]], '#d4702f'); poly([[hx - 4.2, hy - 6.4], [hx - 4.9, hy - 9.8], [hx - 2.4, hy - 7.2]], '#f6e2c8');
      poly([[hx + 1.2, hy - 7.2], [hx + 2.4, hy - 12.4], [hx + 4.9, hy - 6]], '#b85824'); poly([[hx + 2, hy - 7.4], [hx + 2.6, hy - 10.4], [hx + 4, hy - 6.8]], '#f6e2c8');
      ctx.strokeStyle = '#f6e2c8'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx + 0.4, hy - 0.2, r + 0.1, -2.5, -0.55); ctx.stroke();
      return;
    case 2: // headband with bright feathers
      if (phase === 'back') {
        ellipse(hx - 2.8, hy - 9.4, 1.5, 4.6, '#ffd23f', null, 0, -0.4); ellipse(hx - 0.2, hy - 10.4, 1.5, 4.8, '#ff5a4a'); ellipse(hx + 2.6, hy - 9.6, 1.5, 4.6, '#2fd1c4', null, 0, 0.4);
        return;
      }
      ctx.fillStyle = '#2d6b33'; ctx.fillRect(hx - r, hy - 4.6, 2 * r, 2.1);
      circle(hx + 3, hy - 3.6, 1, '#ffd23f'); circle(hx - 1, hy - 3.6, 1, col);
      return;
    case 3: // wrapped turban with a sun medallion
      if (phase === 'back') return;
      ellipse(hx - 0.4, hy - 3.6, r + 1, 3.8, '#f7f1e3');
      ellipse(hx - 0.6, hy - 6.2, r - 0.4, 3.1, '#ebe2cc');
      ctx.strokeStyle = 'rgba(160,140,100,.5)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.ellipse(hx - 0.4, hy - 4.6, r, 2.6, -0.15, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      circle(hx + 3.3, hy - 4.6, 1.7, '#ffd34d', '#c8901e', 0.5);
      return;
    case 4: // flat stone helm with a crest
      if (phase === 'back') return;
      poly([[hx - r - 0.7, hy - 0.6], [hx - r + 0.2, hy - r - 1.2], [hx + r - 0.2, hy - r - 1.2], [hx + r + 0.7, hy - 0.6]], '#95929f');
      poly([[hx + 1.8, hy - r - 1.2], [hx + r - 0.2, hy - r - 1.2], [hx + r + 0.7, hy - 0.6], [hx + 1.8, hy - 0.6]], '#74717f');
      ctx.fillStyle = '#5f5c6b'; ctx.fillRect(hx - r - 0.7, hy - 1.8, 2 * r + 1.4, 1.5); ctx.fillRect(hx + 3.5, hy - 1.8, 1.3, 4);
      poly([[hx - r + 0.6, hy - r - 1.2], [hx + r - 1, hy - r - 1.2], [hx + r - 2, hy - r - 3.2], [hx - r + 1.6, hy - r - 3.2]], col);
      return;
    default: // parka hood with a fur trim
      if (phase === 'back') { circle(hx - 0.8, hy + 0.2, r + 2.7, col); return; }
      ctx.beginPath(); ctx.arc(hx - 0.8, hy + 0.2, r + 2.7, Math.PI * 0.62, Math.PI * 1.66); ctx.arc(hx + 1.3, hy + 0.4, r - 0.3, Math.PI * 1.56, Math.PI * 0.7, true); ctx.closePath();
      ctx.fillStyle = col; ctx.fill();
      ctx.strokeStyle = '#f4f8fb'; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(hx + 1.3, hy + 0.4, r - 0.2, Math.PI * 1.5, Math.PI * 0.72, true); ctx.stroke();
  }
}
function blade(x1, y1, x2, y2, wd, light, dark) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len * wd / 2, ny = dx / len * wd / 2;
  const px = x1 + dx * 0.85, py = y1 + dy * 0.85;
  poly([[x1 + nx, y1 + ny], [px + nx * 0.85, py + ny * 0.85], [x2, y2], [x1, y1]], light);
  poly([[x1, y1], [x2, y2], [px - nx * 0.85, py - ny * 0.85], [x1 - nx, y1 - ny]], dark);
}
function towerShield(col, tribe) {
  const x = 1.4, y = -21.5, w = 9.6, h = 17;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - 4); ctx.quadraticCurveTo(x + w / 2, y + h + 1.6, x, y + h - 4); ctx.closePath();
  ctx.fillStyle = shade(col, 0.1); ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = shade(col, -0.14); ctx.fillRect(x + w * 0.55, y, w, h + 3); ctx.restore();
  ctx.strokeStyle = '#d1d8e0'; ctx.lineWidth = 1.3; ctx.stroke();
  emblem(tribe, x + w / 2, y + h * 0.42, 1, '#fff7e0');
}
function buckler(x, y, col, metal) {
  circle(x, y, 4, metal ? '#b9c2cc' : '#9a6a3a', metal ? '#7d8896' : '#6b4a2b', 1);
  circle(x, y, 1.4, metal ? col : '#c9d1da');
}
function heldWeapon(kind, w, col, skin, tribe) {
  const arm = (hx, hy) => { poly([[w - 2.6, -18.2], [w + 0.2, -18], [hx + 1.2, hy + 0.6], [hx - 1.4, hy + 1]], col); circle(hx, hy, 1.85, skin); };
  switch (kind) {
    case 'swordsman':
      blade(w + 2.2, -12.6, w + 9.5, -34, 2.6, '#f2f6fa', '#b9c4d0');
      arm(w + 1.6, -12);
      ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 2.2; line(w - 1.2, -14.4, w + 5.6, -10.8); circle(w + 0.6, -10.6, 1.1, '#ffd34d');
      break;
    case 'archer': {
      const cx = w + 3, cy = -15;
      ctx.lineWidth = 2; ctx.strokeStyle = '#8a5a30'; ctx.beginPath(); ctx.arc(cx - 3, cy, 10, -1.2, 1.2); ctx.stroke();
      ctx.strokeStyle = '#5e3b1e'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(cx - 3, cy, 10, 0.2, 1.2); ctx.stroke();
      const ex = cx - 3 + 10 * Math.cos(1.2), ey = 10 * Math.sin(1.2);
      ctx.strokeStyle = '#f3ead6'; ctx.lineWidth = 0.7; line(ex, cy - ey, ex - 3, cy); line(ex - 3, cy, ex, cy + ey);
      ctx.strokeStyle = '#d9b98a'; ctx.lineWidth = 0.9; line(ex - 3, cy, cx + 9, cy);
      poly([[cx + 9, cy - 1.2], [cx + 11.5, cy], [cx + 9, cy + 1.2]], '#c9d1da');
      arm(cx + 6.6, cy);
      break;
    }
    case 'defender': arm(w + 1, -12); towerShield(col, tribe); break;
    case 'giant':
      poly([[w + 0.5, -10], [w + 3.2, -11], [w + 9.5, -27], [w + 5.6, -29]], '#7a5634');
      for (const [sx, sy] of [[w + 6, -26], [w + 8.4, -24], [w + 7.4, -20]]) circle(sx, sy, 0.9, '#d9d2c4');
      arm(w + 1.6, -11.5);
      break;
    case 'staff': { // mind bender's staff with a glowing orb
      ctx.strokeStyle = '#7a4d2a'; ctx.lineWidth = 1.5; line(w + 2, -1, w + 4.5, -31);
      circle(w + 4.7, -33, 4.4, 'rgba(190,140,255,.28)');
      circle(w + 4.7, -33, 2.7, '#b98cff', '#6b3fb8', 0.7); circle(w + 3.8, -34, 0.9, '#f2e8ff');
      arm(w + 2.6, -13);
      break;
    }
    case 'spear':
      ctx.strokeStyle = '#8a5a30'; ctx.lineWidth = 1.4; line(w - 4, -2, w + 6, -31);
      poly([[w + 5.2, -31], [w + 7.4, -36.5], [w + 7.4, -30.6]], '#dfe6ee');
      arm(w + 1.2, -14);
      break;
    case 'lance':
      ctx.strokeStyle = '#c8a46a'; ctx.lineWidth = 2; line(-4, -11, 27, -24.5);
      poly([[26, -26.4], [31, -25.6], [27.6, -22.6]], '#dfe6ee');
      poly([[18, -22], [24, -20.5], [18.6, -18]], col);
      arm(w + 1, -13.5);
      break;
    default: // warrior's short sword
      blade(w + 2, -12, w + 6.6, -27, 1.9, '#eef3f8', '#b8c3cf');
      arm(w + 1.4, -11.5);
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.8; line(w - 0.4, -13.4, w + 4.4, -10.6);
  }
}
function paintPerson(type, tribe, col, skin, o) {
  o = o || {};
  const dark = shade(col, -0.22), deep = shade(col, -0.42), light = shade(col, 0.18);
  const helmet = type === 'defender' || type === 'swordsman' || type === 'knight';
  const w = type === 'swordsman' || type === 'giant' ? 7.2 : 6.3;
  if (type === 'archer') {
    poly([[-8.6, -19.5], [-5.6, -20.6], [-3.6, -10.5], [-6.4, -9.6]], '#7a4d2a');
    for (const [fx, fy] of [[-8.4, -21.5], [-6.6, -22.4], [-4.9, -21.6]]) poly([[fx - 1, fy + 1.6], [fx, fy - 1.6], [fx + 1, fy + 1.6]], col);
  }
  if (type === 'defender') { ctx.strokeStyle = '#7a4d2a'; ctx.lineWidth = 1.6; line(-7.6, 1, -7.6, -35); poly([[-9.6, -34], [-7.6, -40], [-5.6, -34]], '#dfe6ee'); }
  if (!o.noLegs) {
    const pants = shade(col, -0.55);
    poly([[-4.3, 0], [-1, 0], [-1, -7.2], [-4.1, -7.2]], pants);
    poly([[1, 0], [4.3, 0], [4.1, -7.2], [1, -7.2]], shade(pants, -0.18));
    ellipse(-2.5, 0.1, 2.5, 1.1, '#2a201a'); ellipse(2.9, 0.1, 2.5, 1.1, '#2a201a');
  }
  poly([[-w - 0.3, -18], [-w + 2.7, -18], [-w + 2.1, -10.6], [-w - 0.9, -11]], deep);
  circle(-w + 0.6, -10.4, 1.75, shade(skin, -0.18));
  if (type === 'warrior' || type === 'swordsman') buckler(-w + 0.2, -12.6, col, type === 'swordsman');
  poly([[-w, -6], [w, -6], [w - 1.3, -19], [-w + 1.3, -19]], col);
  poly([[0.9, -6], [w, -6], [w - 1.3, -19], [0.9, -19]], dark);
  poly([[-w, -6], [w, -6], [w - 0.3, -8], [-w + 0.3, -8]], deep);
  if (type === 'swordsman' || type === 'knight') {
    poly([[-w + 1.4, -9.6], [w - 1.4, -9.6], [w - 2, -18.6], [-w + 2, -18.6]], '#c6ced7');
    poly([[0.9, -9.6], [w - 1.4, -9.6], [w - 2, -18.6], [0.9, -18.6]], '#9ca8b5');
    ctx.strokeStyle = 'rgba(80,90,100,.5)'; ctx.lineWidth = 0.6; line(-w + 1.8, -14, w - 1.8, -14);
  }
  ctx.fillStyle = shade(col, -0.58); ctx.fillRect(-w + 0.6, -12, 2 * w - 1.2, 2.1);
  ctx.fillStyle = '#ffd34d'; ctx.fillRect(-1, -12.2, 2.3, 2.5);
  poly([[-3.2, -19], [3.4, -19], [0.6, -15.8]], light);
  const hx = 0.6, hy = -25.4, r = 6;
  headgear(tribe, 'back', hx, hy, r, helmet, col);
  circle(hx, hy, r, skin);
  ctx.save(); ctx.beginPath(); ctx.arc(hx, hy, r, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = shade(skin, -0.17); ctx.fillRect(hx + 1.8, hy - r, r, 2 * r); ctx.restore();
  ctx.fillStyle = '#1c1c1c'; ctx.fillRect(hx + 1.6, hy - 0.8, 1.3, 1.9); ctx.fillRect(hx + 4, hy - 0.8, 1.2, 1.8);
  circle(hx + 4.4, hy + 2.4, 1.1, 'rgba(255,110,110,.32)');
  headgear(tribe, 'front', hx, hy, r, helmet, col);
  heldWeapon(o.weapon || type, w, col, skin, tribe);
}
function paintHorse(coat, cloth, armored) {
  const dk = shade(coat, -0.26), dd = shade(coat, -0.46), lt = shade(coat, 0.12);
  const leg = (x, c) => { poly([[x - 1.1, -8], [x + 1.1, -8], [x + 0.9, -1], [x - 0.9, -1]], c); ellipse(x, -0.3, 1.4, 0.8, '#2a201a'); };
  leg(-7.5, dd); leg(5.2, dd);
  ctx.strokeStyle = dd; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-11, -12); ctx.quadraticCurveTo(-15.5, -9, -13.5, -3); ctx.stroke();
  poly([[-11.5, -11], [-9, -15], [6, -15.5], [10.5, -12.5], [9, -7.5], [-10, -7.2]], coat);
  poly([[-11.5, -11], [-9, -15], [-3, -15.4], [-7, -10.6]], lt);
  poly([[-10, -7.2], [9, -7.5], [8.4, -9.4], [-9.6, -9.2]], dk);
  poly([[5.8, -14.5], [10, -23], [13.6, -22], [11.6, -11]], coat);
  poly([[9.6, -23.4], [15.5, -23], [17.8, -19.6], [14.2, -18.4], [13.4, -21.6]], coat);
  poly([[15.2, -21], [17.8, -19.6], [15.4, -18.6]], dk);
  poly([[10.4, -23.4], [10.6, -26.6], [12.4, -23.6]], coat);
  poly([[6.4, -14.8], [9.8, -23.6], [11, -23.2], [8, -14.4]], dd);
  circle(13.8, -21.6, 0.65, '#111');
  leg(-5.2, coat); leg(7.6, dk);
  if (armored) {
    poly([[6.2, -14.2], [10.2, -22.4], [13.4, -21.6], [11.6, -11.4]], '#c6ced7');
    poly([[10, -23.2], [15.2, -22.8], [16.6, -20.4], [13.6, -20], [13.2, -21.8]], '#b2bcc7');
    for (const [rx, ry] of [[9, -18], [11, -15], [12.6, -21.4]]) circle(rx, ry, 0.5, '#7d8896');
  }
  if (cloth) {
    poly([[-7, -15.3], [4.8, -15.6], [5.6, -7.4], [-7.6, -7.2]], cloth);
    poly([[-7.6, -9.2], [5.6, -9.4], [5.6, -7.4], [-7.6, -7.2]], shade(cloth, -0.3));
    ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = 0.7; line(-7.4, -9.6, 5.5, -9.8);
  }
}
function paintCatapult(col, tribe) {
  poly([[-13, -8], [12, -8], [13, -4], [-12, -4]], '#9a6a3a', '#5a3b22', 0.8);
  poly([[-12, -4], [13, -4], [13, -2.6], [-12, -2.6]], '#6b4626');
  for (const wx of [-8, 8]) {
    circle(wx, -1.5, 3.6, '#5a3b22'); circle(wx, -1.5, 2.6, '#8a5a33');
    ctx.strokeStyle = '#5a3b22'; ctx.lineWidth = 0.7; line(wx - 2.4, -1.5, wx + 2.4, -1.5); line(wx, -3.9, wx, 0.9);
    circle(wx, -1.5, 0.9, '#3c2a1a');
  }
  isoBox(-10, -9, 3, 4, '#7d7d7d', '#5f5f5f', '#8f8f8f', 0);
  ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 2.2; line(-1, -8, 2.5, -19); line(6, -8, 2.5, -19);
  ctx.strokeStyle = '#a0703f'; ctx.lineWidth = 2.2; line(-10, -11, 13, -25);
  circle(2.5, -19, 1.2, '#4a3220');
  ellipse(13.5, -26, 3.2, 2, '#6b4626'); circle(13.5, -27.4, 2.3, '#a9a9a9'); circle(12.8, -28.2, 0.8, '#d6d6d6');
  ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1; line(-12.5, -8, -12.5, -26);
  poly([[-12.5, -26], [-4.5, -24.4], [-12.5, -21.6]], col);
  emblem(tribe, -9.6, -24, 0.55, '#fff7e0');
}
function paintBoat(col, tribe, ship) {
  if (ship === 'battleship') { // iron-clad hull, twin cannon and a tall war sail
    poly([[-25, -11], [25, -11], [19, 3], [-19, 3]], '#5d5866');
    poly([[-25, -11], [25, -11], [24, -8], [-24, -8]], '#8a8594');
    poly([[1, -8], [24, -8], [19, 3], [1, 3]], 'rgba(0,0,0,.2)');
    for (let k = -18; k <= 18; k += 6) circle(k, -4, 0.8, '#3c3944');
    ctx.strokeStyle = col; ctx.lineWidth = 1.6; line(-22, -1, 22, -1);
    for (const [x, d] of [[-15, -1], [17, 1]]) { isoBox(x, -11, 3, 2.6, '#7f7a89', '#5d5866', '#9f9aa8', 0); ctx.strokeStyle = '#2e2b33'; ctx.lineWidth = 2; line(x, -12.5, x + d * 8, -14.5); }
    ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.7; line(2, -11, 2, -48);
    poly([[-9, -45], [13, -46], [12, -19], [-8, -18]], '#f4efe2'); poly([[2, -45.5], [13, -46], [12, -19], [2, -18.5]], '#ddd5c3');
    poly([[-8.6, -37], [12.6, -37.6], [12.4, -33], [-8.4, -32.4]], col);
    emblem(tribe, 2, -26.5, 1.1, col);
    poly([[2, -48], [11, -46.2], [2, -44]], col);
  } else if (ship) {
    poly([[-23, -10], [23, -10], [18, 3], [-18, 3]], '#7a4d2a');
    poly([[-23, -10], [23, -10], [22, -7], [-22, -7]], '#a0703f');
    poly([[1, -7], [22, -7], [18, 3], [1, 3]], 'rgba(0,0,0,.16)');
    ctx.strokeStyle = 'rgba(40,20,5,.4)'; ctx.lineWidth = 0.6; line(-20, -3, 20, -3);
    ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.5; line(-5, -10, -5, -44); line(9, -10, 9, -40);
    poly([[-13, -40], [3, -41], [2, -18], [-12, -17]], '#f4efe2'); poly([[-5, -40.6], [3, -41], [2, -18], [-5, -17.6]], '#ddd5c3');
    poly([[-12.6, -32], [2.6, -32.6], [2.4, -28.6], [-12.4, -28]], col);
    poly([[3, -37], [15, -38], [14, -17], [4, -16]], '#f4efe2'); poly([[9, -37.5], [15, -38], [14, -17], [9, -16.5]], '#ddd5c3');
    emblem(tribe, 9, -27.5, 1, col);
    poly([[-5, -44], [3, -42.4], [-5, -40.4]], col);
  } else {
    poly([[-17, -7], [17, -7], [12, 3], [-12, 3]], '#8a5a33');
    poly([[-17, -7], [17, -7], [16, -5], [-16, -5]], '#a8763f');
    poly([[1, -5], [16, -5], [12, 3], [1, 3]], 'rgba(0,0,0,.16)');
    ctx.strokeStyle = 'rgba(40,20,5,.4)'; ctx.lineWidth = 0.6; line(-14, -1.5, 14, -1.5);
    ctx.strokeStyle = '#6b4626'; ctx.lineWidth = 1.1; line(-7, -5, -14, 5); line(10, -5, 16, 5);
    ctx.strokeStyle = '#4a2f1a'; ctx.lineWidth = 1.4; line(7, -7, 7, -35);
    poly([[8, -34], [18.5, -11], [8, -11]], col); poly([[8, -34], [12, -11], [8, -11]], shade(col, -0.2));
    emblem(tribe, 11.4, -16.5, 0.75, '#fff7e0');
  }
  ellipse(-16, 1.5, 3, 1, 'rgba(255,255,255,.55)'); ellipse(16, 1.5, 3, 1, 'rgba(255,255,255,.55)');
}
function paintUnit(type, tribe, medium) {
  const col = TRIBES[tribe].color, skin = SKIN[tribe];
  if (medium !== 'land') {
    paintBoat(col, tribe, medium === 'boat' ? false : medium);
    const who = type === 'catapult' || type === 'rider' || type === 'mindbender' ? 'warrior' : type;
    const weapon = { archer: 'archer', defender: 'defender', swordsman: 'swordsman', giant: 'giant', knight: 'spear', mindbender: 'staff' }[type] || 'warrior';
    ctx.save(); ctx.translate(-5, -7); ctx.scale(0.85, 0.85); paintPerson(who, tribe, col, skin, { noLegs: true, weapon }); ctx.restore();
    return;
  }
  switch (type) {
    case 'rider': paintHorse('#8a5a33', col, false); ctx.save(); ctx.translate(-1.2, -9.5); paintPerson('rider', tribe, col, skin, { noLegs: true, weapon: 'spear' }); ctx.restore(); break;
    case 'knight': paintHorse('#e5e6ea', col, true); ctx.save(); ctx.translate(-1.2, -9.5); paintPerson('knight', tribe, col, skin, { noLegs: true, weapon: 'lance' }); ctx.restore(); break;
    case 'catapult': paintCatapult(col, tribe); break;
    case 'giant': ctx.save(); ctx.scale(1.55, 1.55); paintPerson('giant', tribe, col, skin, {}); ctx.restore(); break;
    case 'mindbender': // long robe instead of legs
      poly([[-6.4, 0.4], [6.4, 0.4], [5, -8], [-5, -8]], shade(col, -0.35));
      poly([[0.9, 0.4], [6.4, 0.4], [5, -8], [0.9, -8]], shade(col, -0.5));
      paintPerson('mindbender', tribe, col, skin, { noLegs: true, weapon: 'staff' });
      break;
    default: paintPerson(type, tribe, col, skin, {});
  }
}


/* improvements added by the full tech tree */
function paintOre() { // glinting metal on a mountainside
  for (const [x, y, r] of [[-15, 4, 2.2], [-11, 6, 1.6], [14, 5, 1.9], [17, 7, 1.4], [-3, 9, 1.5]]) {
    poly([[x - r, y], [x - r * 0.3, y - r * 1.1], [x + r, y - r * 0.4], [x + r * 0.6, y + r * 0.6]], '#6d6f7c');
    circle(x - r * 0.1, y - r * 0.3, r * 0.45, '#ffd34d');
  }
}
function paintWindmill(col) {
  ctx.beginPath(); ctx.moveTo(-5, 4); ctx.lineTo(-3.4, -20); ctx.lineTo(3.4, -20); ctx.lineTo(5, 4); ctx.closePath(); ctx.fillStyle = '#e9e2d2'; ctx.fill();
  poly([[0.8, 4], [5, 4], [3.4, -20], [0.8, -20]], '#cbc2ae');
  cone(0, -20, 4.6, 6, col, shade(col, -0.25));
  poly([[-1.4, 4], [1.4, 4], [1.4, -1], [-1.4, -1]], '#6b4a2b');
  circle(0, -16, 1.2, '#5a3d24');
}
function windmillBlades(x, y, now) { // drawn live so they turn
  const a = reduceMotion ? 0.4 : now / 700;
  for (let k = 0; k < 4; k++) {
    const t = a + k * Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
    poly([[x + c * 1.5, y + s * 1.5], [x + c * 13 - s * 1.2, y + s * 13 + c * 1.2], [x + c * 13 + s * 2.6, y + s * 13 - c * 2.6], [x + c * 3 + s * 2.4, y + s * 3 - c * 2.4]], k % 2 ? '#f5efe2' : '#e2d8c4', '#8a6a3e', 0.5);
  }
  circle(x, y, 1.5, '#5a3d24');
}
function paintSawmill(col) {
  gableBox(-2, 4, 7, 5.5, '#c39461', '#a07546', col, shade(col, -0.25), 5);
  ctx.save(); ctx.translate(9, 1); ctx.rotate(-0.45);
  poly([[-7, -1.6], [7, -1.6], [7, 1.6], [-7, 1.6]], '#b98a55'); ellipse(7, 0, 0.9, 1.6, '#e0b98a');
  ctx.restore();
  circle(7, -5, 3.6, '#c9d1da', '#7d8896', 0.8); circle(7, -5, 0.9, '#5f6b78');
  for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; circle(7 + Math.cos(a) * 3.6, -5 + Math.sin(a) * 3.6, 0.5, '#7d8896'); }
}
function paintForge(col) {
  isoBox(0, 4, 7.5, 7, '#9f9aa8', '#7f7a89', '#5d5866', 0);
  stoneLines(0, 4, 7.5, 7);
  isoBox(-4, -2, 1.8, 9, '#8a8594', '#6d6877', '#4f4b57', 0);
  poly([[1.4, 7.4], [5, 5.6], [5, 0.8], [1.4, 2.6]], '#ff8c2e');
  poly([[2, 6.8], [4.4, 5.6], [4.4, 2.6], [2, 3.8]], '#ffd34d');
  ctx.fillStyle = col; ctx.fillRect(-7, -3.4, 1.6, 4);
}
function paintMarket(col) {
  for (const [x, y] of [[-8, -1], [7, 3]]) {
    ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1; line(x - 5, y + 2, x - 5, y - 7); line(x + 5, y + 2, x + 5, y - 7);
    isoBox(x, y + 2, 5, 2.4, '#c9965a', '#a87a45', '#d9a868', 0);
    for (let k = 0; k < 4; k++) poly([[x - 6 + k * 3, y - 6.6 + k * 0.4], [x - 3 + k * 3, y - 6.2 + k * 0.4], [x - 3.4 + k * 3, y - 3 + k * 0.4], [x - 6.4 + k * 3, y - 3.4 + k * 0.4]], k % 2 ? '#f6f0e2' : col);
    circle(x - 1.5, y - 0.4, 1.1, '#e8403a'); circle(x + 1, y - 0.2, 1.1, '#ffd23f');
  }
}
function paintTemple(col, base) {
  const stone = base === 'wtemple' ? '#e3f1f8' : '#e6e0d2', stone2 = base === 'wtemple' ? '#bcd6e4' : '#c2baa8';
  if (base === 'wtemple') isoBox(0, 6, 12, 3, '#cbb9a0', '#ad9a80', '#ddd0bc', 0);
  isoBox(0, base === 'wtemple' ? 3 : 6, 10, 2.4, stone2, shade(stone2, -0.15), stone, 0);
  const y0 = base === 'wtemple' ? 0.6 : 3.6;
  for (const [x, y] of [[-7, y0 - 0.5], [-2.4, y0 + 1.8], [2.4, y0 + 1.8], [7, y0 - 0.5]]) cylinder(x, y, 1.2, 9, stone, stone2);
  poly([[-10, y0 - 9], [0, y0 - 4], [10, y0 - 9], [0, y0 - 14]], stone);
  poly([[-10.5, y0 - 9], [0, y0 - 3.6], [0, y0 - 2], [-10.5, y0 - 7.4]], stone2);
  poly([[0, y0 - 3.6], [10.5, y0 - 9], [10.5, y0 - 7.4], [0, y0 - 2]], shade(stone2, -0.12));
  poly([[-8, y0 - 10], [0, y0 - 17.5], [8, y0 - 10], [0, y0 - 6]], col);
  poly([[0, y0 - 17.5], [8, y0 - 10], [0, y0 - 6]], shade(col, -0.22));
}
function drawWhale(x, y, cx, cy, now, dim) {
  const t = now / 1000 + hash(x, y, 61) * 10, ph = (t % 4) / 4;
  ctx.globalAlpha = dim ? 0.5 : 1;
  const up = Math.max(0, Math.sin(ph * Math.PI * 2)) * 2.5;
  ctx.beginPath(); ctx.ellipse(cx - 2, cy + 2 - up, 12, 4.5, 0, Math.PI, 0); ctx.fillStyle = '#3f5568'; ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx - 4, cy + 1 - up, 8, 2.6, 0, Math.PI, 0); ctx.fillStyle = '#5a7387'; ctx.fill();
  poly([[cx + 9, cy + 2 - up], [cx + 15, cy - 3 - up], [cx + 14, cy + 2 - up]], '#3f5568');
  if (ph < 0.35) { const k = ph / 0.35; ctx.strokeStyle = `rgba(255,255,255,${0.8 * (1 - k)})`; ctx.lineWidth = 1.2; for (const dx of [-2, 0, 2]) line(cx - 6, cy - 3 - up, cx - 6 + dx * (1 + k * 2), cy - 6 - up - k * 8); }
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx - 2, cy + 2.4, 14, 3, 0, 0, 6.283); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawRoads(n, V) { // dirt paths between neighbouring roads and cities, painted into the ground layer
  const roadish = (x, y) => inb(x, y) && V[y][x] && (T(x, y).road || (T(x, y).b && T(x, y).b.kind === 'city'));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!roadish(x, y) || isWater(T(x, y))) continue;
    const cx = wxOf(x, y), cy = wyOf(x, y) + TH / 2;
    const links = DIRS.filter(([dx, dy]) => roadish(x + dx, y + dy) && !isWater(T(x + dx, y + dy)));
    if (!links.length && !T(x, y).road) continue;
    for (const [w, col] of [[5, '#8a6a3e'], [3, '#c9a86a']]) {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [dx, dy] of links) { ctx.moveTo(cx, cy); ctx.lineTo((cx + wxOf(x + dx, y + dy)) / 2, (cy + wyOf(x + dx, y + dy) + TH / 2) / 2); }
      if (!links.length) { ctx.moveTo(cx - 3, cy); ctx.lineTo(cx + 3, cy); }
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }
}

/* clouds over the unexplored world */
const PUFFS = [
  [[-11, 3, 9], [-2, -3, 11.5], [9, 1, 9.5], [3, 5, 8], [-6, 6, 7.5]],
  [[-10, 2, 10], [1, -4, 12], [11, 2, 8.5], [-1, 5, 9]],
  [[-12, 4, 8], [-4, -2, 10], [6, -3, 10.5], [13, 3, 7.5], [2, 6, 8]],
];
function paintPuff(i) {
  const cs = PUFFS[i];
  for (const [x, y, r] of cs) circle(x + 1.2, y + 2.6, r, '#b8c7da');
  for (const [x, y, r] of cs) circle(x, y, r * 0.94, '#eef3f9');
  ctx.globalCompositeOperation = 'source-atop';
  const g = ctx.createLinearGradient(0, -16, 0, 15);
  g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(140,165,200,.45)');
  ctx.fillStyle = g; ctx.fillRect(-30, -22, 60, 44);
  ctx.globalCompositeOperation = 'source-over';
  for (const [x, y, r] of cs.slice(0, 2)) circle(x - r * 0.3, y - r * 0.36, r * 0.42, 'rgba(255,255,255,.8)');
}
function paintPuffShadow(i) {
  for (const [x, y, r] of PUFFS[i]) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * 1.3);
    g.addColorStop(0, 'rgba(8,28,58,.5)'); g.addColorStop(1, 'rgba(8,28,58,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 1.3, 0, Math.PI * 2); ctx.fill();
  }
}
function puffAt(x, y, i, t, grow) {
  const wx = wxOf(x, y), wy = wyOf(x, y) + TH / 2 - 10;
  const ox = (hash(x, y, i) - 0.5) * 26, oy = (hash(x, y, i + 4) - 0.5) * 10;
  return {
    x: wx + ox * (1 + grow * 0.9) + Math.sin(t / 2600 + i * 2 + x * 0.7) * 2,
    y: wy + oy - grow * 18 + Math.cos(t / 3100 + i + y) * 1.2,
    s: (0.8 + hash(x, y, i + 8) * 0.36) * (1 + grow * 0.6),
    v: Math.floor(hash(x, y, i + 12) * 3),
  };
}
function cloudSprites() {
  return {
    shadows: [0, 1, 2].map(i => getSprite('puffsh' + i, [-30, -24, 60, 48], () => paintPuffShadow(i))),
    puffs: [0, 1, 2].map(i => getSprite('puff' + i, [-25, -21, 52, 42], () => paintPuff(i))),
  };
}
function paintPuffs(list, t, sp) {
  for (const [x, y, a, g] of list) for (let i = 0; i < 3; i++) {
    const p = puffAt(x, y, i, t, g);
    ctx.globalAlpha = a * 0.42; blitScaled(sp.shadows[p.v], p.x + 7, p.y + 11, p.s);
  }
  for (const [x, y, a, g] of list) for (let i = 0; i < 3; i++) {
    const p = puffAt(x, y, i, t, g);
    ctx.globalAlpha = a; blitScaled(sp.puffs[p.v], p.x, p.y, p.s);
  }
  ctx.globalAlpha = 1;
}
const cloudCaches = new Map();
function cloudLayer(now, key) { // every resting cloud, painted once per change in what has been explored
  const id = G.seed + '|' + G.n;
  let c = cloudCaches.get(id);
  if (c && (c.key === key || now - c.at < 150)) return c;
  const n = G.n, V = G.vis[G.view], { X0, Y0, Wd, Ht } = groundDims(n), y0 = Y0 - 24, h = Ht + 48;
  const S = Math.min(groundScale(n), 1.3), pw = Math.ceil(Wd * S), ph = Math.ceil(h * S);
  const canvas = c && c.c.width === pw && c.c.height === ph ? c.c : makeCanvas(pw, ph), list = [];
  for (let s = -4; s <= 2 * n + 2; s++) for (let x = Math.max(-2, s - n - 1); x <= Math.min(n + 1, s + 2); x++) {
    const y = s - x;
    if (y < -2 || y > n + 1) continue;
    if (x < 0 || y < 0 || x >= n || y >= n || !V[y][x]) list.push([x, y, 1, 0]);
  }
  const sp = cloudSprites();
  withCtx(canvas, () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(S, 0, 0, S, -X0 * S, -y0 * S);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    paintPuffs(list, 0, sp);
  });
  c = { key, c: canvas, x: X0, y: y0, w: Wd, h, at: now };
  cloudCaches.delete(id); cloudCaches.set(id, c);
  if (cloudCaches.size > 2) cloudCaches.delete(cloudCaches.keys().next().value);
  return c;
}
function drawClouds(now, n, V, onScreen, key) {
  const t = reduceMotion ? 0 : now, layer = cloudLayer(now, key);
  ctx.drawImage(layer.c, layer.x + Math.sin(t / 3200) * 1.6, layer.y + Math.cos(t / 4100) * 1, layer.w, layer.h);
  const parting = [];
  for (const [k, r] of revealAt) {
    if (now - r >= 900) { revealAt.delete(k); continue; }
    const [x, y] = k.split(',').map(Number);
    if (onScreen(x, y, 30)) { const g = (now - r) / 900; parting.push([x, y, 1 - g, g]); }
  }
  if (parting.length) paintPuffs(parting, t, cloudSprites());
}

/* the ground: land slabs and sea, painted once into a big picture and redrawn only when it changes */
const groundCaches = new Map();
function groundDims(n) { return { X0: -32 * n - 140, Y0: -76, Wd: 64 * n + 280, Ht: 32 * n + 170 }; }
function groundScale(n) {
  const { Wd, Ht } = groundDims(n);
  return Math.max(0.6, Math.min(sprBucket, Math.sqrt(9e6 / (Wd * Ht))));
}
function groundKey() {
  const V = G.vis[G.view];
  let ex = 0, imp = 0, res = 0, bld = 0;
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) {
    if (V[y][x]) ex++;
    const t = G.tiles[y][x];
    if (t.imp) imp++;
    if (t.res) res++;
    if (t.b) bld++;
    if (t.road) bld += 1000;
  }
  return `${ex}|${imp}|${res}|${bld}|${G.view}|${groundScale(G.n).toFixed(2)}`;
}
function ensureGround(now) {
  const id = G.seed + '|' + G.n, key = groundKey();
  let g = groundCaches.get(id);
  if (g && (g.key === key || now - g.at < 150)) return g; // rebuilds are throttled; the last picture stands in briefly
  g = buildGround(g, key, now);
  groundCaches.delete(id); groundCaches.set(id, g);
  if (groundCaches.size > 2) groundCaches.delete(groundCaches.keys().next().value);
  return g;
}
function buildGround(old, key, now) {
  const n = G.n, V = G.vis[G.view], { X0, Y0, Wd, Ht } = groundDims(n), S = groundScale(n);
  const pw = Math.ceil(Wd * S), ph = Math.ceil(Ht * S);
  const c = old && old.c.width === pw && old.c.height === ph ? old.c : makeCanvas(pw, ph);
  withCtx(c, () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, pw, ph);
    ctx.setTransform(S, 0, 0, S, -X0 * S, -Y0 * S);
    paintGround(n, V, X0, Y0, Wd, Ht);
  });
  return { key, c, x: X0, y: Y0, w: Wd, h: Ht, at: now };
}
function paintGround(n, V, X0, Y0, Wd, Ht) {
  // sea depth, measured from land the viewer has seen
  const depth = Array.from({ length: n }, () => Array(n).fill(99)), q = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (V[y][x] && !isWater(T(x, y))) { depth[y][x] = 0; q.push(x, y); }
  for (let i = 0; i < q.length; i += 2) {
    const x = q[i], y = q[i + 1], d = depth[y][x] + 1;
    for (const [dx, dy] of DIRS) {
      const xx = x + dx, yy = y + dy;
      if (inb(xx, yy) && isWater(T(xx, yy)) && depth[yy][xx] > d) { depth[yy][xx] = d; q.push(xx, yy); }
    }
  }
  // the sea is painted small and scaled up, so depths blend into soft gradients
  const qs = 0.25, lw = Math.ceil(Wd * qs), lh = Math.ceil(Ht * qs), low = makeCanvas(lw, lh);
  const seenLand = (xx, yy) => inb(xx, yy) && V[yy][xx] && !isWater(T(xx, yy));
  withCtx(low, () => {
    ctx.setTransform(qs, 0, 0, qs, -X0 * qs, -Y0 * qs);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const tl = T(x, y), wx = wxOf(x, y), wy = wyOf(x, y) + WOFF;
      let c;
      if (!V[y][x]) c = DEPTH_COLS[5];
      else if (!isWater(tl)) c = DEPTH_COLS[0];
      else { const d = depth[y][x]; c = DEPTH_COLS[tl.t === 'water' ? Math.max(1, Math.min(d, 3)) : Math.max(3, Math.min(d, 5))]; }
      diamond(wx, wy, c, null, 0, -2.5);
    }
  });
  const tiny = makeCanvas(lw / 3, lh / 3);
  withCtx(tiny, () => { ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.drawImage(low, 0, 0, tiny.width, tiny.height); });
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tiny, X0, Y0, tiny.width * 3 / qs, tiny.height * 3 / qs);
  const edgeShade = (a, b, off) => { // water darkens at the foot of a cliff
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, gr = ctx.createLinearGradient(mx, my, mx + off[0], my + off[1]);
    gr.addColorStop(0, 'rgba(16,52,88,.5)'); gr.addColorStop(1, 'rgba(16,52,88,0)');
    poly([a, b, [b[0] + off[0], b[1] + off[1]], [a[0] + off[0], a[1] + off[1]]], gr);
  };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    if (!V[y][x] || !isWater(T(x, y))) continue;
    const wx = wxOf(x, y), wy = wyOf(x, y) + WOFF;
    if (seenLand(x, y - 1)) edgeShade([wx, wy], [wx + 32, wy + 16], [-6.3, 3.2]);
    if (seenLand(x - 1, y)) edgeShade([wx - 32, wy + 16], [wx, wy], [6.3, 3.2]);
  }
  // land slabs back to front; a cloud floor where the map is unexplored and around its edge
  for (let s = -4; s <= 2 * n + 2; s++) for (let x = Math.max(-2, s - n - 1); x <= Math.min(n + 1, s + 2); x++) {
    const y = s - x;
    if (y < -2 || y > n + 1) continue;
    const wx = wxOf(x, y), wy = wyOf(x, y);
    if (x < 0 || y < 0 || x >= n || y >= n || !V[y][x]) { diamond(wx, wy + 3, '#c3cfdf', null, 0, -1.5); continue; }
    const tl = T(x, y);
    if (isWater(tl)) { diamond(wx, wy + WOFF, null, 'rgba(255,255,255,.07)', 1, 0.5); continue; }
    paintLandTile(x, y, wx, wy, climateOf(tl), tl);
  }
  drawRoads(n, V);
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


/* things that move every frame */
function waterFx(x, y, wx, wy, deep, now, V) {
  const ph = now / 1300 + hash(x, y) * 6.283;
  ctx.strokeStyle = deep ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.1;
  const ox = wx + (hash(x, y, 1) - 0.5) * 22 + Math.sin(ph) * 3, oy = wy + TH / 2 + (hash(x, y, 2) - 0.5) * 8;
  ctx.beginPath(); ctx.moveTo(ox - 5, oy); ctx.quadraticCurveTo(ox, oy - 2.4, ox + 5, oy); ctx.stroke();
  const tw = Math.sin(now / 420 + hash(x, y, 3) * 40);
  if (tw > 0.78) {
    const gx = wx + (hash(x, y, 4) - 0.5) * 30, gy = wy + 16 + (hash(x, y, 5) - 0.5) * 12, k = (tw - 0.78) * 4.5;
    poly([[gx, gy - 2.2 * k], [gx + 0.7, gy], [gx, gy + 2.2 * k], [gx - 0.7, gy]], 'rgba(255,255,255,.9)');
  }
  const land = (xx, yy) => inb(xx, yy) && V[yy][xx] && !isWater(T(xx, yy));
  ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.22 * Math.sin(now / 650 + x * 1.3 + y)})`; ctx.lineWidth = 2;
  ctx.beginPath();
  if (land(x, y - 1)) { ctx.moveTo(wx + 3, wy + 5); ctx.lineTo(wx + 26, wy + 16.5); }
  if (land(x - 1, y)) { ctx.moveTo(wx - 26, wy + 16.5); ctx.lineTo(wx - 3, wy + 5); }
  ctx.stroke();
}
function drawFish(x, y, cx, cy, now, dim) {
  const t = now / 1000 + hash(x, y, 60) * 10;
  ctx.globalAlpha = dim ? 0.5 : 1;
  for (let i = 0; i < 2; i++) {
    const a = t * (0.6 + i * 0.25) + i * 3, fx = cx + Math.cos(a) * (8 - i * 2), fy = cy + Math.sin(a) * 3.2 + i * 1.5;
    const dir = -Math.sin(a) > 0 ? 1 : -1;
    ellipse(fx, fy, 4.6, 1.9, 'rgba(14,52,92,.42)');
    poly([[fx - dir * 4, fy], [fx - dir * 7, fy - 2], [fx - dir * 7, fy + 2]], 'rgba(14,52,92,.42)');
  }
  const ph = (t % 3) / 3;
  if (ph < 0.6) { ctx.strokeStyle = `rgba(255,255,255,${0.45 * (1 - ph / 0.6)})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx + 3, cy - 1, 3 + ph * 14, 1.5 + ph * 7, 0, 0, 6.283); ctx.stroke(); }
  ctx.globalAlpha = 1;
}
function ruinGlow(cx, cy, now) {
  const p = 0.5 + 0.5 * Math.sin(now / 450), g = ctx.createRadialGradient(cx, cy - 2, 0, cx, cy - 2, 12 + p * 4);
  g.addColorStop(0, `rgba(140,230,255,${0.45 + p * 0.3})`); g.addColorStop(1, 'rgba(140,230,255,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy - 2, 16, 0, 6.283); ctx.fill();
}
function waveFlag(x, y, col, now, tribe) {
  const t = reduceMotion ? 0 : now / 260, w1 = Math.sin(t) * 1.2, w2 = Math.sin(t + 1.4) * 1.4;
  poly([[x, y], [x + 6, y + 0.6 + w1], [x + 12, y + 0.4 + w2], [x + 12, y + 6.8 + w2], [x + 6, y + 7 + w1], [x, y + 6.6]], col);
  poly([[x + 6, y + 0.6 + w1], [x + 12, y + 0.4 + w2], [x + 12, y + 6.8 + w2], [x + 6, y + 7 + w1]], shade(col, w2 > 0 ? -0.14 : 0.08));
  emblem(tribe, x + 4.6, y + 3.6 + w1 * 0.5, 0.7, 'rgba(255,255,255,.92)');
}
function swayBlit(s, x, y, now, tx, ty) {
  if (reduceMotion) return blit(s, x, y);
  const k = Math.sin(now / 1500 + hash(tx, ty, 52) * 6.283) * 0.018;
  ctx.save(); ctx.transform(1, 0, k, 1, -k * y, 0); blit(s, x, y); ctx.restore();
}
function drawBuildingAt(tl, x, y, cx, cy, now, dim) {
  const b = tl.b;
  if (b.kind === 'village') { blit(objSprite('village', `village|${tl.c}`, () => paintVillage(tl.c), dim), cx, cy); return; }
  if (b.kind === 'ruin') { blit(objSprite('ruin', 'ruin', paintRuin, dim), cx, cy); if (!dim) ruinGlow(cx, cy, now); return; }
  const pl = G.players[b.owner], tribe = pl.tribe, lv = Math.min(b.level, 8);
  blit(objSprite('city', `city|${tribe}|${lv}|${b.capital ? 1 : 0}|${b.wall ? 1 : 0}`, () => paintCity(tribe, lv, b.capital, b.wall), dim), cx, cy);
  if (b.capital && !dim) { const [fx, fy] = hallFlag(tribe, lv); waveFlag(cx + fx, cy + fy, pl.color, now, tribe); }
  labels.push({ x: cx, y: cy + 15, text: b.name, capital: b.capital, level: b.level, color: pl.color, pop: b.pop, need: b.level >= MAX_LEVEL ? 0 : popNeeded(b) });
}
const unitMedium = u => (isWater(T(u.x, u.y)) ? ['boat', 'ship', 'battleship'][u.boat || 0] : 'land');
const unitSprite = (type, tribe, medium) => getSprite(`unit|${type}|${tribe}|${medium}`, BOX.unit, () => paintUnit(type, tribe, medium));
function drawUnit(u, now, demoMode) {
  let gx = u.x, gy = u.y, ox = 0, hop = 0;
  const an = anims.get(u.id);
  if (an) {
    const t = Math.min(1, (now - an.t0) / 240);
    if (t >= 1) anims.delete(u.id);
    const e = t * (2 - t);
    gx = an.x0 + (u.x - an.x0) * e; gy = an.y0 + (u.y - an.y0) * e; hop = -Math.sin(Math.PI * t) * 6;
  }
  const ha = hitAnims.get(u.id);
  if (ha) {
    const t = (now - ha.t0) / ha.dur;
    if (t >= 1) hitAnims.delete(u.id);
    else if (t > 0 && ha.kind === 'lunge') { const k = Math.sin(Math.PI * t) * 0.32; gx += ha.dx * k; gy += ha.dy * k; }
    else if (t > 0) ox = Math.sin(t * 45) * 2.6 * (1 - t);
  }
  const medium = unitMedium(u), water = medium !== 'land', pl = G.players[u.owner], col = pl.color;
  const cx = wxOf(gx, gy) + ox, cy = wyOf(gx, gy) + TH / 2 + 3 + (water ? WOFF : 0);
  const isSel = !demoMode && sel && sel.kind === 'unit' && sel.id === u.id;
  const bob = isSel ? -Math.abs(Math.sin(now / 170)) * 3 : water ? Math.sin(now / 420 + u.id) * 1.2 : 0;
  if (!water) {
    ellipse(cx + 1.5, cy + 0.5, 12.5, 5.2, 'rgba(10,20,30,.26)');
    ctx.strokeStyle = col; ctx.lineWidth = isSel ? 2.6 : 1.7; ctx.beginPath(); ctx.ellipse(cx, cy, 13, 5.5, 0, 0, 6.283); ctx.stroke();
    if (isSel) { ctx.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(now / 200)})`; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(cx, cy, 16, 7, 0, 0, 6.283); ctx.stroke(); }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, cy + 2, 19 + Math.sin(now / 500 + u.id) * 1.5, 5, 0, 0, 6.283); ctx.stroke();
  }
  const done = !demoMode && u.owner === G.view && G.cur === G.view && u.moved && u.attacked;
  ctx.globalAlpha = done ? 0.6 : 1;
  ctx.save();
  ctx.translate(cx, cy + bob + hop);
  ctx.scale(faces.get(u.id) || (u.id % 3 ? 1 : -1), water || reduceMotion ? 1 : 1 + Math.sin(now / 650 + u.id) * 0.014);
  blit(unitSprite(u.type, pl.tribe, medium), 0, 0);
  ctx.restore();
  ctx.globalAlpha = 1;
  const f = u.hp / maxHp(u), txt = String(u.hp), py = cy - 2 + bob + hop;
  ctx.font = '800 9.5px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(txt).width + 8;
  pill(cx + 14 - tw / 2, py - 6, tw, 12, 'rgba(11,18,32,.88)');
  ctx.fillStyle = f > 0.5 ? '#86ffa0' : f > 0.25 ? '#ffd166' : '#ff6a5a'; ctx.fillText(txt, cx + 14, py + 0.5);
  const top = cy + bob + hop - (u.type === 'giant' ? 60 : u.type === 'rider' || u.type === 'knight' ? 46 : u.type === 'catapult' ? 32 : 38) - (water ? 6 : 0);
  if (u.vet) { ctx.font = '13px system-ui,sans-serif'; ctx.fillStyle = '#ffd54a'; ctx.strokeStyle = '#5a3d00'; ctx.lineWidth = 2.5; ctx.strokeText('★', cx, top); ctx.fillText('★', cx, top); }
  if (!demoMode && u.owner === G.view && G.cur === G.view && !u.attacked && !busy) circle(cx - 14, py, 3.2, '#6dff8a', '#0b1220', 1.2);
}
function addGhost(u) { // a fallen unit fades out where it stood
  ghosts.push({ type: u.type, tribe: G.players[u.owner].tribe, medium: unitMedium(u), x: u.x, y: u.y, face: faces.get(u.id) || 1, t0: performance.now() });
}
function drawGhosts(now) {
  ghosts = ghosts.filter(g => now - g.t0 < 650);
  for (const g of ghosts) {
    if (!inb(g.x, g.y) || G.vis[G.view][g.y][g.x] !== 2) continue;
    const t = (now - g.t0) / 650, cx = wxOf(g.x, g.y), cy = wyOf(g.x, g.y) + TH / 2 + 3 + (g.medium !== 'land' ? WOFF : 0);
    ctx.globalAlpha = 1 - t;
    ctx.save(); ctx.translate(cx, cy + t * 6); ctx.scale(g.face * (1 - t * 0.25), 1 - t * 0.4);
    blit(unitSprite(g.type, g.tribe, g.medium), 0, 0);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
function ambientFx(now, n, V, onScreen) { // snow, falling leaves, fireflies, butterflies and drifting sand
  if (reduceMotion) return;
  for (let tries = 0; tries < 3 && ambient.length < 44; tries++) {
    if (Math.random() > 0.35) continue;
    const x = rndInt(n), y = rndInt(n);
    if (V[y][x] !== 2 || !onScreen(x, y, 0)) continue;
    const tl = T(x, y);
    if (isWater(tl)) continue;
    const cl = climateOf(tl), wx = wxOf(x, y) + (Math.random() - 0.5) * 44, wy = wyOf(x, y) + 16 + (Math.random() - 0.5) * 16;
    if (cl.name === 'tundra') ambient.push({ k: 'snow', x: wx, y: wy - 50, vx: 0.05, vy: 0.24, t0: now, life: 3600, s: 0.8 + Math.random() * 0.8 });
    else if (cl.name === 'autumn' && tl.res === 'forest') ambient.push({ k: 'leaf', x: wx, y: wy - 26, vx: 0.16, vy: 0.14, t0: now, life: 2800, c: [cl.leaf[0], cl.leaf[1], cl.leafAlt[0][0]][rndInt(3)] });
    else if (cl.name === 'jungle' && (tl.res === 'forest' || tl.res === 'fruit')) ambient.push({ k: 'fly', x: wx, y: wy - 10, t0: now, life: 3200, ph: Math.random() * 6 });
    else if (cl.name === 'meadow' && !tl.b && !tl.res) ambient.push({ k: 'bfly', x: wx, y: wy - 8, t0: now, life: 3400, ph: Math.random() * 6, c: ['#ffffff', '#ffe27a', '#ffb3d1'][rndInt(3)] });
    else if (cl.name === 'desert') ambient.push({ k: 'dust', x: wx, y: wy - 4, vx: 0.25, vy: -0.02, t0: now, life: 2200 });
  }
  ambient = ambient.filter(a => now - a.t0 < a.life);
  for (const a of ambient) {
    const age = now - a.t0, t = age / a.life;
    ctx.globalAlpha = Math.max(0, Math.min(1, t * 5, (1 - t) * 4));
    switch (a.k) {
      case 'snow': a.x += a.vx + Math.sin(age / 500 + a.s * 7) * 0.12; a.y += a.vy; circle(a.x, a.y, a.s, '#ffffff'); break;
      case 'leaf': a.x += a.vx + Math.sin(age / 300) * 0.25; a.y += a.vy; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(age / 260); poly([[0, -1.8], [1.1, 0], [0, 1.8], [-1.1, 0]], a.c); ctx.restore(); break;
      case 'fly': {
        const fx = a.x + Math.sin(age / 700 + a.ph) * 6, fy = a.y + Math.cos(age / 520 + a.ph) * 4 - age / 400, gl = 0.5 + 0.5 * Math.sin(age / 180 + a.ph);
        circle(fx, fy, 2.6, `rgba(220,255,120,${0.2 * gl})`); circle(fx, fy, 0.9, `rgba(240,255,170,${0.9 * gl})`);
        break;
      }
      case 'bfly': {
        const fx = a.x + Math.sin(age / 800 + a.ph) * 9 + age / 300, fy = a.y + Math.sin(age / 330 + a.ph) * 3 - 4, w = Math.abs(Math.sin(age / 70));
        poly([[fx, fy], [fx - 2.2 * w, fy - 1.8], [fx - 2 * w, fy + 0.6]], a.c); poly([[fx, fy], [fx + 2.2 * w, fy - 1.8], [fx + 2 * w, fy + 0.6]], a.c);
        break;
      }
      default: a.x += a.vx; a.y += a.vy; circle(a.x, a.y, 0.9, 'rgba(255,240,205,.75)');
    }
  }
  ctx.globalAlpha = 1;
}

function drawWorld(now, demoMode) {
  const n = G.n, V = G.vis[G.view], own = computeOwners();
  labels.length = 0;
  pickBucket(now);
  sprBudget = 16;
  const g = ensureGround(now);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'medium';
  ctx.drawImage(g.c, g.x, g.y, g.w, g.h);
  const pulse = 0.5 + 0.5 * Math.sin(now / 250);
  const selU = !demoMode && sel && sel.kind === 'unit' ? unitById(sel.id) : null;
  const selX = demoMode ? -9 : selU ? selU.x : sel ? sel.x : -9, selY = demoMode ? -9 : selU ? selU.y : sel ? sel.y : -9;
  const moveSet = new Set(demoMode ? [] : selMoves.map(m => m.x + ',' + m.y));
  const targetSet = new Set(demoMode ? [] : selTargets.map(e => e.x + ',' + e.y));
  const vx0 = cam.x - W / 2 / cam.z - TW, vx1 = cam.x + W / 2 / cam.z + TW;
  const vy0 = cam.y - H / 2 / cam.z - TH * 2, vy1 = cam.y + H / 2 / cam.z + TH * 2;
  const onScreen = (x, y, up) => { const wx = wxOf(x, y), wy = wyOf(x, y); return wx > vx0 && wx < vx1 && wy > vy0 && wy - (up || 0) < vy1 && wy + (up || 0) > vy0; };
  const detail = cam.z > 0.5;

  // flat overlays: moving water, borders, fog shading and highlights
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, v = V[y][x];
    if (!v || !onScreen(x, y)) continue;
    const tl = T(x, y), water = isWater(tl), key = x + ',' + y;
    const wx = wxOf(x, y), wy = wyOf(x, y) + (water ? WOFF : 0);
    if (water && detail) waterFx(x, y, wx, wy, tl.t === 'ocean', now, V);
    const o = own[y][x];
    if (o >= 0) {
      const col = G.players[o].color, ov = (xx, yy) => (inb(xx, yy) ? own[yy][xx] : -2);
      diamond(wx, wy, col + '1e');
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
  }

  // objects and units, back to front
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, v = V[y][x];
    if (!v || !onScreen(x, y, 80)) continue;
    const tl = T(x, y), water = isWater(tl), cl = climateOf(tl), key = x + ',' + y, dim = v === 1;
    const wx = wxOf(x, y), wy = wyOf(x, y) + (water ? WOFF : 0), cx = wx, cy = wy + TH / 2;
    const own3 = own[y][x], tribe3 = own3 >= 0 ? G.players[own3].tribe : -1, col3 = tribe3 >= 0 ? TRIBES[tribe3].color : '#b08850';
    if (tl.t === 'mountain') {
      const mine = tl.imp === 'mine' ? 1 : 0, ore = tl.res === 'metal' ? 1 : 0;
      blit(objSprite('mountain', `mtn|${tl.c}|${mine}|${ore}`, () => { paintMountain(cl, !!mine); if (ore) paintOre(); }, dim), cx, cy);
    }
    else if (tl.res === 'forest') {
      const v4 = Math.floor(hash(x, y, 50) * 4), hut = tl.imp === 'lumber' ? 1 : 0;
      swayBlit(objSprite('forest', `forest|${tl.c}|${v4}|${hut}`, () => paintForest(cl, v4, !!hut), dim), cx, cy, now, x, y);
    }
    else if (tl.res === 'fruit') blit(objSprite('fruit', `fruit|${tl.c}`, () => paintFruit(cl), dim), cx, cy);
    else if (tl.res === 'animal') { const f = hash(x, y, 51) < 0.5 ? 1 : 0; blit(objSprite('animal', `animal|${tl.c}|${f}`, () => paintAnimal(cl, !!f), dim), cx, cy); }
    else if (tl.res === 'crop') blit(objSprite('crop', `crop|${tl.c}`, () => paintCrop(cl), dim), cx, cy);
    else if (tl.res === 'fish' && detail) drawFish(x, y, cx, cy, now, dim);
    else if (tl.res === 'whale' && detail) drawWhale(x, y, cx, cy, now, dim);
    if (['windmill', 'sawmill', 'forge', 'market'].includes(tl.imp)) {
      const painter = { windmill: paintWindmill, sawmill: paintSawmill, forge: paintForge, market: paintMarket }[tl.imp];
      blit(objSprite('village', `imp|${tl.imp}|${tribe3}`, () => painter(col3), dim), cx, cy);
      if (tl.imp === 'windmill' && !dim) windmillBlades(cx, cy - 16, now);
    }
    if (TEMPLES.includes(tl.imp)) blit(objSprite('village', `temple|${tl.imp}|${tribe3}`, () => paintTemple(col3, tl.imp), dim), cx + (tl.imp === 'temple' || tl.imp === 'wtemple' ? 0 : 9), cy + (tl.imp === 'temple' || tl.imp === 'wtemple' ? 0 : 7));
    if (tl.imp === 'port') {
      const o = own[y][x], tr = o >= 0 ? G.players[o].tribe : -1;
      blit(objSprite('port', `port|${tr}`, () => paintPort(tr >= 0 ? TRIBES[tr].color : '#efe6d2'), dim), cx, cy);
    }
    if (tl.b) drawBuildingAt(tl, x, y, cx, cy, now, dim);
    if (moveSet.has(key)) circle(cx, cy, 4.5 + pulse * 1.3, isCapturable(tl, G.view) ? '#ffd54a' : 'rgba(255,255,255,.88)', 'rgba(0,0,0,.3)', 1);
    const u = v === 2 ? unitAt(x, y) : null;
    if (u) drawUnit(u, now, demoMode);
    if (targetSet.has(key)) {
      const r = 16 + pulse * 2, ty = cy - 12;
      ctx.strokeStyle = '#ff5a3c'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, ty, r, 0, 6.283); ctx.stroke();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) line(cx + dx * (r - 4), ty + dy * (r - 4), cx + dx * (r + 4), ty + dy * (r + 4));
    }
  }

  drawGhosts(now);
  drawParticles(now);
  ambientFx(now, n, V, onScreen);

  // city name plates with population pips
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const l of labels) {
    ctx.font = '800 9.5px Nunito, system-ui, sans-serif';
    const crown = l.capital ? 12 : 0, tw = ctx.measureText(l.text).width, w = tw + 22 + crown, x0 = l.x - w / 2;
    pill(x0, l.y - 6.5, w, 13, 'rgba(11,18,32,.84)');
    if (l.capital) poly([[x0 + 4, l.y + 3], [x0 + 4, l.y - 2.5], [x0 + 6.6, l.y], [x0 + 9, l.y - 4], [x0 + 11.4, l.y], [x0 + 14, l.y - 2.5], [x0 + 14, l.y + 3]], '#ffcf3f', '#7a5200', 0.8);
    circle(x0 + w - 7, l.y, 5.2, l.color, '#0b1220', 1);
    ctx.fillStyle = '#fff'; ctx.fillText(l.text, l.x - 5 + crown / 2, l.y + 0.5);
    ctx.font = '800 8px Nunito, system-ui, sans-serif'; ctx.fillStyle = '#0b1220'; ctx.fillText(String(l.level), x0 + w - 7, l.y + 0.5);
    if (l.need) {
      const pw = 5, gap = 1.5, tot = l.need * pw + (l.need - 1) * gap, px = l.x - tot / 2, py = l.y + 9;
      pill(px - 2.5, py - 2, tot + 5, 7, 'rgba(11,18,32,.84)');
      for (let i = 0; i < l.need; i++) { ctx.fillStyle = i < l.pop ? '#8fe9ff' : 'rgba(255,255,255,.25)'; ctx.fillRect(px + i * (pw + gap), py, pw, 3); }
    }
  }

  drawClouds(now, n, V, onScreen, g.key);

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
    for (const id of ['help', 'tech-pop', 'tech', 'game-menu']) if (!$(id).hidden) { $(id).hidden = true; if (id === 'tech') $('tech-pop').hidden = true; return; }
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
const setup = { tribe: 0, opp: 2, mode: 'domination', diff: 'normal', n: 16, map: 'continents', mp: false,
  slots: [{ tribe: 0, ai: false }, { tribe: 1, ai: false }] };

function showScreen(name) {
  for (const s of ['home', 'tribe', 'settings']) $('scr-' + s).hidden = s !== name;
  if (name === 'home') refreshMenu();
  if (name === 'tribe') renderTribes();
  if (name === 'settings') renderSettings();
}
function renderTribes() {
  $('tribe-grid').innerHTML = TRIBES.map((t, i) => `
    <button class="tribe-card" data-tribe="${i}" style="--c:${t.color}">
      <img src="${tribeIcon(i)}" alt="">
      <b>${t.name}</b>
      <span class="muted">${t.about}</span>
      <span class="tech">Starts with ${TECHS[t.tech].icon} ${TECHS[t.tech].name}</span>
    </button>`).join('');
}
$('tribe-grid').addEventListener('click', e => {
  const c = e.target.closest('[data-tribe]');
  if (!c) return;
  sfx('click');
  setup.tribe = +c.dataset.tribe;
  showScreen('settings');
});

function renderSettings() {
  const max = MAX_TRIBES[setup.n] || 6;
  setup.opp = Math.min(setup.opp, max - 1);
  if (setup.slots.length > max) setup.slots.length = max;
  const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l, dis]) =>
    `<button type="button" data-v="${v}" class="${String(setup[key]) === String(v) ? 'on' : ''}" ${dis ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
  let html = '';
  if (setup.mp) {
    html += `<div><span class="set-label">Players</span><div id="slots">${setup.slots.map((s, i) => `
      <div class="slot">
        <img src="${tribeIcon(s.tribe)}" alt="">
        <select data-i="${i}" aria-label="Tribe for player ${i + 1}">${TRIBES.map((t, k) => `<option value="${k}" ${k === s.tribe ? 'selected' : ''}>${t.name}</option>`).join('')}</select>
        <button type="button" class="ctl ${s.ai ? '' : 'human'}" data-i="${i}" ${i === 0 ? 'disabled' : ''}>${s.ai ? 'Computer' : 'Human'}</button>
      </div>`).join('')}</div>
      <div class="slot-btns"><button type="button" class="btn dark" id="slot-add" ${setup.slots.length >= max ? 'disabled' : ''}>Add player</button>
      <button type="button" class="btn dark" id="slot-remove" ${setup.slots.length <= 2 ? 'disabled' : ''}>Remove player</button></div></div>`;
  } else {
    html += `<div><span class="set-label">Opponents</span>${seg('opp', [1, 2, 3, 4, 5].map(v => [v, v, v > max - 1]))}</div>`;
  }
  html += `<div><span class="set-label">Game mode</span><div class="mode-cards seg" data-key="mode">
      <button type="button" data-v="domination" class="${setup.mode === 'domination' ? 'on' : ''}"><b>Domination</b><span>Play until only one tribe is left.</span></button>
      <button type="button" data-v="perfection" class="${setup.mode === 'perfection' ? 'on' : ''}"><b>Perfection</b><span>Get the highest score in 30 turns.</span></button>
    </div></div>
    <div><span class="set-label">Difficulty</span>${seg('diff', [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard'], ['crazy', 'Crazy']])}</div>
    <div><span class="set-label">Map size</span>${seg('n', [[12, 'Small'], [16, 'Medium'], [20, 'Large'], [24, 'Huge']])}</div>
    <div><span class="set-label">Map type</span>${seg('map', [['continents', 'Continents'], ['pangea', 'Pangea'], ['archipelago', 'Archipelago']])}</div>`;
  $('settings-title').textContent = setup.mp ? 'Pass & Play' : `${TRIBES[setup.tribe].name} · Game settings`;
  $('settings').innerHTML = html;
}
$('settings').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  const segEl = b.closest('.seg');
  if (segEl && b.dataset.v !== undefined) {
    const key = segEl.dataset.key;
    setup[key] = key === 'n' || key === 'opp' ? +b.dataset.v : b.dataset.v;
  } else if (b.classList.contains('ctl')) {
    const s = setup.slots[+b.dataset.i];
    s.ai = !s.ai;
  } else if (b.id === 'slot-add') {
    const used = setup.slots.map(s => s.tribe);
    setup.slots.push({ tribe: TRIBES.findIndex((_, i) => !used.includes(i)), ai: false });
  } else if (b.id === 'slot-remove') setup.slots.pop();
  sfx('click');
  renderSettings();
});
$('settings').addEventListener('change', e => {
  if (e.target.tagName !== 'SELECT') return;
  const i = +e.target.dataset.i, k = +e.target.value;
  const other = setup.slots.findIndex((s, j) => j !== i && s.tribe === k);
  if (other >= 0) setup.slots[other].tribe = setup.slots[i].tribe; // swap so every tribe stays unique
  setup.slots[i].tribe = k;
  renderSettings();
});

function startGame(cfg) {
  const s = newGame(cfg);
  G = s; startTurn(0);
  begin(s, false);
  save();
}
$('btn-start').onclick = () => {
  let slots;
  if (setup.mp) slots = setup.slots.map(s => ({ ...s }));
  else {
    const others = TRIBES.map((_, i) => i).filter(i => i !== setup.tribe).sort(() => Math.random() - 0.5).slice(0, setup.opp);
    slots = [{ tribe: setup.tribe, ai: false }, ...others.map(t => ({ tribe: t, ai: true }))];
  }
  sfx('click');
  startGame({ slots, n: setup.n, mapType: setup.map, mode: setup.mode, diff: setup.diff, seed: (Math.random() * 2 ** 31) | 0 });
};

// Short notices at the top of the screen, such as the start of a turn.
function banner(title, sub) { toast(sub ? `${title} · ${sub}` : title); }
function showGame(show) {
  gameShown = show;
  $('hud').hidden = !show; $('menu').hidden = show;
  $('game-menu').hidden = true;
  if (show) ui();
  else { $('bottom').hidden = true; $('sheet').hidden = true; $('turn-of').hidden = true; showScreen('home'); }
}
function focusHome(instant) {
  const c = cityTiles(G.view)[0] || G.units.find(u => u.owner === G.view);
  if (!c) return;
  const goal = { x: wxOf(c.x, c.y), y: wyOf(c.x, c.y) + TH / 2 };
  if (instant) { cam.x = goal.x; cam.y = goal.y; camGoal = null; } else camGoal = { ...goal, z: camGoal && camGoal.z }; // keep an unfinished zoom
}
function begin(state, resumed) {
  G = state; busy = false; sel = null; selMoves = []; selTargets = []; fx = []; parts = []; ghosts = []; ambient = []; anims.clear(); hitAnims.clear(); revealAt.clear();
  if (G.tiles[0][0].c === undefined) { // saves from before climates existed
    const caps = cityTiles();
    for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) {
      const near = caps.reduce((a, c) => (!a || cheb(c, { x, y }) < cheb(a, { x, y }) ? c : a), null);
      T(x, y).c = near ? G.players[near.b.owner].tribe : 0;
    }
  }
  ['gameover', 'reward', 'pass', 'tech', 'tech-pop', 'help', 'game-menu'].forEach(id => { $(id).hidden = true; });
  if (G.players[G.cur].ai) { // restored mid-way through the computer's turn
    updateVis(); focusHome(true); cam.z = W < 700 ? 0.8 : 1.05; showGame(true);
    runTurns(true);
    return;
  }
  G.view = G.cur;
  updateVis(); focusHome(true); showGame(true);
  const z = W < 700 ? 0.8 : 1.05;
  cam.z = z * 0.55; camGoal = { x: cam.x, y: cam.y, z };
  if (humanCount() > 1) showPass();
  else {
    banner(G.turn === 1 && !resumed ? `${G.players[G.cur].name}: ${TRIBES[G.players[G.cur].tribe].about}` : `Turn ${G.turn}`, G.turn === 1 && !resumed ? '' : 'Welcome back');
    showReward();
  }
}

$('btn-new').onclick = () => { setup.mp = false; sfx('click'); showScreen('tribe'); };
$('btn-mp').onclick = () => { setup.mp = true; sfx('click'); showScreen('settings'); };
$('btn-tribe-back').onclick = () => showScreen('home');
$('btn-settings-back').onclick = () => showScreen(setup.mp ? 'home' : 'tribe');
$('btn-continue').onclick = () => { const s = loadSave(); if (s) begin(s, true); };
$('btn-resume').onclick = () => showGame(true);
$('btn-howto').onclick = () => { $('help').hidden = false; };
$('btn-game').onclick = () => { if (!G) return; sfx('click'); renderGameMenu(); $('game-menu').hidden = false; };
$('gm-resume').onclick = () => { $('game-menu').hidden = true; };
$('gm-sound').onclick = () => {
  muted = !muted;
  try { localStorage.setItem('polyweb-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
  if (!muted) sfx('click');
  renderGameMenu();
};
$('gm-help').onclick = () => { $('help').hidden = false; };
$('gm-main').onclick = () => { save(); showGame(false); };
$('btn-end').onclick = endTurn;
function toggleTech() {
  if (!G || G.over || !gameShown) return;
  $('tech').hidden = !$('tech').hidden;
  $('tech-pop').hidden = true; techSel = null;
  if (!$('tech').hidden) {
    sfx('click'); renderTech();
    const sc = $('tech-scroll');
    sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2; sc.scrollTop = (sc.scrollHeight - sc.clientHeight) / 2;
  }
}
$('btn-tech').onclick = toggleTech;
$('btn-tech-close').onclick = () => { $('tech').hidden = true; $('tech-pop').hidden = true; };
$('btn-help-close').onclick = () => { $('help').hidden = true; };
$('btn-again').onclick = () => { $('gameover').hidden = true; showGame(false); };
$('btn-view').onclick = () => { $('gameover').hidden = true; };
function refreshMenu() {
  $('btn-continue').hidden = !loadSave() || !!(G && !G.over);
  $('btn-resume').hidden = !(G && !G.over);
}

/* ---------- boot ---------- */
resize(); showScreen('home'); requestAnimationFrame(draw);
// Keep a game in progress when this page is hot-reloaded inside an artifact viewer.
window.claude?.hot?.snapshot?.(() => (G && !G.over ? { G } : {}));
function start(data) { if (data && data.G && data.G.v === 3) begin(data.G, true); }
if (window.claude?.hot?.ready) window.claude.hot.ready(start); else start(window.claude?.hot?.data ?? {});
