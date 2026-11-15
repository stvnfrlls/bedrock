import test from 'node:test';
import assert from 'node:assert/strict';
import { createBunker, excavate, construct, assign, step, catchUp, TICK_MS, OFFLINE_LIMIT_MS, ladderEdges, crewRoute, parseMapSeed } from '../src/simulation.js';

test('excavation requires an open edge and discovers a usable deposit', () => {
  const state = createBunker(42);
  assert.deepEqual(state, createBunker(42));
  assert.equal(excavate(state, 0, 0).ok, false);
  assert.equal(excavate(state, 18, 10).ok, true);
  assert.equal(construct(state, 'water', 17, 10).ok, false);
  excavate(state, 17, 10);
  assert.equal(construct(state, 'water', 17, 10).ok, true);
});

test('assigned workers produce water while residents consume supplies', () => {
  const state = createBunker(42);
  excavate(state, 18, 10);
  excavate(state, 17, 10);
  construct(state, 'water', 18, 10);
  const room = state.rooms.at(-1);
  assert.equal(assign(state, room.id, 0).ok, true);
  const before = { ...state.stock };
  step(state);
  assert.ok(state.stock.water > before.water);
  assert.ok(state.stock.food < before.food);
});

test('offline replay matches live ticks and bounds long or backwards gaps', () => {
  const online = createBunker(42);
  const offline = structuredClone(online);
  for (let i = 0; i < 70; i++) step(online);
  const report = catchUp(offline, 1_000, 1_000 + 70 * TICK_MS);
  assert.deepEqual(offline, online);
  assert.ok(report.events.some(event => event.type === 'raid'));
  assert.equal(catchUp(offline, 2000, 1000).ticks, 0);
  assert.equal(catchUp(offline, 0, 1e10).ticks, OFFLINE_LIMIT_MS / TICK_MS);
});

test('a staffed guard reduces raid losses and storage increases capacity', () => {
  const undefended = createBunker(42);
  const defended = structuredClone(undefended);
  construct(defended, 'guard', 22, 13);
  assert.equal(assign(defended, defended.rooms.at(-1).id, 1).ok, true);
  undefended.stock.food = defended.stock.food = 100;
  // Allow the approach and attack to resolve before comparing raid losses.
  for (let i = 0; i < 40; i++) {
    step(undefended);
    step(defended);
  }
  assert.ok(defended.stock.food > undefended.stock.food);
  assert.equal(construct(defended, 'storage', 24, 13).ok, true);
  defended.stock.food = 150;
  step(defended);
  assert.ok(defended.stock.food > 100);
});

test('shortages are logged once per episode and recovery clears the crisis', () => {
  const state = createBunker(42);
  assign(state, null, 0);
  state.stock.food = 0;
  step(state);
  step(state);
  assert.equal(state.events.filter(event => event.type === 'food').length, 1);
  assert.ok(state.crises.food);
  state.stock.food = 10;
  step(state);
  assert.equal(state.crises.food, false);
});

test('crew stays on the same floor and uses the visible ladder to change floors', () => {
  const state = createBunker(42);
  const ladders = ladderEdges(state);
  assert.deepEqual(crewRoute(state, ladders, [22, 11], [26, 11]), [[23, 11], [24, 11], [25, 11], [26, 11]]);
  assert.deepEqual(crewRoute(state, ladders, [22, 11], [22, 12]), [
    [23, 11], [24, 11], [24, 12], [23, 12], [22, 12],
  ]);
});

test('a vertically excavated branch remains accessible from a visible ladder', () => {
  const state = createBunker(42);
  assert.equal(excavate(state, 19, 8).ok, true);
  assert.equal(excavate(state, 19, 7).ok, true);
  const ladders = ladderEdges(state);
  assert.deepEqual(crewRoute(state, ladders, [20, 9], [19, 7]), [[19, 9], [19, 8], [19, 7]]);
});

test('the seed field can reproduce a map and rejects out-of-range values', () => {
  assert.equal(parseMapSeed(' 00042 '), 42);
  assert.equal(parseMapSeed('0'), 0);
  assert.equal(parseMapSeed('4294967295'), 4294967295);
  assert.equal(parseMapSeed('4294967296'), null);
  assert.equal(parseMapSeed('-1'), null);
  assert.equal(parseMapSeed('1e2'), null);
  assert.deepEqual(createBunker(parseMapSeed('42')).tiles, createBunker(42).tiles);
  assert.notDeepEqual(createBunker(42).tiles, createBunker(43).tiles);
});
