import { describe, it, expect } from 'vitest';
import { createMutex } from './mutex';

describe('mutex', () => {
  it('runs tasks one at a time in order', async () => {
    const mutex = createMutex();
    const events: string[] = [];
    const make = (id: string) => async () => {
      events.push(`start-${id}`);
      await new Promise((r) => setTimeout(r, 10));
      events.push(`end-${id}`);
      return id;
    };
    const results = await Promise.all([
      mutex.run(make('a')),
      mutex.run(make('b')),
    ]);
    expect(results).toEqual(['a', 'b']);
    expect(events).toEqual(['start-a', 'end-a', 'start-b', 'end-b']);
  });

  it('releases the lock even if a task throws', async () => {
    const mutex = createMutex();
    await expect(mutex.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    await expect(mutex.run(async () => 'ok')).resolves.toBe('ok');
  });
});
