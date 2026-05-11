import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateAthleteDto {
  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear?: number;

  @IsOptional()
  @IsString()
  club?: string;

  @IsOptional()
  @IsIn(['M', 'F'])
  gender?: 'M' | 'F';

  @IsOptional()
  @IsString()
  currentRank?: string;

  @IsOptional()
  @IsString()
  coach?: string;

  @IsOptional()
  @IsString()
  region?: string;
}
