import { Injectable, NotFoundException } from '@nestjs/common';
import { AthleteGender as PrismaAthleteGender, Prisma, SwimStyle } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import * as Papa from 'papaparse';
import ExcelJS from 'exceljs';
import { parseTime } from '../utils/time.utils';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { UpdateAthleteDto } from './dto/update-athlete.dto';
import type { AuthRole } from 'shared-contracts';

type ImportCell = string | number | boolean | null | undefined;
type ImportRow = Record<string, ImportCell>;
type AthleteGender = 'M' | 'F';

interface ParsedImportAthlete {
  lastName: string;
  firstName: string;
  birthYear: number;
  gender: AthleteGender;
  currentRank: string;
  rank_raw: string;
  coach: string;
  club: string;
  region: string;
  doctorApproved: boolean;
  // compatibility for confirmImport
  last_name: string;
  first_name: string;
  birth_year: number;
  rank: string;
  doctor_approved: boolean;
}

interface ParsedImportEntry {
  athlete_index: number;
  distance_m: number;
  style: string;
  gender: AthleteGender;
  entry_time_ms: number | null;
  distance_raw: string;
  time_raw: string;
}

interface ImportWarning {
  row: number;
  field?: 'rank' | 'time';
  message: string;
}

interface ImportError {
  row: number;
  message: string;
}

interface ConfirmImportAthleteInput {
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

interface ConfirmImportEntryInput {
  athlete_index: number;
  distance_m: number;
  style: string;
  gender?: string;
  entry_time_ms?: number | null;
}

interface ExtractedEvent {
  distance: number;
  style: string;
  gender: AthleteGender;
}

interface AthleteDatabaseQuery {
  search?: string;
  region?: string;
  club?: string;
  gender?: AthleteGender;
  sort?: 'lastName' | 'firstName' | 'birthYear' | 'createdAt';
  direction?: 'asc' | 'desc';
  limit?: number;
}

interface AthleteViewer {
  role: AuthRole;
  userId: number;
}

interface AthleteDatabaseTreeRegion {
  region: string;
  schools: Array<{
    school: string;
    athletes: Array<{
      id: number;
      lastName: string;
      firstName: string;
      birthYear: number;
      gender: string;
      currentRank: string;
      coach: string | null;
      club: string;
      region: string | null;
      applicationCount: number;
      latestApplicationAt: string | null;
    }>;
  }>;
}

@Injectable()
export class AthletesService {
  constructor(private prisma: PrismaService) {}

  private scopeAthleteWhere(where: Prisma.AthleteWhereInput, viewer: AthleteViewer): Prisma.AthleteWhereInput {
    return viewer.role === 'admin' ? where : { AND: [where, { createdByUserId: viewer.userId }] };
  }

  private buildAthleteWhere(query?: {
    search?: string;
    region?: string;
    club?: string;
    gender?: AthleteGender;
  }): Prisma.AthleteWhereInput {
    const search = query?.search?.trim();
    const where: Prisma.AthleteWhereInput = {
      ...(query?.region ? { region: { equals: query.region.trim(), mode: 'insensitive' } } : {}),
      ...(query?.club ? { club: { equals: query.club.trim(), mode: 'insensitive' } } : {}),
      ...(query?.gender ? { gender: query.gender } : {}),
    };
    if (!search) {
      return where;
    }
    return {
      ...where,
      OR: [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { club: { contains: search, mode: 'insensitive' } },
        { region: { contains: search, mode: 'insensitive' } },
        { coach: { contains: search, mode: 'insensitive' } },
      ],
    };
  }

  async findAll(query: { search?: string; region?: string; club?: string; gender?: AthleteGender; limit?: number } | undefined, viewer: AthleteViewer) {
    const take = query?.limit ? Number(query.limit) : 200;
    return this.prisma.athlete.findMany({
      where: this.scopeAthleteWhere(this.buildAthleteWhere(query), viewer),
      take,
      orderBy: { lastName: 'asc' },
    });
  }

  async getDatabaseTree(query: AthleteDatabaseQuery | undefined, viewer: AthleteViewer): Promise<{ regions: AthleteDatabaseTreeRegion[]; totalAthletes: number }> {
    const direction: 'asc' | 'desc' = query?.direction === 'desc' ? 'desc' : 'asc';
    const limit = query?.limit ? Math.min(Math.max(Number(query.limit), 1), 1000) : 500;
    const sortField = query?.sort || 'lastName';
    const orderBy =
      sortField === 'birthYear'
        ? { birthYear: direction }
        : sortField === 'firstName'
          ? { firstName: direction }
          : sortField === 'createdAt'
            ? { id: direction }
            : { lastName: direction };

    const where = this.scopeAthleteWhere(this.buildAthleteWhere(query), viewer);

    const athletes = await this.prisma.athlete.findMany({
      where,
      take: limit,
      orderBy,
      include: {
        applications: {
          select: { id: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    const regionMap = new Map<string, Map<string, AthleteDatabaseTreeRegion['schools'][number]>>();
    for (const athlete of athletes) {
      const regionName = athlete.region?.trim() || 'Невідомий регіон';
      const schoolName = athlete.club?.trim() || 'Невідома школа';
      const regionEntry = regionMap.get(regionName) || new Map<string, AthleteDatabaseTreeRegion['schools'][number]>();
      if (!regionMap.has(regionName)) regionMap.set(regionName, regionEntry);

      const schoolEntry = regionEntry.get(schoolName) || { school: schoolName, athletes: [] as AthleteDatabaseTreeRegion['schools'][number]['athletes'] };
      if (!regionEntry.has(schoolName)) regionEntry.set(schoolName, schoolEntry);

      schoolEntry.athletes.push({
        id: athlete.id,
        lastName: athlete.lastName,
        firstName: athlete.firstName,
        birthYear: athlete.birthYear,
        gender: athlete.gender,
        currentRank: athlete.currentRank,
        coach: athlete.coach,
        club: athlete.club,
        region: athlete.region,
        applicationCount: athlete.applications.length,
        latestApplicationAt: athlete.applications[0]?.createdAt?.toISOString() || null,
      });
    }

    const regions: AthleteDatabaseTreeRegion[] = Array.from(regionMap.entries()).map(([region, schoolsMap]) => ({
      region,
      schools: Array.from(schoolsMap.values()),
    }));

    regions.sort((a, b) => a.region.localeCompare(b.region, 'uk'));
    for (const region of regions) {
      region.schools.sort((a, b) => a.school.localeCompare(b.school, 'uk'));
      for (const school of region.schools) {
        school.athletes.sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`, 'uk'));
      }
    }

    return { regions, totalAthletes: athletes.length };
  }

  async getAthleteApplicationHistory(athleteId: number, viewer: AthleteViewer) {
    const where = this.scopeAthleteWhere({ id: athleteId }, viewer);
    const athlete = await this.prisma.athlete.findFirst({ where, select: { id: true } });
    if (!athlete) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.athleteApplication.findMany({
      where: { athleteId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          orderBy: [{ distanceM: 'asc' }, { style: 'asc' }],
        },
        competition: {
          select: {
            id: true,
            name: true,
            dateFrom: true,
            dateTo: true,
            status: true,
          },
        },
      },
    });
  }

  findOne(id: number, viewer: AthleteViewer) {
    return this.prisma.athlete.findFirst({
      where: this.scopeAthleteWhere({ id }, viewer),
      include: { entries: { include: { event: true, result: true } } },
    });
  }

  create(data: CreateAthleteDto, viewer: AthleteViewer) {
    return this.prisma.athlete.create({
      data: {
        ...data,
        gender: this.normalizeAthleteGender(data.gender),
        createdByUserId: viewer.userId,
      },
    });
  }

  async update(id: number, data: UpdateAthleteDto, viewer: AthleteViewer) {
    const existing = await this.prisma.athlete.findFirst({
      where: this.scopeAthleteWhere({ id }, viewer),
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.athlete.update({
      where: { id },
      data: {
        ...data,
        ...(data.gender ? { gender: this.normalizeAthleteGender(data.gender) } : {}),
      },
    });
  }

  async delete(id: number, viewer: AthleteViewer) {
    const existing = await this.prisma.athlete.findFirst({
      where: this.scopeAthleteWhere({ id }, viewer),
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Athlete not found');
    }
    return this.prisma.athlete.delete({ where: { id } });
  }

  async importFromCsv(buffer: Buffer, competitionId: number, viewer: AthleteViewer) {
    const text = buffer.toString('utf-8');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    return this.processImportRows(result.data as ImportRow[], competitionId, viewer);
  }

  async importFromExcel(buffer: Buffer, competitionId: number, viewer: AthleteViewer) {
    const rows = await this.parseExcelRows(buffer);
    return this.processImportRows(rows, competitionId, viewer);
  }

  private async processImportRows(rows: ImportRow[], competitionId: number, viewer: AthleteViewer) {
    const { athletes, entries } = this.parseRows(rows);
    return this.confirmImport(competitionId, athletes, entries, viewer);
  }

  private cellText(value: ImportCell): string {
    return (value ?? '').toString().trim();
  }

  private parseRows(rows: ImportRow[]) {
    const athletes: ParsedImportAthlete[] = [];
    const entries: ParsedImportEntry[] = [];
    const warnings: ImportWarning[] = [];
    const errors: ImportError[] = [];

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx];
      const lastName = this.cellText(row['Прізвище'] ?? row['LastName'] ?? row['Last Name']);
      const firstName = this.cellText(row["Ім'я"] ?? row['Імя'] ?? row['FirstName'] ?? row['First Name']);
      if (!lastName && !firstName) continue;

      const birthYearRaw = this.cellText(row['Рік народження'] ?? row['BirthYear'] ?? row['Birth Year']);
      const birthYear = parseInt(birthYearRaw, 10);
      if (isNaN(birthYear)) {
        errors.push({ row: rowIdx + 1, message: `Рік народження не розпізнано: "${birthYearRaw}"` });
        continue;
      }

      const genderRaw = this.cellText(row['Стать'] ?? row['EventGender'] ?? row['Gender']);
      const athleteGender = this.normalizeGender(genderRaw, firstName);

      const rankRaw = this.cellText(row['Розряд'] ?? row['CurrentRank'] ?? row['Rank']);
      const rank = this.normalizeRank(rankRaw);
      if (rank === 'NONE' && rankRaw !== '') {
        warnings.push({ row: rowIdx + 1, field: 'rank', message: `Розряд не розпізнано: "${rankRaw}"` });
      }

      const coach = this.cellText(row['Тренер'] ?? row['Coach']);
      const club = this.cellText(row['Клуб'] ?? row['Club']);
      const region = this.cellText(row['Регіон'] ?? row['Region']);
      const doctorApproved = ['1', 'true', 'так', 'yes', 'д'].includes(
        this.cellText(row['Допуск лікаря'] ?? row['DoctorApproved'] ?? row['Допуск'] ?? 'false').toLowerCase()
      );

      const athleteIndex = athletes.length;
      athletes.push({
        lastName, firstName, birthYear,
        gender: athleteGender,
        currentRank: rank, rank_raw: rankRaw, coach, club, region, doctorApproved,
        // compatibility for confirmImport
        last_name: lastName, first_name: firstName, birth_year: birthYear,
        rank: rank, doctor_approved: doctorApproved
      });

      // Parse distance + time (optional per row, but checked)
      const distRaw = this.cellText(row['Дистанція'] ?? row['EventDistance'] ?? row['Distance']);
      const styleRaw = this.cellText(row['Стиль'] ?? row['EventStyle'] ?? row['Style']);
      const timeRaw = this.cellText(row['Заявочний час'] ?? row['EntryTime'] ?? row['Entry Time'] ?? 'NT');

      if (distRaw && styleRaw) {
        const distance_m = parseInt(distRaw, 10);
        const style = this.normalizeStyle(styleRaw);
        const entry_time_ms = parseTime(timeRaw);

        if (entry_time_ms === null && timeRaw && !['NT', 'Б/Ч', 'БЕЗ ЧАСУ'].includes(timeRaw.toUpperCase()) && timeRaw !== '') {
          warnings.push({ row: rowIdx + 1, field: 'time', message: `Час не розпізнано: "${timeRaw}"` });
        }

        entries.push({
          athlete_index: athleteIndex, distance_m, style, gender: athleteGender,
          entry_time_ms, distance_raw: `${distRaw}`, time_raw: timeRaw,
        });
      }
    }

    return { athletes, entries, warnings, errors };
  }

  private normalizeGender(raw: string, firstName?: string): AthleteGender {
    const s = raw.toUpperCase().trim();
    if (['F', 'Ж', 'W', 'ЖІН', 'Д'].includes(s)) return 'F';
    if (['M', 'Ч', 'М', 'ЧОЛ', 'Х'].includes(s)) return 'M';
    
    // Guess by name if raw is empty
    if (!raw && firstName) {
      const firstLower = firstName.trim().toLowerCase();
        if (firstLower.endsWith('а') || firstLower.endsWith('я')) {
            const maleExceptions = ['ілля', 'микола', 'микита', 'сава', 'кузьма', 'лука', 'хома'];
            if (!maleExceptions.includes(firstLower)) return 'F';
        }
    }
    return 'M'; // Default
  }

  private normalizeStyle(s: string): SwimStyle {
    const lower = s.toLowerCase().trim();
    if (lower.includes('в/с') || lower.includes('вільн') || lower.includes('free')) return 'Freestyle';
    if (lower.includes('брас') || lower.includes('breast')) return 'Breaststroke';
    if (lower.includes('бат') || lower.includes('fly') || lower.includes('метелик') || lower.includes('батт')) return 'Butterfly';
    if (lower.includes('н/с') || lower.includes('спин') || lower.includes('back')) return 'Backstroke';
    if (lower.includes('к/п') || lower.includes('компл') || lower.includes('medley') || lower.includes('im')) return 'Medley';
    // If already in English
    if (['Freestyle', 'Backstroke', 'Breaststroke', 'Butterfly', 'Medley'].includes(s)) return s as SwimStyle;
    return 'Freestyle';
  }

  private normalizeAthleteGender(gender: string | undefined): PrismaAthleteGender {
    return gender === 'F' ? 'F' : 'M';
  }

  getImportTemplate(): string {
    return [
      'Прізвище,Ім\'я,Рік народження,Стать,Розряд,Тренер,Клуб,Регіон,Допуск лікаря,Дистанція,Стиль,Заявочний час',
      'Іваненко,Олексій,2010,Ч,ІІ,Петренко О.В.,ДЮСШ-1,Київ,1,50,Вільний стиль,28.50',
      'Коваленко,Марія,2011,Ж,ІІІ,Сидоренко Л.М.,СК Дельфін,Львів,1,100,Брас,1:25.00',
    ].join('\n');
  }

  async parseCsvPreview(buffer: Buffer) {
    const text = buffer.toString('utf-8');
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    return this.buildPreviewResult(result.data as ImportRow[]);
  }

  async parseExcelPreview(buffer: Buffer) {
    const rows = await this.parseExcelRows(buffer);
    return this.buildPreviewResult(rows);
  }

  private excelCellToImportCell(value: ExcelJS.CellValue): ImportCell {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map((item) => item.text || '').join('');
    if (typeof value === 'object') {
      if ('result' in value) return this.excelCellToImportCell(value.result ?? '');
      if ('text' in value && typeof value.text === 'string') return value.text;
      if ('richText' in value && Array.isArray(value.richText)) {
        return value.richText.map((item) => item.text || '').join('');
      }
      if ('hyperlink' in value && typeof value.hyperlink === 'string') return value.hyperlink;
      return '';
    }
    return '';
  }

  private async parseExcelRows(buffer: Buffer): Promise<ImportRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    if (!worksheet) return [];

    const headerRow = worksheet.getRow(1);
    const columnCount = Math.max(headerRow.cellCount, headerRow.actualCellCount);
    if (columnCount === 0) return [];

    const headers = Array.from({ length: columnCount }, (_, index) =>
      this.cellText(this.excelCellToImportCell(headerRow.getCell(index + 1).value)),
    );

    const rows: ImportRow[] = [];
    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const mapped: ImportRow = {};
      let hasData = false;

      for (let col = 1; col <= columnCount; col += 1) {
        const header = headers[col - 1];
        if (!header) continue;
        const value = this.excelCellToImportCell(row.getCell(col).value);
        mapped[header] = value;
        if (this.cellText(value) !== '') {
          hasData = true;
        }
      }

      if (hasData) {
        rows.push(mapped);
      }
    }

    return rows;
  }

  private buildPreviewResult(rows: ImportRow[]) {
    const { athletes, entries, warnings, errors } = this.parseRows(rows);
    
    // Extract unique events for the UI
    const eventMap = new Map<string, ExtractedEvent>();
    for (const e of entries) {
      const key = `${e.distance_m}-${e.style}-${e.gender}`;
      if (!eventMap.has(key)) {
        eventMap.set(key, { distance: e.distance_m, style: e.style, gender: e.gender });
      }
    }
    const extractedEvents = Array.from(eventMap.values());

    return { athletes, entries, warnings, errors, extractedEvents };
  }

  /** Save previously parsed & reviewed data */
  async confirmImport(competitionId: number, athletes: ConfirmImportAthleteInput[], entries: ConfirmImportEntryInput[], viewer: AthleteViewer) {
    const styleUaMap: Record<string, string> = {
      'Freestyle': 'Вільний стиль', 'Breaststroke': 'Брас',
      'Backstroke': 'На спині', 'Butterfly': 'Батерфляй',
      'Medley': 'Комплексне плавання',
    };

    const result = await this.prisma.$transaction(async (tx) => {
      const competition = await tx.competition.findUnique({
        where: { id: competitionId },
        include: { ageGroups: true },
      });

      const athleteIdMap = new Map<number, number>();
      const entriesByAthleteIndex = new Map<number, ConfirmImportEntryInput[]>();
      let importedAthletes = 0;
      let importedEntries = 0;

      for (const entry of entries) {
        const list = entriesByAthleteIndex.get(entry.athlete_index) || [];
        list.push(entry);
        entriesByAthleteIndex.set(entry.athlete_index, list);
      }

      // Batch-find existing athletes to avoid N+1
      const athleteWhereOr: Prisma.AthleteWhereInput[] = [];
      const athleteKeyForIndex = new Map<number, string>();
      for (let i = 0; i < athletes.length; i++) {
        const a = athletes[i];
        const lastName = a.lastName || a.last_name || '';
        const firstName = a.firstName || a.first_name || '';
        const birthYear = a.birthYear || a.birth_year || 2000;
        const key = `${lastName}||${firstName}||${birthYear}`;
        athleteKeyForIndex.set(i, key);
        athleteWhereOr.push(viewer.role === 'admin'
          ? { lastName, firstName, birthYear }
          : { lastName, firstName, birthYear, createdByUserId: viewer.userId });
      }

      const existingAthletes = athleteWhereOr.length
        ? await tx.athlete.findMany({ where: { OR: athleteWhereOr } })
        : [];

      const athleteKeyToRec = new Map<string, { id: number; lastName: string; firstName: string; birthYear: number }>();
      for (const rec of existingAthletes) {
        const key = `${rec.lastName}||${rec.firstName}||${rec.birthYear}`;
        athleteKeyToRec.set(key, { id: rec.id, lastName: rec.lastName, firstName: rec.firstName, birthYear: rec.birthYear });
      }

      // Create missing athletes (only creates, no extra find queries)
      for (let i = 0; i < athletes.length; i++) {
        const a = athletes[i];
        const lastName = a.lastName || a.last_name || '';
        const firstName = a.firstName || a.first_name || '';
        const birthYear = a.birthYear || a.birth_year || 2000;
        const rank = a.currentRank || a.rank || 'NONE';
        const coach = a.coach || '';
        const club = a.club || '';
        const region = a.region || '';
        const gender = this.normalizeAthleteGender(a.gender);

        const key = athleteKeyForIndex.get(i) as string;
        let athleteRec = athleteKeyToRec.get(key);
        if (!athleteRec) {
          const created = await tx.athlete.create({
            data: { lastName, firstName, birthYear, gender, currentRank: rank, coach, club, region, createdByUserId: viewer.userId },
          });
          athleteRec = { id: created.id, lastName: created.lastName, firstName: created.firstName, birthYear: created.birthYear };
          athleteKeyToRec.set(key, athleteRec);
          importedAthletes++;
        }

        athleteIdMap.set(i, athleteRec.id);

        // create athleteApplication with items (if any)
        const athleteEntries = entriesByAthleteIndex.get(i) || [];
        if (athleteEntries.length > 0) {
          await tx.athleteApplication.create({
            data: {
              athleteId: athleteRec.id,
              competitionId: competition?.id,
              currentRank: rank,
              coach,
              club,
              region,
              doctorApproved: Boolean(a.doctorApproved ?? a.doctor_approved),
              items: {
                create: athleteEntries.map((entry) => ({
                  distanceM: entry.distance_m,
                  style: this.normalizeStyle(entry.style),
                  gender: this.normalizeAthleteGender(entry.gender || gender),
                  entryTimeMs: entry.entry_time_ms ?? null,
                })),
              },
            },
          });
        }
      }

      // Build event names (use athlete data where available) and batch-find existing events
      const eventNamesSet = new Set<string>();
      const styleMap = styleUaMap;
      for (const e of entries) {
        const athleteIndex = e.athlete_index;
        const athleteData = athletes[athleteIndex];
        const gender = this.normalizeAthleteGender(athleteData?.gender || e.gender || 'M');
        const genderLabel = gender === 'F' ? 'Жінки' : 'Чоловіки';
        const normalizedStyle = this.normalizeStyle(e.style);
        const eventName = `${e.distance_m}м ${styleMap[normalizedStyle] || normalizedStyle} ${genderLabel}`;
        eventNamesSet.add(eventName);
      }

      const eventNames = Array.from(eventNamesSet);
      const existingEvents = eventNames.length
        ? await tx.event.findMany({ where: { competitionId, name: { in: eventNames } } })
        : [];

      const eventNameToRec = new Map<string, { id: number; name: string }>();
      for (const ev of existingEvents) eventNameToRec.set(ev.name, { id: ev.id, name: ev.name });

      // Create missing events
      for (const name of eventNames) {
        if (!eventNameToRec.has(name)) {
          // derive distance/style/gender from name conservatively
          const parts = name.split(' ');
          const distancePart = parts[0] || '0';
          const distance = parseInt(distancePart.replace('м', ''), 10) || 0;
          // style detection: try to find matching style in UA map keys
          let style: SwimStyle = 'Freestyle';
          for (const k of Object.keys(styleMap)) {
            if (name.includes(styleMap[k])) { style = k as SwimStyle; break; }
          }
          const gender = name.includes('Жін') ? 'F' : 'M';
          const createdEv = await tx.event.create({ data: { competitionId, distance, style, gender, name } });
          eventNameToRec.set(name, { id: createdEv.id, name: createdEv.name });
        }
      }

      const athleteIds = Array.from(new Set(Array.from(athleteIdMap.values())));
      const eventIds = Array.from(eventNameToRec.values()).map(v => v.id);

      // Preload existing entries for pairs to avoid per-entry queries
      const existingEntries = (athleteIds.length && eventIds.length)
        ? await tx.entry.findMany({ where: { athleteId: { in: athleteIds }, eventId: { in: eventIds } }, select: { athleteId: true, eventId: true } })
        : [];
      const existingPairs = new Set(existingEntries.map(en => `${en.athleteId}-${en.eventId}`));

      // Create missing entries
      for (const e of entries) {
        const athleteId = athleteIdMap.get(e.athlete_index);
        if (!athleteId) continue;

        const athleteData = athletes[e.athlete_index];
        const gender = this.normalizeAthleteGender(athleteData?.gender || e.gender || 'M');
        const athleteBirthYear = athleteData?.birthYear ?? athleteData?.birth_year;
        const genderLabel = gender === 'F' ? 'Жінки' : 'Чоловіки';
        const normalizedStyle = this.normalizeStyle(e.style);
        const eventName = `${e.distance_m}м ${styleUaMap[normalizedStyle] || normalizedStyle} ${genderLabel}`;

        const eventRec = eventNameToRec.get(eventName);
        if (!eventRec) continue; // defensive

        let ageGroupId: number | null = null;
        if (competition?.ageGroups && athleteBirthYear !== undefined) {
          const ag = competition.ageGroups.find(
            g => athleteBirthYear >= g.birthYearFrom && athleteBirthYear <= g.birthYearTo,
          );
          if (ag) ageGroupId = ag.id;
        }

        const doctorApproved = athleteData?.doctorApproved ?? athleteData?.doctor_approved ?? false;
        const pairKey = `${athleteId}-${eventRec.id}`;
        if (!existingPairs.has(pairKey)) {
          await tx.entry.create({ data: {
            athleteId, eventId: eventRec.id,
            entryTimeMs: e.entry_time_ms ?? null,
            ageGroupId, doctorApproved,
          } });
          existingPairs.add(pairKey);
          importedEntries++;
        }
      }

      return { imported: importedAthletes, entries: importedEntries };
    });

    return result;
  }

  private normalizeRank(raw: string): string {
    if (!raw) return 'NONE';
    const s = raw.trim().toLowerCase().replace(/\s/g, '');
    const map: Record<string, string> = {
      'мсмк': 'MSMK', 'msмк': 'MSMK', 'мсму': 'MSMK',
      'мс': 'MS', 'мсу': 'MS',
      'кмсу': 'KMSU', 'кмс': 'KMSU',
      'і': 'R1', '1': 'R1', 'i': 'R1', 'ір': 'R1',
      'іі': 'R2', '2': 'R2', 'ii': 'R2', 'іір': 'R2',
      'ііі': 'R3', '3': 'R3', 'iii': 'R3', 'ііір': 'R3',
      '1юн': 'Y1', 'іюн': 'Y1', '1-юн': 'Y1', 'і-юн': 'Y1',
      '2юн': 'Y2', 'ііюн': 'Y2', '2-юн': 'Y2', 'іі-юн': 'Y2',
      '3юн': 'Y3', 'іііюн': 'Y3', '3-юн': 'Y3', 'ііі-юн': 'Y3',
      'б/р': 'NONE', 'безрозряду': 'NONE', 'none': 'NONE'
    };
    if (map[s]) return map[s];
    // Partial Match
    if (s.includes('мсмк')) return 'MSMK';
    if (s.includes('кмсу') || s.includes('кмс')) return 'KMSU';
    if (s.includes('мсу') || s === 'мс' || s.includes('майстерспорту')) return 'MS';
    if (s.includes('1юн') || s.includes('іюн')) return 'Y1';
    if (s.includes('2юн') || s.includes('ііюн')) return 'Y2';
    if (s.includes('3юн') || s.includes('іііюн')) return 'Y3';
    if (s.startsWith('1') || s.startsWith('і') || s.startsWith('i')) return 'R1';
    if (s.startsWith('2') || s.startsWith('іі') || s.startsWith('ii')) return 'R2';
    if (s.startsWith('3') || s.startsWith('ііі') || s.startsWith('iii')) return 'R3';

    return 'NONE';
  }
}
