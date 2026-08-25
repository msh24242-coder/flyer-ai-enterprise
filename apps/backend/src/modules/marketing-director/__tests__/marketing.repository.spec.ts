import { MarketingRepository } from '../repositories/marketing.repository';
import { PrismaService } from '../../../database/prisma.service';
import { GoalStatus, CampaignStatus, TaskStatus, TaskPriority } from '@prisma/client';

const makeGoal = (id: string, companyId = 'co-1') => ({
  id,
  companyId,
  title: 'Test Goal',
  description: null,
  status: GoalStatus.DRAFT,
  targetDate: null,
  metrics: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeCampaign = (id: string, companyId = 'co-1') => ({
  id,
  companyId,
  goalId: null,
  title: 'Test Campaign',
  description: null,
  status: CampaignStatus.DRAFT,
  startDate: null,
  endDate: null,
  budget: null,
  metadata: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeTask = (id: string, companyId = 'co-1') => ({
  id,
  companyId,
  campaignId: null,
  assignedToId: null,
  title: 'Test Task',
  description: null,
  status: TaskStatus.TODO,
  priority: TaskPriority.MEDIUM,
  dueDate: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const mockPrisma = {
  marketingGoal: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  campaign: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
} as unknown as PrismaService;

describe('MarketingRepository', () => {
  let repo: MarketingRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new MarketingRepository(mockPrisma);
  });

  // ─── Goals ──────────────────────────────────────────────────────────────────

  describe('listGoals', () => {
    it('returns goals for the company', async () => {
      const goals = [makeGoal('g-1'), makeGoal('g-2')];
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue(goals);

      const result = await repo.listGoals('co-1');

      expect(result).toEqual(goals);
      expect(mockPrisma.marketingGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      );
    });

    it('filters by status when provided', async () => {
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue([]);

      await repo.listGoals('co-1', GoalStatus.ACTIVE);

      expect(mockPrisma.marketingGoal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1', status: GoalStatus.ACTIVE } }),
      );
    });
  });

  describe('createGoal', () => {
    it('creates a goal with DRAFT default status', async () => {
      const goal = makeGoal('g-new');
      (mockPrisma.marketingGoal.create as jest.Mock).mockResolvedValue(goal);

      const result = await repo.createGoal('co-1', { title: 'Test Goal' });

      expect(result).toEqual(goal);
      expect(mockPrisma.marketingGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GoalStatus.DRAFT, companyId: 'co-1' }),
        }),
      );
    });

    it('uses provided status instead of default', async () => {
      (mockPrisma.marketingGoal.create as jest.Mock).mockResolvedValue(makeGoal('g-1'));

      await repo.createGoal('co-1', { title: 'Active Goal', status: GoalStatus.ACTIVE });

      expect(mockPrisma.marketingGoal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: GoalStatus.ACTIVE }),
        }),
      );
    });
  });

  describe('updateGoal', () => {
    it('returns null when goal does not belong to company', async () => {
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repo.updateGoal('co-1', 'g-999', { title: 'New Title' });

      expect(result).toBeNull();
      expect(mockPrisma.marketingGoal.update).not.toHaveBeenCalled();
    });

    it('updates the goal when found', async () => {
      const goal = makeGoal('g-1');
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue([goal]);
      (mockPrisma.marketingGoal.update as jest.Mock).mockResolvedValue({ ...goal, title: 'Updated' });

      const result = await repo.updateGoal('co-1', 'g-1', { title: 'Updated' });

      expect(result?.title).toBe('Updated');
    });
  });

  describe('deleteGoal', () => {
    it('returns false when goal not found', async () => {
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await repo.deleteGoal('co-1', 'g-999');

      expect(result).toBe(false);
      expect(mockPrisma.marketingGoal.delete).not.toHaveBeenCalled();
    });

    it('deletes and returns true when goal exists', async () => {
      const goal = makeGoal('g-1');
      (mockPrisma.marketingGoal.findMany as jest.Mock).mockResolvedValue([goal]);
      (mockPrisma.marketingGoal.delete as jest.Mock).mockResolvedValue(goal);

      const result = await repo.deleteGoal('co-1', 'g-1');

      expect(result).toBe(true);
      expect(mockPrisma.marketingGoal.delete).toHaveBeenCalledWith({ where: { id: 'g-1' } });
    });
  });

  // ─── Campaigns ──────────────────────────────────────────────────────────────

  describe('listCampaigns', () => {
    it('returns campaigns for company', async () => {
      const campaigns = [makeCampaign('c-1')];
      (mockPrisma.campaign.findMany as jest.Mock).mockResolvedValue(campaigns);

      const result = await repo.listCampaigns('co-1');

      expect(result).toEqual(campaigns);
      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      );
    });

    it('filters by goalId and status when provided', async () => {
      (mockPrisma.campaign.findMany as jest.Mock).mockResolvedValue([]);

      await repo.listCampaigns('co-1', 'goal-1', CampaignStatus.ACTIVE);

      expect(mockPrisma.campaign.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'co-1', goalId: 'goal-1', status: CampaignStatus.ACTIVE },
        }),
      );
    });
  });

  describe('createCampaign', () => {
    it('creates campaign with DRAFT default', async () => {
      const campaign = makeCampaign('c-new');
      (mockPrisma.campaign.create as jest.Mock).mockResolvedValue(campaign);

      const result = await repo.createCampaign('co-1', { title: 'Test Campaign' });

      expect(result).toEqual(campaign);
      expect(mockPrisma.campaign.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: CampaignStatus.DRAFT }),
        }),
      );
    });
  });

  describe('updateCampaign', () => {
    it('returns null when campaign not found in company', async () => {
      (mockPrisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.updateCampaign('co-1', 'c-999', { title: 'Updated' });

      expect(result).toBeNull();
      expect(mockPrisma.campaign.update).not.toHaveBeenCalled();
    });

    it('updates campaign when found', async () => {
      const campaign = makeCampaign('c-1');
      (mockPrisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaign);
      (mockPrisma.campaign.update as jest.Mock).mockResolvedValue({ ...campaign, title: 'Updated' });

      const result = await repo.updateCampaign('co-1', 'c-1', { title: 'Updated' });

      expect(result?.title).toBe('Updated');
    });
  });

  describe('deleteCampaign', () => {
    it('returns false when campaign not found', async () => {
      (mockPrisma.campaign.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.deleteCampaign('co-1', 'c-999');

      expect(result).toBe(false);
    });

    it('deletes and returns true when found', async () => {
      const campaign = makeCampaign('c-1');
      (mockPrisma.campaign.findFirst as jest.Mock).mockResolvedValue(campaign);
      (mockPrisma.campaign.delete as jest.Mock).mockResolvedValue(campaign);

      const result = await repo.deleteCampaign('co-1', 'c-1');

      expect(result).toBe(true);
    });
  });

  // ─── Tasks ──────────────────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns tasks for company', async () => {
      const tasks = [makeTask('t-1')];
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue(tasks);

      const result = await repo.listTasks('co-1');

      expect(result).toEqual(tasks);
    });

    it('filters by campaignId when provided', async () => {
      (mockPrisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await repo.listTasks('co-1', 'camp-1');

      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'co-1', campaignId: 'camp-1' },
        }),
      );
    });
  });

  describe('createTask', () => {
    it('creates task with TODO status and MEDIUM priority by default', async () => {
      const task = makeTask('t-new');
      (mockPrisma.task.create as jest.Mock).mockResolvedValue(task);

      const result = await repo.createTask('co-1', { title: 'Test Task' });

      expect(result).toEqual(task);
      expect(mockPrisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: TaskStatus.TODO,
            priority: TaskPriority.MEDIUM,
          }),
        }),
      );
    });
  });

  describe('updateTask', () => {
    it('returns null when task not found', async () => {
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.updateTask('co-1', 't-999', { title: 'Updated' });

      expect(result).toBeNull();
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('updates task status', async () => {
      const task = makeTask('t-1');
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(task);
      (mockPrisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: TaskStatus.DONE });

      const result = await repo.updateTask('co-1', 't-1', { status: TaskStatus.DONE });

      expect(result?.status).toBe(TaskStatus.DONE);
    });
  });

  describe('deleteTask', () => {
    it('returns false when task not found', async () => {
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.deleteTask('co-1', 't-999');

      expect(result).toBe(false);
    });

    it('deletes and returns true when found', async () => {
      const task = makeTask('t-1');
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(task);
      (mockPrisma.task.delete as jest.Mock).mockResolvedValue(task);

      const result = await repo.deleteTask('co-1', 't-1');

      expect(result).toBe(true);
    });

    it('enforces tenant isolation — only deletes when task belongs to company', async () => {
      (mockPrisma.task.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await repo.deleteTask('co-attacker', 't-1');

      expect(result).toBe(false);
      expect(mockPrisma.task.delete).not.toHaveBeenCalled();
    });
  });
});
