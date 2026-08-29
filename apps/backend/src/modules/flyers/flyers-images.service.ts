import { Injectable } from '@nestjs/common';
import { AssetsStorageService } from '../assets/assets.storage.service';
import { ProductsRepository } from '../products/products.repository';

export interface ImageMatchFile {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

export interface ImageMatchResult {
  matched: string[];
  unmatched: string[];
}

/** Legacy flyerai matches an uploaded image to a catalog row by exact
 *  filename-stem === article-number equality — reproduced here, matching
 *  against this company's real Product.sku instead of a flat JSON row. */
function stem(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return (idx === -1 ? filename : filename.slice(0, idx)).trim();
}

@Injectable()
export class FlyersImagesService {
  constructor(
    private readonly storage: AssetsStorageService,
    private readonly productsRepo: ProductsRepository,
  ) {}

  async matchAndStore(companyId: string, files: ImageMatchFile[]): Promise<ImageMatchResult> {
    const matched: string[] = [];
    const unmatched: string[] = [];

    for (const file of files) {
      const sku = stem(file.originalname);
      const product = sku ? await this.productsRepo.findBySku(companyId, sku) : null;
      if (!product) {
        unmatched.push(file.originalname);
        continue;
      }

      this.storage.validate(file);
      const stored = await this.storage.save(companyId, file);
      await this.productsRepo.update(companyId, product.id, { imageUrl: stored.publicUrl });
      matched.push(sku);
    }

    return { matched, unmatched };
  }
}
