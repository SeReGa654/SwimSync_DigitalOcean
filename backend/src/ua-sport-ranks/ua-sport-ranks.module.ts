import { Module } from '@nestjs/common';
import { UaSportRanksController } from './ua-sport-ranks.controller';
import { UaSportRanksService } from './ua-sport-ranks.service';
import { AuthzModule } from '../common/authz.module';

@Module({ imports: [AuthzModule], controllers: [UaSportRanksController], providers: [UaSportRanksService] })
export class UaSportRanksModule {}
