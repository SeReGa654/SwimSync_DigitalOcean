import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma, ResultStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LiveGateway } from '../live/live.gateway';
import { AuditService } from '../audit/audit.service';

const PLACE_ROMAN: Record<number, string> = {
  1: 'І', 2: 'ІІ', 3: 'ІІІ', 4: '4', 5: '5',
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10'
};

const RANK_TIERS: Record<string, number> = {
  'MSMK': 100, 'MS': 90, 'KMSU': 80,
  'R1': 70, 'R2': 60, 'R3': 50,
  'Y1': 40, 'Y2': 30, 'Y3': 20,
  'NONE': 0
};

const RANK_MAP_TO_LATIN: Record<string, string> = {
  'МСМК': 'MSMK', 'МС': 'MS', 'КМСУ': 'KMSU', 'КМС': 'KMSU',
  'І': 'R1', '1': 'R1', 'ІІ': 'R2', '2': 'R2', 'ІІІ': 'R3', '3': 'R3',
  'І юн.': 'Y1', 'ІІ юн.': 'Y2', 'ІІІ юн.': 'Y3',
  'І-юн': 'Y1', 'ІІ-юн': 'Y2', 'ІІІ-юн': 'Y3',
  'І юн': 'Y1', 'ІІ юн': 'Y2', 'ІІІ юн': 'Y3',
  '1-юн': 'Y1', '2-юн': 'Y2', '3-юн': 'Y3',
};

const STYLE_DB_MAP: Record<string, string> = {
  'FREE': 'Freestyle', 'BREAST': 'Breaststroke',
  'BACK': 'Backstroke', 'FLY': 'Butterfly', 'MEDLEY': 'Medley'
};

function placeToDisplay(place: number | null, status: ResultStatus): string | null {
  if (status === 'PK') return 'п/к';
  if (['DQ', 'DNS', 'DNF'].includes(status)) return status;
  if (place === null) return null;
  return PLACE_ROMAN[place] || place.toString();
}

@Injectable()
export class ResultsService {
  constructor(
    private prisma: PrismaService,
    private liveGateway: LiveGateway,
    private auditService: AuditService,
  ) { }

  async saveResult(data: {
    entryId: number;
    finishTimeMs?: number | null;
    status: ResultStatus;
    dqReason?: string | null;
    version?: number;
  }) {
    // Status guard: prevent modifications to completed competitions
    const entry = await this.prisma.entry.findUnique({
      where: { id: data.entryId },
      include: { event: { include: { competition: true } } },
    });
    if (entry?.event.competition.status === 'completed') {
      throw new ForbiddenException('Змагання завершено (архів). Редагування результатів заблоковано.');
    }

    const existing = await this.prisma.result.findUnique({ where: { entryId: data.entryId } });

    if (existing) {
      // Optimistic locking check
      if (data.version !== undefined && existing.version !== data.version) {
        throw new ConflictException(
          'This result was modified by another user. Please reload and try again.',
        );
      }
      return this.prisma.result.update({
        where: { id: existing.id },
        data: {
          finishTimeMs: data.status === 'OK' ? (data.finishTimeMs ?? null) : null,
          status: data.status,
          dqReason: data.status === 'DQ' ? (data.dqReason || null) : null,
          version: { increment: 1 },
        },
      });
    }

    const res = await this.prisma.result.create({
      data: {
        entryId: data.entryId,
        finishTimeMs: data.status === 'OK' ? (data.finishTimeMs ?? null) : null,
        status: data.status,
        dqReason: data.status === 'DQ' ? (data.dqReason || null) : null,
      },
    });

    await this.auditService.logAction('RESULT_SAVED', 'Result', res.id, JSON.stringify(data));
    return res;
  }

  async saveHeatResults(
    results: { entryId: number; finishTimeMs?: number | null; status: ResultStatus; dqReason?: string | null; version?: number }[],
  ) {
    if (results.length === 0) {
      return [];
    }

    // Status guard: validate entire batch context before processing.
    const uniqueEntryIds = Array.from(new Set(results.map((r) => r.entryId)));
    const batchEntries = await this.prisma.entry.findMany({
      where: { id: { in: uniqueEntryIds } },
      include: { event: { include: { competition: true } } },
    });

    if (batchEntries.length !== uniqueEntryIds.length) {
      throw new BadRequestException('Деякі записи запливу не знайдено.');
    }

    const contextEventId = batchEntries[0].eventId;
    const contextCompetitionId = batchEntries[0].event.competitionId;
    const mixedEventBatch = batchEntries.some((entry) => entry.eventId !== contextEventId);
    if (mixedEventBatch) {
      throw new BadRequestException('Пакетне збереження дозволене лише в межах однієї дистанції.');
    }

    const hasCompletedCompetition = batchEntries.some(
      (entry) => entry.event.competition.status === 'completed',
    );
    if (hasCompletedCompetition) {
      throw new ForbiddenException('Змагання завершено (архів). Редагування результатів заблоковано.');
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const updated = [];
      for (const data of results) {
        const existing = await tx.result.findUnique({ where: { entryId: data.entryId } });
        if (existing) {
          if (data.version !== undefined && existing.version !== data.version) {
            throw new ConflictException('This result was modified by another user. Please reload and try again.');
          }
          const res = await tx.result.update({
            where: { id: existing.id },
            data: {
              finishTimeMs: data.status === 'OK' ? (data.finishTimeMs ?? null) : null,
              status: data.status,
              dqReason: data.status === 'DQ' ? (data.dqReason || null) : null,
              version: { increment: 1 },
            },
          });
          updated.push(res);
        } else {
          const res = await tx.result.create({
            data: {
              entryId: data.entryId,
              finishTimeMs: data.status === 'OK' ? (data.finishTimeMs ?? null) : null,
              status: data.status,
              dqReason: data.status === 'DQ' ? (data.dqReason || null) : null,
            },
          });
          updated.push(res);
        }
      }
      return updated;
    });

    if (saved.length > 0) {
      void this.liveGateway.notifyResultsUpdated(contextCompetitionId);
      await this.auditService.logAction('HEAT_RESULTS_SAVED', 'Event', contextEventId, `Saved ${saved.length} results`);
    }

    return saved;
  }

  /**
   * Finalize event results: calculate places, achieved ranks, and WA points
   * within each Event + Gender + AgeGroup combination
   */
  async finalizeEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { competition: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    // Status guard: prevent finalization for completed competitions
    if (event.competition.status === 'completed') {
      throw new ForbiddenException('Змагання завершено (архів). Фіналізація заблокована.');
    }

    const entries = await this.prisma.entry.findMany({
      where: { eventId },
      include: { result: true, ageGroup: true, athlete: true },
    });

    // Group entries by ageGroupId (null = no group)
    const groups = new Map<number | null, typeof entries>();
    for (const entry of entries) {
      const key = entry.ageGroupId;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    // Get WA base time for this event
    const currentYear = new Date().getFullYear();
    const dbStyle = STYLE_DB_MAP[event.style] || event.style;
    const poolLength = event.competition.poolLength;
    const waGender = event.gender === 'MIXED' ? 'X' : event.gender;
    const waBaseTime = await this.prisma.waBaseTime.findFirst({
      where: {
        distance: event.distance,
        style: dbStyle,
        gender: waGender,
        poolLength,
        year: currentYear,
      },
    });
    // Fallback: any year, then any poolLength
    const baseTimeMs = waBaseTime?.baseTimeMs
      ?? (await this.prisma.waBaseTime.findFirst({
        where: { distance: event.distance, style: dbStyle, gender: waGender, poolLength },
        orderBy: { year: 'desc' },
      }))?.baseTimeMs
      ?? (await this.prisma.waBaseTime.findFirst({
        where: { distance: event.distance, style: dbStyle, gender: waGender },
        orderBy: { year: 'desc' },
      }))?.baseTimeMs;

    // Get UA sport ranks for this event
    const uaRanks = await this.prisma.uaSportRank.findMany({
      where: {
        distance: event.distance,
        style: dbStyle,
        gender: waGender,
        poolLength,
      },
      orderBy: { normTimeMs: 'asc' }, // strictest (fastest) first
    });
    // No fallback to other pool lengths – SCM and LCM norms are different!

    const updates: Prisma.PrismaPromise<unknown>[] = [];

    for (const [, groupEntries] of groups) {
      // Step 1: Filter — separate OK and PK entries from DQ/DNS/DNF
      const validEntries = groupEntries.filter(
        e => e.result && (e.result.status === 'OK' || e.result.status === 'PK') && e.result.finishTimeMs != null,
      );
      // PK entries compete but are marked separately
      const okEntries = validEntries.filter(e => e.result!.status === 'OK');
      const pkEntries = validEntries.filter(e => e.result!.status === 'PK');

      // Step 2: Sort by finish time ASC
      okEntries.sort((a, b) => a.result!.finishTimeMs! - b.result!.finishTimeMs!);
      pkEntries.sort((a, b) => a.result!.finishTimeMs! - b.result!.finishTimeMs!);

      // Step 3: Assign places with tie handling (OK entries only)
      let currentPlace = 1;
      for (let i = 0; i < okEntries.length; i++) {
        if (i > 0 && okEntries[i].result!.finishTimeMs === okEntries[i - 1].result!.finishTimeMs) {
          // Same time = same place (tie)
        } else {
          currentPlace = i + 1;
        }

        const finishTimeMs = okEntries[i].result!.finishTimeMs!;

        // Step 4: Calculate WA points: P = 1000 × (BT/T)³
        let pointsWa: number | null = null;
        if (baseTimeMs && finishTimeMs > 0) {
          pointsWa = Math.floor(1000 * Math.pow(baseTimeMs / finishTimeMs, 3));
        }

        // Step 5: Determine achieved rank (best norm beaten)
        let achievedRank: string | null = null;
        for (const rankRow of uaRanks) {
          if (finishTimeMs <= rankRow.normTimeMs) {
            achievedRank = RANK_MAP_TO_LATIN[rankRow.rank] || rankRow.rank;
            break;
          }
        }

        const pd = placeToDisplay(currentPlace, 'OK');
        updates.push(this.prisma.result.update({
          where: { id: okEntries[i].result!.id },
          data: { place: currentPlace, placeDisplay: pd, pointsWa, achievedRank },
        }));

        // Profile Upgrade (Athletes only, not for relays)
        if (achievedRank && okEntries[i].athlete) {
          const athlete = okEntries[i].athlete!;
          const currentTier = RANK_TIERS[athlete.currentRank || 'NONE'] || 0;
          const achievedTier = RANK_TIERS[achievedRank] || 0;
          if (achievedTier > currentTier) {
            updates.push(this.prisma.athlete.update({
              where: { id: athlete.id },
              data: { currentRank: achievedRank },
            }));
          }
        }
      }

      // PK entries — calculate rank/points but no place
      for (const entry of pkEntries) {
        const finishTimeMs = entry.result!.finishTimeMs!;
        let pointsWa: number | null = null;
        if (baseTimeMs && finishTimeMs > 0) {
          pointsWa = Math.floor(1000 * Math.pow(baseTimeMs / finishTimeMs, 3));
        }
        let achievedRank: string | null = null;
        for (const rankRow of uaRanks) {
          if (finishTimeMs <= rankRow.normTimeMs) {
            achievedRank = RANK_MAP_TO_LATIN[rankRow.rank] || rankRow.rank;
            break;
          }
        }
        updates.push(this.prisma.result.update({
          where: { id: entry.result!.id },
          data: { place: null, placeDisplay: 'п/к', pointsWa, achievedRank },
        }));

        // Profile Upgrade (Athletes only, not for relays)
        if (achievedRank && entry.athlete) {
          const athlete = entry.athlete!;
          const currentTier = RANK_TIERS[athlete.currentRank || 'NONE'] || 0;
          const achievedTier = RANK_TIERS[achievedRank] || 0;
          if (achievedTier > currentTier) {
            updates.push(this.prisma.athlete.update({
              where: { id: athlete.id },
              data: { currentRank: achievedRank },
            }));
          }
        }
      }

      // DQ/DNS/DNF entries — no place, no points
      const invalidEntries = groupEntries.filter(
        e => e.result && !['OK', 'PK'].includes(e.result.status),
      );
      for (const entry of invalidEntries) {
        const pd = placeToDisplay(null, entry.result!.status);
        updates.push(this.prisma.result.update({
          where: { id: entry.result!.id },
          data: { place: null, placeDisplay: pd, pointsWa: null, achievedRank: null },
        }));
      }
    }

    // Execute all updates in a single transaction
    await this.prisma.$transaction(updates);

    // Notify live results
    void this.liveGateway.notifyResultsUpdated(event.competitionId);

    await this.auditService.logAction('EVENT_FINALIZED', 'Event', eventId);

    return { finalized: true, eventId };
  }
  async unfinalizeEvent(eventId: number) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { competition: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    if (event.competition.status === 'completed') {
      throw new ForbiddenException('Змагання завершено (архів). Скасування фіналізації заблоковано.');
    }

    const entries = await this.prisma.entry.findMany({
      where: { eventId },
      include: { result: true },
    });

    const updates = entries
      .filter((e) => e.result)
      .map((e) =>
        this.prisma.result.update({
          where: { id: e.result!.id },
          data: {
            place: null,
            placeDisplay: null,
            pointsWa: null,
            achievedRank: null,
          },
        })
      );

    await this.prisma.$transaction(updates);
    void this.liveGateway.notifyResultsUpdated(event.competitionId);

    await this.auditService.logAction('EVENT_UNFINALIZED', 'Event', eventId);

    return { unfinalized: true, eventId };
  }

  async getEventResults(eventId: number) {
    return this.prisma.entry.findMany({
      where: { eventId, result: { isNot: null } },
      include: { athlete: true, result: true, ageGroup: true },
      orderBy: { result: { place: 'asc' } },
    });
  }
}
