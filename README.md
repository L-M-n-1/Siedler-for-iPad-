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
| Waffen | ⛏️ Eisenmine (am Berg, verbraucht Nahrung) → 🔥 Eisenschmelze → 🔨 Waffenschmiede |
| Militär | 🛡️ Kaserne (Waffe + Nahrung → Soldat) · 🏠 Wohnhaus (mehr Soldatenplätze) |
| Gebiet | 🗼 Wachturm erweitert das eigene Territorium – gebaut wird nur auf eigenem Land |

### Steuerung (Touch)

- **Ziehen**: Karte verschieben · **Kneifen**: Zoomen · **Minimap antippen**: dorthin springen
- **Gebäude bauen**: Unten ein Gebäude antippen, dann auf ein freies Feld im eigenen Gebiet tippen
- **Gebäude-Info**: Gebäude antippen (dort auch Abreißen)
- **Soldaten**: ⚔️-Knopf wählt alle Soldaten (oder Soldaten direkt antippen), dann Ziel antippen –
  Gegner werden angegriffen, freie Felder sind Marschbefehle
- **☰**: Pause/Menü · **▶ 1×/2×/3×**: Spielgeschwindigkeit

## Technik

- Reines HTML/CSS/JavaScript ohne Abhängigkeiten (Canvas-2D-Rendering)
- 2.5D-Grafik: prozedural gezeichnete Gebäude-Sprites je Volk (Dächer, Schatten,
  Y-Sortierung), weiche Geländeübergänge, animiertes Wasser, Soldatenfiguren
- Seed-basierte Kartengenerierung (Wert-Rauschen), A*-Wegfindung, einfache Wirtschafts-KI
- Spielstände als JSON im localStorage (3 Slots + Autosave)
- PWA: Manifest + Service Worker für Vollbild und Offline-Betrieb

Zum lokalen Testen am Rechner: `python3 -m http.server 8000` und `http://localhost:8000` öffnen
(Maus: Ziehen = Schwenken, Mausrad = Zoom).
