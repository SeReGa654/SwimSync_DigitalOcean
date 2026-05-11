import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminLoginDto } from './dto/admin-login.dto';
import { RegisterUserDto } from './dto/register-user.dto';
import { ResetUserPasswordDto } from './dto/reset-user-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthService } from './auth.service';
import { AuditService } from '../audit/audit.service';
import type {
  AuthChangePasswordResponse,
  AuthLoginResponse,
  AuthRegisterResponse,
  AuthSessionsResponse,
  AuthStatusResponse,
  AuthUsersResponse,
} from 'shared-contracts';
import { ApiBody, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  private clearAuthCookies(res: Response): void {
    const cookie = this.authService.getCookieConfig();
    res.clearCookie(cookie.name, {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    });
    res.clearCookie(cookie.roleName, {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    });
    res.clearCookie(cookie.csrfName, {
      httpOnly: false,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      path: cookie.path,
    });
  }

  private async requireAdminSession(req: Request): Promise<{
    sessionId: number;
    userId: number;
    username: string;
  }> {
    const session = await this.requireAuthenticatedSession(req);
    if (session.role !== 'admin') {
      throw new ForbiddenException('Forbidden: insufficient role');
    }
    return session;
  }

  private async requireAuthenticatedSession(req: Request): Promise<{
    sessionId: number;
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
    return session;
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: 'Register new account request (pending admin approval)' })
  async register(@Body() body: RegisterUserDto): Promise<AuthRegisterResponse> {
    const created = await this.authService.registerPendingUser(body.username, body.password, body.role);
    if (!created) {
      throw new ConflictException('Користувач з таким логіном вже існує або роль некоректна');
    }
    await this.auditService.logAction(
      'AUTH_REGISTER_REQUESTED',
      'User',
      created.id,
      `username=${created.username} role=${created.role} approved=false`,
    );
    return {
      requested: true,
      approved: false,
      username: created.username,
      role: created.role,
    };
  }

  @Post('login')
  @Public()
  @ApiOperation({ summary: 'Login with username/password and set auth cookies' })
  async login(
    @Body() body: AdminLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthLoginResponse> {
    const cookie = this.authService.getCookieConfig();
    const requestDetails = `ip=${req.ip || 'unknown'} ua=${req.header('user-agent') || 'unknown'}`;

    if (!body.username || !body.password) {
      await this.auditService.logAction('AUTH_LOGIN_FAILED', 'Auth', undefined, `reason=missing_credentials ${requestDetails}`);
      throw new BadRequestException('Потрібно передати username і password');
    }

    const loginResult = await this.authService.loginWithCredentials(body.username, body.password, {
      ip: req.ip,
      userAgent: req.header('user-agent'),
    });
    if (!loginResult) {
      await this.auditService.logAction(
        'AUTH_LOGIN_FAILED',
        'Auth',
        undefined,
        `method=account username=${body.username} reason=invalid_credentials_or_pending_approval ${requestDetails}`,
      );
      throw new UnauthorizedException('Невірний логін/пароль або акаунт ще не активовано адміністратором');
    }

    const csrfToken = this.authService.generateCsrfToken();
    res.cookie(cookie.name, loginResult.sessionToken, {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      maxAge: cookie.maxAgeMs,
      path: cookie.path,
    });
    res.cookie(cookie.roleName, loginResult.role, {
      httpOnly: true,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      maxAge: cookie.maxAgeMs,
      path: cookie.path,
    });
    res.cookie(cookie.csrfName, csrfToken, {
      httpOnly: false,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      maxAge: cookie.maxAgeMs,
      path: cookie.path,
    });
    await this.auditService.logAction(
      'AUTH_LOGIN_SUCCESS',
      'User',
      loginResult.userId,
      `method=account role=${loginResult.role} username=${loginResult.username} ${requestDetails}`,
    );

    return {
      authenticated: true,
      userId: loginResult.userId,
      role: loginResult.role,
      expiresInMs: cookie.maxAgeMs,
    };
  }

  @Post('logout')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout current session and clear auth cookies' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthStatusResponse> {
    const cookie = this.authService.getCookieConfig();
    const token = this.authService.readCookie(req.header('cookie'), cookie.name);
    const revokedCount = await this.authService.logoutSessionByToken(token || '');
    this.clearAuthCookies(res);
    await this.auditService.logAction('AUTH_LOGOUT', 'Auth', undefined, `revokedSessions=${revokedCount} ip=${req.ip || 'unknown'}`);
    return { authenticated: false };
  }

  @Post('logout-all')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Logout all sessions for current user and clear auth cookies' })
  async logoutAll(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<AuthStatusResponse> {
    const cookie = this.authService.getCookieConfig();
    const token = this.authService.readCookie(req.header('cookie'), cookie.name);
    const revoked = await this.authService.logoutAllSessionsByToken(token || '');
    this.clearAuthCookies(res);
    await this.auditService.logAction(
      'AUTH_LOGOUT_ALL',
      revoked ? 'User' : 'Auth',
      revoked?.userId,
      `revokedSessions=${revoked?.revokedCount || 0} ip=${req.ip || 'unknown'}`,
    );
    return { authenticated: false };
  }

  @Get('status')
  @Public()
  @ApiOperation({ summary: 'Get current auth status from cookies/session' })
  async status(@Req() req: Request): Promise<AuthStatusResponse> {
    const cookie = this.authService.getCookieConfig();
    const token = this.authService.readCookie(req.header('cookie'), cookie.name);
    const roleCookie = this.authService.readCookie(req.header('cookie'), cookie.roleName);
    const session = await this.authService.resolveSessionForRequest(token || '');
    const isAuthenticated = session !== null && roleCookie === session.role;
    return {
      authenticated: isAuthenticated,
      userId: isAuthenticated ? session!.userId : undefined,
      role: isAuthenticated ? session!.role : undefined,
      username: isAuthenticated ? session!.username : undefined,
    };
  }

  @Get('users')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'List all users for admin management' })
  async users(@Req() req: Request): Promise<AuthUsersResponse> {
    await this.requireAdminSession(req);
    const users = await this.authService.listUsers();
    return { users };
  }

  @Patch('users/:userId/approve')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Approve user registration request (admin only)' })
  async approveUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ) {
    const admin = await this.requireAdminSession(req);
    const updated = await this.authService.approveUser(userId, admin.username);
    if (!updated) {
      throw new NotFoundException('Користувача не знайдено');
    }
    await this.auditService.logAction(
      'AUTH_USER_APPROVED',
      'User',
      userId,
      `approvedBy=${admin.username}`,
    );
    return updated;
  }

  @Patch('users/:userId/activate')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Activate user account (admin only)' })
  async activateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ) {
    const admin = await this.requireAdminSession(req);
    const updated = await this.authService.setUserActive(userId, true);
    if (!updated) {
      throw new NotFoundException('Користувача не знайдено');
    }
    await this.auditService.logAction(
      'AUTH_USER_ACTIVATED',
      'User',
      userId,
      `activatedBy=${admin.username}`,
    );
    return updated;
  }

  @Patch('users/:userId/deactivate')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Deactivate user account (admin only)' })
  async deactivateUser(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ) {
    const admin = await this.requireAdminSession(req);
    const updated = await this.authService.setUserActive(userId, false);
    if (!updated) {
      throw new NotFoundException('Користувача не знайдено');
    }
    await this.auditService.logAction(
      'AUTH_USER_DEACTIVATED',
      'User',
      userId,
      `deactivatedBy=${admin.username}`,
    );
    return updated;
  }

  @Patch('users/:userId/reset-password')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Reset user password and revoke active sessions (admin only)' })
  @ApiBody({ type: ResetUserPasswordDto })
  async resetUserPassword(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: ResetUserPasswordDto,
    @Req() req: Request,
  ) {
    const admin = await this.requireAdminSession(req);
    if (!body.password?.trim()) {
      throw new BadRequestException('Пароль не може бути порожнім');
    }
    const updated = await this.authService.resetUserPassword(userId, body.password);
    if (!updated) {
      throw new NotFoundException('Користувача не знайдено');
    }
    await this.auditService.logAction(
      'AUTH_USER_PASSWORD_RESET',
      'User',
      userId,
      `resetBy=${admin.username}`,
    );
    return { updated: true };
  }

  @Get('users/:userId/sessions')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'List active sessions for selected user (admin only)' })
  async userSessions(
    @Param('userId', ParseIntPipe) userId: number,
    @Req() req: Request,
  ): Promise<AuthSessionsResponse> {
    await this.requireAdminSession(req);
    const sessions = await this.authService.getActiveSessionsForUser(userId);
    return { sessions };
  }

  @Delete('users/:userId/sessions/:sessionId')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Revoke selected user session (admin only)' })
  async revokeUserSession(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: Request,
  ): Promise<{ revoked: boolean }> {
    const admin = await this.requireAdminSession(req);
    const revoked = await this.authService.revokeSessionForUser(userId, sessionId);
    await this.auditService.logAction(
      'AUTH_USER_SESSION_REVOKED',
      'User',
      userId,
      `targetSessionId=${sessionId} revoked=${revoked} by=${admin.username} ip=${req.ip || 'unknown'}`,
    );
    return { revoked };
  }

  @Get('sessions')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'List active sessions for current admin account' })
  async sessions(@Req() req: Request): Promise<AuthSessionsResponse> {
    const session = await this.requireAdminSession(req);
    const sessions = await this.authService.getActiveSessionsForUser(session.userId, session.sessionId);
    return { sessions };
  }

  @Delete('sessions/:sessionId')
  @ApiCookieAuth()
  @Roles('admin')
  @ApiOperation({ summary: 'Revoke a specific active session for current admin account' })
  async revokeSession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: Request,
  ): Promise<{ revoked: boolean }> {
    const session = await this.requireAdminSession(req);
    const revoked = await this.authService.revokeSessionForUser(session.userId, sessionId);
    await this.auditService.logAction(
      'AUTH_SESSION_REVOKED',
      'User',
      session.userId,
      `targetSessionId=${sessionId} revoked=${revoked} by=${session.username} ip=${req.ip || 'unknown'}`,
    );
    return { revoked };
  }

  @Get('me/sessions')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'List active sessions for current authenticated account' })
  async mySessions(@Req() req: Request): Promise<AuthSessionsResponse> {
    const session = await this.requireAuthenticatedSession(req);
    const sessions = await this.authService.getActiveSessionsForUser(session.userId, session.sessionId);
    return { sessions };
  }

  @Delete('me/sessions/:sessionId')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Revoke selected active session for current authenticated account' })
  async revokeMySession(
    @Param('sessionId', ParseIntPipe) sessionId: number,
    @Req() req: Request,
  ): Promise<{ revoked: boolean }> {
    const session = await this.requireAuthenticatedSession(req);
    if (sessionId === session.sessionId) {
      throw new BadRequestException('Use /auth/logout to revoke current session');
    }
    const revoked = await this.authService.revokeSessionForUser(session.userId, sessionId);
    await this.auditService.logAction(
      'AUTH_ME_SESSION_REVOKED',
      'User',
      session.userId,
      `targetSessionId=${sessionId} revoked=${revoked} by=${session.username} ip=${req.ip || 'unknown'}`,
    );
    return { revoked };
  }

  @Post('change-password')
  @ApiCookieAuth()
  @ApiOperation({ summary: 'Change password for current authenticated account and revoke other sessions' })
  @ApiBody({ type: ChangePasswordDto })
  async changePassword(
    @Body() body: ChangePasswordDto,
    @Req() req: Request,
  ): Promise<AuthChangePasswordResponse> {
    const session = await this.requireAuthenticatedSession(req);
    if (body.currentPassword === body.newPassword) {
      throw new BadRequestException('Новий пароль має відрізнятися від поточного');
    }
    const validCurrentPassword = await this.authService.verifyUserPassword(session.userId, body.currentPassword);
    if (!validCurrentPassword) {
      throw new UnauthorizedException('Поточний пароль невірний');
    }
    const updated = await this.authService.changeOwnPassword(session.userId, body.newPassword, session.sessionId);
    if (!updated) {
      throw new NotFoundException('Користувача не знайдено');
    }
    await this.auditService.logAction(
      'AUTH_ME_PASSWORD_CHANGED',
      'User',
      session.userId,
      `changedBy=${session.username} ip=${req.ip || 'unknown'}`,
    );
    return { updated: true };
  }
}
