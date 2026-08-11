// src/common/activityLog.ts
// Pure helpers for the Activities notes-list + rating UI. Notes are stored
// newline-joined in activity_sessions.note with no bullet prefixes — bullets
// are added by the renderer.

/** 1..5 scale, worst → best. Index = rating - 1. */
export const RATING_EMOJIS = ['😖', '😕', '😐', '🙂', '🤩'];

/** One stored note → list of entries. NULL means no notes. */
export function splitNotes(note: string | null): string[] {
  if (note == null) return [];
  return note.split('\n');
}

/** Entry list → stored form: trimmed, empties dropped, newline-joined. */
export function joinNotes(notes: string[]): string | null {
  const cleaned = notes.map(n => n.trim()).filter(n => n.length > 0);
  return cleaned.length > 0 ? cleaned.join('\n') : null;
}

// A bullet is a dash FOLLOWED BY whitespace — "-5 degrees" stays untouched.
const LEGACY_BULLET = /^\s*[-–—]\s+/;

/** One-shot migration for notes hand-written as "- item" lines in the old
 * multiline field: strip the bullets, drop blank lines. Plain notes pass
 * through unchanged (they become a single-entry list). */
export function normalizeLegacyNote(note: string): string {
  return note
    .split(/\r?\n/)
    .map(line => line.replace(LEGACY_BULLET, '').trim())
    .filter(line => line.length > 0)
    .join('\n');
}

export function ratingEmoji(rating: number | null): string | null {
  if (rating == null) return null;
  return RATING_EMOJIS[rating - 1] ?? null;
}