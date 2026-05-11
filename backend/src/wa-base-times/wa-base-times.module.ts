import { Module } from '@nestjs/common';
import { WaBaseTimesController } from './wa-base-times.controller';
import { WaBaseTimesService } from './wa-base-times.service';
import { AuthzModule } from '../common/authz.module';

@Module({ imports: [AuthzModule], controllers: [WaBaseTimesController], providers: [WaBaseTimesService] })
export class WaBaseTimesModule {}
