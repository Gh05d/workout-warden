import {activityColor, mixHexColors, planColor} from '../src/common/planColor';

describe('activityColor', () => {
  it('gives surf (id 1) and altinha (id 2) distinct pairs', () => {
    expect(activityColor(1)).not.toEqual(activityColor(2));
  });

  it('is disjoint from the plan palette', () => {
    const planFgs = new Set([1, 2, 3, 4, 5, 6].map(id => planColor(id).fg));
    expect(planFgs.has(activityColor(1).fg)).toBe(false);
    expect(planFgs.has(activityColor(2).fg)).toBe(false);
  });

  it('wraps stably beyond the palette length', () => {
    expect(activityColor(5)).toEqual(activityColor(1));
  });
});

describe('mixHexColors', () => {
  it('returns a single color unchanged', () => {
    expect(mixHexColors(['#FF9800'])).toBe('#FF9800');
  });

  it('averages channels of a pair', () => {
    expect(mixHexColors(['#000000', '#FFFFFF'])).toBe('#808080');
    expect(mixHexColors(['#FF0000', '#0000FF'])).toBe('#800080');
  });

  it('averages three colors', () => {
    expect(mixHexColors(['#300000', '#003000', '#000030'])).toBe('#101010');
  });

  it('throws on an empty list', () => {
    expect(() => mixHexColors([])).toThrow();
  });
});
