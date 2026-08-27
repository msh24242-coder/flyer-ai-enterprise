import { ProductsController } from '../products.controller';
import { ProductsService } from '../products.service';

const COMPANY_ID = 'co-1';
const USER = { id: 'user-1', email: 'u@acme.com', companyId: COMPANY_ID };

const mockService: jest.Mocked<ProductsService> = {
  list: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
} as never;

describe('ProductsController', () => {
  let controller: ProductsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProductsController(mockService);
  });

  it('list delegates to the service with the requester id', async () => {
    mockService.list.mockResolvedValue([]);
    await controller.list(COMPANY_ID, USER as never, 'widget');
    expect(mockService.list).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'widget');
  });

  it('create delegates to the service', async () => {
    const dto = { sku: 'SKU-1', name: 'Widget', basePrice: 10 };
    mockService.create.mockResolvedValue({ id: 'prod-1', ...dto } as never);
    const result = await controller.create(COMPANY_ID, dto as never, USER as never);
    expect(mockService.create).toHaveBeenCalledWith(COMPANY_ID, USER.id, dto);
    expect(result).toEqual({ id: 'prod-1', ...dto });
  });

  it('delete delegates to the service', async () => {
    await controller.delete(COMPANY_ID, 'prod-1', USER as never);
    expect(mockService.delete).toHaveBeenCalledWith(COMPANY_ID, USER.id, 'prod-1');
  });
});
