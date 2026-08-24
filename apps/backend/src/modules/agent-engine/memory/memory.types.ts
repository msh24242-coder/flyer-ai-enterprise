import { MemoryType } from '@prisma/client';

export interface MemorySearchParams {
  companyId: string;
  agentType?: string;
  memoryTypes?: MemoryType[];
  topK?: number;
  threshold?: number;
  queryEmbedding: number[];
}

export interface MemorySearchResult {
  id: string;
  content: string;
  memoryType: MemoryType;
  similarity: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface MemoryWriteJob {
  companyId: string;
  agentType: string;
  memoryType: MemoryType;
  content: string;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  agentExecutionId?: string;
}

export interface CompanyKnowledge {
  id: string;
  key: string;
  value: unknown;
  category: string;
}
