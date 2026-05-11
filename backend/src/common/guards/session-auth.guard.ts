import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_METADATA_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const cookie = this.authService.getCookieConfig();
    const authToken = this.authService.readCookie(request.header('cookie'), cookie.name);
    const roleCookie = this.authService.readCookie(request.header('cookie'), cookie.roleName);
    const resolvedSession = await this.authService.resolveSessionForRequest(authToken || '');

    if (!resolvedSession || roleCookie !== resolvedSession.role) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }

    request.authSession = resolvedSession;
    return true;
  }
}

