import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export type ProtocolRuleField = 'ageGroupId' | 'region' | 'club' | 'gender';
export type ProtocolRuleOperator = 'EQ' | 'IN' | 'CONTAINS';
export type ProtocolLogicalOperator = 'AND' | 'OR';

class ResultProtocolConditionDto {
  @ApiProperty({ enum: ['ageGroupId', 'region', 'club', 'gender'] })
  @IsIn(['ageGroupId', 'region', 'club', 'gender'])
  field!: ProtocolRuleField;

  @ApiProperty({ enum: ['EQ', 'IN', 'CONTAINS'] })
  @IsIn(['EQ', 'IN', 'CONTAINS'])
  operator!: ProtocolRuleOperator;

  @ApiProperty({
    description: 'Condition value. For IN use array, for EQ/CONTAINS use scalar.',
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'array', items: { type: 'string' } }, { type: 'array', items: { type: 'number' } }],
  })
  @IsDefined()
  value!: unknown;
}

class ResultProtocolConditionBlockDto {
  @ApiProperty({ enum: ['AND', 'OR'] })
  @IsIn(['AND', 'OR'])
  operator!: ProtocolLogicalOperator;

  @ApiProperty({ type: [ResultProtocolConditionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultProtocolConditionDto)
  conditions!: ResultProtocolConditionDto[];
}

class ResultProtocolRuleGroupDto extends ResultProtocolConditionBlockDto {
  @ApiProperty({ type: String })
  @IsString()
  name!: string;

  @ApiProperty({ type: [ResultProtocolConditionBlockDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultProtocolConditionBlockDto)
  subgroups?: ResultProtocolConditionBlockDto[];
}

class ResultProtocolAdvancedGroupingDto {
  @ApiProperty({ type: Boolean, default: false })
  @IsBoolean()
  enabled!: boolean;

  @ApiProperty({ type: [ResultProtocolRuleGroupDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ResultProtocolRuleGroupDto)
  groups!: ResultProtocolRuleGroupDto[];

  @ApiProperty({ type: Boolean, default: true })
  @IsBoolean()
  includeUnmatched!: boolean;

  @ApiProperty({ type: String, required: false, default: 'Інші' })
  @IsOptional()
  @IsString()
  unmatchedGroupName?: string;
}

export class ResultProtocolConfigDto {
  @ApiProperty({
    enum: ['SEPARATE', 'COMBINED', 'MIXED'],
    description: 'Result protocol format',
  })
  @IsIn(['SEPARATE', 'COMBINED', 'MIXED'])
  format!: 'SEPARATE' | 'COMBINED' | 'MIXED';

  @ApiProperty({
    type: 'number',
    required: false,
    nullable: true,
    description: 'Primary age group ID for MIXED format',
  })
  @IsOptional()
  @IsInt()
  mixedFormatPrimaryAgeGroupId?: number | null;

  @ApiProperty({
    type: [Number],
    required: false,
    description: 'Secondary age group IDs for MIXED format',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  mixedFormatSecondaryAgeGroupIds?: number[];

  @ApiProperty({
    type: ResultProtocolAdvancedGroupingDto,
    required: false,
    nullable: true,
    description: 'Advanced custom grouping config (rules with AND/OR blocks, max 2 levels)',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => ResultProtocolAdvancedGroupingDto)
  advancedGrouping?: ResultProtocolAdvancedGroupingDto | null;
}
