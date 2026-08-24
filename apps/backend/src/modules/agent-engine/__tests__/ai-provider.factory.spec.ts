import { ConfigService } from '@nestjs/config';
import { aiProviderFactory } from '../providers/ai/ai-provider.factory';
import { AnthropicProvider } from '../providers/ai/anthropic.provider';

describe('aiProviderFactory', () => {
  const mockConfig = (values: Record<string, string>) =>
    ({
      get: (key: string, defaultValue?: string) => values[key] ?? defaultValue,
      getOrThrow: (key: string) => {
        if (!(key in values)) throw new Error(`Missing config: ${key}`);
        return values[key];
      },
    }) as unknown as ConfigService;

  it('returns AnthropicProvider when AI_PROVIDER=anthropic', () => {
    const provider = aiProviderFactory(
      mockConfig({ AI_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'test-key' }),
    );
    expect(provider).toBeInstanceOf(AnthropicProvider);
    expect(provider.name).toBe('anthropic');
  });

  it('uses default provider anthropic when AI_PROVIDER not set', () => {
    const provider = aiProviderFactory(
      mockConfig({ ANTHROPIC_API_KEY: 'test-key' }),
    );
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('throws for unsupported provider', () => {
    expect(() =>
      aiProviderFactory(mockConfig({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'key' })),
    ).toThrow('Unsupported AI provider: "openai"');
  });

  it('throws when ANTHROPIC_API_KEY is missing', () => {
    expect(() =>
      aiProviderFactory(mockConfig({ AI_PROVIDER: 'anthropic' })),
    ).toThrow('Missing config: ANTHROPIC_API_KEY');
  });
});
