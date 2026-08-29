import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FlyerStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { FlyersService } from './flyers.service';
import { FlyerListItem, FlyerDetail } from './flyers.repository';
import { CreateFlyerDto } from './dto/create-flyer.dto';
import { UpdateFlyerDto } from './dto/update-flyer.dto';
import { AddFlyerProductDto } from './dto/add-flyer-product.dto';
import { UpdateFlyerProductDto } from './dto/update-flyer-product.dto';
import { ReorderFlyerProductsDto } from './dto/reorder-flyer-products.dto';
import { ImportResult } from './flyers-import.service';
import { ImageMatchResult } from './flyers-images.service';
import { FlyersImportService } from './flyers-import.service';

const MAX_IMPORT_FILE_BYTES = 5 * 1024 * 1024; // 5MB — generous for a few thousand catalog rows
const MAX_IMAGE_FILE_BYTES = 15 * 1024 * 1024; // matches AssetsStorageService's own cap

@UseGuards(JwtAuthGuard)
@Controller('flyers')
export class FlyersController {
  constructor(
    private readonly flyersService: FlyersService,
    private readonly importService: FlyersImportService,
  ) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: FlyerStatus,
    @Query('campaignId') campaignId?: string,
  ): Promise<FlyerListItem[]> {
    return this.flyersService.list(user.companyId, user.id, { status, campaignId });
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFlyerDto): Promise<FlyerDetail> {
    return this.flyersService.create(user.companyId, user.id, dto);
  }

  @Get(':id')
  async getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FlyerDetail> {
    return this.flyersService.getById(user.companyId, user.id, id);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFlyerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<FlyerDetail> {
    return this.flyersService.update(user.companyId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.flyersService.delete(user.companyId, user.id, id);
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<FlyerDetail> {
    return this.flyersService.duplicate(user.companyId, user.id, id);
  }

  @Patch(':id/archive')
  async archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<FlyerDetail> {
    return this.flyersService.archive(user.companyId, user.id, id);
  }

  @Patch(':id/unarchive')
  async unarchive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<FlyerDetail> {
    return this.flyersService.unarchive(user.companyId, user.id, id);
  }

  // ─── Flyer Products ───────────────────────────────────────────────────────
  // NOTE: the 'reorder' route MUST be declared before the ':productId' routes
  // below — both are PATCH under /flyers/:id/products/*, and Nest/Express
  // match in declaration order, so ':productId' would otherwise swallow
  // '/products/reorder' (treating "reorder" as a productId and failing UUID
  // validation) before this handler ever runs.

  @Patch(':id/products/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  async reorderProducts(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderFlyerProductsDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.flyersService.reorderProducts(user.companyId, user.id, id, dto.order);
  }

  @Post(':id/products')
  async addProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddFlyerProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flyersService.addProduct(user.companyId, user.id, id, dto);
  }

  @Patch(':id/products/:productId')
  async updateProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateFlyerProductDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.flyersService.updateProduct(user.companyId, user.id, id, productId, dto);
  }

  @Delete(':id/products/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.flyersService.removeProduct(user.companyId, user.id, id, productId);
  }

  // ─── Excel import ─────────────────────────────────────────────────────────

  @Get('import/template')
  async downloadTemplate(@Res() res: Response): Promise<void> {
    const workbook = this.importService.buildTemplateWorkbook();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="flyer-catalog-template.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Post(':id/import')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportResult> {
    if (!file) throw new BadRequestException('No file provided');
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      throw new BadRequestException(`File exceeds the ${MAX_IMPORT_FILE_BYTES / (1024 * 1024)}MB limit`);
    }
    if (!/\.xlsx$/i.test(file.originalname)) {
      throw new BadRequestException('Only .xlsx files are supported');
    }
    return this.flyersService.importExcel(user.companyId, user.id, id, file.buffer);
  }

  // ─── Bulk image matching ──────────────────────────────────────────────────

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('files', 50))
  async uploadImages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFiles() files: Express.Multer.File[],
  ): Promise<ImageMatchResult> {
    if (!files?.length) throw new BadRequestException('No files provided');
    for (const file of files) {
      if (file.size > MAX_IMAGE_FILE_BYTES) {
        throw new BadRequestException(`"${file.originalname}" exceeds the ${MAX_IMAGE_FILE_BYTES / (1024 * 1024)}MB limit`);
      }
    }
    return this.flyersService.uploadImages(user.companyId, user.id, id, files);
  }

  // ─── Preview & PDF export ─────────────────────────────────────────────────
  // Both render through the exact same buildFlyerHtml() call (flyers.service
  // .renderHtml / .exportPdf) — the preview a viewer sees IS the document
  // Chromium prints, not a separately-maintained approximation of it.

  @Get(':id/preview')
  async preview(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const html = await this.flyersService.renderHtml(user.companyId, user.id, id);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  @Get(':id/export/pdf')
  async exportPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res() res: Response,
  ): Promise<void> {
    const pdf = await this.flyersService.exportPdf(user.companyId, user.id, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="flyer.pdf"');
    res.send(pdf);
  }
}
