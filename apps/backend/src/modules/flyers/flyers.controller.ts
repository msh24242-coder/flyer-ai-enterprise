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
} from '@nestjs/common';
import { Flyer, FlyerStatus } from '@prisma/client';
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

@UseGuards(JwtAuthGuard)
@Controller('flyers')
export class FlyersController {
  constructor(private readonly flyersService: FlyersService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: FlyerStatus,
    @Query('campaignId') campaignId?: string,
  ): Promise<FlyerListItem[]> {
    return this.flyersService.list(user.companyId, user.id, { status, campaignId });
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateFlyerDto): Promise<Flyer> {
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
  ): Promise<Flyer> {
    return this.flyersService.update(user.companyId, user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.flyersService.delete(user.companyId, user.id, id);
  }

  @Post(':id/duplicate')
  async duplicate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser): Promise<Flyer> {
    return this.flyersService.duplicate(user.companyId, user.id, id);
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
}
