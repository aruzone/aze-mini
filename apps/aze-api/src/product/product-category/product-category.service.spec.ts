import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import { ProductCategoryService } from './product-category.service';
import { AuditService } from '../../audit/audit.service';

const ACTOR_USER_ID = 'user-1';

describe('ProductCategoryService', () => {
  let service: ProductCategoryService;

  const mockDatabaseService = {
    productCategory: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: { count: jest.fn() },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work(mockDatabaseService),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockDatabaseService.productCategory.delete.mockResolvedValue({ id: 50 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductCategoryService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: AuditService, useValue: { append: jest.fn() } },
      ],
    }).compile();

    service = module.get<ProductCategoryService>(ProductCategoryService);
  });

  describe('deleting a category products still point at', () => {
    it('refuses, naming how many products are in the way', async () => {
      mockDatabaseService.product.count.mockResolvedValue(3);

      await expect(service.remove(50, ACTOR_USER_ID)).rejects.toThrow(
        new ConflictException('Product category with ID 50 still has 3 products'),
      );
    });

    it('never reaches the database with the delete', async () => {
      mockDatabaseService.product.count.mockResolvedValue(3);

      await expect(service.remove(50, ACTOR_USER_ID)).rejects.toBeInstanceOf(ConflictException);
      expect(mockDatabaseService.productCategory.delete).not.toHaveBeenCalled();
    });

    it('counts only the products of the category being deleted', async () => {
      mockDatabaseService.product.count.mockResolvedValue(0);

      await service.remove(50, ACTOR_USER_ID);

      expect(mockDatabaseService.product.count).toHaveBeenCalledWith({
        where: { categoryId: 50 },
      });
    });

    // A category nothing points at is still an ordinary delete, and a missing
    // one has to reach the filter as the P2025 it is.
    it('deletes a category no product points at', async () => {
      mockDatabaseService.product.count.mockResolvedValue(0);
      mockDatabaseService.productCategory.delete.mockResolvedValue({ id: 50 });

      await expect(service.remove(50, ACTOR_USER_ID)).resolves.toEqual({ id: 50 });
      expect(mockDatabaseService.productCategory.delete).toHaveBeenCalledWith({
        where: { id: 50 },
      });
    });
  });
});
