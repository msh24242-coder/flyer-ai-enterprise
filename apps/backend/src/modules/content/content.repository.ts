import { Injectable } from '@nestjs/common';
import { AgentType, Prisma } from '@prisma/client';
import {
  IsEnum,
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  MinLength,
  MaxLength,
} from 'class-validator';
import { PrismaService } from '../../database/prisma.service';

export class CreateGeneratedContentDto {
  @IsEnum(AgentType)
  agentType!: AgentType;

  @IsString()
  @MaxLength(100)
  contentType!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(50_000)
  content!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  campaignId?: string;

  @IsOptional()
  @IsUUID()
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
