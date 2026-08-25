import { IsString, IsNotEmpty, MaxLength, IsObject } from 'class-validator';

export class CreateKnowledgeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  category: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  key: string;

  @IsObject()
  value: Record<string, unknown>;
}

export class UpdateKnowledgeDto {
  @IsObject()
  value: Record<string, unknown>;
}
