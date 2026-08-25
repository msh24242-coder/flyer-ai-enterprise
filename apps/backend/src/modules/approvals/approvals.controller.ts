import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalStatus } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { ApprovalsService } from './approvals.service';

class ResolveApprovalDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reviewNote?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  /**
   * GET /companies/:companyId/approvals
   * Lists approval requests for the company. Filter by status with ?status=PENDING|GRANTED|DENIED|EXPIRED
   */
  @Get()
  async list(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query('status') status?: string,
  ) {
    const approvalStatus =
      status && Object.values(ApprovalStatus).includes(status as ApprovalStatus)
        ? (status as ApprovalStatus)
        : undefined;
    return this.approvalsService.listApprovals(companyId, approvalStatus);
  }

  /**
   * GET /companies/:companyId/approvals/:id
   * Get a single approval request by ID.
   */
  @Get(':id')
  async getOne(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.approvalsService.getApproval(companyId, id);
  }

  /**
   * PATCH /companies/:companyId/approvals/:id/approve
   * Approve a pending approval request.
   */
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.approve(companyId, id, user.id, dto.reviewNote);
  }

  /**
   * PATCH /companies/:companyId/approvals/:id/deny
   * Deny a pending approval request.
   */
  @Patch(':id/deny')
  @HttpCode(HttpStatus.OK)
  async deny(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveApprovalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.approvalsService.deny(companyId, id, user.id, dto.reviewNote);
  }
}
