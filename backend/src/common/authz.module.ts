import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthService } from '../auth/auth.service';
import { SessionRoleGuard } from './guards/session-role.guard';

@Module({
  imports: [PrismaModule],
  providers: [AuthService, SessionRoleGuard],
  exports: [AuthService, SessionRoleGuard],
})
export class AuthzModule {}
