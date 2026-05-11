import { IsInt, IsString, Max, Min } from 'class-validator';

export class CreateAgeGroupDto {
  @IsString()
  name!: string;

  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYearFrom!: number;

  @IsInt()
  @Min(1900)
  @Max(2100)
  birthYearTo!: number;
}
