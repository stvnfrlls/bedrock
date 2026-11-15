import Phaser from 'phaser';
import { WIDTH, HEIGHT, ROOMS, roomAt, placement, tileAt, roomLevel, ORES, neighbors, ladderEdges, crewRoute, entranceStairs, raidRoute, isSurfaceJob, workDestination, MOUNTAIN_MOUTH, SURFACE_ROW, RAID_APPROACH_TICKS, TICK_MS } from './simulation.js';

const TILE = 54;
const SKY = 220;
const MAP_WIDTH = WIDTH * TILE;
const MAP_HEIGHT = HEIGHT * TILE + SKY;
const FLOOR = 49;
const STAIR_LANDING_OFFSET = 19;
const STAIR_FLIGHT_STEPS = 8;
const colors = { water: 0x73d2e7, oil: 0xf4b45e, materials: 0xe6cf95, iron: 0xb8beca, copper: 0xd38f75 };
const hash = (x, y, n = 0) => {
  const value = Math.sin(x * 124.7 + y * 68.1 + n * 31.4) * 43758.5453;
  return value - Math.floor(value);
};

function block(g, color, x, y, w, h, opacity = 1) {
  g.fillStyle(color, opacity).fillRect(x, y, w, h);
}
function dot(g, color, x, y, radius, opacity = 1) {
  g.fillStyle(color, opacity).fillCircle(x, y, radius);
}
function line(g, color, x, y, endX, endY, width = 1, opacity = 1) {
  g.lineStyle(width, color, opacity).lineBetween(x, y, endX, endY);
}

function drawRock(g, x, y, tx, ty, seed) {
  const palette = ty < 4 ? [0x655344,0x5c493d,0x6a5544] :
    ty < 10 ? [0x443832,0x4b3d35,0x504137] : [0x37302c,0x3d342e,0x423630];
  block(g, palette[Math.floor(hash(tx, ty, seed % 991) * 3)], x, y, TILE, TILE);
  for (let i = 0; i < 7; i++) {
    const px = x + 3 + hash(tx, ty, i + 2) * 40;
    const py = y + 3 + hash(tx, ty, i + 11) * 45;
    block(g, i % 2 ? 0xddae8a : 0x110e0d, px, py, 2 + hash(tx,ty,i + 33) * 9, 1 + i % 3, .15);
  }
  line(g, 0x181613, x, y + TILE, x + TILE, y + TILE, 1, .34);
  line(g, 0x181613, x + TILE, y + 6, x + TILE, y + TILE, 1, .24);
}

function drawRoom(g, room) {
  const { kind, x: tx, y: ty } = room;
  const x = tx * TILE;
  const y = SKY + ty * TILE;
  const color = Phaser.Display.Color.HexStringToColor(ROOMS[kind].color).color;
  block(g, 0x141916, x + 2, y + 3, TILE * 2 - 4, 46);
  block(g, color, x + 4, y + 5, TILE * 2 - 8, 41, .13);
  block(g, color, x + 4, y + 5, TILE * 2 - 8, 2, .66);
  for (let i = 0; i < 4; i++) block(g, color, x + 12 + 23 * i, y + 9, 8, 2, .46);
  if (kind === 'farm') {
    for (let i = 0; i < 3; i++) {
      const a = x + 10 + i * 31;
      block(g, 0x52573b, a, y + 34, 24, 8);
      for (let j = 0; j < 4; j++) {
        line(g, 0x7c9e56, a+4+j*5, y+35, a+2+j*5, y+21 + j%2*4, 2);
        dot(g, color, a + 3 + j * 5, y + 25 + j % 2 * 4, 2);
      }
    }
  } else if (kind === 'water' || kind === 'oil') {
    for (let i = 0; i < 3; i++) {
      const a = x + 18 + i * 27;
      g.fillStyle(0x53615c).fillRoundedRect(a, y + 16, 15, 26, 4);
      block(g, color, a + 3, y + 25, 9, 12, .7);
      line(g, 0x9e9880, a + 7, y + 16, a + 7, y + 12, 2);
    }
    line(g, 0x7a7867, x + 16, y + 12, x + 90, y + 12, 2);
  } else if (kind === 'power') {
    g.fillStyle(0x605746).fillRoundedRect(x + 12, y + 17, 45, 25, 3);
    g.fillStyle(0x726953).fillRoundedRect(x + 65, y + 15, 30, 27, 3);
    for (let i = 0; i < 5; i++) block(g, 0x302d23, x + 16 + 7*i, y + 22, 3, 16);
    dot(g, color, x + 80, y + 27, 5);
    line(g, color, x + 54, y + 32, x + 68, y + 32, 2);
  } else if (kind === 'mine') {
    block(g, 0x655e4f, x + 10, y + 38, 87, 5);
    line(g, color, x + 15, y + 43, x + 93, y + 43, 2);
    line(g, 0x7c817d, x + 23, y + 39, x + 48, y + 19, 4);
    block(g, 0x77776d, x + 38, y + 17, 30, 13);
    block(g, 0x373b36, x + 59, y + 24, 28, 12);
    dot(g, color, x + 67, y + 27, 2.5);
    dot(g, color, x + 76, y + 26, 2);
  } else if (kind === 'lab') {
    block(g, 0x666a60, x + 14, y + 34, 79, 7);
    g.fillStyle(0x364138).fillRoundedRect(x + 19, y + 17, 25, 14, 2);
    line(g, color, x + 23, y + 25, x + 38, y + 22, 1.5);
    for (const a of [x + 56, x + 75]) {
      block(g, 0x827f8e, a + 2, y + 18, 5, 11);
      g.fillStyle(color, .72).fillCircle(a + 4, y + 30, 5);
    }
  } else if (kind === 'workshop') {
    block(g, 0x715944, x + 14, y + 34, 79, 8);
    block(g, 0xa79a83, x + 22, y + 30, 56, 5);
    line(g, color, x + 33, y + 29, x + 52, y + 18, 3);
    block(g, 0x939385, x + 45, y + 17, 17, 5);
    dot(g, 0xa79a83, x + 76, y + 26, 4);
  } else if (kind === 'home') {
    for (const a of [x + 10, x + 59]) {
      block(g, 0x7c6c67, a, y + 20, 39, 3);
      block(g, 0x7c6c67, a, y + 35, 39, 3);
      block(g, color, a + 8, y + 16, 27, 4, .65);
      block(g, color, a + 8, y + 31, 27, 4, .65);
      block(g, 0x9a8777, a, y + 18, 3, 24);
      block(g, 0x9a8777, a + 36, y + 18, 3, 24);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const a = x + 11 + i * 22;
      block(g, kind === 'guard' ? 0x694e42 : 0x726b54, a, y + 22 + i % 2 * 7, 17, 20 - i % 2 * 7);
      line(g, color, a+3, y+35, a+13, y+35, 2, .75);
    }
  }
  if (roomLevel(room) === 2) {
    block(g, 0x26251d, x + 80, y + 6, 20, 11);
    for (const offset of [85, 92]) block(g, 0xe4c184, x + offset, y + 8, 3, 7);
  }
}

function drawMountain(g, state) {
  const mouth = MOUNTAIN_MOUTH * TILE;
  const inside = (entranceStairs(state)[1].x + .82) * TILE;
  g.fillStyle(0x514639).fillPoints([
    { x: mouth, y: SKY }, { x: mouth + TILE, y: SKY - 58 },
    { x: 19 * TILE, y: 77 }, { x: 24 * TILE, y: 19 },
    { x: 28 * TILE, y: 49 }, { x: 32 * TILE, y: 40 },
    { x: 39 * TILE, y: 121 }, { x: 46 * TILE, y: SKY },
  ], true);
  g.fillStyle(0x6a5c4b).fillPoints([
    { x: mouth, y: SKY }, { x: 19 * TILE, y: 77 }, { x: 24 * TILE, y: 19 },
    { x: 22 * TILE, y: 91 }, { x: 29 * TILE, y: 105 },
    { x: 21 * TILE, y: 129 }, { x: 18 * TILE, y: SKY },
  ], true);
  const lip = mouth + TILE * .45;
  block(g, 0x232922, lip, SKY - TILE + 8, inside - lip, TILE - 5);
  block(g, 0x433d32, lip, SKY - 6, inside - lip, 6);
  line(g, 0xa79d7d, lip, SKY - TILE + 8, lip, SKY - 5, 4);
  line(g, 0x82765d, lip, SKY - TILE + 8, lip + 22, SKY - TILE + 8, 3);
}

function stairLandingX(column, row) {
  return (column + .5) * TILE + (row % 2 === 0 ? -STAIR_LANDING_OFFSET : STAIR_LANDING_OFFSET);
}

function tilePosition(stairs, [column, row]) {
  const landing = stairs.some(stair => stair.x === column && row >= SURFACE_ROW && row <= stair.bottom);
  return [landing ? stairLandingX(column, row) : (column + .5) * TILE, SKY + row * TILE + FLOOR];
}

function drawStairwell(g, { x: column, bottom }) {
  const left = column * TILE;
  const bottomY = SKY + bottom * TILE + FLOOR;
  const shaftHeight = bottomY - SKY;
  block(g, 0x292f29, left + 2, SKY, TILE - 4, shaftHeight);
  block(g, 0x353c32, left + 6, SKY, TILE - 12, shaftHeight);
  block(g, 0x665e4c, left + 2, SKY, 3, shaftHeight);
  block(g, 0x665e4c, left + TILE - 5, SKY, 3, shaftHeight);

  const railHeight = 14;
  for (let row = SURFACE_ROW; row <= bottom; row++) {
    const x = stairLandingX(column, row);
    const y = SKY + row * TILE + FLOOR;
    if (row < bottom) {
      const nextX = stairLandingX(column, row + 1);
      const run = (nextX - x) / STAIR_FLIGHT_STEPS;
      const rise = TILE / STAIR_FLIGHT_STEPS;
      line(g, 0x716755, x, y + 5, nextX, y + TILE + 5, 5);

      for (let step = 0; step < STAIR_FLIGHT_STEPS; step++) {
        const treadX = x + step * run;
        const treadY = y + step * rise;
        line(g, 0xd3bb8b, treadX, treadY, treadX + run, treadY, 2);
        line(g, 0x928269, treadX + run, treadY, treadX + run, treadY + rise, 2);
      }

      for (const fraction of [0, .5, 1]) {
        const postX = x + (nextX - x) * fraction;
        const postY = y + TILE * fraction;
        line(g, 0x92967e, postX, postY - railHeight, postX, postY, 2);
      }
      line(g, 0xaead8b, x, y - railHeight, nextX, y + TILE - railHeight, 3);
    }

    block(g, 0x6e654f, x - 7, y, 14, 5);
    block(g, 0xd3bb8b, x - 7, y, 14, 2);
  }
}

function drawHabitat(g, room, spots, tick, time) {
  const isGrove = room.kind === 'grove';
  const outdoors = isSurfaceJob(room);
  const x = room.x * TILE;
  const y = SKY + room.y * TILE;
  if (outdoors) {
    block(g, 0x66754a, x + 2, SKY - 6, TILE * 2 - 4, 5);
  } else {
    block(g, 0x373226, x + 2, y + 4, TILE * 2 - 4, FLOOR - 4);
    block(g, 0x584d37, x + 2, y + FLOOR - 6, TILE * 2 - 4, 6);
  }
  for (const [slot, readyAt] of spots.entries()) {
    const center = x + (slot + .5) * TILE;
    if (!outdoors) g.fillStyle(0xe8c880, .13).fillEllipse(center, y + 23, 47, 44);
    const ready = tick >= readyAt;
    const base = outdoors ? SKY - 6 : y + FLOOR - 4;
    if (isGrove) {
      const trunk = center + 10;
      block(g, 0x71583d, trunk - 2, base - (ready ? 25 : 5), 4, ready ? 25 : 5);
      if (ready) {
        g.fillStyle(0x53784a).fillEllipse(trunk, base - 26, 23, 17);
        g.fillStyle(0x7fa262).fillEllipse(trunk + 3, base - 31, 14, 12);
      } else {
        block(g, 0xd1ac72, trunk - 3, base - 6, 6, 2);
      }
    } else if (ready) {
      const animal = center + 12 + Math.sin(time / 600 + slot) * 7;
      g.fillStyle(0xa68d70).fillEllipse(animal, base - 5, 16, 9);
      dot(g, 0xbda386, animal + 6, base - 9, 3.6);
      line(g, 0xbda386, animal + 5, base - 10, animal + 2, base - 17, 2);
      line(g, 0xa68d70, animal + 8, base - 10, animal + 8, base - 15, 2);
      dot(g, 0x27231d, animal + 8, base - 10, 1);
    }
  }
}

function drawGate(g, state) {
  const { gate, raid } = state;
  const x = (gate.x + .5) * TILE;
  const y = SKY + gate.y * TILE;
  const damaged = gate.integrity < 40;
  block(g, 0x171e1b, x - 15, y + 2, 30, FLOOR - 2);
  for (const edge of [-14, 10]) block(g, 0x8e998e, x + edge, y + 3, 4, FLOOR - 3);
  if (gate.integrity) {
    const closed = raid && raid.phase !== 'approach';
    const bottom = closed ? FLOOR : 21;
    block(g, 0x65756d, x - 9, y + 8, 18, bottom - 8);
    for (let row = 14; row < bottom; row += 8) block(g, 0x354940, x - 9, y + row, 18, 2);
    dot(g, raid ? 0xf08262 : 0xc3bc79, x + 11, y + 31, 2.5);
  } else {
    line(g, 0x65756d, x - 9, y + 24, x - 4, y + FLOOR, 5);
    line(g, 0x65756d, x + 8, y + 12, x + 5, y + 30, 5);
  }
  block(g, 0x232a24, x - 15, y + 3, 30, 4);
  block(g, damaged ? 0xe58065 : 0xb5c87e, x - 14, y + 4, 28 * gate.integrity / 100, 2);
}

function drawFigure(g, x, y, color, trim, swing) {
  g.fillStyle(0x11130f, .45).fillEllipse(x, y, 15, 4);
  dot(g, color, x, y - 18, 4.2);
  block(g, color, x - 4, y - 14, 8, 8);
  line(g, color, x - 2, y - 8, x - 3 + swing, y - 1, 3);
  line(g, color, x + 2, y - 8, x + 3 - swing, y - 1, 3);
  line(g, trim, x - 4, y - 20, x + 4, y - 20, 2);
}

export function mountMap(parent, bridge) {
  class BunkerScene extends Phaser.Scene {
    create() {
      this.terrain = this.make.graphics({ x: 0, y: 0 }, false);
      this.landscape = this.add.image(0, 0).setOrigin(0).setVisible(false);
      this.features = this.add.graphics();
      this.people = this.add.graphics();
      this.overlay = this.add.graphics();
      this.walkers = new Map();
      this.camera = this.cameras.main;
      this.mapHeight = MAP_HEIGHT;
      this.camera.setBounds(0, 0, MAP_WIDTH, this.mapHeight);
      this.overview();
      bridge.camera = command => {
        if (command === 'center') this.center();
        if (command === 'surface') this.surface();
        if (command === 'gate' || command === 'cavern') this.focusSite(command);
        if (command === 'in') this.zoom(.12);
        if (command === 'out') this.zoom(-.12);
      };
      this.scale.on(Phaser.Scale.Events.RESIZE, () => {
        if (this.view === 'overview') this.overview();
        else if (this.view === 'surface') this.surface();
        else this.setZoom(this.camera.zoom);
      });
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,LEFT,DOWN,RIGHT');
      this.input.keyboard.disableGlobalCapture();
      this.input.mouse.disableContextMenu();
      this.input.on('pointerdown', pointer => {
        this.drag = { x: pointer.x, y: pointer.y, moved: false, pan: pointer.button !== 0 || bridge.tool === 'pan' };
      });
      this.input.on('pointermove', pointer => {
        if (!this.drag || !pointer.isDown) return;
        const dx = pointer.x - this.drag.x;
        const dy = pointer.y - this.drag.y;
        if (Math.hypot(dx, dy) > 6 || this.drag.moved) {
          this.view = null;
          this.camera.scrollX -= dx / this.camera.zoom;
          this.camera.scrollY -= dy / this.camera.zoom;
          this.drag = { ...this.drag, x: pointer.x, y: pointer.y, moved: true };
        }
      });
      this.input.on('pointerup', pointer => {
        if (this.drag && !this.drag.moved && !this.drag.pan) bridge.action(...this.point(pointer));
        this.drag = null;
      });
      this.input.on('pointerupoutside', () => { this.drag = null; });
      this.input.on('wheel', (_pointer, _objects, _dx, dy) => this.zoom(dy > 0 ? -.09 : .09));
    }

    overview() {
      this.view = 'overview';
      const zoom = this.setZoom(Math.min(.92, this.scale.width / (14 * TILE), this.scale.height / (SKY + 13 * TILE)));
      this.camera.centerOn(24.5 * TILE, this.scale.height / (2 * zoom));
    }

    surface() {
      this.view = 'surface';
      const zoom = this.setZoom(Math.min(.92, this.scale.width / (16 * TILE)));
      this.camera.centerOn(11 * TILE, this.scale.height / (2 * zoom));
    }

    center() {
      this.view = null;
      this.setZoom(Phaser.Math.Clamp(this.scale.width / (14 * TILE), .42, .92));
      this.camera.centerOn(24.5 * TILE, SKY + 11.6 * TILE);
    }

    focusSite(site) {
      const state = bridge.state;
      if (!state) return;
      const target = site === 'gate' ? state.gate : state.rooms.find(room => room.kind === 'caveScavenging');
      const offset = site === 'gate' ? -.5 : .5;
      this.view = null;
      this.setZoom(Math.min(.92, this.scale.width / (13 * TILE)));
      this.camera.centerOn((target.x + offset) * TILE, SKY + (target.y + .5) * TILE);
    }

    setZoom(zoom) {
      const minimum = Math.max(this.scale.width / MAP_WIDTH, this.scale.height / this.mapHeight);
      const boundedZoom = Math.max(minimum, Math.min(zoom, 1.55));
      this.camera.setZoom(boundedZoom);
      return boundedZoom;
    }

    zoom(amount) {
      this.view = null;
      this.setZoom(this.camera.zoom + amount);
    }

    point(pointer) {
      const world = this.camera.getWorldPoint(pointer.x, pointer.y);
      return [Math.floor(world.x / TILE), Math.floor((world.y - SKY) / TILE)];
    }

    drawTerrain(state) {
      const g = this.terrain.clear();
      block(g, 0x777964, 0, 0, MAP_WIDTH, SKY);
      dot(g, 0xe6c787, 8 * TILE, 54, 19, .78);
      for (let x = 0; x < WIDTH; x++) {
        const peak = SKY - 46 + 21 * hash(x, 1) + 10 * Math.sin(x / 2);
        g.fillStyle(0x565c49).fillTriangle(x*TILE - 45, SKY, x*TILE + 54, SKY, x*TILE + 6, peak);
      }
      block(g, 0xa78b5f, 0, SKY-3, WIDTH*TILE, 3);
      if (state.entrance.kind === 'mountain') {
        drawMountain(g, state);
      } else {
        const x = entranceStairs(state)[0].x * TILE;
        block(g, 0x323a30, x + 8, SKY - 19, TILE - 16, 17);
        block(g, 0x8d8167, x + 6, SKY - 19, TILE - 12, 3);
      }
      for (let ty = 0; ty < state.tiles.length / WIDTH; ty++) {
        for (let tx = 0; tx < WIDTH; tx++) {
          const x = tx * TILE;
          const y = SKY + ty * TILE;
          const tile = tileAt(state, tx, ty);
          if (!tile.open) {
            drawRock(g,x,y,tx,ty,state.seed);
            if (neighbors(tx, ty).some(([nx, ny]) => tileAt(state, nx, ny)?.open)) {
              const hint = colors[tile.deposit] ?? 0xa18d73;
              for (let i = 0; i < 3; i++) dot(g, hint, x + 20 + i*6, y + 27 + i%2*4, 1.5, .52);
            }
            continue;
          }
          block(g, (tx + ty) % 2 ? 0x353930 : 0x3c3d32, x, y, TILE, TILE);
          for (let i = 1; i < 4; i++) line(g, 0x777664, x + 2, y + i * 12, x + TILE - 2, y + i * 12, 1, .14);
          block(g, 0x50493b, x, y + FLOOR, TILE, 5);
          block(g, 0x878065, x, y + FLOOR, TILE, 1);
          if (!tileAt(state, tx, ty - 1)?.open) {
            block(g, 0x282720, x, y, TILE, 4);
            block(g, 0x8b8062, x, y + 4, TILE, 1);
          }
          if (!tileAt(state, tx - 1, ty)?.open) block(g, 0x78725e, x, y, 4, FLOOR);
          if (!tileAt(state, tx + 1, ty)?.open) block(g, 0x78725e, x + TILE - 4, y, 4, FLOOR);
          if (tile.deposit === 'water' || tile.deposit === 'oil' || Object.hasOwn(ORES, tile.deposit)) {
            g.fillStyle(colors[tile.deposit], .69).fillEllipse(x+27, y+40, 27, 6);
            dot(g, colors[tile.deposit], x + 24, y + 33, 2);
          }
          if ((tx + ty) % 4 === 0) {
            g.fillStyle(0xe3bd77, .07).fillEllipse(x+27, y+17, 49, 24);
            block(g, 0xd3ac6e, x+20, y+8, 14, 2, .62);
          }
        }
      }
      for (const room of state.rooms) {
        if (!ROOMS[room.kind].fixed) drawRoom(g, room);
      }
      this.ladders = ladderEdges(state);
      for (const edge of this.ladders) {
        const row = Math.floor(edge / WIDTH);
        const column = edge - row * WIDTH;
        const x = column * TILE;
        const top = SKY + row * TILE;
        if (this.stairs.some(stair => column === stair.x && row < stair.bottom)) continue;
        const y = top + FLOOR - 10;
        const height = TILE + 10;
        for (const rail of [18, 35]) block(g, 0xa49a78, x + rail, y, 2, height);
        for (let rung = 4; rung < height; rung += 9) block(g, 0xa49a78, x + 20, y + rung, 15, 2);
      }
      for (const stair of this.stairs) drawStairwell(g, stair);
      if (this.textures.exists("bunker-terrain")) this.textures.remove("bunker-terrain");
      g.generateTexture("bunker-terrain", MAP_WIDTH, this.mapHeight);
      this.landscape.setTexture("bunker-terrain").setVisible(true);
      this.revision = bridge.revision;
    }

    drawSites(state, time, delta) {
      const g = this.features.clear();
      drawGate(g, state);
      const motion = bridge.speed ? time : 0;
      for (const room of state.rooms) {
        const spots = state.harvests[room.kind];
        if (spots) drawHabitat(g, room, spots, state.tick, motion);
      }
      const { raid, gate } = state;
      if (!raid) return;
      if (this.raidPhase !== raid.phase || this.raidPhaseTick !== raid.phaseTick) {
        this.raidPhase = raid.phase;
        this.raidPhaseTick = raid.phaseTick;
        this.raidAge = 0;
      }
      this.raidAge = Math.max(state.tick - raid.phaseTick, this.raidAge + delta * bridge.speed / TICK_MS);
      const x = (gate.x + .5) * TILE;
      const y = SKY + gate.y * TILE + FLOOR;
      const march = Math.min(1, this.raidAge / RAID_APPROACH_TICKS);
      const swing = Math.sin(motion / 80) * 3;
      for (let index = 0; index < raid.remaining; index++) {
        let raiderX = x - 19 - index * 12;
        let raiderY = y;
        if (raid.phase === 'approach') {
          const position = march * (this.raidPath.length - 1 - index * .22);
          const current = Math.floor(position);
          const [startX, startY] = this.raidPath[current];
          const [endX, endY] = this.raidPath[current + 1] ?? this.raidPath[current];
          const progress = position - current;
          raiderX = startX + (endX - startX) * progress + index * 7 * (1 - march);
          raiderY = startY + (endY - startY) * progress;
        }
        if (raid.phase === 'attack') raiderX += swing;
        if (raid.phase === 'breach') raiderX += Math.min(1, this.raidAge) * (TILE * 2 + index * 5);
        drawFigure(g, raiderX, raiderY, 0x301b1c, 0xec8469, swing);
        line(g, 0xb39a83, raiderX + 3, raiderY - 10, raiderX + 12, raiderY - 13 + swing, 2);
      }
      if (raid.phase === 'attack' && swing > 0) {
        line(g, 0xefb96b, x - 15, y - 12, x - 7, y - 18, 2);
        dot(g, 0xefb96b, x - 12, y - 23, 2);
      }
    }

    drawResidents(state, time, delta) {
      const g = this.people.clear();
      let defenders = 0;
      for (const person of state.residents) {
        const room = state.rooms.find(item => item.id === person.room);
        const slot = state.residents.filter(item => item.room === person.room && item.id < person.id).length;
        const defending = state.raid && (room?.kind === 'gate' || room?.kind === 'guard');
        const retreating = state.raid && isSurfaceJob(room);
        const goal = defending ? [state.gate.x + 1 + (defenders++ % 2), state.gate.y] :
          room ? workDestination(state, room, slot) : [21 + (person.id + Math.floor(state.tick / 2)) % 7, 12 + person.id % 2];
        let actor = this.walkers.get(person.id);
        if (!actor) {
          const [x, y] = tilePosition(this.stairs, goal);
          actor = { x, y, tile: goal, path: [] };
          this.walkers.set(person.id, actor);
        }
        const target = goal.join(',');
        // Finish the current step before rerouting from a landing or tile center.
        if (!actor.next && (actor.target !== target || actor.revision !== bridge.revision)) {
          actor.target = target;
          actor.revision = bridge.revision;
          actor.path = crewRoute(state, this.ladders, actor.tile, goal);
        }
        const next = actor.next ?? actor.path[0];
        if (next && bridge.speed > 0) {
          if (!actor.next) {
            actor.next = next;
            actor.progress = 0;
          }
          const [startX, startY] = tilePosition(this.stairs, actor.tile);
          const [endX, endY] = tilePosition(this.stairs, next);
          const pace = retreating ? .30 * bridge.speed : .068 * Math.sqrt(bridge.speed);
          // Stair landings shift sideways, so keep travel timing tied to one grid step.
          const progress = Math.min(1, actor.progress + Math.min(delta, 40) * pace / TILE);
          actor.progress = progress;
          actor.x = startX + (endX - startX) * progress;
          actor.y = startY + (endY - startY) * progress;
          if (progress === 1) {
            actor.tile = actor.path.shift();
            actor.next = null;
          }
        }
        const { x, y } = actor;
        const swing = next && bridge.speed ? Math.sin(time / 72 + person.id) * 3 : 0;
        drawFigure(g, x, y, 0x111713, defending ? 0x9bd2d8 : room ? 0xe4cd8f : 0xa9a992, swing);
        if (next || !bridge.speed || retreating) continue;
        const taskMotion = Math.sin(time / 130 + person.id);
        if (room?.kind === 'grove' && state.harvests.grove[slot] <= state.tick) {
          line(g, 0xac8a60, x + 2, y - 9, x + 10, y - 13 + taskMotion * 5, 2);
          block(g, 0xd8d4bd, x + 9, y - 14 + taskMotion * 5, 4, 3);
        }
        if ((room?.kind === 'scavenging' || room?.kind === 'caveScavenging') && state.harvests[room.kind][slot] <= state.tick) {
          line(g, 0x9f825d, x + 1, y - 8, x + 8 + taskMotion * 3, y - 5, 2);
          block(g, 0x846447, x + 6 + taskMotion * 3, y - 5, 6, 4);
        }
        if (defending && state.raid.phase === 'attack') {
          const reach = person.weapon === 'rifle' ? 17 : person.weapon === 'pistol' ? 11 : 7;
          line(g, 0xa9c6c7, x - 2, y - 11, x - reach, y - 11, 2);
          if (person.weapon && taskMotion > .75) dot(g, 0xf8d68c, x - reach - 2, y - 11, 2);
        }
      }
    }

    update(time, delta) {
      const state = bridge.state;
      if (!state) return;
      if (this.campaign !== state) {
        this.campaign = state;
        this.walkers.clear();
        this.raidPhase = null;
        this.stairs = entranceStairs(state);
        this.raidPath = raidRoute(state).map(tile => tilePosition(this.stairs, tile));
        this.raidPath.push([(state.gate.x + .5) * TILE - 19, SKY + state.gate.y * TILE + FLOOR]);
        this.mapHeight = SKY + (state.tiles.length / WIDTH) * TILE;
        this.camera.setBounds(0, 0, MAP_WIDTH, this.mapHeight);
        this.overview();
      }
      if (this.revision !== bridge.revision) this.drawTerrain(state);
      this.drawSites(state, time, delta);
      this.drawResidents(state, time, delta);
      const { W,A,S,D,UP,LEFT,DOWN,RIGHT } = this.keys;
      const active = document.activeElement?.matches('input,select,button,textarea');
      const move = Math.min(delta, 40) * .44 / this.camera.zoom;
      if (!active) {
        const dx = Number(D.isDown || RIGHT.isDown) - Number(A.isDown || LEFT.isDown);
        const dy = Number(S.isDown || DOWN.isDown) - Number(W.isDown || UP.isDown);
        if (dx || dy) {
          this.view = null;
          this.camera.scrollX += dx * move;
          this.camera.scrollY += dy * move;
        }
      }
      const g = this.overlay.clear();
      const building = ROOMS[bridge.tool];
      const selected = bridge.selected && state.rooms.find(room => room.id === bridge.selected);
      if (selected) {
        const start = selected.x - Number(selected.kind === 'gate');
        const width = selected.x + 2 - start;
        g.lineStyle(2, 0xddc88e, .85).strokeRect(start*TILE+1, SKY+selected.y*TILE+1, TILE*width-2,TILE-2);
      }
      if (!bridge.hover || this.drag?.moved || bridge.tool === 'pan') return;
      const [x,y] = this.point(this.input.activePointer);
      if (!tileAt(state,x,y)) return;
      const room = roomAt(state,x,y);
      const accent = building && placement(state,bridge.tool,x,y) ? 0xe18a76 : 0xedd39a;
      const start = room && !building ? room.x - Number(room.kind === 'gate') : x;
      const width = building ? TILE * 2 : room ? TILE * (room.x + 2 - start) : TILE;
      const px = start * TILE;
      block(g, accent, px, SKY+y*TILE, width, TILE, .14);
      g.lineStyle(1.5, accent, .85).strokeRect(px+1, SKY+y*TILE+1, width-2,TILE-2);
    }
  }

  return new Phaser.Game({
    type: Phaser.CANVAS, parent, backgroundColor: '#29251f',
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    render: { antialias: false }, scene: BunkerScene,
    input: { touch: { capture: true } },
  });
}




