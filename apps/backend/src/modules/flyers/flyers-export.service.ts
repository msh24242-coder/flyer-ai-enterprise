import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Browser } from 'puppeteer-core';

/** Candidate paths for the system Chromium the production image installs
 *  via `apk add chromium` — checked in order since the exact binary name
 *  has varied across Alpine releases. */
const CHROMIUM_CANDIDATES = ['/usr/bin/chromium-browser', '/usr/bin/chromium'];

@Injectable()
export class FlyersExportService {
  private executablePath: string | null | undefined; // undefined = not resolved yet

  private async resolveExecutablePath(): Promise<string> {
    if (this.executablePath) return this.executablePath;
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      this.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      return this.executablePath;
    }
    const { access } = await import('node:fs/promises');
    for (const candidate of CHROMIUM_CANDIDATES) {
      try {
        await access(candidate);
        this.executablePath = candidate;
        return candidate;
      } catch {
        // try next candidate
      }
    }
    throw new InternalServerErrorException(
      'No Chromium executable found for PDF export. Set PUPPETEER_EXECUTABLE_PATH or install the "chromium" package.',
    );
  }

  async renderPdf(html: string): Promise<Buffer> {
    const executablePath = await this.resolveExecutablePath();
    const puppeteer = await import('puppeteer-core');

    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'load' });
      const pdf = await page.pdf({ printBackground: true, preferCSSPageSize: true });
      return Buffer.from(pdf);
    } finally {
      await browser?.close();
    }
  }
}
