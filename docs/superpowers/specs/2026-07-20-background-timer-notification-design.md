# Background-Timer mit Countdown-Notification — Design

**Datum:** 2026-07-20
**Status:** Abgenommen (Ansatz 1: Notifee + Foreground-Service)

## Problem

Beide Timer (`InlineTimer` in der Übungskarte, `CountdownTimer` im Fullscreen-Modal)
zählen mit einem JS-`setInterval` pro Sekunde `-1`. React Native pausiert JS-Timer
auf Android, sobald die App in den Hintergrund geht — der Timer friert ein. Es gibt
keine Notification: Wer während der Satzpause die App wechselt, verliert den Timer
komplett.

## Ziel

Wie bei einer richtigen Timer-App:

1. Timer läuft im Hintergrund korrekt weiter (auch bei Display aus).
2. Live-Countdown-Notification in der Statusleiste mit Pause/Reset/Stop-Buttons.
3. Bei Ablauf klingelt der volle Alarm (TimerSound-Loop + Dauervibration) — auch
   im Hintergrund und bei Display aus.
4. Es gibt genau **einen** globalen aktiven Timer. Ein neuer Start ersetzt den
   laufenden.

## Entscheidung

**Ansatz 1: `@notifee/react-native` + Foreground-Service + zentraler Timer-Controller.**

Verworfen:

- *Komplett natives Kotlin-Service* — kein neues Package, aber ~300+ Zeilen Kotlin,
  bidirektionale Event-Bridge und Channel-Management von Hand für dasselbe Ergebnis.
- *Minimal ohne Service* (nur Wanduhr-Fix + Ablauf-Trigger) — kein zuverlässiger
  Live-Countdown mit Buttons, Loop-Alarm nicht garantiert wenn der Prozess stirbt.

Notifee ist kostenlos, von Invertase gepflegt und braucht **kein** Google Play
Services (GrapheneOS-Pixel ist das Primärgerät). RN 0.85/new arch läuft über den
Interop-Layer.

## Architektur

### 1. Globaler Timer-Controller (`src/common/timerController.ts`)

Singleton-Modul außerhalb von React. Besitzt den einen aktiven Timer.

**Wanduhr-Logik statt Tick-Zählen:** Beim Start wird
`endAt = Date.now() + duration * 1000` gespeichert; die Restzeit wird immer aus
`endAt - Date.now()` abgeleitet. Damit ist die Zeit per Konstruktion korrekt,
egal wie lange Android das JS pausiert oder throttelt.

- **State:** `{status: 'idle' | 'running' | 'paused' | 'expired', target, endAt,
  remainingAtPause, ownerKey}`
- **API:** `start(durationSec, ownerKey)`, `pause()`, `resume()`, `reset()`,
  `stop()`, `subscribe(listener)`, `getSnapshot()` — konsumierbar via
  `useSyncExternalStore`.
- Der Controller ist die **einzige** Stelle, die Notification, AlarmManager-Trigger
  und `startAlarm()`/`stopAlarm()` ansteuert. App-UI und Notification-Buttons rufen
  beide nur die Controller-API → automatisch synchron.
- Im Vordergrund treibt ein Intervall die UI-Subscriber; Ablauferkennung über
  JS-Timeout auf `endAt` + Re-Check bei `AppState`-Wechsel auf `active`.

`ownerKey` = `session_exercise`-ID: Nur die Karte, die den Timer gestartet hat,
rendert den globalen Live-State; alle anderen Karten zeigen ihre eigene
Idle-Prescription. START auf einer anderen Karte ersetzt den laufenden Timer.

### 2. Notification-Verhalten

| Zustand | Darstellung | Buttons |
|---|---|---|
| Laufend | Foreground-Service-Notification, `showChronometer` + `chronometerDirection: 'down'` — SystemUI rendert den Countdown selbst, keine sekündlichen Updates | PAUSE · RESET · STOP |
| Pausiert | Statischer Text „PAUSED · 01:23" | RESUME · RESET · STOP |
| Abgelaufen | „TIME'S UP", Alarm läuft | STOP |

- **Ablauf-Garantie:** Zusätzlich zum JS-Timeout wird der Ablaufzeitpunkt als
  exakter AlarmManager-Trigger geplant (notifee `TimestampTrigger`,
  `allowWhileIdle`). Friert Doze das JS ein, weckt der Trigger den Prozess per
  Headless-Event und startet den Alarm. Der Trigger ersetzt die
  Countdown-Notification (gleiche Notification-ID). Pause/Reset/Stop canceln ihn.
- Button-Presses laufen über `notifee.onForegroundEvent` / `onBackgroundEvent`
  (Registrierung in `index.js` vor `AppRegistry`) → Controller-API.
- Tap auf die Notification öffnet die App.

### 3. Komponenten-Refactor

`InlineTimer` und `CountdownTimer` verlieren ihre eigene Tick- und Alarm-Logik und
werden reine Views über den Controller. Lokal bleiben: Edit-Modus, Blink-Animation,
`useKeepAwake`. Das Fullscreen-Modal zeigt denselben Timer wie die Karte, aus der
es geöffnet wurde.

**Bewusste Verhaltensänderung:** Heute stoppt der Alarm beim Unmount der Karte
(Übung abhaken → Accordion klappt zu → Effect-Cleanup). Mit dem globalen Controller
klingelt der Alarm weiter, bis explizit STOP/RESET gedrückt wird — in der App oder
in der Notification. Vom User abgenommen.

### 4. Android-Konfiguration

- `POST_NOTIFICATIONS`-Runtime-Permission: angefragt beim **ersten Timer-Start**,
  nicht beim App-Start. Verweigert → Timer läuft trotzdem korrekt (Wanduhr-Logik),
  nur ohne Notification.
- Foreground-Service: notifee-Service-Deklaration im Manifest mit
  `foregroundServiceType="specialUse"` + Subtype-Property (Android 14+ Pflicht;
  `shortService` scheidet aus — 3-Minuten-Limit). Play-Policy irrelevant (Sideload).
- Permissions: `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`,
  `USE_EXACT_ALARM` (auto-granted für Timer-Apps, API 33+) **plus**
  `SCHEDULE_EXACT_ALARM` für API 31–32 (minSdk ist 24; unter API 31 ist kein
  Permission nötig). Ist der exakte Alarm nicht verfügbar, degradiert notifee
  auf inexakt — akzeptabel, der JS-Timeout bleibt der Primärpfad.
- Zwei Notification-Channels: „Timer" (Countdown, lautlos) und „Timer abgelaufen"
  (hohe Priorität, ebenfalls lautlos — der Ton kommt geloopt aus dem bestehenden
  `TimerSound`-Modul, Channel-Sound würde doppelt klingeln).
- iOS: kompletter No-op (Platform-Guards wie in `timerSound.ts`).

### 5. Risiken

- Notifee-Gradle-Setup kann einen Maven-Repo-Eintrag brauchen (bekanntes
  Setup-Thema) → falls nötig wie die bestehenden `patches/` behandeln.
- Doze-Edge-Case: Stirbt der Prozess trotz FGS, liefert der AlarmManager-Trigger
  die Ablauf-Notification; der Headless-Event startet den Loop-Alarm. Sollte der
  Headless-Start selbst scheitern, ist die Notification sichtbar, aber stumm —
  akzeptiertes Restrisiko.

## Tests

- **Unit (Jest):** Controller-State-Machine mit gemocktem `Date.now` und
  notifee-Mock — Start/Pause/Resume/Ablauf/Ersetzen, Wanduhr-Korrektheit nach
  simuliertem Backgrounding. Notifee-Jest-Mock, damit der bestehende Smoke-Test
  weiter läuft.
- **Manuell auf dem Pixel 7:** App wechseln → Countdown läuft in der Statusleiste;
  Pause/Reset/Stop aus der Notification; Ablauf bei Display aus → Alarm klingelt;
  Rückkehr in die App → Karte zeigt korrekten State; Permission-Verweigerung →
  Timer läuft in-App normal.
