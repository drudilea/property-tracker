export function buildCalendarUrl(opts: {
  title: string;
  location: string;
  description: string;
  startDate: Date;
  durationMinutes: number;
  guestEmail?: string;
}): string {
  const pad = (n: number) => n.toString().padStart(2, '0');

  const formatDate = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

  const endDate = new Date(
    opts.startDate.getTime() + opts.durationMinutes * 60000,
  );

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${formatDate(opts.startDate)}/${formatDate(endDate)}`,
    location: opts.location,
    details: opts.description,
  });

  if (opts.guestEmail) {
    params.set('add', opts.guestEmail);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
