# Activity Rating (1–5 Smileys) + Notes as Single-Line List

Date: 2026-08-11
Status: implemented in this session

## Goal

Two additions to the Activities log:

1. **Rating 1–5** per activity session, entered by tapping one of five smileys.
2. **Notes become a list of single-line entries** instead of one multiline field.
   `+` appends a new entry, `−` removes one. The user already writes notes as
   `- `-prefixed lines in the multiline field; existing data is migrated.

## Data (verified against a fresh device export, 2026-08-11)

12 `activity_sessions` rows: 6 notes in `- item\n- item` list form, 2 plain
single-sentence notes, 4 NULL. No other shapes.

## Design

### Storage

- `activity_sessions.rating INTEGER` (nullable, 1–5, UI-enforced — no CHECK,
  consistent with the rest of the schema). Added via the idempotent
  `ALTER TABLE … catch {}` pattern in `seedDB` + the CREATE TABLE DDL +
  `scripts/schema-v2.sql`.
- Notes stay in `activity_sessions.note TEXT`. Multiple notes are stored
  newline-joined (`\n`), no bullet prefixes in the data. `NULL` = no notes.
  Rendering adds bullets; the data stays clean.

### Migration (one-shot)

In `seedDB`, guarded by settings key `note_list_migrated`:
for every non-NULL note, strip a leading `- ` / `– ` / `— ` (dash **followed
by whitespace** — `-5 degrees` is untouched) per line, drop blank lines,
rejoin with `\n`. Plain notes without a prefix become a single-entry list
unchanged. Runs exactly once so a future note deliberately starting with
`- ` is never re-stripped.

### Helpers — `src/common/activityLog.ts`

Pure, unit-tested: `splitNotes(note)`, `joinNotes(notes)`,
`normalizeLegacyNote(note)`, `RATING_EMOJIS` (😖 😕 😐 🙂 🤩),
`ratingEmoji(rating)`.

### API

`ActivitySessionDraft.rating?: number | null` (optional so existing call
sites stay valid); `createActivitySession` / `updateActivitySession` write
it, `fetchActivitySessions` returns it on `ActivitySession.rating`.

### UI

- **ActivitySessionModal**: RATING row of 5 emoji buttons — unselected dimmed,
  selected full-opacity with a hairline border; tapping the selected one
  clears the rating (it is optional). NOTES: one single-line `TextInput` per
  entry with a trailing `−` icon button; `+ ADD NOTE` row below appends an
  empty entry. On save: trim, drop empties, newline-join, `null` if none.
- **Activities row**: each note rendered as its own bulleted line (bullet from
  the renderer, muted, text in ink); the rating emoji joins the meta line
  (duration / spot).

## Testing

- `__tests__/activityLog.test.ts` — pure helper units incl. migration shapes
  from the real device data.
- `__tests__/seedMigration.test.ts` — legacy notes migrated once; second run
  leaves a fresh `- `-prefixed note alone; rating column exists after upgrade.
- `__tests__/activityService.test.ts` — rating round-trip create/fetch/update.

## Rejected alternatives

- Separate `activity_session_notes` table: relational purity nobody needs —
  notes are only ever read/written whole per session (YAGNI).
- Storing bullets in the data: couples storage to presentation, breaks
  round-tripping through the edit UI.
- `SEED_REVISION` bump: wrong tool — that path rewrites template content;
  this is a user-data migration, so it gets its own one-shot settings key.
