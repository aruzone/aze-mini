import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '../../database/database.service';
import { TagService } from './tag.service';

const PRODUCT_A = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e6f';
const PRODUCT_B = '0195f0e1-3c8a-7000-8000-2b1f9c4d5e70';

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
});
