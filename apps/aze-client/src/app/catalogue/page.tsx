import { Product } from '@aze-mini/demo-contracts';
import { Wire } from '@aze-mini/platform-contracts';
import Link from 'next/link';
import { logout } from '../actions';
import { Shell } from '../../components/shell';
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
    <Shell
      action={
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-field px-3 py-1.5 text-sm font-medium hover:bg-surface"
          >
            Sign out
          </button>
        </form>
      }
    >
      <Link href="/" className="text-sm text-accent underline underline-offset-4">
        ← Back
      </Link>

      <h1 className="mt-4 text-display font-semibold">Catalogue</h1>

      {products.length === 0 ? (
        <p className="mt-8 rounded-lg border border-border bg-raised p-6 text-sm text-muted">
          Nothing here yet. Run{' '}
          <code className="rounded-sm bg-surface px-1 py-0.5">npx prisma db seed</code> in{' '}
          <code className="rounded-sm bg-surface px-1 py-0.5">apps/aze-api</code>.
        </p>
      ) : (
        <ul className="mt-8 space-y-3">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-start justify-between gap-6 rounded-lg border border-border bg-raised p-5"
            >
              <div>
                <h2 className="font-semibold">{product.name}</h2>
                {product.description && (
                  <p className="mt-1 text-sm text-muted">{product.description}</p>
                )}
              </div>
              <p className="shrink-0 text-sm font-medium tabular-nums">{product.price}</p>
            </li>
          ))}
        </ul>
      )}
    </Shell>
  );
}
