import { IsUUID, IsNumber, IsOptional, IsInt, Min } from 'class-validator';

export class AddFlyerProductDto {
  @IsUUID()
  productId!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  displayPrice?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  originalPrice?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  sortOrder?: number;
}
