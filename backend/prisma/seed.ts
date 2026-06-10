import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'crypto';

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

// Helper: convert "MM:SS.ms" or "SS.ms" to milliseconds
function timeToMs(t: string): number {
  const parts = t.split(':');
  if (parts.length === 2) {
    const min = parseInt(parts[0], 10);
    const secParts = parts[1].split('.');
    const sec = parseInt(secParts[0], 10);
    const ms = secParts[1] ? parseInt(secParts[1].padEnd(2, '0').substring(0, 2), 10) * 10 : 0;
    return min * 60000 + sec * 1000 + ms;
  }
  const secParts = parts[0].split('.');
  const sec = parseInt(secParts[0], 10);
  const ms = secParts[1] ? parseInt(secParts[1].padEnd(2, '0').substring(0, 2), 10) * 10 : 0;
  return sec * 1000 + ms;
}

// WA Base Times 2026 — Long Course (50m pool) — Official data
const waBaseTimesLCM2026: { gender: string; distance: number; style: string; time: string }[] = [
  // Men
  { gender: 'M', distance: 50, style: 'Freestyle', time: '20.91' },
  { gender: 'M', distance: 100, style: 'Freestyle', time: '46.40' },
  { gender: 'M', distance: 200, style: 'Freestyle', time: '1:42.00' },
  { gender: 'M', distance: 400, style: 'Freestyle', time: '3:39.96' },
  { gender: 'M', distance: 800, style: 'Freestyle', time: '7:32.12' },
  { gender: 'M', distance: 1500, style: 'Freestyle', time: '14:30.67' },
  { gender: 'M', distance: 50, style: 'Backstroke', time: '23.55' },
  { gender: 'M', distance: 100, style: 'Backstroke', time: '51.60' },
  { gender: 'M', distance: 200, style: 'Backstroke', time: '1:51.92' },
  { gender: 'M', distance: 50, style: 'Breaststroke', time: '25.95' },
  { gender: 'M', distance: 100, style: 'Breaststroke', time: '56.88' },
  { gender: 'M', distance: 200, style: 'Breaststroke', time: '2:05.48' },
  { gender: 'M', distance: 50, style: 'Butterfly', time: '22.27' },
  { gender: 'M', distance: 100, style: 'Butterfly', time: '49.45' },
  { gender: 'M', distance: 200, style: 'Butterfly', time: '1:50.34' },
  { gender: 'M', distance: 200, style: 'Medley', time: '1:52.69' },
  { gender: 'M', distance: 400, style: 'Medley', time: '4:02.50' },
  // Women
  { gender: 'F', distance: 50, style: 'Freestyle', time: '23.61' },
  { gender: 'F', distance: 100, style: 'Freestyle', time: '51.71' },
  { gender: 'F', distance: 200, style: 'Freestyle', time: '1:52.23' },
  { gender: 'F', distance: 400, style: 'Freestyle', time: '3:54.18' },
  { gender: 'F', distance: 800, style: 'Freestyle', time: '8:04.12' },
  { gender: 'F', distance: 1500, style: 'Freestyle', time: '15:20.48' },
  { gender: 'F', distance: 50, style: 'Backstroke', time: '26.86' },
  { gender: 'F', distance: 100, style: 'Backstroke', time: '57.13' },
  { gender: 'F', distance: 200, style: 'Backstroke', time: '2:03.14' },
  { gender: 'F', distance: 50, style: 'Breaststroke', time: '29.16' },
  { gender: 'F', distance: 100, style: 'Breaststroke', time: '1:04.13' },
  { gender: 'F', distance: 200, style: 'Breaststroke', time: '2:17.55' }, // Fixed trailing colon from PDF
  { gender: 'F', distance: 50, style: 'Butterfly', time: '24.43' },
  { gender: 'F', distance: 100, style: 'Butterfly', time: '54.60' },
  { gender: 'F', distance: 200, style: 'Butterfly', time: '2:01.81' },
  { gender: 'F', distance: 200, style: 'Medley', time: '2:05.70' },
  { gender: 'F', distance: 400, style: 'Medley', time: '4:23.65' },
  // Relays 
  { gender: 'M', distance: 400, style: 'Freestyle', time: '3:08.24' }, // 4x100
  { gender: 'F', distance: 400, style: 'Freestyle', time: '3:27.96' }, // 4x100
  { gender: 'X', distance: 400, style: 'Freestyle', time: '3:18.48' }, // 4x100 Mixed
  { gender: 'M', distance: 400, style: 'Medley', time: '3:26.78' }, // 4x100 Medley
  { gender: 'F', distance: 400, style: 'Medley', time: '3:49.34' }, // 4x100 Medley
  { gender: 'X', distance: 400, style: 'Medley', time: '3:37.43' }, // 4x100 Mixed Medley
];

// WA Base Times 2025 — Short Course (25m pool) — Official data
const waBaseTimesSCM2025: { gender: string; distance: number; style: string; time: string }[] = [
  // Men
  { gender: 'M', distance: 50, style: 'Freestyle', time: '19.90' },
  { gender: 'M', distance: 100, style: 'Freestyle', time: '44.84' },
  { gender: 'M', distance: 200, style: 'Freestyle', time: '1:38.61' },
  { gender: 'M', distance: 400, style: 'Freestyle', time: '3:32.25' },
  { gender: 'M', distance: 800, style: 'Freestyle', time: '7:20.46' },
  { gender: 'M', distance: 1500, style: 'Freestyle', time: '14:06.88' },
  { gender: 'M', distance: 50, style: 'Backstroke', time: '22.11' },
  { gender: 'M', distance: 100, style: 'Backstroke', time: '48.33' },
  { gender: 'M', distance: 200, style: 'Backstroke', time: '1:45.63' },
  { gender: 'M', distance: 50, style: 'Breaststroke', time: '24.95' },
  { gender: 'M', distance: 100, style: 'Breaststroke', time: '55.28' },
  { gender: 'M', distance: 200, style: 'Breaststroke', time: '2:00.16' },
  { gender: 'M', distance: 50, style: 'Butterfly', time: '21.32' },
  { gender: 'M', distance: 100, style: 'Butterfly', time: '47.71' },
  { gender: 'M', distance: 200, style: 'Butterfly', time: '1:46.85' },
  { gender: 'M', distance: 100, style: 'Medley', time: '49.28' },
  { gender: 'M', distance: 200, style: 'Medley', time: '1:48.88' },
  { gender: 'M', distance: 400, style: 'Medley', time: '3:54.81' },
  // Women
  { gender: 'F', distance: 50, style: 'Freestyle', time: '22.83' },
  { gender: 'F', distance: 100, style: 'Freestyle', time: '50.25' },
  { gender: 'F', distance: 200, style: 'Freestyle', time: '1:50.31' },
  { gender: 'F', distance: 400, style: 'Freestyle', time: '3:50.25' },
  { gender: 'F', distance: 800, style: 'Freestyle', time: '7:57.42' },
  { gender: 'F', distance: 1500, style: 'Freestyle', time: '15:08.24' },
  { gender: 'F', distance: 50, style: 'Backstroke', time: '25.23' },
  { gender: 'F', distance: 100, style: 'Backstroke', time: '54.02' },
  { gender: 'F', distance: 200, style: 'Backstroke', time: '1:58.04' },
  { gender: 'F', distance: 50, style: 'Breaststroke', time: '28.37' },
  { gender: 'F', distance: 100, style: 'Breaststroke', time: '1:02.36' },
  { gender: 'F', distance: 200, style: 'Breaststroke', time: '2:12.50' },
  { gender: 'F', distance: 50, style: 'Butterfly', time: '23.94' },
  { gender: 'F', distance: 100, style: 'Butterfly', time: '52.71' },
  { gender: 'F', distance: 200, style: 'Butterfly', time: '1:59.32' },
  { gender: 'F', distance: 100, style: 'Medley', time: '55.11' },
  { gender: 'F', distance: 200, style: 'Medley', time: '2:01.63' },
  { gender: 'F', distance: 400, style: 'Medley', time: '4:15.48' },
  // Relays 
  { gender: 'M', distance: 400, style: 'Freestyle', time: '3:01.66' }, // 4x100
  { gender: 'F', distance: 400, style: 'Freestyle', time: '3:25.01' }, // 4x100
  { gender: 'M', distance: 400, style: 'Medley', time: '3:18.68' }, // 4x100 Medley
  { gender: 'F', distance: 400, style: 'Medley', time: '3:40.41' }, // 4x100 Medley
  // Mixed Relays (Only 4x50m officially exist for SCM points)
  { gender: 'X', distance: 200, style: 'Freestyle', time: '1:27.33' }, // 4x50 Mixed
  { gender: 'X', distance: 200, style: 'Medley', time: '1:35.15' }, // 4x50 Mixed Medley
];

// Ukrainian Sport Ranks (Нормативи ФПУ) — 50m pool (LCM)
// Format: [distance, style, gender, rank, time]
const uaSportRanksLCM: [number, string, string, string, string][] = [
  // === MEN 50m POOL ===
  // Freestyle
  [50, 'Freestyle', 'M', 'МС', '24.00'], [50, 'Freestyle', 'M', 'КМС', '25.00'], [50, 'Freestyle', 'M', 'І', '27.00'], [50, 'Freestyle', 'M', 'ІІ', '30.00'], [50, 'Freestyle', 'M', 'ІІІ', '34.50'], [50, 'Freestyle', 'M', 'І-юн', '39.00'], [50, 'Freestyle', 'M', 'ІІ-юн', '44.00'],
  [100, 'Freestyle', 'M', 'МС', '53.50'], [100, 'Freestyle', 'M', 'КМС', '56.50'], [100, 'Freestyle', 'M', 'І', '1:01.00'], [100, 'Freestyle', 'M', 'ІІ', '1:08.00'], [100, 'Freestyle', 'M', 'ІІІ', '1:17.00'], [100, 'Freestyle', 'M', 'І-юн', '1:26.50'], [100, 'Freestyle', 'M', 'ІІ-юн', '1:36.50'],
  [200, 'Freestyle', 'M', 'МС', '1:57.00'], [200, 'Freestyle', 'M', 'КМС', '2:04.00'], [200, 'Freestyle', 'M', 'І', '2:14.00'], [200, 'Freestyle', 'M', 'ІІ', '2:29.00'], [200, 'Freestyle', 'M', 'ІІІ', '2:48.00'], [200, 'Freestyle', 'M', 'І-юн', '3:09.00'],
  [400, 'Freestyle', 'M', 'МС', '4:10.00'], [400, 'Freestyle', 'M', 'КМС', '4:24.00'], [400, 'Freestyle', 'M', 'І', '4:44.00'], [400, 'Freestyle', 'M', 'ІІ', '5:16.00'], [400, 'Freestyle', 'M', 'ІІІ', '5:57.00'], [400, 'Freestyle', 'M', 'І-юн', '6:40.00'],
  [800, 'Freestyle', 'M', 'МС', '8:43.00'], [800, 'Freestyle', 'M', 'КМС', '9:11.00'], [800, 'Freestyle', 'M', 'І', '9:51.00'], [800, 'Freestyle', 'M', 'ІІ', '10:58.00'], [800, 'Freestyle', 'M', 'ІІІ', '12:23.00'],
  [1500, 'Freestyle', 'M', 'МС', '16:32.00'], [1500, 'Freestyle', 'M', 'КМС', '17:31.00'], [1500, 'Freestyle', 'M', 'І', '18:51.00'], [1500, 'Freestyle', 'M', 'ІІ', '20:54.00'], [1500, 'Freestyle', 'M', 'ІІІ', '23:37.00'],
  // Breaststroke
  [50, 'Breaststroke', 'M', 'КМС', '32.00'], [50, 'Breaststroke', 'M', 'І', '34.50'], [50, 'Breaststroke', 'M', 'ІІ', '38.50'], [50, 'Breaststroke', 'M', 'ІІІ', '43.50'], [50, 'Breaststroke', 'M', 'І-юн', '49.00'], [50, 'Breaststroke', 'M', 'ІІ-юн', '55.50'],
  [100, 'Breaststroke', 'M', 'МС', '1:06.50'], [100, 'Breaststroke', 'M', 'КМС', '1:10.00'], [100, 'Breaststroke', 'M', 'І', '1:16.00'], [100, 'Breaststroke', 'M', 'ІІ', '1:24.00'], [100, 'Breaststroke', 'M', 'ІІІ', '1:35.00'], [100, 'Breaststroke', 'M', 'І-юн', '1:47.00'],
  [200, 'Breaststroke', 'M', 'МС', '2:24.50'], [200, 'Breaststroke', 'M', 'КМС', '2:33.00'], [200, 'Breaststroke', 'M', 'І', '2:44.00'], [200, 'Breaststroke', 'M', 'ІІ', '3:03.00'], [200, 'Breaststroke', 'M', 'ІІІ', '3:28.00'], [200, 'Breaststroke', 'M', 'І-юн', '3:53.00'],
  // Butterfly
  [50, 'Butterfly', 'M', 'КМС', '27.50'], [50, 'Butterfly', 'M', 'І', '29.50'], [50, 'Butterfly', 'M', 'ІІ', '33.00'], [50, 'Butterfly', 'M', 'ІІІ', '37.00'], [50, 'Butterfly', 'M', 'І-юн', '42.00'], [50, 'Butterfly', 'M', 'ІІ-юн', '48.00'],
  [100, 'Butterfly', 'M', 'МС', '57.50'], [100, 'Butterfly', 'M', 'КМС', '1:01.00'], [100, 'Butterfly', 'M', 'І', '1:06.00'], [100, 'Butterfly', 'M', 'ІІ', '1:13.00'], [100, 'Butterfly', 'M', 'ІІІ', '1:23.00'], [100, 'Butterfly', 'M', 'І-юн', '1:35.00'],
  [200, 'Butterfly', 'M', 'МС', '2:09.00'], [200, 'Butterfly', 'M', 'КМС', '2:16.00'], [200, 'Butterfly', 'M', 'І', '2:26.50'], [200, 'Butterfly', 'M', 'ІІ', '2:43.00'], [200, 'Butterfly', 'M', 'ІІІ', '3:04.00'], [200, 'Butterfly', 'M', 'І-юн', '3:27.00'],
  // Backstroke
  [50, 'Backstroke', 'M', 'КМС', '29.50'], [50, 'Backstroke', 'M', 'І', '31.50'], [50, 'Backstroke', 'M', 'ІІ', '35.00'], [50, 'Backstroke', 'M', 'ІІІ', '39.00'], [50, 'Backstroke', 'M', 'І-юн', '44.00'], [50, 'Backstroke', 'M', 'ІІ-юн', '50.00'],
  [100, 'Backstroke', 'M', 'МС', '59.50'], [100, 'Backstroke', 'M', 'КМС', '1:03.00'], [100, 'Backstroke', 'M', 'І', '1:08.00'], [100, 'Backstroke', 'M', 'ІІ', '1:15.00'], [100, 'Backstroke', 'M', 'ІІІ', '1:25.00'], [100, 'Backstroke', 'M', 'І-юн', '1:35.00'],
  [200, 'Backstroke', 'M', 'МС', '2:10.00'], [200, 'Backstroke', 'M', 'КМС', '2:17.00'], [200, 'Backstroke', 'M', 'І', '2:27.00'], [200, 'Backstroke', 'M', 'ІІ', '2:44.00'], [200, 'Backstroke', 'M', 'ІІІ', '3:05.00'], [200, 'Backstroke', 'M', 'І-юн', '3:28.00'],
  // Medley
  [200, 'Medley', 'M', 'МС', '2:12.00'], [200, 'Medley', 'M', 'КМС', '2:20.00'], [200, 'Medley', 'M', 'І', '2:30.00'], [200, 'Medley', 'M', 'ІІ', '2:47.00'], [200, 'Medley', 'M', 'ІІІ', '3:09.00'], [200, 'Medley', 'M', 'І-юн', '3:32.00'],
  [400, 'Medley', 'M', 'МС', '4:42.00'], [400, 'Medley', 'M', 'КМС', '4:58.00'], [400, 'Medley', 'M', 'І', '5:21.00'], [400, 'Medley', 'M', 'ІІ', '5:57.00'], [400, 'Medley', 'M', 'ІІІ', '6:43.00'],

  // === WOMEN 50m POOL ===
  // Freestyle
  [50, 'Freestyle', 'F', 'МС', '27.50'], [50, 'Freestyle', 'F', 'КМС', '28.50'], [50, 'Freestyle', 'F', 'І', '30.00'], [50, 'Freestyle', 'F', 'ІІ', '34.00'], [50, 'Freestyle', 'F', 'ІІІ', '38.00'], [50, 'Freestyle', 'F', 'І-юн', '44.00'], [50, 'Freestyle', 'F', 'ІІ-юн', '50.00'],
  [100, 'Freestyle', 'F', 'МС', '1:00.00'], [100, 'Freestyle', 'F', 'КМС', '1:03.50'], [100, 'Freestyle', 'F', 'І', '1:08.00'], [100, 'Freestyle', 'F', 'ІІ', '1:15.00'], [100, 'Freestyle', 'F', 'ІІІ', '1:25.00'], [100, 'Freestyle', 'F', 'І-юн', '1:37.00'], [100, 'Freestyle', 'F', 'ІІ-юн', '1:49.00'],
  [200, 'Freestyle', 'F', 'МС', '2:10.00'], [200, 'Freestyle', 'F', 'КМС', '2:17.50'], [200, 'Freestyle', 'F', 'І', '2:28.00'], [200, 'Freestyle', 'F', 'ІІ', '2:45.00'], [200, 'Freestyle', 'F', 'ІІІ', '3:06.00'], [200, 'Freestyle', 'F', 'І-юн', '3:31.00'],
  [400, 'Freestyle', 'F', 'МС', '4:35.00'], [400, 'Freestyle', 'F', 'КМС', '4:49.00'], [400, 'Freestyle', 'F', 'І', '5:12.00'], [400, 'Freestyle', 'F', 'ІІ', '5:47.00'], [400, 'Freestyle', 'F', 'ІІІ', '6:37.00'], [400, 'Freestyle', 'F', 'І-юн', '7:37.00'],
  [800, 'Freestyle', 'F', 'МС', '9:21.00'], [800, 'Freestyle', 'F', 'КМС', '9:52.00'], [800, 'Freestyle', 'F', 'І', '10:37.00'], [800, 'Freestyle', 'F', 'ІІ', '11:50.00'], [800, 'Freestyle', 'F', 'ІІІ', '13:23.00'],
  [1500, 'Freestyle', 'F', 'МС', '17:55.00'], [1500, 'Freestyle', 'F', 'КМС', '18:55.00'], [1500, 'Freestyle', 'F', 'І', '20:20.00'], [1500, 'Freestyle', 'F', 'ІІ', '22:35.00'], [1500, 'Freestyle', 'F', 'ІІІ', '25:40.00'],
  // Breaststroke
  [50, 'Breaststroke', 'F', 'КМС', '36.50'], [50, 'Breaststroke', 'F', 'І', '39.00'], [50, 'Breaststroke', 'F', 'ІІ', '43.50'], [50, 'Breaststroke', 'F', 'ІІІ', '49.50'], [50, 'Breaststroke', 'F', 'І-юн', '55.50'], [50, 'Breaststroke', 'F', 'ІІ-юн', '1:03.50'],
  [100, 'Breaststroke', 'F', 'МС', '1:15.00'], [100, 'Breaststroke', 'F', 'КМС', '1:19.00'], [100, 'Breaststroke', 'F', 'І', '1:25.00'], [100, 'Breaststroke', 'F', 'ІІ', '1:35.00'], [100, 'Breaststroke', 'F', 'ІІІ', '1:47.00'], [100, 'Breaststroke', 'F', 'І-юн', '2:01.00'],
  [200, 'Breaststroke', 'F', 'МС', '2:41.00'], [200, 'Breaststroke', 'F', 'КМС', '2:50.00'], [200, 'Breaststroke', 'F', 'І', '3:02.00'], [200, 'Breaststroke', 'F', 'ІІ', '3:23.00'], [200, 'Breaststroke', 'F', 'ІІІ', '3:49.00'], [200, 'Breaststroke', 'F', 'І-юн', '4:17.00'],
  // Butterfly
  [50, 'Butterfly', 'F', 'КМС', '30.30'], [50, 'Butterfly', 'F', 'І', '32.50'], [50, 'Butterfly', 'F', 'ІІ', '36.50'], [50, 'Butterfly', 'F', 'ІІІ', '42.00'], [50, 'Butterfly', 'F', 'І-юн', '47.50'], [50, 'Butterfly', 'F', 'ІІ-юн', '53.50'],
  [100, 'Butterfly', 'F', 'МС', '1:04.50'], [100, 'Butterfly', 'F', 'КМС', '1:08.50'], [100, 'Butterfly', 'F', 'І', '1:13.50'], [100, 'Butterfly', 'F', 'ІІ', '1:22.00'], [100, 'Butterfly', 'F', 'ІІІ', '1:33.00'], [100, 'Butterfly', 'F', 'І-юн', '1:45.00'],
  [200, 'Butterfly', 'F', 'МС', '2:21.50'], [200, 'Butterfly', 'F', 'КМС', '2:31.00'], [200, 'Butterfly', 'F', 'І', '2:41.00'], [200, 'Butterfly', 'F', 'ІІ', '2:59.00'], [200, 'Butterfly', 'F', 'ІІІ', '3:22.00'], [200, 'Butterfly', 'F', 'І-юн', '3:49.00'],
  // Backstroke
  [50, 'Backstroke', 'F', 'КМС', '33.50'], [50, 'Backstroke', 'F', 'І', '36.00'], [50, 'Backstroke', 'F', 'ІІ', '40.00'], [50, 'Backstroke', 'F', 'ІІІ', '45.00'], [50, 'Backstroke', 'F', 'І-юн', '50.00'], [50, 'Backstroke', 'F', 'ІІ-юн', '56.50'],
  [100, 'Backstroke', 'F', 'МС', '1:07.50'], [100, 'Backstroke', 'F', 'КМС', '1:11.00'], [100, 'Backstroke', 'F', 'І', '1:16.00'], [100, 'Backstroke', 'F', 'ІІ', '1:24.50'], [100, 'Backstroke', 'F', 'ІІІ', '1:35.50'], [100, 'Backstroke', 'F', 'І-юн', '1:47.50'],
  [200, 'Backstroke', 'F', 'МС', '2:23.50'], [200, 'Backstroke', 'F', 'КМС', '2:32.50'], [200, 'Backstroke', 'F', 'І', '2:43.00'], [200, 'Backstroke', 'F', 'ІІ', '3:01.50'], [200, 'Backstroke', 'F', 'ІІІ', '3:25.00'], [200, 'Backstroke', 'F', 'І-юн', '4:01.50'],
  // Medley
  [200, 'Medley', 'F', 'МС', '2:27.00'], [200, 'Medley', 'F', 'КМС', '2:35.00'], [200, 'Medley', 'F', 'І', '2:47.00'], [200, 'Medley', 'F', 'ІІ', '3:06.00'], [200, 'Medley', 'F', 'ІІІ', '3:30.00'], [200, 'Medley', 'F', 'І-юн', '3:57.00'],
  [400, 'Medley', 'F', 'МС', '5:09.00'], [400, 'Medley', 'F', 'КМС', '5:26.00'], [400, 'Medley', 'F', 'І', '5:51.00'], [400, 'Medley', 'F', 'ІІ', '6:31.00'], [400, 'Medley', 'F', 'ІІІ', '7:22.00']
];

// Ukrainian Sport Ranks (Нормативи ФПУ) — 25m pool (SCM)
const uaSportRanksSCM: [number, string, string, string, string][] = [
  // === MEN 25m POOL ===
  // Freestyle
  [50, 'Freestyle', 'M', 'МС', '23.50'], [50, 'Freestyle', 'M', 'КМС', '24.50'], [50, 'Freestyle', 'M', 'І', '26.00'], [50, 'Freestyle', 'M', 'ІІ', '29.50'], [50, 'Freestyle', 'M', 'ІІІ', '33.50'], [50, 'Freestyle', 'M', 'І-юн', '38.00'], [50, 'Freestyle', 'M', 'ІІ-юн', '43.00'],
  [100, 'Freestyle', 'M', 'МС', '52.00'], [100, 'Freestyle', 'M', 'КМС', '55.50'], [100, 'Freestyle', 'M', 'І', '59.50'], [100, 'Freestyle', 'M', 'ІІ', '1:07.00'], [100, 'Freestyle', 'M', 'ІІІ', '1:15.00'], [100, 'Freestyle', 'M', 'І-юн', '1:24.50'], [100, 'Freestyle', 'M', 'ІІ-юн', '1:35.50'],
  [200, 'Freestyle', 'M', 'МС', '1:55.00'], [200, 'Freestyle', 'M', 'КМС', '2:02.00'], [200, 'Freestyle', 'M', 'І', '2:12.00'], [200, 'Freestyle', 'M', 'ІІ', '2:27.00'], [200, 'Freestyle', 'M', 'ІІІ', '2:46.00'], [200, 'Freestyle', 'M', 'І-юн', '3:07.00'],
  [400, 'Freestyle', 'M', 'МС', '4:04.00'], [400, 'Freestyle', 'M', 'КМС', '4:18.00'], [400, 'Freestyle', 'M', 'І', '4:38.00'], [400, 'Freestyle', 'M', 'ІІ', '5:08.00'], [400, 'Freestyle', 'M', 'ІІІ', '5:50.00'], [400, 'Freestyle', 'M', 'І-юн', '6:30.00'],
  [800, 'Freestyle', 'M', 'МС', '8:30.00'], [800, 'Freestyle', 'M', 'КМС', '9:00.00'], [800, 'Freestyle', 'M', 'І', '9:40.00'], [800, 'Freestyle', 'M', 'ІІ', '10:40.00'], [800, 'Freestyle', 'M', 'ІІІ', '12:30.00'],
  [1500, 'Freestyle', 'M', 'МС', '16:16.00'], [1500, 'Freestyle', 'M', 'КМС', '17:10.00'], [1500, 'Freestyle', 'M', 'І', '18:30.00'], [1500, 'Freestyle', 'M', 'ІІ', '20:33.00'], [1500, 'Freestyle', 'M', 'ІІІ', '23:16.00'],
  // Breaststroke
  [50, 'Breaststroke', 'M', 'КМС', '31.00'], [50, 'Breaststroke', 'M', 'І', '33.50'], [50, 'Breaststroke', 'M', 'ІІ', '37.50'], [50, 'Breaststroke', 'M', 'ІІІ', '42.50'], [50, 'Breaststroke', 'M', 'І-юн', '48.00'], [50, 'Breaststroke', 'M', 'ІІ-юн', '54.50'],
  [100, 'Breaststroke', 'M', 'МС', '1:04.50'], [100, 'Breaststroke', 'M', 'КМС', '1:08.50'], [100, 'Breaststroke', 'M', 'І', '1:14.00'], [100, 'Breaststroke', 'M', 'ІІ', '1:22.50'], [100, 'Breaststroke', 'M', 'ІІІ', '1:33.50'], [100, 'Breaststroke', 'M', 'І-юн', '1:45.00'],
  [200, 'Breaststroke', 'M', 'МС', '2:20.00'], [200, 'Breaststroke', 'M', 'КМС', '2:29.00'], [200, 'Breaststroke', 'M', 'І', '2:40.00'], [200, 'Breaststroke', 'M', 'ІІ', '2:59.00'], [200, 'Breaststroke', 'M', 'ІІІ', '3:23.00'], [200, 'Breaststroke', 'M', 'І-юн', '3:48.00'],
  // Butterfly
  [50, 'Butterfly', 'M', 'КМС', '27.00'], [50, 'Butterfly', 'M', 'І', '29.00'], [50, 'Butterfly', 'M', 'ІІ', '32.50'], [50, 'Butterfly', 'M', 'ІІІ', '37.00'], [50, 'Butterfly', 'M', 'І-юн', '42.00'], [50, 'Butterfly', 'M', 'ІІ-юн', '48.00'],
  [100, 'Butterfly', 'M', 'МС', '56.00'], [100, 'Butterfly', 'M', 'КМС', '59.50'], [100, 'Butterfly', 'M', 'І', '1:04.00'], [100, 'Butterfly', 'M', 'ІІ', '1:12.00'], [100, 'Butterfly', 'M', 'ІІІ', '1:21.00'], [100, 'Butterfly', 'M', 'І-юн', '1:33.00'],
  [200, 'Butterfly', 'M', 'МС', '2:05.00'], [200, 'Butterfly', 'M', 'КМС', '2:12.00'], [200, 'Butterfly', 'M', 'І', '2:22.00'], [200, 'Butterfly', 'M', 'ІІ', '2:39.00'], [200, 'Butterfly', 'M', 'ІІІ', '3:00.00'], [200, 'Butterfly', 'M', 'І-юн', '3:23.00'],
  // Backstroke
  [50, 'Backstroke', 'M', 'КМС', '28.00'], [50, 'Backstroke', 'M', 'І', '30.00'], [50, 'Backstroke', 'M', 'ІІ', '33.50'], [50, 'Backstroke', 'M', 'ІІІ', '38.00'], [50, 'Backstroke', 'M', 'І-юн', '43.00'], [50, 'Backstroke', 'M', 'ІІ-юн', '49.00'],
  [100, 'Backstroke', 'M', 'МС', '57.00'], [100, 'Backstroke', 'M', 'КМС', '1:00.00'], [100, 'Backstroke', 'M', 'І', '1:05.00'], [100, 'Backstroke', 'M', 'ІІ', '1:12.50'], [100, 'Backstroke', 'M', 'ІІІ', '1:22.00'], [100, 'Backstroke', 'M', 'І-юн', '1:32.00'],
  [200, 'Backstroke', 'M', 'МС', '2:05.50'], [200, 'Backstroke', 'M', 'КМС', '2:12.00'], [200, 'Backstroke', 'M', 'І', '2:22.00'], [200, 'Backstroke', 'M', 'ІІ', '2:39.00'], [200, 'Backstroke', 'M', 'ІІІ', '3:00.00'], [200, 'Backstroke', 'M', 'І-юн', '3:23.00'],
  // Medley
  [100, 'Medley', 'M', 'КМС', '1:02.00'], [100, 'Medley', 'M', 'І', '1:07.00'], [100, 'Medley', 'M', 'ІІ', '1:15.00'], [100, 'Medley', 'M', 'ІІІ', '1:25.00'], [100, 'Medley', 'M', 'І-юн', '1:35.00'], [100, 'Medley', 'M', 'ІІ-юн', '1:47.00'],
  [200, 'Medley', 'M', 'МС', '2:09.00'], [200, 'Medley', 'M', 'КМС', '2:16.00'], [200, 'Medley', 'M', 'І', '2:27.00'], [200, 'Medley', 'M', 'ІІ', '2:45.00'], [200, 'Medley', 'M', 'ІІІ', '3:05.00'], [200, 'Medley', 'M', 'І-юн', '3:28.00'],
  [400, 'Medley', 'M', 'МС', '4:34.00'], [400, 'Medley', 'M', 'КМС', '4:50.00'], [400, 'Medley', 'M', 'І', '5:13.00'], [400, 'Medley', 'M', 'ІІ', '5:49.00'], [400, 'Medley', 'M', 'ІІІ', '6:36.00'],

  // === WOMEN 25m POOL ===
  // Freestyle
  [50, 'Freestyle', 'F', 'МС', '27.00'], [50, 'Freestyle', 'F', 'КМС', '28.00'], [50, 'Freestyle', 'F', 'І', '30.50'], [50, 'Freestyle', 'F', 'ІІ', '34.00'], [50, 'Freestyle', 'F', 'ІІІ', '38.00'], [50, 'Freestyle', 'F', 'І-юн', '44.00'], [50, 'Freestyle', 'F', 'ІІ-юн', '50.00'],
  [100, 'Freestyle', 'F', 'МС', '58.50'], [100, 'Freestyle', 'F', 'КМС', '1:01.50'], [100, 'Freestyle', 'F', 'І', '1:06.00'], [100, 'Freestyle', 'F', 'ІІ', '1:14.00'], [100, 'Freestyle', 'F', 'ІІІ', '1:24.00'], [100, 'Freestyle', 'F', 'І-юн', '1:36.00'], [100, 'Freestyle', 'F', 'ІІ-юн', '1:48.00'],
  [200, 'Freestyle', 'F', 'МС', '2:08.00'], [200, 'Freestyle', 'F', 'КМС', '2:15.00'], [200, 'Freestyle', 'F', 'І', '2:26.00'], [200, 'Freestyle', 'F', 'ІІ', '2:43.00'], [200, 'Freestyle', 'F', 'ІІІ', '3:04.00'], [200, 'Freestyle', 'F', 'І-юн', '3:28.00'],
  [400, 'Freestyle', 'F', 'МС', '4:30.00'], [400, 'Freestyle', 'F', 'КМС', '4:44.00'], [400, 'Freestyle', 'F', 'І', '5:07.00'], [400, 'Freestyle', 'F', 'ІІ', '5:42.00'], [400, 'Freestyle', 'F', 'ІІІ', '6:27.00'], [400, 'Freestyle', 'F', 'І-юн', '7:27.00'],
  [800, 'Freestyle', 'F', 'МС', '9:15.00'], [800, 'Freestyle', 'F', 'КМС', '9:46.00'], [800, 'Freestyle', 'F', 'І', '10:31.00'], [800, 'Freestyle', 'F', 'ІІ', '11:44.00'], [800, 'Freestyle', 'F', 'ІІІ', '13:17.00'],
  [1500, 'Freestyle', 'F', 'МС', '17:48.00'], [1500, 'Freestyle', 'F', 'КМС', '18:48.00'], [1500, 'Freestyle', 'F', 'І', '20:15.00'], [1500, 'Freestyle', 'F', 'ІІ', '22:30.00'], [1500, 'Freestyle', 'F', 'ІІІ', '25:33.00'],
  // Breaststroke
  [50, 'Breaststroke', 'F', 'КМС', '35.50'], [50, 'Breaststroke', 'F', 'І', '38.00'], [50, 'Breaststroke', 'F', 'ІІ', '42.50'], [50, 'Breaststroke', 'F', 'ІІІ', '48.00'], [50, 'Breaststroke', 'F', 'І-юн', '54.00'], [50, 'Breaststroke', 'F', 'ІІ-юн', '1:02.00'],
  [100, 'Breaststroke', 'F', 'МС', '1:13.00'], [100, 'Breaststroke', 'F', 'КМС', '1:17.50'], [100, 'Breaststroke', 'F', 'І', '1:23.50'], [100, 'Breaststroke', 'F', 'ІІ', '1:33.50'], [100, 'Breaststroke', 'F', 'ІІІ', '1:45.00'], [100, 'Breaststroke', 'F', 'І-юн', '1:58.00'],
  [200, 'Breaststroke', 'F', 'МС', '2:37.00'], [200, 'Breaststroke', 'F', 'КМС', '2:45.00'], [200, 'Breaststroke', 'F', 'І', '2:58.00'], [200, 'Breaststroke', 'F', 'ІІ', '3:19.00'], [200, 'Breaststroke', 'F', 'ІІІ', '3:45.00'], [200, 'Breaststroke', 'F', 'І-юн', '4:13.00'],
  // Butterfly
  [50, 'Butterfly', 'F', 'КМС', '30.00'], [50, 'Butterfly', 'F', 'І', '32.00'], [50, 'Butterfly', 'F', 'ІІ', '36.00'], [50, 'Butterfly', 'F', 'ІІІ', '41.00'], [50, 'Butterfly', 'F', 'І-юн', '47.00'], [50, 'Butterfly', 'F', 'ІІ-юн', '53.00'],
  [100, 'Butterfly', 'F', 'МС', '1:04.00'], [100, 'Butterfly', 'F', 'КМС', '1:08.00'], [100, 'Butterfly', 'F', 'І', '1:13.00'], [100, 'Butterfly', 'F', 'ІІ', '1:21.50'], [100, 'Butterfly', 'F', 'ІІІ', '1:32.50'], [100, 'Butterfly', 'F', 'І-юн', '1:45.00'],
  [200, 'Butterfly', 'F', 'МС', '2:20.50'], [200, 'Butterfly', 'F', 'КМС', '2:28.50'], [200, 'Butterfly', 'F', 'І', '2:39.00'], [200, 'Butterfly', 'F', 'ІІ', '2:57.00'], [200, 'Butterfly', 'F', 'ІІІ', '3:20.00'], [200, 'Butterfly', 'F', 'І-юн', '3:47.00'],
  // Backstroke
  [50, 'Backstroke', 'F', 'КМС', '32.00'], [50, 'Backstroke', 'F', 'І', '34.50'], [50, 'Backstroke', 'F', 'ІІ', '38.50'], [50, 'Backstroke', 'F', 'ІІІ', '43.50'], [50, 'Backstroke', 'F', 'І-юн', '49.00'], [50, 'Backstroke', 'F', 'ІІ-юн', '55.50'],
  [100, 'Backstroke', 'F', 'МС', '1:05.00'], [100, 'Backstroke', 'F', 'КМС', '1:09.00'], [100, 'Backstroke', 'F', 'І', '1:14.50'], [100, 'Backstroke', 'F', 'ІІ', '1:23.00'], [100, 'Backstroke', 'F', 'ІІІ', '1:34.00'], [100, 'Backstroke', 'F', 'І-юн', '1:46.00'],
  [200, 'Backstroke', 'F', 'МС', '2:20.00'], [200, 'Backstroke', 'F', 'КМС', '2:29.00'], [200, 'Backstroke', 'F', 'І', '2:40.00'], [200, 'Backstroke', 'F', 'ІІ', '2:58.00'], [200, 'Backstroke', 'F', 'ІІІ', '3:22.00'], [200, 'Backstroke', 'F', 'І-юн', '3:49.00'],
  // Medley
  [100, 'Medley', 'F', 'КМС', '1:10.50'], [100, 'Medley', 'F', 'І', '1:16.00'], [100, 'Medley', 'F', 'ІІ', '1:25.00'], [100, 'Medley', 'F', 'ІІІ', '1:36.50'], [100, 'Medley', 'F', 'І-юн', '1:48.00'], [100, 'Medley', 'F', 'ІІ-юн', '2:02.50'],
  [200, 'Medley', 'F', 'МС', '2:24.00'], [200, 'Medley', 'F', 'КМС', '2:32.00'], [200, 'Medley', 'F', 'І', '2:44.00'], [200, 'Medley', 'F', 'ІІ', '3:03.00'], [200, 'Medley', 'F', 'ІІІ', '3:27.00'], [200, 'Medley', 'F', 'І-юн', '3:54.00'],
  [400, 'Medley', 'F', 'МС', '5:02.00'], [400, 'Medley', 'F', 'КМС', '5:19.00'], [400, 'Medley', 'F', 'І', '5:44.00'], [400, 'Medley', 'F', 'ІІ', '6:24.00'], [400, 'Medley', 'F', 'ІІІ', '7:15.00']
];

async function main() {
  console.log('Seeding WA Base Times 2026 (LCM)...');
  for (const bt of waBaseTimesLCM2026) {
    await prisma.waBaseTime.upsert({
      where: {
        year_gender_distance_style_poolLength: {
          year: 2026, gender: bt.gender, distance: bt.distance, style: bt.style, poolLength: 50,
        },
      },
      update: { baseTimeMs: timeToMs(bt.time) },
      create: {
        year: 2026, gender: bt.gender, distance: bt.distance,
        style: bt.style, poolLength: 50, baseTimeMs: timeToMs(bt.time),
      },
    });
  }

  console.log('Seeding WA Base Times 2025 (SCM)...');
  for (const bt of waBaseTimesSCM2025) {
    await prisma.waBaseTime.upsert({
      where: {
        year_gender_distance_style_poolLength: {
          year: 2025, gender: bt.gender, distance: bt.distance, style: bt.style, poolLength: 25,
        },
      },
      update: { baseTimeMs: timeToMs(bt.time) },
      create: {
        year: 2025, gender: bt.gender, distance: bt.distance,
        style: bt.style, poolLength: 25, baseTimeMs: timeToMs(bt.time),
      },
    });
  }

  console.log('Seeding UA Sport Ranks (LCM)...');
  // Clear existing ranks first
  await prisma.uaSportRank.deleteMany({ where: { poolLength: 50 } });
  for (const [distance, style, gender, rank, time] of uaSportRanksLCM) {
    await prisma.uaSportRank.create({
      data: { poolLength: 50, gender, distance, style, rank, normTimeMs: timeToMs(time) },
    });
  }

  console.log('Seeding UA Sport Ranks (SCM)...');
  await prisma.uaSportRank.deleteMany({ where: { poolLength: 25 } });
  for (const [distance, style, gender, rank, time] of uaSportRanksSCM) {
    await prisma.uaSportRank.create({
      data: { poolLength: 25, gender, distance, style, rank, normTimeMs: timeToMs(time) },
    });
  }

  const bootstrapAdminUsername = process.env.AUTH_BOOTSTRAP_ADMIN_USERNAME?.trim();
  const bootstrapAdminPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD?.trim();
  if (bootstrapAdminUsername && bootstrapAdminPassword) {
    console.log(`Seeding bootstrap admin user (${bootstrapAdminUsername})...`);
    await prisma.user.upsert({
      where: { username: bootstrapAdminUsername },
      update: {
        passwordHash: hashPassword(bootstrapAdminPassword),
        role: 'admin',
        isActive: true,
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: 'bootstrap-seed',
      },
      create: {
        username: bootstrapAdminUsername,
        passwordHash: hashPassword(bootstrapAdminPassword),
        role: 'admin',
        isActive: true,
        isApproved: true,
        approvedAt: new Date(),
        approvedBy: 'bootstrap-seed',
      },
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });