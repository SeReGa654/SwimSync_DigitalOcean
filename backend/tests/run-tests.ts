import * as assert from 'node:assert/strict';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import { FeatureFlagsService } from '../src/feature-flags/feature-flags.service';
import { FEATURE_FLAG_DEFINITIONS } from '../src/feature-flags/feature-flags.registry';
import { PrismaService } from '../src/prisma/prisma.service';
import { AthletesController } from '../src/athletes/athletes.controller';
import { CompetitionsService } from '../src/competitions/competitions.service';
import { ExportController } from '../src/export/export.controller';
import { assignEntriesToHeats, buildLaneOrder } from '../src/seeding/seeding.service';
import { msToTime, parseTime } from '../src/utils/time.utils';

function runTest(name: string, testFn: () => void | Promise<void>) {
  try {
    const result = testFn();
    if (result instanceof Promise) {
      return result.then(() => {
        console.log(`✓ ${name}`);
      });
    }
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

class FeatureFlagStore {
  private readonly rows = new Map<string, { key: string; enabled: boolean; updatedBy: string | null; updatedAt: Date }>();

  async findMany() {
    return Array.from(this.rows.values());
  }

  async findUnique(args: { where: { key: string }; select?: { enabled: true } }) {
    const row = this.rows.get(args.where.key);
    if (!row) return null;
    if (args.select?.enabled) {
      return { enabled: row.enabled };
    }
    return row;
  }

  async upsert(args: {
    where: { key: string };
    create: { key: string; enabled: boolean; updatedBy: string | null };
    update: { enabled: boolean; updatedBy: string | null };
  }) {
    const existing = this.rows.get(args.where.key);
    const updated = {
      key: args.where.key,
      enabled: existing ? args.update.enabled : args.create.enabled,
      updatedBy: existing ? args.update.updatedBy : args.create.updatedBy,
      updatedAt: new Date(),
    };
    this.rows.set(args.where.key, updated);
    return updated;
  }
}

async function main() {
  const createExportController = () =>
    new ExportController({} as any, {} as any);
  const createEntry = (
    id: number,
    payload: {
      ageGroupId?: number | null;
      region?: string;
      club?: string;
      gender?: 'M' | 'F';
      status?: 'OK' | 'PK' | 'DQ';
      place?: number | null;
    } = {},
  ) => ({
    id,
    ageGroupId: payload.ageGroupId ?? null,
    laneNumber: id,
    athlete: {
      firstName: `Name${id}`,
      lastName: `Last${id}`,
      birthYear: 2010,
      currentRank: 'NONE',
      club: payload.club ?? '',
      region: payload.region ?? '',
      gender: payload.gender ?? 'M',
      coach: '',
    },
    result: {
      place: payload.place ?? id,
      placeDisplay: `${payload.place ?? id}`,
      finishTimeMs: 60000 + id * 100,
      achievedRank: null,
      pointsWa: null,
      status: payload.status ?? 'OK',
      dqReason: null,
    },
  });

  await runTest('AuthService.readCookie читає cookie за ключем', () => {
    const auth = new AuthService();
    const value = auth.readCookie('foo=bar; admin_token=secret%20123; path=/', 'admin_token');
    assert.equal(value, 'secret 123');
  });

  await runTest('AuthService.getCookieConfig повертає безпечні дефолти', () => {
    const prev = {
      ADMIN_COOKIE_NAME: process.env.ADMIN_COOKIE_NAME,
      ADMIN_COOKIE_MAX_AGE_MS: process.env.ADMIN_COOKIE_MAX_AGE_MS,
      ADMIN_COOKIE_PATH: process.env.ADMIN_COOKIE_PATH,
      ADMIN_COOKIE_SAME_SITE: process.env.ADMIN_COOKIE_SAME_SITE,
      ADMIN_COOKIE_SECURE: process.env.ADMIN_COOKIE_SECURE,
    };
    delete process.env.ADMIN_COOKIE_NAME;
    delete process.env.ADMIN_COOKIE_MAX_AGE_MS;
    delete process.env.ADMIN_COOKIE_PATH;
    delete process.env.ADMIN_COOKIE_SAME_SITE;
    delete process.env.ADMIN_COOKIE_SECURE;

    const auth = new AuthService();
    const config = auth.getCookieConfig();
    assert.equal(config.name, 'admin_token');
    assert.equal(config.path, '/');
    assert.equal(config.sameSite, 'lax');
    assert.ok(config.maxAgeMs > 0);

    const keys = Object.keys(prev) as Array<keyof typeof prev>;
    for (const key of keys) {
      if (prev[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prev[key];
      }
    }
  });

  await runTest('parseTime коректно парсить M:SS.ms та SS.ms', () => {
    assert.equal(parseTime('1:05.50'), 65500);
    assert.equal(parseTime('59.10'), 59100);
    assert.equal(parseTime(''), null);
  });

  await runTest('msToTime коректно форматує мілісекунди', () => {
    assert.equal(msToTime(65500), '1:05.50');
    assert.equal(msToTime(59100), '59.10');
    assert.equal(msToTime(null), '');
  });

  await runTest('FeatureFlagsService.listFlags повертає реєстр з дефолтами', async () => {
    const store = new FeatureFlagStore();
    const service = new FeatureFlagsService({ featureFlag: store } as unknown as PrismaService);
    const flags = await service.listFlags();
    assert.equal(flags.length, FEATURE_FLAG_DEFINITIONS.length);
    const docx = flags.find((f) => f.key === 'ff.export.docx.queue');
    assert.ok(docx);
    assert.equal(docx.overridden, false);
    assert.equal(docx.enabled, true);
  });

  await runTest('FeatureFlagsService.updateFlag створює override та змінює isEnabled', async () => {
    const store = new FeatureFlagStore();
    const service = new FeatureFlagsService({ featureFlag: store } as unknown as PrismaService);
    const before = await service.isEnabled('ff.export.docx.queue');
    assert.equal(before, true);
    const updated = await service.updateFlag('ff.export.docx.queue', false, 'admin');
    assert.equal(updated.enabled, false);
    assert.equal(updated.overridden, true);
    assert.equal(updated.updatedBy, 'admin');
    const after = await service.isEnabled('ff.export.docx.queue');
    assert.equal(after, false);
  });

  await runTest('FeatureFlagsService кидає NotFoundException для невідомого ключа', async () => {
    const store = new FeatureFlagStore();
    const service = new FeatureFlagsService({ featureFlag: store } as unknown as PrismaService);
    await assert.rejects(() => service.getFlag('ff.unknown.key'), (error: unknown) => error instanceof NotFoundException);
  });

  await runTest('Seeding lane order for 8 lanes follows center-right-left zigzag', () => {
    assert.deepEqual(buildLaneOrder(8), [4, 5, 3, 6, 2, 7, 1, 8]);
  });

  await runTest('Seeding lane order for 10 lanes includes lane 0 per configured zigzag', () => {
    assert.deepEqual(buildLaneOrder(10), [4, 5, 3, 6, 2, 7, 1, 8, 0, 9]);
  });

  await runTest('Seeding lane order for 6 lanes keeps center-right-left distribution', () => {
    assert.deepEqual(buildLaneOrder(6), [3, 4, 2, 5, 1, 6]);
  });

  await runTest('Seeding for 3 heats uses block fill by heat', () => {
    const sortedEntries = Array.from({ length: 9 }).map((_, idx) => ({ id: idx + 1, entryTimeMs: 50000 + idx * 1000 }));
    const assigned = assignEntriesToHeats(sortedEntries, 3);
    assert.deepEqual(assigned.map((item) => item.heatNumber), [3, 3, 3, 2, 2, 2, 1, 1, 1]);
  });

  await runTest('AthletesController блокує bulk-edit import коли флаг вимкнений', async () => {
    const controller = new AthletesController(
      { confirmImport: async () => ({ imported: 0, entries: 0 }) } as any,
      { competition: { findUnique: async () => ({ id: 1, status: 'draft' }) } } as any,
      { isEnabled: async () => false } as any,
    );
    await assert.rejects(
      () => controller.confirmImport(1, { athletes: [], entries: [], bulkEditApplied: true } as any),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  await runTest('AthletesController пропускає import без bulk-edit навіть коли флаг вимкнений', async () => {
    let called = false;
    const controller = new AthletesController(
      {
        confirmImport: async () => {
          called = true;
          return { imported: 1, entries: 1 };
        },
      } as any,
      { competition: { findUnique: async () => ({ id: 1, status: 'draft' }) } } as any,
      { isEnabled: async () => false } as any,
    );
    const result = await controller.confirmImport(1, { athletes: [], entries: [], bulkEditApplied: false } as any);
    assert.equal(called, true);
    assert.deepEqual(result, { imported: 1, entries: 1 });
  });

  await runTest('CompetitionsService блокує пресети для operator ролі', async () => {
    const service = new CompetitionsService({} as any, { logAction: async () => undefined } as any);
    await assert.rejects(
      () => service.listResultProtocolPresets(1, 10, 'operator' as any),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  await runTest('CompetitionsService валідує MIXED конфіг без груп', async () => {
    const service = new CompetitionsService(
      { competition: { findFirst: async () => ({ id: 1 }) } } as any,
      { logAction: async () => undefined } as any,
    );
    await assert.rejects(
      () => service.setResultProtocolConfig(1, { format: 'MIXED' } as any, 'admin', 1),
      (error: unknown) => error instanceof BadRequestException,
    );
  });

  await runTest('CompetitionsService блокує оновлення protocol config для operator ролі', async () => {
    const service = new CompetitionsService({} as any, { logAction: async () => undefined } as any);
    await assert.rejects(
      () => service.setResultProtocolConfig(1, { format: 'SEPARATE' } as any, 'operator' as any, 10),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  await runTest('CompetitionsService логгує create/apply/delete preset та save defaults', async () => {
    const auditCalls: string[] = [];
    const service = new CompetitionsService(
      {
        resultProtocolPreset: {
          create: async ({ data }: any) => ({ id: 44, ...data }),
          findFirst: async ({ where }: any) => ({
            id: where.id,
            competitionId: where.competitionId,
            ownerUserId: 5,
            isShared: true,
            configJson: {
              format: 'COMBINED',
              mixedFormatPrimaryAgeGroupId: null,
              mixedFormatSecondaryAgeGroupIds: [],
              advancedGrouping: null,
            },
          }),
          delete: async ({ where }: any) => ({ id: where.id, isShared: true }),
        },
        competition: {
          update: async ({ where }: any) => ({ id: where.id }),
        },
        userResultProtocolPreference: {
          upsert: async ({ where }: any) => ({ id: 1, userId: where.userId }),
        },
      } as any,
      {
        logAction: async (action: string) => {
          auditCalls.push(action);
        },
      } as any,
    );

    await service.createResultProtocolPreset(1, 5, 'admin', {
      name: 'Preset',
      isShared: true,
      config: { format: 'COMBINED' },
    } as any);
    await service.applyResultProtocolPreset(1, 44, 5, 'admin');
    await service.deleteResultProtocolPreset(1, 44, 5, 'admin');
    await service.setMyResultProtocolDefaults(5, { format: 'SEPARATE' } as any);

    assert.ok(auditCalls.includes('RESULT_PROTOCOL_PRESET_CREATED'));
    assert.ok(auditCalls.includes('RESULT_PROTOCOL_PRESET_APPLIED'));
    assert.ok(auditCalls.includes('RESULT_PROTOCOL_PRESET_DELETED'));
    assert.ok(auditCalls.includes('RESULT_PROTOCOL_DEFAULTS_SAVED'));
  });

  await runTest('CompetitionsService блокує secretary для створення shared пресета', async () => {
    const service = new CompetitionsService({} as any, { logAction: async () => undefined } as any);
    await assert.rejects(
      () => service.createResultProtocolPreset(1, 7, 'secretary', {
        name: 'Shared preset',
        isShared: true,
        config: { format: 'SEPARATE' },
      } as any),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  await runTest('CompetitionsService блокує secretary для зміни shared toggle', async () => {
    const service = new CompetitionsService(
      {
        resultProtocolPreset: {
          findFirst: async () => ({
            id: 55,
            competitionId: 1,
            ownerUserId: 7,
            isShared: false,
            configJson: { format: 'SEPARATE' },
          }),
        },
      } as any,
      { logAction: async () => undefined } as any,
    );
    await assert.rejects(
      () => service.updateResultProtocolPreset(1, 55, 7, 'secretary', { isShared: true } as any),
      (error: unknown) => error instanceof ForbiddenException,
    );
  });

  await runTest('Rules engine: table-driven EQ/IN/CONTAINS (including invalid values)', () => {
    const controller = createExportController() as any;
    const entry = createEntry(1, { ageGroupId: 12, region: 'Київ', club: 'Dynamo', gender: 'F' });
    const cases: Array<{ condition: any; expected: boolean }> = [
      { condition: { field: 'ageGroupId', operator: 'EQ', value: 12 }, expected: true },
      { condition: { field: 'ageGroupId', operator: 'EQ', value: 11 }, expected: false },
      { condition: { field: 'region', operator: 'EQ', value: 'київ' }, expected: true },
      { condition: { field: 'club', operator: 'IN', value: ['Start', 'dynamo'] }, expected: true },
      { condition: { field: 'club', operator: 'IN', value: 'dynamo' }, expected: false },
      { condition: { field: 'ageGroupId', operator: 'IN', value: [10, 12, 14] }, expected: true },
      { condition: { field: 'region', operator: 'CONTAINS', value: 'ки' }, expected: true },
      { condition: { field: 'region', operator: 'CONTAINS', value: 'odesa' }, expected: false },
    ];
    for (const testCase of cases) {
      assert.equal(controller.evaluateCondition(entry, testCase.condition), testCase.expected);
    }
  });

  await runTest('Rules engine: AND/OR blocks and second-level subgroups behave correctly', () => {
    const controller = createExportController() as any;
    const entry = createEntry(2, { ageGroupId: 15, region: 'Київ', club: 'SC Waves', gender: 'F' });

    const andGroup = {
      name: 'AND Group',
      operator: 'AND',
      conditions: [
        { field: 'region', operator: 'CONTAINS', value: 'ки' },
        { field: 'gender', operator: 'EQ', value: 'f' },
      ],
      subgroups: [
        {
          operator: 'OR',
          conditions: [
            { field: 'club', operator: 'CONTAINS', value: 'waves' },
            { field: 'ageGroupId', operator: 'EQ', value: 99 },
          ],
        },
      ],
    };
    const orGroup = {
      name: 'OR Group',
      operator: 'OR',
      conditions: [
        { field: 'region', operator: 'EQ', value: 'Львів' },
        { field: 'ageGroupId', operator: 'EQ', value: 15 },
      ],
      subgroups: [
        {
          operator: 'AND',
          conditions: [
            { field: 'club', operator: 'CONTAINS', value: 'missing' },
          ],
        },
      ],
    };
    assert.equal(controller.evaluateRuleGroup(entry, andGroup), true);
    assert.equal(controller.evaluateRuleGroup(entry, orGroup), true);
    assert.equal(controller.evaluateConditionBlock(entry, { operator: 'AND', conditions: [] }), false);
  });

  await runTest('Rules engine: first matching group wins when rules overlap', () => {
    const controller = createExportController() as any;
    const entries = [
      createEntry(1, { region: 'Київ', club: 'Dynamo' }),
      createEntry(2, { region: 'Київ', club: 'Aqua' }),
    ];
    const groups = controller.buildAdvancedAgeGroups(entries, {
      enabled: true,
      includeUnmatched: true,
      unmatchedGroupName: 'Інші',
      groups: [
        {
          name: 'Kyiv First',
          operator: 'AND',
          conditions: [{ field: 'region', operator: 'EQ', value: 'Київ' }],
          subgroups: [],
        },
        {
          name: 'Dynamo Second',
          operator: 'AND',
          conditions: [{ field: 'club', operator: 'CONTAINS', value: 'dynamo' }],
          subgroups: [],
        },
      ],
    });
    assert.equal(groups[0]?.name, 'Kyiv First');
    assert.deepEqual(groups[0]?.results.map((r: any) => r.lane), [1, 2]);
    assert.equal(groups.some((g: any) => g.name === 'Dynamo Second'), false);
  });

  await runTest('Rules engine: includeUnmatched=true adds fallback group; false skips it', () => {
    const controller = createExportController() as any;
    const entries = [
      createEntry(10, { region: 'Київ', club: 'Dynamo' }),
      createEntry(11, { region: 'Одеса', club: 'Shark' }),
    ];

    const withUnmatched = controller.buildAdvancedAgeGroups(entries, {
      enabled: true,
      includeUnmatched: true,
      unmatchedGroupName: 'No Match',
      groups: [
        {
          name: 'Kyiv Only',
          operator: 'AND',
          conditions: [{ field: 'region', operator: 'EQ', value: 'Київ' }],
          subgroups: [],
        },
      ],
    });
    assert.equal(withUnmatched.length, 2);
    assert.equal(withUnmatched[1]?.name, 'No Match');
    assert.deepEqual(withUnmatched[1]?.results.map((r: any) => r.lane), [11]);

    const withoutUnmatched = controller.buildAdvancedAgeGroups(entries, {
      enabled: true,
      includeUnmatched: false,
      unmatchedGroupName: 'No Match',
      groups: [
        {
          name: 'Kyiv Only',
          operator: 'AND',
          conditions: [{ field: 'region', operator: 'EQ', value: 'Київ' }],
          subgroups: [],
        },
      ],
    });
    assert.equal(withoutUnmatched.length, 1);
    assert.equal(withoutUnmatched[0]?.name, 'Kyiv Only');
  });

  await runTest('Rules engine: missing entry fields do not crash and remain unmatched', () => {
    const controller = createExportController() as any;
    const entry = {
      id: 50,
      ageGroupId: null,
      laneNumber: 50,
      athlete: null,
      result: {
        place: 1,
        placeDisplay: '1',
        finishTimeMs: 50000,
        achievedRank: null,
        pointsWa: null,
        status: 'OK',
        dqReason: null,
      },
    };

    const groups = controller.buildAdvancedAgeGroups([entry], {
      enabled: true,
      includeUnmatched: true,
      unmatchedGroupName: 'Інші',
      groups: [
        {
          name: 'Has Club',
          operator: 'AND',
          conditions: [{ field: 'club', operator: 'CONTAINS', value: 'x' }],
          subgroups: [],
        },
      ],
    });

    assert.equal(groups.length, 1);
    assert.equal(groups[0]?.name, 'Інші');
    assert.equal(groups[0]?.results[0]?.full_name, 'Команда');
  });

  console.log('Backend unit tests passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

