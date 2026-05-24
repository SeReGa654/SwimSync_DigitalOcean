import { BadGatewayException, BadRequestException, Controller, ForbiddenException, Get, Post, Param, ParseIntPipe, Res, Query, Body, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResultStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import ExcelJS from 'exceljs';
import { appEnv } from '../config/env';
import { createHash } from 'crypto';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

const DOCX_SERVICE = appEnv.docxServiceUrl;
const MAX_PROTOCOL_EVENTS = 500;
const PROTOCOL_QUERY_CHUNK_SIZE = 100;

interface DocxQueueSubmitResponse {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
}

interface DocxQueueStatusResponse extends DocxQueueSubmitResponse {
  error?: string | null;
}

type DocxExportKind = 'start-protocol' | 'result-protocol';
type DocxExportUiStatus = 'queued' | 'processing' | 'done' | 'failed';

interface DocxExportJobStartResponse {
  jobId: string;
  status: DocxExportUiStatus;
}

interface DocxExportJobStatusResponse {
  jobId: string;
  status: DocxExportUiStatus;
  reason?: string | null;
}

type ExportSheetCell = string | number | null;
type DocxPayload = { competition: ProtocolCompetitionData; events: Array<StartProtocolEventData | ResultProtocolEventData> };

interface ProtocolCompetitionData {
  name: string;
  categories_str: string;
  location: string;
  venue: string;
  pool_length: number;
  date_from: string;
  date_to: string;
}

interface StartProtocolEntryRow {
  lane: number;
  full_name: string;
  age_group: string;
  birth_year: number;
  entry_time_ms: number | null;
  coach: string;
}

interface StartProtocolHeat {
  number: number;
  entries: StartProtocolEntryRow[];
}

interface StartProtocolEventData {
  distance_m: number;
  style: string;
  gender: string;
  heats: StartProtocolHeat[];
}

interface ResultProtocolEntryRow {
  place: number | null;
  place_display: string;
  lane: number;
  full_name: string;
  birth_year: number;
  rank: string;
  club: string;
  region: string;
  finish_time_ms: number | null;
  achieved_rank: string | null;
  points_wa: number | null;
  coach: string;
  status: string;
  dq_reason: string | null;
}

interface ResultProtocolAgeGroup {
  name: string;
  results: ResultProtocolEntryRow[];
}

interface ResultProtocolEventData {
  distance_m: number;
  style: string;
  gender: string;
  age_groups: ResultProtocolAgeGroup[];
}

interface ProtocolCondition {
  field: 'ageGroupId' | 'region' | 'club' | 'gender';
  operator: 'EQ' | 'IN' | 'CONTAINS';
  value: unknown;
}

interface ProtocolConditionBlock {
  operator: 'AND' | 'OR';
  conditions: ProtocolCondition[];
}

interface ProtocolRuleGroup extends ProtocolConditionBlock {
  name: string;
  subgroups?: ProtocolConditionBlock[];
}

interface ProtocolAdvancedGrouping {
  enabled: boolean;
  groups: ProtocolRuleGroup[];
  includeUnmatched: boolean;
  unmatchedGroupName?: string;
}

interface CompiledProtocolCondition {
  field: ProtocolCondition['field'];
  operator: ProtocolCondition['operator'];
  equalsNumber?: number;
  equalsString?: string;
  inNumberSet?: Set<number>;
  inStringSet?: Set<string>;
  containsNeedle?: string;
}

interface CompiledProtocolConditionBlock {
  operator: ProtocolConditionBlock['operator'];
  conditions: CompiledProtocolCondition[];
}

interface CompiledProtocolRuleGroup extends CompiledProtocolConditionBlock {
  subgroups: CompiledProtocolConditionBlock[];
}

interface CompetitionProtocolConfig {
  format: 'SEPARATE' | 'COMBINED' | 'MIXED';
  mixedFormatPrimaryAgeGroupId: number | null;
  mixedFormatSecondaryAgeGroupIds: number[];
  advancedGrouping: ProtocolAdvancedGrouping | null;
}

const PLACE_ROMAN: Record<number, string> = { 
  1: 'І', 2: 'ІІ', 3: 'ІІІ', 4: '4', 5: '5', 
  6: '6', 7: '7', 8: '8', 9: '9', 10: '10' 
};

const STYLE_DISPLAY_UA: Record<string, string> = {
  'FREE': 'Вільний стиль', 'Freestyle': 'Вільний стиль',
  'BREAST': 'Брас', 'Breaststroke': 'Брас',
  'BACK': 'На спині', 'Backstroke': 'На спині',
  'FLY': 'Батерфляй', 'Butterfly': 'Батерфляй',
  'MEDLEY': 'Комплексне плавання', 'Medley': 'Комплексне плавання',
};
const RANK_DISPLAY: Record<string, string> = {
  'MSMK': 'МСМК', 'MS': 'МС', 'KMSU': 'КМСУ',
  'R1': 'І', 'R2': 'ІІ', 'R3': 'ІІІ',
  'Y1': 'І юн.', 'Y2': 'ІІ юн.', 'Y3': 'ІІІ юн.',
  'NONE': '—',
};

function placeToDisplay(place: number | null, status: ResultStatus): string | null {
  if (status === 'PK') return 'п/к';
  if (['DQ', 'DNS', 'DNF'].includes(status)) return status;
  if (place === null) return null;
  return PLACE_ROMAN[place] || place.toString();
}

import { msToTime } from '../utils/time.utils';

@Controller('export')
@ApiTags('Export')
export class ExportController {
  private readonly logger = new Logger(ExportController.name);

  constructor(
    private prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  private ensureDocxKind(kind: string): DocxExportKind {
    if (kind === 'start-protocol' || kind === 'result-protocol') {
      return kind;
    }
    throw new BadRequestException('Unsupported DOCX export kind');
  }

  private mapDocxStatus(rawStatus: DocxQueueStatusResponse['status']): DocxExportUiStatus {
    if (rawStatus === 'completed') return 'done';
    if (rawStatus === 'failed') return 'failed';
    if (rawStatus === 'processing') return 'processing';
    return 'queued';
  }

  private async requestDocxDirect(endpoint: 'start-protocol' | 'result-protocol', payload: DocxPayload): Promise<Buffer> {
    const response = await fetch(`${DOCX_SERVICE}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
    });
    if (!response.ok) {
      const errorText = await response.text();
      this.logger.error(
        `DOCX service upstream error (${endpoint}): ${JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        })}`,
      );
      throw new Error(`DOCX_SERVICE_${endpoint.toUpperCase().replace('-', '_')}_FAILED`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  private async requestDocxQueued(endpoint: 'start-protocol' | 'result-protocol', payload: DocxPayload): Promise<Buffer> {
    const submitPayload = await this.submitDocxQueueJob(endpoint, payload);
    const jobId = submitPayload.job_id;
    const deadline = Date.now() + appEnv.docxRequestTimeoutMs;

    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, appEnv.docxQueuePollIntervalMs));

      const statusPayload = await this.fetchDocxQueueStatus(jobId);
      if (statusPayload.status === 'failed') {
        throw new Error(statusPayload.error || 'DOCX_QUEUE_JOB_FAILED');
      }
      if (statusPayload.status === 'completed') {
        return this.downloadDocxQueueJob(jobId);
      }
    }

    throw new Error('DOCX_QUEUE_TIMEOUT');
  }

  private async requestDocx(endpoint: 'start-protocol' | 'result-protocol', payload: DocxPayload): Promise<Buffer> {
    if (appEnv.docxUseQueue) {
      return this.requestDocxQueued(endpoint, payload);
    }
    return this.requestDocxDirect(endpoint, payload);
  }

  private async submitDocxQueueJob(endpoint: DocxExportKind, payload: DocxPayload): Promise<DocxQueueSubmitResponse> {
    const normalizedPayload: Record<string, unknown> = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : { payload };
    const idempotencyKey = createHash('sha256')
      .update(endpoint)
      .update(JSON.stringify(normalizedPayload))
      .digest('hex');

    const submitResponse = await fetch(`${DOCX_SERVICE}/jobs/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...normalizedPayload,
        idempotency_key: idempotencyKey,
      }),
      signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
    });
    if (!submitResponse.ok) {
      const errorText = await submitResponse.text().catch(() => '');
      this.logger.error(
        `DOCX queue submit failed (${endpoint}): ${JSON.stringify({
          status: submitResponse.status,
          statusText: submitResponse.statusText,
          body: errorText,
        })}`,
      );
      throw new BadGatewayException('Не вдалося поставити DOCX-задачу в чергу.');
    }

    return (await submitResponse.json()) as DocxQueueSubmitResponse;
  }

  private async fetchDocxQueueStatus(jobId: string): Promise<DocxQueueStatusResponse> {
    const statusResponse = await fetch(`${DOCX_SERVICE}/jobs/${jobId}`, {
      method: 'GET',
      signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
    });
    if (!statusResponse.ok) {
      const errorText = await statusResponse.text().catch(() => '');
      this.logger.error(
        `DOCX queue status failed: ${JSON.stringify({
          jobId,
          status: statusResponse.status,
          statusText: statusResponse.statusText,
          body: errorText,
        })}`,
      );
      throw new BadGatewayException('Не вдалося отримати статус DOCX-задачі.');
    }

    return (await statusResponse.json()) as DocxQueueStatusResponse;
  }

  private async downloadDocxQueueJob(jobId: string): Promise<Buffer> {
    const downloadResponse = await fetch(`${DOCX_SERVICE}/jobs/${jobId}/download`, {
      method: 'GET',
      signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
    });
    if (!downloadResponse.ok) {
      const errorText = await downloadResponse.text().catch(() => '');
      this.logger.error(
        `DOCX queue download failed: ${JSON.stringify({
          jobId,
          status: downloadResponse.status,
          statusText: downloadResponse.statusText,
          body: errorText,
        })}`,
      );
      throw new BadGatewayException('Не вдалося завантажити DOCX з черги.');
    }
    return Buffer.from(await downloadResponse.arrayBuffer());
  }

  private async buildDocxPayload(
    kind: DocxExportKind,
    compId: number,
  ): Promise<{ competition: ProtocolCompetitionData; events: Array<StartProtocolEventData | ResultProtocolEventData> }> {
    const competition = await this.getCompetitionData(compId);
    const events = await this.prisma.event.findMany({ where: { competitionId: compId }, orderBy: { sortOrder: 'asc' } });
    const eventIds = events.map((e) => e.id);
    const eventsData = kind === 'start-protocol'
      ? await this.getStartProtocolData(eventIds)
      : await this.getResultProtocolData(eventIds);
    return { competition, events: eventsData };
  }

  @Post('docx-jobs/:kind/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Submit async DOCX export job for competition' })
  async submitDocxJob(
    @Param('kind') kindRaw: string,
    @Param('competitionId', ParseIntPipe) compId: number,
  ): Promise<DocxExportJobStartResponse> {
    const isDocxQueueEnabled = await this.featureFlagsService.isEnabled('ff.export.docx.queue');
    if (!isDocxQueueEnabled) {
      throw new ForbiddenException('FEATURE_DISABLED: DOCX queue export is disabled');
    }
    const kind = this.ensureDocxKind(kindRaw);
    const payload = await this.buildDocxPayload(kind, compId);
    const submitPayload = await this.submitDocxQueueJob(kind, payload);
    return {
      jobId: submitPayload.job_id,
      status: this.mapDocxStatus(submitPayload.status),
    };
  }

  @Get('docx-jobs/:jobId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get DOCX export job status' })
  async getDocxJobStatus(@Param('jobId') jobId: string): Promise<DocxExportJobStatusResponse> {
    const statusPayload = await this.fetchDocxQueueStatus(jobId);
    return {
      jobId: statusPayload.job_id,
      status: this.mapDocxStatus(statusPayload.status),
      reason: statusPayload.error || null,
    };
  }

  @Get('docx-jobs/:jobId/download')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Download generated DOCX from async job' })
  async downloadDocxJob(@Param('jobId') jobId: string, @Res() res: Response) {
    const buffer = await this.downloadDocxQueueJob(jobId);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  }

  /** Helper: build competition data for DOCX service */
  private async getCompetitionData(compId: number): Promise<ProtocolCompetitionData> {
    const comp = await this.prisma.competition.findUnique({ where: { id: compId } });
    if (!comp) throw new Error('Competition not found');
    return {
      name: comp.name,
      categories_str: comp.categoriesStr || '',
      location: comp.location,
      venue: comp.venue || '',
      pool_length: comp.poolLength,
      date_from: comp.dateFrom ? comp.dateFrom.toISOString().slice(0, 10) : '',
      date_to: comp.dateTo ? comp.dateTo.toISOString().slice(0, 10) : '',
    };
  }

  /** Helper: build events+heats data for start protocol (optimized batch query) */
  private async getStartProtocolData(eventIds: number[]): Promise<StartProtocolEventData[]> {
    if (eventIds.length === 0) return [];
    if (eventIds.length > MAX_PROTOCOL_EVENTS) {
      throw new BadRequestException(`Забагато дистанцій для експорту за один запит (максимум ${MAX_PROTOCOL_EVENTS}).`);
    }

    const fetchStartChunk = (ids: number[]) => this.prisma.entry.findMany({
      where: { eventId: { in: ids } },
      include: { athlete: true, ageGroup: true, event: { include: { competition: true } } },
      orderBy: [{ eventId: 'asc' }, { heatNumber: 'asc' }, { laneNumber: 'asc' }],
    });
    type StartEntry = Awaited<ReturnType<typeof fetchStartChunk>>[number];
    const allEntries: StartEntry[] = [];
    for (let i = 0; i < eventIds.length; i += PROTOCOL_QUERY_CHUNK_SIZE) {
      const chunkIds = eventIds.slice(i, i + PROTOCOL_QUERY_CHUNK_SIZE);
      const chunkEntries = await fetchStartChunk(chunkIds);
      allEntries.push(...chunkEntries);
    }

    // Group entries by event
    const eventEntriesMap = new Map<number, typeof allEntries>();
    for (const e of allEntries) {
      if (!eventEntriesMap.has(e.eventId)) eventEntriesMap.set(e.eventId, []);
      eventEntriesMap.get(e.eventId)!.push(e);
    }

    const result: StartProtocolEventData[] = [];
    for (const eventId of eventIds) {
      const entries = eventEntriesMap.get(eventId) || [];
      const event = entries[0]?.event;
      if (!event) continue;

      const heatsMap = new Map<number, StartProtocolEntryRow[]>();
      for (const e of entries) {
        if (!e.heatNumber) continue;
        if (!heatsMap.has(e.heatNumber)) heatsMap.set(e.heatNumber, []);
        heatsMap.get(e.heatNumber)!.push({
          lane: e.laneNumber || 0,
          full_name: e.athlete 
            ? `${e.athlete.lastName ?? ''} ${e.athlete.firstName ?? ''}`.trim()
            : (e.teamName || 'Команда'),
          age_group: e.ageGroup?.name || '',
          birth_year: e.athlete?.birthYear ?? 0,
          entry_time_ms: e.entryTimeMs,
          coach: e.athlete?.coach || '',
        });
      }

      result.push({
        distance_m: event.distance,
        style: event.style,
        gender: event.gender,
        heats: Array.from(heatsMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([num, entries]) => ({ number: num, entries })),
      });
    }
    return result;
  }

  /** Helper: build events+results data for result protocol (optimized batch query) */
  private async getResultProtocolData(eventIds: number[]): Promise<ResultProtocolEventData[]> {
    if (eventIds.length === 0) return [];
    if (eventIds.length > MAX_PROTOCOL_EVENTS) {
      throw new BadRequestException(`Забагато дистанцій для експорту за один запит (максимум ${MAX_PROTOCOL_EVENTS}).`);
    }

    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      include: { competition: true },
    });
    const eventsMap = new Map(events.map(e => [e.id, e]));
    const creatorIds = Array.from(new Set(
      events
        .map((event) => event.competition.createdByUserId)
        .filter((id): id is number => typeof id === 'number'),
    ));
    const creatorDefaults = creatorIds.length > 0
      ? await this.prisma.userResultProtocolPreference.findMany({ where: { userId: { in: creatorIds } } })
      : [];
    const defaultsByUserId = new Map<number, CompetitionProtocolConfig>();
    for (const row of creatorDefaults) {
      const normalized = this.normalizeCompetitionProtocolConfigFromRow(
        'SEPARATE',
        null,
        null,
        row.configJson as Record<string, unknown>,
      );
      defaultsByUserId.set(row.userId, normalized);
    }

    const fetchResultChunk = (ids: number[]) => this.prisma.entry.findMany({
      where: { eventId: { in: ids }, result: { isNot: null } },
      include: { athlete: true, result: true, ageGroup: true },
    });
    type ResultEntry = Awaited<ReturnType<typeof fetchResultChunk>>[number];
    type ResultEntryWithResult = ResultEntry & { result: NonNullable<ResultEntry['result']> };
    const allEntries: ResultEntry[] = [];
    for (let i = 0; i < eventIds.length; i += PROTOCOL_QUERY_CHUNK_SIZE) {
      const chunkIds = eventIds.slice(i, i + PROTOCOL_QUERY_CHUNK_SIZE);
      const chunkEntries = await fetchResultChunk(chunkIds);
      allEntries.push(...chunkEntries);
    }

    // Group entries by event
    const eventEntriesMap = new Map<number, typeof allEntries>();
    for (const e of allEntries) {
      if (!eventEntriesMap.has(e.eventId)) eventEntriesMap.set(e.eventId, []);
      eventEntriesMap.get(e.eventId)!.push(e);
    }

    const result: ResultProtocolEventData[] = [];
    for (const eventId of eventIds) {
      const event = eventsMap.get(eventId);
      if (!event) continue;

      const entries = eventEntriesMap.get(eventId) || [];
      const competition = event.competition;
      const protocolConfig = this.resolveCompetitionProtocolConfigWithDefaults(
        competition.resultProtocolFormat,
        competition.mixedFormatPrimaryAgeGroupId,
        competition.mixedFormatSecondaryAgeGroupIds,
        competition.resultProtocolConfigJson as Record<string, unknown> | null,
        competition.createdByUserId ? defaultsByUserId.get(competition.createdByUserId) : undefined,
      );

      let age_groups: ResultProtocolAgeGroup[] = [];

      if (protocolConfig.advancedGrouping?.enabled && protocolConfig.advancedGrouping.groups.length > 0) {
        age_groups = this.buildAdvancedAgeGroups(entries, protocolConfig.advancedGrouping);
      } else if (protocolConfig.format === 'SEPARATE') {
        // Original behavior: separate by age group
        age_groups = this.buildSeparateAgeGroups(entries);
      } else if (protocolConfig.format === 'COMBINED') {
        // All age groups combined into one ranking
        age_groups = this.buildCombinedAgeGroups(entries);
      } else if (protocolConfig.format === 'MIXED') {
        // Primary age group separate + combined secondary groups
        age_groups = this.buildMixedAgeGroups(
          entries,
          protocolConfig.mixedFormatPrimaryAgeGroupId,
          protocolConfig.mixedFormatSecondaryAgeGroupIds,
        );
      }

      result.push({
        distance_m: event.distance,
        style: event.style,
        gender: event.gender,
        age_groups,
      });
    }
    return result;
  }

  private normalizeCompetitionProtocolConfigFromRow(
    format: string,
    mixedPrimary: number | null,
    mixedSecondaryRaw: string | null,
    configJson: Record<string, unknown> | null,
  ): CompetitionProtocolConfig {
    const normalizedFormat = format === 'COMBINED' || format === 'MIXED' ? format : 'SEPARATE';
    let mixedSecondary: number[] = [];
    if (mixedSecondaryRaw) {
      try {
        const parsed = JSON.parse(mixedSecondaryRaw);
        if (Array.isArray(parsed)) {
          mixedSecondary = parsed.map((item) => Number(item)).filter((item) => Number.isInteger(item));
        }
      } catch {
        mixedSecondary = [];
      }
    }

    let advancedGrouping: ProtocolAdvancedGrouping | null = null;
    if (configJson && typeof configJson.advancedGrouping === 'object' && configJson.advancedGrouping) {
      advancedGrouping = configJson.advancedGrouping as ProtocolAdvancedGrouping;
    }

    return {
      format: normalizedFormat,
      mixedFormatPrimaryAgeGroupId: mixedPrimary,
      mixedFormatSecondaryAgeGroupIds: mixedSecondary,
      advancedGrouping,
    };
  }

  private isDefaultLegacyCompetitionConfig(config: CompetitionProtocolConfig): boolean {
    return config.format === 'SEPARATE'
      && config.mixedFormatPrimaryAgeGroupId == null
      && config.mixedFormatSecondaryAgeGroupIds.length === 0
      && !config.advancedGrouping;
  }

  private resolveCompetitionProtocolConfigWithDefaults(
    format: string,
    mixedPrimary: number | null,
    mixedSecondaryRaw: string | null,
    configJson: Record<string, unknown> | null,
    creatorDefaults?: CompetitionProtocolConfig,
  ): CompetitionProtocolConfig {
    const competitionConfig = this.normalizeCompetitionProtocolConfigFromRow(format, mixedPrimary, mixedSecondaryRaw, configJson);
    if (this.isDefaultLegacyCompetitionConfig(competitionConfig) && creatorDefaults) {
      return creatorDefaults;
    }
    return competitionConfig;
  }

  private readConditionTarget(entry: any, field: ProtocolCondition['field']): string | number | null {
    if (field === 'ageGroupId') return entry.ageGroupId ?? null;
    if (field === 'region') return entry.athlete?.region ?? '';
    if (field === 'club') return entry.athlete?.club ?? '';
    if (field === 'gender') return entry.athlete?.gender ?? '';
    return null;
  }

  private normalizeString(value: unknown): string {
    return String(value ?? '').toLowerCase();
  }

  private compareResultEntries(a: any, b: any): number {
    const statusOrder = (s: ResultStatus) => (s === 'OK' ? 0 : s === 'PK' ? 1 : 2);
    const diff = statusOrder(a.result.status) - statusOrder(b.result.status);
    if (diff !== 0) return diff;
    return (a.result.place || 999) - (b.result.place || 999);
  }

  private compileCondition(condition: ProtocolCondition): CompiledProtocolCondition {
    if (condition.operator === 'EQ') {
      if (condition.field === 'ageGroupId') {
        return {
          field: condition.field,
          operator: condition.operator,
          equalsNumber: Number(condition.value),
        };
      }
      return {
        field: condition.field,
        operator: condition.operator,
        equalsString: this.normalizeString(condition.value),
      };
    }

    if (condition.operator === 'IN') {
      if (!Array.isArray(condition.value)) {
        return {
          field: condition.field,
          operator: condition.operator,
          inNumberSet: new Set<number>(),
          inStringSet: new Set<string>(),
        };
      }
      if (condition.field === 'ageGroupId') {
        return {
          field: condition.field,
          operator: condition.operator,
          inNumberSet: new Set(condition.value.map((item) => Number(item))),
        };
      }
      return {
        field: condition.field,
        operator: condition.operator,
        inStringSet: new Set(condition.value.map((item) => this.normalizeString(item))),
      };
    }

    return {
      field: condition.field,
      operator: condition.operator,
      containsNeedle: this.normalizeString(condition.value),
    };
  }

  private compileConditionBlock(block: ProtocolConditionBlock): CompiledProtocolConditionBlock {
    return {
      operator: block.operator,
      conditions: (block.conditions || []).map((condition) => this.compileCondition(condition)),
    };
  }

  private compileRuleGroup(group: ProtocolRuleGroup): CompiledProtocolRuleGroup {
    return {
      operator: group.operator,
      conditions: (group.conditions || []).map((condition) => this.compileCondition(condition)),
      subgroups: (group.subgroups || []).map((subgroup) => this.compileConditionBlock(subgroup)),
    };
  }

  private evaluateCompiledCondition(entry: any, condition: CompiledProtocolCondition): boolean {
    const target = this.readConditionTarget(entry, condition.field);
    if (condition.operator === 'EQ') {
      if (condition.field === 'ageGroupId') return Number(target) === condition.equalsNumber;
      return this.normalizeString(target) === condition.equalsString;
    }
    if (condition.operator === 'IN') {
      if (condition.field === 'ageGroupId') {
        return condition.inNumberSet?.has(Number(target)) ?? false;
      }
      return condition.inStringSet?.has(this.normalizeString(target)) ?? false;
    }
    return this.normalizeString(target).includes(condition.containsNeedle ?? '');
  }

  private evaluateCompiledConditionBlock(entry: any, block: CompiledProtocolConditionBlock): boolean {
    const conditions = block.conditions || [];
    if (conditions.length === 0) return false;

    if (block.operator === 'OR') {
      for (const condition of conditions) {
        if (this.evaluateCompiledCondition(entry, condition)) return true;
      }
      return false;
    }

    for (const condition of conditions) {
      if (!this.evaluateCompiledCondition(entry, condition)) return false;
    }
    return true;
  }

  private evaluateCompiledRuleGroup(entry: any, group: CompiledProtocolRuleGroup): boolean {
    const selfResult = this.evaluateCompiledConditionBlock(entry, group);
    if (group.operator === 'OR') {
      if (selfResult) return true;
      for (const subgroup of group.subgroups || []) {
        if (this.evaluateCompiledConditionBlock(entry, subgroup)) return true;
      }
      return false;
    }

    if (!selfResult) return false;
    for (const subgroup of group.subgroups || []) {
      if (!this.evaluateCompiledConditionBlock(entry, subgroup)) return false;
    }
    return true;
  }

  private evaluateCondition(entry: any, condition: ProtocolCondition): boolean {
    const target = this.readConditionTarget(entry, condition.field);
    if (condition.operator === 'EQ') {
      if (condition.field === 'ageGroupId') return Number(target) === Number(condition.value);
      return String(target ?? '').toLowerCase() === String(condition.value ?? '').toLowerCase();
    }
    if (condition.operator === 'IN') {
      if (!Array.isArray(condition.value)) return false;
      if (condition.field === 'ageGroupId') {
        return condition.value.map((item) => Number(item)).includes(Number(target));
      }
      const normalizedTarget = String(target ?? '').toLowerCase();
      return condition.value.map((item) => String(item).toLowerCase()).includes(normalizedTarget);
    }
    if (condition.operator === 'CONTAINS') {
      return String(target ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    }
    return false;
  }

  private evaluateConditionBlock(entry: any, block: ProtocolConditionBlock): boolean {
    const values = (block.conditions || []).map((condition) => this.evaluateCondition(entry, condition));
    if (values.length === 0) return false;
    if (block.operator === 'OR') return values.some(Boolean);
    return values.every(Boolean);
  }

  private evaluateRuleGroup(entry: any, group: ProtocolRuleGroup): boolean {
    const selfResult = this.evaluateConditionBlock(entry, group);
    const subgroupResults = (group.subgroups || []).map((subgroup) => this.evaluateConditionBlock(entry, subgroup));
    const all = [selfResult, ...subgroupResults];
    if (group.operator === 'OR') return all.some(Boolean);
    return all.every(Boolean);
  }

  private buildAdvancedAgeGroups(entries: any[], grouping: ProtocolAdvancedGrouping): ResultProtocolAgeGroup[] {
    const entriesWithResult = entries.filter((entry) => entry.result);
    const assignedIds = new Set<number>();
    const ageGroups: ResultProtocolAgeGroup[] = [];
    const compiledGroups = grouping.groups.map((group) => ({
      name: group.name,
      compiled: this.compileRuleGroup(group),
    }));

    for (const group of compiledGroups) {
      const matched: any[] = [];
      for (const entry of entriesWithResult) {
        if (assignedIds.has(entry.id)) continue;
        if (!this.evaluateCompiledRuleGroup(entry, group.compiled)) continue;
        assignedIds.add(entry.id);
        matched.push(entry);
      }
      if (matched.length === 0) continue;
      matched.sort((a, b) => this.compareResultEntries(a, b));
      ageGroups.push({
        name: group.name,
        results: matched.map((entry) => this.buildResultRow(entry)),
      });
    }

    if (grouping.includeUnmatched !== false) {
      const unmatched = entriesWithResult.filter((entry) => !assignedIds.has(entry.id));
      if (unmatched.length > 0) {
        unmatched.sort((a, b) => this.compareResultEntries(a, b));
        ageGroups.push({
          name: grouping.unmatchedGroupName?.trim() || 'Інші',
          results: unmatched.map((entry) => this.buildResultRow(entry)),
        });
      }
    }

    return ageGroups;
  }

  private buildSeparateAgeGroups(entries: any[]): ResultProtocolAgeGroup[] {
    // Group by age group
    const groupsMap = new Map<string, any[]>();
    for (const e of entries) {
      if (!e.result) continue;
      const agName = e.ageGroup?.name || 'Загальний';
      if (!groupsMap.has(agName)) groupsMap.set(agName, []);
      groupsMap.get(agName)!.push(e);
    }

    const age_groups: ResultProtocolAgeGroup[] = [];
    for (const [agName, agEntries] of groupsMap) {
      // Sort: OK by place, then PK, then DQ/DNS/DNF
      agEntries.sort((a, b) => {
        const statusOrder = (s: ResultStatus) => (s === 'OK' ? 0 : s === 'PK' ? 1 : 2);
        const diff = statusOrder(a.result.status) - statusOrder(b.result.status);
        if (diff !== 0) return diff;
        return (a.result.place || 999) - (b.result.place || 999);
      });

      age_groups.push({
        name: agName,
        results: agEntries.map((e) => this.buildResultRow(e)),
      });
    }
    return age_groups;
  }

  private buildCombinedAgeGroups(entries: any[]): ResultProtocolAgeGroup[] {
    // Combine all entries and recalculate places
    const validEntries = entries.filter(e => e.result && (e.result.status === 'OK' || e.result.status === 'PK'));
    const invalidEntries = entries.filter(e => e.result && !['OK', 'PK'].includes(e.result.status));

    // Sort valid entries by finish time (OK first, then PK)
    validEntries.sort((a, b) => {
      const statusOrder = (s: ResultStatus) => (s === 'OK' ? 0 : 1);
      const diff = statusOrder(a.result.status) - statusOrder(b.result.status);
      if (diff !== 0) return diff;
      return (a.result.finishTimeMs || 999999) - (b.result.finishTimeMs || 999999);
    });

    // Assign places
    let currentPlace = 1;
    const processedEntries: any[] = [];

    for (let i = 0; i < validEntries.length; i++) {
      const e = validEntries[i];
      const prevE = i > 0 ? validEntries[i - 1] : null;

      if (e.result.status === 'OK') {
        if (!prevE || prevE.result.finishTimeMs !== e.result.finishTimeMs) {
          currentPlace = i + 1;
        }
        processedEntries.push({
          ...e,
          place_display: PLACE_ROMAN[currentPlace] || currentPlace.toString(),
        });
      } else {
        // PK entries
        processedEntries.push({
          ...e,
          place_display: 'п/к',
        });
      }
    }

    // Add invalid entries
    for (const e of invalidEntries) {
      const pd = placeToDisplay(null, e.result.status);
      processedEntries.push({
        ...e,
        place_display: pd,
      });
    }

    return [{
      name: 'Об\'єднаний рейтинг',
      results: processedEntries.map((e) => ({
        place: e.place_display === 'п/к' || !['І', 'ІІ', 'ІІІ'].includes(e.place_display?.[0]) ? null : parseInt(Object.keys(PLACE_ROMAN).find(k => PLACE_ROMAN[k as any] === e.place_display) || '0') || null,
        place_display: e.place_display || '',
        lane: e.laneNumber || 0,
        full_name: e.athlete 
          ? `${e.athlete.lastName ?? ''} ${e.athlete.firstName ?? ''}`.trim()
          : (e.teamName || 'Команда'),
        birth_year: e.athlete?.birthYear ?? 0,
        rank: e.athlete?.currentRank || 'NONE',
        club: e.athlete?.club ?? '',
        region: e.athlete?.region || '',
        finish_time_ms: e.result.finishTimeMs,
        achieved_rank: e.result.achievedRank,
        points_wa: e.result.pointsWa,
        coach: e.athlete?.coach || '',
        status: e.result.status,
        dq_reason: e.result.dqReason,
      })),
    }];
  }

  private buildMixedAgeGroups(entries: any[], primaryAgeGroupId?: number | null, secondaryAgeGroupIds: number[] = []): ResultProtocolAgeGroup[] {
    const primaryEntries = entries.filter(e => e.ageGroupId === primaryAgeGroupId);
    const secondaryEntries = entries.filter(e => secondaryAgeGroupIds.includes(e.ageGroupId || 0));
    const otherEntries = entries.filter(e => 
      e.ageGroupId !== primaryAgeGroupId && !secondaryAgeGroupIds.includes(e.ageGroupId || 0)
    );

    const age_groups: ResultProtocolAgeGroup[] = [];

    // Add primary age group separately
    if (primaryEntries.length > 0 && primaryAgeGroupId) {
      const primaryGroup = primaryEntries[0].ageGroup;
      const sortedPrimary = primaryEntries.filter(e => e.result);
      sortedPrimary.sort((a, b) => {
        const statusOrder = (s: ResultStatus) => (s === 'OK' ? 0 : s === 'PK' ? 1 : 2);
        const diff = statusOrder(a.result.status) - statusOrder(b.result.status);
        if (diff !== 0) return diff;
        return (a.result.place || 999) - (b.result.place || 999);
      });

      age_groups.push({
        name: primaryGroup?.name || 'Основна група',
        results: sortedPrimary.map((e) => this.buildResultRow(e)),
      });
    }

    // Add combined secondary groups
    const combinedSecondary = [...secondaryEntries, ...otherEntries].filter(e => e.result);
    if (combinedSecondary.length > 0) {
      combinedSecondary.sort((a, b) => {
        const statusOrder = (s: ResultStatus) => (s === 'OK' ? 0 : s === 'PK' ? 1 : 2);
        const diff = statusOrder(a.result.status) - statusOrder(b.result.status);
        if (diff !== 0) return diff;
        return (a.result.finishTimeMs || 999999) - (b.result.finishTimeMs || 999999);
      });

      // Recalculate places for combined
      let currentPlace = 1;
      const recalculated: any[] = [];
      for (let i = 0; i < combinedSecondary.length; i++) {
        const e = combinedSecondary[i];
        const prevE = i > 0 ? combinedSecondary[i - 1] : null;

        if (e.result.status === 'OK') {
          if (!prevE || prevE.result.finishTimeMs !== e.result.finishTimeMs) {
            currentPlace = i + 1;
          }
        }

        recalculated.push({
          ...e,
          recalc_place: e.result.status === 'OK' ? currentPlace : null,
          recalc_place_display: e.result.status === 'OK' 
            ? (PLACE_ROMAN[currentPlace] || currentPlace.toString())
            : (e.result.status === 'PK' ? 'п/к' : placeToDisplay(null, e.result.status)),
        });
      }

      age_groups.push({
        name: 'Об\'єднаний рейтинг',
        results: recalculated.map((e) => ({
          place: e.recalc_place,
          place_display: e.recalc_place_display || '',
          lane: e.laneNumber || 0,
          full_name: e.athlete 
            ? `${e.athlete.lastName ?? ''} ${e.athlete.firstName ?? ''}`.trim()
            : (e.teamName || 'Команда'),
          birth_year: e.athlete?.birthYear ?? 0,
          rank: e.athlete?.currentRank || 'NONE',
          club: e.athlete?.club ?? '',
          region: e.athlete?.region || '',
          finish_time_ms: e.result.finishTimeMs,
          achieved_rank: e.result.achievedRank,
          points_wa: e.result.pointsWa,
          coach: e.athlete?.coach || '',
          status: e.result.status,
          dq_reason: e.result.dqReason,
        })),
      });
    }

    return age_groups;
  }

  private buildResultRow(e: any): ResultProtocolEntryRow {
    return {
      place: e.result.place,
      place_display: e.result.placeDisplay || '',
      lane: e.laneNumber || 0,
      full_name: e.athlete 
        ? `${e.athlete.lastName ?? ''} ${e.athlete.firstName ?? ''}`.trim()
        : (e.teamName || 'Команда'),
      birth_year: e.athlete?.birthYear ?? 0,
      rank: e.athlete?.currentRank || 'NONE',
      club: e.athlete?.club ?? '',
      region: e.athlete?.region || '',
      finish_time_ms: e.result.finishTimeMs,
      achieved_rank: e.result.achievedRank,
      points_wa: e.result.pointsWa,
      coach: e.athlete?.coach || '',
      status: e.result.status,
      dq_reason: e.result.dqReason,
    };
  }

  // ─── Start Protocol (.docx via Python) ─────────────────────────────────

  @Get('start-protocol-docx/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Download start protocol DOCX by competition id' })
  async startProtocolDocx(
    @Param('competitionId', ParseIntPipe) compId: number,
    @Res() res: Response,
  ) {
    const competition = await this.getCompetitionData(compId);
    const events = await this.prisma.event.findMany({ where: { competitionId: compId }, orderBy: { sortOrder: 'asc' } });
    const eventsData = await this.getStartProtocolData(events.map(e => e.id));

    try {
      const buffer = await this.requestDocx('start-protocol', { competition, events: eventsData });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Start_Protocol_${compId}.docx"`);
      res.send(buffer);
    } catch (error: unknown) {
      this.logger.error(
        `DOCX Service Error (start-protocol): ${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(502).json({ error: 'Не вдалося згенерувати стартовий протокол через DOCX-сервіс.' });
    }
  }

  // ─── Result Protocol (.docx via Python) ────────────────────────────────

  @Get('result-protocol-docx/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Download result protocol DOCX by competition id' })
  async resultProtocolDocx(
    @Param('competitionId', ParseIntPipe) compId: number,
    @Res() res: Response,
  ) {
    const competition = await this.getCompetitionData(compId);
    const events = await this.prisma.event.findMany({ where: { competitionId: compId }, orderBy: { sortOrder: 'asc' } });
    const eventsData = await this.getResultProtocolData(events.map(e => e.id));

    try {
      const buffer = await this.requestDocx('result-protocol', { competition, events: eventsData });
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="Result_Protocol_${compId}.docx"`);
      res.send(buffer);
    } catch (error: unknown) {
      this.logger.error(
        `DOCX Service Error (result-protocol): ${error instanceof Error ? error.message : String(error)}`,
      );
      res.status(502).json({ error: 'Не вдалося згенерувати фінішний протокол через DOCX-сервіс.' });
    }
  }

  // ─── Start Protocol (Excel fallback) ───────────────────────────────────

  @Get('start-protocol/:eventId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Download start protocol XLSX by event id' })
  async startProtocolExcel(@Param('eventId', ParseIntPipe) eventId: number, @Res() res: Response) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { competition: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const entries = await this.prisma.entry.findMany({
      where: { eventId },
      include: { athlete: true, ageGroup: true },
      orderBy: [{ heatNumber: 'asc' }, { laneNumber: 'asc' }],
    });

    const wb = new ExcelJS.Workbook();
    const wsData: ExportSheetCell[][] = [
      [`${event.competition.name} - ${event.name}`],
      [`${event.competition.location} | ${event.competition.poolLength}m Pool`],
      [],
      ['Доріжка', "Прізвище та Ім'я", 'Вік. Група', 'Рік нар.', 'Заяв. рез.', 'Тренер'],
    ];

    let currentHeat = 0;
    for (const entry of entries) {
      if (entry.heatNumber && entry.heatNumber !== currentHeat) {
        currentHeat = entry.heatNumber;
        wsData.push([]);
        wsData.push([`Заплив ${currentHeat}`]);
      }
      wsData.push([
        entry.laneNumber,
        `${entry.athlete?.lastName ?? ''} ${entry.athlete?.firstName ?? ''}`.trim(),
        entry.ageGroup?.name || '',
        entry.athlete?.birthYear ?? '',
        msToTime(entry.entryTimeMs),
        entry.athlete?.coach || '',
      ]);
    }

    const ws = wb.addWorksheet('Start Protocol');
    for (const row of wsData) {
      ws.addRow(row);
    }
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const startFn = `Start_${event.name.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="Start_Event_${eventId}.xlsx"; filename*=UTF-8''${encodeURIComponent(startFn)}`);
    res.send(Buffer.from(buf));
  }

  // ─── Finish Protocol (Excel fallback) ──────────────────────────────────

  @Get('finish-protocol/:eventId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Download finish protocol XLSX by event id' })
  async finishProtocolExcel(@Param('eventId', ParseIntPipe) eventId: number, @Res() res: Response) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      include: { competition: true },
    });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const entries = await this.prisma.entry.findMany({
      where: { eventId, result: { isNot: null } },
      include: { athlete: true, result: true, ageGroup: true },
    });

    entries.sort((a, b) => {
      if (a.result!.status !== 'OK' && b.result!.status !== 'OK') return 0;
      if (a.result!.status !== 'OK') return 1;
      if (b.result!.status !== 'OK') return -1;
      return (a.result!.place || 999) - (b.result!.place || 999);
    });

    const wb = new ExcelJS.Workbook();
    const wsData: ExportSheetCell[][] = [
      [`${event.competition.name} - ${event.name} — ФІНІШНИЙ ПРОТОКОЛ`],
      [`${event.competition.location} | ${event.competition.poolLength}m Pool`],
      [],
      ['Місце', 'Доріжка', "Прізвище та Ім'я", 'Рік нар.', 'Розряд', 'Команда', 'Регіон', 'Результат', 'Вик. розряд', 'Очки WA', 'Тренер'],
    ];

    for (const entry of entries) {
      const r = entry.result!;
      wsData.push([
        r.placeDisplay || (r.status === 'OK' ? r.place : r.status),
        entry.laneNumber,
        `${entry.athlete?.lastName ?? ''} ${entry.athlete?.firstName ?? ''}`.trim(),
        entry.athlete?.birthYear ?? '',
        entry.athlete?.currentRank ? (entry.athlete?.currentRank ? (RANK_DISPLAY[entry.athlete.currentRank] || entry.athlete.currentRank) : 'NONE') : 'NONE',
        entry.athlete?.club ?? '',
        entry.athlete?.region || '',
        r.status === 'OK' ? msToTime(r.finishTimeMs) : r.status,
        r.achievedRank ? (RANK_DISPLAY[r.achievedRank] || r.achievedRank) : '',
        r.pointsWa || '',
        entry.athlete?.coach || '',
      ]);
    }

    const ws = wb.addWorksheet('Result Protocol');
    for (const row of wsData) {
      ws.addRow(row);
    }
    const buf = await wb.xlsx.writeBuffer();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const resultFn = `Result_${event.name.replace(/\s+/g, '_')}.xlsx`;
    res.setHeader('Content-Disposition', `attachment; filename="Result_Event_${eventId}.xlsx"; filename*=UTF-8''${encodeURIComponent(resultFn)}`);
    res.send(Buffer.from(buf));
  }

  // ─── Start Protocol Preview (JSON for browser rendering) ───────────────

  @Get('start-protocol-preview/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get JSON preview of start protocol by competition id' })
  async startProtocolPreview(@Param('competitionId', ParseIntPipe) compId: number) {
    const competition = await this.getCompetitionData(compId);
    const events = await this.prisma.event.findMany({ where: { competitionId: compId }, orderBy: { sortOrder: 'asc' } });
    const eventsData = await this.getStartProtocolData(events.map(e => e.id));
    return { competition, events: eventsData };
  }

  // ─── Result Protocol Preview (JSON for browser rendering) ──────────────

  @Get('result-protocol-preview/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Get JSON preview of result protocol by competition id' })
  async resultProtocolPreview(@Param('competitionId', ParseIntPipe) compId: number) {
    const competition = await this.getCompetitionData(compId);
    const events = await this.prisma.event.findMany({ where: { competitionId: compId }, orderBy: { sortOrder: 'asc' } });
    const eventsData = await this.getResultProtocolData(events.map(e => e.id));
    return { competition, events: eventsData };
  }
}
