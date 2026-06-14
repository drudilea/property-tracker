import { describe, it, expect } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('uses the explicit preference when not system', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
  it('follows the system when preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
