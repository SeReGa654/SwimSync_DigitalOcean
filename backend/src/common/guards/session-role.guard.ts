import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';
import { REQUIRED_ROLE_METADATA_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class SessionRoleGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = this.authService.getCookieConfig();
    const authToken = this.authService.readCookie(request.header('cookie'), cookie.name);
    const roleCookie = this.authService.readCookie(request.header('cookie'), cookie.roleName);
    const resolvedSession = await this.authService.resolveSessionForRequest(authToken || '');

    if (!resolvedSession || roleCookie !== resolvedSession.role) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }

    request.authSession = resolvedSession;

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_ROLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (requiredRoles && requiredRoles.length > 0) {
      if (resolvedSession.role !== 'admin' && !requiredRoles.includes(resolvedSession.role)) {
        throw new ForbiddenException('Forbidden: insufficient role');
      }
    }

    return true;
  }
}
