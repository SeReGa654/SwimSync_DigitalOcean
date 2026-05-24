import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Prisma, ResultProtocolFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CreateAgeGroupDto } from './dto/create-age-group.dto';
import {
  ProtocolLogicalOperator,
  ProtocolRuleField,
  ProtocolRuleOperator,
  ResultProtocolConfigDto,
} from './dto/result-protocol-config.dto';
import { CreateResultProtocolPresetDto, UpdateResultProtocolPresetDto } from './dto/result-protocol-preset.dto';
import type { AuthRole } from 'shared-contracts';

type CompetitionRole = AuthRole | 'operator';

interface ResultProtocolConditionValue {
  field: ProtocolRuleField;
  operator: ProtocolRuleOperator;
  value: unknown;
}

interface ResultProtocolConditionBlockValue {
  operator: ProtocolLogicalOperator;
  conditions: ResultProtocolConditionValue[];
}

interface ResultProtocolRuleGroupValue extends ResultProtocolConditionBlockValue {
  name: string;
  subgroups: ResultProtocolConditionBlockValue[];
}

interface ResultProtocolAdvancedGroupingValue {
  enabled: boolean;
  groups: ResultProtocolRuleGroupValue[];
  includeUnmatched: boolean;
  unmatchedGroupName: string;
}

export interface ResultProtocolConfigValue {
  format: 'SEPARATE' | 'COMBINED' | 'MIXED';
  mixedFormatPrimaryAgeGroupId: number | null;
  mixedFormatSecondaryAgeGroupIds: number[];
  advancedGrouping: ResultProtocolAdvancedGroupingValue | null;
}

@Injectable()
export class CompetitionsService {
  constructor(private prisma: PrismaService, private auditService: AuditService) {}

  private ensureProtocolConfigRole(role: CompetitionRole): asserts role is AuthRole {
    if (role !== 'admin' && role !== 'secretary') {
      throw new ForbiddenException('Лише адміністратор або секретар можуть керувати налаштуваннями протоколів.');
    }
  }

  private validateCondition(condition: ResultProtocolConditionValue): void {
    if (!['ageGroupId', 'region', 'club', 'gender'].includes(condition.field)) {
      throw new BadRequestException(`Unsupported condition field: ${condition.field}`);
    }
    if (!['EQ', 'IN', 'CONTAINS'].includes(condition.operator)) {
      throw new BadRequestException(`Unsupported condition operator: ${condition.operator}`);
    }

    if (condition.operator === 'IN') {
      if (!Array.isArray(condition.value) || condition.value.length === 0) {
        throw new BadRequestException('IN condition requires non-empty array value');
      }
    } else if (Array.isArray(condition.value)) {
      throw new BadRequestException(`${condition.operator} condition requires scalar value`);
    }

    if (condition.field === 'ageGroupId') {
      if (condition.operator === 'IN') {
        if (!(condition.value as unknown[]).every((item) => Number.isInteger(Number(item)))) {
          throw new BadRequestException('ageGroupId IN requires integer values');
        }
      } else if (!Number.isInteger(Number(condition.value))) {
        throw new BadRequestException('ageGroupId EQ requires integer value');
      }
    }
  }

  private validateConditionBlock(block: ResultProtocolConditionBlockValue, context: string): void {
    if (!['AND', 'OR'].includes(block.operator)) {
      throw new BadRequestException(`${context}: operator must be AND or OR`);
    }
    if (!Array.isArray(block.conditions) || block.conditions.length === 0) {
      throw new BadRequestException(`${context}: at least one condition is required`);
    }
    for (const condition of block.conditions) {
      this.validateCondition(condition);
    }
  }

  private validateAdvancedGrouping(config: ResultProtocolAdvancedGroupingValue): void {
    if (!Array.isArray(config.groups) || config.groups.length === 0) {
      throw new BadRequestException('Advanced grouping requires at least one rule group');
    }
    for (let groupIndex = 0; groupIndex < config.groups.length; groupIndex += 1) {
      const group = config.groups[groupIndex];
      if (!group.name?.trim()) {
        throw new BadRequestException(`Group #${groupIndex + 1} must have a name`);
      }
      this.validateConditionBlock(group, `Group "${group.name}"`);
      if (!Array.isArray(group.subgroups)) {
        throw new BadRequestException(`Group "${group.name}": subgroups must be an array`);
      }
      for (let blockIndex = 0; blockIndex < group.subgroups.length; blockIndex += 1) {
        this.validateConditionBlock(group.subgroups[blockIndex], `Group "${group.name}" subgroup #${blockIndex + 1}`);
      }
    }
  }

  private normalizeConfig(input: ResultProtocolConfigDto | ResultProtocolConfigValue): ResultProtocolConfigValue {
    const format = input.format;
    if (!['SEPARATE', 'COMBINED', 'MIXED'].includes(format)) {
      throw new BadRequestException('Invalid result protocol format');
    }

    const mixedPrimaryAgeGroupId = input.mixedFormatPrimaryAgeGroupId ?? null;
    const mixedFormatSecondaryAgeGroupIds = input.mixedFormatSecondaryAgeGroupIds ?? [];

    if (format === 'MIXED') {
      if (!mixedPrimaryAgeGroupId || mixedFormatSecondaryAgeGroupIds.length === 0) {
        throw new BadRequestException('MIXED format requires primaryAgeGroupId and secondaryAgeGroupIds');
      }
      if (mixedFormatSecondaryAgeGroupIds.includes(mixedPrimaryAgeGroupId)) {
        throw new BadRequestException('Primary age group cannot be in secondary groups');
      }
    }

    let advancedGrouping: ResultProtocolAdvancedGroupingValue | null = null;
    if (input.advancedGrouping?.enabled) {
      advancedGrouping = {
        enabled: true,
        groups: (input.advancedGrouping.groups || []).map((group) => ({
          name: group.name,
          operator: group.operator,
          conditions: group.conditions || [],
          subgroups: group.subgroups || [],
        })),
        includeUnmatched: input.advancedGrouping.includeUnmatched ?? true,
        unmatchedGroupName: input.advancedGrouping.unmatchedGroupName?.trim() || 'Інші',
      };
      this.validateAdvancedGrouping(advancedGrouping);
    }

    return {
      format,
      mixedFormatPrimaryAgeGroupId: format === 'MIXED' ? mixedPrimaryAgeGroupId : null,
      mixedFormatSecondaryAgeGroupIds: format === 'MIXED' ? mixedFormatSecondaryAgeGroupIds : [],
      advancedGrouping,
    };
  }

  private configToCompetitionUpdateData(config: ResultProtocolConfigValue): Prisma.CompetitionUpdateInput {
    return {
      resultProtocolFormat: config.format as ResultProtocolFormat,
      mixedFormatPrimaryAgeGroupId: config.format === 'MIXED' ? config.mixedFormatPrimaryAgeGroupId : null,
      mixedFormatSecondaryAgeGroupIds:
        config.format === 'MIXED' ? JSON.stringify(config.mixedFormatSecondaryAgeGroupIds) : null,
      resultProtocolConfigJson: config.advancedGrouping
        ? (({
            advancedGrouping: config.advancedGrouping,
          } as unknown) as Prisma.JsonObject)
        : Prisma.JsonNull,
    };
  }

  private extractConfigFromCompetition(competition: {
    resultProtocolFormat: ResultProtocolFormat;
    mixedFormatPrimaryAgeGroupId: number | null;
    mixedFormatSecondaryAgeGroupIds: string | null;
    resultProtocolConfigJson: Prisma.JsonValue | null;
  }): ResultProtocolConfigValue {
    let advancedGrouping: ResultProtocolAdvancedGroupingValue | null = null;
    if (
      competition.resultProtocolConfigJson
      && typeof competition.resultProtocolConfigJson === 'object'
      && !Array.isArray(competition.resultProtocolConfigJson)
    ) {
      const root = competition.resultProtocolConfigJson as Record<string, unknown>;
      if (root.advancedGrouping && typeof root.advancedGrouping === 'object') {
        advancedGrouping = root.advancedGrouping as ResultProtocolAdvancedGroupingValue;
      }
    }

    return {
      format: competition.resultProtocolFormat,
      mixedFormatPrimaryAgeGroupId: competition.mixedFormatPrimaryAgeGroupId,
      mixedFormatSecondaryAgeGroupIds: competition.mixedFormatSecondaryAgeGroupIds
        ? (JSON.parse(competition.mixedFormatSecondaryAgeGroupIds) as number[])
        : [],
      advancedGrouping,
    };
  }

  findAll(viewerRole: AuthRole, viewerUserId: number) {
    return this.prisma.competition.findMany({
      where: viewerRole === 'admin' ? undefined : { createdByUserId: viewerUserId },
      include: { ageGroups: true, _count: { select: { events: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: number, viewerRole: AuthRole, viewerUserId: number) {
    return this.prisma.competition.findFirst({
      where: viewerRole === 'admin' ? { id } : { id, createdByUserId: viewerUserId },
      include: { ageGroups: true, events: true },
    });
  }

  findPublicOne(id: number) {
    return this.prisma.competition.findFirst({
      where: { id },
      include: { ageGroups: true, events: true },
    });
  }

  async create(data: CreateCompetitionDto, createdByUserId: number) {
    const defaults = await this.prisma.userResultProtocolPreference.findUnique({
      where: { userId: createdByUserId },
    });
    let createData: Prisma.CompetitionCreateInput = { ...data, createdByUser: { connect: { id: createdByUserId } } };

    if (defaults?.configJson && typeof defaults.configJson === 'object' && !Array.isArray(defaults.configJson)) {
      const parsedDefaults = this.normalizeConfig(defaults.configJson as unknown as ResultProtocolConfigValue);
      createData = {
        ...createData,
        ...(this.configToCompetitionUpdateData(parsedDefaults) as Prisma.CompetitionCreateInput),
      };
    }

    const res = await this.prisma.competition.create({ data: createData });
    await this.auditService.logAction('COMPETITION_CREATED', 'Competition', res.id, res.name);
    return res;
  }

  async update(id: number, data: UpdateCompetitionDto) {
    let res;
    try {
      res = await this.prisma.competition.update({ where: { id }, data });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Competition not found');
      }
      throw error;
    }
    if (data.status) {
      await this.auditService.logAction(
        'COMPETITION_STATUS_CHANGED',
        'Competition',
        res.id,
        `Status: ${data.status}`,
      );
    }
    return res;
  }

  async delete(id: number) {
    let res;
    try {
      res = await this.prisma.competition.delete({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Competition not found');
      }
      throw error;
    }
    await this.auditService.logAction('COMPETITION_DELETED', 'Competition', id, res.name);
    return res;
  }

  createAgeGroup(competitionId: number, data: CreateAgeGroupDto) {
    return this.prisma.competitionAgeGroup.create({
      data: { ...data, competitionId },
    });
  }

  async deleteAgeGroup(id: number) {
    try {
      return await this.prisma.competitionAgeGroup.delete({ where: { id } });
    } catch (error: unknown) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('Age group not found');
      }
      throw error;
    }
  }

  getAgeGroups(competitionId: number, viewerRole: AuthRole, viewerUserId: number) {
    return this.prisma.competitionAgeGroup.findMany({
      where: viewerRole === 'admin'
        ? { competitionId }
        : { competitionId, competition: { createdByUserId: viewerUserId } },
      orderBy: { birthYearFrom: 'asc' },
    });
  }

  async getResultProtocolConfig(id: number, viewerRole: AuthRole, viewerUserId: number): Promise<ResultProtocolConfigValue> {
    const competition = await this.findOne(id, viewerRole, viewerUserId);
    if (!competition) throw new NotFoundException('Competition not found');
    return this.extractConfigFromCompetition(competition);
  }

  async setResultProtocolConfig(
    id: number,
    data: ResultProtocolConfigDto,
    viewerRole: CompetitionRole,
    viewerUserId: number,
  ) {
    this.ensureProtocolConfigRole(viewerRole);
    const competition = await this.findOne(id, viewerRole, viewerUserId);
    if (!competition) throw new NotFoundException('Competition not found');

    const normalized = this.normalizeConfig(data);
    if (normalized.format === 'MIXED') {
      const ageGroupIds = [normalized.mixedFormatPrimaryAgeGroupId!, ...normalized.mixedFormatSecondaryAgeGroupIds];
      const ageGroups = await this.prisma.competitionAgeGroup.findMany({
        where: { competitionId: id, id: { in: ageGroupIds } },
      });
      if (ageGroups.length !== ageGroupIds.length) {
        throw new BadRequestException('Some age group IDs do not belong to this competition');
      }
    }

    const result = await this.prisma.competition.update({
      where: { id },
      data: this.configToCompetitionUpdateData(normalized),
    });

    await this.auditService.logAction(
      'RESULT_PROTOCOL_CONFIG_CHANGED',
      'Competition',
      id,
      `Format: ${normalized.format}`,
    );

    return result;
  }

  async listResultProtocolPresets(competitionId: number, userId: number, role: CompetitionRole) {
    this.ensureProtocolConfigRole(role);
    return this.prisma.resultProtocolPreset.findMany({
      where: role === 'admin'
        ? { competitionId }
        : {
            competitionId,
            OR: [{ isShared: true }, { ownerUserId: userId }],
          },
      orderBy: [{ isShared: 'desc' }, { updatedAt: 'desc' }],
    });
  }

  async createResultProtocolPreset(competitionId: number, userId: number, role: CompetitionRole, dto: CreateResultProtocolPresetDto) {
    this.ensureProtocolConfigRole(role);
    if (role !== 'admin' && dto.isShared) {
      throw new ForbiddenException('Лише адміністратор може створювати shared-пресети.');
    }
    const normalized = this.normalizeConfig(dto.config);
    const created = await this.prisma.resultProtocolPreset.create({
      data: {
        competitionId,
        ownerUserId: userId,
        name: dto.name.trim(),
        isShared: Boolean(dto.isShared),
        configJson: normalized as unknown as Prisma.JsonObject,
      },
    });
    await this.auditService.logAction(
      'RESULT_PROTOCOL_PRESET_CREATED',
      'ResultProtocolPreset',
      created.id,
      `competitionId=${competitionId};presetId=${created.id};ownerUserId=${userId};visibility=${created.isShared ? 'shared' : 'private'}`,
    );
    return created;
  }

  async updateResultProtocolPreset(
    competitionId: number,
    presetId: number,
    userId: number,
    role: CompetitionRole,
    dto: UpdateResultProtocolPresetDto,
  ) {
    this.ensureProtocolConfigRole(role);
    const preset = await this.prisma.resultProtocolPreset.findFirst({
      where: { id: presetId, competitionId },
    });
    if (!preset) throw new NotFoundException('Preset not found');
    if (role !== 'admin' && preset.ownerUserId !== userId) {
      throw new ForbiddenException('Ви можете редагувати лише власні пресети.');
    }
    if (role !== 'admin' && dto.isShared !== undefined && dto.isShared !== preset.isShared) {
      throw new ForbiddenException('Лише адміністратор може змінювати shared-статус пресета.');
    }

    const data: Prisma.ResultProtocolPresetUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.isShared !== undefined) data.isShared = dto.isShared;
    if (dto.config) {
      data.configJson = this.normalizeConfig(dto.config) as unknown as Prisma.JsonObject;
    }

    const updated = await this.prisma.resultProtocolPreset.update({
      where: { id: presetId },
      data,
    });
    await this.auditService.logAction(
      'RESULT_PROTOCOL_PRESET_UPDATED',
      'ResultProtocolPreset',
      updated.id,
      `competitionId=${competitionId};presetId=${updated.id};visibility=${updated.isShared ? 'shared' : 'private'}`,
    );
    return updated;
  }

  async deleteResultProtocolPreset(competitionId: number, presetId: number, userId: number, role: CompetitionRole) {
    this.ensureProtocolConfigRole(role);
    const preset = await this.prisma.resultProtocolPreset.findFirst({
      where: { id: presetId, competitionId },
    });
    if (!preset) throw new NotFoundException('Preset not found');
    if (role !== 'admin' && preset.ownerUserId !== userId) {
      throw new ForbiddenException('Ви можете видаляти лише власні пресети.');
    }
    const deleted = await this.prisma.resultProtocolPreset.delete({ where: { id: presetId } });
    await this.auditService.logAction(
      'RESULT_PROTOCOL_PRESET_DELETED',
      'ResultProtocolPreset',
      presetId,
      `competitionId=${competitionId};presetId=${presetId};visibility=${deleted.isShared ? 'shared' : 'private'}`,
    );
    return deleted;
  }

  async applyResultProtocolPreset(competitionId: number, presetId: number, userId: number, role: CompetitionRole) {
    this.ensureProtocolConfigRole(role);
    const preset = await this.prisma.resultProtocolPreset.findFirst({
      where: role === 'admin'
        ? { id: presetId, competitionId }
        : { id: presetId, competitionId, OR: [{ isShared: true }, { ownerUserId: userId }] },
    });
    if (!preset) throw new NotFoundException('Preset not found');
    const normalized = this.normalizeConfig(preset.configJson as unknown as ResultProtocolConfigValue);
    const updatedCompetition = await this.prisma.competition.update({
      where: { id: competitionId },
      data: this.configToCompetitionUpdateData(normalized),
    });
    await this.auditService.logAction(
      'RESULT_PROTOCOL_PRESET_APPLIED',
      'Competition',
      competitionId,
      `competitionId=${competitionId};presetId=${preset.id};visibility=${preset.isShared ? 'shared' : 'private'};ownerUserId=${preset.ownerUserId}`,
    );
    return updatedCompetition;
  }

  async getMyResultProtocolDefaults(userId: number) {
    const row = await this.prisma.userResultProtocolPreference.findUnique({ where: { userId } });
    if (!row) return null;
    return this.normalizeConfig(row.configJson as unknown as ResultProtocolConfigValue);
  }

  async setMyResultProtocolDefaults(userId: number, config: ResultProtocolConfigDto) {
    const normalized = this.normalizeConfig(config);
    const saved = await this.prisma.userResultProtocolPreference.upsert({
      where: { userId },
      create: {
        userId,
        configJson: normalized as unknown as Prisma.JsonObject,
      },
      update: {
        configJson: normalized as unknown as Prisma.JsonObject,
      },
    });
    await this.auditService.logAction(
      'RESULT_PROTOCOL_DEFAULTS_SAVED',
      'UserResultProtocolPreference',
      userId,
      `userId=${userId};format=${normalized.format};advancedGrouping=${normalized.advancedGrouping ? 'enabled' : 'disabled'}`,
    );
    return saved;
  }
}
