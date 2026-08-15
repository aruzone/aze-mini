import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { CacheService } from '../../cache/cache.service';

/**
 * How long a cached product or list is served before the database is asked
 * again. Short on purpose: a write invalidates what it touches, so this is the
 * ceiling on staleness caused by something the Starter did not see — a row
 * changed by a migration, an admin tool, or an invalidation Redis dropped.
 */
export const PRODUCT_CACHE_TTL_MS = 60_000;

/**
 * The generation outlives the lists it names, or the lists would go on being
 * stored under a key nothing would ever read again.
 */
export const PRODUCT_LIST_GENERATION_TTL_MS = 24 * 60 * 60 * 1000;

export const PRODUCT_LIST_GENERATION_KEY = 'products:list:generation';

export interface CachedRead<T> {
  value: T;
  hit: boolean;
}

/**
 * The Demo of caching: one read path in front of Postgres, with the keys, the
 * time to live and the invalidation all spelled out here rather than inferred
 * from a route. An Adopter reads this one file to see the whole pattern, then
 * writes their own — see docs/demo.md.
 */
@Injectable()
export class ProductCache {
  constructor(private readonly cache: CacheService) {}

  async readOne<T>(id: string, load: () => Promise<T>): Promise<CachedRead<T>> {
    return this.read(productKey(id), load);
  }

  async readList<T>(
    sort: 'asc' | 'desc',
    limit: number | undefined,
    load: () => Promise<T>,
  ): Promise<CachedRead<T>> {
    return this.read(await this.listKey(sort, limit), load);
  }

  /** Forgets a product that has changed, and every list it appeared in. */
  async forget(id: string): Promise<void> {
    await this.cache.del(productKey(id));
    await this.forgetList();
  }

  /** Forgets every list, whatever sort and limit it was read under. */
  async forgetList(): Promise<void> {
    await this.cache.del(PRODUCT_LIST_GENERATION_KEY);
  }

  private async read<T>(key: string, load: () => Promise<T>): Promise<CachedRead<T>> {
    const cached = await this.cache.get<T>(key);
    if (cached !== undefined) {
      return { value: cached, hit: true };
    }

    const value = await load();
    await this.cache.set(key, value, PRODUCT_CACHE_TTL_MS);
    return { value, hit: false };
  }

  // A list is keyed by the generation current when it was read. Forgetting the
  // generation leaves every key minted under the old one unreachable, so one
  // deletion invalidates a set whose members were never enumerated. The keys
  // themselves are left to their own expiry rather than scanned for and
  // deleted, which is what keeps invalidation O(1) at any catalogue size.
  private async listKey(sort: 'asc' | 'desc', limit: number | undefined) {
    const generation = await this.currentGeneration();
    return `products:list:${generation}:${sort}:${limit ?? 'all'}`;
  }

  private async currentGeneration() {
    const stored = await this.cache.get<string>(PRODUCT_LIST_GENERATION_KEY);
    if (stored) {
      return stored;
    }

    // Two readers racing here mint different generations and both write a list
    // nobody will read. That costs a query, never a wrong answer.
    const minted = randomUUID();
    await this.cache.set(
      PRODUCT_LIST_GENERATION_KEY,
      minted,
      PRODUCT_LIST_GENERATION_TTL_MS,
    );
    return minted;
  }
}

const productKey = (id: string) => `products:${id}`;
