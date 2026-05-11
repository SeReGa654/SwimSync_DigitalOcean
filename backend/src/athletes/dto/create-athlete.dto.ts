import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateAthleteDto {
  @IsString()
  lastName!: string;

  @IsString()
  firstName!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYear!: number;

  @IsString()
  club!: string;

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
