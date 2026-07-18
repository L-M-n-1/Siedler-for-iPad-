'use strict';

/* Globale Spielkonfiguration: Gelände, Waren, Gebäude, Schwierigkeit. */
const CFG = {
  TS: 32,                       // Kachelgröße in Pixeln (Weltkoordinaten)
  T: { GRASS: 0, WATER: 1, MOUNTAIN: 2, SAND: 3 },

  RES: ['holz', 'bretter', 'stein', 'nahrung', 'getreide', 'mehl', 'erz', 'eisen', 'waffen'],
  RES_INFO: {
    holz:     { name: 'Holz',     icon: '🌲' },
    bretter:  { name: 'Bretter',  icon: '🪵' },
    stein:    { name: 'Stein',    icon: '🪨' },
    nahrung:  { name: 'Nahrung',  icon: '🍖' },
    getreide: { name: 'Getreide', icon: '🌾' },
    mehl:     { name: 'Mehl',     icon: '🧂' },
    erz:      { name: 'Eisenerz', icon: '⛏️' },
    eisen:    { name: 'Eisen',    icon: '🔩' },
    waffen:   { name: 'Waffen',   icon: '⚔️' },
  },

  START_RES: { holz: 12, bretter: 14, stein: 10, nahrung: 8, getreide: 0, mehl: 0, erz: 0, eisen: 0, waffen: 0 },
  POP_BASE: 6,                  // Wohnraum durch das Hauptquartier

  COLORS:       ['#3f8ef3', '#e04343', '#3dbb5a', '#e0b23a'],
  COLORS_DARK:  ['#2a5da0', '#8f2c2c', '#27793a', '#94762a'],
  PLAYER_NAMES: ['Blau', 'Rot', 'Grün', 'Gelb'],

  /* Völker: Baustil (Wand-/Dachfarbe, Dachform) und Spielboni.
     bonus-Felder (alle optional):
       buildTime   – Faktor auf Bauzeit (kleiner = schneller)
       soldier     – Faktor auf Soldaten-HP und -Schaden
       buildingHp  – Faktor auf Gebäude-HP
       interval    – { Gebäudetyp: Faktor } auf Produktionstakt
       cost        – { Gebäudetyp: { Ware: Abzug } } Baukosten-Rabatt
       claim       – { Gebäudetyp: +Radius } Gebietsradius-Bonus */
  TRIBES: {
    roemer:   { name: 'Römer',    icon: '🏛️', desc: 'Baumeister: −15 % Bauzeit',
                style: { wall: '#e3d9c6', roof: '#b04a38', form: 'walm' },
                bonus: { buildTime: 0.85 } },
    wikinger: { name: 'Wikinger', icon: '🐺', desc: 'Krieger: Soldaten +20 % Stärke',
                style: { wall: '#8a6f4d', roof: '#4e5d3a', form: 'sattel' },
                bonus: { soldier: 1.2 } },
    maya:     { name: 'Maya',     icon: '🌽', desc: 'Bauern: Landwirtschaft 20 % schneller',
                style: { wall: '#c9b28a', roof: '#7d8a5a', form: 'stufen' },
                bonus: { interval: { bauernhof: 0.8, muehle: 0.8, baeckerei: 0.8 } } },
    trojaner: { name: 'Trojaner', icon: '🐴', desc: 'Verteidiger: Gebäude +25 % Lebenspunkte',
                style: { wall: '#b8b3a6', roof: '#6d7b8a', form: 'zinnen' },
                bonus: { buildingHp: 1.25 } },
    aegypter: { name: 'Ägypter',  icon: '🐪', desc: 'Steinmetze: Steinbruch 25 % schneller, Wachturm billiger',
                style: { wall: '#dbc48f', roof: '#c8a44e', form: 'flach' },
                bonus: { interval: { steinbruch: 0.75 }, cost: { wachturm: { stein: 1 } } } },
    chinesen: { name: 'Chinesen', icon: '🏮', desc: 'Ausbilder: Kaserne 25 % schneller',
                style: { wall: '#a63c32', roof: '#3d5a45', form: 'pagode' },
                bonus: { interval: { kaserne: 0.75 } } },
    nubier:   { name: 'Nubier',   icon: '🪘', desc: 'Siedler: Wachtürme +1 Radius, Wohnhaus billiger',
                style: { wall: '#c77f4f', roof: '#8a5a33', form: 'kuppel' },
                bonus: { claim: { wachturm: 1 }, cost: { wohnhaus: { bretter: 1 } } } },
  },
  TRIBE_KEYS: ['roemer', 'wikinger', 'maya', 'trojaner', 'aegypter', 'chinesen', 'nubier'],

  /* Gebäude. terrainNeed: {t, r} = Geländeart im Radius r nötig.
     input/output: Warenumsatz je Produktionstakt (interval Sekunden). */
  BUILDINGS: {
    hq:          { name: 'Hauptquartier', icon: '🏰', hp: 600, cost: {}, buildTime: 0, claim: 9, menu: false,
                   desc: 'Zentrum deines Reiches. Verlierst du es, bist du besiegt!' },
    holzfaeller: { name: 'Holzfäller', icon: '🪓', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 5, output: { holz: 1 }, terrainNeed: { trees: true, r: 4 },
                   desc: 'Fällt Bäume im Umkreis und liefert Holz. Bäume wachsen langsam nach.' },
    saegewerk:   { name: 'Sägewerk', icon: '🪚', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 5, input: { holz: 1 }, output: { bretter: 1 },
                   desc: 'Sägt Holz zu Brettern – dem wichtigsten Baumaterial.' },
    steinbruch:  { name: 'Steinbruch', icon: '🪨', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 7, output: { stein: 1 }, terrainNeed: { t: 2, r: 4 },
                   desc: 'Bricht Steine aus nahen Bergen.' },
    fischer:     { name: 'Fischerhütte', icon: '🎣', hp: 150, cost: { bretter: 2 }, buildTime: 8,
                   interval: 7, output: { nahrung: 1 }, terrainNeed: { t: 1, r: 3 },
                   desc: 'Fängt Fische – braucht Wasser in der Nähe.' },
    bauernhof:   { name: 'Bauernhof', icon: '🌾', hp: 150, cost: { bretter: 3 }, buildTime: 12,
                   interval: 8, output: { getreide: 1 },
                   desc: 'Baut Getreide auf den umliegenden Feldern an.' },
    muehle:      { name: 'Mühle', icon: '⚙️', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 5, input: { getreide: 1 }, output: { mehl: 1 },
                   desc: 'Mahlt Getreide zu Mehl.' },
    baeckerei:   { name: 'Bäckerei', icon: '🍞', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 10,
                   interval: 6, input: { mehl: 1 }, output: { nahrung: 2 },
                   desc: 'Backt aus Mehl nahrhaftes Brot (2 Nahrung).' },
    eisenmine:   { name: 'Eisenmine', icon: '⛏️', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 12,
                   interval: 8, input: { nahrung: 1 }, output: { erz: 1 }, terrainNeed: { t: 2, r: 2 },
                   desc: 'Fördert Eisenerz am Berg. Die Bergleute brauchen Nahrung.' },
    schmelze:    { name: 'Eisenschmelze', icon: '🔥', hp: 150, cost: { bretter: 2, stein: 3 }, buildTime: 12,
                   interval: 8, input: { erz: 1, holz: 1 }, output: { eisen: 1 },
                   desc: 'Verhüttet Eisenerz mit Holz zu Eisen.' },
    schmiede:    { name: 'Waffenschmiede', icon: '🔨', hp: 150, cost: { bretter: 2, stein: 2 }, buildTime: 12,
                   interval: 9, input: { eisen: 1, holz: 1 }, output: { waffen: 1 },
                   desc: 'Schmiedet Waffen für deine Soldaten.' },
    wohnhaus:    { name: 'Wohnhaus', icon: '🏠', hp: 150, cost: { bretter: 3, stein: 2 }, buildTime: 10,
                   pop: 4,
                   desc: 'Bietet Wohnraum für 4 weitere Soldaten.' },
    wachturm:    { name: 'Wachturm', icon: '🗼', hp: 300, cost: { bretter: 1, stein: 4 }, buildTime: 12,
                   claim: 6,
                   desc: 'Erweitert dein Gebiet. Bauen kannst du nur auf eigenem Land!' },
    kaserne:     { name: 'Kaserne', icon: '🛡️', hp: 250, cost: { bretter: 4, stein: 4 }, buildTime: 15,
                   interval: 7, input: { waffen: 1, nahrung: 1 }, spawns: true,
                   desc: 'Bildet Soldaten aus (1 Waffe + 1 Nahrung, braucht freien Wohnraum).' },
  },

  BUILD_ORDER: ['holzfaeller', 'saegewerk', 'steinbruch', 'fischer', 'bauernhof', 'muehle',
                'baeckerei', 'eisenmine', 'schmelze', 'schmiede', 'wohnhaus', 'wachturm', 'kaserne'],

  SOLDIER: { hp: 60, dmgUnit: 10, dmgBuilding: 14, range: 1.1, aggro: 4, speed: 2.4, cooldown: 0.8 },

  DIFF: {
    leicht: { name: 'Leicht', prodMult: 0.8,  resMult: 1.0, attackN: 10, attackCd: 210, thinkCd: 3.0 },
    mittel: { name: 'Mittel', prodMult: 1.0,  resMult: 1.5, attackN: 7,  attackCd: 130, thinkCd: 2.2 },
    schwer: { name: 'Schwer', prodMult: 1.3,  resMult: 2.0, attackN: 5,  attackCd: 80,  thinkCd: 1.5 },
  },
};
