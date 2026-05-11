import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateEventDto {
  @IsInt()
  @Min(1)
  competitionId!: number;

  @IsInt()
  @Min(1)
  distance!: number;

  @IsString()
  @IsIn(['Freestyle', 'Breaststroke', 'Backstroke', 'Butterfly', 'Medley', 'FREE', 'BREAST', 'BACK', 'FLY', 'MEDLEY'])
  style!: 'Freestyle' | 'Breaststroke' | 'Backstroke' | 'Butterfly' | 'Medley' | 'FREE' | 'BREAST' | 'BACK' | 'FLY' | 'MEDLEY';

  @IsString()
  @IsIn(['M', 'F', 'MIXED'])
  gender!: 'M' | 'F' | 'MIXED';

  @IsOptional()
  @IsBoolean()
  isRelay?: boolean;
}
