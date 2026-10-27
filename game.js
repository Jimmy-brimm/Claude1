'use strict';
/* Polyweb – a small isometric turn-based strategy game. No dependencies. */

/* ---------- constants ---------- */
const TW = 64, TH = 32, LH = 8; // tile width/height (iso diamond), land thickness
const SAVE_KEY = 'polyweb-save-v1';
const TRIBES = [
  { name: 'Zephyr',  color: '#4a8cff' },
  { name: 'Ember',   color: '#e8503a' },
  { name: 'Verdant', color: '#2fbf63' },
  { name: 'Solis',   color: '#f0b429' },
];
const UNITS = {
  warrior:  { name: 'Warrior',  icon: '⚔️', cost: 2, atk: 2, def: 2, hp: 10, mv: 1, range: 1 },
  archer:   { name: 'Archer',   icon: '🏹', cost: 3, atk: 2, def: 1, hp: 10, mv: 1, range: 2 },
  rider:    { name: 'Rider',    icon: '🐎', cost: 3, atk: 2, def: 1, hp: 10, mv: 2, range: 1 },
  defender: { name: 'Defender', icon: '🛡️', cost: 3, atk: 1, def: 3, hp: 15, mv: 1, range: 1 },
};
const HARVEST_COST = 2, MAX_LEVEL = 5;
const DIRS = [];
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) DIRS.push([dx, dy]);

/* ---------- state ---------- */
let G = null;                 // game state (JSON-serialisable)
let cam = { x: 0, y: 0, z: 1 };
let sel = null, selMoves = [], selTargets = [], hover = null, fx = [];
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

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ---------- map generation ---------- */
function newGame(oppCount, n, seed) {
  const rnd = mulberry32(seed);
  const np = oppCount + 1;
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // cellular-automata landmass
  let g = Array.from({ length: n }, () => Array.from({ length: n }, () => (rnd() < 0.6 ? 1 : 0)));
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

  const S = [[2, 2], [n - 3, n - 3], [n - 3, 2], [2, n - 3]].slice(0, np);
  const protect = Array.from({ length: n }, () => Array(n).fill(false));
  for (const [sx, sy] of S) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    g[sy + dy][sx + dx] = 1; protect[sy + dy][sx + dx] = true;
  }
  // carve land bridges from player 0 to everyone else
  for (let i = 1; i < np; i++) {
    let [x, y] = S[0]; const [bx, by] = S[i];
    while (x !== bx || y !== by) {
      const mx = x !== bx, my = y !== by;
      if (mx && (!my || rnd() < 0.5)) x += Math.sign(bx - x); else y += Math.sign(by - y);
      g[y][x] = 1; protect[y][x] = true;
      const nx = x + 1; if (nx < n && rnd() < 0.5) g[y][nx] = 1;
    }
  }

  const tiles = g.map((row, y) => row.map((v, x) => ({ t: v ? 'land' : 'water', res: null, b: null })));
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tl = tiles[y][x];
    if (tl.t !== 'land' || protect[y][x]) continue;
    const r = rnd();
    if (r < 0.12) tl.t = 'mountain';
    else if (r < 0.30) tl.res = 'forest';
    else if (r < 0.38) tl.res = 'fruit';
    else if (r < 0.45) tl.res = 'animal';
  }

  const units = []; let nextId = 1;
  S.forEach(([sx, sy], p) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tl = tiles[sy + dy][sx + dx]; tl.t = 'land'; tl.res = null; }
    tiles[sy][sx].b = { kind: 'city', owner: p, level: 1, pop: 0, capital: true };
    const ring = shuffle(DIRS.slice());
    tiles[sy + ring[0][1]][sx + ring[0][0]].res = 'fruit';
    tiles[sy + ring[1][1]][sx + ring[1][0]].res = 'animal';
    units.push({ id: nextId++, type: 'warrior', owner: p, x: sx + ring[2][0], y: sy + ring[2][1], hp: 10, moved: false, attacked: false });
  });

  // neutral villages
  const cand = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (tiles[y][x].t === 'land') cand.push({ x, y });
  shuffle(cand);
  const placed = S.map(([x, y]) => ({ x, y }));
  const target = Math.floor(n * n / 14);
  let count = 0;
  for (const c of cand) {
    if (count >= target) break;
    if (placed.some(p => cheb(p, c) < 3)) continue;
    tiles[c.y][c.x].b = { kind: 'village' }; tiles[c.y][c.x].res = null;
    placed.push(c); count++;
  }

  // drop anything not reachable from player 0 into the sea
  const seen = Array.from({ length: n }, () => Array(n).fill(false));
  const stack = [{ x: S[0][0], y: S[0][1] }]; seen[S[0][1]][S[0][0]] = true;
  while (stack.length) {
    const c = stack.pop();
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (x < 0 || y < 0 || x >= n || y >= n || seen[y][x] || tiles[y][x].t !== 'land') continue;
      seen[y][x] = true; stack.push({ x, y });
    }
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const tl = tiles[y][x];
    if (seen[y][x] || tl.t === 'water') continue;
    let touches = false;
    if (tl.t === 'mountain') for (const [dx, dy] of DIRS) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < n && yy < n && seen[yy][xx]) touches = true; }
    if (!touches) { tl.t = 'water'; tl.res = null; tl.b = null; }
  }

  return {
    n, seed, tiles, units, nextId, turn: 1, cur: 0, busy: false, over: null,
    players: S.map((_, i) => ({ name: TRIBES[i].name, color: TRIBES[i].color, ai: i > 0, stars: 5, alive: true })),
    vis: Array.from({ length: n }, () => Array(n).fill(0)),
  };
}

/* ---------- rules helpers ---------- */
function cityTiles(p) {
  const out = [];
  for (let y = 0; y < G.n; y++) for (let x = 0; x < G.n; x++) {
    const b = T(x, y).b;
    if (b && b.kind === 'city' && b.owner === p) out.push({ x, y, b });
  }
  return out;
}
const radiusOf = b => (b.level >= 3 ? 2 : 1);
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
  for (let y2 = 0; y2 < G.n; y2++) for (let x2 = 0; x2 < G.n; x2++) {
    const b = T(x2, y2).b;
    if (!b || b.kind !== 'city') continue;
    const d = cheb({ x: x2, y: y2 }, { x, y });
    if (d <= radiusOf(b) && d < bd) { best = b.owner; bd = d; }
  }
  return best;
}
const income = p => cityTiles(p).reduce((s, c) => s + c.b.level, 1);
const popNeeded = b => b.level + 1;

function defenseBonus(u) {
  const tl = T(u.x, u.y);
  if (tl.b && tl.b.kind === 'city' && tl.b.owner === u.owner) return 1.5;
  if (tl.res === 'forest') return 1.25;
  return 1;
}
function combatCalc(a, d, dist) {
  const A = UNITS[a.type], D = UNITS[d.type];
  const af = A.atk * a.hp / A.hp;
  const df = D.def * d.hp / D.hp * defenseBonus(d);
  const tot = af + df;
  const dmg = Math.round(af / tot * A.atk * 4.5);
  let counter = 0;
  if (d.hp - dmg > 0 && dist <= D.range) counter = Math.round(df / tot * D.def * 4.5);
  return { dmg, counter };
}

function reach(u) {
  if (u.moved || u.attacked) return [];
  const mv = UNITS[u.type].mv;
  const dist = { [u.x + ',' + u.y]: 0 };
  const q = [{ x: u.x, y: u.y }], out = [];
  while (q.length) {
    const c = q.shift(), d = dist[c.x + ',' + c.y];
    if (d >= mv) continue;
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy, k = x + ',' + y;
      if (!inb(x, y) || k in dist) continue;
      const tl = T(x, y);
      if (tl.t !== 'land' || unitAt(x, y)) continue;
      dist[k] = d + 1; out.push({ x, y });
      const capturable = tl.b && (tl.b.kind === 'village' || tl.b.owner !== u.owner);
      if (!capturable) q.push({ x, y });
    }
  }
  return out;
}
function targetsFor(u, humanView) {
  if (u.attacked) return [];
  const r = UNITS[u.type].range;
  return G.units.filter(e => e.owner !== u.owner && cheb(u, e) <= r && (!humanView || G.vis[e.y][e.x] === 2));
}

/* ---------- actions ---------- */
function popFx(x, y, text, color) { fx.push({ x, y, text, color, t0: performance.now() }); }

function doMove(u, x, y) {
  u.x = x; u.y = y; u.moved = true;
  const tl = T(x, y);
  if (tl.b) {
    if (tl.b.kind === 'village') {
      tl.b = { kind: 'city', owner: u.owner, level: 1, pop: 0, capital: false };
      u.attacked = true;
      if (!G.players[u.owner].ai) toast('Village joined your tribe! 🏙️');
    } else if (tl.b.owner !== u.owner) {
      const prev = tl.b.owner;
      tl.b.owner = u.owner; tl.b.pop = 0; tl.b.capital = false;
      u.attacked = true;
      toast(`${G.players[u.owner].name} captured a city from ${G.players[prev].name}!`);
      checkElim();
    }
  }
  updateVis();
}

function attack(a, d) {
  const r = combatCalc(a, d, cheb(a, d));
  d.hp -= r.dmg; popFx(d.x, d.y, '-' + r.dmg, '#ff6a5a');
  if (r.counter) { a.hp -= r.counter; popFx(a.x, a.y, '-' + r.counter, '#ffb35a'); }
  a.attacked = true; a.moved = true;
  if (d.hp <= 0) G.units = G.units.filter(u => u !== d);
  if (a.hp <= 0) G.units = G.units.filter(u => u !== a);
  updateVis();
}

function train(c, type, p) {
  const pl = G.players[p], def = UNITS[type];
  if (unitAt(c.x, c.y) || pl.stars < def.cost) return false;
  pl.stars -= def.cost;
  G.units.push({ id: G.nextId++, type, owner: p, x: c.x, y: c.y, hp: def.hp, moved: true, attacked: true });
  updateVis();
  return true;
}
function harvestables(c) {
  const out = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = c.x + dx, y = c.y + dy;
    if (!inb(x, y) || cheb(c, { x, y }) > radiusOf(c.b)) continue;
    const r = T(x, y).res;
    if (r === 'fruit' || r === 'animal') out.push({ x, y });
  }
  return out;
}
function harvest(x, y, p) {
  const tl = T(x, y), pl = G.players[p];
  if ((tl.res !== 'fruit' && tl.res !== 'animal') || pl.stars < HARVEST_COST) return false;
  const c = cityFor(x, y, p);
  if (!c) return false;
  pl.stars -= HARVEST_COST; tl.res = null; c.b.pop++;
  popFx(x, y, '+1 pop', '#8fe39a');
  if (c.b.level < MAX_LEVEL && c.b.pop >= popNeeded(c.b)) {
    c.b.pop -= popNeeded(c.b); c.b.level++;
    popFx(c.x, c.y, 'Level up!', '#ffe27a');
    if (!pl.ai) toast(`City grew to level ${c.b.level}! Borders and income increased.`);
  }
  return true;
}

function checkElim() {
  for (let p = 0; p < G.players.length; p++) {
    const pl = G.players[p];
    if (pl.alive && cityTiles(p).length === 0) {
      pl.alive = false;
      G.units = G.units.filter(u => u.owner !== p);
      toast(`${pl.name} has been eliminated!`);
    }
  }
  if (!G.players[0].alive) endGame(false);
  else if (G.players.slice(1).every(p => !p.alive)) endGame(true);
}
function endGame(won) {
  G.over = { won };
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
  $('go-title').textContent = won ? '🏆 Victory!' : '💀 Defeat';
  $('go-text').textContent = won ? `You conquered the world in ${G.turn} turns.` : 'Your tribe has fallen.';
  $('gameover').hidden = false;
}

/* ---------- fog of war ---------- */
function updateVis() {
  for (const row of G.vis) for (let x = 0; x < row.length; x++) if (row[x] === 2) row[x] = 1;
  const mark = (cx, cy) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (inb(x, y)) G.vis[y][x] = 2;
    }
  };
  for (const u of G.units) if (u.owner === 0) mark(u.x, u.y);
  for (const c of cityTiles(0)) mark(c.x, c.y);
}

/* ---------- turn flow ---------- */
function startTurn(p) {
  const pl = G.players[p];
  pl.stars += income(p);
  for (const u of G.units) if (u.owner === p) { u.moved = false; u.attacked = false; }
  if (p === 0) { updateVis(); toast(`Turn ${G.turn} – your move (+${income(0)} ⭐)`); }
}
function healIdle(p) {
  for (const u of G.units) {
    if (u.owner !== p || u.moved || u.attacked) continue;
    const tl = T(u.x, u.y);
    u.hp = Math.min(UNITS[u.type].hp, u.hp + (tl.b && tl.b.owner === p ? 4 : 2));
  }
}
async function endTurn() {
  if (!G || G.busy || G.over || G.cur !== 0) return;
  G.busy = true; select(null);
  healIdle(0);
  for (;;) {
    do { G.cur = (G.cur + 1) % G.players.length; if (G.cur === 0) G.turn++; } while (!G.players[G.cur].alive);
    startTurn(G.cur);
    if (G.cur === 0 || G.over) break;
    ui();
    await aiTurn(G.cur);
    healIdle(G.cur);
    if (G.over) break;
  }
  G.busy = false;
  if (!G.over) save();
  refreshSel(); ui();
}

/* ---------- AI ---------- */
async function aiTurn(p) {
  const pl = G.players[p];
  // economy: harvest and train
  for (let guard = 0; guard < 24; guard++) {
    let did = false;
    for (const c of cityTiles(p)) {
      const free = !unitAt(c.x, c.y);
      const hv = harvestables(c);
      const mine = G.units.filter(u => u.owner === p).length;
      if (hv.length && pl.stars >= HARVEST_COST && (mine >= 2 || !free) && Math.random() < 0.6) {
        harvest(hv[0].x, hv[0].y, p); did = true; continue;
      }
      if (free && mine < 4 + cityTiles(p).length * 3) {
        const opts = Object.keys(UNITS).filter(k => UNITS[k].cost <= pl.stars);
        if (opts.length) {
          const w = { warrior: 3, archer: 2, rider: 2, defender: 1 };
          const bag = opts.flatMap(k => Array(w[k]).fill(k));
          train(c, bag[rndInt(bag.length)], p); did = true;
        }
      }
    }
    if (!did) break;
  }
  ui();
  for (const u of G.units.filter(x => x.owner === p)) {
    if (!G.units.includes(u) || G.over) continue;
    const seen = G.vis[u.y][u.x] === 2;
    const acted = aiUnit(u);
    if (acted && (seen || G.vis[u.y][u.x] === 2)) { ui(); await sleep(170); }
  }
}

function aiPlan(u) {
  const R = UNITS[u.type].range;
  const spots = [{ x: u.x, y: u.y }, ...reach(u)];
  let best = null, bs = 0.4;
  for (const s of spots) {
    const here = s.x === u.x && s.y === u.y;
    const tl = T(s.x, s.y);
    if (!here && tl.b && (tl.b.kind === 'village' || tl.b.owner !== u.owner)) {
      const sc = tl.b.kind === 'village' ? 7 : 12 + 2 * tl.b.level;
      if (sc > bs) { bs = sc; best = { s, target: null }; }
      continue; // capturing ends the unit's action
    }
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
function aiGoalField(u) {
  const n = G.n, dist = Array.from({ length: n }, () => Array(n).fill(Infinity)), q = [];
  const add = (x, y) => { if (dist[y][x] === Infinity) { dist[y][x] = 0; q.push({ x, y }); } };
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const b = T(x, y).b;
    if (b && (b.kind === 'village' || (b.kind === 'city' && b.owner !== u.owner))) add(x, y);
  }
  for (const e of G.units) if (e.owner !== u.owner) add(e.x, e.y);
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (!inb(x, y) || T(x, y).t !== 'land' || dist[y][x] !== Infinity) continue;
      dist[y][x] = dist[c.y][c.x] + 1; q.push({ x, y });
    }
  }
  return dist;
}
function aiUnit(u) {
  let acted = false;
  const exec = plan => {
    if (plan.s.x !== u.x || plan.s.y !== u.y) doMove(u, plan.s.x, plan.s.y);
    if (plan.target && G.units.includes(plan.target) && !u.attacked) attack(u, plan.target);
    acted = true;
  };
  let plan = aiPlan(u);
  if (plan) { exec(plan); return acted; }
  if (!u.moved && !u.attacked) {
    const field = aiGoalField(u), opts = reach(u);
    let bestD = field[u.y][u.x], pick = null;
    for (const o of opts) {
      const d = field[o.y][o.x];
      if (d < bestD || (d === bestD && pick && Math.random() < 0.3)) { bestD = d; pick = o; }
    }
    if (pick) {
      doMove(u, pick.x, pick.y); acted = true;
      if (G.units.includes(u)) { plan = aiPlan(u); if (plan) exec(plan); }
    }
  }
  return acted;
}

/* ---------- persistence ---------- */
function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); } catch (e) { /* ignore */ }
}
function loadSave() {
  try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}

/* ---------- UI ---------- */
let toastTimer = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}
function select(s) { sel = s; refreshSel(); ui(); }
function refreshSel() {
  selMoves = []; selTargets = [];
  if (!sel || !G) return;
  if (sel.kind === 'unit') {
    const u = unitById(sel.id);
    if (!u) { sel = null; return; }
    if (u.owner === 0 && G.cur === 0 && !G.busy && !G.over) { selMoves = reach(u); selTargets = targetsFor(u, true); }
  }
}

function ui() {
  if (!G) return;
  $('turn').textContent = `Turn ${G.turn}`;
  $('stars').textContent = `⭐ ${G.players[0].stars} (+${income(0)})`;
  $('scores').innerHTML = G.players.map((p, i) =>
    `<span class="${p.alive ? '' : 'dead'}" style="color:${p.color}">● ${p.name}${i === 0 ? ' (you)' : ''} · 🏙️${cityTiles(i).length}${i === 0 || G.over ? ` ⚔️${G.units.filter(u => u.owner === i).length}` : ''}</span>`).join('');
  $('btn-end').disabled = G.busy || !!G.over || G.cur !== 0;
  $('btn-end').textContent = G.busy ? 'Waiting…' : 'End turn';
  renderPanel();
}

function renderPanel() {
  const info = $('info'), act = $('actions');
  act.innerHTML = '';
  if (!sel) {
    info.innerHTML = '<span class="muted">Tap a unit or tile. Capture 🏘️ villages, harvest 🍎 🦌, train an army and conquer the rival tribes.</span>';
    return;
  }
  const u0 = sel.kind === 'unit' ? unitById(sel.id) : null;
  const x = u0 ? u0.x : sel.x, y = u0 ? u0.y : sel.y;
  if (G.vis[y][x] === 0) { info.innerHTML = '<span class="muted">Unexplored territory.</span>'; return; }
  const tl = T(x, y), vis = G.vis[y][x] === 2;
  const u = u0 || (vis ? unitAt(x, y) : null);
  const mine = G.cur === 0 && !G.busy && !G.over;
  let html = '';
  if (u) {
    const d = UNITS[u.type], pl = G.players[u.owner];
    const st = u.owner !== 0 ? '' : (u.moved && u.attacked) || (u.attacked) ? ' · done' : u.moved ? ' · can attack' : ' · ready';
    html += `<div><b style="color:${pl.color}">${d.icon} ${d.name}</b> (${pl.name}) · ❤️ ${u.hp}/${d.hp}${st}<br>
      <span class="muted">ATK ${d.atk} · DEF ${d.def} · MOV ${d.mv} · RNG ${d.range}</span></div>`;
  }
  const b = tl.b;
  if (b && b.kind === 'village') html += '<div>🏘️ <b>Village</b> <span class="muted">– move a unit here to capture it.</span></div>';
  else if (b) {
    const pl = G.players[b.owner];
    html += `<div>🏙️ <b style="color:${pl.color}">${b.capital ? 'Capital' : 'City'}</b> (${pl.name}) · level ${b.level}`;
    if (b.owner === 0) html += ` · pop ${b.pop}/${b.level >= MAX_LEVEL ? '–' : popNeeded(b)} · +${b.level} ⭐/turn`;
    html += '</div>';
  }
  const resNames = { forest: '🌲 Forest (+25% defence)', fruit: '🍎 Fruit', animal: '🦌 Wild animals' };
  if (tl.res) html += `<div>${resNames[tl.res]}</div>`;
  if (tl.t === 'mountain') html += '<div>⛰️ Mountain <span class="muted">– impassable</span></div>';
  if (!u && !b && !tl.res && tl.t === 'land') html += '<div class="muted">Open land</div>';
  if (tl.t === 'water') html += '<div class="muted">Water</div>';
  info.innerHTML = html;

  if (!mine) return;
  const addBtn = (label, cost, disabled, fn) => {
    const el = document.createElement('button');
    el.innerHTML = `${label}${cost ? `<span class="cost">⭐${cost}</span>` : ''}`;
    el.disabled = disabled; el.onclick = fn; act.appendChild(el);
  };
  if (b && b.kind === 'city' && b.owner === 0) {
    const blocked = !!unitAt(x, y);
    for (const k of Object.keys(UNITS)) {
      const d = UNITS[k];
      addBtn(`${d.icon} ${d.name}`, d.cost, blocked || G.players[0].stars < d.cost, () => {
        if (train({ x, y }, k, 0)) { popFx(x, y, 'Trained', '#cfe6ff'); const nu = unitAt(x, y); select({ kind: 'unit', id: nu.id }); }
      });
    }
    if (blocked) { const n = document.createElement('div'); n.className = 'muted'; n.style.width = '100%'; n.textContent = 'Move the unit off the city to train.'; act.appendChild(n); }
  }
  if ((tl.res === 'fruit' || tl.res === 'animal') && tileOwner(x, y) === 0) {
    addBtn(tl.res === 'fruit' ? '🍎 Harvest' : '🦌 Hunt', HARVEST_COST, G.players[0].stars < HARVEST_COST, () => {
      if (harvest(x, y, 0)) select(sel.kind === 'unit' ? sel : { kind: 'tile', x, y });
    });
  }
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
function diamond(x, y, fill, stroke, lw, inset) {
  const i = inset || 0, hw = TW / 2 - i * 2, hh = TH / 2 - i;
  ctx.beginPath();
  ctx.moveTo(x, y + i); ctx.lineTo(x + hw, y + TH / 2); ctx.lineTo(x, y + TH - i); ctx.lineTo(x - hw, y + TH / 2); ctx.closePath();
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
function drawMountain(cx, cy) {
  poly([[cx - 26, cy + 8], [cx - 4, cy - 28], [cx + 20, cy + 8]], '#8d96a3', '#6f7886');
  poly([[cx - 4, cy - 28], [cx + 20, cy + 8], [cx + 4, cy + 8]], '#6f7886');
  poly([[cx - 4, cy - 28], [cx - 11, cy - 15], [cx - 4, cy - 18], [cx + 2, cy - 14]], '#f2f6fb');
  poly([[cx + 6, cy + 8], [cx + 18, cy - 10], [cx + 30, cy + 8]], '#a0a9b5', '#7e8794');
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
function drawHut(cx, cy, wall, roof, s) {
  ctx.fillStyle = wall; ctx.fillRect(cx - 7 * s, cy - 8 * s, 14 * s, 10 * s);
  poly([[cx - 9 * s, cy - 8 * s], [cx, cy - 17 * s], [cx + 9 * s, cy - 8 * s]], roof);
  ctx.fillStyle = '#0006'; ctx.fillRect(cx - 2 * s, cy - 4 * s, 4 * s, 6 * s);
}
function drawBuilding(cx, cy, b) {
  if (b.kind === 'village') {
    drawHut(cx - 9, cy + 1, '#d9c9a3', '#8b5a2b', 1); drawHut(cx + 9, cy + 3, '#cdbb92', '#7a4c22', 0.9);
    return;
  }
  const col = G.players[b.owner].color;
  drawHut(cx - 12, cy + 3, '#e6e0d0', col, 1);
  drawHut(cx + 12, cy + 3, '#e6e0d0', col, 1);
  const lv = Math.min(b.level, 5), h = 12 + lv * 4;
  ctx.fillStyle = '#f2ecdc'; ctx.fillRect(cx - 8, cy - h, 16, h + 2);
  poly([[cx - 11, cy - h], [cx, cy - h - 11], [cx + 11, cy - h]], col);
  ctx.fillStyle = '#0005'; ctx.fillRect(cx - 2.5, cy - 7, 5, 9);
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx, cy - h - 11); ctx.lineTo(cx, cy - h - 21); ctx.stroke();
  poly([[cx, cy - h - 21], [cx + 9, cy - h - 18], [cx, cy - h - 15]], col);
  ctx.font = 'bold 10px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000a'; ctx.lineWidth = 3;
  const label = (b.capital ? '★' : '') + b.level;
  ctx.strokeText(label, cx, cy + 12); ctx.fillText(label, cx, cy + 12);
}
function drawUnit(u, wx, wy, now) {
  const cx = wx, cy = wy + TH / 2 + 2, pl = G.players[u.owner];
  const isSel = sel && sel.kind === 'unit' && sel.id === u.id;
  const bob = isSel ? Math.sin(now / 160) * 2 : 0;
  ctx.fillStyle = '#0004'; ctx.beginPath(); ctx.ellipse(cx, cy, 13, 6, 0, 0, Math.PI * 2); ctx.fill();
  const done = u.owner === 0 && G.cur === 0 && u.moved && u.attacked;
  ctx.globalAlpha = done ? 0.65 : 1;
  circle(cx, cy - 13 + bob, 13, pl.color, isSel ? '#fff' : '#0b1220', isSel ? 3 : 2);
  ctx.font = '15px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff';
  ctx.fillText(UNITS[u.type].icon, cx, cy - 12 + bob);
  ctx.globalAlpha = 1;
  const max = UNITS[u.type].hp, f = Math.max(0, u.hp / max);
  ctx.fillStyle = '#000b'; ctx.fillRect(cx - 13, cy + 5, 26, 5);
  ctx.fillStyle = f > 0.5 ? '#4cd964' : f > 0.25 ? '#ffcc33' : '#ff5a4a'; ctx.fillRect(cx - 12, cy + 6, 24 * f, 3);
  if (u.owner === 0 && G.cur === 0 && !(u.moved && u.attacked)) circle(cx + 12, cy - 27 + bob, 3.5, '#6dff8a', '#0b1220', 1);
}

function draw(now) {
  requestAnimationFrame(draw);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0f1b2d'); grd.addColorStop(1, '#16304f');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, W, H);
  if (!G) return;
  ctx.setTransform(dpr * cam.z, 0, 0, dpr * cam.z, dpr * (W / 2 - cam.x * cam.z), dpr * (H / 2 - cam.y * cam.z));
  const n = G.n;
  const pulse = 0.5 + 0.5 * Math.sin(now / 250);

  // pass 1: water + unexplored
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, wx = wxOf(x, y), wy = wyOf(x, y), v = G.vis[y][x];
    if (v === 0) diamond(wx, wy, '#16233a', '#1d2d49');
    else if (T(x, y).t === 'water') {
      diamond(wx, wy + 7, (x + y) % 2 ? '#3b84c6' : '#4190d4', '#3379b8');
      if (v === 1) diamond(wx, wy + 7, 'rgba(8,16,32,.4)');
    }
  }
  // pass 2: land, objects, highlights
  for (let s = 0; s <= 2 * n - 2; s++) for (let x = Math.max(0, s - n + 1); x <= Math.min(s, n - 1); x++) {
    const y = s - x, v = G.vis[y][x], tl = T(x, y);
    if (v === 0 || tl.t === 'water') continue;
    const wx = wxOf(x, y), wy = wyOf(x, y);
    poly([[wx - TW / 2, wy + TH / 2], [wx, wy + TH], [wx, wy + TH + LH], [wx - TW / 2, wy + TH / 2 + LH]], '#6a9a49');
    poly([[wx, wy + TH], [wx + TW / 2, wy + TH / 2], [wx + TW / 2, wy + TH / 2 + LH], [wx, wy + TH + LH]], '#587f3d');
    diamond(wx, wy, tl.t === 'mountain' ? '#93a07f' : ((x * 7 + y * 13) % 3 === 0 ? '#8ecb62' : '#86c35b'), '#6aa44a', 0.5);
    const own = tileOwner(x, y);
    if (own >= 0) diamond(wx, wy, G.players[own].color + '26', G.players[own].color + 'cc', 2, 2);
    if (selMoves.some(m => m.x === x && m.y === y)) diamond(wx, wy, `rgba(255,255,255,${0.25 + 0.2 * pulse})`, '#fff', 1.5, 3);
    if (selTargets.some(e => e.x === x && e.y === y)) diamond(wx, wy, `rgba(255,70,50,${0.3 + 0.25 * pulse})`, '#ff4a3a', 2, 2);
    if (hover && hover.x === x && hover.y === y) diamond(wx, wy, null, 'rgba(255,255,255,.7)', 1.5, 1);
    const isSelTile = sel && ((sel.kind === 'tile' && sel.x === x && sel.y === y) || (sel.kind === 'unit' && (unitById(sel.id) || {}).x === x && (unitById(sel.id) || {}).y === y));
    if (isSelTile) diamond(wx, wy, null, '#ffe27a', 2.5, 1);
    if (v === 1) diamond(wx, wy, 'rgba(8,16,32,.38)');

    const cx = wx, cy = wy + TH / 2;
    if (v === 1) ctx.globalAlpha = 0.75;
    if (tl.t === 'mountain') drawMountain(cx, cy);
    else if (tl.res === 'forest') { drawTree(cx - 12, cy + 2, 1); drawTree(cx + 11, cy + 1, 1); drawTree(cx, cy + 6, 1.1); }
    else if (tl.res === 'fruit') drawFruit(cx, cy);
    else if (tl.res === 'animal') drawAnimal(cx, cy);
    if (tl.b) drawBuilding(cx, cy, tl.b);
    ctx.globalAlpha = 1;
    if (v === 2) { const u = unitAt(x, y); if (u) drawUnit(u, wx, wy, now); }
  }

  // floating text
  fx = fx.filter(f => now - f.t0 < 1100);
  for (const f of fx) {
    const t = (now - f.t0) / 1100;
    ctx.globalAlpha = 1 - t * t;
    ctx.font = 'bold 15px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const px = wxOf(f.x, f.y), py = wyOf(f.x, f.y) - 12 - t * 28;
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
  if (G.vis[y][x] === 0) { select({ kind: 'tile', x, y }); return; }
  const canAct = G.cur === 0 && !G.busy;
  if (canAct && sel && sel.kind === 'unit') {
    const u = unitById(sel.id);
    if (u && u.owner === 0) {
      if (selMoves.some(m => m.x === x && m.y === y)) { doMove(u, x, y); refreshSel(); ui(); return; }
      const tg = selTargets.find(e => e.x === x && e.y === y);
      if (tg) { attack(u, tg); refreshSel(); ui(); return; }
    }
  }
  const un = G.vis[y][x] === 2 ? unitAt(x, y) : null;
  if (un && un.owner === 0) select({ kind: 'unit', id: un.id });
  else select({ kind: 'tile', x, y });
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
    if (dragMoved > 6) { cam.x -= dx / cam.z; cam.y -= dy / cam.z; }
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
function zoomBy(f) { cam.z = Math.min(2.2, Math.max(0.4, cam.z * f)); }
cv.addEventListener('wheel', e => { e.preventDefault(); zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1); }, { passive: false });
addEventListener('resize', resize);
addEventListener('keydown', e => {
  if (!G || !$('menu').hidden) return;
  if (e.key === 'e' || e.key === 'E') endTurn();
  else if (e.key === 'Escape') select(null);
});

/* ---------- menus ---------- */
function showGame(show) { $('hud').hidden = !show; $('panel').hidden = !show; $('menu').hidden = show; }
function centerOnCapital() {
  const c = cityTiles(0)[0];
  if (c) { cam.x = wxOf(c.x, c.y); cam.y = wyOf(c.x, c.y) + TH / 2; }
  cam.z = W < 700 ? 0.8 : 1;
}
function begin(state) {
  G = state; G.busy = false; sel = null; selMoves = []; selTargets = []; fx = [];
  $('gameover').hidden = true;
  if (G.cur !== 0) G.cur = 0;
  updateVis(); centerOnCapital(); showGame(true); ui();
  toast(G.turn === 1 ? 'Capture villages, harvest food, build an army!' : 'Welcome back!');
}
$('btn-new').onclick = () => {
  const s = newGame(+$('opt-opp').value, +$('opt-size').value, (Math.random() * 2 ** 31) | 0);
  begin(s); startTurnOne();
};
function startTurnOne() { updateVis(); save(); }
$('btn-continue').onclick = () => { const s = loadSave(); if (s) begin(s); };
$('btn-resume').onclick = () => showGame(true);
$('btn-menu').onclick = () => { $('menu').hidden = false; refreshMenu(); };
$('btn-end').onclick = endTurn;
const openHelp = () => { $('help').hidden = false; };
$('btn-help').onclick = openHelp;
$('link-help').onclick = e => { e.preventDefault(); openHelp(); };
$('btn-help-close').onclick = () => { $('help').hidden = true; };
$('btn-again').onclick = () => { $('gameover').hidden = true; showGame(false); refreshMenu(); };
function refreshMenu() {
  $('btn-continue').hidden = !loadSave();
  $('btn-resume').hidden = !(G && !G.over);
}

resize(); refreshMenu(); requestAnimationFrame(draw);
