import { Injectable, BadRequestException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const ALLOWED_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
]);

const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

export interface StoredFile {
  filename: string;
  storagePath: string;
  publicUrl: string;
}

function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9_-]/g, '');
}

@Injectable()
export class AssetsStorageService {
  private readonly uploadsDir = process.env.UPLOADS_DIR ?? path.join(process.cwd(), 'uploads');
  private readonly backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001';

  validate(file: { mimetype: string; size: number }): void {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Allowed: ${[...ALLOWED_MIME_TYPES].join(', ')}`,
      );
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_FILE_SIZE_BYTES / (1024 * 1024)}MB limit`);
    }
  }

  async save(companyId: string, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<StoredFile> {
    const folder = sanitizeSegment(companyId);
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '');
    const filename = `${randomUUID()}${ext}`;
    const dir = path.join(this.uploadsDir, folder);
    await fs.mkdir(dir, { recursive: true });
    const diskPath = path.join(dir, filename);
    await fs.writeFile(diskPath, file.buffer);

    return {
      filename,
      storagePath: diskPath,
      // UploadsController sits behind the app's global 'api/v1' prefix
      // (set in main.ts) like every other controller — keep this in sync.
      publicUrl: `${this.backendUrl}/api/v1/uploads/${folder}/${filename}`,
    };
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await fs.unlink(storagePath);
    } catch {
      // File already gone — deleting the DB record still succeeds.
    }
  }

  resolveForServing(companyId: string, filename: string): string | null {
    const folder = sanitizeSegment(companyId);
    const safeFilename = sanitizeSegment(path.parse(filename).name) + path.extname(filename).toLowerCase().replace(/[^a-z0-9.]/g, '');
    if (!folder || !safeFilename) return null;
    return path.join(this.uploadsDir, folder, safeFilename);
  }
}
