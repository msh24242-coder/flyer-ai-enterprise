import { ConfigService } from '@nestjs/config';
import { IAIProvider } from './ai-provider.interface';
import { AnthropicProvider } from './anthropic.provider';

export function aiProviderFactory(configService: ConfigService): IAIProvider {
  const provider = configService.get<string>('AI_PROVIDER', 'anthropic');

  if (provider === 'anthropic') {
    const apiKey = configService.getOrThrow<string>('ANTHROPIC_API_KEY');
    return new AnthropicProvider(apiKey);
  }

  throw new Error(
    `Unsupported AI provider: "${provider}". Supported values: anthropic`,
  );
}
