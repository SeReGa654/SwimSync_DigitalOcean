import { Module } from '@nestjs/common';
import { LiveGateway } from './live.gateway';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';

@Module({
  imports: [FeatureFlagsModule],
  providers: [LiveGateway],
  exports: [LiveGateway],
})
export class LiveModule {}
