import { IsString, IsOptional, IsUUID, IsObject, IsUrl, MaxLength } from 'class-validator';
import type { FlyerDesignData } from '../flyers.types';

export class CreateFlyerDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @IsObject()
  @IsOptional()
  designData?: FlyerDesignData;

  @IsUrl({ require_tld: false })
  @IsOptional()
  @MaxLength(2000)
  thumbnail?: string;
}
