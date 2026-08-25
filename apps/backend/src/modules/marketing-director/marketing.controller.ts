import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';
import { CampaignStatus, GoalStatus, TaskStatus, TaskPriority } from '@prisma/client';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { MarketingRepository } from './repositories/marketing.repository';
import { CompanyService } from '../company/company.service';

class CreateGoalDto {
  title!: string;
  description?: string;
  status?: GoalStatus;
  targetDate?: string;
  metrics?: Record<string, unknown>;
}

class UpdateGoalDto {
  title?: string;
  description?: string;
  status?: GoalStatus;
  targetDate?: string;
  metrics?: Record<string, unknown>;
}

class CreateCampaignDto {
  title!: string;
  description?: string;
  goalId?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

class UpdateCampaignDto {
  title?: string;
  description?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  budget?: number;
}

class CreateTaskDto {
  title!: string;
  description?: string;
  campaignId?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
}

class UpdateTaskDto {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/marketing')
export class MarketingController {
  constructor(
    private readonly marketingRepo: MarketingRepository,
    private readonly companyService: CompanyService,
  ) {}

  // ─── Goals ─────────────────────────────────────────────────────────────────

  @Get('goals')
  async listGoals(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
  ) {
    await this.assertMembership(companyId, user.id);
    const goalStatus =
      status && Object.values(GoalStatus).includes(status as GoalStatus)
        ? (status as GoalStatus)
        : undefined;
    return this.marketingRepo.listGoals(companyId, goalStatus);
  }

  @Post('goals')
  async createGoal(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.marketingRepo.createGoal(companyId, dto);
  }

  @Patch('goals/:goalId')
  async updateGoal(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @Body() dto: UpdateGoalDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const updated = await this.marketingRepo.updateGoal(companyId, goalId, dto);
    if (!updated) throw new NotFoundException('Goal not found');
    return updated;
  }

  @Delete('goals/:goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteGoal(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('goalId', ParseUUIDPipe) goalId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const deleted = await this.marketingRepo.deleteGoal(companyId, goalId);
    if (!deleted) throw new NotFoundException('Goal not found');
  }

  // ─── Campaigns ─────────────────────────────────────────────────────────────

  @Get('campaigns')
  async listCampaigns(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: string,
    @Query('goalId') goalId?: string,
  ) {
    await this.assertMembership(companyId, user.id);
    const campaignStatus =
      status && Object.values(CampaignStatus).includes(status as CampaignStatus)
        ? (status as CampaignStatus)
        : undefined;
    return this.marketingRepo.listCampaigns(companyId, goalId, campaignStatus);
  }

  @Post('campaigns')
  async createCampaign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.marketingRepo.createCampaign(companyId, dto);
  }

  @Patch('campaigns/:campaignId')
  async updateCampaign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const updated = await this.marketingRepo.updateCampaign(companyId, campaignId, dto);
    if (!updated) throw new NotFoundException('Campaign not found');
    return updated;
  }

  @Delete('campaigns/:campaignId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteCampaign(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('campaignId', ParseUUIDPipe) campaignId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const deleted = await this.marketingRepo.deleteCampaign(companyId, campaignId);
    if (!deleted) throw new NotFoundException('Campaign not found');
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  @Get('tasks')
  async listTasks(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query('campaignId') campaignId?: string,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.marketingRepo.listTasks(companyId, campaignId);
  }

  @Post('tasks')
  async createTask(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.marketingRepo.createTask(companyId, dto);
  }

  @Patch('tasks/:taskId')
  async updateTask(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const updated = await this.marketingRepo.updateTask(companyId, taskId, dto);
    if (!updated) throw new NotFoundException('Task not found');
    return updated;
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteTask(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    const deleted = await this.marketingRepo.deleteTask(companyId, taskId);
    if (!deleted) throw new NotFoundException('Task not found');
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    await this.companyService.getCompany(companyId, userId);
  }
}
