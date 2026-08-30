/** The body `POST /auth/register` accepts. */
export type RegisterRequest = {
  email: string;
  password: string;
  name?: string;
};

/** The body `POST /auth/login` accepts. */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * What `POST /auth/login` answers with. `accessToken` is the bearer token every
 * other route wants, and the response carries no password field in any form.
 * The refresh token is deliberately absent: it travels only as an httpOnly
 * cookie the API sets alongside this body (ADR-0009) — a thirty-day
 * credential has no business in a response body a browser could log.
 */
export type AuthResponse = {
  userId: string;
  email: string;
  accessToken: string;
};

/**
 * What `POST /auth/forgot-password` accepts, and what `POST /auth/reset-password`
 * and `POST /auth/verify-email` answer with. The answer is the same whether or
 * not the address is registered — enumeration-safe (ADR-0011) — so it says
 * nothing about any account.
 */
export type AuthNotice = {
  message: string;
};

/** The body `POST /auth/forgot-password` accepts. */
export type ForgotPasswordRequest = {
  email: string;
};

/** The body `POST /auth/reset-password` accepts. The token arrived by email. */
export type ResetPasswordRequest = {
  token: string;
  password: string;
};

/** The body `POST /auth/verify-email` accepts. The token arrived by email. */
export type VerifyEmailRequest = {
  token: string;
};
