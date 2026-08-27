import {
  Controller,
  Get,
  Post,
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
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Asset } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { AssetsService } from './assets.service';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/assets')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('tag') tag?: string,
  ): Promise<Asset[]> {
    return this.assetsService.list(companyId, user.id, tag);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body('tags') tags?: string,
  ): Promise<Asset> {
    if (!file) throw new BadRequestException('No file provided');
    const parsedTags = tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [];
    return this.assetsService.upload(companyId, user.id, file, parsedTags);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.assetsService.delete(companyId, user.id, id);
  }
}
