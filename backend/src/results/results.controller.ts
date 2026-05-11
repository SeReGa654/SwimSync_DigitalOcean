import { Controller, Get, Post, Body, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ResultStatus } from '@prisma/client';
import { ResultsService } from './results.service';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import {
  ApiBody,
  ApiCookieAuth,
  ApiExtraModels,
  ApiOperation,
  ApiProperty,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CompetitionScope } from '../common/decorators/competition-scope.decorator';

class SaveResultRequestDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entryId!: number;

  @ApiProperty({ type: Number, required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  finishTimeMs?: number | null;

  @ApiProperty({ type: String, description: 'OK | DNS | DNF | DQ | PK' })
  @IsIn(['OK', 'DNS', 'DNF', 'DQ', 'PK'])
  status!: ResultStatus;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version?: number;
}

class SaveHeatResultItemDto {
  @ApiProperty({ type: Number })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  entryId!: number;

  @ApiProperty({ type: Number, required: false, nullable: true })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  finishTimeMs?: number | null;

  @ApiProperty({ type: String, description: 'OK | DNS | DNF | DQ | PK' })
  @IsIn(['OK', 'DNS', 'DNF', 'DQ', 'PK'])
  status!: ResultStatus;
}

class SaveHeatResultsRequestDto {
  @ApiProperty({ type: [SaveHeatResultItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SaveHeatResultItemDto)
  results!: SaveHeatResultItemDto[];
}

@ApiTags('Results')
@ApiExtraModels(SaveResultRequestDto, SaveHeatResultsRequestDto, SaveHeatResultItemDto)
@Controller('results')
export class ResultsController {
  constructor(private readonly service: ResultsService) {}

  @Post('save')
  @ApiCookieAuth()
  @Roles('secretary', 'operator')
  @CompetitionScope('entryBody')
  @ApiOperation({ summary: 'Save result for a single entry' })
  @ApiBody({ schema: { $ref: getSchemaPath(SaveResultRequestDto) } })
  saveResult(@Body() body: SaveResultRequestDto) {
    return this.service.saveResult(body);
  }

  @Post('save-heat')
  @ApiCookieAuth()
  @Roles('secretary', 'operator')
  @CompetitionScope('resultsBodyEntries')
  @ApiOperation({ summary: 'Save results for all entries in current heat' })
  @ApiBody({ schema: { $ref: getSchemaPath(SaveHeatResultsRequestDto) } })
  saveHeatResults(@Body() body: SaveHeatResultsRequestDto) {
    return this.service.saveHeatResults(body.results);
  }

  @Post('finalize/:eventId')
  @ApiCookieAuth()
  @Roles('secretary', 'operator')
  @CompetitionScope('eventParam')
  @ApiOperation({ summary: 'Finalize event results' })
  finalize(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.finalizeEvent(eventId);
  }

  @Post('unfinalize/:eventId')
  @ApiCookieAuth()
  @Roles('secretary', 'operator')
  @CompetitionScope('eventParam')
  @ApiOperation({ summary: 'Revert event finalization' })
  unfinalize(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.service.unfinalizeEvent(eventId);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get results by event id' })
  @ApiQuery({ name: 'eventId', required: true, type: Number })
  getEventResults(@Query('eventId', ParseIntPipe) eventId: number) {
    return this.service.getEventResults(eventId);
  }
}
