import { Injectable } from '@nestjs/common';
import {
  Campaign,
  CampaignStatus,
  GoalStatus,
  MarketingGoal,
  Prisma,
  Task,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

// ─── Goals ───────────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  title: string;
  description?: string;
  status?: GoalStatus;
  targetDate?: string;
  metrics?: Record<string, unknown>;
}

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface CreateCampaignInput {
  goalId?: string;
  title: string;
  description?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  budget?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateCampaignInput {
  title?: string;
  description?: string;
  status?: CampaignStatus;
  startDate?: string;
  endDate?: string;
  budget?: number;
  metadata?: Record<string, unknown>;
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export interface CreateTaskInput {
  campaignId?: string;
  assignedToId?: string;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string;
  assignedToId?: string;
}

@Injectable()
export class MarketingRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Goals ─────────────────────────────────────────────────────────────────

  async listGoals(companyId: string, status?: GoalStatus): Promise<MarketingGoal[]> {
    return this.prisma.marketingGoal.findMany({
      where: { companyId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createGoal(companyId: string, input: CreateGoalInput): Promise<MarketingGoal> {
    return this.prisma.marketingGoal.create({
      data: {
        companyId,
        title: input.title,
        description: input.description,
        status: input.status ?? GoalStatus.DRAFT,
        targetDate: input.targetDate ? new Date(input.targetDate) : undefined,
        metrics: (input.metrics ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  // ─── Campaigns ─────────────────────────────────────────────────────────────

  async listCampaigns(
    companyId: string,
    goalId?: string,
    status?: CampaignStatus,
  ): Promise<Campaign[]> {
    return this.prisma.campaign.findMany({
      where: {
        companyId,
        ...(goalId ? { goalId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createCampaign(companyId: string, input: CreateCampaignInput): Promise<Campaign> {
    return this.prisma.campaign.create({
      data: {
        companyId,
        goalId: input.goalId ?? null,
        title: input.title,
        description: input.description,
        status: input.status ?? CampaignStatus.DRAFT,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        budget: input.budget,
        metadata: (input.metadata ?? null) as Prisma.InputJsonValue,
      },
    });
  }

  async findCampaign(companyId: string, campaignId: string): Promise<Campaign | null> {
    return this.prisma.campaign.findFirst({ where: { id: campaignId, companyId } });
  }

  async updateCampaign(
    companyId: string,
    campaignId: string,
    input: UpdateCampaignInput,
  ): Promise<Campaign | null> {
    const existing = await this.findCampaign(companyId, campaignId);
    if (!existing) return null;

    return this.prisma.campaign.update({
      where: { id: campaignId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
        ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {}),
        ...(input.budget !== undefined ? { budget: input.budget } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  }

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  async listTasks(companyId: string, campaignId?: string): Promise<Task[]> {
    return this.prisma.task.findMany({
      where: { companyId, ...(campaignId ? { campaignId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTask(companyId: string, input: CreateTaskInput): Promise<Task> {
    return this.prisma.task.create({
      data: {
        companyId,
        campaignId: input.campaignId ?? null,
        assignedToId: input.assignedToId ?? null,
        title: input.title,
        description: input.description,
        status: input.status ?? TaskStatus.TODO,
        priority: input.priority ?? TaskPriority.MEDIUM,
        dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      },
    });
  }

  async findTask(companyId: string, taskId: string): Promise<Task | null> {
    return this.prisma.task.findFirst({ where: { id: taskId, companyId } });
  }

  async updateTask(
    companyId: string,
    taskId: string,
    input: UpdateTaskInput,
  ): Promise<Task | null> {
    const existing = await this.findTask(companyId, taskId);
    if (!existing) return null;

    return this.prisma.task.update({
      where: { id: taskId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.dueDate !== undefined ? { dueDate: new Date(input.dueDate) } : {}),
        ...(input.assignedToId !== undefined ? { assignedToId: input.assignedToId } : {}),
      },
    });
  }
}
