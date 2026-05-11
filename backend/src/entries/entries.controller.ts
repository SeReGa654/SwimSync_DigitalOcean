import { BadRequestException, Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { EntriesService } from './entries.service';
import { CreateEntryDto } from './dto/create-entry.dto';
import { UpdateEntryDto } from './dto/update-entry.dto';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Entries')
@Controller('entries')
export class EntriesController {
  constructor(private readonly service: EntriesService) {}

  @Get()
  @ApiOperation({ summary: 'List entries by eventId or competitionId' })
  @ApiQuery({ name: 'eventId', required: false, type: String })
  @ApiQuery({ name: 'competitionId', required: false, type: String })
  find(@Query('eventId') eventId?: string, @Query('competitionId') competitionId?: string) {
    if (eventId) {
      const parsedEventId = parseInt(eventId, 10);
      if (Number.isNaN(parsedEventId)) {
        throw new BadRequestException('Некоректний eventId');
      }
      return this.service.findByEvent(parsedEventId);
    }

    if (competitionId) {
      const parsedCompetitionId = parseInt(competitionId, 10);
      if (Number.isNaN(parsedCompetitionId)) {
        throw new BadRequestException('Некоректний competitionId');
      }
      return this.service.findByCompetition(parsedCompetitionId);
    }

    return [];
  }

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create entry' })
  create(@Body() body: CreateEntryDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Update entry' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateEntryDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete entry' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
