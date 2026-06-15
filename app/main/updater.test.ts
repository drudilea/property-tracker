import { describe, it, expect } from 'vitest';
import { isNewerVersion } from './updater';

describe('isNewerVersion', () => {
  it('returns true when patch is bumped', () => {
    expect(isNewerVersion('1.0.1', '1.0.0')).toBe(true);
  });

  it('returns false when current minor is larger (10 > 2)', () => {
    expect(isNewerVersion('1.2.0', '1.10.0')).toBe(false);
  });

  it('returns false when latest has a leading v but versions are equal', () => {
    expect(isNewerVersion('v1.0.0', '1.0.0')).toBe(false);
  });

  it('returns true when major is bumped', () => {
    expect(isNewerVersion('2.0.0', '1.9.9')).toBe(true);
  });

  it('returns false when versions are identical', () => {
    expect(isNewerVersion('1.0.0', '1.0.0')).toBe(false);
  });
});
