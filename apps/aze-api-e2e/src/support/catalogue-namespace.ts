import { randomUUID } from 'node:crypto';

export const E2E_CATALOGUE_NAME_PREFIX = 'E2E::aze-api::';

export function catalogueFixtureName(label: string): string {
  return `${E2E_CATALOGUE_NAME_PREFIX}${label} ${randomUUID()}`;
}
