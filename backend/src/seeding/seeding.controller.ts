import { Controller, Post, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { SeedingService } from './seeding.service';
import { PrismaService } from '../prisma/prisma.service';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Seeding')
@Controller('seeding')
export class SeedingController {
  constructor(
    private readonly service: SeedingService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('generate/:eventId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Generate lane seeding for one event' })
  generate(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.generateSeeding(eventId);
  }

  @Post('generate-all/:competitionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Generate lane seeding for all events in competition' })
  async generateAll(@Param('competitionId', ParseIntPipe) competitionId: number) {
    const events = await this.prisma.event.findMany({
      where: { competitionId },
      select: { id: true },
    });
    let total = 0;
    for (const ev of events) {
      const result = await this.service.generateSeeding(ev.id);
      total += result.entries;
    }
    return { seeded: events.length, totalEntries: total };
  }

  @Delete(':eventId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Clear seeding for event' })
  clear(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.clearSeeding(eventId);
  }
}
