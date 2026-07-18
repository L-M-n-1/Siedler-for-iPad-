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
