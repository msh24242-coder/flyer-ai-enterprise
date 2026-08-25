import { Module } from '@nestjs/common';
import { AgentEngineModule } from '../agent-engine/agent-engine.module';
import { CompanyModule } from '../company/company.module';
import { MarketingAgentController } from './marketing-agent.controller';
import { MarketingController } from './marketing.controller';
import { MarketingAgentService } from './marketing-agent.service';
import { MarketingDirectorAgent } from './marketing-director.agent';
import { ConversationRepository } from './repositories/conversation.repository';
import { MarketingRepository } from './repositories/marketing.repository';

@Module({
  imports: [AgentEngineModule, CompanyModule],
  controllers: [MarketingAgentController, MarketingController],
  providers: [
    MarketingAgentService,
    MarketingDirectorAgent,
    ConversationRepository,
    MarketingRepository,
  ],
  exports: [MarketingAgentService, MarketingRepository],
})
export class MarketingAgentModule {}
