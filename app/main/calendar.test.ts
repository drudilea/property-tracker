import { describe, it, expect } from 'vitest';
import { buildCalendarUrl } from '../../src/calendar';

describe('buildCalendarUrl', () => {
  it('builds a Google Calendar template URL with formatted dates', () => {
    const url = buildCalendarUrl({
      title: 'Cita piso',
      location: 'Calle Tampico, Madrid',
      description: 'info',
      startDate: new Date(2026, 5, 20, 18, 0),
      durationMinutes: 30,
    });
    expect(url).toContain('https://calendar.google.com/calendar/render?');
    expect(url).toContain('action=TEMPLATE');
    expect(url).toContain('dates=20260620T180000%2F20260620T183000');
    expect(url).toContain('text=Cita+piso');
    expect(url).not.toContain('add=');
  });

  it('adds a guest when provided', () => {
    const url = buildCalendarUrl({
      title: 't',
      location: 'l',
      description: 'd',
      startDate: new Date(2026, 0, 1, 9, 0),
      durationMinutes: 30,
      guestEmail: 'x@y.com',
    });
    expect(url).toContain('add=x%40y.com');
  });
});
