import { ExportController } from '../src/export/export.controller';

type BenchmarkOptions = {
  entries: number;
  groups: number;
  runs: number;
};

const DEFAULTS: BenchmarkOptions = {
  entries: 10000,
  groups: 8,
  runs: 10,
};

function parseArgs(): BenchmarkOptions {
  const opts = { ...DEFAULTS };
  for (const arg of process.argv.slice(2)) {
    const [key, rawValue] = arg.split('=');
    if (key === '--entries') opts.entries = Math.max(1, Number(rawValue));
    if (key === '--groups') opts.groups = Math.max(1, Number(rawValue));
    if (key === '--runs') opts.runs = Math.max(1, Number(rawValue));
  }
  return opts;
}

function generateEntries(count: number) {
  const regions = ['Kyiv', 'Lviv', 'Odesa', 'Dnipro'];
  const clubs = ['Dynamo', 'Start', 'Aqua', 'Shark'];
  return Array.from({ length: count }).map((_, index) => ({
    id: index + 1,
    laneNumber: (index % 10) + 1,
    ageGroupId: (index % 6) + 1,
    athlete: {
      firstName: `Name${index + 1}`,
      lastName: `Last${index + 1}`,
      birthYear: 2008 + (index % 8),
      currentRank: 'NONE',
      club: clubs[index % clubs.length],
      region: regions[index % regions.length],
      gender: index % 2 === 0 ? 'M' : 'F',
      coach: 'Coach',
    },
    result: {
      place: (index % 50) + 1,
      placeDisplay: String((index % 50) + 1),
      finishTimeMs: 55000 + (index % 3000),
      achievedRank: null,
      pointsWa: null,
      status: 'OK',
      dqReason: null,
    },
  }));
}

function generateGrouping(groupCount: number) {
  return {
    enabled: true,
    includeUnmatched: true,
    unmatchedGroupName: 'Інші',
    groups: Array.from({ length: groupCount }).map((_, index) => ({
      name: `Group ${index + 1}`,
      operator: 'AND' as const,
      conditions: [
        { field: 'region' as const, operator: 'EQ' as const, value: ['Kyiv', 'Lviv', 'Odesa', 'Dnipro'][index % 4] },
      ],
      subgroups: [
        {
          operator: 'OR' as const,
          conditions: [
            { field: 'club' as const, operator: 'CONTAINS' as const, value: ['Dyn', 'Sta', 'Aqu', 'Sha'][index % 4] },
            { field: 'gender' as const, operator: 'EQ' as const, value: index % 2 === 0 ? 'M' : 'F' },
          ],
        },
      ],
    })),
  };
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[rank];
}

async function main() {
  const opts = parseArgs();
  const controller = new ExportController({} as any, {} as any) as any;
  const entries = generateEntries(opts.entries);
  const grouping = generateGrouping(opts.groups);
  const durations: number[] = [];

  for (let run = 0; run < opts.runs; run += 1) {
    const start = process.hrtime.bigint();
    controller.buildAdvancedAgeGroups(entries, grouping);
    const end = process.hrtime.bigint();
    durations.push(Number(end - start) / 1_000_000);
  }

  const avg = durations.reduce((sum, value) => sum + value, 0) / durations.length;
  console.log('[benchmark-advanced-grouping] completed');
  console.log(`[benchmark-advanced-grouping] entries=${opts.entries};groups=${opts.groups};runs=${opts.runs}`);
  console.log(`[benchmark-advanced-grouping] avgMs=${avg.toFixed(2)};p50Ms=${percentile(durations, 50).toFixed(2)};p95Ms=${percentile(durations, 95).toFixed(2)};maxMs=${Math.max(...durations).toFixed(2)}`);
}

main().catch((error) => {
  console.error('[benchmark-advanced-grouping] failed');
  console.error(error);
  process.exit(1);
});
