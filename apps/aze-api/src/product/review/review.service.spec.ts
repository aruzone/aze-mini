import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import { ReviewService } from './review.service';

const PRODUCT_ID = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';

describe('ReviewService', () => {
  let service: ReviewService;

  const mockDatabaseService = {
    review: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('connects the product the flat id names', async () => {
    await service.create({ rating: 5, productId: PRODUCT_ID });

    expect(mockDatabaseService.review.create).toHaveBeenCalledWith({
      data: { rating: 5, product: { connect: { id: PRODUCT_ID } } },
    });
  });

  it('sends no productId column of its own', async () => {
    await service.create({ rating: 5, productId: PRODUCT_ID });

    const { data } = mockDatabaseService.review.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('productId');
  });

  it('leaves the product alone when the patch does not name one', async () => {
    await service.update('review-1', { rating: 4 });

    expect(mockDatabaseService.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { rating: 4 },
    });
  });

  it('reconnects the product when the patch names one', async () => {
    await service.update('review-1', { productId: PRODUCT_ID });

    expect(mockDatabaseService.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { product: { connect: { id: PRODUCT_ID } } },
    });
  });
});
