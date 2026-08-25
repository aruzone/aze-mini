import { Product } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { currentToken } from '../../lib/session';

export const dynamic = 'force-dynamic';

// Demo: this page goes with the catalogue it renders — see docs/demo.md. What
// is worth keeping is the shape of it: a server component reading the session
// cookie, one typed call, and a contract nothing here redeclares.
export default async function CataloguePage() {
  const products = await apiFetch<Wire<Product>[]>('/products?limit=20', {
    token: await currentToken(),
  });

  return (
    <main className="mx-auto max-w-2xl p-8">
      <Link href="/" className="text-sm underline">
        ← Back
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Catalogue</h1>

      {products.length === 0 ? (
        <p className="mt-6 text-gray-600">
          Nothing here yet. Run <code>npx prisma db seed</code> in{' '}
          <code>apps/aze-api</code>.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {products.map((product) => (
            <li key={product.id} className="rounded-lg border p-4">
              <h2 className="font-semibold">{product.name}</h2>
              {product.description && (
                <p className="mt-1 text-sm text-gray-600">{product.description}</p>
              )}
              <p className="mt-2 text-sm">{product.price}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
