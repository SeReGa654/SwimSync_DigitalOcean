export function msToTime(ms: number | null | undefined): string {
  if (ms == null) return 'NT';
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor((ms % 1000) / 10);
  const secStr = sec.toString().padStart(2, '0');
  const msStr = millis.toString().padStart(2, '0');
  if (min > 0) return `${min}:${secStr}.${msStr}`;
  return `${sec}.${msStr}`;
}

export function parseTime(timeStr: string): number | null {
  if (!timeStr || timeStr.toUpperCase() === 'NT' || timeStr.trim() === '') return null;
  let s = timeStr.replace(/[,:]/g, '.').trim();
  const parts = s.split('.');
  if (parts.length >= 3) {
    const min = parseInt(parts[0], 10) || 0;
    const sec = parseInt(parts[1], 10) || 0;
    const msPart = parts[2].padEnd(2, '0').substring(0, 2);
    return min * 60000 + sec * 1000 + parseInt(msPart, 10) * 10;
  } else if (parts.length === 2) {
    const p1 = parseInt(parts[0], 10) || 0;
    const p2Part = parts[1];
    if (p1 < 10 && p2Part.length <= 2 && parseInt(p2Part, 10) < 60) {
      return p1 * 60000 + parseInt(p2Part, 10) * 1000;
    }
    const ms = parseInt(p2Part.padEnd(2, '0').substring(0, 2), 10) * 10;
    return p1 * 1000 + ms;
  }
  return (parseInt(parts[0], 10) || 0) * 1000;
}

/** Returns true if the time is suspiciously fast for the given distance */
export function isSuspiciousTime(timeMs: number, distance: number): boolean {
  // Minimum reasonable times (in ms) per distance
  const minimums: Record<number, number> = {
    50: 20000,   // 20s
    100: 45000,  // 45s
    200: 100000, // 1:40
    400: 220000, // 3:40
    800: 460000, // 7:40
    1500: 870000,// 14:30
  };
  const min = minimums[distance] || 15000;
  return timeMs < min;
}

export function cn(...inputs: (string | undefined | false | null)[]): string {
  return inputs.filter(Boolean).join(' ');
}
