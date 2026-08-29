import { NotFoundException } from '@nestjs/common';
import { UploadsController } from '../uploads.controller';
import { AssetsStorageService } from '../assets.storage.service';

jest.mock('node:fs', () => ({ existsSync: jest.fn() }));
import { existsSync } from 'node:fs';

function mockResponse() {
  return { setHeader: jest.fn(), sendFile: jest.fn() } as never as import('express').Response;
}

describe('UploadsController', () => {
  let mockStorage: jest.Mocked<Partial<AssetsStorageService>>;
  let controller: UploadsController;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = { resolveForServing: jest.fn() };
    controller = new UploadsController(mockStorage as never);
  });

  it('serves the file with a cross-origin CORP header so it can be embedded from the frontend origin', async () => {
    (mockStorage.resolveForServing as jest.Mock).mockReturnValue('/uploads/co-1/file.png');
    (existsSync as jest.Mock).mockReturnValue(true);
    const res = mockResponse();

    await controller.serve('co-1', 'file.png', res);

    expect(res.setHeader).toHaveBeenCalledWith('Cross-Origin-Resource-Policy', 'cross-origin');
    expect(res.sendFile).toHaveBeenCalledWith('/uploads/co-1/file.png');
  });

  it('404s when the resolved path does not exist on disk', async () => {
    (mockStorage.resolveForServing as jest.Mock).mockReturnValue('/uploads/co-1/missing.png');
    (existsSync as jest.Mock).mockReturnValue(false);

    await expect(controller.serve('co-1', 'missing.png', mockResponse())).rejects.toThrow(NotFoundException);
  });

  it('404s when the storage service rejects the path (e.g. traversal attempt)', async () => {
    (mockStorage.resolveForServing as jest.Mock).mockReturnValue(null);

    await expect(controller.serve('co-1', '../../etc/passwd', mockResponse())).rejects.toThrow(NotFoundException);
  });
});
