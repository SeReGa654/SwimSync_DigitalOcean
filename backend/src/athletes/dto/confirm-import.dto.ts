import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';

class ParsedAthleteDto {
  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsInt()
  birthYear?: number;

  @IsOptional()
  @IsInt()
  birth_year?: number;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional()
  @IsString()
  currentRank?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsString()
  coach?: string;

  @IsOptional()
  @IsString()
  club?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsBoolean()
  doctorApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  doctor_approved?: boolean;
}

class ParsedEntryDto {
  @IsInt()
  athlete_index!: number;

  @IsInt()
  distance_m!: number;

  @IsString()
  style!: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional()
  @IsInt()
  entry_time_ms?: number | null;

  @IsOptional()
  @IsBoolean()
  is_out_of_competition?: boolean;
}

export class ConfirmImportDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedAthleteDto)
  athletes!: ParsedAthleteDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ParsedEntryDto)
  entries!: ParsedEntryDto[];

  @IsOptional()
  @IsBoolean()
  bulkEditApplied?: boolean;
}
