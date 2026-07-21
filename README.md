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

### Warenketten

| Kette | Gebäude |
|---|---|
| Bauholz | 🪓 Holzfäller → 🪚 Sägewerk (Bretter) |
| Stein | 🪨 Steinbruch (braucht Berge in der Nähe) |
| Nahrung | 🎣 Fischerhütte (am Wasser) · 🌾 Bauernhof → ⚙️ Mühle → 🍞 Bäckerei |
| Bergbau | ⚫ Kohlemine · ⛏️ Eisenmine (am Berg, verbrauchen Nahrung) → 🔥 Eisenschmelze (Erz + Kohle → Eisen) |
| Werkzeuge | 🛠️ Werkzeugmacher (Eisen + Kohle → Axt, Säge, Spitzhacke, Sense, Angel, Hammer) |
| Waffen | 🗡️ Schwertschmiede (Eisen+Kohle) · 🔱 Lanzenschmiede (Eisen+Holz) · 🏹 Bogenmacher (Holz) · 🐎 Gestüt (Getreide→Pferd) |
| Militär | 🛡️ Kaserne bildet je nach Waffe Soldaten aus · 🏠 Wohnhaus (mehr Soldatenplätze) |
| Logistik | 📦 Lagerhaus erhöht die Zahl der Lastenträger und nimmt Waren an |
| Gebiet | 🚩 Wachposten · 🗼 Wachturm · 🏯 Festung – erweitern das Gebiet, sobald sie besetzt sind |

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

Den Ausbildungstyp stellst du im Info-Panel der **Kaserne** ein. Die Kaserne verbraucht die
passende Waffe (Reiter zusätzlich ein Pferd) plus Nahrung und braucht freien Wohnraum.

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
- **☰**: Pause/Menü · **▶ 1×/2×/3×**: Spielgeschwindigkeit

## Technik

- Reines HTML/CSS/JavaScript ohne Abhängigkeiten (Canvas-2D-Rendering)
- 2.5D-Grafik: prozedural gezeichnete Gebäude-Sprites je Volk (Dächer, Schatten,
  Y-Sortierung), Soldatenfiguren je Typ (mit berittenem Reiter), laufende Lastenträger,
  Ackerfelder, Schornsteinrauch, rotierende Mühlenflügel, Grenzsteine, weiche
  Geländeübergänge, Flora und animiertes Wasser
- Tiefe Wirtschaft: Werkzeug-Gate (Arbeiter + Werkzeug je Gebäude), Warenketten mit Kohle,
  Werkzeugen, vier Waffen und Pferden, sichtbare Träger-Logistik mit Trägerlimit
- Vier Soldatentypen (Nah-/Fernkampf/berittene) und drei Turmstufen mit Besatzungspflicht
- Seed-basierte Kartengenerierung (Wert-Rauschen), A*-Wegfindung, Wirtschafts-KI
- Spielstände als JSON im localStorage (3 Slots + Autosave)
- PWA: Manifest + Service Worker für Vollbild und Offline-Betrieb

Zum lokalen Testen am Rechner: `python3 -m http.server 8000` und `http://localhost:8000` öffnen
(Maus: Ziehen = Schwenken, Mausrad = Zoom).
