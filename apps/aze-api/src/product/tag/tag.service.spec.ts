import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaClientKnownRequestError } from '../../../generated/prisma/runtime/library';
import { DatabaseService } from '../../database/database.service';
import { TagService } from './tag.service';

const PRODUCT_A = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';
const PRODUCT_B = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e70';

const connectFoundNothing = () =>
  new PrismaClientKnownRequestError('An operation failed', {
    code: 'P2025',
    clientVersion: '6.19.2',
    meta: { modelName: 'Tag', cause: 'Expected 1 records to be connected, found only 0.' },
  });

describe('TagService', () => {
  let service: TagService;

  const mockDatabaseService = {
    tag: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    product: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TagService, { provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  it('creates a Tag linked to nothing when no products are named', async () => {
    await service.create({ name: 'seasonal' });

    expect(mockDatabaseService.tag.create).toHaveBeenCalledWith({
      data: { name: 'seasonal' },
    });
  });

  it('connects the products the flat ids name', async () => {
    await service.create({ name: 'seasonal', productIds: [PRODUCT_A, PRODUCT_B] });

    expect(mockDatabaseService.tag.create).toHaveBeenCalledWith({
      data: {
        name: 'seasonal',
        products: { connect: [{ id: PRODUCT_A }, { id: PRODUCT_B }] },
      },
    });
  });

  // Replace rather than add: a patch naming one product leaves the Tag on that
  // product alone, which is what a caller sending the whole list expects.
  it('replaces the linked products on update', async () => {
    await service.update('tag-1', { productIds: [PRODUCT_B] });

    expect(mockDatabaseService.tag.update).toHaveBeenCalledWith({
      where: { id: 'tag-1' },
      data: { products: { set: [{ id: PRODUCT_B }] } },
    });
  });

  it('leaves the links alone when the patch does not name products', async () => {
    await service.update('tag-1', { name: 'evergreen' });

    expect(mockDatabaseService.tag.update).toHaveBeenCalledWith({
      where: { id: 'tag-1' },
      data: { name: 'evergreen' },
    });
  });

  // Prisma counts the rows it connected and stops there: "expected 1, found 0"
  // is no help to a caller who sent a list.
  it('names every product in the list that is absent', async () => {
    mockDatabaseService.tag.create.mockRejectedValue(connectFoundNothing());
    mockDatabaseService.product.findMany.mockResolvedValue([]);

    await expect(
      service.create({ name: 'seasonal', productIds: [PRODUCT_A, PRODUCT_B] }),
    ).rejects.toThrow(
      new NotFoundException(`Products with IDs ${PRODUCT_A}, ${PRODUCT_B} not found`),
    );
  });

  it('rethrows when every product it named exists', async () => {
    const original = connectFoundNothing();
    mockDatabaseService.tag.update.mockRejectedValue(original);
    mockDatabaseService.product.findMany.mockResolvedValue([{ id: PRODUCT_B }]);

    await expect(service.update('tag-1', { productIds: [PRODUCT_B] })).rejects.toBe(original);
  });
});
