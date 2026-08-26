import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database/database.module';
import { AI_PROVIDER, EMBEDDING_PROVIDER, QUEUE_MEMORY_WRITES, QUEUE_AGENT_TASKS } from './agent-engine.constants';
import { aiProviderFactory } from './providers/ai/ai-provider.factory';
import { embeddingProviderFactory } from './providers/embedding/embedding-provider.factory';
import { ObservabilityTracerService } from './observability/observability-tracer.service';
import { ApprovalEngineService } from './approval/approval-engine.service';
import { MemoryService } from './memory/memory.service';
import { MemoryWriteProcessor } from './memory/memory-write.processor';
import { AgentOrchestratorService } from './orchestration/agent-orchestrator.service';
import { BudgetGuardService } from './budget/budget-guard.service';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule,
    BullModule.registerQueue(
      { name: QUEUE_MEMORY_WRITES },
      { name: QUEUE_AGENT_TASKS },
    ),
  ],
  providers: [
    {
      provide: AI_PROVIDER,
      useFactory: (configService: ConfigService) => aiProviderFactory(configService),
      inject: [ConfigService],
    },
    {
      provide: EMBEDDING_PROVIDER,
      useFactory: (configService: ConfigService) => embeddingProviderFactory(configService),
      inject: [ConfigService],
    },
    ObservabilityTracerService,
    ApprovalEngineService,
    MemoryService,
    MemoryWriteProcessor,
    AgentOrchestratorService,
    BudgetGuardService,
  ],
  exports: [
    AI_PROVIDER,
    EMBEDDING_PROVIDER,
    ObservabilityTracerService,
    ApprovalEngineService,
    MemoryService,
    AgentOrchestratorService,
    BudgetGuardService,
    BullModule,
  ],
})
export class AgentEngineModule {}
