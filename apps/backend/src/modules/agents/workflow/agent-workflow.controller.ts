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
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../auth/auth.types';
import { AgentWorkflowService, WorkflowType } from './agent-workflow.service';
import { AgentOrchestratorService } from '../../agent-engine/orchestration/agent-orchestrator.service';

class TriggerWorkflowDto {
  workflowType!: WorkflowType;
  message!: string;
  conversationId?: string;
  model?: string;
}

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/workflows')
export class AgentWorkflowController {
  constructor(
    private readonly workflowService: AgentWorkflowService,
    private readonly orchestrator: AgentOrchestratorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerWorkflow(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TriggerWorkflowDto,
  ) {
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
    @Param('companyId', ParseUUIDPipe) _companyId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.orchestrator.getTaskStatus(taskId);
  }
}
