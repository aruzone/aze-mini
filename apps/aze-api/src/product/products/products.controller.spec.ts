import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ApiKeyGuard } from '../../config/guards/api-key.guard';
import { AuthGuard } from '../../config/guards/auth.guard';

describe('ProductsController', () => {
  let controller: ProductsController;

  const mockProductsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockGuard = { canActivate: jest.fn(() => true) };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProductsController],
      providers: [{ provide: ProductsService, useValue: mockProductsService }],
    })
      .overrideGuard(ApiKeyGuard).useValue(mockGuard)
      .overrideGuard(AuthGuard).useValue(mockGuard)
      .compile();

    controller = module.get<ProductsController>(ProductsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // The service answers with the product and where it came from. Only one of
  // those belongs in the body; the other is the header a caller reads.
  describe('the cache status of a read', () => {
    const response = { setHeader: jest.fn() } as unknown as Response;

    it('returns the product and reports the cache it came from', async () => {
      mockProductsService.findOne.mockResolvedValue({ value: { id: 'product-1' }, hit: true });

      const body = await controller.findOne('product-1', response);

      expect(body).toEqual({ id: 'product-1' });
      expect(response.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
    });

    it('reports a list the database answered as a miss', async () => {
      mockProductsService.findAll.mockResolvedValue({ value: [], hit: false });

      const body = await controller.findAll('asc', 10, response);

      expect(body).toEqual([]);
      expect(response.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    });
  });
});
