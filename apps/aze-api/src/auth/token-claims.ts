/**
 * The claims AuthService.login signs into a token, and the only ones AuthGuard
 * may read back out. Naming them once is what keeps the two in step: a claim
 * renamed here breaks both sides at compile time, rather than surfacing as a
 * permanently undefined field on the authenticated request context.
 */
export type TokenClaims = {
  sub: string;
  email: string;
  verified: boolean;
};

/** The identity AuthGuard attaches to a request, built from those claims. */
export type AuthenticatedUser = {
  userId: string;
  email: string;
  verified: boolean;
};

