import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CompetitionsModule } from './competitions/competitions.module';
import { AthletesModule } from './athletes/athletes.module';
import { EventsModule } from './events/events.module';
import { EntriesModule } from './entries/entries.module';
import { SeedingModule } from './seeding/seeding.module';
import { ResultsModule } from './results/results.module';
import { LiveModule } from './live/live.module';
import { WaBaseTimesModule } from './wa-base-times/wa-base-times.module';
import { UaSportRanksModule } from './ua-sport-ranks/ua-sport-ranks.module';
import { ExportModule } from './export/export.module';
import { AuditModule } from './audit/audit.module';
import { StandingsModule } from './standings/standings.module';
import { HealthController } from './health.controller';
import { AuthModule } from './auth/auth.module';
import { MetricsService } from './observability/metrics.service';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { SupportModule } from './support/support.module';
import { PublicModule } from './public/public.module';
import { SessionAuthGuard } from './common/guards/session-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { CompetitionOwnershipGuard } from './common/guards/competition-ownership.guard';

@Module({
  controllers: [HealthController],
  providers: [
    MetricsService,
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CompetitionOwnershipGuard,
    },
  ],
  imports: [
    PrismaModule,
    CompetitionsModule,
    AthletesModule,
    EventsModule,
    EntriesModule,
    SeedingModule,
    ResultsModule,
    LiveModule,
    WaBaseTimesModule,
    UaSportRanksModule,
    ExportModule,
    AuditModule,
    StandingsModule,
    AuthModule,
    FeatureFlagsModule,
    SupportModule,
    PublicModule,
  ],
})
export class AppModule {}
