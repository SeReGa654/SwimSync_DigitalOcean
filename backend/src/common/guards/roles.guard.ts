import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_METADATA_KEY } from '../decorators/public.decorator';
import { REQUIRED_ROLE_METADATA_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from './authenticated-request';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_ROLE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = request.authSession;
    if (!session) {
      throw new UnauthorizedException('Unauthorized: invalid auth session');
    }

    if (session.role === 'admin') {
      return true;
    }

    if (requiredRoles.includes(session.role)) {
      return true;
    }

    throw new ForbiddenException('Forbidden: insufficient role');
  }
}

