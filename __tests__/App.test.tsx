import {displayDate, formatTime} from '../src/common/functions';

describe('formatTime', () => {
  it('zero-pads seconds below ten', () => {
    expect(formatTime(65)).toBe('1:05');
  });

  it('handles zero', () => {
    expect(formatTime(0)).toBe('0:00');
  });

  it('handles multi-minute durations', () => {
    expect(formatTime(305)).toBe('5:05');
  });
});

describe('displayDate', () => {
  it('renders a start–end range with the trailing year', () => {
    expect(displayDate('2026-01-05 00:00', '2026-01-12 00:00')).toBe(
      '05.01 - 12.01.2026',
    );
  });
});
