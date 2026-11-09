/** Returns YYYY-MM-DD in UTC. */
export function toDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateKey(date: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Invalid date key, expected YYYY-MM-DD');
  }
  return date;
}
