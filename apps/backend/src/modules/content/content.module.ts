import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CompanyModule } from '../company/company.module';
import { ContentController } from './content.controller';
import { ContentRepository } from './content.repository';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [ContentController],
  providers: [ContentRepository],
  exports: [ContentRepository],
})
export class ContentModule {}
