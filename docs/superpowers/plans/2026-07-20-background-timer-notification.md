# Background-Timer mit Countdown-Notification — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Workout-Timer läuft im Hintergrund korrekt weiter, zeigt eine Live-Countdown-Notification mit Pause/Reset/Stop-Buttons und klingelt bei Ablauf auch bei Display aus.

**Architecture:** Ein globaler Wanduhr-basierter Timer-Controller (`timerController.ts`, Singleton außerhalb von React) ist die einzige Instanz, die Notification (`timerNotification.ts`, notifee-Wrapper), AlarmManager-Trigger und den bestehenden Alarm (`timerSound.ts`) ansteuert. `InlineTimer`/`CountdownTimer` werden reine Views über `useSyncExternalStore`. Die Countdown-Notification ist ein notifee-Foreground-Service mit `showChronometer` (SystemUI rendert selbst, keine sekündlichen Updates).

**Tech Stack:** React Native 0.85 (new arch, Interop), `@notifee/react-native` ^9, Jest 29 (fake timers + `jest.setSystemTime`), TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-20-background-timer-notification-design.md`

## Global Constraints

- Genau **ein** globaler aktiver Timer; ein neuer Start ersetzt den laufenden.
- Restzeit wird **immer** aus `endAt - Date.now()` abgeleitet, nie durch Tick-Zählen.
- Alarm (TimerSound-Loop + Dauervibration) klingelt bis explizit STOP/RESET — auch nach Unmount der Karte. Ton kommt **nur** aus dem TimerSound-Modul; beide Notification-Channels sind lautlos (`sound: undefined`, expired-Channel zusätzlich `vibration: false`).
- Ohne Notification-Permission läuft der Timer in-App vollständig weiter — jeder notifee-Aufruf ist in `timerNotification.ts` mit try/catch + `console.warn` gekapselt; Fehler dürfen nie in den Controller propagieren.
- Foreground-Service-Typ: `specialUse` (Android 14+); Permissions: `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`, `USE_EXACT_ALARM` (API 33+), `SCHEDULE_EXACT_ALARM` mit `android:maxSdkVersion="32"` (minSdk ist 24).
- Notification-RESET = Neustart mit voller Dauer (weiterlaufend); In-App-RESET = zurück auf idle. Beide über die Controller-API.
- iOS: kompletter No-op (`Platform.OS !== 'android'`-Guards in `timerNotification.ts`).
- Package-Manager: **npm** benutzen (`yarn` ist berry-broken, siehe CLAUDE.md). Tools direkt via `node_modules/.bin/`.
- `tsc --noEmit` ist auf diesem Repo NICHT clean — neue Fehler nur per Diff gegen HEAD bewerten (CLAUDE.md-Protokoll).
- Ein Notification-ID-Konstant `'workout-timer'` für FGS-Notification UND Trigger. **Reihenfolge-Invariante:** `cancelExpiryTrigger()` immer VOR dem nächsten `displayNotification` mit derselben ID (Cancel entfernt sonst die frisch angezeigte Notification).

---

### Task 1: notifee installieren + Android-Konfiguration

**Files:**
- Modify: `package.json` (dependency via `npm install`)
- Modify: `android/app/src/main/AndroidManifest.xml`

**Interfaces:**
- Produces: importierbares `@notifee/react-native`; Manifest erlaubt FGS `specialUse` + exakte Alarme. Keine JS-Exports.

- [ ] **Step 1: notifee installieren**

```bash
cd /home/pascal/Code/workout-warden
npm install @notifee/react-native
```

Expected: `package.json` enthält `"@notifee/react-native": "^9..."`; postinstall (`patch-package`) läuft fehlerfrei durch.

- [ ] **Step 2: AndroidManifest erweitern**

`android/app/src/main/AndroidManifest.xml` — komplette neue Datei (Root bekommt `xmlns:tools`, vier neue Permissions, Service-Override im `<application>`-Block; alles Bestehende bleibt):

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
  xmlns:tools="http://schemas.android.com/tools">

  <uses-permission android:name="android.permission.INTERNET" />
  <uses-permission android:name="android.permission.VIBRATE" />
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
  <uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE"/>
  <uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
  <uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" android:maxSdkVersion="32"/>

  <application
    android:name=".MainApplication"
    android:label="@string/app_name"
    android:icon="@mipmap/ic_launcher"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:allowBackup="false"
    android:theme="@style/AppTheme"
    android:supportsRtl="true">
    <activity
      android:name=".MainActivity"
      android:label="@string/app_name"
      android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
      android:launchMode="singleTask"
      android:windowSoftInputMode="adjustResize"
      android:exported="true">
      <intent-filter>
        <action android:name="android.intent.action.MAIN" />
        <category android:name="android.intent.category.LAUNCHER" />
      </intent-filter>
    </activity>

    <!-- Android 14+ verlangt einen deklarierten FGS-Typ; notifee's Service
         wird per Manifest-Merge um specialUse ergänzt. -->
    <service
      android:name="app.notifee.core.ForegroundService"
      android:foregroundServiceType="specialUse"
      tools:node="merge">
      <property
        android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
        android:value="Workout rest timer countdown with user-visible controls" />
    </service>
  </application>
</manifest>
```

- [ ] **Step 3: Build verifizieren**

```bash
cd /home/pascal/Code/workout-warden/android && ./gradlew :app:processDebugMainManifest :app:compileDebugKotlin
```

Expected: `BUILD SUCCESSFUL`. Falls stattdessen `Could not find app.notifee:core` erscheint: in `android/build.gradle` unter `allprojects { repositories { ... } }` (Block ggf. anlegen) ergänzen:

```gradle
maven { url "$rootDir/../node_modules/@notifee/react-native/android/libs" }
```

und den Gradle-Befehl wiederholen.

- [ ] **Step 4: Commit**

```bash
cd /home/pascal/Code/workout-warden
git add package.json package-lock.json android/app/src/main/AndroidManifest.xml android/build.gradle
git commit -m "feat: add notifee + Android FGS/alarm config for background timer"
```

---

### Task 2: Notification-Layer `timerNotification.ts` (TDD)

**Files:**
- Create: `__mocks__/@notifee/react-native.js`
- Create: `src/common/timerNotification.ts`
- Test: `__tests__/timerNotification.test.ts`

**Interfaces:**
- Consumes: `formatTime(seconds: number): string` aus `src/common/functions.tsx`; `colors` aus `src/common/theme.ts`.
- Produces (von Task 3 benutzt):
  - `ensurePermission(): Promise<void>`
  - `showRunning(endAt: number, label?: string): Promise<void>`
  - `showPaused(remainingSec: number, label?: string): Promise<void>`
  - `showExpired(label?: string): Promise<void>`
  - `hide(): Promise<void>`
  - `scheduleExpiryTrigger(endAt: number, label?: string): Promise<void>`
  - `cancelExpiryTrigger(): Promise<void>`
  - `wireTimerEvents(h: TimerEventHandlers): void` mit `TimerEventHandlers = {pause(): void; resume(): void; restart(): void; stop(): void; onExpiryTrigger(): void}`
  - `handleNotifeeEvent(event: Event): Promise<void>` (für `index.js`)
  - Konstanten `TIMER_NOTIFICATION_ID`, `ACTION_PAUSE`, `ACTION_RESUME`, `ACTION_RESTART`, `ACTION_STOP`

- [ ] **Step 1: Jest-Manual-Mock für notifee anlegen**

`__mocks__/@notifee/react-native.js` (Mock für ein node_modules-Package im Projekt-Root — Jest nutzt ihn automatisch, kein `jest.mock`-Aufruf nötig):

```js
// Manual Jest mock for @notifee/react-native. Lives at the project root so
// Jest applies it automatically to every test that imports notifee.
const notifee = {
  requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
  createChannel: jest.fn(async () => 'channel-id'),
  displayNotification: jest.fn(async () => 'notification-id'),
  createTriggerNotification: jest.fn(async () => 'notification-id'),
  cancelTriggerNotification: jest.fn(async () => {}),
  cancelNotification: jest.fn(async () => {}),
  stopForegroundService: jest.fn(async () => {}),
  registerForegroundService: jest.fn(),
  onForegroundEvent: jest.fn(() => () => {}),
  onBackgroundEvent: jest.fn(),
};

module.exports = {
  __esModule: true,
  default: notifee,
  AndroidImportance: {NONE: 0, MIN: 1, LOW: 2, DEFAULT: 3, HIGH: 4},
  AuthorizationStatus: {NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1},
  EventType: {UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2, DELIVERED: 3},
  TriggerType: {TIMESTAMP: 0, INTERVAL: 1},
  AndroidForegroundServiceType: {FOREGROUND_SERVICE_TYPE_SPECIAL_USE: 1073741824},
};
```

- [ ] **Step 2: Failing Test schreiben**

`__tests__/timerNotification.test.ts`:

```ts
/**
 * timerNotification unit tests. The RN Platform is forced to 'android'
 * (the react-native Jest preset defaults to iOS, which would turn every
 * function into a guard-clause no-op). The notifee module itself comes
 * from the automatic manual mock in __mocks__/@notifee/react-native.js.
 */
jest.mock('react-native', () => ({Platform: {OS: 'android'}}));

import notifee, {EventType} from '@notifee/react-native';
import {
  ACTION_PAUSE,
  ACTION_STOP,
  TIMER_NOTIFICATION_ID,
  handleNotifeeEvent,
  showRunning,
  showPaused,
  scheduleExpiryTrigger,
  hide,
  wireTimerEvents,
} from '../src/common/timerNotification';

const mocked = notifee as jest.Mocked<typeof notifee>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('showRunning', () => {
  it('displays a foreground-service chronometer notification with actions', async () => {
    await showRunning(1_700_000_000_000, 'Dead Hang');
    expect(mocked.displayNotification).toHaveBeenCalledTimes(1);
    const arg = mocked.displayNotification.mock.calls[0][0];
    expect(arg.id).toBe(TIMER_NOTIFICATION_ID);
    expect(arg.android?.asForegroundService).toBe(true);
    expect(arg.android?.showChronometer).toBe(true);
    expect(arg.android?.chronometerDirection).toBe('down');
    expect(arg.android?.timestamp).toBe(1_700_000_000_000);
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-pause', 'timer-restart', 'timer-stop']);
  });

  it('swallows notifee errors', async () => {
    mocked.displayNotification.mockRejectedValueOnce(new Error('boom'));
    await expect(showRunning(1)).resolves.toBeUndefined();
  });
});

describe('showPaused', () => {
  it('shows static remaining time without chronometer', async () => {
    await showPaused(83);
    const arg = mocked.displayNotification.mock.calls[0][0];
    expect(arg.body).toContain('1:23');
    expect(arg.android?.showChronometer).toBeUndefined();
    const ids = arg.android?.actions?.map(a => a.pressAction.id);
    expect(ids).toEqual(['timer-resume', 'timer-restart', 'timer-stop']);
  });
});

describe('scheduleExpiryTrigger', () => {
  it('creates an exact allow-while-idle timestamp trigger', async () => {
    await scheduleExpiryTrigger(1_700_000_000_000);
    const [notification, trigger] =
      mocked.createTriggerNotification.mock.calls[0];
    expect(notification.id).toBe(TIMER_NOTIFICATION_ID);
    expect(trigger).toMatchObject({
      timestamp: 1_700_000_000_000,
      alarmManager: {allowWhileIdle: true},
    });
  });
});

describe('hide', () => {
  it('stops the foreground service and cancels the notification', async () => {
    await hide();
    expect(mocked.stopForegroundService).toHaveBeenCalled();
    expect(mocked.cancelNotification).toHaveBeenCalledWith(
      TIMER_NOTIFICATION_ID,
    );
  });
});

describe('handleNotifeeEvent', () => {
  it('dispatches action presses to the wired handlers', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: ACTION_PAUSE}},
    } as any);
    expect(handlers.pause).toHaveBeenCalledTimes(1);

    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: ACTION_STOP}},
    } as any);
    expect(handlers.stop).toHaveBeenCalledTimes(1);
  });

  it('maps a delivered expiry trigger to onExpiryTrigger', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.DELIVERED,
      detail: {notification: {id: TIMER_NOTIFICATION_ID}},
    } as any);
    expect(handlers.onExpiryTrigger).toHaveBeenCalledTimes(1);
  });

  it('ignores foreign notifications and unknown actions', async () => {
    const handlers = {
      pause: jest.fn(),
      resume: jest.fn(),
      restart: jest.fn(),
      stop: jest.fn(),
      onExpiryTrigger: jest.fn(),
    };
    wireTimerEvents(handlers);
    await handleNotifeeEvent({
      type: EventType.DELIVERED,
      detail: {notification: {id: 'something-else'}},
    } as any);
    await handleNotifeeEvent({
      type: EventType.ACTION_PRESS,
      detail: {pressAction: {id: 'unrelated'}},
    } as any);
    expect(handlers.onExpiryTrigger).not.toHaveBeenCalled();
    expect(handlers.pause).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Test laufen lassen — muss failen**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest __tests__/timerNotification.test.ts
```

Expected: FAIL — `Cannot find module '../src/common/timerNotification'`.

- [ ] **Step 4: `src/common/timerNotification.ts` implementieren**

```ts
// src/common/timerNotification.ts
//
// All notifee access for the workout timer lives here; the controller
// (timerController.ts) is the only caller. Every function is a safe
// no-op on iOS and when notifications are unavailable (permission
// denied, notifee broken) — the in-app timer must keep working, so
// every notifee call is wrapped and failures only warn.
//
// One notification id is shared by the foreground-service notification
// and the AlarmManager expiry trigger. Invariant: cancelExpiryTrigger()
// must run BEFORE the next displayNotification with this id — notifee's
// cancel also removes a displayed notification with the same id.

import {Platform} from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
  AuthorizationStatus,
  EventType,
  TriggerType,
} from '@notifee/react-native';
import type {Event} from '@notifee/react-native';

import {formatTime} from './functions';
import {colors} from './theme';

export const TIMER_NOTIFICATION_ID = 'workout-timer';

export const ACTION_PAUSE = 'timer-pause';
export const ACTION_RESUME = 'timer-resume';
export const ACTION_RESTART = 'timer-restart';
export const ACTION_STOP = 'timer-stop';

const CHANNEL_TIMER = 'timer';
const CHANNEL_EXPIRED = 'timer-expired';

export interface TimerEventHandlers {
  pause(): void;
  resume(): void;
  restart(): void;
  stop(): void;
  onExpiryTrigger(): void;
}

let handlers: TimerEventHandlers | null = null;

/** Called once by timerController at module init (injection avoids an
 * import cycle: this module must never import the controller). */
export function wireTimerEvents(h: TimerEventHandlers): void {
  handlers = h;
}

/**
 * Shared dispatcher for notifee foreground AND background events —
 * registered as onForegroundEvent below and as onBackgroundEvent in
 * index.js (background registration must happen outside the component
 * tree, before AppRegistry).
 */
export async function handleNotifeeEvent({type, detail}: Event): Promise<void> {
  if (handlers == null) return;
  if (type === EventType.ACTION_PRESS) {
    switch (detail.pressAction?.id) {
      case ACTION_PAUSE:
        handlers.pause();
        break;
      case ACTION_RESUME:
        handlers.resume();
        break;
      case ACTION_RESTART:
        handlers.restart();
        break;
      case ACTION_STOP:
        handlers.stop();
        break;
    }
    return;
  }
  // The AlarmManager expiry trigger fired (Doze belt-and-braces path).
  if (
    type === EventType.DELIVERED &&
    detail.notification?.id === TIMER_NOTIFICATION_ID
  ) {
    handlers.onExpiryTrigger();
  }
}

if (Platform.OS === 'android') {
  notifee.onForegroundEvent(handleNotifeeEvent);
}

let permissionAsked = false;
let channelsCreated = false;

async function ensureChannels(): Promise<void> {
  if (channelsCreated) return;
  await notifee.createChannel({
    id: CHANNEL_TIMER,
    name: 'Timer',
    importance: AndroidImportance.LOW, // silent, status-bar icon only
  });
  await notifee.createChannel({
    id: CHANNEL_EXPIRED,
    name: 'Timer finished',
    importance: AndroidImportance.HIGH,
    sound: undefined, // alarm audio comes from TimerSound, not the channel
    vibration: false, // repeating vibration comes from startAlarm()
  });
  channelsCreated = true;
}

/** Ask for POST_NOTIFICATIONS once (Android 13+; auto-granted below). */
export async function ensurePermission(): Promise<void> {
  if (Platform.OS !== 'android' || permissionAsked) return;
  permissionAsked = true;
  try {
    const settings = await notifee.requestPermission();
    if (settings.authorizationStatus === AuthorizationStatus.DENIED) {
      console.warn(
        'Timer notifications denied — timer keeps running without one.',
      );
    }
  } catch (err) {
    console.warn('Timer notification permission request failed', err);
  }
}

const openApp = {id: 'default', launchActivity: 'default'} as const;

/** Live countdown — SystemUI renders the chronometer, no per-second updates. */
export async function showRunning(endAt: number, label?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: 'REST TIMER',
      body: label,
      android: {
        channelId: CHANNEL_TIMER,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        showChronometer: true,
        chronometerDirection: 'down',
        timestamp: endAt,
        pressAction: openApp,
        actions: [
          {title: 'Pause', pressAction: {id: ACTION_PAUSE}},
          {title: 'Reset', pressAction: {id: ACTION_RESTART}},
          {title: 'Stop', pressAction: {id: ACTION_STOP}},
        ],
      },
    });
  } catch (err) {
    console.warn('Timer notification (running) failed', err);
  }
}

export async function showPaused(
  remainingSec: number,
  label?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: 'REST TIMER',
      body: `PAUSED · ${formatTime(remainingSec)}${label ? ` — ${label}` : ''}`,
      android: {
        channelId: CHANNEL_TIMER,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        onlyAlertOnce: true,
        pressAction: openApp,
        actions: [
          {title: 'Resume', pressAction: {id: ACTION_RESUME}},
          {title: 'Reset', pressAction: {id: ACTION_RESTART}},
          {title: 'Stop', pressAction: {id: ACTION_STOP}},
        ],
      },
    });
  } catch (err) {
    console.warn('Timer notification (paused) failed', err);
  }
}

export async function showExpired(label?: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.displayNotification({
      id: TIMER_NOTIFICATION_ID,
      title: "TIME'S UP",
      body: label,
      android: {
        channelId: CHANNEL_EXPIRED,
        asForegroundService: true,
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
        ],
        color: colors.primary,
        ongoing: true,
        autoCancel: false,
        pressAction: openApp,
        actions: [{title: 'Stop', pressAction: {id: ACTION_STOP}}],
      },
    });
  } catch (err) {
    console.warn('Timer notification (expired) failed', err);
  }
}

export async function hide(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.stopForegroundService();
    await notifee.cancelNotification(TIMER_NOTIFICATION_ID);
  } catch (err) {
    console.warn('Hiding timer notification failed', err);
  }
}

/** Doze belt-and-braces: AlarmManager fires the expiry even if JS froze. */
export async function scheduleExpiryTrigger(
  endAt: number,
  label?: string,
): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await ensureChannels();
    await notifee.createTriggerNotification(
      {
        id: TIMER_NOTIFICATION_ID,
        title: "TIME'S UP",
        body: label,
        android: {
          channelId: CHANNEL_EXPIRED,
          pressAction: openApp,
          actions: [{title: 'Stop', pressAction: {id: ACTION_STOP}}],
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp: endAt,
        alarmManager: {allowWhileIdle: true},
      },
    );
  } catch (err) {
    console.warn('Scheduling timer expiry trigger failed', err);
  }
}

export async function cancelExpiryTrigger(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await notifee.cancelTriggerNotification(TIMER_NOTIFICATION_ID);
  } catch (err) {
    console.warn('Cancelling timer expiry trigger failed', err);
  }
}
```

- [ ] **Step 5: Test laufen lassen — muss passen**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest __tests__/timerNotification.test.ts
```

Expected: PASS (alle Tests grün).

- [ ] **Step 6: Commit**

```bash
git add __mocks__/@notifee/react-native.js src/common/timerNotification.ts __tests__/timerNotification.test.ts
git commit -m "feat: notifee wrapper for timer countdown notification"
```

---

### Task 3: Globaler `timerController.ts` (TDD)

**Files:**
- Create: `src/common/timerController.ts`
- Test: `__tests__/timerController.test.ts`

**Interfaces:**
- Consumes: alle `timerNotification`-Funktionen aus Task 2 (exakte Signaturen dort); `startAlarm()` / `stopAlarm()` aus `src/common/timerSound.ts`.
- Produces (von Task 4/5 benutzt):
  - `type TimerStatus = 'idle' | 'running' | 'paused' | 'expired'`
  - `interface TimerSnapshot {status: TimerStatus; target: number; remaining: number; ownerKey: string | null}`
  - `start(durationSec: number, owner: string, ownerLabel?: string): void`
  - `pause(): void`, `resume(): void`, `reset(): void`, `restart(): void`, `stop(): void`
  - `subscribe(listener: () => void): () => void`
  - `getSnapshot(): TimerSnapshot` (stabile Objekt-Identität bis zur nächsten Änderung — `useSyncExternalStore`-Anforderung)
  - `_resetForTests(): void`

- [ ] **Step 1: Failing Test schreiben**

`__tests__/timerController.test.ts`:

```ts
/**
 * timerController unit tests — modern fake timers drive both setInterval
 * AND Date.now (advanceTimersByTime moves the mocked clock), so the
 * wall-clock state machine is tested exactly as it runs on device.
 * Notification layer and alarm are mocked out.
 */
jest.mock('../src/common/timerNotification', () => ({
  ensurePermission: jest.fn(async () => {}),
  showRunning: jest.fn(async () => {}),
  showPaused: jest.fn(async () => {}),
  showExpired: jest.fn(async () => {}),
  hide: jest.fn(async () => {}),
  scheduleExpiryTrigger: jest.fn(async () => {}),
  cancelExpiryTrigger: jest.fn(async () => {}),
  wireTimerEvents: jest.fn(),
}));
jest.mock('../src/common/timerSound', () => ({
  startAlarm: jest.fn(),
  stopAlarm: jest.fn(),
}));

import * as controller from '../src/common/timerController';
import * as notification from '../src/common/timerNotification';
import {startAlarm, stopAlarm} from '../src/common/timerSound';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(1_000_000);
  controller._resetForTests();
  jest.clearAllMocks();
});

afterEach(() => {
  jest.useRealTimers();
});

test('start → running with full remaining and owner', () => {
  controller.start(90, 'se-1', 'Dead Hang');
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    remaining: 90,
    target: 90,
    ownerKey: 'se-1',
  });
});

test('remaining derives from the wall clock, not tick counting', () => {
  controller.start(60, 'se-1');
  // Simulate Android freezing JS: clock jumps 25s while only ONE tick runs.
  jest.setSystemTime(1_000_000 + 25_000);
  jest.advanceTimersByTime(250);
  expect(controller.getSnapshot().remaining).toBe(35);
});

test('pause holds remaining, resume continues from it', () => {
  controller.start(60, 'se-1');
  jest.advanceTimersByTime(10_000);
  controller.pause();
  expect(controller.getSnapshot().status).toBe('paused');
  expect(controller.getSnapshot().remaining).toBe(50);
  jest.advanceTimersByTime(30_000); // paused: nothing moves
  expect(controller.getSnapshot().remaining).toBe(50);
  controller.resume();
  jest.advanceTimersByTime(5_000);
  expect(controller.getSnapshot().remaining).toBe(45);
});

test('expiry → expired, alarm starts, expired notification shown', async () => {
  controller.start(5, 'se-1');
  await jest.advanceTimersByTimeAsync(5_250);
  expect(controller.getSnapshot().status).toBe('expired');
  expect(controller.getSnapshot().remaining).toBe(0);
  expect(startAlarm).toHaveBeenCalledTimes(1);
  expect(notification.cancelExpiryTrigger).toHaveBeenCalled();
  expect(notification.showExpired).toHaveBeenCalled();
});

test('starting a new timer replaces the running one', () => {
  controller.start(60, 'se-1');
  jest.advanceTimersByTime(10_000);
  controller.start(30, 'se-2');
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    target: 30,
    remaining: 30,
    ownerKey: 'se-2',
  });
});

test('reset returns to idle at full duration, keeps owner, stops alarm', async () => {
  controller.start(60, 'se-1');
  await jest.advanceTimersByTimeAsync(60_250); // run into expiry
  controller.reset();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'idle',
    remaining: 60,
    ownerKey: 'se-1',
  });
  expect(stopAlarm).toHaveBeenCalled();
  await Promise.resolve();
  await Promise.resolve();
  expect(notification.hide).toHaveBeenCalled();
});

test('stop clears owner and hides the notification', async () => {
  controller.start(60, 'se-1');
  controller.stop();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'idle',
    ownerKey: null,
  });
  expect(stopAlarm).toHaveBeenCalled();
  await Promise.resolve();
  await Promise.resolve();
  expect(notification.hide).toHaveBeenCalled();
});

test('restart runs the same timer again from full duration', () => {
  controller.start(45, 'se-1');
  jest.advanceTimersByTime(20_000);
  controller.restart();
  expect(controller.getSnapshot()).toMatchObject({
    status: 'running',
    remaining: 45,
    ownerKey: 'se-1',
  });
});

test('snapshot identity is stable between changes (useSyncExternalStore)', () => {
  controller.start(60, 'se-1');
  const a = controller.getSnapshot();
  const b = controller.getSnapshot();
  expect(a).toBe(b);
  jest.advanceTimersByTime(1_000);
  expect(controller.getSnapshot()).not.toBe(a);
});

test('subscribers fire on change and can unsubscribe', () => {
  const listener = jest.fn();
  const unsub = controller.subscribe(listener);
  controller.start(60, 'se-1');
  expect(listener).toHaveBeenCalled();
  listener.mockClear();
  unsub();
  controller.stop();
  expect(listener).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Test laufen lassen — muss failen**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest __tests__/timerController.test.ts
```

Expected: FAIL — `Cannot find module '../src/common/timerController'`.

- [ ] **Step 3: `src/common/timerController.ts` implementieren**

```ts
// src/common/timerController.ts
//
// The single global workout timer. There is exactly one active timer;
// starting a new one replaces it. State lives outside React so the timer
// keeps running when cards unmount and while the app is backgrounded
// (the notifee foreground service keeps the JS runtime ticking).
//
// Time is wall-clock based: start() records an absolute end timestamp
// and remaining time is always derived from Date.now(). The tick only
// refreshes subscribers — even if Android freezes JS for minutes, the
// timer is correct the moment anything recomputes.
//
// This module is the only caller of the notification layer
// (timerNotification.ts) and the alarm (timerSound.ts). Components and
// notification buttons both act through this API, which keeps in-app UI
// and notification in sync by construction. Notification calls are
// fire-and-forget: they never gate a state transition.

import {AppState} from 'react-native';

import {startAlarm, stopAlarm} from './timerSound';
import * as timerNotification from './timerNotification';

export type TimerStatus = 'idle' | 'running' | 'paused' | 'expired';

export interface TimerSnapshot {
  status: TimerStatus;
  /** Duration the active timer was started with (seconds). */
  target: number;
  /** Remaining seconds — wall-clock derived while running. */
  remaining: number;
  /** Identity of the card that started the timer; null after stop(). */
  ownerKey: string | null;
}

type Listener = () => void;

const TICK_MS = 250;

let status: TimerStatus = 'idle';
let target = 0;
let ownerKey: string | null = null;
let label: string | undefined;
let endAt: number | null = null; // epoch ms while running
let remainingAtPause = 0;
let tick: ReturnType<typeof setInterval> | null = null;

const listeners = new Set<Listener>();
let snapshot: TimerSnapshot = {
  status: 'idle',
  target: 0,
  remaining: 0,
  ownerKey: null,
};

function currentRemaining(): number {
  if (status === 'running' && endAt != null) {
    return Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
  }
  if (status === 'paused') return remainingAtPause;
  if (status === 'expired') return 0;
  return target;
}

function emit(): void {
  const remaining = currentRemaining();
  if (
    snapshot.status === status &&
    snapshot.target === target &&
    snapshot.remaining === remaining &&
    snapshot.ownerKey === ownerKey
  ) {
    return;
  }
  snapshot = {status, target, remaining, ownerKey};
  listeners.forEach(l => l());
}

function stopTick(): void {
  if (tick != null) clearInterval(tick);
  tick = null;
}

function startTick(): void {
  stopTick();
  tick = setInterval(onTick, TICK_MS);
}

function onTick(): void {
  if (status !== 'running') return;
  if (currentRemaining() <= 0) {
    expire();
    return;
  }
  emit();
}

function expire(): void {
  stopTick();
  status = 'expired';
  endAt = null;
  emit();
  startAlarm();
  // Cancel BEFORE showing: trigger and display share one notification id,
  // and cancelling the trigger also removes a displayed notification.
  timerNotification
    .cancelExpiryTrigger()
    .then(() => timerNotification.showExpired(label));
}

// -- public API ------------------------------------------------------------

export function start(
  durationSec: number,
  owner: string,
  ownerLabel?: string,
): void {
  stopAlarm(); // a replaced timer may be mid-alarm
  stopTick();
  status = 'running';
  target = durationSec;
  ownerKey = owner;
  label = ownerLabel;
  endAt = Date.now() + durationSec * 1000;
  remainingAtPause = 0;
  startTick();
  emit();
  const at = endAt;
  timerNotification
    .ensurePermission()
    .then(() => timerNotification.cancelExpiryTrigger())
    .then(() => timerNotification.showRunning(at, label))
    .then(() => timerNotification.scheduleExpiryTrigger(at, label));
}

export function pause(): void {
  if (status !== 'running') return;
  remainingAtPause = currentRemaining();
  status = 'paused';
  endAt = null;
  stopTick();
  emit();
  timerNotification
    .cancelExpiryTrigger()
    .then(() => timerNotification.showPaused(remainingAtPause, label));
}

export function resume(): void {
  if (status !== 'paused') return;
  status = 'running';
  endAt = Date.now() + remainingAtPause * 1000;
  startTick();
  emit();
  const at = endAt;
  timerNotification
    .showRunning(at, label)
    .then(() => timerNotification.scheduleExpiryTrigger(at, label));
}

/** In-app RESET: back to idle at full duration; notification goes away. */
export function reset(): void {
  stopAlarm();
  stopTick();
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  emit();
  timerNotification.cancelExpiryTrigger().then(() => timerNotification.hide());
}

/** Notification RESET: restart the same timer from its full duration. */
export function restart(): void {
  if (ownerKey == null || target <= 0) return;
  start(target, ownerKey, label);
}

/** Full dismiss: stop alarm, clear owner, remove notification. */
export function stop(): void {
  stopAlarm();
  stopTick();
  status = 'idle';
  endAt = null;
  remainingAtPause = 0;
  ownerKey = null;
  label = undefined;
  target = 0;
  emit();
  timerNotification.cancelExpiryTrigger().then(() => timerNotification.hide());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): TimerSnapshot {
  return snapshot;
}

/** Doze path: the AlarmManager trigger fired although JS was frozen. */
function onExpiryTrigger(): void {
  if (status === 'running' && currentRemaining() <= 0) {
    expire();
  }
}

// Recompute immediately when the app returns to the foreground — while
// backgrounded without the service the interval may not have run.
AppState.addEventListener('change', state => {
  if (state === 'active' && status === 'running') onTick();
});

timerNotification.wireTimerEvents({pause, resume, restart, stop, onExpiryTrigger});

/** Test-only: restore pristine module state between test cases. */
export function _resetForTests(): void {
  stopTick();
  status = 'idle';
  target = 0;
  ownerKey = null;
  label = undefined;
  endAt = null;
  remainingAtPause = 0;
  listeners.clear();
  snapshot = {status: 'idle', target: 0, remaining: 0, ownerKey: null};
}
```

- [ ] **Step 4: Test laufen lassen — muss passen**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest __tests__/timerController.test.ts
```

Expected: PASS.

- [ ] **Step 5: Gesamte Suite laufen lassen**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest
```

Expected: alle Suites PASS (inkl. der bestehenden seed-/DB-Tests).

- [ ] **Step 6: Commit**

```bash
git add src/common/timerController.ts __tests__/timerController.test.ts
git commit -m "feat: global wall-clock timer controller driving notification + alarm"
```

---

### Task 4: `useTimer`-Hook + `InlineTimer` auf den Controller umstellen

**Files:**
- Create: `src/hooks/useTimer.ts`
- Modify: `src/components/InlineTimer.tsx`
- Modify: `src/components/Exercise.tsx:197-201` (InlineTimer-Aufruf)

**Interfaces:**
- Consumes: `subscribe`/`getSnapshot`/`start`/`pause`/`resume`/`reset` + `TimerSnapshot`/`TimerStatus` aus Task 3.
- Produces: `useTimer(ownerKey: string): {status: TimerStatus; remaining: number | null; isOwner: boolean}` — `status` ist `'idle'` für Nicht-Owner; `remaining` ist `null`, wenn der Card-eigene Fallback (lokales `target`) gelten soll. Neue Props von `InlineTimer`: `{duration: number; ownerKey: string; label?: string; onExpand?: () => void}`.

- [ ] **Step 1: Hook anlegen**

`src/hooks/useTimer.ts`:

```ts
// src/hooks/useTimer.ts
//
// View adapter for the global timerController. Each timer card calls
// useTimer(ownerKey) — the hook reports the global timer state only when
// this card owns it; otherwise the card sees 'idle' and renders its own
// prescription. remaining === null means "use your local duration".

import {useSyncExternalStore} from 'react';

import {getSnapshot, subscribe} from '../common/timerController';
import type {TimerStatus} from '../common/timerController';

export interface OwnedTimer {
  status: TimerStatus;
  remaining: number | null;
  isOwner: boolean;
}

export function useTimer(ownerKey: string): OwnedTimer {
  const snap = useSyncExternalStore(subscribe, getSnapshot);
  const isOwner = snap.ownerKey === ownerKey;
  if (!isOwner || snap.status === 'idle') {
    return {status: 'idle', remaining: null, isOwner};
  }
  return {status: snap.status, remaining: snap.remaining, isOwner};
}
```

- [ ] **Step 2: `InlineTimer.tsx` umbauen**

Der Datei-Kopf (Kommentar, Imports, Props, Logik bis vor `const {mm, ss} = format(timeLeft);`) wird komplett ersetzt; ab `const {mm, ss} = …` bleiben Render-JSX und `styles` unverändert bestehen. Neuer Kopf:

```tsx
// src/components/InlineTimer.tsx
//
// In-card countdown view over the global timerController. State machine
// (owned by the controller, not this component):
//   idle    → ▶ START (+ EDIT, EXPAND)
//   running → ⏸ PAUSE (+ EXPAND)
//   paused  → ↻ RESET ▶ RESUME (+ EXPAND)
//   expired → ↻ RESET (digits blink; alarm rings until RESET/STOP)
//
// Only the card that started the timer (ownerKey) renders live state —
// other cards keep showing their own idle prescription. Edit mode is
// local: it changes the duration the NEXT start uses, nothing global.

import React from 'react';
import {Animated, Pressable, StyleSheet, TextInput, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';

import AppText from './AppText';
import * as timerController from '../common/timerController';
import {useTimer} from '../hooks/useTimer';
import {colors} from '../common/theme';

interface Props {
  duration: number;
  ownerKey: string;
  label?: string;
  onExpand?: () => void;
}

function format(t: number): {mm: string; ss: string} {
  const safe = Math.max(0, Math.floor(t));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return {mm: String(m).padStart(2, '0'), ss: String(s).padStart(2, '0')};
}

const InlineTimer: React.FC<Props> = ({duration, ownerKey, label, onExpand}) => {
  // duration the next START uses — the prescription until edited
  const [target, setTarget] = React.useState(duration);
  const timer = useTimer(ownerKey);
  const status = timer.status;
  const timeLeft = timer.remaining ?? target;

  const [editing, setEditing] = React.useState(false);
  const [editMin, setEditMin] = React.useState('0');
  const [editSec, setEditSec] = React.useState('0');

  const blink = React.useRef(new Animated.Value(1)).current;
  useKeepAwake();

  // -- blink while expired --
  React.useEffect(() => {
    if (status !== 'expired') {
      blink.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, {
          toValue: 0.25,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(blink, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, blink]);

  // re-sync if the prescription itself changes (e.g. re-mount with a new set)
  React.useEffect(() => {
    setTarget(duration);
  }, [duration]);

  // -- actions --
  function startOrResume() {
    if (status === 'paused') {
      timerController.resume();
      return;
    }
    if (target === 0) return;
    timerController.start(target, ownerKey, label);
  }
  function pause() {
    timerController.pause();
  }
  function reset() {
    timerController.reset();
  }
  function enterEdit() {
    if (status !== 'idle') return;
    const {mm, ss} = format(target);
    setEditMin(String(parseInt(mm, 10)));
    setEditSec(String(parseInt(ss, 10)));
    setEditing(true);
  }
  function saveEdit() {
    const m = Math.max(0, parseInt(editMin, 10) || 0);
    const s = Math.max(0, Math.min(59, parseInt(editSec, 10) || 0));
    setTarget(m * 60 + s);
    setEditing(false);
  }
  function cancelEdit() {
    setEditing(false);
  }
```

Alles ab `const {mm, ss} = format(timeLeft);` (Zeile 141 der alten Datei) bleibt **unverändert** — inklusive `progress`-Berechnung, beider Render-Zweige und des kompletten `styles`-Blocks. Ersatzlos entfallen: der `-- tick --`-Effect, der Alarm-Effect (`startAlarm`/`stopAlarm`-Import entfällt mit) und die `setStatus`/`setTimeLeft`-Aufrufe.

- [ ] **Step 3: `Exercise.tsx` — InlineTimer-Aufruf erweitern**

In `src/components/Exercise.tsx` den bestehenden Aufruf (Zeilen 198–201):

```tsx
          <InlineTimer
            duration={exercise.prescribed_seconds ?? 0}
            onExpand={openTimer}
          />
```

ersetzen durch:

```tsx
          <InlineTimer
            duration={exercise.prescribed_seconds ?? 0}
            ownerKey={`se-${exercise.id}`}
            label={exercise.exercise_name}
            onExpand={openTimer}
          />
```

- [ ] **Step 4: Suite + TS-Diff verifizieren**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest
```

Expected: PASS.

```bash
cd /home/pascal/Code/workout-warden
git worktree add --detach /tmp/ww-head HEAD 2>/dev/null || true
ln -sfn /home/pascal/Code/workout-warden/node_modules /tmp/ww-head/node_modules
(cd /tmp/ww-head && node_modules/.bin/tsc --noEmit 2>&1 | sort > /tmp/tsc-before.txt)
node_modules/.bin/tsc --noEmit 2>&1 | sort > /tmp/tsc-after.txt
diff /tmp/tsc-before.txt /tmp/tsc-after.txt
```

Expected: Diff zeigt keine NEUEN Fehler in `timerController.ts`, `timerNotification.ts`, `useTimer.ts`, `InlineTimer.tsx`, `Exercise.tsx` (bekannte Alt-Fehler laut CLAUDE.md bleiben).

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useTimer.ts src/components/InlineTimer.tsx src/components/Exercise.tsx
git commit -m "refactor: InlineTimer renders the global timer via useTimer"
```

---

### Task 5: `CountdownTimer` auf den Controller umstellen

**Files:**
- Modify: `src/components/CountdownTimer.tsx` (kompletter Ersatz der Logik, Styles bleiben)
- Modify: `src/components/Exercise.tsx:252-255` (CountdownTimer-Aufruf)

**Interfaces:**
- Consumes: `useTimer` (Task 4), Controller-API (Task 3). Neue Props: `{duration: number; ownerKey: string; label?: string; close: () => void}`.
- Produces: nichts Neues für andere Tasks.

- [ ] **Step 1: `CountdownTimer.tsx` umbauen**

Kompletter neuer Inhalt bis vor `const styles = StyleSheet.create({` (der `styles`-Block am Dateiende bleibt unverändert):

```tsx
// src/components/CountdownTimer.tsx
//
// Fullscreen view over the SAME global timer as the InlineTimer card it
// was expanded from (same ownerKey) — closing the modal does not stop
// the timer. Edit mode is local: it changes the duration the next start
// uses.

import React, {useState, useEffect} from 'react';
import {View, Button, StyleSheet, Pressable, Animated} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';
import {useKeepAwake} from '@sayem314/react-native-keep-awake';

import AppText from './AppText';
import AppInput from './AppInput';
import * as timerController from '../common/timerController';
import {useTimer} from '../hooks/useTimer';
import {colors} from '../common/theme';
import {row} from '../common/styles';

interface Props {
  duration: number;
  ownerKey: string;
  label?: string;
  close: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const CountdownTimer: React.FC<Props> = ({duration, ownerKey, label, close}) => {
  // duration the next START uses — the prescription until edited
  const [target, setTarget] = useState(duration);
  const [edit, setEdit] = useState(false);
  const timer = useTimer(ownerKey);

  const isActive = timer.status === 'running';
  const isBlinking = timer.status === 'expired';
  const remaining = timer.remaining ?? target;

  const blinkAnim = React.useRef(new Animated.Value(1)).current;

  useKeepAwake();

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;

  useEffect(() => {
    let isMounted = true;

    const blinkingAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(blinkAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(blinkAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );

    if (isMounted && isBlinking) blinkingAnimation?.start();

    return () => {
      isMounted = false;
      blinkingAnimation.stop();
      blinkAnim.setValue(1);
    };
  }, [isBlinking, blinkAnim]);

  const toggleTimer = () => {
    if (edit) return;
    if (timer.status === 'running') {
      timerController.pause();
      return;
    }
    if (timer.status === 'paused') {
      timerController.resume();
      return;
    }
    if (timer.status === 'expired') {
      timerController.reset();
      return;
    }
    if (target === 0) return;
    timerController.start(target, ownerKey, label);
  };

  function resetTimer() {
    timerController.reset();
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.close} onPress={close}>
        <MaterialIcons name={'cancel'} color={colors.primary} size={30} />
      </Pressable>

      <AnimatedPressable
        onPress={toggleTimer}
        style={[styles.circle, {opacity: blinkAnim}]}>
        {edit ? (
          <View style={styles.edit}>
            <AppInput
              setValue={value =>
                setTarget(
                  Math.max(0, parseInt(value, 10) || 0) * 60 + (target % 60),
                )
              }
              value={Math.floor(target / 60).toString()}
              keyboardType="numeric"
            />
            <AppText>:</AppText>
            <AppInput
              setValue={value =>
                setTarget(
                  Math.floor(target / 60) * 60 +
                    Math.min(59, Math.max(0, parseInt(value, 10) || 0)),
                )
              }
              value={(target % 60).toString()}
              keyboardType="numeric"
            />
          </View>
        ) : (
          <AppText bold style={styles.timeText}>
            {`${minutes}:${seconds < 10 ? '0' : ''}${seconds}`}
          </AppText>
        )}
      </AnimatedPressable>

      <View style={{width: '100%', gap: 16}}>
        <Button
          disabled={edit}
          color={colors.primary}
          title={isActive ? 'Pause' : 'Start'}
          onPress={toggleTimer}
        />

        <Button
          disabled={timer.status !== 'idle'}
          color={colors.primary}
          title={edit ? 'Done' : 'Edit Time'}
          onPress={() => setEdit(state => !state)}
        />

        <Button color={colors.primary} title="Reset" onPress={resetTimer} />
      </View>
    </View>
  );
};
```

- [ ] **Step 2: `Exercise.tsx` — CountdownTimer-Aufruf erweitern**

Bestehenden Aufruf (Zeilen 252–255):

```tsx
          <CountdownTimer
            close={close}
            duration={exercise.prescribed_seconds ?? 0}
          />
```

ersetzen durch:

```tsx
          <CountdownTimer
            close={close}
            duration={exercise.prescribed_seconds ?? 0}
            ownerKey={`se-${exercise.id}`}
            label={exercise.exercise_name}
          />
```

- [ ] **Step 3: Suite + TS-Diff verifizieren**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest
node_modules/.bin/tsc --noEmit 2>&1 | sort > /tmp/tsc-after.txt
diff /tmp/tsc-before.txt /tmp/tsc-after.txt
git worktree remove /tmp/ww-head --force
```

Expected: Jest PASS; keine neuen tsc-Fehler in den angefassten Dateien.

- [ ] **Step 4: Commit**

```bash
git add src/components/CountdownTimer.tsx src/components/Exercise.tsx
git commit -m "refactor: CountdownTimer renders the global timer via useTimer"
```

---

### Task 6: `index.js`-Wiring (Foreground-Service + Background-Events)

**Files:**
- Modify: `index.js`

**Interfaces:**
- Consumes: `handleNotifeeEvent` (Task 2); Import von `./src/common/timerController` (Task 3) für das Event-Wiring im Headless-Kontext.
- Produces: registrierter notifee-Foreground-Service-Runner + Background-Event-Handler (App-Level, keine Exports).

- [ ] **Step 1: `index.js` ersetzen**

Kompletter neuer Inhalt:

```js
/**
 * @format
 */

import {AppRegistry, UIManager, Platform} from 'react-native';
import notifee from '@notifee/react-native';
import App from './src/App';
import {name as appName} from './app.json';
// Importing the controller wires the notification-event handlers — must
// happen before onBackgroundEvent below so headless action presses
// (pause/reset/stop from the notification) reach the state machine.
import './src/common/timerController';
import {handleNotifeeEvent} from './src/common/timerNotification';

if (Platform.OS === 'android') {
  if (UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  // Keeps the countdown notification's foreground service alive. The
  // promise intentionally never resolves — notifee.stopForegroundService()
  // (called via timerNotification.hide()) is what ends the service.
  notifee.registerForegroundService(() => new Promise(() => {}));
  notifee.onBackgroundEvent(handleNotifeeEvent);
}

AppRegistry.registerComponent(appName, () => App);
```

- [ ] **Step 2: Suite + Debug-Build verifizieren**

```bash
cd /home/pascal/Code/workout-warden && node_modules/.bin/jest
cd android && ./gradlew :app:assembleDebug
```

Expected: Jest PASS; `BUILD SUCCESSFUL`.

- [ ] **Step 3: Commit**

```bash
git add index.js
git commit -m "feat: register notifee foreground service + background timer events"
```

---

### Task 7: Release-Build, Sideload, manuelle QA

**Files:**
- Modify: `package.json`, `android/app/build.gradle` (Version-Bump via Script)

**Interfaces:**
- Consumes: komplette Feature-Kette aus Tasks 1–6.
- Produces: installierte, verifizierte Release-Version auf dem Pixel 7.

- [ ] **Step 1: Version bumpen (VOR dem Sideload — CLAUDE.md-Regel)**

```bash
cd /home/pascal/Code/workout-warden
npm version patch --no-git-tag-version && node update-android-version.js
```

Expected: `package.json` und `android/app/build.gradle` zeigen die neue Version (`versionName` synchron, `versionCode` +1).

- [ ] **Step 2: Release bauen und sideloaden**

```bash
cd /home/pascal/Code/workout-warden/android && ./gradlew assembleRelease
adb -s 34061FDH2005AW install -r app/build/outputs/apk/release/app-release.apk
adb -s 34061FDH2005AW shell dumpsys package com.workoutwarden | grep -E "versionName|lastUpdateTime"
```

Expected: `dumpsys` zeigt die NEUE versionName (der Install-Befehl druckt auf diesem Gerät auch bei Erfolg `failed: Performing Streamed Install` — nur dumpsys zählt; bei leerer Ausgabe nach ein paar Sekunden wiederholen, USB droppt häufig).

- [ ] **Step 3: Manuelle QA auf dem Gerät (User macht die Handgriffe)**

Checkliste — jede Zeile muss bestehen:

1. Timer-Übung öffnen, START → beim ersten Mal erscheint der POST_NOTIFICATIONS-Dialog; erlauben.
2. Notification erscheint mit live runterzählendem Chronometer; App wechseln (z.B. Chrome) → Countdown läuft in der Statusleiste weiter.
3. PAUSE in der Notification → Notification zeigt „PAUSED · M:SS"; App öffnen → Karte zeigt paused mit derselben Restzeit.
4. RESUME aus der Notification, dann ablaufen lassen bei ausgeschaltetem Display → Alarm (Ton + Dauervibration) klingelt; Notification zeigt „TIME'S UP".
5. STOP in der Notification → Alarm verstummt, Notification verschwindet, Karte in der App ist idle.
6. Timer starten, in der App RESET → Notification verschwindet, Karte zeigt volle Dauer.
7. Timer auf Übung A starten, dann START auf Übung B → A zeigt wieder seine Prescription, Notification + B zeigen den neuen Timer.
8. Ablauf-Notification („Timer finished"-Channel) ist selbst LAUTLOS (kein Doppel-Sound neben dem TimerSound-Alarm). Falls der Channel doch tönt: in `timerNotification.ts` beim `CHANNEL_EXPIRED` `importance` auf `AndroidImportance.LOW` senken (Trade-off: kein Heads-up) und neu bauen.
9. Fullscreen-Modal (EXPAND) zeigt denselben laufenden Timer wie die Karte; Modal schließen stoppt ihn nicht.

- [ ] **Step 4: Release committen**

```bash
cd /home/pascal/Code/workout-warden
git add package.json package-lock.json android/app/build.gradle
git commit -m "v<NEUE_VERSION>: background timer + countdown notification"
```

(`<NEUE_VERSION>` = die in Step 1 gebumpte Version, z.B. `2.2.5`.)
