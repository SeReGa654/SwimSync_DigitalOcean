import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthChangePasswordRequest } from 'shared-contracts';

export class ChangePasswordDto implements AuthChangePasswordRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  currentPassword!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(256)
  newPassword!: string;
}
