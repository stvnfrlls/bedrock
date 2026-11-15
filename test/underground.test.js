import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assign, catchUp, construct, createBunker, crewRoute, GATE_REPAIR_COST, HEIGHT, ladderEdges,
  raidRoute, repairGate, step, TICK_MS, tileAt, upgradeCampaign, WIDTH, workDestination, workers,
} from '../src/simulation.js';

const site = (state, kind) => state.rooms.find(room => room.kind === kind);
const advance = (state, count) => {
  for (let i = 0; i < count; i++) step(state);
};

test('the gate and work sites are accessible without occupying the starter deposits', () => {
  const state = createBunker(42);
  const ladders = ladderEdges(state);
  for (const kind of ['gate', 'grove', 'scavenging', 'caveScavenging']) {
    const room = site(state, kind);
    assert.deepEqual(crewRoute(state, ladders, [24, 11], [room.x, room.y]).at(-1), [room.x, room.y]);
    assert.equal(construct(state, kind, 22, 13).ok, false);
  }
  assert.equal(tileAt(state, 18, 10).open, false);
  assert.equal(tileAt(state, 30, 10).open, false);
  assert.equal(construct(state, 'storage', state.gate.x - 1, state.gate.y).ok, false);
});

test('raiders approach the underground gate and only damage the crew after a breach', () => {
  const state = createBunker(42);
  state.nextRaid = 1;
  advance(state, 1);
  assert.equal(state.raid.phase, 'approach');
  assert.equal(state.gate.integrity, 100);
  advance(state, 2);
  assert.equal(state.raid.phase, 'attack');
  advance(state, 1);
  assert.ok(state.gate.integrity < 100 && state.gate.integrity > 0);
  assert.equal(state.health, 100);
  advance(state, 4);
  assert.equal(state.gate.integrity, 0);
  assert.ok(state.health < 100);
  assert.ok(state.events.some(event => event.text.includes('breached the gate')));
});

test('gate defenders repel raiders and can repair damage between attacks', () => {
  const state = createBunker(42);
  state.nextRaid = 1;
  const gate = site(state, 'gate');
  assert.equal(assign(state, gate.id, 2).ok, true);
  assert.equal(assign(state, gate.id, 3).ok, true);
  assert.equal(assign(state, gate.id, 0).ok, false);
  advance(state, 4);
  assert.equal(repairGate(state).ok, false);
  advance(state, 4);
  assert.equal(state.raid, null);
  assert.ok(state.events.some(event => event.text.includes('repelled')));
  assert.ok(state.gate.integrity > 0 && state.gate.integrity < 100);
  assert.equal(state.health, 100);
  const before = state.gate.integrity;
  const materials = state.stock.materials;
  state.stock.materials = GATE_REPAIR_COST - 1;
  assert.equal(repairGate(state).ok, false);
  assert.equal(state.gate.integrity, before);
  state.stock.materials = materials;
  assert.equal(repairGate(state).ok, true);
  assert.equal(state.stock.materials, materials - GATE_REPAIR_COST);
  assert.ok(state.gate.integrity > before && state.gate.integrity <= 100);
});

test('woodcutters and scavengers harvest only while staffed and wildlife and trees recover', () => {
  const state = createBunker(42);
  state.nextRaid = 1000;
  advance(state, 3);
  assert.deepEqual(state.harvests, { grove: [0, 0], scavenging: [0, 0], caveScavenging: [0] });
  const control = structuredClone(state);
  assert.equal(assign(state, site(state, 'grove').id, 2).ok, true);
  assert.equal(assign(state, site(state, 'scavenging').id, 3).ok, true);
  advance(state, 3);
  advance(control, 3);
  assert.ok(state.stock.materials > control.stock.materials);
  assert.ok(state.stock.food > control.stock.food);
  const materials = state.stock.materials;
  const [tree] = state.harvests.grove;
  const [animal] = state.harvests.scavenging;
  assert.ok(tree > state.tick && animal > state.tick);
  assert.equal(assign(state, null, 2).ok, true);
  assert.equal(assign(state, null, 3).ok, true);
  advance(state, Math.max(tree, animal) - state.tick);
  assert.equal(state.stock.materials, materials);
  assert.ok(state.tick >= tree && state.tick >= animal);
  assert.equal(assign(state, site(state, 'grove').id, 2).ok, true);
  assert.equal(assign(state, site(state, 'scavenging').id, 3).ok, true);
  advance(state, 3);
  assert.ok(state.stock.materials > materials);
  assert.ok(state.harvests.scavenging[0] > state.tick);
});

function oldCampaign() {
  const { gate, raid, entrance, harvests, ...state } = createBunker(42);
  state.rooms = state.rooms.filter(room => ['farm', 'power'].includes(room.kind));
  state.nextRoom = 3;
  return state;
}

test('old campaigns gain sites without replacing buildings, assignments, or stock', () => {
  const state = oldCampaign();
  for (const x of [16, 17]) tileAt(state, x, 12).open = true;
  assert.equal(construct(state, 'storage', 16, 12).ok, true);
  state.tick = 7;
  const before = structuredClone(state);
  assert.equal(upgradeCampaign(state), state);
  assert.notEqual(state.gate.y, 12);
  assert.deepEqual(state.rooms.slice(0, before.rooms.length), before.rooms);
  assert.deepEqual(state.residents, before.residents);
  assert.deepEqual(state.stock, before.stock);
  assert.equal(state.rng, before.rng);
  assert.equal(state.tick, before.tick);
  assert.equal(workers(state, 1).length, 1);
  const updated = structuredClone(state);
  assert.deepEqual(upgradeCampaign(state), updated);
});


test('a built-out legacy map gains a reachable gate without placing any sites over rooms', () => {
  const state = oldCampaign();
  for (let y = 9; y < HEIGHT; y++) {
    tileAt(state, 16, y).open = true;
    tileAt(state, 17, y).open = true;
    state.rooms.push({ id: state.nextRoom++, kind: 'storage', x: 16, y });
  }
  const existing = structuredClone(state.rooms);
  upgradeCampaign(state);
  assert.deepEqual(state.rooms.slice(0, existing.length), existing);
  assert.equal(state.gate.y, HEIGHT);
  assert.equal(state.tiles.length, WIDTH * (HEIGHT + 1));
  const target = site(state, 'gate');
  assert.deepEqual(crewRoute(state, ladderEdges(state), [24, 12], [target.x, target.y]).at(-1), [target.x, target.y]);
});

test('an in-progress raid gives the same results online and after offline catch-up', () => {
  const online = createBunker(42);
  online.nextRaid = 1;
  advance(online, 4);
  assert.equal(online.raid.phase, 'attack');
  const offline = structuredClone(online);
  advance(online, 9);
  catchUp(offline, 1000, 1000 + 9 * TICK_MS);
  assert.deepEqual(offline, online);
});


test('seeded games choose both layouts evenly and connect the surface to the gate and bunker', () => {
  let mountain = 0;
  for (let seed = 0; seed < 32; seed++) {
    const state = createBunker(seed);
    const kind = state.entrance?.kind;
    assert.ok(kind === 'flat' || kind === 'mountain');
    assert.equal(kind, createBunker(seed).entrance.kind);
    mountain += Number(kind === 'mountain');
    assert.equal(kind === 'mountain', state.gate.y < 0);
    const ladders = ladderEdges(state);
    for (const name of ['grove', 'scavenging']) {
      const room = site(state, name);
      assert.equal(room.y, -1);
      const route = crewRoute(state, ladders, [room.x, room.y], [24, 12]);
      assert.deepEqual(route.at(-1), [24, 12]);
      assert.ok(route.some(([x, y]) => x === state.gate.x && y === state.gate.y));
    }
    assert.ok(site(state, 'caveScavenging').y >= 9);
    const approach = raidRoute(state);
    assert.ok(approach[0][1] >= 0);
    assert.deepEqual(approach.at(-1), [state.gate.x - 1, state.gate.y]);
    for (const [i, [x, y]] of approach.entries()) {
      assert.ok(tileAt(state, x, y)?.open);
      if (i) assert.equal(Math.abs(x - approach[i - 1][0]) + Math.abs(y - approach[i - 1][1]), 1);
    }
  }
  assert.equal(mountain, 16);
});

test('surface jobs evacuate and pause harvesting during a raid', () => {
  const state = createBunker(43);
  const grove = site(state, 'grove');
  const wildlife = site(state, 'scavenging');
  assert.equal(assign(state, grove.id, 2).ok, true);
  assert.equal(assign(state, wildlife.id, 3).ok, true);
  state.nextRaid = 3;
  advance(state, 3);
  assert.equal(state.raid.phase, 'approach');
  assert.equal(state.stock.materials, 62);
  assert.equal(state.harvests.scavenging[0], 0);
  const shelter = workDestination(state, grove, 0);
  assert.ok(shelter[1] >= 0);
  const path = crewRoute(state, ladderEdges(state), [grove.x, grove.y], shelter);
  assert.deepEqual(path.at(-1), shelter);
  assert.ok(path.some(([x, y]) => x === state.gate.x && y === state.gate.y));
  advance(state, 9);
  assert.equal(state.raid, null);
  assert.deepEqual(workDestination(state, grove, 0), [grove.x, grove.y]);
  assert.ok(state.stock.materials > 62);
});

test('cave wildlife still supplies food when surface jobs are paused by a raid', () => {
  const state = createBunker(43);
  const cave = site(state, 'caveScavenging');
  assert.equal(assign(state, cave.id, 2).ok, true);
  state.nextRaid = 1;
  advance(state, 3);
  assert.equal(state.raid.phase, 'attack');
  assert.ok(state.harvests.caveScavenging[0] > state.tick);
  assert.deepEqual(workDestination(state, cave, 0), [cave.x, cave.y]);
});

test('an existing bunker keeps its gate, room IDs, assignments and raid when adding surface access', () => {
  const state = createBunker(42);
  delete state.entrance;
  delete state.harvests;
  state.cavern = { grove: [5, 0], scavenging: [8, 0] };
  state.rooms = state.rooms.filter(room => room.kind !== 'caveScavenging');
  const grove = site(state, 'grove');
  const wildlife = site(state, 'scavenging');
  grove.x = 31;
  grove.y = 12;
  wildlife.x = 36;
  wildlife.y = 12;
  assign(state, grove.id, 2);
  assign(state, wildlife.id, 3);
  state.raid = { phase: 'attack', phaseTick: 0, remaining: 2 };
  state.gate.integrity = 47;
  const gate = structuredClone(state.gate);
  upgradeCampaign(state);
  assert.deepEqual(state.gate, gate);
  assert.equal(state.raid.phase, 'attack');
  assert.equal(state.residents[2].room, grove.id);
  assert.equal(state.residents[3].room, wildlife.id);
  assert.equal(grove.y, -1);
  assert.equal(wildlife.y, -1);
  assert.deepEqual(state.harvests.grove, [5, 0]);
  assert.deepEqual(state.harvests.scavenging, [8, 0]);
  assert.equal(state.entrance.kind, 'flat');
  const upgraded = structuredClone(state);
  assert.deepEqual(upgradeCampaign(state), upgraded);
});
