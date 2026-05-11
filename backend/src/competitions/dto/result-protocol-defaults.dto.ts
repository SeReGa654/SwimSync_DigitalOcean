import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResultProtocolConfigDto } from './result-protocol-config.dto';

export class SaveResultProtocolDefaultsDto {
  @ApiProperty({ type: ResultProtocolConfigDto })
  @ValidateNested()
  @Type(() => ResultProtocolConfigDto)
  config!: ResultProtocolConfigDto;
}
