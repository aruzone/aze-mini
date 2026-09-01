import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/runtime/library';
import { DatabaseService } from '../../database/database.service';
import { ReviewService } from './review.service';
import { AuditService } from '../../audit/audit.service';

const PRODUCT_ID = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';
const ACTOR_USER_ID = 'user-1';

const connectFoundNothing = () =>
  new PrismaClientKnownRequestError('An operation failed', {
    code: 'P2025',
    clientVersion: '6.19.2',
    meta: { modelName: 'Review', cause: 'No record was found for a nested connect.' },
  });

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
    product: { findUnique: jest.fn() },
    $transaction: (work: (tx: unknown) => Promise<unknown>) =>
      work(mockDatabaseService),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    mockDatabaseService.review.create.mockResolvedValue({ id: 'review-1' });
    mockDatabaseService.review.update.mockResolvedValue({ id: 'review-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReviewService,
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: AuditService, useValue: { append: jest.fn() } },
      ],
    }).compile();

    service = module.get<ReviewService>(ReviewService);
  });

  it('connects the product the flat id names', async () => {
    await service.create({ rating: 5, productId: PRODUCT_ID }, ACTOR_USER_ID);

    expect(mockDatabaseService.review.create).toHaveBeenCalledWith({
      data: { rating: 5, product: { connect: { id: PRODUCT_ID } } },
    });
  });

  it('sends no productId column of its own', async () => {
    await service.create({ rating: 5, productId: PRODUCT_ID }, ACTOR_USER_ID);

    const { data } = mockDatabaseService.review.create.mock.calls[0][0];
    expect(data).not.toHaveProperty('productId');
  });

  it('leaves the product alone when the patch does not name one', async () => {
    await service.update('review-1', { rating: 4 }, ACTOR_USER_ID);

    expect(mockDatabaseService.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { rating: 4 },
    });
  });

  it('reconnects the product when the patch names one', async () => {
    await service.update('review-1', { productId: PRODUCT_ID }, ACTOR_USER_ID);

    expect(mockDatabaseService.review.update).toHaveBeenCalledWith({
      where: { id: 'review-1' },
      data: { product: { connect: { id: PRODUCT_ID } } },
    });
  });

  it('names the product a review was filed against when it is absent', async () => {
    mockDatabaseService.review.create.mockRejectedValue(connectFoundNothing());
    mockDatabaseService.product.findUnique.mockResolvedValue(null);

    await expect(service.create({ rating: 5, productId: PRODUCT_ID }, ACTOR_USER_ID)).rejects.toThrow(
      new NotFoundException(`Product with ID ${PRODUCT_ID} not found`),
    );
  });

  // The product exists, so it is the Review the route named that is missing.
  it('rethrows when the product it named exists', async () => {
    const original = connectFoundNothing();
    mockDatabaseService.review.update.mockRejectedValue(original);
    mockDatabaseService.product.findUnique.mockResolvedValue({ id: PRODUCT_ID });

    await expect(service.update('review-1', { productId: PRODUCT_ID }, ACTOR_USER_ID)).rejects.toBe(original);
  });
});
