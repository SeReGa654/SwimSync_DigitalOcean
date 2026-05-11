import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type SeedableEntry = {
  id: number;
  entryTimeMs: number | null;
};

function shuffleInPlace<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

function getTimeKey(entry: SeedableEntry): number {
  return entry.entryTimeMs && entry.entryTimeMs > 0 ? entry.entryTimeMs : Number.POSITIVE_INFINITY;
}

export function sortEntriesByRules(entries: SeedableEntry[]): SeedableEntry[] {
  const timedMap = new Map<number, SeedableEntry[]>();
  const ntEntries: SeedableEntry[] = [];

  for (const entry of entries) {
    const key = getTimeKey(entry);
    if (!Number.isFinite(key)) {
      ntEntries.push(entry);
      continue;
    }
    const bucket = timedMap.get(key) || [];
    bucket.push(entry);
    timedMap.set(key, bucket);
  }

  const sortedTimes = Array.from(timedMap.keys()).sort((a, b) => a - b);
  const timedEntries = sortedTimes.flatMap((time) => shuffleInPlace([...(timedMap.get(time) || [])]));
  const shuffledNt = shuffleInPlace([...ntEntries]);
  return [...timedEntries, ...shuffledNt];
}

/**
 * Розсіювання по запливах:
 * - Спортсмени відсортовані від найшвидшого до найповільнішого.
 * - Розбиваємо на групи по N (кількість доріжок в басейні).
 * - Перша група (найшвидші N) → останній заплив.
 * - Друга група → передостанній заплив.
 * - ...остання група (найповільніші) → перший заплив.
 *
 * В кожному запливі доріжки призначаються окремо (центр → зигзаг).
 */
export function assignEntriesToHeats(
  sortedEntries: SeedableEntry[],
  poolLanes: number,
): Array<{ entry: SeedableEntry; heatNumber: number }> {
  if (sortedEntries.length === 0) return [];

  const totalCount = sortedEntries.length;
  const totalHeats = Math.max(1, Math.ceil(totalCount / poolLanes));

  if (totalHeats === 1) {
    return sortedEntries.map((entry) => ({ entry, heatNumber: 1 }));
  }

  // 1. Попередній розподіл: заповнюємо всі запливи, крім першого, по максимуму (poolLanes)
  const counts = new Array(totalHeats).fill(0);
  let remaining = totalCount;

  for (let h = totalHeats - 1; h >= 1; h--) {
    counts[h] = Math.min(remaining, poolLanes);
    remaining -= counts[h];
  }
  counts[0] = remaining; // Те, що залишилось — у перший заплив

  // 2. Балансування: якщо в першому запливі < 3 учасників, переносимо з другого
  // Виключення: якщо всього на дистанції < 3 людей (вже оброблено totalHeats=1)
  if (totalCount >= 3 && counts[0] < 3) {
    const need = 3 - counts[0];
    counts[0] += need;
    counts[1] -= need;
    // При poolLanes >= 6, counts[1] залишиться >= 3 (6-2=4 або 6-1=5)
  }

  // 3. Призначення (sortedEntries від найшвидших до найповільніших)
  const result: Array<{ entry: SeedableEntry; heatNumber: number }> = [];
  let currentIdx = 0;

  for (let h = totalHeats - 1; h >= 0; h--) {
    const heatNumber = h + 1;
    const countInHeat = counts[h];
    for (let i = 0; i < countInHeat; i++) {
      result.push({ entry: sortedEntries[currentIdx++], heatNumber });
    }
  }

  return result;
}

function getLaneConfig(poolLanes: number): { minLane: number; maxLane: number; centerLane: number } {
  if (poolLanes === 10) {
    return { minLane: 0, maxLane: 9, centerLane: 4 };
  }

  const minLane = 1;
  const maxLane = poolLanes;
  if (poolLanes === 8) return { minLane, maxLane, centerLane: 4 };
  if (poolLanes === 6) return { minLane, maxLane, centerLane: 3 };
  if (poolLanes % 2 === 0) return { minLane, maxLane, centerLane: poolLanes / 2 };
  return { minLane, maxLane, centerLane: Math.ceil(poolLanes / 2) };
}

export function buildLaneOrder(poolLanes: number): number[] {
  const { minLane, maxLane, centerLane } = getLaneConfig(poolLanes);
  const order: number[] = [centerLane];
  let step = 1;

  while (order.length < poolLanes) {
    const right = centerLane + step;
    if (right <= maxLane) order.push(right);
    if (order.length >= poolLanes) break;

    const left = centerLane - step;
    if (left >= minLane) order.push(left);
    step += 1;
  }

  return order;
}

export function assignLanesWithinHeat(entries: SeedableEntry[], poolLanes: number): Array<{ entry: SeedableEntry; laneNumber: number }> {
  const sorted = sortEntriesByRules(entries);
  const laneOrder = buildLaneOrder(poolLanes);
  return sorted.map((entry, index) => ({
    entry,
    laneNumber: laneOrder[index],
  }));
}

@Injectable()
export class SeedingService {
  constructor(private prisma: PrismaService) { }

  async generateSeeding(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { competition: true },
    });
    if (!event) return { entries: 0 };

    const entries = await this.prisma.entry.findMany({
      where: { eventId, status: { in: ['IN', 'PK'] } },
      select: { id: true, entryTimeMs: true },
    });

    if (entries.length === 0) return { entries: 0 };

    const poolLanes = event.competition.lanes || 8;

    const sorted = sortEntriesByRules(entries);
    const heatAssignments = assignEntriesToHeats(sorted, poolLanes);

    const byHeat = new Map<number, SeedableEntry[]>();
    for (const assignment of heatAssignments) {
      const bucket = byHeat.get(assignment.heatNumber) || [];
      bucket.push(assignment.entry);
      byHeat.set(assignment.heatNumber, bucket);
    }

    const updates = [];
    for (const [heatNumber, heatEntries] of byHeat.entries()) {
      const laneAssignments = assignLanesWithinHeat(heatEntries, poolLanes);
      for (const laneAssignment of laneAssignments) {
        updates.push(this.prisma.entry.update({
          where: { id: laneAssignment.entry.id },
          data: { heatNumber, laneNumber: laneAssignment.laneNumber },
        }));
      }
    }

    await this.prisma.$transaction(updates);
    const totalHeats = Math.max(1, Math.ceil(entries.length / poolLanes));
    return { entries: entries.length, heats: totalHeats };
  }

  async clearSeeding(eventId: number) {
    await this.prisma.entry.updateMany({
      where: { eventId },
      data: { heatNumber: null, laneNumber: null },
    });
    return { success: true };
  }
}