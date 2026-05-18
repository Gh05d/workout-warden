# Home Dashboard + Plan Switcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the minimal v2.0 Home screen with a four-card dashboard (active plan + switcher modal, next-up session, current-week progress, dog/quote vibe) and propagate plan changes to the Sessions/Weeks tabs so a plan switch takes effect without an app restart.

**Architecture:** Add one new DB read (`fetchHomeSummary`) returning the data all cards need in three SQL calls. Each card is its own small component under `src/components/`. The plan switcher is a Modal owned by Home. Plan-switch propagation uses React Navigation's `useFocusEffect` in `Routes.SessionsTabs` and `screens/Weeks` — when those screens regain focus they re-read `active_plan_id` from settings.

**Tech Stack:** React Native 0.85, SQLite via `react-native-sqlite-storage` (production) + `better-sqlite3` (tests), React Navigation 7, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-05-18-home-dashboard-plan-switcher-design.md`

---

## File Structure

**New files:**
- `src/components/PlanCard.tsx` — active-plan summary tile; tap = open modal (via prop callback)
- `src/components/PlanSwitcherModal.tsx` — Modal listing plans with active checkmark
- `src/components/NextSessionCard.tsx` — "next up" tile with Start/CreateWeek button
- `src/components/ProgressCard.tsx` — week progress bar with done/total + date range
- `src/components/VibeCard.tsx` — dog image + random quote (extracted from current Home)
- `__tests__/fetchHomeSummary.test.ts` — integration tests for the new query using `better-sqlite3` against a temp DB

**Modified files:**
- `src/common/databaseService.ts` — add `HomeSummary` interface + `fetchHomeSummary(db)`
- `src/screens/Home.tsx` — full rewrite into card-based layout
- `src/Routes.tsx` — `SessionsTabs` switches `useEffect` to `useFocusEffect`
- `src/screens/Weeks.tsx` — same `useFocusEffect` change + remove redundant plan-tabs row

**Unchanged but referenced for context:**
- `src/common/types.ts` — already exports `Plan`, `Week`, `Session` shapes used here
- `src/common/theme.ts` — supplies `colors.primary`, `colors.secondary`

---

## Task 1: Add `fetchHomeSummary` + `HomeSummary` type + integration tests

**Files:**
- Modify: `src/common/databaseService.ts`
- Create: `__tests__/fetchHomeSummary.test.ts`

The integration test uses `better-sqlite3` (already a devDep from v2 Task 23) against a temp file DB so it can exercise the real SQL. We adapt the API surface so `fetchHomeSummary` accepts any object with `executeSql` — letting the test inject a thin adapter around the better-sqlite3 sync API.

- [ ] **Step 1: Add types in databaseService.ts**

Open `src/common/databaseService.ts`. Find the existing `StatsPoint` interface (search for `export interface StatsPoint`) and ADD this new interface immediately before it:

```ts
export interface HomeSummary {
  activePlan: Plan;
  currentWeek: Week | null;
  nextSession: Session | null;
}
```

- [ ] **Step 2: Add fetchHomeSummary at the end of databaseService.ts**

Append to the end of `src/common/databaseService.ts`:

```ts
export async function fetchHomeSummary(
  db: SQLiteDatabase,
): Promise<HomeSummary | null> {
  const activePlanId = await fetchActivePlanId(db);
  if (activePlanId == null) return null;

  const [planRes] = await db.executeSql(
    `SELECT id, slug, name, description FROM plans WHERE id = ?`,
    [activePlanId],
  );
  if (planRes.rows.length === 0) return null;
  const activePlan = planRes.rows.item(0) as Plan;

  const [weekRes] = await db.executeSql(
    `SELECT w.id AS week_id, w.created_at, w.finished AS week_finished,
            s.id AS session_id, s.day_index, s.weekday_label, s.session_name,
            s.trained_at, s.finished AS session_finished, s.notes
     FROM weeks w
     LEFT JOIN sessions s ON s.week_id = w.id
     WHERE w.plan_id = ?
       AND w.id = (SELECT MAX(id) FROM weeks WHERE plan_id = ?)
     ORDER BY s.day_index ASC`,
    [activePlanId, activePlanId],
  );

  const rows = weekRes.rows.raw();
  if (rows.length === 0) {
    return {activePlan, currentWeek: null, nextSession: null};
  }

  const first = rows[0];
  const sessions: Session[] = rows
    .filter(r => r.session_id != null)
    .map(r => ({
      id: r.session_id,
      week_id: r.week_id,
      day_index: r.day_index,
      weekday_label: r.weekday_label,
      session_name: r.session_name,
      trained_at: r.trained_at,
      finished: r.session_finished,
      notes: r.notes,
      exercises: [],
    }));

  const currentWeek: Week = {
    id: first.week_id,
    plan_id: activePlanId,
    created_at: first.created_at,
    finished: first.week_finished,
    sessions,
  };

  const nextSession = sessions.find(s => !s.finished) ?? null;

  return {activePlan, currentWeek, nextSession};
}
```

- [ ] **Step 3: Write integration tests using better-sqlite3 with a tsconfig-safe adapter**

Create `__tests__/fetchHomeSummary.test.ts`:

```ts
import Database from 'better-sqlite3';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fetchHomeSummary} from '../src/common/databaseService';

const schemaSql = readFileSync(
  resolve(__dirname, '../scripts/schema-v2.sql'),
  'utf8',
)
  .split(/\n--[^\n]*/)
  .join('')
  .split(/;\s*\n/)
  .map(s => s.trim())
  .filter(s => s.length > 0);

function makeDb() {
  const raw = new Database(':memory:');
  raw.pragma('foreign_keys = ON');
  for (const stmt of schemaSql) raw.exec(stmt);
  raw.exec(
    `INSERT INTO plans (id, slug, name, description) VALUES (1, 'surf', 'Surf', '5-day plan')`,
  );
  raw.exec(
    `INSERT INTO settings (key, value) VALUES ('active_plan_id', '1')`,
  );
  // Adapter so fetchHomeSummary's `db.executeSql` works against better-sqlite3
  return {
    executeSql: async (sql: string, params: unknown[] = []) => {
      const trimmed = sql.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA')) {
        const stmt = raw.prepare(sql);
        const arr = stmt.all(...params) as Record<string, unknown>[];
        return [
          {
            rows: {
              length: arr.length,
              item: (i: number) => arr[i],
              raw: () => arr,
            },
          },
        ];
      }
      raw.prepare(sql).run(...params);
      return [{rows: {length: 0, item: () => null, raw: () => []}}];
    },
    _raw: raw,
  } as never;
}

describe('fetchHomeSummary', () => {
  it('returns null when no active plan id is set', async () => {
    const db = makeDb();
    (db as never as {_raw: Database.Database})._raw
      .prepare(`DELETE FROM settings WHERE key = 'active_plan_id'`)
      .run();
    expect(await fetchHomeSummary(db)).toBeNull();
  });

  it('returns plan with null week when no weeks exist', async () => {
    const db = makeDb();
    const summary = await fetchHomeSummary(db);
    expect(summary).not.toBeNull();
    expect(summary!.activePlan.slug).toBe('surf');
    expect(summary!.currentWeek).toBeNull();
    expect(summary!.nextSession).toBeNull();
  });

  it('returns most recent week with first unfinished session as nextSession', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1), (2, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 2, 1, 'Mon', 'Lower', 1),
              (11, 2, 2, 'Tue', 'Upper', 0),
              (12, 2, 3, 'Wed', 'Lower', 0),
              (13, 1, 1, 'Mon', 'Lower', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.id).toBe(2);
    expect(summary!.currentWeek!.sessions).toHaveLength(3);
    expect(summary!.nextSession!.id).toBe(11);
    expect(summary!.nextSession!.day_index).toBe(2);
  });

  it('returns null nextSession when current week is fully finished', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id, finished) VALUES (1, 1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 1, 1, 'Mon', 'Lower', 1), (11, 1, 2, 'Tue', 'Upper', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.currentWeek!.finished).toBe(1);
    expect(summary!.nextSession).toBeNull();
  });

  it('picks lowest day_index when multiple sessions are unfinished', async () => {
    const db = makeDb();
    const raw = (db as never as {_raw: Database.Database})._raw;
    raw.exec(`INSERT INTO weeks (id, plan_id) VALUES (1, 1)`);
    raw.exec(
      `INSERT INTO sessions (id, week_id, day_index, weekday_label, session_name, finished)
       VALUES (10, 1, 3, 'Wed', 'Lower', 0),
              (11, 1, 1, 'Mon', 'Lower', 0),
              (12, 1, 2, 'Tue', 'Upper', 1)`,
    );
    const summary = await fetchHomeSummary(db);
    expect(summary!.nextSession!.day_index).toBe(1);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- -t fetchHomeSummary`
Expected: 5 passing. Existing test suite must still pass — run `npm test` and confirm 28 passing (was 23 + 5 new).

- [ ] **Step 5: Commit**

```bash
git add src/common/databaseService.ts __tests__/fetchHomeSummary.test.ts
git commit -m "Add fetchHomeSummary query + 5 integration tests"
```

---

## Task 2: PlanCard component

**Files:**
- Create: `src/components/PlanCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/PlanCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Plan} from '../common/types';

interface Props {
  plan: Plan;
  onPress: () => void;
}

const PlanCard: React.FC<Props> = ({plan, onPress}) => (
  <Pressable onPress={onPress} style={styles.card}>
    <View style={styles.headerRow}>
      <AppText style={styles.label}>Active Plan</AppText>
      <MaterialIcons name="swap-horiz" size={22} color={colors.primary} />
    </View>
    <AppText bold style={styles.planName}>
      {plan.name}
    </AppText>
    {!!plan.description && (
      <AppText style={styles.description} numberOfLines={2}>
        {plan.description}
      </AppText>
    )}
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  planName: {
    fontSize: 22,
    color: colors.primary,
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#666',
  },
});

export default PlanCard;
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/components/PlanCard.tsx`
Expected: no errors originating from PlanCard.tsx itself.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanCard.tsx
git commit -m "Add PlanCard component"
```

---

## Task 3: PlanSwitcherModal component

**Files:**
- Create: `src/components/PlanSwitcherModal.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/PlanSwitcherModal.tsx
import React from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Plan} from '../common/types';

interface Props {
  visible: boolean;
  plans: Plan[];
  activePlanId: number;
  onSelect: (planId: number) => void;
  onClose: () => void;
}

const PlanSwitcherModal: React.FC<Props> = ({
  visible,
  plans,
  activePlanId,
  onSelect,
  onClose,
}) => (
  <Modal
    visible={visible}
    animationType="slide"
    presentationStyle="pageSheet"
    onRequestClose={onClose}>
    <View style={styles.root}>
      <View style={styles.header}>
        <AppText bold style={styles.title}>
          Switch Plan
        </AppText>
        <Pressable onPress={onClose} hitSlop={12}>
          <MaterialIcons name="close" size={24} color="#666" />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list}>
        {plans.map(p => {
          const isActive = p.id === activePlanId;
          return (
            <Pressable
              key={p.id}
              onPress={() => {
                if (!isActive) onSelect(p.id);
                else onClose();
              }}
              style={[styles.row, isActive && styles.rowActive]}>
              <View style={{flex: 1}}>
                <AppText bold style={styles.rowName}>
                  {p.name}
                </AppText>
                {!!p.description && (
                  <AppText style={styles.rowDescription}>
                    {p.description}
                  </AppText>
                )}
              </View>
              {isActive && (
                <MaterialIcons
                  name="check-circle"
                  size={24}
                  color={colors.primary}
                />
              )}
            </Pressable>
          );
        })}

        {plans.length === 1 && (
          <AppText italic style={styles.hint}>
            Only one plan installed. Edit src/seeds/plans/ to add more.
          </AppText>
        )}
      </ScrollView>
    </View>
  </Modal>
);

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  title: {fontSize: 18},
  list: {padding: 16, gap: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 14,
  },
  rowActive: {
    backgroundColor: '#fff3e0',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  rowName: {fontSize: 16, color: '#222'},
  rowDescription: {fontSize: 13, color: '#666', marginTop: 2},
  hint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 16,
  },
});

export default PlanSwitcherModal;
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/components/PlanSwitcherModal.tsx`
Expected: no errors originating from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/PlanSwitcherModal.tsx
git commit -m "Add PlanSwitcherModal component"
```

---

## Task 4: NextSessionCard component

**Files:**
- Create: `src/components/NextSessionCard.tsx`

This card renders one of three layouts depending on state:
1. "Start Week 1" prompt when no current week
2. "Start Week N+1" prompt when current week is finished
3. "Next up: <session name>" with Start button when current week has unfinished sessions

- [ ] **Step 1: Write the component**

```tsx
// src/components/NextSessionCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import MaterialIcons from '@react-native-vector-icons/material-icons';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Session, Week} from '../common/types';

interface Props {
  currentWeek: Week | null;
  nextSession: Session | null;
  onStartSession: (session: Session, week: Week) => void;
  onCreateNextWeek: () => void;
}

function sessionLabel(s: Session): string {
  return s.weekday_label ? `${s.session_name}: ${s.weekday_label}` : s.session_name;
}

const NextSessionCard: React.FC<Props> = ({
  currentWeek,
  nextSession,
  onStartSession,
  onCreateNextWeek,
}) => {
  // Case 1 + 2: no week OR week finished → prompt to create next week
  if (!currentWeek || currentWeek.finished) {
    const weekNumber = (currentWeek?.id ?? 0) + 1;
    return (
      <Pressable style={styles.card} onPress={onCreateNextWeek}>
        <AppText style={styles.label}>Next up</AppText>
        <AppText bold style={styles.title}>
          {currentWeek ? `Week ${currentWeek.id} done!` : 'Ready to start?'}
        </AppText>
        <View style={styles.actionRow}>
          <AppText style={styles.meta}>
            {currentWeek
              ? `Tap to start Week ${weekNumber}`
              : 'Tap to start Week 1'}
          </AppText>
          <MaterialIcons name="add-circle" size={28} color={colors.primary} />
        </View>
      </Pressable>
    );
  }

  // Case 3: have an unfinished session
  if (!nextSession) {
    // Shouldn't happen if week.finished is consistent with sessions, but render safely
    return (
      <View style={styles.card}>
        <AppText style={styles.label}>Next up</AppText>
        <AppText italic>No next session found</AppText>
      </View>
    );
  }

  const total = currentWeek.sessions.length;
  const dayIndex = nextSession.day_index;
  return (
    <Pressable
      style={styles.card}
      onPress={() => onStartSession(nextSession, currentWeek)}>
      <AppText style={styles.label}>Next up</AppText>
      <AppText bold style={styles.title}>
        {sessionLabel(nextSession)}
      </AppText>
      <View style={styles.actionRow}>
        <AppText style={styles.meta}>
          Week {currentWeek.id} • day {dayIndex}/{total}
        </AppText>
        <View style={styles.startButton}>
          <AppText bold style={styles.startText}>
            Start
          </AppText>
          <MaterialIcons name="play-arrow" size={18} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  title: {fontSize: 20, color: '#222', marginBottom: 8},
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  meta: {fontSize: 13, color: '#666'},
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  startText: {color: '#fff', fontSize: 13},
});

export default NextSessionCard;
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/components/NextSessionCard.tsx`
Expected: no errors originating from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/NextSessionCard.tsx
git commit -m "Add NextSessionCard component"
```

---

## Task 5: ProgressCard component

**Files:**
- Create: `src/components/ProgressCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/ProgressCard.tsx
import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {colors} from '../common/theme';
import type {Week} from '../common/types';

interface Props {
  week: Week;
  onPress: () => void;
}

function shortDate(iso: string | null): string {
  if (!iso) return '?';
  const d = iso.slice(0, 10); // 'YYYY-MM-DD'
  const [, m, day] = d.split('-');
  return `${day}.${m}`;
}

const ProgressCard: React.FC<Props> = ({week, onPress}) => {
  const total = week.sessions.length;
  const done = week.sessions.filter(s => s.finished).length;
  const pct = total === 0 ? 0 : done / total;

  const trainedDates = week.sessions
    .map(s => s.trained_at)
    .filter((d): d is string => !!d);
  const firstDate = trainedDates[0] ?? null;
  const lastDate = trainedDates[trainedDates.length - 1] ?? null;
  const dateRange =
    firstDate && lastDate ? `${shortDate(firstDate)} – ${shortDate(lastDate)}` : '';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <AppText style={styles.label}>Week {week.id}</AppText>
      <View style={styles.barWrapper}>
        <View style={[styles.barFill, {flex: pct}]} />
        <View style={[styles.barEmpty, {flex: 1 - pct}]} />
        <AppText bold style={styles.barLabel}>
          {done}/{total}
        </AppText>
      </View>
      {!!dateRange && <AppText style={styles.dateRange}>{dateRange}</AppText>}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  label: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  barWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 28,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#eee',
    position: 'relative',
  },
  barFill: {height: '100%', backgroundColor: colors.primary},
  barEmpty: {height: '100%'},
  barLabel: {
    position: 'absolute',
    alignSelf: 'center',
    fontSize: 13,
    color: '#222',
  },
  dateRange: {marginTop: 8, fontSize: 13, color: '#666'},
});

export default ProgressCard;
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/components/ProgressCard.tsx`
Expected: no errors originating from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/ProgressCard.tsx
git commit -m "Add ProgressCard component"
```

---

## Task 6: VibeCard component

**Files:**
- Create: `src/components/VibeCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
// src/components/VibeCard.tsx
import React from 'react';
import {Image, StyleSheet, View} from 'react-native';

import AppText from './AppText';
import {DEMOTIVATIONAL_QUOTES} from '../common/quotes';

interface Props {
  puppy: string;
}

const VibeCard: React.FC<Props> = ({puppy}) => {
  // Random quote picked once per mount — stable while the screen is up
  const quote = React.useMemo(
    () =>
      DEMOTIVATIONAL_QUOTES[
        Math.floor(Math.random() * DEMOTIVATIONAL_QUOTES.length)
      ],
    [],
  );

  return (
    <View style={styles.card}>
      {!!puppy && <Image source={{uri: puppy}} style={styles.image} />}
      <AppText italic style={styles.quote}>
        {quote}
      </AppText>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    gap: 12,
  },
  image: {width: '100%', height: 200, borderRadius: 8},
  quote: {fontSize: 14, color: '#444', textAlign: 'center'},
});

export default VibeCard;
```

- [ ] **Step 2: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/components/VibeCard.tsx`
Expected: no errors originating from this file.

- [ ] **Step 3: Commit**

```bash
git add src/components/VibeCard.tsx
git commit -m "Add VibeCard component (extract dog+quote from Home)"
```

---

## Task 7: Rewrite Home.tsx wiring all cards + modal

**Files:**
- Modify: `src/screens/Home.tsx`

- [ ] **Step 1: Replace contents**

```tsx
// src/screens/Home.tsx
import React from 'react';
import {Button, ScrollView, StyleSheet, View} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {
  pick,
  types,
  errorCodes,
  isErrorWithCode,
} from '@react-native-documents/picker';

import AppText from '../components/AppText';
import ErrorComp from '../components/Error';
import Loading from '../components/Loading';
import NextSessionCard from '../components/NextSessionCard';
import PlanCard from '../components/PlanCard';
import PlanSwitcherModal from '../components/PlanSwitcherModal';
import ProgressCard from '../components/ProgressCard';
import Toast from '../components/Toast';
import VibeCard from '../components/VibeCard';

import {colors} from '../common/theme';
import {
  createWeek,
  exportDatabase,
  fetchHomeSummary,
  fetchPlans,
  getDBConnection,
  importDatabase,
  setActivePlanId,
} from '../common/databaseService';
import type {BaseProps, HomeSummary, Plan, Session, Week} from '../common/types';
import type {HomeSummary as HomeSummaryShape} from '../common/databaseService';

interface Props extends BaseProps {}

const Home: React.FC<Props> = ({route, navigation}) => {
  const {puppy} = route?.params as {puppy: string};

  const [summary, setSummary] = React.useState<HomeSummaryShape | null>(null);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [modalVisible, setModalVisible] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [toastError, setToastError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    const db = await getDBConnection();
    const [s, p] = await Promise.all([fetchHomeSummary(db), fetchPlans(db)]);
    setSummary(s);
    setPlans(p);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      (async () => {
        setLoading(true);
        try {
          await refresh();
        } catch (err) {
          setError(err as Error);
        } finally {
          setLoading(false);
        }
      })();
    }, [refresh]),
  );

  async function handleSelectPlan(planId: number) {
    try {
      const db = await getDBConnection();
      await setActivePlanId(db, planId);
      setModalVisible(false);
      await refresh();
    } catch (err) {
      setToastError((err as Error).message);
    }
  }

  async function handleCreateNextWeek() {
    if (!summary) return;
    try {
      const db = await getDBConnection();
      await createWeek(db, summary.activePlan.id);
      await refresh();
    } catch (err) {
      setToastError((err as Error).message);
    }
  }

  function handleStartSession(session: Session, week: Week) {
    const label = session.weekday_label
      ? `${session.session_name}: ${session.weekday_label}`
      : session.session_name;
    navigation.navigate('Sessions', {
      screen: label,
      params: {weekID: week.id, day_index: session.day_index, title: label},
    });
  }

  async function pickFile(): Promise<string | undefined> {
    try {
      const [res] = await pick({type: [types.allFiles]});
      return res.uri;
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      throw err;
    }
  }

  if (loading) return <Loading text="Loading" />;
  if (error) return <ErrorComp error={error} />;
  if (!summary) return <ErrorComp error={new Error('No active plan')} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <PlanCard plan={summary.activePlan} onPress={() => setModalVisible(true)} />

      <NextSessionCard
        currentWeek={summary.currentWeek}
        nextSession={summary.nextSession}
        onStartSession={handleStartSession}
        onCreateNextWeek={handleCreateNextWeek}
      />

      {summary.currentWeek && !summary.currentWeek.finished && (
        <ProgressCard
          week={summary.currentWeek}
          onPress={() => navigation.navigate('Weeks')}
        />
      )}

      <VibeCard puppy={puppy} />

      <View style={styles.dataSection}>
        <AppText style={styles.dataLabel}>Data management</AppText>
        <View style={styles.dataButtons}>
          <View style={{flex: 1}}>
            <Button
              color={colors.primary}
              title="Export"
              disabled={submitting}
              onPress={async () => {
                setSubmitting(true);
                try {
                  await exportDatabase();
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </View>
          <View style={{flex: 1}}>
            <Button
              color={colors.primary}
              title="Import"
              disabled={submitting}
              onPress={async () => {
                setSubmitting(true);
                try {
                  const data = await pickFile();
                  if (data) {
                    await importDatabase(data);
                    await refresh();
                  }
                } finally {
                  setSubmitting(false);
                }
              }}
            />
          </View>
        </View>
      </View>

      <PlanSwitcherModal
        visible={modalVisible}
        plans={plans}
        activePlanId={summary.activePlan.id}
        onSelect={handleSelectPlan}
        onClose={() => setModalVisible(false)}
      />

      {!!toastError && (
        <Toast
          type="error"
          message={toastError}
          onClose={() => setToastError(null)}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#f5f5f7'},
  content: {padding: 16, gap: 12, paddingBottom: 32},
  dataSection: {marginTop: 16},
  dataLabel: {
    fontSize: 12,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    textAlign: 'center',
  },
  dataButtons: {flexDirection: 'row', gap: 12},
});

export default Home;
```

- [ ] **Step 2: Remove the duplicate `HomeSummary` type import**

The code above imports `HomeSummary` twice (once via the type re-export from `common/types`, once from databaseService). The `common/types` re-export doesn't exist yet — the type lives in `databaseService.ts`. The duplicate import is a mistake. Remove the line `import type {BaseProps, HomeSummary, Plan, Session, Week} from '../common/types';`'s `HomeSummary` entry. Final imports should be:

```tsx
import type {BaseProps, Plan, Session, Week} from '../common/types';
import type {HomeSummary as HomeSummaryShape} from '../common/databaseService';
```

Verify with: `grep -n "HomeSummary" src/screens/Home.tsx` → should show only the `databaseService` import + usages of `HomeSummaryShape`.

- [ ] **Step 3: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/screens/Home.tsx`
Expected: no errors originating from Home.tsx itself.

- [ ] **Step 4: Commit**

```bash
git add src/screens/Home.tsx
git commit -m "Home: replace minimal layout with 4-card dashboard + plan switcher"
```

---

## Task 8: Routes.tsx — SessionsTabs uses useFocusEffect

**Files:**
- Modify: `src/Routes.tsx`

- [ ] **Step 1: Add useFocusEffect import**

Open `src/Routes.tsx`. Find the existing `@react-navigation/native` import line:
```tsx
import {DefaultTheme, NavigationContainer, Theme} from '@react-navigation/native';
```
Add `useFocusEffect`:
```tsx
import {DefaultTheme, NavigationContainer, Theme, useFocusEffect} from '@react-navigation/native';
```

- [ ] **Step 2: Replace the useEffect in SessionsTabs with useFocusEffect**

Find this block in `SessionsTabs` (around line 33):
```tsx
React.useEffect(() => {
  (async () => {
    const db = await getDBConnection();
    const planId = await fetchActivePlanId(db);
    if (planId == null) {
      setDays([]);
      return;
    }
    setDays(await fetchPlanDays(db, planId));
  })();
}, []);
```

Replace it with:
```tsx
useFocusEffect(
  React.useCallback(() => {
    (async () => {
      const db = await getDBConnection();
      const planId = await fetchActivePlanId(db);
      if (planId == null) {
        setDays([]);
        return;
      }
      setDays(await fetchPlanDays(db, planId));
    })();
  }, []),
);
```

- [ ] **Step 3: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/Routes.tsx`
Expected: no new errors compared to before this task. The existing `ScreenComponentType` warning carries over from v2 and is acceptable.

- [ ] **Step 4: Commit**

```bash
git add src/Routes.tsx
git commit -m "Routes: SessionsTabs re-fetches plan_days on focus (plan-switch propagation)"
```

---

## Task 9: Weeks.tsx — use focus effect + remove plan-tabs row

**Files:**
- Modify: `src/screens/Weeks.tsx`

- [ ] **Step 1: Read current Weeks.tsx to confirm line numbers**

Run: `wc -l src/screens/Weeks.tsx`
Expected: ~149 lines (current file size after v2).

- [ ] **Step 2: Add useFocusEffect import + replace init effect**

Open `src/screens/Weeks.tsx`. The existing imports include:
```tsx
import React from 'react';
```
Add the navigation hook:
```tsx
import {useFocusEffect} from '@react-navigation/native';
```
(Place it under the existing `import React from 'react';` line.)

Find this block (look for `React.useEffect(() => { ... init(); ... }, [refresh])`):
```tsx
React.useEffect(() => {
  (async function init() {
    try {
      const db = await getDBConnection();
      const all = await fetchPlans(db);
      setPlans(all);
      const active = (await fetchActivePlanId(db)) ?? all[0]?.id ?? null;
      setActivePlanIdState(active);
      if (active != null) await refresh(active);
    } catch (err) {
      setInitError(err as Error);
    } finally {
      setLoading(false);
    }
  })();
}, [refresh]);
```

Replace with:
```tsx
useFocusEffect(
  React.useCallback(() => {
    (async function init() {
      setLoading(true);
      try {
        const db = await getDBConnection();
        const all = await fetchPlans(db);
        setPlans(all);
        const active = (await fetchActivePlanId(db)) ?? all[0]?.id ?? null;
        setActivePlanIdState(active);
        if (active != null) await refresh(active);
      } catch (err) {
        setInitError(err as Error);
      } finally {
        setLoading(false);
      }
    })();
  }, [refresh]),
);
```

(Adds the `setLoading(true)` at the top so re-focus shows the spinner while reloading.)

- [ ] **Step 3: Remove the plan-tabs row**

Find the JSX block that renders the row of plan buttons. It looks like:
```tsx
{plans.length > 1 && (
  <View style={styles.planTabs}>
    {plans.map(p => (
      <Button
        key={p.id}
        color={p.id === activePlanId ? colors.primary : '#aaa'}
        title={p.name}
        onPress={() => handleSelectPlan(p.id)}
      />
    ))}
  </View>
)}
```

Delete this entire block.

Also delete the now-unused `handleSelectPlan` function and the `setActivePlanId` import (since selection now happens on Home, not Weeks). Verify nothing else references them via:
```bash
grep -n "handleSelectPlan\|setActivePlanId" src/screens/Weeks.tsx
```
Expected after cleanup: no matches.

Also delete the unused `planTabs` entry from the `StyleSheet.create` block at the bottom of the file.

- [ ] **Step 4: Type-check**

Run: `node_modules/.bin/tsc --noEmit src/screens/Weeks.tsx`
Expected: no new errors. If you removed `setActivePlanId` from the import but it's used elsewhere, restore it.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Weeks.tsx
git commit -m "Weeks: useFocusEffect for plan-switch propagation; drop plan-tabs row (now on Home)"
```

---

## Task 10: Build + manual visual verification on emulator

**Files:** none (verification only)

- [ ] **Step 1: Build the debug APK**

```bash
cd /home/pascal/Code/workout-warden/android
./gradlew assembleDebug
cd ..
```
Expected: BUILD SUCCESSFUL. APK at `android/app/build/outputs/apk/debug/app-debug.apk`.

- [ ] **Step 2: Build release APK (this is what we install for testing without Metro)**

```bash
cd /home/pascal/Code/workout-warden/android
./gradlew assembleRelease
cd ..
```
Expected: BUILD SUCCESSFUL. APK at `android/app/build/outputs/apk/release/app-release.apk`.

- [ ] **Step 3: Ensure emulator is running**

```bash
~/Android/Sdk/platform-tools/adb devices
```
Expected: shows `emulator-5554 device` (or whichever serial).

If no device: start the Pixel_6_API_34 AVD from Android Studio's Device Manager and wait for boot.

- [ ] **Step 4: Reinstall the app**

```bash
~/Android/Sdk/platform-tools/adb uninstall com.workoutwarden
~/Android/Sdk/platform-tools/adb install /home/pascal/Code/workout-warden/android/app/build/outputs/apk/release/app-release.apk
~/Android/Sdk/platform-tools/adb shell am start -n com.workoutwarden/.MainActivity
```
Expected: `Success` from uninstall + install. App launches.

- [ ] **Step 5: Screenshot the Home dashboard**

```bash
sleep 8
~/Android/Sdk/platform-tools/adb exec-out screencap -p > /tmp/v2.1-home.png
```

Inspect `/tmp/v2.1-home.png` (Read the file via your tool). Verify the screen shows:
- Active Plan card with "Surf" + description
- Next up card with "Ready to start?" + "Tap to start Week 1"
- (Progress card hidden — no week yet)
- Vibe card with dog + quote
- Data management section with Export/Import buttons

If any card is missing or laid out wrong: investigate and fix before continuing.

- [ ] **Step 6: Test Add Week + Start flow**

Tap "Tap to start Week 1" on the device (use adb input if needed: `~/Android/Sdk/platform-tools/adb shell input tap 540 700`). Take another screenshot.

Expected: Home now shows:
- Active Plan card (unchanged)
- Next up card → "Lower Body: Mon" with Start button
- Progress card → `0/5`, no date range yet
- Vibe + Data buttons (unchanged)

- [ ] **Step 7: Test plan switcher modal**

Tap the Active Plan card.

Expected: Modal slides up showing "Switch Plan" header + "Surf" row with checkmark + hint "Only one plan installed. Edit src/seeds/plans/ to add more."

Tap ✕ or the active row to close.

- [ ] **Step 8: Test Sessions tab still works**

Navigate to Sessions tab via bottom nav.

Expected: 5 top-tabs ("Lower Body: Mon", "Upper Body + Stretching: Tue", "Lower Body (Nordic): Wed", "Upper Body + Stretching: Thu", "Lower Body: Fri"). Tapping any tab opens the corresponding session.

- [ ] **Step 9: Test Weeks tab**

Navigate to Weeks tab.

Expected: Shows the week we just created. NO plan-tabs row at the top (we removed it). "Add new Week" button at the bottom.

- [ ] **Step 10: Commit any visual-fix changes**

If steps 5-9 revealed issues you fixed:

```bash
git add -A
git commit -m "<describe the fix>"
```

Otherwise skip this step.

---

## Self-Review Notes

**Spec coverage check:**

| Spec section | Covered by |
|---|---|
| Goal 1: surface plan switching | Tasks 2 (PlanCard), 3 (Modal), 7 (Home wires it) |
| Goal 2: useful Home | Tasks 2-7 (all 4 cards + Home rewrite) |
| Goal 3: plan-switch propagation (review #3) | Tasks 8 (Routes), 9 (Weeks) |
| Non-goals | Implicit (no tasks attempt these) |
| Layout | Task 7 (Home structure + content gaps) |
| Edge cases | Task 4 (NextSessionCard branches), Task 7 (Home conditional render of Progress card), Task 5 (ProgressCard date fallback) |
| Plan-Switcher Modal behavior | Task 3 (Modal renders checkmark, single-plan hint, no-op on active-row tap) |
| Architecture: new files | Tasks 2-6 (one file each) |
| Architecture: new DB read | Task 1 (`fetchHomeSummary` + interface) |
| Architecture: plan-switch propagation | Tasks 8-9 |
| Architecture: navigation | Task 7 (`handleStartSession` + ProgressCard onPress) |
| Architecture: state | Task 7 (Home holds summary/loading/error/modalVisible/submitting/toastError) |
| Data flow | Tasks 1 + 7 |
| Error handling | Task 7 (try/catch + Toast on plan-switch / createWeek failures; ErrorComp for load failure) |
| Testing | Task 1 (5 unit tests), Task 10 (visual verify) |

No gaps.

**Placeholder scan:** All code blocks contain complete code. No "implement later" or "similar to Task N" references. The `<describe the fix>` in Task 10 Step 10 is intentional — the engineer fills in based on what they actually fixed, if anything.

**Type consistency check:**
- `HomeSummary` interface (Task 1) has fields `activePlan: Plan`, `currentWeek: Week | null`, `nextSession: Session | null`. Consumed in Tasks 4 (currentWeek + nextSession), 5 (week), 7 (all three).
- `NextSessionCard` props match what Home passes in Task 7 (currentWeek, nextSession, onStartSession, onCreateNextWeek).
- `ProgressCard` accepts `{week, onPress}` — Home passes `{week: summary.currentWeek, onPress: navigate-to-Weeks}` in Task 7. ✓
- `PlanSwitcherModal` props match Home call site. ✓
- Navigation call `navigation.navigate('Sessions', {screen: label, params: {...}})` in Task 7 — uses the same `label` shape (`${session_name}: ${weekday_label}`) that `Routes.SessionsTabs` builds for its `SubTab.Screen name` prop in v2. ✓

All consistent.

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-18-home-dashboard-plan-switcher.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — Fresh subagent per task, two-stage review between tasks.

**2. Inline Execution** — Execute in this session with checkpoints.

**Which approach?**
