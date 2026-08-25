import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Sse,
} from '@nestjs/common';
import { Observable, from, map } from 'rxjs';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.types';
import { MarketingAgentService } from './marketing-agent.service';
import { RunAgentDto } from './dto/run-agent.dto';

@UseGuards(JwtAuthGuard)
@Controller('companies/:companyId/agents/marketing-director')
export class MarketingAgentController {
  constructor(private readonly agentService: MarketingAgentService) {}

  /**
   * POST /companies/:companyId/agents/marketing-director/run
   *
   * Runs the Marketing Director agent and returns a JSON response.
   * Pass conversationId to continue an existing conversation.
   */
  @Post('run')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async run(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: RunAgentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentService.run({
      companyId,
      userId: user.id,
      conversationId: dto.conversationId,
      message: dto.message,
      model: dto.model,
    });
  }

  /**
   * POST /companies/:companyId/agents/marketing-director/run/stream
   *
   * SSE endpoint that streams agent events as Server-Sent Events.
   * Emits: agent_start, agent_response, agent_done (or agent_error).
   */
  @Sse('run/stream')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  stream(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunAgentDto,
  ): Observable<MessageEvent> {
    const runPromise = this.agentService.run({
      companyId,
      userId: user.id,
      conversationId: dto.conversationId,
      message: dto.message,
      model: dto.model,
    });

    return from(runPromise).pipe(
      map((result) => ({
        type: 'agent_done',
        data: JSON.stringify(result),
      } as unknown as MessageEvent)),
    );
  }

  /**
   * GET /companies/:companyId/agents/marketing-director/conversations
   *
   * Lists conversations for the authenticated user within this company.
   */
  @Get('conversations')
  async listConversations(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentService.listConversations(companyId, user.id);
  }
}
