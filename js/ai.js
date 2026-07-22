'use strict';

/* Computergegner: baut Wirtschaft auf, erweitert Gebiet, besetzt Türme, greift an. */
const AI = (() => {

  function newMemory() {
    return {
      think: Math.random() * 2,
      attackCd: 90 + Math.random() * 60,
      defCd: 0, garrCd: 0,
      skip: {},           // vorübergehend unbaubare Vorhaben
    };
  }

  /* Ausbaureihenfolge: [Gebäudetyp, gewünschte Anzahl].
     Werkzeug-/Kohlekette früh, damit das Werkzeug-Gate nicht blockiert. */
  const ORDER = [
    ['holzfaeller', 1], ['saegewerk', 1], ['steinbruch', 1], ['bauernhof', 1],
    ['muehle', 1], ['baeckerei', 1], ['holzfaeller', 2], ['brunnen', 1],
    ['kohlemine', 1], ['eisenmine', 1], ['schmelze', 1], ['werkzeugmacher', 1],
    ['wohnhaus', 1], ['kaserne', 1], ['speermacher', 1], ['wachposten', 1],
    ['fischer', 1], ['brauerei', 1], ['schwertschmiede', 1], ['wohnhaus', 2], ['wachturm', 1],
    ['bogenmacher', 1], ['lagerhaus', 1], ['schweinefarm', 1], ['metzgerei', 1],
    ['holzfaeller', 3], ['saegewerk', 2], ['eisenmine', 2], ['schmelze', 2],
    ['gestuet', 1], ['kaserne', 2], ['markt', 1], ['hafen', 1], ['goldmine', 1], ['goldschmiede', 1],
    ['tempel', 1], ['lazarett', 1],
    ['wachturm', 2], ['gutshaus', 1], ['werkzeugmacher', 2], ['schwertschmiede', 2],
    ['steinbruch', 2], ['bauernhof', 2], ['muehle', 2], ['baeckerei', 2], ['brunnen', 2],
    ['gutshaus', 2], ['festung', 1], ['belagerung', 1], ['wachturm', 3], ['kaserne', 3],
    ['speermacher', 2], ['goldmine', 2], ['goldschmiede', 2], ['gutshaus', 3], ['wachturm', 4],
  ];

  function update(p, dt) {
    const mem = p.ai;
    mem.attackCd -= dt;
    mem.defCd -= dt;
    mem.garrCd -= dt;
    mem.think -= dt;
    if (mem.think > 0) return;
    const st = Game.st;
    mem.think = st.diff.thinkCd + Math.random();

    setTrainTypes(p);
    defend(p, mem);
    garrison(p, mem);
    prospect(p);
    build(p, mem);
    attack(p, mem);
  }

  /* Geologen zu unerkundeten Bergen in/nahe eigenem Gebiet schicken. */
  function prospect(p) {
    if (p.geoCd > 0 || Game.geologeActive(p.id) >= CFG.GEOLOGE.maxActive) return;
    const st = Game.st;
    const hq = st.buildings.find(b => b.alive && b.owner === p.id && b.type === 'hq');
    if (!hq) return;
    // nächste noch unentdeckte Bergkachel in Reichweite des HQ suchen
    let best = null, bestD = 1e9;
    const R = 22;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const nx = hq.x + dx, ny = hq.y + dy;
        if (!Game.inB(nx, ny)) continue;
        const i = ny * st.w + nx;
        if (st.terrain[i] !== CFG.T.MOUNTAIN || st.found[i] || st.deposit[i] < 0) continue;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = { x: nx, y: ny }; }
      }
    }
    if (best) Game.dispatchGeologe(p.id, best.x, best.y);
  }

  /* ------------------------------------------------ Bauen */

  function build(p, mem) {
    const st = Game.st;
    const counts = {};
    for (const b of st.buildings) {
      if (b.alive && b.owner === p.id) counts[b.type] = (counts[b.type] || 0) + 1;
    }

    let attempts = 0;
    for (const [type, want] of ORDER) {
      if ((counts[type] || 0) >= want) continue;
      const key = type + want;
      if (mem.skip[key] && mem.skip[key] > st.time) continue;

      if (!Game.canAfford(p, Game.tribeCost(p.id, type))) return;   // sparen, Reihenfolge einhalten

      const spot = findSpot(p, type);
      if (!spot) {
        mem.skip[key] = st.time + 45;             // später erneut versuchen
        if (++attempts >= 3) return;
        continue;
      }
      Game.tryBuild(p.id, type, spot.x, spot.y);
      return;                                     // ein Bau pro Denk-Takt
    }
  }

  function findSpot(p, type) {
    const st = Game.st;
    const def = CFG.BUILDINGS[type];
    const hq = st.buildings.find(b => b.alive && b.owner === p.id && b.type === 'hq');
    if (!hq) return null;

    const enemyHq = nearestEnemyBuilding(p, hq.x, hq.y, 'hq');
    let best = null, bestScore = -1e9;

    for (let y = 0; y < st.h; y++) {
      for (let x = 0; x < st.w; x++) {
        const i = y * st.w + x;
        if (st.owner[i] !== p.id) continue;
        if (st.terrain[i] !== CFG.T.GRASS || st.trees[i] > 0) continue;
        if (Game.buildingAt(x, y)) continue;
        if (def.terrainNeed && !Game.hasTerrainNear(x, y, def.terrainNeed)) continue;

        let score;
        if (def.military) {
          // Am Gebietsrand, in Richtung Feind bzw. unbeanspruchtes Land
          if (!isFrontier(x, y, p.id)) continue;
          if (tooCloseToOwnTower(p, x, y)) continue;
          score = enemyHq
            ? -Math.hypot(x - enemyHq.x, y - enemyHq.y)   // auf den Feind zu
            : Math.hypot(x - hq.x, y - hq.y);             // sonst vom HQ weg
        } else {
          // Wirtschaftsgebäude: nah am Hauptquartier, nicht direkt daneben
          const d = Math.hypot(x - hq.x, y - hq.y);
          if (d < 1.5) continue;
          score = -d + Math.random() * 0.5;
        }
        if (score > bestScore) { bestScore = score; best = { x, y }; }
      }
    }
    return best;
  }

  function isFrontier(x, y, pid) {
    const st = Game.st;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = x + dx, ny = y + dy;
        if (Game.inB(nx, ny) && st.owner[ny * st.w + nx] === -1) return true;
      }
    }
    return false;
  }

  function tooCloseToOwnTower(p, x, y) {
    return Game.st.buildings.some(b =>
      b.alive && b.owner === p.id && CFG.BUILDINGS[b.type].military &&
      Math.hypot(b.x - x, b.y - y) < 5);
  }

  function nearestEnemyBuilding(p, x, y, onlyType) {
    let best = null, bestD = 1e9;
    for (const b of Game.st.buildings) {
      if (!b.alive || b.owner === p.id || !Game.isEnemy(p.id, b.owner)) continue;
      if (onlyType && b.type !== onlyType) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  /* ------------------------------------------------ Soldaten / Türme */

  /* Kaserne(n) auf den Typ stellen, für den am meisten Waffen da sind. */
  function setTrainTypes(p) {
    let bestType = 'lanze', bestStock = -1;
    for (const t of CFG.SOLDIER_KEYS) {
      const cost = CFG.SOLDIERS[t].cost;
      const stock = Math.min(...Object.entries(cost).map(([r, n]) => (p.res[r] || 0) / n));
      if (stock > bestStock) { bestStock = stock; bestType = t; }
    }
    for (const b of Game.st.buildings) {
      if (b.alive && b.owner === p.id && b.type === 'kaserne') b.trainType = bestType;
    }
  }

  /* Freie Soldaten in unbesetzte eigene Türme schicken (Gebiet erst dann beansprucht). */
  function garrison(p, mem) {
    if (mem.garrCd > 0) return;
    const st = Game.st;
    const tower = st.buildings.find(b => b.alive && b.done && b.owner === p.id &&
      CFG.BUILDINGS[b.type].military && (b.garrison || 0) < CFG.BUILDINGS[b.type].garrisonMax);
    if (!tower) return;
    const idle = myUnits(p).filter(u => !u.tb && !u.tu && !u.tgGar);
    if (!idle.length) return;
    // nächsten freien Soldaten schicken
    idle.sort((a, b) => Math.hypot(a.x - tower.x, a.y - tower.y) - Math.hypot(b.x - tower.x, b.y - tower.y));
    Game.commandUnits([idle[0]], tower.x + 0.5, tower.y + 0.5);
    mem.garrCd = 4;
  }

  /* ------------------------------------------------ Kämpfen */

  function myUnits(p) {
    return Game.st.units.filter(u => u.owner === p.id);
  }

  function defend(p, mem) {
    if (mem.defCd > 0) return;
    const st = Game.st;
    const intruder = st.units.find(u =>
      u.owner !== p.id && Game.isEnemy(p.id, u.owner) &&
      Game.inB(Math.floor(u.x), Math.floor(u.y)) &&
      st.owner[Math.floor(u.y) * st.w + Math.floor(u.x)] === p.id);
    if (!intruder) return;
    const troops = myUnits(p).filter(u => !u.tb && !u.tu && !u.tgGar);
    if (!troops.length) return;
    Game.commandUnits(troops, intruder.x, intruder.y);
    mem.defCd = 8;
  }

  function attack(p, mem) {
    if (mem.attackCd > 0) return;
    const st = Game.st;
    const troops = myUnits(p).filter(u => !u.tgGar);
    if (troops.length < st.diff.attackN) return;

    const hq = st.buildings.find(b => b.alive && b.owner === p.id && b.type === 'hq');
    if (!hq) return;
    // Bevorzugt Grenztürme, sonst das nächste feindliche Gebäude
    let target = null, bestD = 1e9;
    for (const b of st.buildings) {
      if (!b.alive || b.owner === p.id || !Game.isEnemy(p.id, b.owner)) continue;
      const mil = CFG.BUILDINGS[b.type].military ? 0.6 : 1;   // Türme leicht bevorzugen
      const d = Math.hypot(b.x - hq.x, b.y - hq.y) * mil;
      if (d < bestD) { bestD = d; target = b; }
    }
    if (!target) return;
    Game.commandUnits(troops, target.x + 0.5, target.y + 0.5);
    mem.attackCd = st.diff.attackCd * (0.8 + Math.random() * 0.4);
  }

  return { newMemory, update };
})();
