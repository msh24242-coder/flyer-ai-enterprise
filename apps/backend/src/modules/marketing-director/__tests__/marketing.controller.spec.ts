import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { MarketingController } from '../marketing.controller';
import { MarketingRepository } from '../repositories/marketing.repository';
import { CompanyService } from '../../company/company.service';
import { GoalStatus, CampaignStatus, TaskStatus } from '@prisma/client';

const COMPANY_ID = 'company-abc';
const USER = { id: 'user-1', email: 'u@example.com', companyId: COMPANY_ID };

const mockRepo = {
  listGoals: jest.fn(),
  createGoal: jest.fn(),
  updateGoal: jest.fn(),
  deleteGoal: jest.fn(),
  listCampaigns: jest.fn(),
  createCampaign: jest.fn(),
  updateCampaign: jest.fn(),
  deleteCampaign: jest.fn(),
  listTasks: jest.fn(),
  createTask: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
} as unknown as jest.Mocked<MarketingRepository>;

const mockCompanyService = {
  getCompany: jest.fn(),
} as unknown as jest.Mocked<CompanyService>;

describe('MarketingController', () => {
  let controller: MarketingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MarketingController(mockRepo, mockCompanyService);
    mockCompanyService.getCompany.mockResolvedValue({ id: COMPANY_ID } as never);
  });

  // ─── Goals ─────────────────────────────────────────────────────────────────

  describe('listGoals', () => {
    it('returns goals for a member', async () => {
      const goals = [{ id: 'g1', title: 'Goal 1', status: GoalStatus.ACTIVE }];
      mockRepo.listGoals.mockResolvedValue(goals as never);

      const result = await controller.listGoals(COMPANY_ID, USER as never, undefined);
      expect(result).toEqual(goals);
      expect(mockRepo.listGoals).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });

    it('passes valid status filter to repo', async () => {
      mockRepo.listGoals.mockResolvedValue([]);

      await controller.listGoals(COMPANY_ID, USER as never, 'ACTIVE');
      expect(mockRepo.listGoals).toHaveBeenCalledWith(COMPANY_ID, GoalStatus.ACTIVE);
    });

    it('ignores unknown status values', async () => {
      mockRepo.listGoals.mockResolvedValue([]);

      await controller.listGoals(COMPANY_ID, USER as never, 'BOGUS_STATUS');
      expect(mockRepo.listGoals).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });

    it('throws ForbiddenException when user is not a member', async () => {
      mockCompanyService.getCompany.mockRejectedValue(new ForbiddenException());
      await expect(
        controller.listGoals(COMPANY_ID, USER as never, undefined),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('createGoal', () => {
    it('creates and returns a goal', async () => {
      const dto = { title: 'Launch campaign', description: 'Q4 push' };
      const created = { id: 'g2', ...dto, status: GoalStatus.ACTIVE };
      mockRepo.createGoal.mockResolvedValue(created as never);

      const result = await controller.createGoal(COMPANY_ID, dto, USER as never);
      expect(result).toEqual(created);
      expect(mockRepo.createGoal).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });

  describe('updateGoal', () => {
    it('returns updated goal', async () => {
      const updated = { id: 'g1', title: 'Updated', status: GoalStatus.COMPLETED };
      mockRepo.updateGoal.mockResolvedValue(updated as never);

      const result = await controller.updateGoal(COMPANY_ID, 'g1', { title: 'Updated' }, USER as never);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when goal does not exist', async () => {
      mockRepo.updateGoal.mockResolvedValue(null as never);
      await expect(
        controller.updateGoal(COMPANY_ID, 'no-such-goal', { title: 'X' }, USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteGoal', () => {
    it('succeeds when goal exists', async () => {
      mockRepo.deleteGoal.mockResolvedValue(true as never);
      await expect(
        controller.deleteGoal(COMPANY_ID, 'g1', USER as never),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when goal does not exist', async () => {
      mockRepo.deleteGoal.mockResolvedValue(false as never);
      await expect(
        controller.deleteGoal(COMPANY_ID, 'no-such-goal', USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Campaigns ─────────────────────────────────────────────────────────────

  describe('listCampaigns', () => {
    it('returns campaigns for a member', async () => {
      const campaigns = [{ id: 'c1', title: 'Email blast', status: CampaignStatus.ACTIVE }];
      mockRepo.listCampaigns.mockResolvedValue(campaigns as never);

      const result = await controller.listCampaigns(COMPANY_ID, USER as never, undefined, undefined);
      expect(result).toEqual(campaigns);
      expect(mockRepo.listCampaigns).toHaveBeenCalledWith(COMPANY_ID, undefined, undefined);
    });

    it('passes valid status and goalId filters', async () => {
      mockRepo.listCampaigns.mockResolvedValue([]);

      await controller.listCampaigns(COMPANY_ID, USER as never, 'ACTIVE', 'goal-1');
      expect(mockRepo.listCampaigns).toHaveBeenCalledWith(COMPANY_ID, 'goal-1', CampaignStatus.ACTIVE);
    });

    it('ignores invalid status values', async () => {
      mockRepo.listCampaigns.mockResolvedValue([]);

      await controller.listCampaigns(COMPANY_ID, USER as never, 'NOT_A_STATUS', undefined);
      expect(mockRepo.listCampaigns).toHaveBeenCalledWith(COMPANY_ID, undefined, undefined);
    });
  });

  describe('createCampaign', () => {
    it('creates and returns a campaign', async () => {
      const dto = { title: 'Q4 social push', budget: 5000 };
      const created = { id: 'c2', ...dto, status: CampaignStatus.DRAFT };
      mockRepo.createCampaign.mockResolvedValue(created as never);

      const result = await controller.createCampaign(COMPANY_ID, dto, USER as never);
      expect(result).toEqual(created);
      expect(mockRepo.createCampaign).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });

  describe('updateCampaign', () => {
    it('returns updated campaign', async () => {
      const updated = { id: 'c1', title: 'Updated', status: CampaignStatus.ACTIVE };
      mockRepo.updateCampaign.mockResolvedValue(updated as never);

      const result = await controller.updateCampaign(COMPANY_ID, 'c1', { title: 'Updated' }, USER as never);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockRepo.updateCampaign.mockResolvedValue(null as never);
      await expect(
        controller.updateCampaign(COMPANY_ID, 'bad-id', {}, USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteCampaign', () => {
    it('succeeds when campaign exists', async () => {
      mockRepo.deleteCampaign.mockResolvedValue(true as never);
      await expect(
        controller.deleteCampaign(COMPANY_ID, 'c1', USER as never),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when campaign does not exist', async () => {
      mockRepo.deleteCampaign.mockResolvedValue(false as never);
      await expect(
        controller.deleteCampaign(COMPANY_ID, 'bad-id', USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Tasks ─────────────────────────────────────────────────────────────────

  describe('listTasks', () => {
    it('returns tasks for a member', async () => {
      const tasks = [{ id: 't1', title: 'Write copy', status: TaskStatus.TODO, priority: 'HIGH' }];
      mockRepo.listTasks.mockResolvedValue(tasks as never);

      const result = await controller.listTasks(COMPANY_ID, USER as never, undefined);
      expect(result).toEqual(tasks);
      expect(mockRepo.listTasks).toHaveBeenCalledWith(COMPANY_ID, undefined);
    });

    it('passes campaignId filter through', async () => {
      mockRepo.listTasks.mockResolvedValue([]);

      await controller.listTasks(COMPANY_ID, USER as never, 'campaign-1');
      expect(mockRepo.listTasks).toHaveBeenCalledWith(COMPANY_ID, 'campaign-1');
    });
  });

  describe('createTask', () => {
    it('creates and returns a task', async () => {
      const dto = { title: 'Write copy', priority: 'HIGH' as const };
      const created = { id: 't2', ...dto, status: TaskStatus.TODO };
      mockRepo.createTask.mockResolvedValue(created as never);

      const result = await controller.createTask(COMPANY_ID, dto, USER as never);
      expect(result).toEqual(created);
      expect(mockRepo.createTask).toHaveBeenCalledWith(COMPANY_ID, dto);
    });
  });

  describe('updateTask', () => {
    it('returns updated task', async () => {
      const updated = { id: 't1', title: 'Write copy', status: TaskStatus.IN_PROGRESS, priority: 'HIGH' };
      mockRepo.updateTask.mockResolvedValue(updated as never);

      const result = await controller.updateTask(COMPANY_ID, 't1', { status: 'IN_PROGRESS' as TaskStatus }, USER as never);
      expect(result).toEqual(updated);
    });

    it('throws NotFoundException when task does not exist', async () => {
      mockRepo.updateTask.mockResolvedValue(null as never);
      await expect(
        controller.updateTask(COMPANY_ID, 'bad-id', {}, USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTask', () => {
    it('succeeds when task exists', async () => {
      mockRepo.deleteTask.mockResolvedValue(true as never);
      await expect(
        controller.deleteTask(COMPANY_ID, 't1', USER as never),
      ).resolves.toBeUndefined();
    });

    it('throws NotFoundException when task does not exist', async () => {
      mockRepo.deleteTask.mockResolvedValue(false as never);
      await expect(
        controller.deleteTask(COMPANY_ID, 'bad-id', USER as never),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
