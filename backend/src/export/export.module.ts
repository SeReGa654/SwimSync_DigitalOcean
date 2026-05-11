import { Module } from '@nestjs/common';
import { ExportController } from './export.controller';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [FeatureFlagsModule],
  controllers: [ExportController],
})
export class ExportModule {}
