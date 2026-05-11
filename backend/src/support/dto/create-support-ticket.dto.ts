import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { SupportTicketCreateRequest } from 'shared-contracts';

export class CreateSupportTicketDto implements SupportTicketCreateRequest {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  page?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  userAgent?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  requestId?: string;
}
