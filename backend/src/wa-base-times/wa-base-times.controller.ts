import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { WaBaseTimesService } from './wa-base-times.service';
import { ApiBody, ApiCookieAuth, ApiExtraModels, ApiOperation, ApiProperty, ApiQuery, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionRoleGuard } from '../common/guards/session-role.guard';
import { Public } from '../common/decorators/public.decorator';
import { IsIn, IsInt, IsString, Min } from 'class-validator';

class UpsertWaBaseTimeRequestDto {
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1900)
  year!: number;
  @ApiProperty({ type: String })
  @IsString()
  @IsIn(['M', 'F', 'X'])
  gender!: string;
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  distance!: number;
  @ApiProperty({ type: String })
  @IsString()
  style!: string;
  @ApiProperty({ type: Number })
  @IsInt()
  @IsIn([25, 50])
  poolLength!: number;
  @ApiProperty({ type: Number })
  @IsInt()
  @Min(1)
  baseTimeMs!: number;
}

@ApiTags('WA Base Times')
@ApiExtraModels(UpsertWaBaseTimeRequestDto)
@Controller('wa-base-times')
export class WaBaseTimesController {
  constructor(private readonly service: WaBaseTimesService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'List WA base times, optionally filtered by year and pool length' })
  @ApiQuery({ name: 'year', required: false, type: String })
  @ApiQuery({ name: 'poolLength', required: false, type: String })
  findAll(@Query('year') year?: string, @Query('poolLength') poolLength?: string) {
    return this.service.findAll(year ? parseInt(year) : undefined, poolLength ? parseInt(poolLength) : undefined);
  }

  @Post()
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Create or update WA base time row (admin only)' })
  @ApiBody({ schema: { $ref: getSchemaPath(UpsertWaBaseTimeRequestDto) } })
  upsert(@Body() body: UpsertWaBaseTimeRequestDto) {
    return this.service.upsert(body);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Update WA base time row (admin only)' })
  @ApiBody({ schema: { $ref: getSchemaPath(UpsertWaBaseTimeRequestDto) } })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpsertWaBaseTimeRequestDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @UseGuards(SessionRoleGuard)
  @Roles('admin')
  @ApiOperation({ summary: 'Delete WA base time row (admin only)' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }
}
