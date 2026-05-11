import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import {
  COMPETITION_SCOPE_METADATA_KEY,
  type CompetitionScopeSource,
} from '../decorators/competition-scope.decorator';
import { IS_PUBLIC_METADATA_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class CompetitionOwnershipGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request.authSession;
    if (!session) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }
    if (session.role !== 'secretary') {
      return true;
    }

    const scopeSources = this.reflector.getAllAndOverride<CompetitionScopeSource[] | undefined>(
      COMPETITION_SCOPE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!scopeSources || scopeSources.length === 0) {
      return true;
    }

    const competitionIds = new Set<number>();
    for (const source of scopeSources) {
      const ids = await this.resolveCompetitionIds(request, source);
      ids.forEach((id) => competitionIds.add(id));
    }

    if (competitionIds.size === 0) {
      throw new ForbiddenException('Forbidden: unresolved competition scope for secretary route');
    }

    for (const competitionId of competitionIds) {
      const competition = await this.prisma.competition.findUnique({
        where: { id: competitionId },
        select: { createdByUserId: true },
      });
      if (!competition) {
        throw new NotFoundException('Competition not found');
      }
      if (competition.createdByUserId !== session.userId) {
        throw new ForbiddenException('Forbidden: competition is not owned by current secretary');
      }
    }

    return true;
  }

  private async resolveCompetitionIds(
    request: AuthenticatedRequest,
    source: CompetitionScopeSource,
  ): Promise<number[]> {
    if (source === 'eventParam') {
      const eventId = this.parsePositiveInt(request.params?.eventId);
      if (!eventId) return [];
      const competitionId = await this.competitionIdFromEvent(eventId);
      return competitionId ? [competitionId] : [];
    }

    if (source === 'competitionId' || source === 'competitionParam') {
      const competitionId = this.parsePositiveInt(request.params?.id);
      return competitionId ? [competitionId] : [];
    }

    if (source === 'entryBody') {
      const entryId = this.parsePositiveInt((request.body as Record<string, unknown>)?.entryId);
      if (!entryId) return [];
      const competitionId = await this.competitionIdFromEntry(entryId);
      return competitionId ? [competitionId] : [];
    }

    if (source === 'resultsBodyEntries') {
      const rows = (request.body as { results?: Array<{ entryId?: unknown }> })?.results || [];
      const competitionIds = new Set<number>();
      for (const row of rows) {
        const entryId = this.parsePositiveInt(row.entryId);
        if (!entryId) continue;
        const competitionId = await this.competitionIdFromEntry(entryId);
        if (competitionId) competitionIds.add(competitionId);
      }
      return Array.from(competitionIds);
    }

    return [];
  }

  private parsePositiveInt(value: unknown): number | null {
    const first = Array.isArray(value) ? value[0] : value;
    if (typeof first === 'number' && Number.isInteger(first) && first > 0) return first;
    if (typeof first === 'string' && first.trim()) {
      const parsed = Number.parseInt(first, 10);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
    return null;
  }

  private async competitionIdFromEvent(eventId: number): Promise<number | null> {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { competitionId: true },
    });
    return event?.competitionId ?? null;
  }

  private async competitionIdFromEntry(entryId: number): Promise<number | null> {
    const entry = await this.prisma.entry.findUnique({
      where: { id: entryId },
      select: { event: { select: { competitionId: true } } },
    });
    return entry?.event.competitionId ?? null;
  }
}

