import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthResetPasswordRequest } from 'shared-contracts';

export class ResetUserPasswordDto implements AuthResetPasswordRequest {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(256)
  password!: string;
}
