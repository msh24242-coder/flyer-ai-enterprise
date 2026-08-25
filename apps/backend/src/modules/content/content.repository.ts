import { Injectable } from '@nestjs/common';
import { AgentType, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateGeneratedContentDto {
  agentType: AgentType;
  contentType: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
  campaignId?: string;
  agentExecutionId?: string;
}

@Injectable()
export class ContentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(companyId: string, contentType?: string, agentType?: AgentType) {
    return this.prisma.generatedContent.findMany({
      where: {
        companyId,
        ...(contentType ? { contentType } : {}),
        ...(agentType ? { agentType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async findOne(companyId: string, id: string) {
    return this.prisma.generatedContent.findFirst({ where: { companyId, id } });
  }

  async create(companyId: string, dto: CreateGeneratedContentDto) {
    return this.prisma.generatedContent.create({
      data: {
        companyId,
        agentType: dto.agentType,
        contentType: dto.contentType,
        title: dto.title,
        content: dto.content,
        metadata: dto.metadata as Prisma.InputJsonValue,
        campaignId: dto.campaignId,
        agentExecutionId: dto.agentExecutionId,
      },
    });
  }

  async delete(companyId: string, id: string): Promise<boolean> {
    const result = await this.prisma.generatedContent.deleteMany({ where: { companyId, id } });
    return result.count > 0;
  }
}
