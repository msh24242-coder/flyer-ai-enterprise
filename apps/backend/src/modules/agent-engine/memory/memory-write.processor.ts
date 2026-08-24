import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { IEmbeddingProvider } from '../providers/embedding/embedding-provider.interface';
import { EMBEDDING_PROVIDER, QUEUE_MEMORY_WRITES } from '../agent-engine.constants';
import { MemoryWriteJob } from './memory.types';

@Processor(QUEUE_MEMORY_WRITES)
export class MemoryWriteProcessor extends WorkerHost {
  private readonly logger = new Logger(MemoryWriteProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: IEmbeddingProvider,
  ) {
    super();
  }

  async process(job: Job<MemoryWriteJob>): Promise<void> {
    const { companyId, agentType, memoryType, content, metadata, conversationId, agentExecutionId } =
      job.data;

    const embeddingResponse = await this.embeddingProvider.embed({ texts: [content] });
    const embedding = embeddingResponse.embeddings[0];
    const embeddingStr = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      INSERT INTO agent_memory (
        id, company_id, agent_type, memory_type, content, metadata,
        conversation_id, agent_execution_id, embedding, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        ${companyId},
        ${agentType}::"AgentType",
        ${memoryType}::"MemoryType",
        ${content},
        ${JSON.stringify(metadata ?? {})}::jsonb,
        ${conversationId ?? null},
        ${agentExecutionId ?? null},
        ${embeddingStr}::vector,
        NOW(),
        NOW()
      )
    `;

    this.logger.debug(`Persisted ${memoryType} memory for company ${companyId}`);
  }
}
