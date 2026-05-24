import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { UaSportRanksService } from './ua-sport-ranks.service';
import { CreateUaSportRankDto } from './dto/create-ua-sport-rank.dto';
import { UpdateUaSportRankDto } from './dto/update-ua-sport-rank.dto';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionRoleGuard } from '../common/guards/session-role.guard';
import { Public } from '../common/decorators/public.decorator';

@ApiTags('UA Sport Ranks')
@Controller('ua-sport-ranks')
export class UaSportRanksController {
  constructor(private readonly service: UaSportRanksService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List UA sport rank rules, optionally by pool length' })
  @ApiQuery({ name: 'poolLength', required: false, type: String })
  findAll(@Query('poolLength') poolLength?: string) {
    return this.service.findAll(poolLength ? parseInt(poolLength) : undefined);
  }

  @Post()
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create UA sport rank rule (admin only)' })
  create(@Body() body: CreateUaSportRankDto) {
    return this.service.create(body);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update UA sport rank rule (admin only)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateUaSportRankDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete UA sport rank rule (admin only)' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
