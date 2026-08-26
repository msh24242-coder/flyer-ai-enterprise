import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  Sse,
  RequestMethod,
} from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import { Observable, Subject } from 'rxjs';
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
   * SSE endpoint that streams real agent events as Server-Sent Events.
   * Registered as POST (via the `@Sse` method override) because it accepts a JSON
   * body — a plain GET SSE route can't carry one through `fetch()`, which is what
   * an authenticated browser client must use here (native EventSource can't send
   * custom Authorization headers or a body).
   * Event types: agent_start (includes conversationId), tool_start, tool_result,
   * token, agent_done (includes result.pendingApprovalId when approval is needed),
   * agent_error.
   */
  @Sse('run/stream', { [METHOD_METADATA]: RequestMethod.POST })
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  stream(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunAgentDto,
  ): Observable<MessageEvent> {
    const subject = new Subject<MessageEvent>();

    this.agentService
      .runStream(
        {
          companyId,
          userId: user.id,
          conversationId: dto.conversationId,
          message: dto.message,
          model: dto.model,
        },
        (event) => {
          subject.next({ type: event.type, data: JSON.stringify(event) } as unknown as MessageEvent);
        },
      )
      .then(() => subject.complete())
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        subject.next({ type: 'agent_error', data: JSON.stringify({ type: 'agent_error', message }) } as unknown as MessageEvent);
        subject.complete();
      });

    return subject.asObservable();
  }

  /**
   * GET /companies/:companyId/agents/marketing-director/conversations
   */
  @Get('conversations')
  async listConversations(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentService.listConversations(companyId, user.id);
  }

  /**
   * PATCH /companies/:companyId/agents/marketing-director/conversations/:conversationId
   * Rename a conversation.
   */
  @Patch('conversations/:conversationId')
  async renameConversation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @Body() body: { title: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentService.renameConversation(companyId, conversationId, user.id, body.title);
  }

  /**
   * POST /companies/:companyId/agents/marketing-director/conversations/:conversationId/archive
   * Archive a conversation.
   */
  @Post('conversations/:conversationId/archive')
  @HttpCode(HttpStatus.OK)
  async archiveConversation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.agentService.archiveConversation(companyId, conversationId, user.id);
  }

  /**
   * DELETE /companies/:companyId/agents/marketing-director/conversations/:conversationId
   * Permanently delete a conversation and all its messages.
   */
  @Delete('conversations/:conversationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteConversation(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Param('conversationId', ParseUUIDPipe) conversationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    return this.agentService.deleteConversation(companyId, conversationId, user.id);
  }
}
