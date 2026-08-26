import { ServiceUnavailableException } from '@nestjs/common';
import { AnthropicProvider } from '../providers/ai/anthropic.provider';

const baseRequest = {
  model: 'claude-sonnet-5',
  system: 'You are a helpful assistant.',
  messages: [{ role: 'user' as const, content: [{ type: 'text' as const, text: 'Hi' }] }],
};

describe('AnthropicProvider', () => {
  describe('when no API key is configured', () => {
    it('rejects complete() with a clear "not configured" error instead of hitting the network', async () => {
      const provider = new AnthropicProvider('');
      await expect(provider.complete(baseRequest)).rejects.toThrow(ServiceUnavailableException);
      await expect(provider.complete(baseRequest)).rejects.toThrow(
        'AI provider is not configured for this environment.',
      );
    });

    it('rejects stream() with a clear "not configured" error instead of hitting the network', async () => {
      const provider = new AnthropicProvider('');
      await expect(provider.stream(baseRequest, jest.fn())).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
