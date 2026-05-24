import { Controller, Get, NotFoundException, ParseIntPipe, Query, Param } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { CompetitionsService } from '../competitions/competitions.service';
import { EventsService } from '../events/events.service';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private readonly competitionsService: CompetitionsService,
    private readonly eventsService: EventsService,
  ) {}

  @Get('competitions/:id')
  @Public()
  @ApiOperation({ summary: 'Public competition info for live scoreboard' })
  async getCompetition(@Param('id', ParseIntPipe) id: number) {
    const competition = await this.competitionsService.findPublicOne(id);
    if (!competition) {
      throw new NotFoundException('Змагання не знайдено');
    }
    return competition;
  }

  @Get('events')
  @Public()
  @ApiOperation({ summary: 'Public events list for live scoreboard' })
  @ApiQuery({ name: 'competitionId', required: true, type: Number })
  getEvents(@Query('competitionId', ParseIntPipe) competitionId: number) {
    return this.eventsService.findByCompetition(competitionId);
  }
}
