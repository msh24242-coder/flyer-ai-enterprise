import { InternalServerErrorException } from '@nestjs/common';

const mockAccess = jest.fn();
jest.mock('node:fs/promises', () => ({ access: (...args: unknown[]) => mockAccess(...args) }));

const mockPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4'));
const mockSetContent = jest.fn();
const mockNewPage = jest.fn().mockResolvedValue({ setContent: mockSetContent, pdf: mockPdf });
const mockClose = jest.fn();
const mockLaunch = jest.fn().mockResolvedValue({ newPage: mockNewPage, close: mockClose });
jest.mock('puppeteer-core', () => ({ launch: (...args: unknown[]) => mockLaunch(...args) }));

import { FlyersExportService } from '../flyers-export.service';

describe('FlyersExportService', () => {
  const originalEnv = process.env.PUPPETEER_EXECUTABLE_PATH;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  });

  afterAll(() => {
    if (originalEnv) process.env.PUPPETEER_EXECUTABLE_PATH = originalEnv;
  });

  it('uses PUPPETEER_EXECUTABLE_PATH when set, without probing the filesystem', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chromium';
    const service = new FlyersExportService();

    const pdf = await service.renderPdf('<html></html>');

    expect(mockAccess).not.toHaveBeenCalled();
    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: '/custom/chromium' }));
    expect(pdf).toBeInstanceOf(Buffer);
  });

  it('falls back to probing known Alpine Chromium paths when no env var is set', async () => {
    mockAccess.mockImplementation((path: string) => {
      if (path === '/usr/bin/chromium-browser') throw new Error('ENOENT');
      return Promise.resolve();
    });
    const service = new FlyersExportService();

    await service.renderPdf('<html></html>');

    expect(mockLaunch).toHaveBeenCalledWith(expect.objectContaining({ executablePath: '/usr/bin/chromium' }));
  });

  it('throws a clear error when no Chromium executable can be found', async () => {
    mockAccess.mockRejectedValue(new Error('ENOENT'));
    const service = new FlyersExportService();

    await expect(service.renderPdf('<html></html>')).rejects.toThrow(InternalServerErrorException);
    expect(mockLaunch).not.toHaveBeenCalled();
  });

  it('always closes the browser, even if PDF rendering throws', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chromium';
    mockPdf.mockRejectedValueOnce(new Error('render failed'));
    const service = new FlyersExportService();

    await expect(service.renderPdf('<html></html>')).rejects.toThrow('render failed');
    expect(mockClose).toHaveBeenCalled();
  });

  it('renders with print background enabled and CSS page size honored', async () => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/custom/chromium';
    const service = new FlyersExportService();

    await service.renderPdf('<html>hi</html>');

    expect(mockSetContent).toHaveBeenCalledWith('<html>hi</html>', expect.objectContaining({ waitUntil: 'load' }));
    expect(mockPdf).toHaveBeenCalledWith(expect.objectContaining({ printBackground: true, preferCSSPageSize: true }));
  });
});
