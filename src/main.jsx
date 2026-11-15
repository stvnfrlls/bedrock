import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { assign, beds, capacity, catchUp, construct, createBunker, excavate, GOODS, parseMapSeed, randomMapSeed, ROOMS, roomAt, step, tileAt, TICK_MS, upgradeCampaign, workers, repairGate, GATE_REPAIR_COST, GATE_REPAIR_POINTS, ORES, RESEARCH, WEAPONS, UPGRADE_COST, UPGRADE_BENEFITS, roomLevel, oreTiles, researchProblem, craftingProblem, upgradeProblem, startResearch, startCrafting, improveRoom, equipWeapon } from './simulation.js';
import { loadCampaign, saveCampaign } from './save.js';
import { version } from '../package.json';
import './style.css';

const resources = {
  iron: ['◆', ORES.iron, '#b8beca'], copper: ['◆', ORES.copper, '#d38f75'],
  food: ['✿', 'Food', '#acc879'], water: ['◈', 'Water', '#79c6dd'],
  oil: ['●', 'Oil', '#daa86b'], energy: ['ϟ', 'Power', '#e0c675'],
  materials: ['▦', 'Materials', '#c4b79b'],
};
const format = number => Number(number.toFixed(1)).toLocaleString('en-US');
const day = tick => String(1 + Math.floor(tick / 12)).padStart(2, '0');
const clock = tick => String((tick % 12) * 2).padStart(2, '0') + ':00';
const tools = { dig: ['⌞', 'Excavate'], inspect: ['◎', 'Inspect'], pan: ['✥', 'Pan'] };

function ResourceBar({ state }) {
  return <div className="resources">{GOODS.map(key => {
    const [icon, label, color] = resources[key];
    const max = capacity(state);
    const short = state.crises[key];
    return <div className={'resource' + (short ? ' shortage' : '')} key={key} style={{ '--tone': color }}>
      <span className="resource-icon" aria-hidden="true">{icon}</span>
      <div className="resource-info"><div className="resource-label">{label}{short && ' · LOW'}</div>
        <div className="resource-amount">{format(state.stock[key])} <small>/ {max}</small></div>
        <div className="meter"><i style={{ width: state.stock[key] / max * 100 + '%' }} /></div>
      </div>
    </div>;
  })}</div>;
}

function OfflineReport({ report }) {
  const dialog = useRef(null);
  useEffect(() => {
    if (report) dialog.current.showModal();
  }, [report]);
  if (!report) return null;
  return <dialog ref={dialog} aria-labelledby="report-title">
    <form method="dialog">
      <p className="micro">Campaign resumed</p><h2 id="report-title">While you were away</h2>
      <p>Simulated {format(report.ticks * TICK_MS / 60_000)} minutes at normal speed.{report.capped && ' Catch-up reached the 15-minute limit.'}</p>
      <dl className="report">{GOODS.map(key => <div key={key}><dt>{resources[key][1]}</dt><dd>{report.change[key] > .05 && '+'}{format(report.change[key])}</dd></div>)}</dl>
      {report.events.length > 0 && <ul className="report-events">{report.events.map(event => <li key={event.id}>{event.text}</li>)}</ul>}
      <button className="primary" autoFocus>Return to station</button>
    </form>
  </dialog>;
}

function CampaignControls({ state, onStart }) {
  const dialog = useRef(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  function open() {
    setInput('');
    setError('');
    dialog.current.showModal();
  }

  function start(event) {
    event.preventDefault();
    const seed = input.trim() ? parseMapSeed(input) : randomMapSeed();
    if (seed === null) {
      setError('Enter a whole number from 0 to 4294967295.');
      return;
    }
    onStart(seed);
    dialog.current.close();
  }

  return <div className="campaign-controls">
    <button className="secondary" disabled={!state} onClick={open}>New game</button>
    {state && <span className="map-seed">Seed <code>{state.seed}</code></span>}
    <dialog ref={dialog} aria-labelledby="new-game-title" aria-describedby="new-game-warning">
      <form onSubmit={start}>
        <h2 id="new-game-title">Start a new game</h2>
        <p id="new-game-warning">Starting a new game replaces this browser's current campaign save.</p>
        <label className="seed-label" htmlFor="new-game-seed">Map seed</label>
        <div className="seed-controls">
          <input id="new-game-seed" type="text" inputMode="numeric" autoComplete="off" value={input}
            placeholder="Random if blank" aria-invalid={Boolean(error)}
            aria-describedby={error ? 'seed-error' : undefined}
            onChange={event => { setInput(event.target.value); setError(''); }} />
          <button type="button" className="secondary" onClick={() => { setInput(String(randomMapSeed())); setError(''); }}>Randomize</button>
        </div>
        {error && <p id="seed-error" role="alert">{error}</p>}
        <div className="dialog-actions">
          <button type="button" className="secondary" autoFocus onClick={() => dialog.current.close()}>Cancel</button>
          <button className="primary" type="submit">Start new game</button>
        </div>
      </form>
    </dialog>
  </div>;
}

const raidStatus = {
  approach: 'Raiders approaching through the tunnel. Surface crew are returning.',
  attack: 'Raiders attacking the gate',
  breach: 'Raiders inside the gate',
};

function GateStatus({ state, onRepair }) {
  const integrity = state.gate.integrity;
  const status = raidStatus[state.raid?.phase] ?? (integrity === 0 ? 'Gate breached' : '');
  return <section className="gate-status" aria-label="Bunker gate">
    <div><strong>Bunker gate</strong><span>{integrity}% integrity</span></div>
    {status && <p role="status">{status}</p>}
    {integrity < 100 && <button type="button" className="secondary" onClick={onRepair}
      disabled={Boolean(state.raid) || state.stock.materials < GATE_REPAIR_COST}
      title={`Restores up to ${GATE_REPAIR_POINTS} integrity`}>
      Repair · {GATE_REPAIR_COST} materials
    </button>}
  </section>;
}

function formatCost(cost) {
  return Object.entries(cost).map(([resource, amount]) => amount + ' ' + resources[resource][1].toLowerCase()).join(' · ');
}

function WorkOrder({ order, spec }) {
  const progress = Math.min(100, Math.floor(100 * (1 - order.remaining / spec.work)));
  return <div className="tech-progress">
    <progress value={progress} max="100" aria-label={spec.name + ' progress'} />
    <span>{progress}%</span>
  </div>;
}

function ResearchPanel({ state, onResearch, onCraft }) {
  const active = state.research.active;
  return <div className="research-panel">
    <section aria-label="Research projects">
      <p className="micro section-label">Research projects</p>
      {Object.entries(RESEARCH).map(([id, spec]) => {
        const complete = state.research.completed.includes(id);
        const running = active?.id === id;
        const problem = researchProblem(state, id);
        return <div className="tech-item" key={id}>
          <strong>{spec.name}</strong>
          <small>{spec.description}</small>
          {complete ? <span className="tech-complete">Complete</span> : running ? <WorkOrder order={active} spec={spec} /> : <>
            <small>{formatCost(spec.cost)}</small>
            <div className="tech-action"><button className="secondary" disabled={Boolean(problem)} onClick={() => onResearch(id)}
              aria-label={'Research ' + spec.name}>Research</button>{problem && <small>{problem}</small>}</div>
          </>}
        </div>;
      })}
    </section>
    <section aria-label="Weapon fabrication">
      <p className="micro section-label">Weapon fabrication</p>
      {Object.entries(WEAPONS).map(([id, spec]) => {
        const running = state.crafting?.id === id;
        const problem = craftingProblem(state, id);
        return <div className="tech-item" key={id}>
          <div className="tech-heading"><strong>{spec.name}</strong><small>{state.weapons[id]} available</small></div>
          <small>+{spec.defense} defense when assigned to defend</small>
          {running ? <WorkOrder order={state.crafting} spec={spec} /> : <>
            <small>{formatCost(spec.cost)}</small>
            <div className="tech-action"><button className="secondary" disabled={Boolean(problem)} onClick={() => onCraft(id)}
              aria-label={'Craft ' + spec.name}>Craft</button>{problem && <small>{problem}</small>}</div>
          </>}
        </div>;
      })}
    </section>
  </div>;
}

function RoomDetails({ state, room, onUpgrade }) {
  const spec = ROOMS[room.kind];
  const level = roomLevel(room);
  const benefit = UPGRADE_BENEFITS[room.kind];
  const problem = upgradeProblem(state, room);
  return <div className="room-details">
    <div className="selected-room"><strong>{spec.name}{benefit && ' · Lv. ' + level}</strong>
      <span>{spec.jobs ? workers(state, room.id).length + ' / ' + spec.jobs + ' staffed' : 'No staffing required'}</span></div>
    {room.kind === 'mine' && <small>{oreTiles(state, room).map(tile =>
      ORES[tile.deposit] + ' · ' + format(tile.remaining) + ' left').join(' / ')}</small>}
    {benefit && level === 1 && <>
      <small>Level 2 · {benefit}</small>
      <small>{formatCost(UPGRADE_COST)}</small>
      <div className="tech-action"><button type="button" className="secondary" onClick={onUpgrade} disabled={Boolean(problem)}>Upgrade to level 2</button>
        {problem && <small>{problem}</small>}</div>
    </>}
    {benefit && level === 2 && <small>{benefit} at level 2</small>}
  </div>;
}

function App() {
  const bridge = useRef({ state: null, revision: 0, tool: 'dig', hover: false, speed: 0, selected: null });
  const mapRef = useRef(null);
  const saveRef = useRef(() => {});
  const startCampaignRef = useRef(() => {});
  const [state, setState] = useState(null);
  const [saveStatus, setSaveStatus] = useState('Opening local save…');
  const [notice, setNotice] = useState('');
  const [mapError, setMapError] = useState('');
  const [report, setReport] = useState(null);
  const [tool, setTool] = useState('dig');
  const [speed, setSpeed] = useState(0);
  const [selected, setSelected] = useState(null);
  const [tab, setTab] = useState('Build');
  const [blocked, setBlocked] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  function refresh() {
    const current = bridge.current.state;
    setState({ ...current, stock: { ...current.stock }, crises: { ...current.crises } });
  }

  useEffect(() => {
    let active = true;
    let writable = true;
    let hiddenAt = null;
    let previous = performance.now();
    let accumulated = 0;
    let lastSaved = 0;
    let release = () => {};
    let saveSequence = 0;

    const persist = (savedAt = Date.now()) => {
      if (!active || !writable || !bridge.current.state) return;
      const sequence = ++saveSequence;
      lastSaved = savedAt;
      saveCampaign(bridge.current.state, savedAt).then(
        () => { if (active && sequence === saveSequence) setSaveStatus('Saved on this browser'); },
        () => { if (active && sequence === saveSequence) setSaveStatus('Save failed · retrying'); },
      );
    };

    async function start() {
      let saved;
      try {
        saved = await loadCampaign();
      } catch {
        writable = false;
        if (active) setSaveStatus('Local save unavailable · temporary session');
      }
      if (!active) return;
      const now = Date.now();
      const current = saved ? upgradeCampaign(saved.state) : createBunker();
      if (saved) {
        const summary = catchUp(current, saved.savedAt, now);
        if (summary.ticks) setReport(summary);
      }
      bridge.current.state = current;
      if (document.hidden) hiddenAt = now;
      saveRef.current = () => persist(hiddenAt ?? Date.now());
      refresh();
      persist(now);
    }

    startCampaignRef.current = seed => {
      if (!active || !bridge.current.state) return;
      const now = Date.now();
      const map = bridge.current;
      map.state = createBunker(seed);
      map.revision++;
      map.tool = 'dig';
      map.speed = 0;
      map.selected = null;
      accumulated = 0;
      previous = performance.now();
      hiddenAt = document.hidden ? now : null;
      setSpeed(0);
      setSelected(null);
      setTab('Build');
      setTool('dig');
      setReport(null);
      setNotice('');
      if (writable) setSaveStatus('Saving new campaign');
      refresh();
      persist(now);
    };

    if (navigator.locks) {
      navigator.locks.request('bedrock-station-campaign', { ifAvailable: true }, async lock => {
        if (!active) return;
        if (!lock) {
          setBlocked(true);
          setSaveStatus('Campaign open in another tab');
          return;
        }
        const lifetime = new Promise(resolve => { release = resolve; });
        await start();
        await lifetime;
      }).catch(() => {
        if (active) {
          setBlocked(true);
          setSaveStatus('Could not open campaign');
        }
      });
    } else {
      void start();
    }

    const timer = window.setInterval(() => {
      const now = performance.now();
      const delta = Math.min(now - previous, 1500);
      previous = now;
      if (document.hidden || !bridge.current.state) return;
      accumulated += delta * bridge.current.speed;
      let changed = false;
      while (accumulated >= TICK_MS) {
        step(bridge.current.state);
        accumulated -= TICK_MS;
        changed = true;
      }
      if (changed) refresh();
      if (Date.now() - lastSaved >= 5_000) persist();
    }, 200);

    function suspend() {
      if (!bridge.current.state || hiddenAt !== null) return;
      hiddenAt = Date.now();
      accumulated = 0;
      persist(hiddenAt);
    }

    function resume() {
      if (!bridge.current.state || hiddenAt === null) return;
      const now = Date.now();
      const summary = catchUp(bridge.current.state, hiddenAt, now);
      hiddenAt = null;
      previous = performance.now();
      if (summary.ticks) {
        bridge.current.speed = 0;
        setSpeed(0);
        setReport(summary);
        refresh();
      }
      persist(now);
    }

    function visibility() {
      if (document.hidden) suspend();
      else resume();
    }
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', suspend);
    window.addEventListener('pageshow', resume);
    return () => {
      active = false;
      release();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', suspend);
      window.removeEventListener('pageshow', resume);
    };
  }, []);

  useEffect(() => {
    let active = true;
    let game;
    import('./scene.js').then(({ mountMap }) => {
      if (active) {
        game = mountMap(mapRef.current, bridge.current);
        setMapReady(true);
      }
    }).catch(() => { if (active) setMapError('Map could not start. Reload to try again.'); });
    return () => { active = false; game?.destroy(true); };
  }, []);

  function selectTool(next) {
    bridge.current.tool = next;
    setTool(next);
    setNotice('');
  }

  function chooseRoom(id) {
    bridge.current.selected = id;
    setSelected(id);
    setTab('Crew');
  }

  function showAction(result, mapChanged = false) {
    setNotice(result.message);
    if (!result.ok) return;
    if (mapChanged) bridge.current.revision++;
    refresh();
    saveRef.current();
  }

  bridge.current.action = (x, y) => {
    const current = bridge.current.state;
    if (!current) return;
    const mode = bridge.current.tool;
    if (ROOMS[mode]) {
      const result = construct(current, mode, x, y);
      showAction(result, true);
      if (result.ok) {
        selectTool('inspect');
        chooseRoom(current.rooms.at(-1).id);
        setNotice(result.message);
      }
      return;
    }
    const room = roomAt(current, x, y);
    if (room) {
      chooseRoom(room.id);
      return;
    }
    if (mode === 'dig') showAction(excavate(current, x, y), true);
    else setNotice('Select a built room to see its crew.');
  };

  function setRate(rate) {
    bridge.current.speed = rate;
    setSpeed(rate);
    saveRef.current();
  }

  const currentRoom = state?.rooms.find(room => room.id === selected);
  const starterSeams = state && (!tileAt(state, 18, 10).open || !tileAt(state, 30, 10).open);
  const digHint = starterSeams ? 'Excavate the blue seam on the left and the amber seam on the right.' : 'Click rock at an open edge to dig.';
  const hint = ROOMS[tool] ? 'Click the left tile of a two-tile room.' :
    tool === 'dig' ? digHint :
      tool === 'pan' ? 'Drag to move the camera.' : 'Click a room to see staffing and upgrades.';

  return <div className="station">
    <header className="mast">
      <div className="brand"><img className="insignia" src={import.meta.env.BASE_URL + 'bedrock-logo.png'} alt="" width="43" height="43" /><div>
        <div className="brand-name">BEDROCK <span>STATION</span></div>
        <CampaignControls state={state} onStart={seed => startCampaignRef.current(seed)} />
      </div></div>
      <div className="time">
        <div className="clock"><span>DAY {day(state?.tick ?? 0)}</span><strong>{clock(state?.tick ?? 0)}</strong></div>
        <div className="speed" aria-label="Simulation speed">
          {[[0,'Ⅱ','Pause'],[1,'1×','Normal speed'],[2,'2×','Double speed'],[4,'4×','Quadruple speed']].map(([rate,label,name]) =>
            <button key={rate} title={name} aria-label={name} aria-pressed={speed === rate} disabled={!state} onClick={() => setRate(rate)}>{label}</button>)}
        </div>
      </div>
    </header>

    {state && <ResourceBar state={state} />}
    <main className="workspace">
      <section className="map-panel" aria-label="Bunker map">
        <div className="map-head"><h1><span className="indicator" /> {state?.entrance.kind === 'mountain' ? 'Mountain-base bunker' : 'Bunker cross-section'}</h1>
          <div className="camera-controls" aria-label="Camera controls">
            <button className="camera-surface" onClick={() => bridge.current.camera?.('gate')}>Gate</button>
            <button className="camera-surface" onClick={() => bridge.current.camera?.('cavern')}>Cavern</button>
            <button className="camera-surface" onClick={() => bridge.current.camera?.('surface')}>Surface</button>
            <button aria-label="Zoom out" title="Zoom out" onClick={() => bridge.current.camera?.('out')}>−</button>
            <button aria-label="Zoom in" title="Zoom in" onClick={() => bridge.current.camera?.('in')}>+</button>
            <button aria-label="Center camera" title="Center camera" onClick={() => bridge.current.camera?.('center')}>⌾</button>
          </div>
        </div>
        <div className={'map mode-' + tool} onPointerEnter={() => { bridge.current.hover = true; }} onPointerLeave={() => { bridge.current.hover = false; }}>
          <div className="canvas" ref={mapRef} />
          {(!state || mapError || !mapReady) && <div className="map-loading">
            {mapError || (blocked ? 'Close the other game tab, then reload this page.' : 'Opening the bunker…')}
            {(blocked || mapError) && <button onClick={() => window.location.reload()}>Reload</button>}
          </div>}
          {state && <div className="map-key"><span><i className="aqua" /> Aquifer</span><span><i className="seam" /> Oil seam</span><span><i className="iron-seam" /> Iron ore</span><span><i className="copper-seam" /> Copper ore</span></div>}
        </div>
        <div className="map-footer">
          <div className="tools" aria-label="Map tools">{Object.entries(tools).map(([key,[icon,label]]) =>
            <button key={key} aria-pressed={tool === key} onClick={() => selectTool(key)}><span aria-hidden="true">{icon}</span>{label}</button>)}</div>
          <p className="hint" role="status">{notice || hint}</p>
        </div>
      </section>

      <aside className="console" aria-label="Station management">
        <div className="console-head"><h2>Station management</h2><span className="crew-count" title="Residents and total beds">{state ? state.residents.length + ' / ' + beds(state) + ' crew' : '—'}</span></div>
        {state && <GateStatus state={state} onRepair={() => showAction(repairGate(bridge.current.state))} />}
        <nav className="tabs" aria-label="Management views">{['Build','Crew','Research','Log'].map(name => <button key={name} aria-pressed={tab === name} onClick={() => setTab(name)}>{name}</button>)}</nav>
        <div className="console-body">
          {tab === 'Build' && <>
            <p className="micro section-label">Construction · 2 × 1 tiles</p>
            <div className="room-list">{Object.entries(ROOMS).filter(([, spec]) => !spec.fixed).map(([key,spec]) =>
              <button key={key} className="room-choice" aria-pressed={tool === key} disabled={!state}
                style={{ '--tone': spec.color }} onClick={() => selectTool(tool === key ? 'dig' : key)}>
                <span className="room-icon" aria-hidden="true">{spec.icon}</span><span><strong>{spec.name}</strong><small>{spec.detail}</small></span><b title="Building materials">{spec.cost} ▦</b>
              </button>)}</div>
          </>}
          {tab === 'Crew' && state && <>
            {currentRoom && <RoomDetails state={state} room={currentRoom}
              onUpgrade={() => showAction(improveRoom(bridge.current.state, currentRoom.id), true)} />}
            <p className="micro section-label">Resident assignments and equipment</p>
            <div className="crew-list">{state.residents.map(person => <div className="person" key={person.id}>
              <span>{person.name}</span>
              <div className="person-controls">
                <select aria-label={person.name + ' assignment'} value={person.room ?? ''}
                  onChange={event => showAction(assign(bridge.current.state, event.target.value ? Number(event.target.value) : null, person.id))}>
                  <option value="">Off duty</option>
                  {state.rooms.filter(room => ROOMS[room.kind].jobs).map(room =>
                    <option key={room.id} value={room.id} disabled={person.room !== room.id && workers(state, room.id).length >= ROOMS[room.kind].jobs}>{ROOMS[room.kind].name} · {room.id}</option>)}
                </select>
                <select aria-label={person.name + ' weapon'} value={person.weapon ?? ''}
                  onChange={event => showAction(equipWeapon(bridge.current.state, person.id, event.target.value || null))}>
                  <option value="">Unarmed</option>
                  {Object.entries(WEAPONS).map(([id, spec]) => <option key={id} value={id}
                    disabled={person.weapon !== id && !state.weapons[id]}>{spec.name}{person.weapon === id ? ' · equipped' : ' (' + state.weapons[id] + ' available)'}</option>)}
                </select>
              </div>
            </div>)}</div>
            <p className="side-note">Weapons help residents assigned to defend the gate or a guard post.</p>
          </>}
          {tab === 'Research' && state && <ResearchPanel state={state}
            onResearch={id => showAction(startResearch(bridge.current.state, id))}
            onCraft={id => showAction(startCrafting(bridge.current.state, id))} />}
          {tab === 'Log' && state && <>
            <p className="micro section-label">Recent events</p>
            <ol className="history">{[...state.events].reverse().map(event =>
              <li key={event.id}><time>DAY {day(event.tick)} · {clock(event.tick)}</time><span className={event.type === 'raid' ? 'raid' : ''}>{event.text}</span></li>)}</ol>
          </>}
        </div>
        {state && <div className="condition"><span>Crew condition</span><strong>{Math.round(state.health)}%</strong><div className="meter"><i style={{ width: state.health + '%' }} /></div></div>}
      </aside>
    </main>
    <footer className="status"><span>{saveStatus}</span><span>Drag or WASD to pan · Scroll to zoom</span><span>v{version}</span></footer>
    <OfflineReport report={report} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);



