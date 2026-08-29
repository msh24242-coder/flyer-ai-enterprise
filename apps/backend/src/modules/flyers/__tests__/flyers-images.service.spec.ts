import { FlyersImagesService } from '../flyers-images.service';
import { AssetsStorageService } from '../../assets/assets.storage.service';
import { ProductsRepository } from '../../products/products.repository';

const COMPANY_ID = 'co-1';

describe('FlyersImagesService', () => {
  let mockStorage: jest.Mocked<Partial<AssetsStorageService>>;
  let mockProductsRepo: jest.Mocked<Partial<ProductsRepository>>;
  let service: FlyersImagesService;

  beforeEach(() => {
    mockStorage = {
      validate: jest.fn(),
      save: jest.fn().mockResolvedValue({ filename: 'x.png', storagePath: '/tmp/x.png', publicUrl: 'https://backend.test/api/v1/uploads/co-1/x.png' }),
    };
    mockProductsRepo = {
      findBySku: jest.fn(),
      update: jest.fn(),
    };
    service = new FlyersImagesService(mockStorage as never, mockProductsRepo as never);
  });

  it('matches a file to a product by exact filename-stem === SKU and sets Product.imageUrl', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue({ id: 'prod-1', sku: 'ABC-123' });

    const file = { buffer: Buffer.from(''), mimetype: 'image/png', size: 10, originalname: 'ABC-123.png' };
    const result = await service.matchAndStore(COMPANY_ID, [file]);

    expect(result.matched).toEqual(['ABC-123']);
    expect(result.unmatched).toEqual([]);
    expect(mockProductsRepo.update).toHaveBeenCalledWith(COMPANY_ID, 'prod-1', {
      imageUrl: 'https://backend.test/api/v1/uploads/co-1/x.png',
    });
  });

  it('reports a file as unmatched when no product has a matching SKU, without touching any product', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue(null);

    const file = { buffer: Buffer.from(''), mimetype: 'image/png', size: 10, originalname: 'NOPE.png' };
    const result = await service.matchAndStore(COMPANY_ID, [file]);

    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual(['NOPE.png']);
    expect(mockStorage.save).not.toHaveBeenCalled();
    expect(mockProductsRepo.update).not.toHaveBeenCalled();
  });

  it('processes a batch of files independently, matching some and reporting others as unmatched', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockImplementation((_companyId: string, sku: string) =>
      Promise.resolve(sku === 'A' ? { id: 'prod-a', sku: 'A' } : null),
    );

    const files = [
      { buffer: Buffer.from(''), mimetype: 'image/png', size: 10, originalname: 'A.png' },
      { buffer: Buffer.from(''), mimetype: 'image/png', size: 10, originalname: 'B.png' },
    ];
    const result = await service.matchAndStore(COMPANY_ID, files);

    expect(result.matched).toEqual(['A']);
    expect(result.unmatched).toEqual(['B.png']);
  });
});
