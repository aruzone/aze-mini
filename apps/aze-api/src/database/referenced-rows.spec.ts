import { ConflictException } from '@nestjs/common';
import { refuseIfReferenced } from './referenced-rows';

const products = { one: 'product', many: 'products' };

describe('refuseIfReferenced', () => {
  it('lets a delete through when nothing points at the row', async () => {
    await expect(
      refuseIfReferenced('Product category with ID 50', products, async () => 0),
    ).resolves.toBeUndefined();
  });

  // The caller mistyped nothing: they asked for something the schema forbids,
  // so the message has to say what is in the way, in the API's own nouns.
  it('refuses with a conflict naming how many are in the way', async () => {
    await expect(
      refuseIfReferenced('Product category with ID 50', products, async () => 3),
    ).rejects.toThrow(
      new ConflictException('Product category with ID 50 still has 3 products'),
    );
  });

  it('speaks of a single reference in the singular', async () => {
    await expect(
      refuseIfReferenced('Product category with ID 50', products, async () => 1),
    ).rejects.toThrow(
      new ConflictException('Product category with ID 50 still has 1 product'),
    );
  });
});
