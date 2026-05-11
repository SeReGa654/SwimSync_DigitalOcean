import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateUaSportRankDto {
  @IsOptional()
  @IsInt()
  @IsIn([25, 50])
  poolLength?: number;

  @IsOptional()
  @IsString()
  @IsIn(['M', 'F', 'X'])
  gender?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  distance?: number;

  @IsOptional()
  @IsString()
  style?: string;

  @IsOptional()
  @IsString()
  rank?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  normTimeMs?: number;
}
