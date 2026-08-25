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
 * What both auth routes answer with. `accessToken` is the bearer token every
 * other route wants, and the response carries no password field in any form.
 */
export type AuthResponse = {
  userId: string;
  email: string;
  accessToken: string;
};
