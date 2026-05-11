import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { StandingsService } from './standings.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Standings')
@Controller('standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Get(':compId')
  @ApiOperation({ summary: 'Get standings for competition' })
  getStandings(@Param('compId', ParseIntPipe) compId: number) {
    return this.standingsService.getStandings(compId);
  }
}
