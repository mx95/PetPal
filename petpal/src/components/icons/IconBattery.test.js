import { batteryTone } from './IconBattery';

describe('batteryTone', () => {
  it('maps percentage bands for Live status coloring', () => {
    expect(batteryTone(100)).toBe('high');
    expect(batteryTone(61)).toBe('high');
    expect(batteryTone(60)).toBe('mid');
    expect(batteryTone(31)).toBe('mid');
    expect(batteryTone(30)).toBe('low');
    expect(batteryTone(0)).toBe('low');
  });
});
