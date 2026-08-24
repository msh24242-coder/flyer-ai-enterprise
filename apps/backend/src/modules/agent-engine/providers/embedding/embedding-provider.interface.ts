export interface EmbeddingRequest {
  texts: string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage: { totalTokens: number };
}

export interface IEmbeddingProvider {
  readonly name: string;
  readonly dimensions: number;
  embed(request: EmbeddingRequest): Promise<EmbeddingResponse>;
}
