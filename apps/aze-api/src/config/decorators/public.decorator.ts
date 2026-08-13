import { SetMetadata, applyDecorators } from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';

export const IS_PUBLIC = 'isPublic';

/**
 * Marks a route as reachable without a token. The JWT guard is global, so this
 * is the only way out of it — and the grep that answers which routes are
 * anonymous, so mark nothing with it that authenticates by other means.
 *
 * The empty security requirement is what tells the docs this route needs no
 * credential, overriding the document-wide bearer requirement.
 */
export const Public = () => applyDecorators(SetMetadata(IS_PUBLIC, true), ApiSecurity({}));
