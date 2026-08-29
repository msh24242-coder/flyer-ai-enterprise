import { IsArray, ArrayMinSize, IsUUID } from 'class-validator';

/** `order` is the full list of productIds currently attached to the flyer,
 *  in the desired display order — sortOrder is assigned from array index. */
export class ReorderFlyerProductsDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  order!: string[];
}
