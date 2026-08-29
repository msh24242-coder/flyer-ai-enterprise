import { Module } from '@nestjs/common';
import { FlyersController } from './flyers.controller';
import { FlyersService } from './flyers.service';
import { FlyersRepository } from './flyers.repository';
import { FlyerProductsRepository } from './flyer-products.repository';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [AuthModule, CompanyModule, ProductsModule],
  controllers: [FlyersController],
  providers: [FlyersService, FlyersRepository, FlyerProductsRepository],
  exports: [FlyersService, FlyersRepository],
})
export class FlyersModule {}
