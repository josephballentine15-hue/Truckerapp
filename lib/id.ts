// Small collision-resistant id for rows and columns. Good enough for a
// single-device logbook (not security-sensitive).
export function makeId(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36);
  return `${prefix}${time}${rand}`;
}
