/**
 * The port the API under test is expected to serve on.
 *
 * Defined once here and used by both global-setup and test-setup — these
 * previously defaulted to 3000 independently while the API served on 3030,
 * so the suite timed out in setup and never ran a single spec.
 *
 * The default is still duplicated with the API's own config. Collapsing that
 * into a single shared source needs the shared contracts package from #10.
 */
export const API_PORT = Number(process.env.PORT ?? 3030);

export const API_HOST = process.env.HOST ?? 'localhost';

export const API_BASE_URL = `http://${API_HOST}:${API_PORT}`;
