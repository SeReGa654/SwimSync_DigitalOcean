import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEntryDto {
  @IsOptional()
  @IsInt()
  athleteId?: number | null;

  @IsOptional()
  @IsString()
  teamName?: string | null;

  @IsInt()
  eventId!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  entryTimeMs?: number | null;

  @IsOptional()
  @IsInt()
  ageGroupId?: number | null;

  @IsOptional()
  @IsBoolean()
  doctorApproved?: boolean;
}
