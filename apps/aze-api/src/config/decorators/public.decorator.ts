import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/**
 * Marks a route as reachable without a token. The JWT guard is global, so this
 * is the only way out of it — and the grep that answers which routes are
 * anonymous, so mark nothing with it that authenticates by other means.
 */
export const Public = () => SetMetadata(IS_PUBLIC, true);
