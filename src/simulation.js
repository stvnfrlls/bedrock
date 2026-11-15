export const WIDTH = 48;
export const HEIGHT = 30;
export const TICK_MS = 5000;
export const OFFLINE_LIMIT_MS = 15 * 60_000;
export const ORES = { iron: 'Iron ore', copper: 'Copper ore' };
export const GOODS = ['food', 'water', 'oil', 'energy', 'materials', ...Object.keys(ORES)];
export const ROOMS = {
  farm: { name: 'Hydroponics', icon: '✿', color: '#a9cf79', cost: 16, jobs: 2, detail: 'Grows food using water and power.' },
  water: { name: 'Water pump', icon: '◈', color: '#69c8e5', cost: 12, jobs: 2, deposit: 'water', detail: 'Pumps water from an exposed aquifer.' },
  oil: { name: 'Oil extractor', icon: '●', color: '#edb86c', cost: 12, jobs: 2, deposit: 'oil', detail: 'Draws fuel from an exposed oil seam.' },
  power: { name: 'Generator', icon: 'ϟ', color: '#e9d16d', cost: 18, jobs: 2, detail: 'Burns oil to produce electricity.' },
  home: { name: 'Quarters', icon: '⌂', color: '#d3a3b9', cost: 20, jobs: 0, detail: 'Adds three beds. New residents arrive when supplies are stable.' },
  guard: { name: 'Guard post', icon: '⬟', color: '#ef907f', cost: 20, jobs: 2, detail: 'Staff this post to help defend the bunker gate.' },
  gate: { name: 'Bunker gate', jobs: 2, fixed: true },
  grove: { name: 'Woodcutting', jobs: 2, fixed: true },
  scavenging: { name: 'Surface scavenging', jobs: 2, fixed: true },
  caveScavenging: { name: 'Cave scavenging', jobs: 1, fixed: true },
  mine: { name: 'Ore mine', icon: '⛏', color: '#b8beca', cost: 12, jobs: 2, detail: 'Extracts iron or copper from exposed ore using power.' },
  lab: { name: 'Research lab', icon: '⚗', color: '#b8a4cf', cost: 14, jobs: 1, detail: 'Researches building upgrades and weapon designs.' },
  workshop: { name: 'Workshop', icon: '⚙', color: '#dbb995', cost: 14, jobs: 1, detail: 'Fabricates researched weapons from mined ore.' },
  storage: { name: 'Storage', icon: '▦', color: '#b1b7ab', cost: 16, jobs: 0, detail: 'Adds 80 units of capacity to every stockpile.' },
};
export const RESEARCH = {
  reinforcement: { name: 'Reinforced construction', description: 'Unlocks level 2 building upgrades.', cost: { materials: 10, iron: 4 }, work: 4 },
  pistols: { name: 'Sidearm fabrication', description: 'Unlocks pistol fabrication.', cost: { materials: 8, iron: 3, copper: 3 }, work: 5 },
  rifles: { name: 'Rifle fabrication', description: 'Unlocks rifle fabrication.', requires: 'pistols', cost: { materials: 12, iron: 8, copper: 6 }, work: 7 },
};

export const WEAPONS = {
  pistol: { name: 'Pistol', requires: 'pistols', cost: { iron: 5, copper: 3 }, work: 3, defense: 1 },
  rifle: { name: 'Rifle', requires: 'rifles', cost: { iron: 9, copper: 5 }, work: 5, defense: 2 },
};

export const UPGRADE_COST = { materials: 18, iron: 8, copper: 6 };
export const UPGRADE_BENEFITS = {
  farm: '50% more production at full supply',
  water: '50% more production at full supply',
  oil: '50% more production at full supply',
  power: '50% more production at full supply',
  home: '2 additional beds',
  guard: '+1 defense per assigned guard',
  storage: '+80 capacity for every stockpile',
  mine: '50% faster extraction',
  lab: '50% faster research',
  workshop: '50% faster fabrication',
};

const NAMES = ['Mara', 'Ivo', 'June', 'Rey', 'Sana', 'Theo', 'Niko', 'Ada', 'Sol', 'Wren', 'Eli', 'Bea'];
const MAX_RESIDENTS = NAMES.length;
export const GATE_REPAIR_COST = 8;
export const GATE_REPAIR_POINTS = 40;
export const RAID_APPROACH_TICKS = 2;
const RAID_APPROACH_DISTANCE = 6;
export const SURFACE_ROW = -1;
export const MOUNTAIN_MOUTH = 13;
const MOUNTAIN_INNER_STAIRS = 20;
const MOUNTAIN_BRANCH_DEPTH = 3;
const SURFACE_TILE = Object.freeze({ open: true, deposit: null });
const GATHERING_JOBS = {
  grove: { output: 'materials', yield: 5, recovery: 10 },
  scavenging: { output: 'food', yield: 6, recovery: 9 },
  caveScavenging: { output: 'food', yield: 3, recovery: 15 },
};

export function tileAt(state, x, y) {
  if (x < 0 || x >= WIDTH) return undefined;
  if (y >= 0) return state.tiles[y * WIDTH + x];
  const { entrance } = state;
  if (y === SURFACE_ROW && entrance && (entrance.kind === 'flat' || x <= MOUNTAIN_INNER_STAIRS)) return SURFACE_TILE;
}

const raidTunnelStart = gate => gate.x - RAID_APPROACH_DISTANCE;

export function entranceStairs(state) {
  return state.entrance?.stairs ?? [];
}

export function raidRoute(state) {
  const { gate, entrance } = state;
  const mountain = entrance.kind === 'mountain';
  const depth = mountain ? MOUNTAIN_BRANCH_DEPTH : gate.y;
  const junction = entrance.stairs[0].x;
  const route = [];
  for (let x = raidTunnelStart(gate); x <= junction; x++) route.push([x, depth]);
  for (let y = depth - 1; y >= gate.y; y--) route.push([junction, y]);
  for (let x = junction + 1; x < gate.x; x++) route.push([x, gate.y]);
  return route;
}

export function isSurfaceJob(room) {
  return room?.y === SURFACE_ROW && Boolean(GATHERING_JOBS[room.kind]);
}

export function workDestination(state, room, slot) {
  if (state.raid && isSurfaceJob(room)) {
    const mountain = state.entrance.kind === 'mountain';
    return mountain ? [MOUNTAIN_INNER_STAIRS, 0] : [state.gate.x + 2, state.gate.y];
  }
  return [room.x + slot % 2, room.y];
}
export const neighbors = (x, y) => [[x-1,y],[x+1,y],[x,y-1],[x,y+1]];
export const roomLevel = room => room.level ?? 1;
export const capacity = state => 100 + state.rooms.reduce((sum, room) =>
  room.kind === 'storage' ? sum + 80 * roomLevel(room) : sum, 0);
export const beds = state => 4 + state.rooms.reduce((sum, room) =>
  room.kind === 'home' ? sum + 3 + 2 * (roomLevel(room) - 1) : sum, 0);

function random(state) {
  state.rng = (Math.imul(1664525, state.rng) + 1013904223) >>> 0;
  return state.rng / 0x100000000;
}

function log(state, type, text) {
  state.events.push({ id: state.nextEvent++, tick: state.tick, type, text });
  if (state.events.length > 40) state.events.shift();
}

const SEED_RANGE = 0x100000000;
export const randomMapSeed = () => Math.floor(Math.random() * SEED_RANGE);

export function parseMapSeed(value) {
  const input = value.trim();
  if (!/^\d+$/.test(input)) return null;
  const seed = Number(input);
  return seed < SEED_RANGE ? seed : null;
}

export function createBunker(seed = randomMapSeed()) {
  const state = {
    seed, rng: seed >>> 0, tick: 0, nextRaid: 32, nextEvent: 1, nextRoom: 3,
    tiles: [], rooms: [{ id: 1, kind: 'farm', x: 21, y: 11 }, { id: 2, kind: 'power', x: 26, y: 11 }],
    residents: NAMES.slice(0, 4).map((name, id) => ({ id, name, room: id < 2 ? id + 1 : null })),
    stock: { food: 36, water: 37, oil: 34, energy: 42, materials: 62 },
    health: 100, crises: { food: false, water: false, energy: false }, events: [],
  };
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const open = x >= 19 && x <= 29 && y >= 9 && y <= 14;
      const roll = random(state);
      const deposit = open ? null : roll < .075 ? 'water' : roll < .15 ? 'oil' : roll < .39 ? 'materials' : null;
      state.tiles.push({ open, deposit });
    }
  }
  tileAt(state, 18, 10).deposit = 'water';
  tileAt(state, 30, 10).deposit = 'oil';
  seedOre(tileAt(state, 18, 11), 'iron');
  seedOre(tileAt(state, 30, 11), 'copper');
  log(state, 'info', 'Four residents are sheltering underground. Staff the bunker gate before the next raid.');
  return upgradeCampaign(state, seed & 1 ? 'mountain' : 'flat');
}

export function upgradeCampaign(state, kind = 'flat') {
  if (state.entrance) return initializeProgression(state);

  const gateX = 16;
  const caveX = 36;
  const mountain = kind === 'mountain';
  const oldCave = state.rooms.find(room => room.kind === 'scavenging');
  let floor = oldCave?.y ?? 12;
  if (!state.gate) {
    const otherFloors = Array.from({ length: HEIGHT - 9 }, (_, i) => i + 9).filter(y => y !== 10 && y !== 12);
    floor = [12, ...otherFloors].find(y => !state.rooms.some(room => room.y === y &&
      ((room.x + 1 >= raidTunnelStart({ x: gateX }) && room.x <= gateX + 2) ||
        (room.x + 1 >= caveX && room.x <= caveX + 1)))) ?? HEIGHT;
    if (floor === HEIGHT) {
      state.tiles.push(...Array.from({ length: WIDTH }, () => ({ open: false, deposit: null })));
    }
    const accessX = mountain ? MOUNTAIN_INNER_STAIRS : raidTunnelStart({ x: gateX });
    for (let x = accessX; x <= caveX + 1; x++) tileAt(state, x, floor).open = true;
    for (let row = Math.min(12, floor); row <= Math.max(12, floor); row++) tileAt(state, 24, row).open = true;
    const gateY = mountain ? SURFACE_ROW : floor;
    state.gate = { x: gateX, y: gateY, integrity: 100 };
    state.raid = null;
    state.rooms.push({ id: state.nextRoom++, kind: 'gate', x: gateX + 1, y: gateY });
  }

  const outerStairs = { x: state.gate.x - 2, bottom: mountain ? MOUNTAIN_BRANCH_DEPTH : state.gate.y };
  const stairs = mountain ? [outerStairs, { x: MOUNTAIN_INNER_STAIRS, bottom: floor }] : [outerStairs];
  state.entrance = { kind, stairs };
  for (const { x, bottom } of stairs) {
    for (let y = 0; y <= bottom; y++) tileAt(state, x, y).open = true;
  }
  for (const [x, y] of raidRoute(state)) {
    if (y >= 0) tileAt(state, x, y).open = true;
  }

  for (const [siteKind, x] of [['grove', 5], ['scavenging', 8]]) {
    const existing = state.rooms.find(room => room.kind === siteKind);
    if (existing) Object.assign(existing, { x, y: SURFACE_ROW });
    else state.rooms.push({ id: state.nextRoom++, kind: siteKind, x, y: SURFACE_ROW });
  }
  state.rooms.push({ id: state.nextRoom++, kind: 'caveScavenging', x: caveX, y: floor });
  state.harvests = { grove: state.cavern?.grove ?? [0, 0], scavenging: state.cavern?.scavenging ?? [0, 0], caveScavenging: [0] };
  delete state.cavern;
  return initializeProgression(state);
}

function seedOre(tile, ore) {
  tile.deposit = ore;
  tile.remaining = ore === 'iron' ? 64 : 58;
}

function seedNearbyOre(state, ore, targetX) {
  let best;
  let distance = Infinity;
  for (const [index, tile] of state.tiles.entries()) {
    if (tile.deposit) continue;
    const x = index % WIDTH;
    const y = Math.floor(index / WIDTH);
    if (roomAt(state, x, y) || reservedPassage(state, x, y)) continue;
    const score = Math.abs(x - targetX) + Math.abs(y - 11) * 2 + (tile.open ? 3 : 0);
    if (score >= distance) continue;
    best = tile;
    distance = score;
  }
  if (best) seedOre(best, ore);
}

function initializeProgression(state) {
  if (state.research) return state;
  state.stock.iron = 0;
  state.stock.copper = 0;
  state.research = { completed: [], active: null };
  state.crafting = null;
  state.weapons = { pistol: 0, rifle: 0 };

  if (tileAt(state, 18, 11).deposit !== 'iron') seedNearbyOre(state, 'iron', 18);
  if (tileAt(state, 30, 11).deposit !== 'copper') seedNearbyOre(state, 'copper', 30);
  for (const [index, tile] of state.tiles.entries()) {
    if (tile.open || tile.deposit) continue;
    const roll = (Math.imul(state.seed ^ index, 0x9e3779b1) >>> 0) / SEED_RANGE;
    if (roll < .12) seedOre(tile, roll < .06 ? 'iron' : 'copper');
  }
  return state;
}

const fail = message => ({ ok: false, message });
const success = message => ({ ok: true, message });

export function excavate(state, x, y) {
  const tile = tileAt(state, x, y);
  if (!tile || tile.open) return fail('Choose a solid tile at the edge of an open tunnel.');
  if (!neighbors(x, y).some(([nx, ny]) => ny >= 0 && tileAt(state, nx, ny)?.open)) {
    return fail('Excavate from an open edge to keep the bunker connected.');
  }
  tile.open = true;
  state.stock.materials = Math.min(capacity(state), state.stock.materials + (tile.deposit === 'materials' ? 8 : 1));
  if (tile.deposit === 'water') log(state, 'water-found', 'Aquifer exposed. Build a water pump across this tile.');
  if (tile.deposit === 'oil') log(state, 'oil-found', 'Oil seam exposed. Build an extractor across this tile.');
  if (tile.deposit === 'materials') log(state, 'info', 'Salvaged 8 building materials.');
  if (Object.hasOwn(ORES, tile.deposit)) {
    log(state, 'info', ORES[tile.deposit] + ' exposed. Build an ore mine across this tile.');
  }
  return success('Tile excavated.');
}

export const roomAt = (state, x, y) => state.rooms.find(room =>
  room.y === y && (room.x === x || room.x + 1 === x || (room.kind === 'gate' && room.x - 1 === x)));

export function ladderEdges(state) {
  const edges = new Set();
  const height = state.tiles.length / WIDTH;
  for (let y = 0; y < height - 1; y++) {
    // A continuous opening shared by two floors needs one ladder.
    for (let x = 0; x < WIDTH;) {
      if (!tileAt(state, x, y).open || !tileAt(state, x, y + 1).open) {
        x++;
        continue;
      }
      const start = x;
      let clearColumn;
      do {
        if (clearColumn === undefined && !roomAt(state, x, y) && !roomAt(state, x, y + 1)) {
          clearColumn = x;
        }
        x++;
      } while (tileAt(state, x, y)?.open && tileAt(state, x, y + 1)?.open);
      const starterLadder = y >= 9 && y < 14 && start <= 24 && x > 24;
      edges.add(y * WIDTH + (starterLadder ? 24 : (clearColumn ?? start)));
    }
  }
  for (const { x, bottom } of entranceStairs(state)) {
    for (let y = SURFACE_ROW; y < bottom; y++) edges.add(y * WIDTH + x);
  }
  return edges;
}

export function crewRoute(state, ladders, start, goal) {
  const key = (x, y) => y * WIDTH + x;
  const queue = [start];
  const prev = new Map([[key(...start), null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    const [x, y] = current;
    if (x === goal[0] && y === goal[1]) {
      const path = [];
      for (let node = current; prev.get(key(...node)); node = prev.get(key(...node))) path.unshift(node);
      return path;
    }
    for (const next of neighbors(x, y)) {
      const [nextX, nextY] = next;
      const nextKey = key(...next);
      if (!tileAt(state, nextX, nextY)?.open || prev.has(nextKey)) continue;
      if (y !== nextY && !ladders.has(key(x, Math.min(y, nextY)))) continue;
      prev.set(nextKey, current);
      queue.push(next);
    }
  }
  return [];
}

function reservedPassage(state, x, y) {
  if (entranceStairs(state).some(stair => y <= stair.bottom && x === stair.x)) {
    return 'The entrance stairs must stay clear.';
  }
  const gate = state.gate;
  const mountain = state.entrance?.kind === 'mountain';
  const raidDepth = mountain ? MOUNTAIN_BRANCH_DEPTH : gate?.y;
  if (gate && y === raidDepth && x <= gate.x - (mountain ? 2 : 0) && x >= raidTunnelStart(gate)) {
    return 'The gate and approach tunnel must stay clear.';
  }
  return null;
}

export function placement(state, kind, x, y) {
  const spec = ROOMS[kind];
  if (!spec) return 'Select a room to build.';
  if (spec.fixed) return 'This work site is already part of the bunker.';
  if (y < 0) return 'Rooms must be built underground.';
  const passage = reservedPassage(state, x, y) || reservedPassage(state, x + 1, y);
  if (passage) return passage;
  const tiles = [tileAt(state, x, y), tileAt(state, x+1, y)];
  if (!tiles.every(tile => tile?.open) || roomAt(state, x, y) || roomAt(state, x+1, y)) {
    return 'A room needs two adjacent empty tiles.';
  }
  if (kind === 'mine' && !tiles.some(tile => Object.hasOwn(ORES, tile.deposit) && tile.remaining > 0)) {
    return 'Cover exposed iron or copper ore with reserves remaining.';
  }
  if (spec.deposit && !tiles.some(tile => tile.deposit === spec.deposit)) {
    return spec.deposit === 'water' ? 'Cover an exposed aquifer.' : 'Cover an exposed oil seam.';
  }
  if (state.stock.materials < spec.cost) return 'Insufficient building materials.';
  return null;
}

export function construct(state, kind, x, y) {
  const problem = placement(state, kind, x, y);
  if (problem) return fail(problem);
  state.stock.materials -= ROOMS[kind].cost;
  state.rooms.push({ id: state.nextRoom++, kind, x, y });
  log(state, 'info', ROOMS[kind].name + ' constructed.');
  return success(ROOMS[kind].name + ' constructed.');
}

export const workers = (state, id) => state.residents.filter(resident => resident.room === id);

export function assign(state, roomId, residentId) {
  const resident = state.residents.find(person => person.id === residentId);
  if (!resident) return fail('Choose a resident.');
  if (roomId !== null) {
    const room = state.rooms.find(item => item.id === roomId);
    if (!room || (resident.room !== roomId && workers(state, roomId).length >= ROOMS[room.kind].jobs)) {
      return fail('This room has no free work slots.');
    }
  }
  resident.room = roomId;
  return success(roomId === null ? resident.name + ' is off duty.' : resident.name + ' assigned.');
}

function stockProblem(state, cost) {
  const missing = Object.entries(cost).find(([resource, amount]) => state.stock[resource] < amount);
  return missing ? 'Insufficient ' + (ORES[missing[0]]?.toLowerCase() ?? missing[0]) + '.' : null;
}

function spend(state, cost) {
  for (const [resource, amount] of Object.entries(cost)) state.stock[resource] -= amount;
}

function staffed(state, kind) {
  return state.rooms.some(room => room.kind === kind && workers(state, room.id).length);
}

export function researchProblem(state, id) {
  if (!Object.hasOwn(RESEARCH, id)) return 'Choose a research project.';
  const spec = RESEARCH[id];
  if (state.research.completed.includes(id)) return 'Research complete.';
  if (state.research.active) return 'A research project is already running.';
  if (spec.requires && !state.research.completed.includes(spec.requires)) {
    return 'Requires ' + RESEARCH[spec.requires].name + '.';
  }
  if (!staffed(state, 'lab')) return 'Staff a research lab.';
  return stockProblem(state, spec.cost);
}

export function startResearch(state, id) {
  const problem = researchProblem(state, id);
  if (problem) return fail(problem);
  const spec = RESEARCH[id];
  spend(state, spec.cost);
  state.research.active = { id, remaining: spec.work };
  return success('Research started: ' + spec.name + '.');
}

export function craftingProblem(state, id) {
  if (!Object.hasOwn(WEAPONS, id)) return 'Choose a weapon to craft.';
  const spec = WEAPONS[id];
  if (!state.research.completed.includes(spec.requires)) return 'Requires ' + RESEARCH[spec.requires].name + '.';
  if (state.crafting) return 'The workshop already has an order.';
  if (!staffed(state, 'workshop')) return 'Staff a workshop.';
  return stockProblem(state, spec.cost);
}

export function startCrafting(state, id) {
  const problem = craftingProblem(state, id);
  if (problem) return fail(problem);
  const spec = WEAPONS[id];
  spend(state, spec.cost);
  state.crafting = { id, remaining: spec.work };
  return success('Fabrication started: ' + spec.name + '.');
}

export function upgradeProblem(state, room) {
  if (!room || !Object.hasOwn(UPGRADE_BENEFITS, room.kind)) return 'This site cannot be upgraded.';
  if (roomLevel(room) >= 2) return 'This room is already at level 2.';
  if (!state.research.completed.includes('reinforcement')) return 'Requires Reinforced construction research.';
  return stockProblem(state, UPGRADE_COST);
}

export function improveRoom(state, roomId) {
  const room = state.rooms.find(candidate => candidate.id === roomId);
  const problem = upgradeProblem(state, room);
  if (problem) return fail(problem);
  spend(state, UPGRADE_COST);
  room.level = 2;
  const message = ROOMS[room.kind].name + ' upgraded to level 2.';
  log(state, 'info', message);
  return success(message);
}

export function equipWeapon(state, residentId, id) {
  const person = state.residents.find(resident => resident.id === residentId);
  if (!person) return fail('Choose a resident.');
  if (id !== null && !Object.hasOwn(WEAPONS, id)) return fail('Choose a weapon.');
  const current = person.weapon ?? null;
  if (id === current) return success('Equipment unchanged.');
  if (id !== null && !state.weapons[id]) return fail('No ' + WEAPONS[id].name.toLowerCase() + ' is available.');
  if (current) state.weapons[current]++;
  if (id) state.weapons[id]--;
  person.weapon = id;
  return success(person.name + (id ? ' equipped a ' + WEAPONS[id].name.toLowerCase() + '.' : ' returned their weapon.'));
}

function roomLabor(state, room) {
  const health = .4 + .6 * state.health / 100;
  const efficiency = roomLevel(room) === 2 ? 1.5 : 1;
  return workers(state, room.id).length * health * efficiency;
}

export function oreTiles(state, room) {
  return [tileAt(state, room.x, room.y), tileAt(state, room.x + 1, room.y)]
    .filter(tile => tile && Object.hasOwn(ORES, tile.deposit));
}

function runMines(state) {
  const limit = capacity(state);
  for (const room of state.rooms) {
    if (room.kind !== 'mine') continue;
    let work = roomLabor(state, room) * 2.4;
    for (const tile of oreTiles(state, room)) {
      const ore = tile.deposit;
      const amount = Math.min(work, tile.remaining, limit - state.stock[ore], state.stock.energy / .25);
      if (amount <= 0) continue;
      state.stock[ore] += amount;
      state.stock.energy -= amount * .25;
      tile.remaining -= amount;
      work -= amount;
      if (tile.remaining === 0) log(state, 'info', ORES[ore] + ' seam depleted at mine ' + room.id + '.');
    }
  }
}

function advanceOrder(state, kind, order) {
  const labor = state.rooms.reduce((total, room) =>
    room.kind === kind ? total + roomLabor(state, room) : total, 0);
  const work = Math.min(labor, order.remaining, state.stock.energy / .5);
  state.stock.energy -= work * .5;
  order.remaining -= work;
  return order.remaining === 0;
}

function runOrders(state) {
  const task = state.research.active;
  if (task && advanceOrder(state, 'lab', task)) {
    state.research.completed.push(task.id);
    state.research.active = null;
    log(state, 'info', 'Research complete: ' + RESEARCH[task.id].name + '.');
  }
  const order = state.crafting;
  if (order && advanceOrder(state, 'workshop', order)) {
    state.weapons[order.id]++;
    state.crafting = null;
    log(state, 'info', WEAPONS[order.id].name + ' ready to equip.');
  }
}

function runRooms(state, kind, output, amount, inputs = {}) {
  for (const room of state.rooms) {
    if (room.kind !== kind) continue;
    let labor = roomLabor(state, room);
    for (const [resource, cost] of Object.entries(inputs)) labor = Math.min(labor, state.stock[resource] / cost);
    for (const [resource, cost] of Object.entries(inputs)) state.stock[resource] -= labor * cost;
    state.stock[output] = Math.min(capacity(state), state.stock[output] + labor * amount);
  }
}

function gatherSupplies(state) {
  if (state.tick % 3 !== 0) return;

  for (const room of state.rooms) {
    const job = GATHERING_JOBS[room.kind];
    if (!job || (isSurfaceJob(room) && (state.raid || state.tick >= state.nextRaid))) continue;
    const spots = state.harvests[room.kind];
    const count = workers(state, room.id).length;
    for (let slot = 0; slot < count; slot++) {
      if (spots[slot] > state.tick || state.stock[job.output] >= capacity(state)) continue;
      state.stock[job.output] = Math.min(capacity(state), state.stock[job.output] + job.yield);
      spots[slot] = state.tick + job.recovery;
    }
  }
}

export function repairGate(state) {
  if (state.raid) return fail('Wait until the raid ends to repair the gate.');
  if (state.gate.integrity === 100) return fail('The gate is already at full integrity.');
  if (state.stock.materials < GATE_REPAIR_COST) return fail('Insufficient building materials.');
  state.stock.materials -= GATE_REPAIR_COST;
  state.gate.integrity = Math.min(100, state.gate.integrity + GATE_REPAIR_POINTS);
  const message = 'Gate repaired to ' + state.gate.integrity + '%.';
  log(state, 'info', message);
  return success(message);
}

function finishRaid(state) {
  state.raid = null;
  state.nextRaid = state.tick + 27 + Math.floor(random(state) * 21);
}

function advanceRaid(state) {
  const raid = state.raid;
  if (!raid) {
    if (state.tick < state.nextRaid) return;
    const remaining = 2 + Math.floor(random(state) * 3) + Math.floor(state.residents.length / 5);
    state.raid = { phase: 'approach', phaseTick: state.tick, remaining };
    log(state, 'raid', 'Raiders spotted in the underground approach tunnel.');
    return;
  }

  if (raid.phase === 'approach') {
    if (state.tick - raid.phaseTick < RAID_APPROACH_TICKS) return;
    raid.phase = 'attack';
    raid.phaseTick = state.tick;
    log(state, 'raid', 'Raiders are attacking the bunker gate.');
    return;
  }

  if (raid.phase === 'breach') {
    finishRaid(state);
    return;
  }

  const defense = state.rooms.reduce((total, room) => {
    if (room.kind !== 'gate' && room.kind !== 'guard') return total;
    return workers(state, room.id).reduce((strength, person) =>
      strength + roomLevel(room) + (WEAPONS[person.weapon]?.defense ?? 0), total);
  }, 0);
  const damage = Math.max(0, raid.remaining * 14 - defense * 8);
  state.gate.integrity = Math.max(0, state.gate.integrity - damage);
  raid.remaining = Math.max(0, raid.remaining - defense);
  if (raid.remaining === 0) {
    log(state, 'raid', 'The defenders repelled the raid at the bunker gate.');
    finishRaid(state);
  } else if (state.gate.integrity === 0) {
    const food = Math.min(Math.floor(state.stock.food), raid.remaining * 3);
    const injury = Math.min(state.health, raid.remaining * 5);
    state.stock.food -= food;
    state.health -= injury;
    log(state, 'raid', 'Raiders breached the gate. Lost ' + food + ' food. Crew condition fell ' + Math.round(injury) + ' points.');
    raid.phase = 'breach';
    raid.phaseTick = state.tick;
  } else if (state.tick - raid.phaseTick >= 4) {
    log(state, 'raid', 'Raiders retreated. The bunker gate held.');
    finishRaid(state);
  }
}

export function step(state) {
  state.tick++;
  runRooms(state, 'power', 'energy', 4.8, { oil: .75 });
  runRooms(state, 'water', 'water', 3.1, { energy: .4 });
  runRooms(state, 'oil', 'oil', 1.65, { energy: .55 });
  runRooms(state, 'farm', 'food', 2.45, { water: .58, energy: .6 });
  gatherSupplies(state);
  runMines(state);
  runOrders(state);
  const population = state.residents.length;
  const use = { food: .44, water: .38, energy: .48 };
  for (const [resource, rate] of Object.entries(use)) {
    const required = population * rate;
    const shortage = state.stock[resource] + 1e-9 < required;
    if (shortage !== state.crises[resource]) {
      log(state, resource, shortage ? ({ food: 'Food crisis. Rations have run out.', water: 'Water crisis. The drinking supply is depleted.', energy: 'Power failure. Life support is underpowered.' })[resource] : 'Supply restored: ' + resource + '.');
    }
    state.crises[resource] = shortage;
    state.stock[resource] = Math.max(0, state.stock[resource] - required);
  }
  const shortages = Object.values(state.crises).filter(Boolean).length;
  state.health = Math.min(100, Math.max(0, state.health + (shortages ? -shortages * 1.4 : .8)));
  advanceRaid(state);
  if (state.tick % 18 === 0 && population < Math.min(beds(state), MAX_RESIDENTS) &&
      state.health >= 75 && state.stock.food >= 25 && state.stock.water >= 20) {
    state.residents.push({ id: population, name: NAMES[population], room: null });
    log(state, 'info', NAMES[population] + ' joined the bunker.');
  }
}

export function catchUp(state, savedAt, now = Date.now()) {
  const elapsed = Number.isFinite(savedAt) && Number.isFinite(now) ? Math.max(0, now - savedAt) : 0;
  const ticks = Math.floor(Math.min(elapsed, OFFLINE_LIMIT_MS) / TICK_MS);
  const before = { ...state.stock };
  const firstEvent = state.nextEvent;
  const events = [];
  let nextEvent = firstEvent;
  for (let i = 0; i < ticks; i++) {
    step(state);
    if (nextEvent === state.nextEvent) continue;
    events.push(...state.events.filter(event => event.id >= nextEvent));
    nextEvent = state.nextEvent;
  }
  const change = Object.fromEntries(GOODS.map(resource => [resource, state.stock[resource] - before[resource]]));
  return { ticks, capped: elapsed > OFFLINE_LIMIT_MS, change, events };
}

