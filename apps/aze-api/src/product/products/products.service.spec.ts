import { Test, TestingModule } from '@nestjs/testing';
import { ProductsService } from './products.service';
import { DatabaseService } from '../../database/database.service';
import { ConfigService } from '@nestjs/config';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockDatabaseService = {
    product: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = { get: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // The flat id is the wire contract; Prisma's nested connect is this service's
  // business. These pin the translation between the two.
  describe('create', () => {
    it('connects the category the flat id names', async () => {
      await service.create({ name: 'Widget', price: 9.99, categoryId: 3 });

      expect(mockDatabaseService.product.create).toHaveBeenCalledWith({
        data: { name: 'Widget', price: 9.99, category: { connect: { id: 3 } } },
      });
    });

    it('sends no categoryId column of its own', async () => {
      await service.create({ name: 'Widget', price: 9.99, categoryId: 3 });

      const { data } = mockDatabaseService.product.create.mock.calls[0][0];
      expect(data).not.toHaveProperty('categoryId');
    });
  });

  describe('update', () => {
    it('leaves the category alone when the patch does not name one', async () => {
      await service.update('product-1', { name: 'Widget II' });

      expect(mockDatabaseService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { name: 'Widget II' },
      });
    });

    it('reconnects the category when the patch names one', async () => {
      await service.update('product-1', { categoryId: 7 });

      expect(mockDatabaseService.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { category: { connect: { id: 7 } } },
      });
    });
  });
});
