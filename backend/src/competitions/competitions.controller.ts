import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';
import { UpdateCompetitionDto } from './dto/update-competition.dto';
import { CreateAgeGroupDto } from './dto/create-age-group.dto';
import { ResultProtocolConfigDto } from './dto/result-protocol-config.dto';
import { CreateResultProtocolPresetDto, UpdateResultProtocolPresetDto } from './dto/result-protocol-preset.dto';
import { SaveResultProtocolDefaultsDto } from './dto/result-protocol-defaults.dto';
import { CompetitionResponseDto, ResultProtocolPresetResponseDto } from './dto/result-protocol-response.dto';
import { ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import type { Request } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { CompetitionScope } from '../common/decorators/competition-scope.decorator';

@ApiTags('Competitions')
@Roles('admin', 'secretary')
@Controller('competitions')
export class CompetitionsController {
  constructor(
    private readonly service: CompetitionsService,
    private readonly authService: AuthService,
  ) {}

  private async resolveRequestSession(req: Request) {
    const cookie = this.authService.getCookieConfig();
    const token = this.authService.readCookie(req.header('cookie'), cookie.name);
    const roleCookie = this.authService.readCookie(req.header('cookie'), cookie.roleName);
    const session = await this.authService.resolveSessionForRequest(token || '');
    if (!session || roleCookie !== session.role) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }
    return session;
  }

  @Get()
  @ApiOperation({ summary: 'List competitions' })
  async findAll(@Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.findAll(session.role, session.userId);
  }

  @Get('protocol-defaults/me')
  @ApiOperation({ summary: 'Get my result protocol defaults' })
  async getMyProtocolDefaults(@Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.getMyResultProtocolDefaults(session.userId);
  }

  @Patch('protocol-defaults/me')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Save my result protocol defaults' })
  async saveMyProtocolDefaults(@Req() req: Request, @Body() body: SaveResultProtocolDefaultsDto) {
    const session = await this.resolveRequestSession(req);
    return this.service.setMyResultProtocolDefaults(session.userId, body.config);
  }

  @Get(':id')
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Get competition by id' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    const competition = await this.service.findOne(id, session.role, session.userId);
    if (!competition) {
      throw new NotFoundException('Змагання не знайдено');
    }
    return competition;
  }

  @Post()
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create competition' })
  async create(@Body() body: CreateCompetitionDto, @Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.create(body, session.userId);
  }

  // Age Groups - must come before generic :id routes
  @Get(':id/age-groups')
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'List age groups for competition' })
  async getAgeGroups(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.getAgeGroups(id, session.role, session.userId);
  }

  @Post(':id/age-groups')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Create age group for competition' })
  createAgeGroup(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: CreateAgeGroupDto,
  ) {
    return this.service.createAgeGroup(id, body);
  }

  @Get(':id/result-protocol-config')
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Get result protocol configuration (v2)' })
  async getResultProtocolConfigV2(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.getResultProtocolConfig(id, session.role, session.userId);
  }

  @Patch(':id/result-protocol-config')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({
    summary: 'Set result protocol format for competition (v2)',
    description: 'Configure protocol format, mixed groups, advanced grouping rules.',
  })
  async setResultProtocolConfigV2(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: ResultProtocolConfigDto,
    @Req() req: Request,
  ) {
    const session = await this.resolveRequestSession(req);
    return this.service.setResultProtocolConfig(id, body, session.role, session.userId);
  }

  @Get(':id/result-protocol-presets')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'List result protocol presets for competition' })
  @ApiOkResponse({ type: ResultProtocolPresetResponseDto, isArray: true })
  async listResultProtocolPresets(@Param('id', ParseIntPipe) id: number, @Req() req: Request) {
    const session = await this.resolveRequestSession(req);
    return this.service.listResultProtocolPresets(id, session.userId, session.role);
  }

  @Post(':id/result-protocol-presets')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Create result protocol preset' })
  @ApiCreatedResponse({ type: ResultProtocolPresetResponseDto })
  async createResultProtocolPreset(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: Request,
    @Body() body: CreateResultProtocolPresetDto,
  ) {
    const session = await this.resolveRequestSession(req);
    return this.service.createResultProtocolPreset(id, session.userId, session.role, body);
  }

  @Patch(':id/result-protocol-presets/:presetId')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Update result protocol preset' })
  @ApiOkResponse({ type: ResultProtocolPresetResponseDto })
  async updateResultProtocolPreset(
    @Param('id', ParseIntPipe) id: number,
    @Param('presetId', ParseIntPipe) presetId: number,
    @Req() req: Request,
    @Body() body: UpdateResultProtocolPresetDto,
  ) {
    const session = await this.resolveRequestSession(req);
    return this.service.updateResultProtocolPreset(id, presetId, session.userId, session.role, body);
  }

  @Delete(':id/result-protocol-presets/:presetId')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Delete result protocol preset' })
  @ApiOkResponse({ type: ResultProtocolPresetResponseDto })
  async deleteResultProtocolPreset(
    @Param('id', ParseIntPipe) id: number,
    @Param('presetId', ParseIntPipe) presetId: number,
    @Req() req: Request,
  ) {
    const session = await this.resolveRequestSession(req);
    return this.service.deleteResultProtocolPreset(id, presetId, session.userId, session.role);
  }

  @Post(':id/result-protocol-presets/:presetId/apply')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Apply preset to competition protocol config' })
  @ApiCreatedResponse({ type: CompetitionResponseDto })
  async applyResultProtocolPreset(
    @Param('id', ParseIntPipe) id: number,
    @Param('presetId', ParseIntPipe) presetId: number,
    @Req() req: Request,
  ) {
    const session = await this.resolveRequestSession(req);
    return this.service.applyResultProtocolPreset(id, presetId, session.userId, session.role);
  }

  @Patch(':id')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Update competition' })
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateCompetitionDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Delete competition (admin only)' })
  delete(@Param('id', ParseIntPipe) id: number) {
    return this.service.delete(id);
  }

  @Delete(':id/age-groups/:agId')
  @ApiCookieAuth()
  @CompetitionScope('competitionParam')
  @ApiOperation({ summary: 'Delete age group' })
  deleteAgeGroup(@Param('agId', ParseIntPipe) agId: number) {
    return this.service.deleteAgeGroup(agId);
  }
}
