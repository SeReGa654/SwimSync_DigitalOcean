import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEntryDto {
  @IsOptional()
  @IsInt()
  athleteId?: number | null;

  @IsOptional()
  @IsString()
  teamName?: string | null;

  @IsOptional()
  @IsInt()
  eventId?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  entryTimeMs?: number | null;

  @IsOptional()
  @IsInt()
  heatNumber?: number | null;

  @IsOptional()
  @IsInt()
  laneNumber?: number | null;

  @IsOptional()
  @IsInt()
  ageGroupId?: number | null;

  @IsOptional()
  @IsBoolean()
  doctorApproved?: boolean;

  @IsOptional()
  @IsBoolean()
  isOutOfCompetition?: boolean;

  @IsOptional()
  @IsIn(['IN', 'PK', 'DQ', 'DNS', 'DNF'])
  status?: 'IN' | 'PK' | 'DQ' | 'DNS' | 'DNF';
}
