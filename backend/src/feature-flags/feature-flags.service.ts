import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { FeatureFlagDto } from 'shared-contracts';
import { FEATURE_FLAG_DEFINITIONS, FEATURE_FLAG_KEYS } from './feature-flags.registry';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  private toDto(
    def: (typeof FEATURE_FLAG_DEFINITIONS)[number],
    override?: { enabled: boolean; updatedBy: string | null; updatedAt: Date },
  ): FeatureFlagDto {
    return {
      key: def.key,
      name: def.name,
      description: def.description,
      defaultEnabled: def.defaultEnabled,
      enabled: override?.enabled ?? def.defaultEnabled,
      overridden: Boolean(override),
      updatedBy: override?.updatedBy ?? null,
      updatedAt: override?.updatedAt?.toISOString() ?? null,
    };
  }

  private ensureKnownKey(key: string): void {
    if (!FEATURE_FLAG_KEYS.has(key)) {
      throw new NotFoundException('Feature flag not found');
    }
  }

  async listFlags(): Promise<FeatureFlagDto[]> {
    const rows = await this.prisma.featureFlag.findMany();
    const rowByKey = new Map(rows.map((row) => [row.key, row]));
    return FEATURE_FLAG_DEFINITIONS.map((def) => this.toDto(def, rowByKey.get(def.key)));
  }

  async getFlag(key: string): Promise<FeatureFlagDto> {
    this.ensureKnownKey(key);
    const def = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === key)!;
    const row = await this.prisma.featureFlag.findUnique({ where: { key } });
    return this.toDto(def, row || undefined);
  }

  async isEnabled(key: string): Promise<boolean> {
    this.ensureKnownKey(key);
    const def = FEATURE_FLAG_DEFINITIONS.find((item) => item.key === key)!;
    const row = await this.prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true },
    });
    return row?.enabled ?? def.defaultEnabled;
  }

  async updateFlag(key: string, enabled: boolean, updatedBy?: string): Promise<FeatureFlagDto> {
    this.ensureKnownKey(key);
    await this.prisma.featureFlag.upsert({
      where: { key },
      create: {
        key,
        enabled,
        updatedBy: updatedBy || null,
      },
      update: {
        enabled,
        updatedBy: updatedBy || null,
      },
    });
    return this.getFlag(key);
  }
}
