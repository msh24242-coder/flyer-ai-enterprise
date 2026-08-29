import { Module } from '@nestjs/common';
import { FlyersController } from './flyers.controller';
import { FlyersService } from './flyers.service';
import { FlyersRepository } from './flyers.repository';
import { FlyerProductsRepository } from './flyer-products.repository';
import { FlyersImportService } from './flyers-import.service';
import { FlyersImagesService } from './flyers-images.service';
import { FlyersExportService } from './flyers-export.service';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { ProductsModule } from '../products/products.module';
import { AssetsModule } from '../assets/assets.module';

@Module({
  imports: [AuthModule, CompanyModule, ProductsModule, AssetsModule],
  controllers: [FlyersController],
  providers: [
    FlyersService,
    FlyersRepository,
    FlyerProductsRepository,
    FlyersImportService,
    FlyersImagesService,
    FlyersExportService,
  ],
  exports: [FlyersService, FlyersRepository],
})
export class FlyersModule {}
