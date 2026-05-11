import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('Events')
@Controller('events')
export class EventsController {
  constructor(private readonly service: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List events by competition id' })
  @ApiQuery({ name: 'competitionId', required: true, type: Number })
  findByCompetition(@Query('competitionId', ParseIntPipe) competitionId: number) {
    return this.service.findByCompetition(competitionId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get event by id' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create event' })
  create(@Body() body: CreateEventDto) {
    return this.service.create(body);
  }

  @Patch('reorder')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Reorder events for protocol generation' })
  reorder(@Body() body: { eventIds: number[] }) {
    return this.service.reorder(body.eventIds);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Delete event' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
