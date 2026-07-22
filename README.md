# 🏰 Neue Siedler – Freies Spiel für das iPad

Ein Aufbaustrategie-Spiel im Stil klassischer Siedler-Spiele (inspiriert von „Die Siedler IV"),
umgesetzt als touch-optimierte Web-App (PWA) mit 2.5D-Grafik. Es läuft direkt in Safari auf
dem iPad und kann wie eine native App auf dem Home-Bildschirm installiert werden – danach
auch offline.

Es gibt ausschließlich das **freie Spiel**: Karte, Spielerzahl, Volk, Schwierigkeit und
Teams wählen und losbauen. Spielstände können gespeichert und geladen werden, zusätzlich
sichert das Spiel automatisch.

## Auf dem iPad spielen

1. Das Spiel über einen Webserver bereitstellen, z. B.:
   - **GitHub Pages**: In den Repository-Einstellungen unter *Pages* den Branch veröffentlichen –
     das Spiel ist dann unter der Pages-URL erreichbar.
   - **Lokal im WLAN**: Im Projektordner `python3 -m http.server 8000` starten und auf dem iPad
     `http://<IP-des-Rechners>:8000` öffnen.
2. Die Seite in **Safari** öffnen.
3. **Teilen-Symbol → „Zum Home-Bildschirm"** wählen.
4. Das Spiel vom Home-Bildschirm starten – es läuft im Vollbild und (nach dem ersten Start) offline.

## Freies Spiel – Einstellungen

- **Karte**: 4 Kartentypen (Grüne Ebene, Seenland, Bergland, Flusstal), jeweils zufällig
  gewürfelt – mit „🔄 Neue Karte würfeln" gibt es eine neue Variante. Die Vorschau zeigt
  exakt die Karte, auf der gespielt wird.
- **Spieler**: 2–4 Spieler (du + 1–3 Computergegner).
- **Volk**: Jeder Spieler wählt eines von 7 Völkern (oder Zufall) – mit eigenem Baustil
  und eigenem Bonus, siehe Tabelle unten.
- **Teams**: Jeder Spieler kann einem Team zugeordnet werden. Teammitglieder sind verbündet;
  es gewinnt das letzte verbliebene Team.
- **Schwierigkeit**: Leicht / Mittel / Schwer – beeinflusst Tempo, Startvorräte und
  Angriffslust der Computergegner.

## Die Völker

| Volk | Baustil | Bonus |
|---|---|---|
| 🏛️ Römer | rote Walmdächer | −15 % Bauzeit aller Gebäude |
| 🐺 Wikinger | steile Satteldächer | Soldaten +20 % Stärke |
| 🌽 Maya | Stufenpyramiden | Landwirtschaft 20 % schneller |
| 🐴 Trojaner | Zinnenkränze | Gebäude +25 % Lebenspunkte |
| 🐪 Ägypter | Flachdächer | Steinbruch 25 % schneller, Wachturm billiger |
| 🏮 Chinesen | Pagodendächer | Kaserne bildet 25 % schneller aus |
| 🪘 Nubier | Lehmkuppeln | Wachtürme +1 Gebietsradius, Wohnhaus billiger |

## Speichern & Laden

- **Manuell**: Im Pausemenü (☰) stehen 3 Speicher-Slots bereit.
- **Automatisch**: Das Spiel sichert von selbst – das Intervall (5, 10 oder 15 Minuten)
  ist im Pausemenü einstellbar. Auch beim Verlassen der App wird automatisch gesichert.
- **Laden**: Auf dem Startbildschirm unter „💾 Spielstand laden" (inklusive Autosave).
- Gespeichert wird lokal auf dem Gerät (localStorage), es wird kein Server benötigt.

## Spielprinzip

Zerstöre alle gegnerischen Hauptquartiere, bevor deins fällt!

### Übersicht, Kategorien & Materialströme

- **📋 Übersicht** (Knopf oben): zeigt alle Bestände nach Gruppen (Bau, Nahrung, Bergbau,
  Werkzeug, Militär) sowie **Siedler** (Bevölkerung, Lastenträger, Geologen) und **Truppen**
  (Einheiten nach Typ + Turmbesatzung).
- **Bauleiste nach Kategorien**: Rohstoffe · Nahrung · Werkzeug · Militär · Logistik.
- **Materialströme steuern**: Jedes Produktionsgebäude lässt sich **pausieren** und mit
  **Priorität** (Niedrig/Normal/Hoch) versehen (Info-Panel). Im Reiter **⚖️ Verteilung** der
  Übersicht legst du je Gebäudetyp fest, wer knappe Waren (Kohle, Eisen, Holz, Getreide, Wasser)
  zuerst bekommt – hoch priorisierte Verbraucher werden zuerst bedient.

### Warenketten

| Kette | Gebäude |
|---|---|
| Bauholz | 🪓 Holzfäller → 🪚 Sägewerk (Bretter) |
| Stein | 🪨 Steinbruch (braucht Berge in der Nähe) |
| Nahrung | 🎣 Fischerhütte (am Wasser) · 🌾 Bauernhof → ⚙️ Mühle → 🍞 Bäckerei |
| Nahrung II | ⛲ Brunnen (Wasser) · 🐖 Schweinefarm → 🥩 Metzgerei (viel Nahrung) |
| Bier | 🍺 Brauerei (Getreide + Wasser) – hebt die Moral der Bergleute (Minen fördern schneller) |
| Bergbau | ⚫ Kohlemine · ⛏️ Eisenmine (am Berg, verbrauchen Nahrung) → 🔥 Eisenschmelze (Erz + Kohle → Eisen) |
| Werkzeuge | 🛠️ Werkzeugmacher (Eisen + Kohle → Axt, Säge, Spitzhacke, Sense, Angel, Hammer) |
| Gold | 🔍 Geologe findet Goldvorkommen → 🟡 Goldmine (Golderz) → 🪙 Goldschmiede (Gold) |
| Waffen | 🗡️ Schwertschmiede (Eisen+Kohle) · 🔱 Lanzenschmiede (Eisen+Holz) · 🏹 Bogenmacher (Holz) · 🐎 Gestüt (Getreide→Pferd) |
| Militär | 🛡️ Kaserne bildet je nach Waffe Soldaten aus · ⚙️ Belagerungswerkstatt baut Katapulte |
| Wohnraum | 🛖 Hütte (2) · 🏠 Wohnhaus (4) · 🏡 Gutshaus (8) – Soldatenplätze in drei Größen |
| Unterstützung | ⛪ Tempel (schnellere Beförderung + Moral) · ⛑️ Lazarett (heilt Soldaten) |
| Logistik | 📦 Lagerhaus · 🏪 Markt – mehr Lastenträger und Warenannahme |
| See | ⚓ Hafen an der Küste baut 🚣 Fischerboote (Nahrung) und ⛵ Transportschiffe (Truppen übers Wasser) |
| Gebiet | 🚩 Wachposten · 🗼 Wachturm · 🏯 Festung – erweitern das Gebiet, sobald sie besetzt sind |

Der **Katapult** (aus der Belagerungswerkstatt) ist langsam, aber verheerend gegen Gebäude und
Festungen – ideal, um gegnerische Bollwerke aus der Distanz zu knacken.

### Geologe & Gold

Jedes Gebirge enthält **Stein, Eisen und Kohle** gemischt; **Gold** ist selten und liegt in
kleinen Adern. Schick mit dem **🔍-Knopf** einen **Geologen** zu einem Berg – er erkundet die
Umgebung und markiert Fundstellen mit Schildern.
Eine **Goldmine** kann nur auf einem gefundenen **Goldvorkommen** gebaut werden; gefundene
reiche Vorkommen steigern außerdem den Ertrag der normalen Minen. Die **Goldschmiede** macht aus
Golderz und Kohle **Goldmünzen**. Gold **befördert** deine Soldaten automatisch in höhere Ränge
(Rekrut → Veteran → Elite) – mehr Leben und Schaden, sichtbar an goldenen Rang-Abzeichen. Auch
die Computergegner schicken Geologen aus und befördern ihre Truppen.

### Werkzeuge & Arbeiter (wie bei „Die Siedler")

Jedes Produktionsgebäude braucht einen Arbeiter mit dem **passenden Werkzeug** (Holzfäller → Axt,
Bauernhof → Sense, Minen → Spitzhacke, Verarbeitung → Hammer usw.). Beim Fertigstellen holt sich
ein Siedler das Werkzeug aus dem Lager und besetzt das Gebäude dauerhaft. Fehlt das Werkzeug,
steht das Gebäude still, bis der **Werkzeugmacher** Nachschub liefert. Zu Beginn hast du ein
kleines Werkzeug-Startset – plane den Werkzeugmacher früh ein!

### Lastenträger

Produzierte Waren werden von **Lastenträgern** sichtbar vom Gebäude zum Hauptquartier (oder
Lagerhaus) getragen; erst dort landen sie im Vorrat. Die Zahl der Träger ist begrenzt
(Hauptquartier + Lagerhäuser). Sind alle unterwegs, stapeln sich fertige Waren am Gebäude
(„Wartet auf Träger") – wer sein Reich überdehnt, bremst so seine Wirtschaft. Die Anzeige
🧺 oben zeigt beschäftigte / verfügbare Träger.

### Soldatentypen

| Typ | Waffe | Eigenschaften |
|---|---|---|
| 🔱 Lanzenträger | Lanze | günstig, schnell ausgebildet, solide Basis |
| 🗡️ Schwertkämpfer | Schwert | viel Leben, starker Nahkampf |
| 🏹 Bogenschütze | Bogen | greift aus Distanz an, wenig Panzerung |
| 🐎 Reiter | Schwert + Pferd | schnell und schlagkräftig, teuer |

In der **Kaserne** (bzw. Belagerungswerkstatt/Hafen) reihst du im Info-Panel gezielt **Typ und
Anzahl** in eine **Warteschlange** ein – auch mehrere verschiedene Typen nacheinander. Die
Restmengen werden angezeigt und lassen sich einzeln entfernen. Die Kaserne verbraucht die
passende Waffe (Reiter zusätzlich ein Pferd) plus Nahrung und braucht freien Wohnraum.

### Schiffe & Hafen

Ein **Hafen** an der Küste baut zwei Schiffstypen: **Fischerboote** fahren automatisch aufs Wasser
und liefern Nahrung, **Transportschiffe** bringen Soldaten über Seen und Flüsse. Zum Übersetzen:
Soldaten auswählen und das eigene Transportschiff antippen (sie schiffen ein), dann das Schiff
auswählen und eine Küste am anderen Ufer antippen – dort schiffen die Soldaten wieder aus.

### Krieger-Ränge & Tempel/Lazarett

Mit **Gold** steigen deine Soldaten in **drei Rängen** (Rekrut → Veteran → Elite) an Leben und
Schaden. Ein **Tempel** beschleunigt diese Beförderung und stärkt Truppen in der Nähe (Moral).
Ein **Lazarett** heilt verwundete Soldaten in seinem Umkreis mit der Zeit.

### Türme & Gebiet (Besatzung nötig)

Es gibt drei Militärgebäude mit wachsendem Gebietsradius: **Wachposten**, **Wachturm** und
**Festung**. Ein Turm beansprucht erst dann Land, wenn ihn ein **Soldat besetzt**: Soldaten
auswählen und den eigenen Turm antippen. Über das Info-Panel kannst du Soldaten wieder
**ausrücken** lassen. Grenzsteine markieren dein Territorium.

### Steuerung (Touch)

- **Ziehen**: Karte verschieben · **Kneifen**: Zoomen · **Minimap antippen**: dorthin springen
- **Gebäude bauen**: Unten ein Gebäude antippen, dann auf ein freies Feld im eigenen Gebiet tippen
- **Gebäude-Info**: Gebäude antippen (dort auch Abreißen)
- **Soldaten**: ⚔️-Knopf wählt alle Soldaten (oder Soldaten direkt antippen), dann Ziel antippen –
  Gegner werden angegriffen, freie Felder sind Marschbefehle, ein **eigener Turm** wird besetzt
- **Kaserne/Werkzeugmacher**: im Info-Panel Soldatentyp bzw. Werkzeug-Priorität wählen
- **🔍 Geologe**: Knopf antippen, dann auf ein Berggebiet tippen – deckt Vorkommen auf
- **📋 Übersicht**: Bestände, Siedler, Truppen und der Verteilungs-Reiter für Materialströme
- **☰**: Pause/Menü · **▶ 1×/2×/3×**: Spielgeschwindigkeit

## Grafik & Animationen

Verbesserte 2.5D-Optik mit räumlicher Wirkung und viel Bewegung (weiterhin reines Canvas-2D,
damit es flüssig und offline auf dem iPad läuft):

- **Dynamische Schatten** in Lichtrichtung und plastischere Gebäude mit Seitenflächen
- **Tag-/Nacht-Wechsel**: die Welt durchläuft Morgen → Tag → Abend → Nacht mit kühler
  Nachttönung, Vignette und warmen Fensterlichtern (Indikator ☀️/🌆/🌙 oben)
- **Laufende Figuren** mit Geh-Wippen und Angriffs-Ausfall, Staub unter den Füßen
- **Arbeitende Gebäude**: Schmiedefunken, Schornsteinrauch, Backofen-Glühen, rotierende
  Mühlenflügel, Goldschimmer; wachsende Ackerfelder
- **Lebendige Details**: wehende Fahnen, Wasserwellen, Grenzsteine, Vorkommen-Schilder,
  goldene Rang-Abzeichen an beförderten Soldaten

## Technik

- Reines HTML/CSS/JavaScript ohne Abhängigkeiten (Canvas-2D-Rendering, gecachte Sprites)
- Verbesserte 2.5D-Grafik: dynamische Schatten, Tag/Nacht-Beleuchtung, animierte Figuren
  (Geh-Zyklus, Reiter), arbeitende Gebäude, wehende Fahnen, Vorkommen-Schilder, Rang-Abzeichen
- Tiefe Wirtschaft: Werkzeug-Gate (Arbeiter + Werkzeug je Gebäude), Warenketten mit Kohle,
  Gold (Geologe → Goldmine → Goldschmiede), zweiter Nahrungskette (Schwein/Metzgerei), Bier
  (Minen-Bonus), Werkzeugen, vier Waffen und Pferden, sichtbare Träger-Logistik mit Trägerlimit
- Bestands-Übersicht (Untermenü), Gebäudekategorien und steuerbare Materialströme
  (Pause + Priorität je Gebäude, Verteilung je Gebäudetyp)
- Fünf Kampfeinheiten (Lanze/Schwert/Bogen/Reiter/Katapult) mit Gold-Beförderung, drei Turmstufen
  mit Besatzungspflicht, versteckte Bergvorkommen zum Erkunden
- Seed-basierte Kartengenerierung (Wert-Rauschen), A*-Wegfindung, Wirtschafts-KI
- Spielstände als JSON im localStorage (3 Slots + Autosave)
- PWA: Manifest + Service Worker für Vollbild und Offline-Betrieb

Zum lokalen Testen am Rechner: `python3 -m http.server 8000` und `http://localhost:8000` öffnen
(Maus: Ziehen = Schwenken, Mausrad = Zoom).
