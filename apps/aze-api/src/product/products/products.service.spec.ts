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
});
