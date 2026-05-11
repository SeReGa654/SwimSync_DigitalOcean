/**
 * Parses time format M:SS.ms or SS.ms into total milliseconds.
 */
export function parseTime(timeStr: string): number | null {
  if (!timeStr) return null;
  const t = timeStr.trim().replace(',', '.');
  let m = 0;
  let s = 0;
  let ms = 0;

  if (t.includes(':')) {
    const parts = t.split(':');
    m = parseInt(parts[0], 10);
    const sParts = parts[1].split('.');
    s = parseInt(sParts[0], 10);
    if (sParts[1]) ms = parseInt(sParts[1].padEnd(3, '0').slice(0, 3), 10);
  } else if (t.includes('.')) {
    const parts = t.split('.');
    s = parseInt(parts[0], 10);
    ms = parseInt(parts[1].padEnd(3, '0').slice(0, 3), 10);
  } else {
    s = parseInt(t, 10);
  }

  if (isNaN(m) || isNaN(s) || isNaN(ms)) return null;
  return m * 60000 + s * 1000 + ms;
}

/**
 * Formats total milliseconds into M:SS.ms string.
 */
export function msToTime(ms: number | undefined | null): string {
  if (ms === undefined || ms === null) return '';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msRem = Math.floor((ms % 1000) / 10); // show 2 digits
  const sStr = s.toString().padStart(2, '0');
  const msStr = msRem.toString().padStart(2, '0');
  if (m > 0) return `${m}:${sStr}.${msStr}`;
  return `${sStr}.${msStr}`;
}
