import { SetMetadata } from '@nestjs/common';

export type AppRole = 'admin' | 'secretary' | 'operator';

export const REQUIRED_ROLE_METADATA_KEY = 'requiredRoles';

export const Roles = (...roles: AppRole[]) => SetMetadata(REQUIRED_ROLE_METADATA_KEY, roles);
