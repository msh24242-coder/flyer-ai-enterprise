import { FlyersController } from '../flyers.controller';
import { FlyersService } from '../flyers.service';
import { FlyerStatus } from '@prisma/client';

const COMPANY_ID = 'co-1';
const USER = { id: 'user-1', email: 'u@acme.com', companyId: COMPANY_ID };

const mockService: jest.Mocked<FlyersService> = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  duplicate: jest.fn(),
  addProduct: jest.fn(),
  updateProduct: jest.fn(),
  removeProduct: jest.fn(),
  reorderProducts: jest.fn(),
} as never;

describe('FlyersController', () => {
  let controller: FlyersController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new FlyersController(mockService);
  });

  it('list passes query filters and the requester id', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(USER as never, FlyerStatus.DRAFT, 'camp-1');
    expect(mockService.list).toHaveBeenCalledWith(COMPANY_ID, USER.id, { status: FlyerStatus.DRAFT, campaignId: 'camp-1' });
  });

  it('create delegates to the service', async () => {
    const dto = { title: 'Weekly Offers' };
    mockService.create.mockResolvedValue({ id: 'flyer-1', ...dto } as never);
    const result = await controller.create(USER as never, dto as never);
    expect(mockService.create).toHaveBeenCalledWith(COMPANY_ID, USER.id, dto);
    expect(result).toEqual({ id: 'flyer-1', ...dto });
  });

  it('getById delegates to the service', async () => {
    mockService.getById.mockResolvedValue({ id: 'flyer-1' } as never);
    await controller.getById('flyer-1', USER as never);
    expect(mockService.getById).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('update delegates to the service', async () => {
    const dto = { title: 'New' };
    await controller.update('flyer-1', dto as never, USER as never);
    expect(mockService.update).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto);
  });

  it('delete delegates to the service', async () => {
    await controller.delete('flyer-1', USER as never);
    expect(mockService.delete).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('duplicate delegates to the service', async () => {
    mockService.duplicate.mockResolvedValue({ id: 'flyer-2' } as never);
    await controller.duplicate('flyer-1', USER as never);
    expect(mockService.duplicate).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1');
  });

  it('addProduct delegates to the service', async () => {
    const dto = { productId: 'prod-1' };
    await controller.addProduct('flyer-1', dto as never, USER as never);
    expect(mockService.addProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto);
  });

  it('updateProduct delegates to the service', async () => {
    const dto = { displayPrice: 5 };
    await controller.updateProduct('flyer-1', 'prod-1', dto as never, USER as never);
    expect(mockService.updateProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', 'prod-1', dto);
  });

  it('removeProduct delegates to the service', async () => {
    await controller.removeProduct('flyer-1', 'prod-1', USER as never);
    expect(mockService.removeProduct).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', 'prod-1');
  });

  it('reorderProducts delegates to the service', async () => {
    const dto = { order: ['prod-b', 'prod-a'] };
    await controller.reorderProducts('flyer-1', dto as never, USER as never);
    expect(mockService.reorderProducts).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'flyer-1', dto.order);
  });
});
