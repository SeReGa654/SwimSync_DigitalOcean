import { IsIn, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import type { AuthRegisterRequest, AuthRole } from 'shared-contracts';

export class RegisterUserDto implements AuthRegisterRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  username!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(256)
  password!: string;

  @IsString()
  @IsIn(['admin', 'secretary'])
  role!: AuthRole;
}
