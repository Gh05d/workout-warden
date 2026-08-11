/**
 * Pure helpers behind the Activities notes-list + rating UI.
 *
 * Notes are stored newline-joined in activity_sessions.note with NO bullet
 * prefixes — bullets are a rendering concern. normalizeLegacyNote is the
 * one-shot migration for notes written as "- item" lines in the old
 * multiline field (shapes taken from the real device export, 2026-08-11).
 */
import {
  splitNotes,
  joinNotes,
  normalizeLegacyNote,
  ratingEmoji,
  RATING_EMOJIS,
} from '../src/common/activityLog';

describe('splitNotes', () => {
  it('returns [] for null', () => {
    expect(splitNotes(null)).toEqual([]);
  });

  it('splits a newline-joined note into entries', () => {
    expect(splitNotes('Ultra High Tide\nsuper leer\nStrong Current')).toEqual([
      'Ultra High Tide',
      'super leer',
      'Strong Current',
    ]);
  });

  it('treats a plain single-line note as one entry', () => {
    expect(splitNotes('Pretty tired at the end')).toEqual([
      'Pretty tired at the end',
    ]);
  });
});

describe('joinNotes', () => {
  it('trims entries and drops empty ones', () => {
    expect(joinNotes([' No skills ', '', 'Feet bleeding'])).toBe(
      'No skills\nFeet bleeding',
    );
  });

  it('returns null when nothing is left', () => {
    expect(joinNotes([])).toBeNull();
    expect(joinNotes(['', '   '])).toBeNull();
  });
});

describe('normalizeLegacyNote', () => {
  it('strips "- " bullets from each line', () => {
    expect(
      normalizeLegacyNote(
        '- Tons of people\n- longboard\n- maybe 4 waves surfed',
      ),
    ).toBe('Tons of people\nlongboard\nmaybe 4 waves surfed');
  });

  it('leaves plain notes without a bullet unchanged', () => {
    expect(
      normalizeLegacyNote('With indo boys and one tourist before. Easy'),
    ).toBe('With indo boys and one tourist before. Easy');
  });

  it('does not strip a dash not followed by whitespace', () => {
    expect(normalizeLegacyNote('-5 degrees this morning')).toBe(
      '-5 degrees this morning',
    );
  });

  it('handles en-dash bullets and drops blank lines', () => {
    expect(normalizeLegacyNote('– one\n\n- two')).toBe('one\ntwo');
  });
});

describe('ratingEmoji', () => {
  it('exposes exactly five smileys', () => {
    expect(RATING_EMOJIS).toHaveLength(5);
  });

  it('maps 1..5 onto the scale', () => {
    expect(ratingEmoji(1)).toBe(RATING_EMOJIS[0]);
    expect(ratingEmoji(5)).toBe(RATING_EMOJIS[4]);
  });

  it('returns null for null and out-of-range values', () => {
    expect(ratingEmoji(null)).toBeNull();
    expect(ratingEmoji(0)).toBeNull();
    expect(ratingEmoji(6)).toBeNull();
  });
});
