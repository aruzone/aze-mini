/**
 * What `GET /users/me` answers with: the User the token identifies. The
 * password is absent from the type as it is absent from the response — the
 * users service omits it from every read.
 */
export type UserProfile = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
  updatedAt: Date;
};
