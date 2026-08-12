import { BadRequestException } from '@nestjs/common';
import { CreateProductDto } from '../product/products/dto/create-product.dto';
import { validationPipe } from './validation';

const metadata = {
  type: 'body' as const,
  metatype: CreateProductDto,
};

describe('the global validation pipe', () => {
  const pipe = validationPipe();

  it('accepts a body matching the contract', async () => {
    const body = { name: 'Widget', price: 9.99, categoryId: 3 };

    await expect(pipe.transform(body, metadata)).resolves.toMatchObject(body);
  });

  // Binding a Prisma input to the body let a caller set any column. Unknown
  // properties are refused by name rather than quietly dropped, so a caller
  // sending one is told, instead of watching it vanish.
  it('refuses a property the contract does not declare', async () => {
    const body = { name: 'Widget', price: 9.99, categoryId: 3, id: 'chosen-by-caller' };

    await expect(pipe.transform(body, metadata)).rejects.toThrow(BadRequestException);
  });

  // The detail a caller acts on is in the response body, not the exception
  // message, so that is where these look.
  async function refusalFor(body: unknown) {
    const error = await pipe
      .transform(body, metadata)
      .then(() => null)
      .catch((e: BadRequestException) => e);

    expect(error).toBeInstanceOf(BadRequestException);
    return (error as BadRequestException).getResponse() as {
      statusCode: number;
      message: string[];
    };
  }

  it('names the offending property when it refuses one', async () => {
    const refusal = await refusalFor({
      name: 'Widget',
      price: 9.99,
      categoryId: 3,
      createdAt: 'yesterday',
    });

    expect(refusal.statusCode).toBe(400);
    expect(refusal.message.join(' ')).toMatch(/createdAt/);
  });

  it('names every failing field, not just the first', async () => {
    const refusal = await refusalFor({ name: '', price: 'free', categoryId: 3 });

    expect(refusal.message.join(' ')).toMatch(/name/);
    expect(refusal.message.join(' ')).toMatch(/price/);
  });

  it('refuses a body that is not an object at all', async () => {
    await expect(pipe.transform('not a product', metadata)).rejects.toThrow(
      BadRequestException,
    );
  });
});
