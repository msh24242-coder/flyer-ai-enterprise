import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CompanyModule } from '../company/company.module';
import { ApprovalsController } from './approvals.controller';
import { ApprovalsService } from './approvals.service';
import { ApprovalsRepository } from './approvals.repository';

@Module({
  imports: [DatabaseModule, CompanyModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService, ApprovalsRepository],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
