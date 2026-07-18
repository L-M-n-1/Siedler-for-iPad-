# 🏰 Neue Siedler – Freies Spiel für das iPad

Ein Aufbaustrategie-Spiel im Stil klassischer Siedler-Spiele (inspiriert von „Die Siedler IV"),
umgesetzt als touch-optimierte Web-App (PWA). Es läuft direkt in Safari auf dem iPad und
kann wie eine native App auf dem Home-Bildschirm installiert werden – danach auch offline.

Es gibt ausschließlich das **freie Spiel**: Karte, Spielerzahl, Schwierigkeit und Teams
wählen und losbauen.

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
- **Teams**: Jeder Spieler kann einem Team zugeordnet werden. Teammitglieder sind verbündet;
  es gewinnt das letzte verbliebene Team.
- **Schwierigkeit**: Leicht / Mittel / Schwer – beeinflusst Tempo, Startvorräte und
  Angriffslust der Computergegner.

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
- Seed-basierte Kartengenerierung (Wert-Rauschen), A*-Wegfindung, einfache Wirtschafts-KI
- PWA: Manifest + Service Worker für Vollbild und Offline-Betrieb

Zum lokalen Testen am Rechner: `python3 -m http.server 8000` und `http://localhost:8000` öffnen
(Maus: Ziehen = Schwenken, Mausrad = Zoom).
