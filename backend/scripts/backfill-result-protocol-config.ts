import { Prisma, PrismaClient, ResultProtocolFormat } from '@prisma/client';

type NormalizedConfig = {
  format: ResultProtocolFormat;
  mixedFormatPrimaryAgeGroupId: number | null;
  mixedFormatSecondaryAgeGroupIds: number[];
  advancedGrouping: Record<string, unknown> | null;
};

function parseMixedSecondary(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item));
  } catch {
    return [];
  }
}

function extractAdvancedGrouping(configJson: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!configJson || typeof configJson !== 'object' || Array.isArray(configJson)) return null;
  const root = configJson as Record<string, unknown>;
  if (!root.advancedGrouping || typeof root.advancedGrouping !== 'object' || Array.isArray(root.advancedGrouping)) {
    return null;
  }
  return root.advancedGrouping as Record<string, unknown>;
}

function isDefaultLegacyCompetitionConfig(input: {
  resultProtocolFormat: ResultProtocolFormat;
  mixedFormatPrimaryAgeGroupId: number | null;
  mixedFormatSecondaryAgeGroupIds: string | null;
  resultProtocolConfigJson: Prisma.JsonValue | null;
}): boolean {
  return input.resultProtocolFormat === 'SEPARATE'
    && input.mixedFormatPrimaryAgeGroupId == null
    && parseMixedSecondary(input.mixedFormatSecondaryAgeGroupIds).length === 0
    && !extractAdvancedGrouping(input.resultProtocolConfigJson);
}

function normalizePreferenceConfig(raw: Prisma.JsonValue): NormalizedConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const format = input.format;
  if (format !== 'SEPARATE' && format !== 'COMBINED' && format !== 'MIXED') return null;

  const mixedPrimaryRaw = input.mixedFormatPrimaryAgeGroupId;
  const mixedPrimaryAgeGroupId = mixedPrimaryRaw == null ? null : Number(mixedPrimaryRaw);
  const mixedSecondaryRaw = input.mixedFormatSecondaryAgeGroupIds;
  const mixedFormatSecondaryAgeGroupIds = Array.isArray(mixedSecondaryRaw)
    ? mixedSecondaryRaw.map((item) => Number(item)).filter((item) => Number.isInteger(item))
    : [];

  if (format === 'MIXED') {
    if (!mixedPrimaryAgeGroupId || mixedFormatSecondaryAgeGroupIds.length === 0) return null;
    if (mixedFormatSecondaryAgeGroupIds.includes(mixedPrimaryAgeGroupId)) return null;
  }

  const advancedGrouping = extractAdvancedGrouping(input as Prisma.JsonValue);
  return {
    format,
    mixedFormatPrimaryAgeGroupId: format === 'MIXED' ? mixedPrimaryAgeGroupId : null,
    mixedFormatSecondaryAgeGroupIds: format === 'MIXED' ? mixedFormatSecondaryAgeGroupIds : [],
    advancedGrouping,
  };
}

function configToUpdateData(config: NormalizedConfig): Prisma.CompetitionUpdateInput {
  return {
    resultProtocolFormat: config.format,
    mixedFormatPrimaryAgeGroupId: config.format === 'MIXED' ? config.mixedFormatPrimaryAgeGroupId : null,
    mixedFormatSecondaryAgeGroupIds: config.format === 'MIXED' ? JSON.stringify(config.mixedFormatSecondaryAgeGroupIds) : null,
    resultProtocolConfigJson: config.advancedGrouping
      ? ({
          advancedGrouping: config.advancedGrouping,
        } as Prisma.JsonObject)
      : Prisma.JsonNull,
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const prisma = new PrismaClient();

  try {
    const competitions = await prisma.competition.findMany({
      where: { createdByUserId: { not: null } },
      select: {
        id: true,
        name: true,
        createdByUserId: true,
        resultProtocolFormat: true,
        mixedFormatPrimaryAgeGroupId: true,
        mixedFormatSecondaryAgeGroupIds: true,
        resultProtocolConfigJson: true,
        createdByUser: {
          select: {
            resultProtocolPreference: {
              select: {
                configJson: true,
              },
            },
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    let checked = 0;
    let eligible = 0;
    let updated = 0;
    let skippedInvalidPreference = 0;

    for (const competition of competitions) {
      checked += 1;
      if (!isDefaultLegacyCompetitionConfig(competition)) continue;

      const preferenceRaw = competition.createdByUser?.resultProtocolPreference?.configJson;
      if (!preferenceRaw) continue;
      const normalized = normalizePreferenceConfig(preferenceRaw as Prisma.JsonValue);
      if (!normalized) {
        skippedInvalidPreference += 1;
        continue;
      }
      eligible += 1;

      if (apply) {
        await prisma.competition.update({
          where: { id: competition.id },
          data: configToUpdateData(normalized),
        });
        updated += 1;
      }
    }

    console.log(`[backfill-result-protocol-config] mode=${apply ? 'apply' : 'dry-run'}`);
    console.log(`[backfill-result-protocol-config] checked=${checked}`);
    console.log(`[backfill-result-protocol-config] eligible=${eligible}`);
    console.log(`[backfill-result-protocol-config] skippedInvalidPreference=${skippedInvalidPreference}`);
    console.log(`[backfill-result-protocol-config] updated=${updated}`);
    if (!apply) {
      console.log('[backfill-result-protocol-config] dry-run complete. Re-run with --apply to persist changes.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('[backfill-result-protocol-config] failed');
  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error('[backfill-result-protocol-config] database is unreachable. Check DATABASE_URL and ensure Postgres is running.');
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2022') {
    console.error('[backfill-result-protocol-config] database schema is out of sync with Prisma schema.');
    console.error('[backfill-result-protocol-config] run: npm --prefix backend run db:push:pg (or apply migrations) and retry.');
  } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P3005') {
    console.error('[backfill-result-protocol-config] migrate deploy cannot run on a non-empty unbaselined DB. Use db:push:pg or baseline migrations first.');
  }
  console.error(error);
  process.exit(1);
});
