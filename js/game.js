'use strict';

/* Spiellogik: Zustand, Produktion, Gebiet, Kampf, Sieg. */
const Game = (() => {

  let st = null;

  /* ------------------------------------------------ Neues Spiel */

  function newGame(opts) {
    const map = MapGen.generate(opts.mapId, opts.seed, opts.players.length);
    const diff = CFG.DIFF[opts.difficulty];

    st = {
      opts, diff,
      w: map.w, h: map.h,
      terrain: map.terrain, trees: map.trees,
      deposit: map.deposit, found: new Uint8Array(map.w * map.h),
      owner: new Int8Array(map.w * map.h).fill(-1),
      buildings: [], units: [], carriers: [], ships: [],
      players: [],
      time: 0, speed: 1, over: null,
      nextId: 1,
      dirty: new Set(),          // Kacheln, die neu gezeichnet werden müssen
      territoryDirty: true,
      regrowTimer: 0, towerTimer: 0, promoteTimer: 0, healTimer: 0,
      toast: null,
    };

    opts.players.forEach((po, i) => {
      const res = {};
      for (const r of CFG.RES) {
        res[r] = CFG.START_RES[r] * (po.human ? 1 : st.diff.resMult) | 0;
      }
      st.players.push({
        id: i, human: po.human, team: po.team, tribe: po.tribe,
        name: po.human ? 'Du' : CFG.PLAYER_NAMES[i],
        color: CFG.COLORS[i],
        res, prodMult: po.human ? 1 : diff.prodMult,
        defeated: false, geoCd: 0, typePrio: {},
        ai: po.human ? null : AI.newMemory(),
      });
      const s = map.starts[i];
      addBuilding(i, 'hq', s.x, s.y, true);
    });

    recomputeTerritory();
    return st;
  }

  /* Gespeicherten Spielstand wiederherstellen (Gegenstück zu SaveGame.snapshot). */
  function restore(s) {
    st = {
      opts: s.opts, diff: CFG.DIFF[s.opts.difficulty],
      w: s.w, h: s.h,
      terrain: Uint8Array.from(s.terrain),
      trees: Uint8Array.from(s.trees),
      deposit: Int8Array.from(s.deposit),
      found: Uint8Array.from(s.found),
      owner: new Int8Array(s.w * s.h).fill(-1),
      buildings: s.buildings, units: s.units, carriers: [], ships: s.ships || [],
      players: s.players.map(p => ({ ...p, geoCd: p.geoCd || 0, typePrio: p.typePrio || {}, ai: p.human ? null : (p.ai || AI.newMemory()) })),
      time: s.time, speed: 1, over: s.over || null,
      nextId: s.nextId,
      dirty: new Set(), territoryDirty: true,
      regrowTimer: 0, towerTimer: 0, promoteTimer: 0, healTimer: 0, toast: null,
    };
    // In-Flight-Lieferungen wurden beim Speichern dem Pool gutgeschrieben → Träger neu starten
    for (const b of st.buildings) { b.hasCarrier = false; }
    recomputeTerritory();
    return st;
  }

  /* ------------------------------------------------ Völker */

  function tribeOf(pid) {
    return CFG.TRIBES[st.players[pid].tribe] || CFG.TRIBES.roemer;
  }

  /* Baukosten inkl. Volks-Rabatt. */
  function tribeCost(pid, type) {
    const cost = { ...CFG.BUILDINGS[type].cost };
    const off = tribeOf(pid).bonus.cost?.[type];
    if (off) for (const [r, n] of Object.entries(off)) cost[r] = Math.max(0, (cost[r] || 0) - n);
    return cost;
  }

  /* Gebietsradius inkl. Volks-Bonus. */
  function claimOf(b) {
    const def = CFG.BUILDINGS[b.type];
    if (!def.claim) return 0;
    return def.claim + (tribeOf(b.owner).bonus.claim?.[b.type] || 0);
  }

  /* Beansprucht dieses Gebäude gerade Land? Militär nur mit Besatzung. */
  function claimsLand(b) {
    const def = CFG.BUILDINGS[b.type];
    if (!b.alive || !b.done || !def.claim) return false;
    if (def.military) return (b.garrison || 0) > 0;
    return true;
  }

  const needsTool = type => !!CFG.TOOL_OF[type];

  /* ------------------------------------------------ Hilfen */

  const idx = (x, y) => y * st.w + x;
  const inB = (x, y) => x >= 0 && y >= 0 && x < st.w && y < st.h;
  const walkable = i => st.terrain[i] === CFG.T.GRASS || st.terrain[i] === CFG.T.SAND;

  function buildingAt(x, y) {
    if (!inB(x, y)) return null;
    const i = idx(x, y);
    return st.buildings.find(b => b.alive && b.x === x && b.y === y) || null;
  }

  function hasTerrainNear(x, y, need) {
    const r = need.r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny) || dx * dx + dy * dy > r * r) continue;
        const i = idx(nx, ny);
        if (need.trees) { if (st.trees[i] > 0) return true; }
        else if (st.terrain[i] === need.t) return true;
      }
    }
    return false;
  }

  /* Gefundenes Vorkommen eines Typs in Reichweite r? (für Goldmine). */
  function hasFoundDeposit(x, y, depType, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny) || dx * dx + dy * dy > r * r) continue;
        const i = idx(nx, ny);
        if (st.found[i] && st.deposit[i] === depType) return true;
      }
    }
    return false;
  }

  /* Reiches (gefundenes) Vorkommen zur Ware in Reichweite → Ertragsbonus für Minen. */
  function hasRichDeposit(x, y, res, r) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!inB(nx, ny) || dx * dx + dy * dy > r * r) continue;
        const i = idx(nx, ny);
        if (st.found[i] && st.deposit[i] >= 0 && CFG.DEP_INFO[st.deposit[i]].res === res) return true;
      }
    }
    return false;
  }

  function canAfford(p, cost) {
    return Object.entries(cost).every(([r, n]) => p.res[r] >= n);
  }

  function pay(p, cost) {
    for (const [r, n] of Object.entries(cost)) p.res[r] -= n;
  }

  /* Warum kann hier nicht gebaut werden? null = alles ok. */
  function placeError(pid, type, x, y) {
    const def = CFG.BUILDINGS[type];
    if (!inB(x, y)) return 'Außerhalb der Karte';
    const i = idx(x, y);
    if (st.terrain[i] !== CFG.T.GRASS) return 'Nur auf Wiese baubar';
    if (st.trees[i] > 0) return 'Hier stehen Bäume';
    if (st.owner[i] !== pid) return 'Nicht dein Gebiet';
    if (buildingAt(x, y)) return 'Feld ist belegt';
    if (def.terrainNeed && !hasTerrainNear(x, y, def.terrainNeed)) {
      if (def.terrainNeed.trees) return 'Keine Bäume in der Nähe';
      if (def.terrainNeed.t === CFG.T.WATER) return 'Kein Wasser in der Nähe';
      return 'Kein Berg in der Nähe';
    }
    if (def.needDeposit !== undefined &&
        !hasFoundDeposit(x, y, def.needDeposit, (def.terrainNeed && def.terrainNeed.r) || 2)) {
      return 'Kein gefundenes Goldvorkommen – schick einen Geologen';
    }
    if (!canAfford(st.players[pid], tribeCost(pid, type))) return 'Zu wenig Rohstoffe';
    return null;
  }

  function addBuilding(pid, type, x, y, instant) {
    const def = CFG.BUILDINGS[type];
    const hp = Math.round(def.hp * (tribeOf(pid).bonus.buildingHp || 1));
    const b = {
      id: st.nextId++, type, owner: pid, x, y,
      hp, maxHp: hp,
      done: !!instant, progress: instant ? 1 : 0,
      timer: def.interval || 0, working: false, alive: true,
      staffed: !needsTool(type),     // Werkzeug-Gebäude erst nach Besetzung tätig
      out: {}, hasCarrier: false,     // Ausgangslager + laufende Lieferung
      garrison: 0, gtypes: [],        // Turm-Besatzung (Anzahl + Typen)
      toolType: null, trainType: def.siege ? 'katapult' : 'lanze', queue: [],
      paused: false, prio: (st.players[pid].typePrio && st.players[pid].typePrio[type]) || 1,
    };
    st.buildings.push(b);
    st.dirty.add(idx(x, y));
    if (b.done && def.claim) st.territoryDirty = true;
    return b;
  }

  function tryBuild(pid, type, x, y) {
    const err = placeError(pid, type, x, y);
    if (err) return err;
    pay(st.players[pid], tribeCost(pid, type));
    addBuilding(pid, type, x, y, false);
    return null;
  }

  function demolish(b) {
    destroyBuilding(b);
  }

  function destroyBuilding(b) {
    if (!b.alive) return;
    b.alive = false;
    st.dirty.add(idx(b.x, b.y));
    const def = CFG.BUILDINGS[b.type];
    if (def.claim) st.territoryDirty = true;
    for (const u of st.units) {
      if (u.tb === b.id) { u.tb = null; u.path = null; }
    }
    if (b.type === 'hq') defeatPlayer(st.players[b.owner]);
  }

  function defeatPlayer(p) {
    if (p.defeated) return;
    p.defeated = true;
    for (const b of st.buildings) if (b.owner === p.id) { b.alive = false; st.dirty.add(idx(b.x, b.y)); }
    st.units = st.units.filter(u => u.owner !== p.id);
    st.carriers = st.carriers.filter(c => c.owner !== p.id);
    st.ships = st.ships.filter(s => s.owner !== p.id);
    recomputeTerritory();
    st.territoryDirty = true;   // Anzeige neu zeichnen
    st.toast = { text: `${p.name} wurde${p.human ? 'st' : ''} besiegt!`, t: 5 };
    checkVictory();
  }

  function checkVictory() {
    if (st.over) return;
    const alive = st.players.filter(p => !p.defeated);
    const teams = new Set(alive.map(p => p.team));
    const human = st.players.find(p => p.human);
    if (human.defeated) {
      st.over = { win: false };
    } else if (teams.size <= 1) {
      st.over = { win: teams.has(human.team) };
    }
  }

  /* ------------------------------------------------ Gebiet */

  function recomputeTerritory() {
    const { w, h, owner } = st;
    owner.fill(-1);
    const best = new Float32Array(w * h).fill(1e9);
    for (const b of st.buildings) {
      if (!claimsLand(b)) continue;
      const r = claimOf(b), r2 = r * r;
      for (let y = Math.max(0, b.y - r); y <= Math.min(h - 1, b.y + r); y++) {
        for (let x = Math.max(0, b.x - r); x <= Math.min(w - 1, b.x + r); x++) {
          const d2 = (x - b.x) ** 2 + (y - b.y) ** 2;
          if (d2 > r2) continue;
          const i = y * w + x;
          if (d2 < best[i]) { best[i] = d2; owner[i] = b.owner; }
        }
      }
    }
  }

  /* ------------------------------------------------ Wegfindung (A*) */

  const isWater = i => st.terrain[i] === CFG.T.WATER;

  /* A* mit optionalem Passierbarkeits-Prädikat (Default: Land). */
  function astar(sx, sy, tx, ty, pass, nearFn) {
    const { w, h } = st;
    pass = pass || walkable;
    if (!inB(tx, ty)) return null;
    if (!pass(idx(tx, ty))) {
      const alt = (nearFn || nearestWalkable)(tx, ty, 3);
      if (!alt) return null;
      tx = alt.x; ty = alt.y;
    }
    const size = w * h;
    const g = new Float32Array(size).fill(1e9);
    const from = new Int32Array(size).fill(-1);
    const closed = new Uint8Array(size);
    const heap = [];      // [f, index]
    const push = (f, i) => {
      heap.push([f, i]);
      let c = heap.length - 1;
      while (c > 0) {
        const par = (c - 1) >> 1;
        if (heap[par][0] <= heap[c][0]) break;
        [heap[par], heap[c]] = [heap[c], heap[par]]; c = par;
      }
    };
    const pop = () => {
      const top = heap[0], last = heap.pop();
      if (heap.length) {
        heap[0] = last;
        let c = 0;
        for (;;) {
          let m = c; const l = 2 * c + 1, r = l + 1;
          if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
          if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
          if (m === c) break;
          [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
        }
      }
      return top;
    };
    const hFn = i => {
      const x = i % w, y = (i / w) | 0;
      return Math.hypot(x - tx, y - ty);
    };
    const start = idx(sx, sy), goal = idx(tx, ty);
    g[start] = 0;
    push(hFn(start), start);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42]];
    let expanded = 0;
    while (heap.length) {
      const [, cur] = pop();
      if (closed[cur]) continue;
      closed[cur] = 1;
      if (cur === goal) break;
      if (++expanded > 6000) return null;
      const cx = cur % w, cy = (cur / w) | 0;
      for (const [dx, dy, c] of DIRS) {
        const nx = cx + dx, ny = cy + dy;
        if (!inB(nx, ny)) continue;
        const ni = ny * w + nx;
        if (!pass(ni) || closed[ni]) continue;
        const ng = g[cur] + c;
        if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; push(ng + hFn(ni), ni); }
      }
    }
    if (from[goal] === -1 && goal !== start) return null;
    const path = [];
    for (let i = goal; i !== -1 && i !== start; i = from[i]) path.push({ x: (i % w) + 0.5, y: ((i / w) | 0) + 0.5 });
    path.reverse();
    return path;
  }

  function nearestWalkable(tx, ty, r) {
    for (let rad = 0; rad <= r; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (inB(nx, ny) && walkable(idx(nx, ny))) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  function nearestWater(tx, ty, r) {
    for (let rad = 0; rad <= r; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const nx = tx + dx, ny = ty + dy;
          if (inB(nx, ny) && isWater(idx(nx, ny))) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  const waterAstar = (sx, sy, tx, ty) => astar(sx, sy, tx, ty, isWater, nearestWater);

  /* ------------------------------------------------ Soldaten */

  function countPop(pid) {
    return st.units.reduce((n, u) => n + (u.owner === pid ? 1 : 0), 0);
  }

  function maxPop(pid) {
    let n = CFG.POP_BASE;
    for (const b of st.buildings) {
      if (b.alive && b.done && b.owner === pid && CFG.BUILDINGS[b.type].pop) n += CFG.BUILDINGS[b.type].pop;
    }
    return n;
  }

  function spawnSoldier(pid, x, y, type) {
    const S = CFG.SOLDIERS[type] || CFG.SOLDIERS.lanze;
    const spot = nearestWalkable(x, y + 1, 3) || { x, y };
    const mult = tribeOf(pid).bonus.soldier || 1;
    const hp = Math.round(S.hp * mult);
    st.units.push({
      id: st.nextId++, owner: pid, type: type || 'lanze', rank: 0,
      x: spot.x + 0.5, y: spot.y + 0.5,
      hp, maxHp: hp,
      dmgU: S.dmgUnit * mult,
      dmgB: S.dmgBuilding * mult,
      range: S.range, speed: S.speed, cool: S.cooldown, aggro: S.aggro,
      path: null, pi: 0, tb: null, tu: null, tgGar: null,
      cd: 0, scan: Math.random() * 0.5,
    });
  }

  /* ------------------------------------------------ Schiffe */

  function spawnShip(pid, x, y, type, harborId) {
    const S = CFG.SHIPS[type];
    st.ships.push({
      id: st.nextId++, owner: pid, type, home: harborId,
      x: x + 0.5, y: y + 0.5, hp: S.hp, maxHp: S.hp,
      path: null, pi: 0, cargo: [], timer: S.interval || 0,
      roamT: Math.random() * 2, unloadAt: null,
    });
  }

  function shipAt(wx, wy) {
    let best = null, bestD = 1.4;
    for (const s of st.ships) {
      const d = Math.hypot(s.x - wx, s.y - wy);
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  /* Schiff zu Wasser-/Küstenziel schicken; mit Fracht an Land = ausschiffen. */
  function commandShip(s, tx, ty) {
    const ti = idx(Math.floor(tx), Math.floor(ty));
    if (inB(Math.floor(tx), Math.floor(ty)) && isWater(ti)) {
      s.path = waterAstar(Math.floor(s.x), Math.floor(s.y), Math.floor(tx), Math.floor(ty));
      s.pi = 0; s.unloadAt = null;
    } else {
      // Küste: bis ans Ufer fahren und Fracht ausschiffen
      const wp = nearestWater(Math.floor(tx), Math.floor(ty), 4);
      if (!wp) return false;
      s.path = waterAstar(Math.floor(s.x), Math.floor(s.y), wp.x, wp.y);
      s.pi = 0;
      s.unloadAt = { x: Math.floor(tx), y: Math.floor(ty) };
    }
    return true;
  }

  /* Ausgewählte Soldaten sollen auf ein eigenes Transportschiff aufsteigen. */
  function boardUnits(units, s) {
    if (s.type !== 'transporter') return false;
    let n = 0;
    for (const u of units) {
      if (u.owner !== s.owner) continue;
      if (s.cargo.length + n >= CFG.SHIPS.transporter.capacity) break;
      u.board = s.id; u.tb = null; u.tu = null; u.tgGar = null;
      // ans Ufer nahe dem Schiff laufen
      const land = nearestWalkable(Math.floor(s.x), Math.floor(s.y), 4);
      if (land) { u.path = astar(Math.floor(u.x), Math.floor(u.y), land.x, land.y); u.pi = 0; }
      n++;
    }
    return n > 0;
  }

  function updateShips(dt) {
    for (const s of st.ships) {
      const S = CFG.SHIPS[s.type];
      if (s.path) {
        if (followWater(s, dt)) {          // Ziel erreicht
          if (s.unloadAt) { disembark(s); s.unloadAt = null; }
        }
      } else if (s.type === 'fischer') {
        s.roamT -= dt;
        if (s.roamT <= 0) { roamFisher(s); s.roamT = 3 + Math.random() * 3; }
        s.timer -= dt;
        if (s.timer <= 0) {
          s.timer = S.interval;
          const p = st.players[s.owner];
          if (p && !p.defeated) p.res.nahrung += S.food;   // Fischfang
        }
      }
    }
    st.ships = st.ships.filter(s => s.hp > 0 && !s.removed);
  }

  function followWater(s, dt) {
    const wp = s.path[s.pi];
    if (!wp) { s.path = null; return true; }
    const d = Math.hypot(wp.x - s.x, wp.y - s.y);
    const step = CFG.SHIPS[s.type].speed * dt;
    if (d <= step) { s.x = wp.x; s.y = wp.y; s.pi++; if (s.pi >= s.path.length) { s.path = null; return true; } }
    else { s.x += (wp.x - s.x) / d * step; s.y += (wp.y - s.y) / d * step; }
    return false;
  }

  function roamFisher(s) {
    // kleines Ziel in Wassernähe
    const harbor = getBuilding(s.home);
    const cx = harbor ? harbor.x : Math.floor(s.x), cy = harbor ? harbor.y : Math.floor(s.y);
    for (let tries = 0; tries < 8; tries++) {
      const rx = cx + ((Math.random() * 12) | 0) - 6, ry = cy + ((Math.random() * 12) | 0) - 6;
      if (inB(rx, ry) && isWater(idx(rx, ry))) {
        s.path = waterAstar(Math.floor(s.x), Math.floor(s.y), rx, ry); s.pi = 0;
        if (s.path) return;
      }
    }
  }

  function disembark(s) {
    for (const u of s.cargo) {
      const land = nearestWalkable(s.unloadAt.x, s.unloadAt.y, 5) || nearestWalkable(Math.floor(s.x), Math.floor(s.y), 5);
      if (!land) continue;
      u.x = land.x + 0.5; u.y = land.y + 0.5;
      u.removed = false; u.board = null; u.path = null; u.tb = null; u.tu = null;
      // ans Ziel weiterlaufen
      u.path = astar(land.x, land.y, s.unloadAt.x, s.unloadAt.y); u.pi = 0;
      st.units.push(u);
    }
    s.cargo = [];
  }

  function isEnemy(a, b) {
    return st.players[a].team !== st.players[b].team;
  }

  function getBuilding(id) {
    return st.buildings.find(b => b.id === id && b.alive) || null;
  }

  function getUnit(id) {
    return st.units.find(u => u.id === id && u.hp > 0) || null;
  }

  /* Befehl: Einheiten zu Punkt schicken, Ziel angreifen oder eigenen Turm besetzen. */
  function commandUnits(units, tx, ty) {
    const tb = buildingAt(Math.floor(tx), Math.floor(ty));
    let tu = null;
    let bestD = 1.2;
    for (const u of st.units) {
      const d = Math.hypot(u.x - tx, u.y - ty);
      if (d < bestD) { bestD = d; tu = u; }
    }
    // Eigener Turm mit freiem Platz? → Besatzung schicken statt anzugreifen
    const ownTower = tb && !isEnemy(0, tb.owner) && CFG.BUILDINGS[tb.type].military ? tb : null;
    let attacked = false, garrisoned = false;
    units.forEach((u, k) => {
      u.tb = null; u.tu = null; u.tgGar = null;
      if (ownTower && u.owner === tb.owner) {
        u.tgGar = tb.id; garrisoned = true;
      } else if (tu && tu.owner !== u.owner && isEnemy(u.owner, tu.owner)) {
        u.tu = tu.id; attacked = true;
      } else if (tb && tb.owner !== u.owner && isEnemy(u.owner, tb.owner)) {
        u.tb = tb.id; attacked = true;
      }
      const off = spreadOffset(k);
      const gx = Math.max(0, Math.min(st.w - 1, Math.floor(tx + off.x)));
      const gy = Math.max(0, Math.min(st.h - 1, Math.floor(ty + off.y)));
      u.path = astar(Math.floor(u.x), Math.floor(u.y), gx, gy);
      u.pi = 0;
    });
    return { attacked, garrisoned };
  }

  function spreadOffset(k) {
    if (k === 0) return { x: 0, y: 0 };
    const ring = Math.ceil((Math.sqrt(k + 1) - 1) / 2);
    const ang = k * 2.4;
    return { x: Math.cos(ang) * ring, y: Math.sin(ang) * ring };
  }

  /* ------------------------------------------------ Takt */

  function update(dt) {
    if (!st || st.over) return;
    st.time += dt;
    if (st.toast) { st.toast.t -= dt; if (st.toast.t <= 0) st.toast = null; }

    if (st.territoryDirty) { recomputeTerritory(); }

    // Nach Priorität sortiert abarbeiten: hoch priorisierte Verbraucher bekommen
    // knappe geteilte Waren (Kohle/Eisen/Holz/Getreide) zuerst.
    const order = st.buildings.filter(b => b.alive).sort((a, b) => (b.prio || 1) - (a.prio || 1));
    for (const b of order) updateBuilding(b, dt);
    st.buildings = st.buildings.filter(b => b.alive);

    updateCarriers(dt);
    updateUnits(dt);
    updateShips(dt);
    towerDefense(dt);
    promoteSoldiers(dt);
    healAura(dt);

    for (const p of st.players) if (p.geoCd > 0) p.geoCd -= dt;

    regrow(dt);

    for (const p of st.players) {
      if (!p.defeated && !p.human) AI.update(p, dt);
    }
  }

  function hasBuildingType(pid, type) {
    return st.buildings.some(b => b.alive && b.done && b.owner === pid && b.type === type);
  }

  function buildingsOfType(pid, type) {
    return st.buildings.filter(b => b.alive && b.done && b.owner === pid && b.type === type);
  }

  /* Goldmünzen befördern Soldaten (3 Stufen). Ein Tempel verdoppelt die Rate. */
  function promoteSoldiers(dt) {
    st.promoteTimer -= dt;
    if (st.promoteTimer > 0) return;
    st.promoteTimer = CFG.PROMOTE_CD;
    const maxRank = CFG.RANKS.length - 1;
    for (const p of st.players) {
      if (p.defeated) continue;
      const perTick = hasBuildingType(p.id, 'tempel') ? 2 : 1;   // Tempel: schneller
      for (let k = 0; k < perTick; k++) {
        if ((p.res.gold || 0) < CFG.PROMOTE_COST) break;
        let target = null;
        for (const u of st.units) {
          if (u.owner !== p.id || (u.rank || 0) >= maxRank) continue;
          if (!target || (u.rank || 0) < (target.rank || 0)) target = u;
        }
        if (!target) break;
        p.res.gold -= CFG.PROMOTE_COST;
        const oldM = CFG.RANKS[target.rank || 0].mult;
        target.rank = (target.rank || 0) + 1;
        const f = CFG.RANKS[target.rank].mult / oldM;
        target.maxHp = Math.round(target.maxHp * f);
        target.hp = Math.round(target.hp * f);
        target.dmgU *= f; target.dmgB *= f;
        if (p.human) st.toast = { text: `🎖️ Soldat zum ${CFG.RANKS[target.rank].name} befördert!`, t: 3 };
      }
    }
  }

  /* Lazarett: verwundete eigene Einheiten im Umkreis regenerieren HP. */
  function healAura(dt) {
    st.healTimer -= dt;
    if (st.healTimer > 0) return;
    const step = 0.5;
    st.healTimer = step;
    const laz = st.buildings.filter(b => b.alive && b.done && CFG.BUILDINGS[b.type].hospital);
    if (!laz.length) return;
    const R = CFG.LAZARETT.radius, heal = CFG.LAZARETT.healPerSec * step;
    for (const u of st.units) {
      if (u.hp >= u.maxHp) continue;
      for (const b of laz) {
        if (b.owner !== u.owner) continue;
        if (Math.hypot(b.x + 0.5 - u.x, b.y + 0.5 - u.y) <= R) {
          u.hp = Math.min(u.maxHp, u.hp + heal);
          break;
        }
      }
    }
  }

  /* Moral: Einheit nahe eigenem Tempel → Schadensbonus. */
  function moralOf(u) {
    for (const b of st.buildings) {
      if (!b.alive || !b.done || b.owner !== u.owner || b.type !== 'tempel') continue;
      if (Math.hypot(b.x + 0.5 - u.x, b.y + 0.5 - u.y) <= CFG.TEMPLE.radius) return CFG.TEMPLE.moral;
    }
    return 1;
  }

  /* ------------------------------------------------ Lastenträger / Logistik */

  function carrierCap(pid) {
    let n = CFG.CARRIERS_BASE;
    for (const b of st.buildings) {
      if (b.alive && b.done && b.owner === pid && CFG.BUILDINGS[b.type].carriers) n += CFG.BUILDINGS[b.type].carriers;
    }
    return Math.min(CFG.CARRIER_MAX, n);
  }

  function carriersBusy(pid) {
    let n = 0;
    for (const c of st.carriers) if (c.owner === pid && c.kind === 'goods') n++;
    return n;
  }

  /* Nächstes Lager (HQ oder Lagerhaus) des Spielers. */
  function nearestStore(pid, x, y) {
    let best = null, bestD = 1e9;
    for (const b of st.buildings) {
      if (!b.alive || !b.done || b.owner !== pid) continue;
      if (b.type !== 'hq' && !CFG.BUILDINGS[b.type].storage) continue;
      const d = (b.x - x) ** 2 + (b.y - y) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /* Produzierte Waren aus dem Ausgangslager eines Gebäudes per Träger ausliefern. */
  function dispatchGoods(b) {
    const p = st.players[b.owner];
    if (b.hasCarrier || !Object.keys(b.out).length) return;
    if (carriersBusy(b.owner) >= carrierCap(b.owner)) return;
    const store = nearestStore(b.owner, b.x, b.y);
    if (!store) { creditPool(p, b.out); b.out = {}; return; }   // Notfall
    const path = astar(b.x, b.y, store.x, store.y);
    const payload = b.out; b.out = {}; b.hasCarrier = true;
    if (!path) { creditPool(p, payload); b.hasCarrier = false; return; }
    st.carriers.push({
      id: st.nextId++, owner: b.owner, kind: 'goods',
      from: b.id, payload, res: firstKey(payload),
      x: b.x + 0.5, y: b.y + 0.5, path, pi: 0, speed: 2.2,
    });
  }

  /* Siedler bringt ein Werkzeug vom Lager zum neu besetzten Gebäude (nur Optik). */
  function dispatchStaff(b, tool) {
    const store = nearestStore(b.owner, b.x, b.y);
    if (!store) return;
    const path = astar(store.x, store.y, b.x, b.y);
    if (!path) return;
    st.carriers.push({
      id: st.nextId++, owner: b.owner, kind: 'staff',
      res: tool, x: store.x + 0.5, y: store.y + 0.5, path, pi: 0, speed: 2.4,
    });
  }

  /* Geologe zu einem Berggebiet schicken; deckt dort Vorkommen auf. */
  function geologeActive(pid) {
    let n = 0;
    for (const c of st.carriers) if (c.owner === pid && c.kind === 'geologe') n++;
    return n;
  }

  function dispatchGeologe(pid, tx, ty) {
    const p = st.players[pid];
    if (p.geoCd > 0) return 'Geologe noch nicht bereit';
    if (geologeActive(pid) >= CFG.GEOLOGE.maxActive) return 'Schon genug Geologen unterwegs';
    if (!canAfford(p, CFG.GEOLOGE.cost)) return 'Zu wenig Nahrung für den Geologen';
    const start = nearestStore(pid, tx, ty);
    if (!start) return 'Kein Hauptquartier';
    const goal = nearestWalkable(tx, ty, 4);
    if (!goal) return 'Ziel nicht erreichbar';
    const path = astar(start.x, start.y, goal.x, goal.y);
    if (!path) return 'Kein Weg zum Berg';
    pay(p, CFG.GEOLOGE.cost);
    p.geoCd = CFG.GEOLOGE.cooldown;
    st.carriers.push({
      id: st.nextId++, owner: pid, kind: 'geologe',
      tx, ty, x: start.x + 0.5, y: start.y + 0.5, path, pi: 0, speed: CFG.GEOLOGE.speed,
    });
    return null;
  }

  /* Vorkommen im Radius um (cx,cy) aufdecken. */
  function prospect(pid, cx, cy) {
    const r = CFG.GEOLOGE.radius;
    let gold = false;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (!inB(nx, ny) || dx * dx + dy * dy > r * r) continue;
        const i = idx(nx, ny);
        if (st.terrain[i] === CFG.T.MOUNTAIN && st.deposit[i] >= 0 && !st.found[i]) {
          st.found[i] = 1; st.dirty.add(i);
          if (st.deposit[i] === CFG.DEP.GOLD) gold = true;
        }
      }
    }
    if (gold && st.players[pid].human) st.toast = { text: '⛏️ Der Geologe hat ein Goldvorkommen entdeckt!', t: 4 };
  }

  function updateCarriers(dt) {
    for (const c of st.carriers) {
      const wp = c.path[c.pi];
      if (!wp) { c.done = true; }
      else {
        const d = Math.hypot(wp.x - c.x, wp.y - c.y);
        const step = c.speed * dt;
        if (d <= step) { c.x = wp.x; c.y = wp.y; c.pi++; if (c.pi >= c.path.length) c.done = true; }
        else { c.x += (wp.x - c.x) / d * step; c.y += (wp.y - c.y) / d * step; }
      }
      if (c.done && c.kind === 'goods') {
        creditPool(st.players[c.owner], c.payload);
        const src = st.buildings.find(b => b.id === c.from);
        if (src) src.hasCarrier = false;
      } else if (c.done && c.kind === 'geologe') {
        prospect(c.owner, c.tx, c.ty);
      }
    }
    st.carriers = st.carriers.filter(c => !c.done);
  }

  function creditPool(p, bundle) {
    for (const [r, n] of Object.entries(bundle)) p.res[r] = (p.res[r] || 0) + n;
  }

  const firstKey = o => Object.keys(o)[0];

  const OUTBUF_CAP = 8;
  const bufTotal = b => Object.values(b.out).reduce((a, n) => a + n, 0);

  /* ------------------------------------------------ Turmverteidigung */

  function towerDefense(dt) {
    st.towerTimer -= dt;
    if (st.towerTimer > 0) return;
    st.towerTimer = 0.6;
    for (const b of st.buildings) {
      if (!b.alive || !b.done || !CFG.BUILDINGS[b.type].military || (b.garrison || 0) <= 0) continue;
      const range = 3.5 + b.garrison * 0.6;
      let tgt = null, bestD = range;
      for (const e of st.units) {
        if (e.owner === b.owner || !isEnemy(b.owner, e.owner)) continue;
        const d = Math.hypot(e.x - (b.x + 0.5), e.y - (b.y + 0.5));
        if (d < bestD) { bestD = d; tgt = e; }
      }
      if (tgt) { tgt.hp -= 3 * b.garrison; b.firing = tgt.id; }
      else b.firing = null;
    }
    st.units = st.units.filter(u => u.hp > 0);
  }

  function updateBuilding(b, dt) {
    const def = CFG.BUILDINGS[b.type];
    const p = st.players[b.owner];

    if (!b.done) {
      b.progress += dt / (def.buildTime * (tribeOf(b.owner).bonus.buildTime || 1)) * p.prodMult;
      if (b.progress >= 1) {
        b.progress = 1; b.done = true;
        st.dirty.add(idx(b.x, b.y));
        if (def.claim) st.territoryDirty = true;
      }
      return;
    }

    // Fertige Waren zum Lager schaffen (auch für nicht-produzierende Zustände)
    dispatchGoods(b);

    if (b.paused) { b.working = false; b.status = 'Pausiert'; return; }
    if (def.trains) { trainAtBarracks(b, dt, def, p); return; }
    if (def.buildsShips) { buildAtHarbor(b, dt, def, p); return; }
    if (!def.interval) return;   // Lager, Wohnhaus, Militär: keine Produktion

    b.timer -= dt * p.prodMult;
    if (b.timer > 0) return;
    b.working = false;
    b.status = null;

    // Werkzeug-Gate: ohne Werkzeug kein Arbeiter → Gebäude steht still
    if (needsTool(b.type) && !b.staffed) {
      const tool = CFG.TOOL_OF[b.type];
      if ((p.res[tool] || 0) < 1) { b.status = 'Werkzeug fehlt (' + CFG.RES_INFO[tool].name + ')'; b.timer = 1.5; return; }
      p.res[tool]--; b.staffed = true;
      dispatchStaff(b, tool);   // Siedler bringt das Werkzeug (Optik)
    }

    if (bufTotal(b) >= OUTBUF_CAP) { b.status = 'Lager voll – wartet auf Träger'; b.timer = 1.0; return; }
    if (def.terrainNeed && !def.terrainNeed.trees && !hasTerrainNear(b.x, b.y, def.terrainNeed)) {
      b.status = 'Gelände fehlt'; b.timer = 1.5; return;
    }
    if (def.input && !canAfford(p, def.input)) {
      b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return;
    }
    if (b.type === 'holzfaeller') {
      const tree = findTree(b);
      if (!tree) { b.status = 'Keine Bäume mehr'; b.timer = 2; return; }
      st.trees[tree]--; st.dirty.add(tree);
    }

    if (def.input) pay(p, def.input);
    // Produktion landet im Ausgangslager (wird per Träger geliefert)
    if (def.output) {
      // Minen an gefundenen, reichen Vorkommen fördern mehr
      const rich = def.terrainNeed && def.terrainNeed.t === CFG.T.MOUNTAIN;
      for (const [r, n] of Object.entries(def.output)) {
        let amt = n;
        if (rich && hasRichDeposit(b.x, b.y, r, def.terrainNeed.r)) amt += 1;
        b.out[r] = (b.out[r] || 0) + amt;
      }
    }
    if (def.makesTool) { const t = chooseTool(b); b.out[t] = (b.out[t] || 0) + 1; }
    b.working = true;
    const tribeMult = tribeOf(b.owner).bonus.interval?.[b.type] || 1;
    // Bier-Bonus: Minen fördern schneller, solange Bier vorrätig (Bergleute-Moral)
    let beerMult = 1;
    if (CFG.MINES.includes(b.type) && (p.res.bier || 0) > 0) {
      beerMult = CFG.BEER_BONUS;
      if (Math.random() < 0.3) p.res.bier--;   // Bier wird langsam getrunken
    }
    b.timer = def.interval * tribeMult * beerMult * (0.9 + Math.random() * 0.2);
    dispatchGoods(b);
  }

  /* Werkzeugmacher: baut das aktuell am dringendsten fehlende Werkzeug
     (Gebäude wartet darauf) – sonst die eingestellte Priorität bzw. reihum. */
  function chooseTool(b) {
    const p = st.players[b.owner];
    if (b.toolType) return b.toolType;   // manueller Wunsch
    // Werkzeug, für das ein eigenes Gebäude wartet und der Pool leer ist
    for (const bb of st.buildings) {
      if (bb.alive && bb.done && bb.owner === b.owner && needsTool(bb.type) && !bb.staffed) {
        const t = CFG.TOOL_OF[bb.type];
        if ((p.res[t] || 0) + (b.out[t] || 0) < 1) return t;
      }
    }
    b.toolRR = ((b.toolRR || 0) + 1) % CFG.TOOL_KEYS.length;
    return CFG.TOOL_KEYS[b.toolRR];
  }

  /* Nächster Bau-Typ: erst Warteschlange (Typ+Anzahl), sonst Dauer-Typ (KI/Fallback). */
  function nextQueued(b, fallback) {
    if (b.queue && b.queue.length) {
      const e = b.queue[0];
      return { type: e.type, fromQueue: true };
    }
    return fallback ? { type: fallback, fromQueue: false } : null;
  }

  function consumeQueue(b) {
    if (b.queue && b.queue.length) {
      if (--b.queue[0].count <= 0) b.queue.shift();
    }
  }

  /* Kaserne/Belagerung bildet Einheiten aus (Warteschlange oder Dauer-Typ). */
  function trainAtBarracks(b, dt, def, p) {
    b.timer -= dt * p.prodMult;
    if (b.timer > 0) return;
    b.working = false; b.status = null;

    const pool = def.siege ? CFG.SIEGE_KEYS : CFG.SOLDIER_KEYS;
    const fallback = pool.includes(b.trainType) ? b.trainType : pool[0];
    const sel = nextQueued(b, fallback);
    if (!sel) { b.status = 'Warteschlange leer'; b.timer = 1.0; return; }
    let type = pool.includes(sel.type) ? sel.type : fallback;

    const affordable = t => canAfford(p, CFG.SOLDIERS[t].cost);
    if (!affordable(type)) {
      if (p.human && sel.fromQueue) { b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return; }
      if (p.human) { b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return; }
      const alt = pool.find(affordable);
      if (!alt) { b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return; }
      type = alt;
    }
    if (countPop(b.owner) >= maxPop(b.owner)) { b.status = 'Kein Wohnraum frei'; b.timer = 1.5; return; }

    pay(p, CFG.SOLDIERS[type].cost);
    spawnSoldier(b.owner, b.x, b.y, type);
    if (sel.fromQueue) consumeQueue(b);
    b.working = true;
    const tm = tribeOf(b.owner).bonus.trainMult || 1;
    b.timer = CFG.SOLDIERS[type].train * tm * (0.9 + Math.random() * 0.2);
  }

  /* Hafen baut Schiffe (Warteschlange; Fallback: Fischerboot). */
  function buildAtHarbor(b, dt, def, p) {
    b.timer -= dt * p.prodMult;
    if (b.timer > 0) return;
    b.working = false; b.status = null;

    const sel = nextQueued(b, 'fischer');
    // Ohne Auftrag nur begrenzt Fischerboote nachbauen
    if (!sel.fromQueue) {
      const nFisch = st.ships.filter(s => s.home === b.id && s.type === 'fischer').length;
      if (nFisch >= 3) { b.status = 'Bereit'; b.timer = 3; return; }
    }
    let type = CFG.SHIP_KEYS.includes(sel.type) ? sel.type : 'fischer';
    const ship = CFG.SHIPS[type];
    if (!canAfford(p, ship.cost)) { b.status = 'Rohstoffe fehlen'; b.timer = 1.0; return; }
    const spot = nearestWater(b.x, b.y, 3);
    if (!spot) { b.status = 'Kein Wasser'; b.timer = 2; return; }

    pay(p, ship.cost);
    spawnShip(b.owner, spot.x, spot.y, type, b.id);
    if (sel.fromQueue) consumeQueue(b);
    b.working = true;
    b.timer = ship.build * (0.9 + Math.random() * 0.2);
  }

  function findTree(b) {
    const r = CFG.BUILDINGS.holzfaeller.terrainNeed.r;
    let best = -1, bestD = 1e9;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const nx = b.x + dx, ny = b.y + dy;
        if (!inB(nx, ny)) continue;
        const d = dx * dx + dy * dy;
        if (d > r * r || d >= bestD) continue;
        const i = idx(nx, ny);
        if (st.trees[i] > 0) { best = i; bestD = d; }
      }
    }
    return best >= 0 ? best : null;
  }

  function regrow(dt) {
    st.regrowTimer += dt;
    if (st.regrowTimer < 1) return;
    st.regrowTimer = 0;
    const n = Math.max(4, (st.w * st.h / 500) | 0);
    for (let k = 0; k < n; k++) {
      const i = (Math.random() * st.w * st.h) | 0;
      if (st.trees[i] > 0 && st.trees[i] < 3) {
        if (Math.random() < 0.12) { st.trees[i]++; st.dirty.add(i); }
      } else if (st.trees[i] === 0 && st.terrain[i] === CFG.T.GRASS && st.owner[i] === -1 && !buildingAt(i % st.w, (i / st.w) | 0)) {
        const x = i % st.w, y = (i / st.w) | 0;
        let near = false;
        for (let dy = -1; dy <= 1 && !near; dy++)
          for (let dx = -1; dx <= 1 && !near; dx++)
            if (inB(x + dx, y + dy) && st.trees[idx(x + dx, y + dy)] > 1) near = true;
        if (near && Math.random() < 0.06) { st.trees[i] = 1; st.dirty.add(i); }
      }
    }
  }

  /* ------------------------------------------------ Einheiten-Takt */

  function updateUnits(dt) {
    const temples = st.buildings.filter(b => b.alive && b.done && b.type === 'tempel');
    const moralFor = u => {
      for (const b of temples) if (b.owner === u.owner && Math.hypot(b.x + 0.5 - u.x, b.y + 0.5 - u.y) <= CFG.TEMPLE.radius) return CFG.TEMPLE.moral;
      return 1;
    };
    for (const u of st.units) {
      u.cd -= dt; u.scan -= dt;
      if (u.shot > 0) u.shot -= dt;
      u.moralT = (u.moralT || 0) - dt;
      if (u.moralT <= 0) { u.moralT = 0.7; u.moral = temples.length ? moralFor(u) : 1; }

      // Einschiffen auf einen Transporter (eigener Befehl)
      if (u.board) {
        const s = st.ships.find(x => x.id === u.board);
        if (!s || s.type !== 'transporter' || s.cargo.length >= CFG.SHIPS.transporter.capacity) { u.board = null; u.path = null; }
        else if (Math.hypot(u.x - s.x, u.y - s.y) <= 1.6) {
          u.removed = true; u.board = null; u.path = null; s.cargo.push(u);
          continue;
        } else { approach(u, s.x, s.y, dt); continue; }
      }

      // Turm besetzen (eigener Marschbefehl auf eigenen Turm)
      if (u.tgGar) {
        const tw = getBuilding(u.tgGar);
        if (!tw || (tw.garrison || 0) >= CFG.BUILDINGS[tw.type].garrisonMax) { u.tgGar = null; u.path = null; }
        else if (Math.hypot(u.x - (tw.x + 0.5), u.y - (tw.y + 0.5)) <= 1.3) {
          tw.garrison = (tw.garrison || 0) + 1;
          (tw.gtypes || (tw.gtypes = [])).push(u.type);
          u.removed = true; st.territoryDirty = true; st.dirty.add(idx(tw.x, tw.y));
          continue;
        } else { approach(u, tw.x + 0.5, tw.y + 0.5, dt); continue; }
      }

      let tgtU = u.tu ? getUnit(u.tu) : null;
      let tgtB = u.tb ? getBuilding(u.tb) : null;
      if (u.tu && !tgtU) u.tu = null;
      if (u.tb && !tgtB) u.tb = null;

      // Automatisch nahe Feinde angreifen, wenn ohne Auftrag
      if (!tgtU && !tgtB && !u.path && u.scan <= 0) {
        u.scan = 0.5;
        const siege = u.type === 'katapult';
        if (siege) {                     // Katapult bevorzugt Gebäude in Reichweite
          tgtB = acquireBuilding(u, Math.max(3, u.range));
          if (tgtB) u.tb = tgtB.id;
          else { tgtU = acquireUnit(u, u.aggro || 4); if (tgtU) u.tu = tgtU.id; }
        } else {
          tgtU = acquireUnit(u, u.aggro || 4);
          if (tgtU) u.tu = tgtU.id;
          else {
            tgtB = acquireBuilding(u, Math.max(3, u.range || 3));
            if (tgtB) u.tb = tgtB.id;
          }
        }
      }

      const mor = u.moral || 1;
      if (tgtU) { engage(u, tgtU.x, tgtU.y, dt, () => { hitUnit(tgtU, u.dmgU * mor); }); continue; }
      if (tgtB) { engage(u, tgtB.x + 0.5, tgtB.y + 0.5, dt, () => { hitBuilding(tgtB, u.dmgB * mor); }); continue; }
      if (u.path) followPath(u, dt);
    }
    st.units = st.units.filter(u => u.hp > 0 && !u.removed);
  }

  function engage(u, tx, ty, dt, hit) {
    const range = u.range || 1.1;
    const d = Math.hypot(u.x - tx, u.y - ty);
    if (d <= range) {
      u.path = null; u.aim = { x: tx, y: ty };
      if (u.cd <= 0) { u.cd = u.cool || 0.8; hit(); u.shot = 0.15; }
    } else {
      approach(u, tx, ty, dt);
    }
  }

  /* Pfad zum (ggf. bewegten) Ziel, regelmäßig auffrischen. */
  function approach(u, tx, ty, dt) {
    if (!u.path || u.repath === undefined || (u.repath -= dt) <= 0) {
      u.repath = 1.0;
      u.path = astar(Math.floor(u.x), Math.floor(u.y), Math.floor(tx), Math.floor(ty));
      u.pi = 0;
    }
    if (u.path) followPath(u, dt);
    else moveToward(u, tx, ty, dt);   // Notfall: gerader Weg
  }

  function followPath(u, dt) {
    const wp = u.path[u.pi];
    if (!wp) { u.path = null; return; }
    if (moveToward(u, wp.x, wp.y, dt)) {
      u.pi++;
      if (u.pi >= u.path.length) u.path = null;
    }
  }

  function moveToward(u, tx, ty, dt) {
    const d = Math.hypot(tx - u.x, ty - u.y);
    const step = (u.speed || 2.4) * dt;
    u.face = tx < u.x ? -1 : 1;
    if (d <= step) { u.x = tx; u.y = ty; return true; }
    u.x += (tx - u.x) / d * step;
    u.y += (ty - u.y) / d * step;
    return false;
  }

  function acquireUnit(u, r) {
    let best = null, bestD = r;
    for (const e of st.units) {
      if (e.owner === u.owner || !isEnemy(u.owner, e.owner)) continue;
      const d = Math.hypot(e.x - u.x, e.y - u.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function acquireBuilding(u, r) {
    let best = null, bestD = r;
    for (const b of st.buildings) {
      if (!b.alive || b.owner === u.owner || !isEnemy(u.owner, b.owner)) continue;
      const d = Math.hypot(b.x + 0.5 - u.x, b.y + 0.5 - u.y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  function hitUnit(t, dmg) {
    t.hp -= dmg;
  }

  function hitBuilding(b, dmg) {
    b.hp -= dmg;
    st.dirty.add(idx(b.x, b.y));
    if (b.hp <= 0) destroyBuilding(b);
  }

  /* Verteilungs-Priorität für einen Gebäudetyp setzen (und auf Bestand anwenden). */
  function setTypePrio(pid, type, prio) {
    st.players[pid].typePrio[type] = prio;
    for (const b of st.buildings) if (b.alive && b.owner === pid && b.type === type) b.prio = prio;
  }

  /* Einen Soldaten aus einem Turm ausrücken lassen. */
  function sallyGarrison(b) {
    if (!b.garrison || b.garrison <= 0) return false;
    b.garrison--;
    const type = (b.gtypes && b.gtypes.pop()) || 'lanze';
    spawnSoldier(b.owner, b.x, b.y, type);
    st.territoryDirty = true;
    st.dirty.add(idx(b.x, b.y));
    return true;
  }

  /* ------------------------------------------------ API */

  return {
    newGame, restore, update, tryBuild, placeError, demolish,
    commandUnits, countPop, maxPop, buildingAt, astar,
    isEnemy, hasTerrainNear, canAfford, tribeOf, tribeCost,
    spawnSoldier, sallyGarrison, carrierCap, carriersBusy, needsTool,
    dispatchGeologe, geologeActive, setTypePrio,
    shipAt, commandShip, boardUnits,
    get st() { return st; },
    idx, inB, walkable,
  };
})();
