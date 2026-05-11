import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogFilters, AuditService } from './audit.service';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionRoleGuard } from '../common/guards/session-role.guard';

function parseDateQuery(value: string | undefined, field: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
  const normalizedValue = dateOnlyPattern.test(value)
    ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
    : value;
  const parsed = new Date(normalizedValue);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Invalid ${field} date format`);
  }
  return parsed;
}

@ApiTags('Audit')
@ApiCookieAuth()
@UseGuards(SessionRoleGuard)
@Roles('admin')
@Controller('audit')
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Get audit logs with optional filters (admin only)' })
  @ApiQuery({ name: 'entity', required: false, type: String })
  @ApiQuery({ name: 'action', required: false, type: String })
  @ApiQuery({ name: 'requestId', required: false, type: String })
  @ApiQuery({ name: 'dateFrom', required: false, type: String, description: 'ISO date or YYYY-MM-DD' })
  @ApiQuery({ name: 'dateTo', required: false, type: String, description: 'ISO date or YYYY-MM-DD' })
  getLogs(
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('requestId') requestId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const parsedDateFrom = parseDateQuery(dateFrom, 'dateFrom');
    const parsedDateTo = parseDateQuery(dateTo, 'dateTo', true);
    if (parsedDateFrom && parsedDateTo && parsedDateFrom > parsedDateTo) {
      throw new BadRequestException('dateFrom must be earlier than dateTo');
    }

    const filters: AuditLogFilters = {
      entity: entity?.trim() || undefined,
      action: action?.trim() || undefined,
      requestId: requestId?.trim() || undefined,
      dateFrom: parsedDateFrom,
      dateTo: parsedDateTo,
    };
    return this.service.getLogs(filters);
  }
}
