import { IsString, IsOptional, MaxLength, IsUrl } from 'class-validator';

export class UpdateCompanyDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  industry?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  website?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  logoUrl?: string;
}
