import { Type } from 'class-transformer';
import { IsBoolean, IsDate, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateCompetitionDto {
  @IsString()
  name!: string;

  @IsString()
  location!: string;

  @IsInt()
  @IsIn([25, 50])
  poolLength!: number;

  @IsInt()
  @Min(1)
  @Max(20)
  lanes!: number;

  @IsOptional()
  @IsString()
  categoriesStr?: string;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateFrom?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  dateTo?: Date;

  @IsOptional()
  @IsBoolean()
  circularSeeding?: boolean;
}
