import { Injectable, Logger } from '@nestjs/common';
import {
  IEmbeddingProvider,
  EmbeddingRequest,
  EmbeddingResponse,
} from './embedding-provider.interface';

interface VoyageEmbeddingResponse {
  data: Array<{ embedding: number[]; index: number }>;
  model: string;
  usage: { total_tokens: number };
}

@Injectable()
export class VoyageProvider implements IEmbeddingProvider {
  readonly name = 'voyage';
  readonly dimensions = 1024;

  private readonly logger = new Logger(VoyageProvider.name);
  private readonly baseUrl = 'https://api.voyageai.com/v1/embeddings';

  constructor(
    private readonly apiKey: string,
    private readonly defaultModel: string = 'voyage-3-lite',
  ) {}

  async embed(request: EmbeddingRequest): Promise<EmbeddingResponse> {
    const model = request.model ?? this.defaultModel;

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ input: request.texts, model }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Voyage AI error ${response.status}: ${body}`);
    }

    const data = (await response.json()) as VoyageEmbeddingResponse;

    const embeddings = data.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    return {
      embeddings,
      model: data.model,
      usage: { totalTokens: data.usage.total_tokens },
    };
  }
}
