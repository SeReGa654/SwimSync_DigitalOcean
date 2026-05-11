import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import type { FeatureFlagDto, FeatureFlagsResponse, UpdateFeatureFlagRequest } from 'shared-contracts';
import { AuditService } from '../audit/audit.service';
import { FeatureFlagsService } from './feature-flags.service';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { SessionRoleGuard } from '../common/guards/session-role.guard';
import type { AuthenticatedRequest } from '../common/guards/authenticated-request';

@ApiTags('Feature Flags')
@ApiCookieAuth()
@UseGuards(SessionRoleGuard)
@Controller('feature-flags')
export class FeatureFlagsController {
  constructor(
    private readonly featureFlagsService: FeatureFlagsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('effective')
  @Roles('admin', 'secretary', 'operator')
  @ApiOperation({ summary: 'List effective feature flags for authenticated roles' })
  async listEffectiveFlags(): Promise<FeatureFlagsResponse> {
    const flags = await this.featureFlagsService.listFlags();
    return { flags };
  }

  @Get()
  @Roles('admin')
  @ApiOperation({ summary: 'List feature flags with effective values (admin only)' })
  async listFlags(): Promise<FeatureFlagsResponse> {
    const flags = await this.featureFlagsService.listFlags();
    return { flags };
  }

  @Get(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Get single feature flag by key (admin only)' })
  async getFlag(@Param('key') key: string): Promise<FeatureFlagDto> {
    return this.featureFlagsService.getFlag(key);
  }

  @Patch(':key')
  @Roles('admin')
  @ApiOperation({ summary: 'Update feature flag state (admin only)' })
  async updateFlag(
    @Param('key') key: string,
    @Body() body: UpdateFeatureFlagRequest,
    @Req() req: AuthenticatedRequest,
  ): Promise<FeatureFlagDto> {
    const session = req.authSession;
    if (!session) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }
    if (typeof body.enabled !== 'boolean') {
      throw new BadRequestException('Field "enabled" must be boolean');
    }
    const updated = await this.featureFlagsService.updateFlag(key, body.enabled, session.username);
    await this.auditService.logAction(
      'FEATURE_FLAG_UPDATED',
      'FeatureFlag',
      undefined,
      `key=${key} enabled=${body.enabled} by=${session.username}`,
    );
    return updated;
  }
}
