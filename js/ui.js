'use strict';

/* Benutzeroberfläche: Setup-Bildschirm, HUD, Touch-Eingabe. */
const UI = (() => {

  const $ = id => document.getElementById(id);

  /* ------------------------------------------------ Setup-Zustand */

  const setup = {
    mapId: MapGen.PRESETS[0].id,
    seed: (Math.random() * 1e9) | 0,
    count: 3,
    teams: [1, 2, 3, 4],
    tribes: ['zufall', 'zufall', 'zufall', 'zufall'],
    difficulty: 'mittel',
  };

  let placing = null;          // Gebäudetyp im Platzierungsmodus
  let selected = [];           // ausgewählte Soldaten
  let geoMode = false;         // Geologe-Zielmodus
  let infoBuilding = null;
  let hudTimer = 0;
  let toastTimer = 0;
  let endShown = false;

  /* ------------------------------------------------ Setup-Bildschirm */

  function initSetup() {
    const list = $('map-list');
    for (const m of MapGen.PRESETS) {
      const b = document.createElement('button');
      b.innerHTML = `${m.name}<small>${m.size}×${m.size} Felder</small>`;
      b.dataset.id = m.id;
      if (m.id === setup.mapId) b.classList.add('on');
      b.onclick = () => {
        setup.mapId = m.id;
        list.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        refreshPreview();
      };
      list.appendChild(b);
    }

    $('btn-reroll').onclick = () => {
      setup.seed = (Math.random() * 1e9) | 0;
      refreshPreview();
    };

    $('seg-count').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        setup.count = +b.dataset.n;
        $('seg-count').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
        buildPlayerRows();
        refreshPreview();
      };
    });

    $('seg-diff').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        setup.difficulty = b.dataset.d;
        $('seg-diff').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b));
      };
    });

    $('btn-start').onclick = startGame;

    buildPlayerRows();
    refreshPreview();
    renderSaveList();
  }

  function buildPlayerRows() {
    // Teams auf gültigen Bereich stutzen (nach Wechsel der Spielerzahl)
    for (let i = 0; i < 4; i++) if (setup.teams[i] > setup.count) setup.teams[i] = i + 1;
    const wrap = $('player-rows');
    wrap.innerHTML = '';
    for (let i = 0; i < setup.count; i++) {
      const row = document.createElement('div');
      row.className = 'player-row';
      const who = i === 0 ? 'Du' : `Computer (${CFG.PLAYER_NAMES[i]})`;
      row.innerHTML = `
        <div class="player-row-top">
          <span class="pdot" style="background:${CFG.COLORS[i]}"></span>
          <span class="pname">${who}</span>
          <span class="team-seg" data-p="${i}"></span>
        </div>
        <div class="tribe-seg" data-p="${i}"></div>`;
      const seg = row.querySelector('.team-seg');
      for (let t = 1; t <= setup.count; t++) {
        const tb = document.createElement('button');
        tb.textContent = 'T' + t;
        if (setup.teams[i] === t) tb.classList.add('on');
        tb.onclick = () => {
          setup.teams[i] = t;
          seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === tb));
          validateTeams();
        };
        seg.appendChild(tb);
      }
      const tseg = row.querySelector('.tribe-seg');
      const tribeChoices = ['zufall', ...CFG.TRIBE_KEYS];
      for (const tk of tribeChoices) {
        const tb = document.createElement('button');
        const info = tk === 'zufall' ? { icon: '🎲', name: 'Zufall' } : CFG.TRIBES[tk];
        tb.innerHTML = `${info.icon}<small>${info.name}</small>`;
        tb.title = tk === 'zufall' ? 'Zufälliges Volk' : CFG.TRIBES[tk].desc;
        if (setup.tribes[i] === tk) tb.classList.add('on');
        tb.onclick = () => {
          setup.tribes[i] = tk;
          tseg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === tb));
        };
        tseg.appendChild(tb);
      }
      wrap.appendChild(row);
    }
    validateTeams();
  }

  function validateTeams() {
    const teams = new Set(setup.teams.slice(0, setup.count));
    const bad = teams.size < 2;
    $('team-warn').classList.toggle('hidden', !bad);
    $('btn-start').disabled = bad;
    return !bad;
  }

  function refreshPreview() {
    const map = MapGen.generate(setup.mapId, setup.seed, setup.count);
    MapGen.drawPreview($('map-preview'), map);
    $('map-desc').textContent = map.preset.desc;
  }

  /* ------------------------------------------------ Spielstart / -ende */

  function startGame() {
    if (!validateTeams()) return;
    // Völker auflösen: „Zufall" → konkretes Volk (bevorzugt noch nicht vergebene)
    const taken = setup.tribes.slice(0, setup.count).filter(t => t !== 'zufall');
    const players = [];
    for (let i = 0; i < setup.count; i++) {
      let tribe = setup.tribes[i];
      if (tribe === 'zufall') {
        const free = CFG.TRIBE_KEYS.filter(k => !taken.includes(k));
        const pool = free.length ? free : CFG.TRIBE_KEYS;
        tribe = pool[(Math.random() * pool.length) | 0];
        taken.push(tribe);
      }
      players.push({ human: i === 0, team: setup.teams[i], tribe });
    }
    Game.newGame({
      mapId: setup.mapId, seed: setup.seed,
      players, difficulty: setup.difficulty,
    });
    enterGame();
  }

  function loadGame(slot) {
    const data = SaveGame.load(slot);
    if (!data) { renderSaveList(); return; }
    if (data.incompatible || !data.state) {
      toast('Spielstand stammt aus einer älteren Version und ist nicht mehr kompatibel');
      return;
    }
    Game.restore(data.state);
    enterGame();
    toast('💾 Spielstand geladen');
  }

  /* Gemeinsamer Einstieg für neues und geladenes Spiel. */
  function enterGame() {
    placing = null; selected = []; infoBuilding = null; endShown = false;
    Main.speed = 1;
    Main.resetAutosave();
    $('btn-speed').textContent = '▶ 1×';
    $('setup').classList.add('hidden');
    $('game').classList.remove('hidden');
    $('endscreen').classList.add('hidden');
    $('gamemenu').classList.add('hidden');
    hideBanner(); hideInfo();
    Render.startGame();
    buildResBar();
    buildBuildBar();
    const tribe = CFG.TRIBES[Game.st.players[0].tribe];
    $('tribe-ind').textContent = tribe ? tribe.icon : '';
    $('tribe-ind').title = tribe ? `${tribe.name} – ${tribe.desc}` : '';
    updateHUD(true);
    Main.running = true;
  }

  function quitToMenu() {
    if (Game.st && !Game.st.over) SaveGame.save('auto');   // nichts verlieren
    Main.running = false;
    $('game').classList.add('hidden');
    $('setup').classList.remove('hidden');
    setup.seed = (Math.random() * 1e9) | 0;   // nächste Runde: frische Karte
    refreshPreview();
    renderSaveList();
  }

  /* ------------------------------------------------ Spielstände */

  function slotLabel(slot) {
    return slot === 'auto' ? 'Autosave' : 'Slot ' + slot;
  }

  function slotMetaText(m) {
    return `${m.map} · ${m.minutes} min · ${SaveGame.fmtDate(m.date)}<br><small>${m.players}</small>`;
  }

  /* Liste im Startbildschirm: Laden und Löschen. */
  function renderSaveList() {
    const wrap = $('save-list');
    wrap.innerHTML = '';
    let any = false;
    for (const slot of SaveGame.SLOTS) {
      const m = SaveGame.info(slot);
      if (!m) continue;
      any = true;
      const row = document.createElement('div');
      row.className = 'save-slot';
      const warn = m.incompatible ? '<br><small class="warn">⚠️ ältere Version – nicht ladbar</small>' : '';
      row.innerHTML = `<div class="save-info"><b>${slotLabel(slot)}</b><br>${slotMetaText(m)}${warn}</div>`;
      const load = document.createElement('button');
      load.className = 'btn small';
      load.textContent = '▶ Laden';
      load.disabled = !!m.incompatible;
      load.onclick = () => loadGame(slot);
      const del = document.createElement('button');
      del.className = 'btn small danger';
      del.textContent = '🗑';
      del.title = 'Spielstand löschen';
      del.onclick = () => { SaveGame.remove(slot); renderSaveList(); };
      row.appendChild(load);
      row.appendChild(del);
      wrap.appendChild(row);
    }
    if (!any) wrap.innerHTML = '<p class="hint">Noch keine Spielstände vorhanden. Im Spiel über das Pausemenü (☰) speichern – zusätzlich wird automatisch gesichert.</p>';
  }

  /* Slots im Pausemenü: antippen = speichern/überschreiben. */
  function renderSaveSlots() {
    const wrap = $('save-slots');
    wrap.innerHTML = '';
    for (const slot of ['1', '2', '3']) {
      const m = SaveGame.info(slot);
      const row = document.createElement('div');
      row.className = 'save-slot';
      row.innerHTML = `<div class="save-info"><b>${slotLabel(slot)}</b><br>${m ? slotMetaText(m) : '<small>– leer –</small>'}</div>`;
      const save = document.createElement('button');
      save.className = 'btn small';
      save.textContent = '💾 Speichern';
      save.onclick = () => {
        if (SaveGame.save(slot)) { toast(`💾 In ${slotLabel(slot)} gespeichert`); renderSaveSlots(); }
        else toast('Speichern fehlgeschlagen');
      };
      row.appendChild(save);
      wrap.appendChild(row);
    }
  }

  function refreshAutosaveSeg() {
    const min = SaveGame.getAutosaveMin();
    $('seg-autosave').querySelectorAll('button').forEach(b =>
      b.classList.toggle('on', +b.dataset.m === min));
  }

  /* ------------------------------------------------ HUD */

  function buildResBar() {
    const bar = $('resbar');
    bar.innerHTML = '';
    CFG.RES_GROUPS.forEach((grp, gi) => {
      if (gi > 0) {
        const div = document.createElement('span');
        div.className = 'res-div';
        bar.appendChild(div);
      }
      for (const r of CFG.RES) {
        if (CFG.RES_INFO[r].grp !== grp.id) continue;
        const el = document.createElement('span');
        el.className = 'res-item';
        el.id = 'res-' + r;
        el.title = CFG.RES_INFO[r].name + ' (' + grp.name + ')';
        bar.appendChild(el);
      }
    });
  }

  function buildBuildBar() {
    const bar = $('buildbar');
    bar.innerHTML = '';
    for (const type of CFG.BUILD_ORDER) {
      const def = CFG.BUILDINGS[type];
      const b = document.createElement('button');
      b.className = 'bbtn';
      b.id = 'bb-' + type;
      const cost = Object.entries(Game.tribeCost(0, type))
        .filter(([, n]) => n > 0)
        .map(([r, n]) => `${n}${CFG.RES_INFO[r].icon}`).join(' ');
      b.innerHTML = `<span class="bico">${def.icon}</span>${def.name}<span class="bcost">${cost}</span>`;
      b.onclick = () => togglePlacing(type);
      bar.appendChild(b);
    }
  }

  function togglePlacing(type) {
    if (placing === type) { cancelModes(); return; }
    const p = Game.st.players[0];
    if (!Game.canAfford(p, Game.tribeCost(0, type))) {
      toast('Zu wenig Rohstoffe für ' + CFG.BUILDINGS[type].name);
      return;
    }
    placing = type;
    selected = [];
    hideInfo();
    document.querySelectorAll('.bbtn').forEach(x => x.classList.toggle('on', x.id === 'bb-' + type));
    showBanner(`${CFG.BUILDINGS[type].icon} ${CFG.BUILDINGS[type].name}: Tippe auf ein freies Feld in deinem Gebiet`);
  }

  function cancelModes() {
    placing = null;
    selected = [];
    geoMode = false;
    document.querySelectorAll('.bbtn').forEach(x => x.classList.remove('on'));
    $('btn-army').classList.remove('on');
    $('btn-geologe').classList.remove('on');
    hideBanner();
  }

  function showBanner(text) {
    const b = $('banner');
    b.innerHTML = '';
    b.appendChild(document.createTextNode(text));
    const x = document.createElement('button');
    x.textContent = 'Abbrechen';
    x.onclick = cancelModes;
    b.appendChild(x);
    b.classList.remove('hidden');
  }

  function hideBanner() { $('banner').classList.add('hidden'); }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.classList.remove('hidden');
    toastTimer = 2.6;
  }

  function updateHUD(force) {
    const st = Game.st;
    if (!st) return;
    hudTimer -= 1 / 60;
    if (!force && hudTimer > 0) return;
    hudTimer = 0.25;

    const p = st.players[0];
    for (const r of CFG.RES) {
      const el = $('res-' + r);
      const v = p.res[r] || 0;
      el.innerHTML = `${CFG.RES_INFO[r].icon}<b>${v}</b>`;
      el.classList.toggle('zero', v === 0);
    }
    $('pop-now').textContent = Game.countPop(0);
    $('pop-max').textContent = Game.maxPop(0);
    $('army-count').textContent = st.units.filter(u => u.owner === 0).length;
    const cb = $('carrierbar');
    if (cb) cb.innerHTML = `🧺 ${Game.carriersBusy(0)}/${Game.carrierCap(0)}`;
    const dn = $('daynight');
    if (dn) dn.textContent = Render.night > 0.6 ? '🌙' : Render.night > 0.3 ? '🌆' : '☀️';
    $('btn-geologe').classList.toggle('cant', p.geoCd > 0);

    // Baubare Gebäude hervorheben
    for (const type of CFG.BUILD_ORDER) {
      $('bb-' + type).classList.toggle('cant', !Game.canAfford(p, Game.tribeCost(0, type)));
    }

    selected = selected.filter(u => u.hp > 0);

    if (st.toast) { toast(st.toast.text); st.toast = null; }
    if (toastTimer > 0) {
      toastTimer -= 0.25;
      if (toastTimer <= 0) $('toast').classList.add('hidden');
    }

    if (infoBuilding) refreshInfo();

    if (st.over && !endShown) {
      endShown = true;
      showEnd(st.over.win);
    }
  }

  function showEnd(win) {
    $('end-title').textContent = win ? '🎉 Sieg!' : '💀 Niederlage';
    $('end-text').textContent = win
      ? 'Alle feindlichen Hauptquartiere sind gefallen. Dein Volk jubelt dir zu!'
      : 'Dein Hauptquartier wurde zerstört. Beim nächsten Mal klappt es bestimmt!';
    $('endscreen').classList.remove('hidden');
  }

  /* ------------------------------------------------ Gebäude-Info */

  let lastInfoId = null;

  function showInfo(b) {
    infoBuilding = b;
    lastInfoId = null;              // erzwingt vollen Neuaufbau
    refreshInfo();
    $('btn-demolish').style.display = (b.owner === 0 && b.type !== 'hq') ? '' : 'none';
    $('infopanel').classList.remove('hidden');
  }

  function refreshInfo() {
    const b = infoBuilding;
    if (!b || !b.alive) { hideInfo(); return; }
    if (b.id !== lastInfoId) { buildInfoBody(b); lastInfoId = b.id; }
    updateInfoDyn(b);
  }

  /* Statischer Teil des Info-Panels inkl. interaktiver Bedienelemente. */
  function buildInfoBody(b) {
    const def = CFG.BUILDINGS[b.type];
    const p = Game.st.players[b.owner];
    const tribe = CFG.TRIBES[p.tribe];
    $('info-title').textContent = `${def.icon} ${def.name} (${p.name}${tribe ? ' – ' + tribe.name : ''})`;
    const body = $('info-body');
    body.innerHTML = `<div class="info-desc">${def.desc}</div><div id="info-dyn"></div>`;

    if (b.owner !== 0 || !b.done) return;   // nur eigene, fertige Gebäude steuerbar

    // Werkzeugmacher: Werkzeugtyp wählen (Auto oder fest)
    if (def.makesTool) {
      body.appendChild(makeChooser('Werkzeug',
        [{ k: null, icon: '🎲', name: 'Auto' }].concat(CFG.TOOL_KEYS.map(t => ({ k: t, icon: CFG.RES_INFO[t].icon, name: CFG.RES_INFO[t].name }))),
        () => b.toolType, v => { b.toolType = v; }));
    }
    // Kaserne: Soldatentyp wählen
    if (def.trains) {
      body.appendChild(makeChooser('Ausbildung',
        CFG.SOLDIER_KEYS.map(t => ({ k: t, icon: CFG.SOLDIERS[t].icon, name: CFG.SOLDIERS[t].short })),
        () => b.trainType || 'lanze', v => { b.trainType = v; }));
    }
    // Turm: Besatzung ausrücken lassen
    if (def.military) {
      const btn = document.createElement('button');
      btn.className = 'btn small';
      btn.id = 'info-sally';
      btn.textContent = '⚔️ Soldat ausrücken';
      btn.onclick = () => { if (Game.sallyGarrison(b)) updateInfoDyn(b); };
      body.appendChild(btn);
    }
  }

  /* Kleiner Icon-Umschalter. get() liefert aktuellen Wert, set(v) übernimmt. */
  function makeChooser(label, opts, get, set) {
    const wrap = document.createElement('div');
    wrap.className = 'info-choose';
    wrap.innerHTML = `<span class="info-lbl">${label}:</span>`;
    const seg = document.createElement('span');
    seg.className = 'chooser';
    for (const o of opts) {
      const btn = document.createElement('button');
      btn.innerHTML = o.icon;
      btn.title = o.name;
      if (get() === o.k) btn.classList.add('on');
      btn.onclick = () => {
        set(o.k);
        seg.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === btn));
      };
      seg.appendChild(btn);
    }
    wrap.appendChild(seg);
    return wrap;
  }

  /* Dynamischer Teil: HP, Status, Besatzung, Ausgangslager. */
  function updateInfoDyn(b) {
    const el = $('info-dyn');
    if (!el) return;
    const def = CFG.BUILDINGS[b.type];
    let s = '';
    if (!b.done) {
      s = `🏗️ Im Bau – ${Math.round(b.progress * 100)} %`;
    } else {
      s = `❤️ ${Math.ceil(b.hp)}/${b.maxHp}`;
      if (def.military) {
        s += `<br>🛡️ Besatzung ${b.garrison || 0}/${def.garrisonMax}`;
        if ((b.garrison || 0) === 0) s += ' – <b>unbesetzt</b> (kein Gebiet)';
      }
      if (b.status) s += `<br>💤 ${b.status}`;
      else if (def.interval || def.trains) s += '<br>✅ Arbeitet';
      const out = b.out && Object.entries(b.out).filter(([, n]) => n > 0);
      if (out && out.length) {
        s += '<br>📦 ' + out.map(([r, n]) => `${n}${CFG.RES_INFO[r].icon}`).join(' ') +
             (b.hasCarrier ? ' 🧺' : '');
      }
    }
    el.innerHTML = s;
    const sally = $('info-sally');
    if (sally) sally.style.display = (b.garrison || 0) > 0 ? '' : 'none';
  }

  function hideInfo() {
    infoBuilding = null;
    lastInfoId = null;
    $('infopanel').classList.add('hidden');
  }

  /* ------------------------------------------------ Spiel-Eingabe */

  function initGameUI() {
    $('btn-menu').onclick = () => {
      Main.paused = true;
      renderSaveSlots();
      refreshAutosaveSeg();
      $('gamemenu').classList.remove('hidden');
    };
    $('seg-autosave').querySelectorAll('button').forEach(b => {
      b.onclick = () => {
        SaveGame.setAutosaveMin(+b.dataset.m);
        Main.resetAutosave();
        refreshAutosaveSeg();
      };
    });
    $('btn-resume').onclick = () => {
      Main.paused = false;
      $('gamemenu').classList.add('hidden');
    };
    $('btn-quit').onclick = () => {
      Main.paused = false;
      quitToMenu();
    };
    $('btn-end-menu').onclick = quitToMenu;
    $('btn-info-close').onclick = hideInfo;
    $('btn-demolish').onclick = () => {
      if (infoBuilding && infoBuilding.owner === 0) {
        Game.demolish(infoBuilding);
        hideInfo();
      }
    };

    $('btn-speed').onclick = () => {
      Main.speed = Main.speed === 1 ? 2 : Main.speed === 2 ? 3 : 1;
      $('btn-speed').textContent = '▶ ' + Main.speed + '×';
    };

    $('btn-army').onclick = () => {
      const mine = Game.st.units.filter(u => u.owner === 0);
      if (!mine.length) { toast('Du hast noch keine Soldaten. Baue eine Kaserne!'); return; }
      cancelModes();
      selected = mine.slice();
      $('btn-army').classList.add('on');
      showBanner(`⚔️ ${mine.length} Soldaten ausgewählt – tippe auf ein Ziel`);
    };

    $('btn-geologe').onclick = () => {
      if (geoMode) { cancelModes(); return; }
      cancelModes();
      geoMode = true;
      $('btn-geologe').classList.add('on');
      showBanner('🔍 Geologe: tippe auf ein Berggebiet, um Vorkommen zu suchen');
    };

    initPointer();
    initMinimap();
  }

  /* Zeigersteuerung: Ziehen = Schwenken, Kneifen = Zoomen, Tippen = Aktion. */
  function initPointer() {
    const canvas = Render.canvas;
    const ptrs = new Map();
    let tapStart = null;
    let pinch = null;

    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (ptrs.size === 1) {
        tapStart = { x: e.clientX, y: e.clientY, t: performance.now() };
      } else if (ptrs.size === 2) {
        tapStart = null;
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: Render.cam.z };
      }
    });

    canvas.addEventListener('pointermove', e => {
      const prev = ptrs.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (ptrs.size === 1) {
        Render.cam.x -= dx / Render.cam.z;
        Render.cam.y -= dy / Render.cam.z;
        if (tapStart && Math.hypot(e.clientX - tapStart.x, e.clientY - tapStart.y) > 12) tapStart = null;
      } else if (ptrs.size === 2 && pinch) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        Render.cam.z = pinch.z * (d / pinch.d);
      }
    });

    const up = e => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (tapStart && performance.now() - tapStart.t < 400) {
        handleTap(tapStart.x, tapStart.y);
      }
      tapStart = null;
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', e => { ptrs.delete(e.pointerId); pinch = null; tapStart = null; });

    // Mausrad-Zoom (Desktop-Test)
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      Render.cam.z *= e.deltaY < 0 ? 1.1 : 0.9;
    }, { passive: false });
  }

  function handleTap(sx, sy) {
    if (!Main.running || Main.paused || Game.st.over) return;
    const w = Render.screenToWorld(sx, sy);
    const tx = Math.floor(w.x / CFG.TS), ty = Math.floor(w.y / CFG.TS);

    if (geoMode) {
      const err = Game.dispatchGeologe(0, tx, ty);
      if (err) { toast(err); return; }
      toast('🔍 Geologe unterwegs zum Berg');
      cancelModes();
      return;
    }

    if (placing) {
      const err = Game.tryBuild(0, placing, tx, ty);
      if (err) { toast(err); return; }
      cancelModes();
      updateHUD(true);
      return;
    }

    if (selected.length) {
      const res = Game.commandUnits(selected, w.x / CFG.TS, w.y / CFG.TS);
      if (res && res.garrisoned) toast('🛡️ Soldaten besetzen den Turm');
      cancelModes();
      return;
    }

    // Auswahl: Gebäude oder eigene Soldaten in der Nähe
    const b = Game.buildingAt(tx, ty);
    if (b) { showInfo(b); return; }

    const wx = w.x / CFG.TS, wy = w.y / CFG.TS;
    const squad = Game.st.units.filter(u =>
      u.owner === 0 && Math.hypot(u.x - wx, u.y - wy) < 2.2);
    if (squad.length) {
      selected = squad;
      $('btn-army').classList.add('on');
      showBanner(`⚔️ ${squad.length} Soldaten ausgewählt – tippe auf ein Ziel`);
      return;
    }

    hideInfo();
  }

  function initMinimap() {
    const mini = document.getElementById('minimap');
    const jump = e => {
      const r = mini.getBoundingClientRect();
      const p = Render.miniToWorld(
        (e.clientX - r.left) * (mini.width / r.width),
        (e.clientY - r.top) * (mini.height / r.height));
      Render.cam.x = p.x; Render.cam.y = p.y;
    };
    mini.addEventListener('pointerdown', jump);
    mini.addEventListener('pointermove', e => { if (e.buttons) jump(e); });
  }

  return {
    initSetup, initGameUI, updateHUD, toast,
    get selected() { return selected; },
  };
})();
