import {
  Controller,
  Post,
  Req,
  Body,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service';
import { AuditService } from '../audit/audit.service';
import { CreateSupportTicketDto } from './dto/create-support-ticket.dto';
import type { SupportTicketCreateResponse } from 'shared-contracts';

@ApiTags('Support')
@Controller('support')
export class SupportController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  private async requireAuthenticatedSession(req: Request): Promise<{
    userId: number;
    username: string;
    role: 'admin' | 'secretary';
  }> {
    const cookie = this.authService.getCookieConfig();
    const token = this.authService.readCookie(req.header('cookie'), cookie.name);
    const roleCookie = this.authService.readCookie(req.header('cookie'), cookie.roleName);
    const session = await this.authService.resolveSessionForRequest(token || '');
    if (!session || roleCookie !== session.role) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }
    return {
      userId: session.userId,
      username: session.username,
      role: session.role,
    };
  }

  @Post('tickets')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Create support ticket from authenticated user context' })
  @ApiBody({ type: CreateSupportTicketDto })
  async createTicket(
    @Body() body: CreateSupportTicketDto,
    @Req() req: Request,
  ): Promise<SupportTicketCreateResponse> {
    const session = await this.requireAuthenticatedSession(req);
    const saved = await this.auditService.logAction(
      'SUPPORT_TICKET_CREATED',
      'SupportTicket',
      session.userId,
      `user=${session.username} role=${session.role} page=${body.page || 'unknown'} requestId=${body.requestId || 'n/a'} ua=${body.userAgent || 'unknown'} message=${body.message}`,
    );
    return {
      ticketId: saved.id,
      createdAt: saved.createdAt.toISOString(),
    };
  }
}
