import { IsIn, IsInt, IsString, Min } from 'class-validator';

export class CreateUaSportRankDto {
  @IsInt()
  @IsIn([25, 50])
  poolLength!: number;

  @IsString()
  @IsIn(['M', 'F', 'X'])
  gender!: string;

  @IsInt()
  @Min(1)
  distance!: number;

  @IsString()
  style!: string;

  @IsString()
  rank!: string;

  @IsInt()
  @Min(1)
  normTimeMs!: number;
}
