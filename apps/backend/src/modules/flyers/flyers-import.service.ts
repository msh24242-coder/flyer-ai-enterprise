import { Injectable, BadRequestException } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { ProductsRepository } from '../products/products.repository';
import { FlyerProductsRepository } from './flyer-products.repository';

/** Exact header text the legacy flyerai catalog builder's Excel template
 *  uses — matched case-insensitively, no fuzzy aliasing (matches legacy). */
const TEMPLATE_COLUMNS: Array<{ header: string; key: 'articleNumber' | 'nameAr' | 'nameForeign' | 'oldPrice' | 'currentPrice' | 'imageNumber' }> = [
  { header: 'Article Number', key: 'articleNumber' },
  { header: 'Product Name (Arabic)', key: 'nameAr' },
  { header: 'Product Name (English/foreign)', key: 'nameForeign' },
  { header: 'Old Price', key: 'oldPrice' },
  { header: 'Current Price', key: 'currentPrice' },
  { header: 'Image Number', key: 'imageNumber' },
];

const REQUIRED_KEYS = ['articleNumber', 'currentPrice'] as const;
const MAX_IMPORT_ROWS = 2000;

export interface ImportRowError {
  row: number;
  message: string;
}

export interface ImportResult {
  imported: number;
  errors: ImportRowError[];
}

function cellString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in (value as { text?: string })) {
    return String((value as { text?: string }).text ?? '');
  }
  if (typeof value === 'object' && 'richText' in (value as { richText?: Array<{ text: string }> })) {
    return ((value as { richText: Array<{ text: string }> }).richText ?? []).map((r) => r.text).join('');
  }
  return String(value).trim();
}

function cellNumber(value: ExcelJS.CellValue): number | null {
  if (value == null || value === '') return null;
  const num = typeof value === 'number' ? value : Number(cellString(value));
  return Number.isFinite(num) ? num : NaN;
}

@Injectable()
export class FlyersImportService {
  constructor(
    private readonly productsRepo: ProductsRepository,
    private readonly flyerProductsRepo: FlyerProductsRepository,
  ) {}

  buildTemplateWorkbook(): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Catalog');
    sheet.columns = TEMPLATE_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 24 }));
    return workbook;
  }

  async importFromBuffer(
    companyId: string,
    createdBy: string,
    flyerId: string,
    buffer: Buffer,
  ): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer as never);
    } catch {
      throw new BadRequestException('Could not read the uploaded file as an .xlsx workbook');
    }

    const sheet = workbook.worksheets[0];
    if (!sheet) throw new BadRequestException('The workbook has no worksheets');

    const headerRow = sheet.getRow(1);
    const columnIndex: Partial<Record<string, number>> = {};
    headerRow.eachCell((cell, colNumber) => {
      const header = cellString(cell.value).toLowerCase();
      const match = TEMPLATE_COLUMNS.find((c) => c.header.toLowerCase() === header);
      if (match) columnIndex[match.key] = colNumber;
    });

    const missingRequired = REQUIRED_KEYS.filter((k) => !columnIndex[k]);
    if (missingRequired.length > 0) {
      throw new BadRequestException(
        `Missing required column(s): ${missingRequired.map((k) => TEMPLATE_COLUMNS.find((c) => c.key === k)?.header).join(', ')}`,
      );
    }

    const errors: ImportRowError[] = [];
    const validRows: Array<{
      row: number;
      articleNumber: string;
      nameAr?: string;
      nameForeign?: string;
      oldPrice: number | null;
      currentPrice: number;
    }> = [];
    const seenArticleNumbers = new Set<string>();

    const totalDataRows = sheet.rowCount - 1;
    if (totalDataRows > MAX_IMPORT_ROWS) {
      throw new BadRequestException(`File has ${totalDataRows} rows, exceeding the ${MAX_IMPORT_ROWS}-row import limit`);
    }

    for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
      const row = sheet.getRow(rowNumber);
      const get = (key: (typeof TEMPLATE_COLUMNS)[number]['key']) =>
        columnIndex[key] ? row.getCell(columnIndex[key] as number).value : null;

      const articleNumber = cellString(get('articleNumber'));
      const nameAr = cellString(get('nameAr'));
      const nameForeign = cellString(get('nameForeign'));
      const oldPriceRaw = get('oldPrice');
      const currentPriceRaw = get('currentPrice');

      const isBlankRow = !articleNumber && !nameAr && !nameForeign && oldPriceRaw == null && currentPriceRaw == null;
      if (isBlankRow) continue;

      if (!articleNumber) {
        errors.push({ row: rowNumber, message: 'Missing article number' });
        continue;
      }
      if (seenArticleNumbers.has(articleNumber)) {
        errors.push({ row: rowNumber, message: `Duplicate article number "${articleNumber}" in this file` });
        continue;
      }
      if (!nameAr && !nameForeign) {
        errors.push({ row: rowNumber, message: 'Missing both Arabic and English/foreign name' });
        continue;
      }

      const currentPrice = cellNumber(currentPriceRaw);
      if (currentPrice == null || Number.isNaN(currentPrice) || currentPrice < 0) {
        errors.push({ row: rowNumber, message: 'Current price is missing or invalid' });
        continue;
      }
      const oldPrice = cellNumber(oldPriceRaw);
      if (oldPrice !== null && (Number.isNaN(oldPrice) || oldPrice < 0)) {
        errors.push({ row: rowNumber, message: 'Old price is invalid' });
        continue;
      }

      seenArticleNumbers.add(articleNumber);
      validRows.push({
        row: rowNumber,
        articleNumber,
        nameAr: nameAr || undefined,
        nameForeign: nameForeign || undefined,
        oldPrice,
        currentPrice,
      });
    }

    let imported = 0;
    let nextSortOrder = (await this.flyerProductsRepo.maxSortOrder(flyerId)) + 1;

    for (const row of validRows) {
      let product = await this.productsRepo.findBySku(companyId, row.articleNumber);
      if (!product) {
        // Explicit, visible product creation from a matched import row —
        // never a hidden side effect the user can't see in /products.
        product = await this.productsRepo.create(companyId, createdBy, {
          sku: row.articleNumber,
          name: row.nameForeign || row.nameAr || row.articleNumber,
          nameAr: row.nameAr,
          basePrice: row.currentPrice,
        });
      }

      const existingLink = await this.flyerProductsRepo.findOne(flyerId, product.id);
      if (existingLink) {
        await this.flyerProductsRepo.update(flyerId, product.id, {
          displayPrice: row.currentPrice,
          originalPrice: row.oldPrice ?? undefined,
        });
      } else {
        await this.flyerProductsRepo.add({
          flyerId,
          productId: product.id,
          displayPrice: row.currentPrice,
          originalPrice: row.oldPrice ?? undefined,
          sortOrder: nextSortOrder++,
        });
      }
      imported++;
    }

    return { imported, errors };
  }
}
