/**
 * The credentials the perimeter checks, named once. The guards read these and
 * the documentation advertises them, so the two cannot describe different
 * headers. See ADR-0002 for the perimeter itself.
 */
export const API_KEY_HEADER = 'x-api-key';

/** Names of the schemes in the OpenAPI document, referenced by the decorators. */
export const BEARER_SCHEME = 'bearer';
export const API_KEY_SCHEME = 'api-key';
