export const AI_PROVIDER = Symbol('AI_PROVIDER');
export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export const QUEUE_MEMORY_WRITES = 'memory-writes';
export const QUEUE_AGENT_TASKS = 'agent-tasks';

export const MAX_AGENT_ITERATIONS = 10;

export const PRICING: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {
  'claude-opus-5': { inputPerMTok: 5.0, outputPerMTok: 25.0 },
  'claude-sonnet-5': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'claude-haiku-4-5': { inputPerMTok: 1.0, outputPerMTok: 5.0 },
  'claude-haiku-4-5-20251001': { inputPerMTok: 1.0, outputPerMTok: 5.0 },
};

export const DEFAULT_MEMORY_SIMILARITY_THRESHOLD = 0.75;
export const DEFAULT_MEMORY_TOP_K = 5;
export const CONVERSATION_HISTORY_LIMIT = 30;
