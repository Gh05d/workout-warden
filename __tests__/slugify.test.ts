import {slugify} from '../src/common/slugify';

describe('slugify', () => {
  it('lowercases and dashes', () => {
    expect(slugify('Reverse Step Up')).toBe('reverse-step-up');
  });

  it('collapses multiple spaces', () => {
    expect(slugify('Big   Toe Stretch')).toBe('big-toe-stretch');
  });

  it('strips non-alphanumeric chars', () => {
    expect(slugify('Wall-Pullover (Band)')).toBe('wall-pullover-band');
  });

  it('handles leading/trailing whitespace', () => {
    expect(slugify('  L-Sit Progression  ')).toBe('l-sit-progression');
  });

  it('treats empty input as empty output', () => {
    expect(slugify('')).toBe('');
  });
});
