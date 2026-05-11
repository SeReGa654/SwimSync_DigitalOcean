import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ResultProtocolConfigDto } from './result-protocol-config.dto';

export class CreateResultProtocolPresetDto {
  @ApiProperty({ type: String })
  @IsString()
  name!: string;

  @ApiProperty({ type: Boolean, required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ type: ResultProtocolConfigDto })
  @ValidateNested()
  @Type(() => ResultProtocolConfigDto)
  config!: ResultProtocolConfigDto;
}

export class UpdateResultProtocolPresetDto {
  @ApiProperty({ type: String, required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ type: Boolean, required: false })
  @IsOptional()
  @IsBoolean()
  isShared?: boolean;

  @ApiProperty({ type: ResultProtocolConfigDto, required: false })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResultProtocolConfigDto)
  config?: ResultProtocolConfigDto;
}
