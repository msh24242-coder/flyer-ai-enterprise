import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { IsString, IsIn, MinLength, MaxLength, IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.types';
import { CompanyService } from '../../company/company.service';
import { AgentWorkflowService, WorkflowType } from './agent-workflow.service';
import { AgentOrchestratorService } from '../../agent-engine/orchestration/agent-orchestrator.service';

class TriggerWorkflowDto {
  @IsString()
  @IsIn(['full_campaign', 'content_sprint', 'research_then_strategy'])
  workflowType!: WorkflowType;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  message!: string;

  @IsOptional()
  @IsUUID()
  conversationId?: string;

  @IsOptional()
  @IsString()
  @IsIn(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5'])
  model?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/workflows')
export class AgentWorkflowController {
  constructor(
    private readonly workflowService: AgentWorkflowService,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly companyService: CompanyService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerWorkflow(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerWorkflowDto,
  ) {
    await this.assertMembership(companyId, user.id);
    const input = {
      companyId,
      requestedByUserId: user.id,
      conversationId: dto.conversationId,
      userMessage: dto.message,
      model: dto.model,
    };

    switch (dto.workflowType) {
      case 'full_campaign':
        return this.workflowService.runFullCampaignWorkflow(input);
      case 'content_sprint':
        return this.workflowService.runContentSprintWorkflow(input);
      case 'research_then_strategy':
        return this.workflowService.runResearchThenStrategyWorkflow(input);
      default:
        return this.workflowService.runFullCampaignWorkflow(input);
    }
  }

  @Get('tasks/:taskId')
  async getTaskStatus(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.assertMembership(companyId, user.id);
    return this.orchestrator.getTaskStatus(companyId, taskId);
  }

  private async assertMembership(companyId: string, userId: string): Promise<void> {
    await this.companyService.getCompany(companyId, userId);
  }
}
