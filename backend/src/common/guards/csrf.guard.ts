import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../../auth/auth.service';
import { IS_PUBLIC_METADATA_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
      return true;
    }

    const cookie = this.authService.getCookieConfig();
    const csrfCookie = this.authService.readCookie(request.header('cookie'), cookie.csrfName);
    const csrfHeader = request.header('x-csrf-token');
    if (!this.authService.isValidCsrfToken(csrfCookie, csrfHeader)) {
      throw new ForbiddenException('Forbidden: invalid CSRF token');
    }

    return true;
  }
}

