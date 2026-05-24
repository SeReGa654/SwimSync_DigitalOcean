import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { CompetitionsModule } from '../competitions/competitions.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [CompetitionsModule, EventsModule],
  controllers: [PublicController],
})
export class PublicModule {}
