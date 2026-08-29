import * as ExcelJS from 'exceljs';
import { FlyersImportService } from '../flyers-import.service';
import { ProductsRepository } from '../../products/products.repository';
import { FlyerProductsRepository } from '../flyer-products.repository';

const COMPANY_ID = 'co-1';
const USER_ID = 'user-1';
const FLYER_ID = 'flyer-1';

const HEADERS = ['Article Number', 'Product Name (Arabic)', 'Product Name (English/foreign)', 'Old Price', 'Current Price', 'Image Number'];

async function buildWorkbookBuffer(rows: Array<Array<string | number | null>>, headers: string[] = HEADERS): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Catalog');
  sheet.addRow(headers);
  for (const row of rows) sheet.addRow(row);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

describe('FlyersImportService', () => {
  let mockProductsRepo: jest.Mocked<Partial<ProductsRepository>>;
  let mockFlyerProductsRepo: jest.Mocked<Partial<FlyerProductsRepository>>;
  let service: FlyersImportService;

  beforeEach(() => {
    mockProductsRepo = {
      findBySku: jest.fn(),
      create: jest.fn(),
    };
    mockFlyerProductsRepo = {
      maxSortOrder: jest.fn().mockResolvedValue(-1),
      findOne: jest.fn().mockResolvedValue(null),
      add: jest.fn(),
      update: jest.fn(),
    };
    service = new FlyersImportService(mockProductsRepo as never, mockFlyerProductsRepo as never);
  });

  it('creates a new Product and attaches it to the flyer for an unmatched SKU', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue(null);
    (mockProductsRepo.create as jest.Mock).mockResolvedValue({ id: 'prod-1', sku: 'ABC' });

    const buffer = await buildWorkbookBuffer([['ABC', 'اسم', 'Name', 12.99, 9.99, 'ABC']]);
    const result = await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);

    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
    expect(mockProductsRepo.create).toHaveBeenCalledWith(
      COMPANY_ID,
      USER_ID,
      expect.objectContaining({ sku: 'ABC', name: 'Name', nameAr: 'اسم', basePrice: 9.99 }),
    );
    expect(mockFlyerProductsRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({ flyerId: FLYER_ID, productId: 'prod-1', displayPrice: 9.99, originalPrice: 12.99 }),
    );
  });

  it('links to an existing Product by SKU without modifying its master data', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue({ id: 'prod-existing', sku: 'ABC', name: 'Old Name', basePrice: 99 });

    const buffer = await buildWorkbookBuffer([['ABC', 'اسم', 'Different Name From Import', 20, 15, 'ABC']]);
    await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);

    expect(mockProductsRepo.create).not.toHaveBeenCalled();
    expect(mockFlyerProductsRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod-existing', displayPrice: 15, originalPrice: 20 }),
    );
  });

  it('updates the existing FlyerProduct link instead of duplicating it on re-import', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue({ id: 'prod-existing', sku: 'ABC' });
    (mockFlyerProductsRepo.findOne as jest.Mock).mockResolvedValue({ id: 'fp-1', flyerId: FLYER_ID, productId: 'prod-existing' });

    const buffer = await buildWorkbookBuffer([['ABC', 'اسم', 'Name', 20, 15, 'ABC']]);
    await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);

    expect(mockFlyerProductsRepo.add).not.toHaveBeenCalled();
    expect(mockFlyerProductsRepo.update).toHaveBeenCalledWith(FLYER_ID, 'prod-existing', { displayPrice: 15, originalPrice: 20 });
  });

  it('rejects the whole file when a required column is missing', async () => {
    const buffer = await buildWorkbookBuffer([['ABC', 'اسم', 'Name', 20, 15, 'ABC']], ['Article Number', 'Product Name (Arabic)', 'Product Name (English/foreign)', 'Old Price', 'Image Number']);
    await expect(service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer)).rejects.toThrow(/Missing required column/);
  });

  it('reports a row-level error for a missing article number without failing the whole import', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue(null);
    (mockProductsRepo.create as jest.Mock).mockResolvedValue({ id: 'prod-1', sku: 'ABC' });

    const buffer = await buildWorkbookBuffer([
      ['', 'اسم', 'Name', 20, 15, ''],
      ['ABC', 'اسم', 'Name', 20, 15, 'ABC'],
    ]);
    const result = await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);

    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([{ row: 2, message: 'Missing article number' }]);
  });

  it('reports a row-level error for a duplicate article number within the same file', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue(null);
    (mockProductsRepo.create as jest.Mock).mockResolvedValue({ id: 'prod-1', sku: 'ABC' });

    const buffer = await buildWorkbookBuffer([
      ['ABC', 'اسم', 'Name', 20, 15, 'ABC'],
      ['ABC', 'اسم2', 'Name2', 20, 15, 'ABC'],
    ]);
    const result = await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);

    expect(result.imported).toBe(1);
    expect(result.errors).toEqual([{ row: 3, message: 'Duplicate article number "ABC" in this file' }]);
  });

  it('reports a row-level error for an invalid current price', async () => {
    const buffer = await buildWorkbookBuffer([['ABC', 'اسم', 'Name', 20, -5, 'ABC']]);
    const result = await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);
    expect(result.imported).toBe(0);
    expect(result.errors).toEqual([{ row: 2, message: 'Current price is missing or invalid' }]);
  });

  it('skips fully blank rows silently', async () => {
    (mockProductsRepo.findBySku as jest.Mock).mockResolvedValue(null);
    (mockProductsRepo.create as jest.Mock).mockResolvedValue({ id: 'prod-1', sku: 'ABC' });

    const buffer = await buildWorkbookBuffer([
      [null, null, null, null, null, null],
      ['ABC', 'اسم', 'Name', 20, 15, 'ABC'],
    ]);
    const result = await service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, buffer);
    expect(result.imported).toBe(1);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a file that cannot be read as an xlsx workbook', async () => {
    await expect(service.importFromBuffer(COMPANY_ID, USER_ID, FLYER_ID, Buffer.from('not an xlsx'))).rejects.toThrow(
      /Could not read/,
    );
  });
});
