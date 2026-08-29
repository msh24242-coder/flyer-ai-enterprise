import { IsString, IsOptional, IsUUID, IsObject, IsUrl, MaxLength, ValidateIf } from 'class-validator';
import type { FlyerDesignData } from '../flyers.types';

export class UpdateFlyerDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsObject()
  @IsOptional()
  designData?: FlyerDesignData;

  @ValidateIf((_, value) => value !== null)
  @IsUrl({ require_tld: false })
  @MaxLength(2000)
  @IsOptional()
  thumbnail?: string | null;

  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  @IsOptional()
  campaignId?: string | null;
}
