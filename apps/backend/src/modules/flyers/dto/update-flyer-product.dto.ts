import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateFlyerProductDto {
  @IsNumber()
  @IsOptional()
  @Min(0)
  displayPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  originalPrice?: number;
}
