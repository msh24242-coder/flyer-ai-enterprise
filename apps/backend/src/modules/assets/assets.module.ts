import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller';
import { UploadsController } from './uploads.controller';
import { AssetsService } from './assets.service';
import { AssetsRepository } from './assets.repository';
import { AssetsStorageService } from './assets.storage.service';
import { AuthModule } from '../auth/auth.module';
import { CompanyModule } from '../company/company.module';

@Module({
  imports: [AuthModule, CompanyModule],
  controllers: [AssetsController, UploadsController],
  providers: [AssetsService, AssetsRepository, AssetsStorageService],
  exports: [AssetsService, AssetsRepository, AssetsStorageService],
})
export class AssetsModule {}
