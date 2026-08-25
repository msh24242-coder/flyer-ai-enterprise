import {
  IsOptional,
  IsUUID,
  IsString,
  MinLength,
  MaxLength,
  IsIn,
} from 'class-validator';

export class RunAgentDto {
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  message: string;

  @IsOptional()
  @IsString()
  @IsIn(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'])
  model?: string;
}
