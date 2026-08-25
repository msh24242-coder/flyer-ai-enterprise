import { Injectable } from '@nestjs/common';
import { AgentType, Conversation, ConversationStatus, Message, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CanonicalMessage } from '../../../common/types/canonical.types';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(companyId: string, conversationId: string): Promise<Conversation | null> {
    return this.prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
    });
  }

  async create(
    companyId: string,
    userId: string,
    agentType: AgentType,
    title?: string,
  ): Promise<Conversation> {
    return this.prisma.conversation.create({
      data: { companyId, userId, agentType, title },
    });
  }

  async getHistory(conversationId: string, limit: number): Promise<CanonicalMessage[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return messages.map((m) => this.toCanonical(m));
  }

  async addMessage(
    conversationId: string,
    role: 'user' | 'assistant',
    text: string,
    tokenCount?: number,
  ): Promise<Message> {
    const content: Prisma.InputJsonValue = [{ type: 'text', text }];
    return this.prisma.message.create({
      data: { conversationId, role, content, tokenCount },
    });
  }

  async incrementCost(conversationId: string, costUsd: number): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { totalCostUsd: { increment: costUsd } },
    });
  }

  async listByCompany(companyId: string, userId?: string): Promise<Conversation[]> {
    return this.prisma.conversation.findMany({
      where: { companyId, ...(userId ? { userId } : {}), status: ConversationStatus.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async rename(companyId: string, conversationId: string, title: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId, companyId },
      data: { title },
    });
  }

  async archive(companyId: string, conversationId: string): Promise<Conversation> {
    return this.prisma.conversation.update({
      where: { id: conversationId, companyId },
      data: { status: ConversationStatus.ARCHIVED },
    });
  }

  async delete(companyId: string, conversationId: string): Promise<void> {
    await this.prisma.conversation.delete({
      where: { id: conversationId, companyId },
    });
  }

  async updateTitle(companyId: string, conversationId: string, title: string): Promise<void> {
    await this.prisma.conversation.updateMany({
      where: { id: conversationId, companyId, title: null },
      data: { title },
    });
  }

  private toCanonical(m: Message): CanonicalMessage {
    const role = m.role === 'assistant' ? 'assistant' : 'user';
    const content = m.content as Array<{ type: string; text?: string }>;
    const text = content.find((b) => b.type === 'text')?.text ?? '';
    return { role, content: [{ type: 'text', text }] };
  }
}
