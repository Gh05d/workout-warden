import {activityColor, diagonalBands, planColor} from '../src/common/planColor';

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

describe('diagonalBands', () => {
  it('returns null below two colors — the caller uses a plain backgroundColor', () => {
    expect(diagonalBands([])).toBeNull();
    expect(diagonalBands(['#FF9800'])).toBeNull();
  });

  it('splits a pair in half along the top-left → bottom-right diagonal', () => {
    expect(diagonalBands(['#EF6C00', '#0277BD'])).toBe(
      'linear-gradient(135deg, #EF6C00 0%, #EF6C00 50%, #0277BD 50%, #0277BD 100%)',
    );
  });

  it('splits three colors into equal thirds', () => {
    expect(diagonalBands(['#AAAAAA', '#BBBBBB', '#CCCCCC'])).toBe(
      'linear-gradient(135deg, ' +
        '#AAAAAA 0%, #AAAAAA 33.3333%, ' +
        '#BBBBBB 33.3333%, #BBBBBB 66.6667%, ' +
        '#CCCCCC 66.6667%, #CCCCCC 100%)',
    );
  });

  it('repeats each stop position so bands have hard edges, never a blur', () => {
    // Every color appears twice with a shared boundary offset: that is what
    // turns a CSS gradient into a hard-edged band.
    const css = diagonalBands(['#111111', '#222222', '#333333']) as string;
    for (const hex of ['#111111', '#222222', '#333333']) {
      expect(css.split(hex).length - 1).toBe(2);
    }
  });
});
