import { ObservabilityTracerService } from '../observability/observability-tracer.service';
import { AgentType } from '@prisma/client';

const mockPrisma = {
  agentExecution: {
    create: jest.fn(),
  },
  toolCallLog: {
    createMany: jest.fn(),
  },
};

describe('ObservabilityTracerService', () => {
  let service: ObservabilityTracerService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ObservabilityTracerService(mockPrisma as never);
  });

  it('createTrace generates a unique traceId', () => {
    const ctx1 = service.createTrace({ agentType: AgentType.DIRECTOR, companyId: 'c1', model: 'claude-opus-5' });
    const ctx2 = service.createTrace({ agentType: AgentType.DIRECTOR, companyId: 'c1', model: 'claude-opus-5' });
    expect(ctx1.traceId).toBeTruthy();
    expect(ctx1.traceId).not.toBe(ctx2.traceId);
  });

  it('createTrace sets startedAt to current time', () => {
    const before = Date.now();
    const ctx = service.createTrace({ agentType: AgentType.DIRECTOR, companyId: 'c1', model: 'claude-opus-5' });
    const after = Date.now();
    expect(ctx.startedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(ctx.startedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it('finalizeTrace persists execution to database', async () => {
    mockPrisma.agentExecution.create.mockResolvedValue({ id: 'exec-1' });

    const ctx = service.createTrace({
      agentType: AgentType.DIRECTOR,
      companyId: 'company-1',
      model: 'claude-opus-5',
    });

    const result = await service.finalizeTrace(ctx, {
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      iterations: 2,
      toolCalls: [],
      finalStatus: 'COMPLETED',
    });

    expect(result.agentExecutionId).toBe('exec-1');
    expect(result.finalStatus).toBe('COMPLETED');
    expect(mockPrisma.agentExecution.create).toHaveBeenCalledTimes(1);
  });

  it('calculates correct cost for claude-opus-5', async () => {
    mockPrisma.agentExecution.create.mockResolvedValue({ id: 'exec-2' });

    const ctx = service.createTrace({
      agentType: AgentType.DIRECTOR,
      companyId: 'company-1',
      model: 'claude-opus-5',
    });

    const result = await service.finalizeTrace(ctx, {
      totalInputTokens: 1_000_000,
      totalOutputTokens: 1_000_000,
      iterations: 1,
      toolCalls: [],
      finalStatus: 'COMPLETED',
    });

    // claude-opus-5: $5 input + $25 output = $30 per 1M tokens each
    expect(result.estimatedCostUsd).toBeCloseTo(30.0, 4);
  });

  it('returns cost=0 for unknown model', async () => {
    mockPrisma.agentExecution.create.mockResolvedValue({ id: 'exec-3' });

    const ctx = service.createTrace({
      agentType: AgentType.DIRECTOR,
      companyId: 'company-1',
      model: 'unknown-model',
    });

    const result = await service.finalizeTrace(ctx, {
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      iterations: 1,
      toolCalls: [],
      finalStatus: 'COMPLETED',
    });

    expect(result.estimatedCostUsd).toBe(0);
  });

  it('handles DB error gracefully and returns unpersisted trace', async () => {
    mockPrisma.agentExecution.create.mockRejectedValue(new Error('DB down'));

    const ctx = service.createTrace({
      agentType: AgentType.DIRECTOR,
      companyId: 'company-1',
      model: 'claude-opus-5',
    });

    const result = await service.finalizeTrace(ctx, {
      totalInputTokens: 100,
      totalOutputTokens: 50,
      iterations: 1,
      toolCalls: [],
      finalStatus: 'FAILED',
    });

    expect(result.agentExecutionId).toMatch(/^unpersisted-/);
    expect(result.finalStatus).toBe('FAILED');
  });
});
