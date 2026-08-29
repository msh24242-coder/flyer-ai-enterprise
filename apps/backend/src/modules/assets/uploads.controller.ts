import { Controller, Get, Param, Res, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { existsSync } from 'node:fs';
import { AssetsStorageService } from './assets.storage.service';

/**
 * Intentionally unauthenticated: uploaded assets (logos, product images) are
 * meant to be embeddable directly in exported flyers/marketing materials,
 * the same way a CDN-hosted image would be. Access is still scoped to a
 * random UUID filename under a sanitized company folder — nothing is
 * enumerable or guessable.
 */
@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: AssetsStorageService) {}

  @Get(':companyId/:filename')
  async serve(
    @Param('companyId') companyId: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const diskPath = this.storage.resolveForServing(companyId, filename);
    if (!diskPath || !existsSync(diskPath)) {
      throw new NotFoundException('Asset not found');
    }
    // Helmet's default Cross-Origin-Resource-Policy is same-origin, which
    // blocks exactly the cross-origin <img>/PDF-render embedding this
    // endpoint exists for (frontend on a different origin, and headless
    // Chromium loading images while rendering a flyer PDF/preview).
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.sendFile(diskPath);
  }
}
