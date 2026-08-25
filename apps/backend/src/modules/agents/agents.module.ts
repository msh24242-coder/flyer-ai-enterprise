import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AgentEngineModule } from '../agent-engine/agent-engine.module';
import { MarketingAgentModule } from '../marketing-director/marketing-agent.module';
import { QUEUE_AGENT_TASKS } from '../agent-engine/agent-engine.constants';
import { StrategyAgent } from './strategy/strategy.agent';
import { ContentAgent } from './content/content.agent';
import { ResearchAgent } from './research/research.agent';
import { SocialMediaAgent } from './social/social-media.agent';
import { AgentDispatchProcessor } from './agent-dispatch.processor';
import { MarketingRepository } from '../marketing-director/repositories/marketing.repository';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [
    AgentEngineModule,
    MarketingAgentModule,
    DatabaseModule,
    BullModule.registerQueue({ name: QUEUE_AGENT_TASKS }),
  ],
  providers: [StrategyAgent, ContentAgent, ResearchAgent, SocialMediaAgent, MarketingRepository, AgentDispatchProcessor],
  exports: [StrategyAgent, ContentAgent, ResearchAgent, SocialMediaAgent],
})
export class AgentsModule {}
