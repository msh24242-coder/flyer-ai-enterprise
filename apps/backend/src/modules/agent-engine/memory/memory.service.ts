import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MemoryType } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { IEmbeddingProvider } from '../providers/embedding/embedding-provider.interface';
import { EMBEDDING_PROVIDER, QUEUE_MEMORY_WRITES, DEFAULT_MEMORY_TOP_K, DEFAULT_MEMORY_SIMILARITY_THRESHOLD } from '../agent-engine.constants';
import {
  MemorySearchParams,
  MemorySearchResult,
  MemoryWriteJob,
  CompanyKnowledge,
} from './memory.types';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: IEmbeddingProvider,
    @InjectQueue(QUEUE_MEMORY_WRITES) private readonly memoryWriteQueue: Queue,
  ) {}

  async getCompanyKnowledge(companyId: string): Promise<CompanyKnowledge[]> {
    return this.prisma.companyKnowledge.findMany({
      where: { companyId },
      select: { id: true, key: true, value: true, category: true },
      orderBy: { key: 'asc' },
    });
  }

  async searchSemanticMemory(params: MemorySearchParams): Promise<MemorySearchResult[]> {
    const topK = params.topK ?? DEFAULT_MEMORY_TOP_K;
    const threshold = params.threshold ?? DEFAULT_MEMORY_SIMILARITY_THRESHOLD;

    const embeddingStr = `[${params.queryEmbedding.join(',')}]`;

    const memoryTypeFilter = params.memoryTypes && params.memoryTypes.length > 0
      ? params.memoryTypes
      : Object.values(MemoryType);

    type RawRow = {
      id: string;
      content: string;
      memory_type: MemoryType;
      metadata: unknown;
      created_at: Date;
      similarity: number;
    };

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        id,
        content,
        "memoryType" AS memory_type,
        metadata,
        "createdAt" AS created_at,
        1 - (embedding <=> ${embeddingStr}::vector) AS similarity
      FROM agent_memory
      WHERE
        "companyId" = ${params.companyId}::uuid
        AND "memoryType"::text = ANY(${memoryTypeFilter}::text[])
        AND embedding IS NOT NULL
        AND 1 - (embedding <=> ${embeddingStr}::vector) >= ${threshold}
      ORDER BY embedding <=> ${embeddingStr}::vector
      LIMIT ${topK}
    `;

    return rows.map((r) => ({
      id: r.id,
      content: r.content,
      memoryType: r.memory_type,
      similarity: Number(r.similarity),
      metadata: (r.metadata as Record<string, unknown>) ?? {},
      createdAt: r.created_at,
    }));
  }

  async embedAndSearch(query: string, params: Omit<MemorySearchParams, 'queryEmbedding'>): Promise<MemorySearchResult[]> {
    const embeddingResponse = await this.embeddingProvider.embed({ texts: [query] });
    return this.searchSemanticMemory({
      ...params,
      queryEmbedding: embeddingResponse.embeddings[0],
    });
  }

  async enqueueMemoryWrite(job: MemoryWriteJob): Promise<void> {
    await this.memoryWriteQueue.add('write-memory', job, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    });
  }
}
