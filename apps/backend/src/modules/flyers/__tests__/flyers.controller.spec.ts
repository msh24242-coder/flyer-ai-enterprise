import { BadRequestException } from '@nestjs/common';
import { FlyersController } from '../flyers.controller';
import { FlyersService } from '../flyers.service';
import { FlyersImportService } from '../flyers-import.service';
import { FlyerStatus } from '@prisma/client';

const COMPANY_ID = 'co-1';
const USER = { id: 'user-1', email: 'u@acme.com', companyId: COMPANY_ID };

const mockService: jest.Mocked<FlyersService> = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  duplicate: jest.fn(),
  archive: jest.fn(),
  unarchive: jest.fn(),
  addProduct: jest.fn(),
  updateProduct: jest.fn(),
  removeProduct: jest.fn(),
  reorderProducts: jest.fn(),
  importExcel: jest.fn(),
  uploadImages: jest.fn(),
  renderHtml: jest.fn(),
  exportPdf: jest.fn(),
} as never;

const mockImportService: Partial<jest.Mocked<FlyersImportService>> = {
  buildTemplateWorkbook: jest.fn(),
};

function mockResponse() {
  return {
    setHeader: jest.fn(),
    send: jest.fn(),
    end: jest.fn(),
  } as never as import('express').Response;
}

describe('FlyersController', () => {
  let controller: FlyersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FlyersController(mockService, mockImportService as never);
  });

  it('list passes query filters and the requester id', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(USER as never, FlyerStatus.DRAFT, 'camp-1');
    expect(mockService.list).toHaveBeenCalledWith(COMPANY_ID, USER.id, { status: FlyerStatus.DRAFT, campaignId: 'camp-1' });
  });

  it('create delegates to the service', async () => {
    const dto = { title: 'Weekly Offers' };
    mockService.create.mockResolvedValue({ id: 'flyer-1', ...dto } as never);
    const result = await controller.create(USER as never, dto as never);
    expect(mockService.create).toHaveBeenCalledWith(COMPANY_ID, USER.id, dto);
    expect(result).toEqual({ id: 'flyer-1', ...dto });
  });

  it('getById delegates to the service', async () => {
    mockService.getById.mockResolvedValue({ id: 'flyer-1' } as never);
    await controller.getById('flyer-1', USER as never);
    expect(mockService.getById).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('update delegates to the service', async () => {
    const dto = { title: 'New' };
    await controller.update('flyer-1', dto as never, USER as never);
    expect(mockService.update).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto);
  });

  it('delete delegates to the service', async () => {
    await controller.delete('flyer-1', USER as never);
    expect(mockService.delete).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('duplicate delegates to the service', async () => {
    mockService.duplicate.mockResolvedValue({ id: 'flyer-2' } as never);
    await controller.duplicate('flyer-1', USER as never);
    expect(mockService.duplicate).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('archive delegates to the service', async () => {
    mockService.archive.mockResolvedValue({ id: 'flyer-1', status: 'ARCHIVED' } as never);
    const result = await controller.archive('flyer-1', USER as never);
    expect(mockService.archive).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
    expect(result).toEqual({ id: 'flyer-1', status: 'ARCHIVED' });
  });

  it('unarchive delegates to the service', async () => {
    mockService.unarchive.mockResolvedValue({ id: 'flyer-1', status: 'DRAFT' } as never);
    const result = await controller.unarchive('flyer-1', USER as never);
    expect(mockService.unarchive).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
    expect(result).toEqual({ id: 'flyer-1', status: 'DRAFT' });
  });

  it('addProduct delegates to the service', async () => {
    const dto = { productId: 'prod-1' };
    await controller.addProduct('flyer-1', dto as never, USER as never);
    expect(mockService.addProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto);
  });

  it('updateProduct delegates to the service', async () => {
    const dto = { displayPrice: 5 };
    await controller.updateProduct('flyer-1', 'prod-1', dto as never, USER as never);
    expect(mockService.updateProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', 'prod-1', dto);
  });

  it('removeProduct delegates to the service', async () => {
    await controller.removeProduct('flyer-1', 'prod-1', USER as never);
    expect(mockService.removeProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', 'prod-1');
  });

  it('reorderProducts delegates to the service', async () => {
    const dto = { order: ['prod-b', 'prod-a'] };
    await controller.reorderProducts('flyer-1', dto as never, USER as never);
    expect(mockService.reorderProducts).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto.order);
  });

  it('importExcel rejects a missing file', async () => {
    await expect(controller.importExcel('flyer-1', USER as never, undefined as never)).rejects.toThrow(BadRequestException);
  });

  it('importExcel rejects a non-.xlsx filename', async () => {
    const file = { originalname: 'catalog.csv', size: 10, buffer: Buffer.from('x') } as Express.Multer.File;
    await expect(controller.importExcel('flyer-1', USER as never, file)).rejects.toThrow(BadRequestException);
  });

  it('importExcel delegates to the service for a valid .xlsx file', async () => {
    const file = { originalname: 'catalog.xlsx', size: 10, buffer: Buffer.from('x') } as Express.Multer.File;
    mockService.importExcel.mockResolvedValue({ imported: 1, errors: [] });
    const result = await controller.importExcel('flyer-1', USER as never, file);
    expect(mockService.importExcel).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', file.buffer);
    expect(result).toEqual({ imported: 1, errors: [] });
  });

  it('uploadImages rejects an empty file list', async () => {
    await expect(controller.uploadImages('flyer-1', USER as never, [])).rejects.toThrow(BadRequestException);
  });

  it('uploadImages delegates to the service', async () => {
    const files = [{ originalname: 'SKU-1.png', size: 10 } as Express.Multer.File];
    mockService.uploadImages.mockResolvedValue({ matched: ['SKU-1'], unmatched: [] });
    const result = await controller.uploadImages('flyer-1', USER as never, files);
    expect(mockService.uploadImages).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', files);
    expect(result).toEqual({ matched: ['SKU-1'], unmatched: [] });
  });

  it('preview writes the rendered HTML to the response', async () => {
    mockService.renderHtml.mockResolvedValue('<html></html>');
    const res = mockResponse();
    await controller.preview('flyer-1', USER as never, res);
    expect(mockService.renderHtml).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
    expect(res.send).toHaveBeenCalledWith('<html></html>');
  });

  it('exportPdf writes the PDF buffer to the response with the right headers', async () => {
    const pdf = Buffer.from('%PDF-1.4');
    mockService.exportPdf.mockResolvedValue(pdf);
    const res = mockResponse();
    await controller.exportPdf('flyer-1', USER as never, res);
    expect(mockService.exportPdf).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.send).toHaveBeenCalledWith(pdf);
  });
});
