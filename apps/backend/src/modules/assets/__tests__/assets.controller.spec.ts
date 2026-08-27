import { BadRequestException } from '@nestjs/common';
import { AssetsController } from '../assets.controller';
import { AssetsService } from '../assets.service';

const COMPANY_ID = 'co-1';
const USER = { id: 'user-1', email: 'u@acme.com', companyId: COMPANY_ID };

const mockService: jest.Mocked<AssetsService> = {
  list: jest.fn(),
  upload: jest.fn(),
  delete: jest.fn(),
} as never;

describe('AssetsController', () => {
  let controller: AssetsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new AssetsController(mockService);
  });

  it('list delegates to the service', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(COMPANY_ID, USER as never, 'logo');
    expect(mockService.list).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'logo');
  });

  it('upload rejects when no file is provided', async () => {
    await expect(
      controller.upload(COMPANY_ID, USER as never, undefined as never, undefined),
    ).rejects.toThrow(BadRequestException);
    expect(mockService.upload).not.toHaveBeenCalled();
  });

  it('upload parses a comma-separated tags string', async () => {
    const file = { buffer: Buffer.from('x'), mimetype: 'image/png', size: 10, originalname: 'a.png' };
    mockService.upload.mockResolvedValue({ id: 'asset-1' } as never);

    await controller.upload(COMPANY_ID, USER as never, file as never, ' logo, brand ,');

    expect(mockService.upload).toHaveBeenCalledWith(COMPANY_ID, USER.id, file, ['logo', 'brand']);
  });

  it('delete delegates to the service', async () => {
    await controller.delete(COMPANY_ID, 'asset-1', USER as never);
    expect(mockService.delete).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'asset-1');
  });
});
