import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResultProtocolConfigDto } from './result-protocol-config.dto';

export class ResultProtocolPresetResponseDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: Number })
  competitionId!: number;

  @ApiProperty({ type: Number })
  ownerUserId!: number;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: Boolean })
  isShared!: boolean;

  @ApiProperty({ type: ResultProtocolConfigDto })
  configJson!: ResultProtocolConfigDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class CompetitionResponseDto {
  @ApiProperty({ type: Number })
  id!: number;

  @ApiProperty({ type: String })
  name!: string;

  @ApiProperty({ type: String })
  categoriesStr!: string;

  @ApiProperty({ type: String })
  location!: string;

  @ApiProperty({ type: String })
  venue!: string;

  @ApiProperty({ type: Number })
  poolLength!: number;

  @ApiProperty({ type: Number })
  lanes!: number;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dateFrom!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  dateTo!: string | null;

  @ApiProperty({ enum: ['draft', 'active', 'completed'] })
  status!: 'draft' | 'active' | 'completed';

  @ApiProperty({ type: Boolean })
  circularSeeding!: boolean;

  @ApiProperty({ enum: ['SEPARATE', 'COMBINED', 'MIXED'] })
  resultProtocolFormat!: 'SEPARATE' | 'COMBINED' | 'MIXED';

  @ApiPropertyOptional({ type: Number, nullable: true })
  mixedFormatPrimaryAgeGroupId!: number | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  mixedFormatSecondaryAgeGroupIds!: string | null;

  @ApiPropertyOptional({ type: ResultProtocolConfigDto, nullable: true })
  resultProtocolConfigJson!: ResultProtocolConfigDto | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  createdByUserId!: number | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}
