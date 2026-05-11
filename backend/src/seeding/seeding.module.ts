import { Module } from '@nestjs/common';
import { SeedingController } from './seeding.controller';
import { SeedingService } from './seeding.service';
@Module({ controllers: [SeedingController], providers: [SeedingService], exports: [SeedingService] })
export class SeedingModule {}
