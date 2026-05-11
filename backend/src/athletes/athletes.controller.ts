import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UploadedFile, UseInterceptors, Query, Res, ForbiddenException, BadRequestException, BadGatewayException, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SwimStyle } from '@prisma/client';
import { AthletesService } from './athletes.service';
import { PrismaService } from '../prisma/prisma.service';
import { Response } from 'express';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import { ConfirmImportDto } from './dto/confirm-import.dto';
import { appEnv } from '../config/env';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';

const DOCX_SERVICE = appEnv.docxServiceUrl;

interface ParsedDocxAthlete {
  lastName?: string;
  firstName?: string;
  birthYear?: number;
  gender?: string;
  currentRank?: string;
  coach?: string;
  club?: string;
  region?: string;
  doctorApproved?: boolean;
  last_name?: string;
  first_name?: string;
  birth_year?: number;
  rank?: string;
  doctor_approved?: boolean;
}

interface ParsedDocxEntry {
  athlete_index: number;
  distance_m: number;
  style: SwimStyle;
  gender?: string;
  entry_time_ms?: number | null;
}

interface ExtractedEventPreview {
  distance: number;
  style: SwimStyle;
  gender: 'M' | 'F';
}

interface ParsedDocxPreview {
  athletes: ParsedDocxAthlete[];
  entries: ParsedDocxEntry[];
  extractedEvents?: ExtractedEventPreview[];
}

interface NamedApplicationDocxRequest {
  title?: string;
  organization?: string;
  region?: string;
  generatedAt?: string;
  athletes: Array<{
    fullName: string;
    birthYear: number;
    gender: string;
    rank?: string;
    coach?: string;
    club?: string;
    region?: string;
    events: Array<{
      distanceM: number;
      style: SwimStyle;
      entryTimeMs?: number | null;
    }>;
  }>;
}

@ApiTags('Athletes')
@Controller('athletes')
export class AthletesController {
  private readonly logger = new Logger(AthletesController.name);

  constructor(
    private readonly service: AthletesService,
    private readonly prisma: PrismaService,
    private readonly featureFlagsService: FeatureFlagsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List athletes with optional search/limit' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, type: String })
  @ApiQuery({ name: 'club', required: false, type: String })
  @ApiQuery({ name: 'gender', required: false, enum: ['M', 'F'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  findAll(@Query() query: { search?: string; region?: string; club?: string; gender?: 'M' | 'F'; limit?: number }) {
    return this.service.findAll(query);
  }

  @Get('database/tree')
  @ApiOperation({ summary: 'Get athlete database tree grouped by region and club' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'region', required: false, type: String })
  @ApiQuery({ name: 'club', required: false, type: String })
  @ApiQuery({ name: 'gender', required: false, enum: ['M', 'F'] })
  @ApiQuery({ name: 'sort', required: false, enum: ['lastName', 'firstName', 'birthYear', 'createdAt'] })
  @ApiQuery({ name: 'direction', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getDatabaseTree(
    @Query() query: {
      search?: string;
      region?: string;
      club?: string;
      gender?: 'M' | 'F';
      sort?: 'lastName' | 'firstName' | 'birthYear' | 'createdAt';
      direction?: 'asc' | 'desc';
      limit?: number;
    },
  ): Promise<unknown> {
    return this.service.getDatabaseTree(query);
  }

  @Get('database/athletes/:id/applications')
  @ApiOperation({ summary: 'Get historical imported application snapshots for athlete' })
  getAthleteApplications(@Param('id', ParseIntPipe) athleteId: number) {
    return this.service.getAthleteApplicationHistory(athleteId);
  }

  @Post('database/named-application-docx')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Generate DOCX for named application via DOCX service' })
  async generateNamedApplicationDocx(
    @Body() body: NamedApplicationDocxRequest,
    @Res() res: Response,
  ) {
    if (!Array.isArray(body.athletes) || body.athletes.length === 0) {
      throw new BadRequestException('Потрібно передати хоча б одного спортсмена для заявки');
    }

    try {
      const response = await fetch(`${DOCX_SERVICE}/named-application`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', 'attachment; filename="Named_Application.docx"');
      res.send(buffer);
    } catch (error: unknown) {
      this.logger.error(
        `Named application DOCX generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadGatewayException('Не вдалося згенерувати DOCX іменної заявки');
    }
  }

  @Get('import-template')
  @ApiOperation({ summary: 'Download CSV template for athletes import' })
  getTemplate(@Res() res: Response) {
    const csv = this.service.getImportTemplate();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=swimsync_import_template.csv');
    res.send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get athlete by id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create athlete' })
  create(@Body() body: CreateAthleteDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update athlete' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateAthleteDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete athlete' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  /**
   * Parse a file (.docx/.csv/.xlsx) and return preview data WITHOUT saving.
   * Frontend shows this for review before confirmation.
   */
  @Post('parse-preview')
  @UseInterceptors(FileInterceptor('file'))
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Parse import file and return preview without saving' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async parsePreview(@UploadedFile() file: Express.Multer.File): Promise<unknown> {
    if (!file) {
      throw new BadRequestException('Файл не передано');
    }
    const name = file.originalname.toLowerCase();

    if (name.endsWith('.docx')) {
      // Proxy to Python DOCX service
      const formData = new FormData();
      formData.append('file', new Blob([file.buffer]), file.originalname);
      try {
        const response = await fetch(`${DOCX_SERVICE}/parse-zayvka`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
        });
        if (!response.ok) throw new Error(await response.text());
        const result = (await response.json()) as ParsedDocxPreview;
        
        // Enhance result with extractedEvents if not provided by Python service
        if (!result.extractedEvents) {
          const eventMap = new Map<string, ExtractedEventPreview>();
          result.entries.forEach((e: ParsedDocxEntry) => {
            const key = `${e.distance_m}-${e.style}-${e.gender}`;
            if (!eventMap.has(key)) {
              const gender = e.gender === 'F' ? 'F' : 'M';
              eventMap.set(key, { distance: e.distance_m, style: e.style, gender });
            }
          });
          result.extractedEvents = Array.from(eventMap.values());
        }
        return result;
      } catch (error: unknown) {
        this.logger.error(
          `DOCX preview parse failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new BadGatewayException('Помилка DOCX-сервісу під час попереднього розбору заявки.');
      }
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return this.service.parseExcelPreview(file.buffer);
    }
    return this.service.parseCsvPreview(file.buffer);
  }

  /**
   * Confirm and save previously parsed data.
   */
  @Post('confirm-import')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Save previously parsed import payload into competition' })
  @ApiQuery({ name: 'competitionId', required: true, type: Number })
  async confirmImport(
    @Query('competitionId', ParseIntPipe) competitionId: number,
    @Body() data: ConfirmImportDto,
  ) {
    // Status guard: only allow imports for draft competitions
    const comp = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (comp && comp.status !== 'draft') {
      throw new ForbiddenException(`Імпорт заблоковано: змагання має статус "${comp.status}". Поверніть його в чернетку.`);
    }
    if (data.bulkEditApplied === true) {
      const bulkEditEnabled = await this.featureFlagsService.isEnabled('ff.import.bulk-edit');
      if (!bulkEditEnabled) {
        throw new ForbiddenException('Масове редагування під час імпорту вимкнено адміністратором.');
      }
    }
    return this.service.confirmImport(competitionId, data.athletes, data.entries);
  }

  /**
   * Direct import (backward-compatible) — parse + save in one step.
   */
  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  @ApiCookieAuth()
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Direct import file and save in one step' })
  @ApiQuery({ name: 'competitionId', required: true, type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async importFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('competitionId', ParseIntPipe) competitionId: number,
  ) {
    if (!file) {
      throw new BadRequestException('Файл не передано');
    }
    // Status guard: only allow imports for draft competitions
    const comp = await this.prisma.competition.findUnique({ where: { id: competitionId } });
    if (comp && comp.status !== 'draft') {
      throw new ForbiddenException(`Імпорт заблоковано: змагання має статус "${comp.status}". Поверніть його в чернетку.`);
    }
    const name = file.originalname.toLowerCase();

    if (name.endsWith('.docx')) {
      // Parse via Python and save
      const formData = new FormData();
      formData.append('file', new Blob([file.buffer]), file.originalname);
      try {
        const response = await fetch(`${DOCX_SERVICE}/parse-zayvka`, {
          method: 'POST',
          body: formData,
          signal: AbortSignal.timeout(appEnv.docxRequestTimeoutMs),
        });
        if (!response.ok) throw new Error(await response.text());
        const parsed = (await response.json()) as ParsedDocxPreview;
        return this.service.confirmImport(competitionId, parsed.athletes, parsed.entries);
      } catch (error: unknown) {
        this.logger.error(
          `DOCX import parse failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw new BadGatewayException('Помилка DOCX-сервісу під час імпорту заявки.');
      }
    }

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      return this.service.importFromExcel(file.buffer, competitionId);
    }
    return this.service.importFromCsv(file.buffer, competitionId);
  }
}
