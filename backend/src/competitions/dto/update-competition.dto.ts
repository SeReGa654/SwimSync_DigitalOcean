import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateCompetitionDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  categoriesStr?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(50)
  poolLength?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  lanes?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @IsOptional()
  @IsIn(['draft', 'active', 'completed'])
  status?: 'draft' | 'active' | 'completed';

  @IsOptional()
  @IsBoolean()
  circularSeeding?: boolean;
}
