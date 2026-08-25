import { Module } from '@nestjs/common';
import { AgentEngineModule } from '../agent-engine/agent-engine.module';
import { MarketingAgentModule } from '../marketing-director/marketing-agent.module';
import { StrategyAgent } from './strategy/strategy.agent';
import { ContentAgent } from './content/content.agent';
import { MarketingRepository } from '../marketing-director/repositories/marketing.repository';

@Module({
  imports: [AgentEngineModule, MarketingAgentModule],
  providers: [StrategyAgent, ContentAgent, MarketingRepository],
  exports: [StrategyAgent, ContentAgent],
})
export class AgentsModule {}
