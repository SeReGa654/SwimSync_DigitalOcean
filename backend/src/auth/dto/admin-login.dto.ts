import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { AuthLoginRequest } from 'shared-contracts';

export class AdminLoginDto implements AuthLoginRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}

