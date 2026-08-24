import { ConfigService } from '@nestjs/config';
import { IEmbeddingProvider } from './embedding-provider.interface';
import { VoyageProvider } from './voyage.provider';

export function embeddingProviderFactory(configService: ConfigService): IEmbeddingProvider {
  const provider = configService.get<string>('EMBEDDING_PROVIDER', 'voyage');

  if (provider === 'voyage') {
    const apiKey = configService.getOrThrow<string>('VOYAGE_API_KEY');
    const model = configService.get<string>('EMBEDDING_MODEL', 'voyage-3-lite');
    return new VoyageProvider(apiKey, model);
  }

  throw new Error(
    `Unsupported embedding provider: "${provider}". Supported values: voyage`,
  );
}
