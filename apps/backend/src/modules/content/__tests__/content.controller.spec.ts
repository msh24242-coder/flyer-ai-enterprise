import { NotFoundException } from '@nestjs/common';
import { ContentController } from '../content.controller';
import { ContentRepository } from '../content.repository';
import { AgentType } from '@prisma/client';

const COMPANY_ID = 'company-abc';

const mockRepo = {
  list: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
} as unknown as jest.Mocked<ContentRepository>;

describe('ContentController', () => {
  let controller: ContentController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ContentController(mockRepo);
  });

  describe('list', () => {
    it('returns all content without filters', async () => {
      const content = [{ id: 'c1', agentType: AgentType.CONTENT, contentType: 'blog_post', content: 'Hello', createdAt: new Date() }];
      mockRepo.list.mockResolvedValue(content as never);

      const result = await controller.list(COMPANY_ID, undefined, undefined);
      expect(result).toEqual(content);
      expect(mockRepo.list).toHaveBeenCalledWith(COMPANY_ID, undefined, undefined);
    });

    it('passes contentType and agentType filters to repo', async () => {
      mockRepo.list.mockResolvedValue([]);

      await controller.list(COMPANY_ID, 'social_post', AgentType.SOCIAL);
      expect(mockRepo.list).toHaveBeenCalledWith(COMPANY_ID, 'social_post', AgentType.SOCIAL);
    });
  });

  describe('getOne', () => {
    it('returns a single content item', async () => {
      const item = { id: 'c1', content: 'test', agentType: AgentType.CONTENT, contentType: 'blog_post' };
      mockRepo.findOne.mockResolvedValue(item as never);

      const result = await controller.getOne(COMPANY_ID, 'c1');
      expect(result).toEqual(item);
      expect(mockRepo.findOne).toHaveBeenCalledWith(COMPANY_ID, 'c1');
    });

    it('throws NotFoundException when content does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(controller.getOne(COMPANY_ID, 'no-such-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates and returns content', async () => {
      const dto = { agentType: AgentType.CONTENT, contentType: 'blog_post', title: 'My Post', content: 'Body text' };
      const created = { id: 'c2', ...dto, createdAt: new Date() };
      mockRepo.create.mockResolvedValue(created as never);

      const result = await controller.create(COMPANY_ID, dto as never);
      expect(result).toEqual(created);
      expect(mockRepo.create).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });

  describe('remove', () => {
    it('deletes content successfully', async () => {
      mockRepo.delete.mockResolvedValue(true as never);

      await expect(controller.remove(COMPANY_ID, 'c1')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when content does not exist', async () => {
      mockRepo.delete.mockResolvedValue(false as never);

      await expect(controller.remove(COMPANY_ID, 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
