import test from 'node:test';
import assert from 'node:assert/strict';
import * as game from '../src/simulation.js';

const tick = (state, count) => {
  for (let i = 0; i < count; i++) {
    state.stock.energy = 90;
    game.step(state);
  }
};
const build = (state, kind, x, y) => {
  assert.equal(game.construct(state, kind, x, y).ok, true);
  return state.rooms.at(-1);
};
const staff = (state, room, worker = 2) => assert.equal(game.assign(state, room.id, worker).ok, true);
const supply = () => {
  const state = game.createBunker(42);
  Object.assign(state.stock, { materials: 100, iron: 90, copper: 90 });
  state.nextRaid = 1000;
  return state;
};

test('both ores have reachable seeded seams and only staffed mines extract finite ore', () => {
  const state = game.createBunker(43);
  assert.equal(game.tileAt(state, 18, 11).deposit, 'iron');
  assert.equal(game.tileAt(state, 30, 11).deposit, 'copper');
  assert.equal(game.construct(state, 'mine', 22, 13).ok, false);
  assert.equal(game.excavate(state, 18, 11).ok, true);
  const tile = game.tileAt(state, 18, 11);
  tile.remaining = 1;
  const mine = build(state, 'mine', 18, 11);
  tick(state, 1);
  assert.equal(state.stock.iron, 0);
  staff(state, mine);
  tick(state, 1);
  assert.equal(state.stock.iron, 1);
  assert.equal(tile.remaining, 0);
  tick(state, 2);
  assert.equal(state.stock.iron, 1);
  assert.equal(state.events.filter(event => event.text.includes('seam depleted')).length, 1);
});

test('staffed lab research unlocks an in-place upgrade and visibly changes room benefits', () => {
  const state = supply();
  const storage = build(state, 'storage', 22, 13);
  const lab = build(state, 'lab', 24, 13);
  assert.equal(game.improveRoom(state, storage.id).ok, false);
  assert.equal(game.startResearch(state, 'reinforcement').ok, false);
  staff(state, lab);
  assert.equal(game.startResearch(state, 'reinforcement').ok, true);
  const spent = state.stock.iron;
  assert.equal(game.startResearch(state, 'pistols').ok, false);
  assert.equal(state.stock.iron, spent);
  tick(state, 6);
  assert.ok(state.research.completed.includes('reinforcement'));
  const previousCapacity = game.capacity(state);
  assert.equal(game.improveRoom(state, storage.id).ok, true);
  assert.equal(game.roomLevel(storage), 2);
  assert.equal(game.capacity(state), previousCapacity + 80);
  const balance = state.stock.materials;
  assert.equal(game.improveRoom(state, storage.id).ok, false);
  assert.equal(state.stock.materials, balance);
});

test('workshop weapons require their research and inventory can be moved between crew', () => {
  const state = supply();
  const lab = build(state, 'lab', 22, 13);
  const shop = build(state, 'workshop', 24, 13);
  staff(state, lab);
  staff(state, shop, 3);
  assert.equal(game.startResearch(state, 'rifles').ok, false);
  assert.equal(game.startCrafting(state, 'pistol').ok, false);
  assert.equal(game.startResearch(state, 'pistols').ok, true);
  tick(state, 8);
  assert.equal(game.startCrafting(state, 'pistol').ok, true);
  assert.equal(game.startCrafting(state, 'pistol').ok, false);
  tick(state, 5);
  assert.equal(state.weapons.pistol, 1);
  assert.equal(game.equipWeapon(state, 2, 'pistol').ok, true);
  assert.equal(state.weapons.pistol, 0);
  assert.equal(game.equipWeapon(state, 3, 'pistol').ok, false);
  assert.equal(game.equipWeapon(state, 2, 'rifle').ok, false);
  assert.equal(state.residents[2].weapon, 'pistol');
  assert.equal(game.equipWeapon(state, 2, null).ok, true);
  assert.equal(game.equipWeapon(state, 3, 'pistol').ok, true);
  assert.equal(game.startResearch(state, 'rifles').ok, true);
  tick(state, 10);
  assert.equal(game.startCrafting(state, 'rifle').ok, true);
  tick(state, 7);
  assert.equal(state.weapons.rifle, 1);
});

test('a weapon strengthens gate defense only for a resident assigned to defend', () => {
  const armed = game.createBunker(42);
  armed.nextRaid = 1;
  const gate = armed.rooms.find(room => room.kind === 'gate');
  staff(armed, gate);
  armed.weapons.rifle = 1;
  const unarmed = structuredClone(armed);
  const offDuty = structuredClone(armed);
  assert.equal(game.equipWeapon(armed, 2, 'rifle').ok, true);
  assert.equal(game.equipWeapon(offDuty, 3, 'rifle').ok, true);
  tick(armed, 8);
  tick(unarmed, 8);
  tick(offDuty, 8);
  assert.ok(armed.gate.integrity > unarmed.gate.integrity);
  assert.equal(offDuty.gate.integrity, unarmed.gate.integrity);
});

test('a pre-release save gains ore and technology without losing rooms, seed, deposits, or crew', () => {
  const state = game.createBunker(43);
  for (const tile of state.tiles) {
    if (['iron', 'copper'].includes(tile.deposit)) tile.deposit = null;
    delete tile.remaining;
  }
  delete state.research;
  delete state.crafting;
  delete state.weapons;
  delete state.stock.iron;
  delete state.stock.copper;
  const before = structuredClone(state);
  game.upgradeCampaign(state);
  assert.equal(state.stock.iron, 0);
  assert.equal(state.stock.copper, 0);
  assert.deepEqual(state.research, { completed: [], active: null });
  assert.deepEqual(state.rooms, before.rooms);
  assert.deepEqual(state.residents, before.residents);
  assert.equal(state.rng, before.rng);
  assert.equal(state.seed, before.seed);
  assert.equal(game.tileAt(state, 18, 10).deposit, 'water');
  assert.equal(game.tileAt(state, 30, 10).deposit, 'oil');
  assert.ok(state.tiles.some(tile => tile.deposit === 'iron'));
  assert.ok(state.tiles.some(tile => tile.deposit === 'copper'));
  const migrated = structuredClone(state);
  assert.deepEqual(game.upgradeCampaign(state), migrated);
});

test('research and fabrication continue identically during offline catch-up', () => {
  const online = supply();
  const lab = build(online, 'lab', 22, 13);
  const shop = build(online, 'workshop', 24, 13);
  staff(online, lab);
  staff(online, shop, 3);
  online.research.completed.push('pistols');
  assert.equal(game.startResearch(online, 'rifles').ok, true);
  assert.equal(game.startCrafting(online, 'pistol').ok, true);
  online.stock.energy = 90;
  const offline = structuredClone(online);
  for (let i = 0; i < 9; i++) game.step(online);
  game.catchUp(offline, 1000, 1000 + 9 * game.TICK_MS);
  assert.deepEqual(offline, online);
});

