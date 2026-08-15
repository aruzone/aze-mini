/** `X-Cache: HIT | MISS`, the convention every CDN already answers with. */
export const CACHE_STATUS_HEADER = 'X-Cache';

export const cacheStatus = (hit: boolean) => (hit ? 'HIT' : 'MISS');
