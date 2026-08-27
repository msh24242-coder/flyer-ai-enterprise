import { BadRequestException } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { AssetsStorageService } from '../assets.storage.service';

describe('AssetsStorageService', () => {
  let tmpDir: string;
  let service: AssetsStorageService;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sh-marketing-assets-test-'));
    process.env.UPLOADS_DIR = tmpDir;
    process.env.BACKEND_URL = 'http://backend.test';
    service = new AssetsStorageService();
  });

  afterEach(async () => {
    delete process.env.UPLOADS_DIR;
    delete process.env.BACKEND_URL;
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe('validate', () => {
    it('accepts an allowed image type under the size limit', () => {
      expect(() => service.validate({ mimetype: 'image/png', size: 1024 })).not.toThrow();
    });

    it('rejects a disallowed MIME type', () => {
      expect(() => service.validate({ mimetype: 'application/x-msdownload', size: 1024 })).toThrow(
        BadRequestException,
      );
    });

    it('rejects a file over the 15MB limit', () => {
      expect(() => service.validate({ mimetype: 'image/png', size: 16 * 1024 * 1024 })).toThrow(
        BadRequestException,
      );
    });
  });

  describe('save', () => {
    it('writes the file under a sanitized company folder with a UUID filename', async () => {
      const result = await service.save('company-abc', {
        buffer: Buffer.from('fake-image-bytes'),
        mimetype: 'image/png',
        originalname: 'logo.png',
      });

      expect(result.filename).toMatch(/^[0-9a-f-]{36}\.png$/);
      expect(result.publicUrl).toBe(`http://backend.test/api/v1/uploads/company-abc/${result.filename}`);
      const written = await fs.readFile(path.join(tmpDir, 'company-abc', result.filename), 'utf8');
      expect(written).toBe('fake-image-bytes');
    });

    it('sanitizes a companyId containing path-traversal characters', async () => {
      const result = await service.save('../../etc', {
        buffer: Buffer.from('x'),
        mimetype: 'image/png',
        originalname: 'a.png',
      });
      expect(result.storagePath).not.toContain('..');
      expect(result.storagePath.startsWith(tmpDir)).toBe(true);
    });
  });

  describe('resolveForServing', () => {
    it('resolves a normal companyId/filename pair inside the uploads dir', () => {
      const resolved = service.resolveForServing('company-abc', 'photo.png');
      expect(resolved).toBe(path.join(tmpDir, 'company-abc', 'photo.png'));
    });

    it('strips path-traversal attempts from both segments', () => {
      const resolved = service.resolveForServing('../../etc', '../../../etc/passwd');
      expect(resolved).not.toBeNull();
      expect(resolved).not.toContain('..');
      expect(resolved!.startsWith(tmpDir)).toBe(true);
    });

    it('returns null when sanitization empties both segments', () => {
      expect(service.resolveForServing('../..', '..')).toBeNull();
    });
  });

  describe('delete', () => {
    it('does not throw when the file is already missing', async () => {
      await expect(service.delete(path.join(tmpDir, 'missing.png'))).resolves.toBeUndefined();
    });
  });
});
