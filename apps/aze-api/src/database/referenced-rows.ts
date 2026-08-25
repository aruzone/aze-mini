import { ConflictException } from '@nestjs/common';

/** The API's words for the rows that point at the one being deleted. */
export type Referrers = {
  readonly one: string;
  readonly many: string;
};

/**
 * Every relation in the schema is `RESTRICT`, Prisma's default, so the database
 * refuses to delete a row something still points at. It refuses as driver text
 * carrying no Prisma code the exception filter can name, which reaches the
 * caller as a 500 — the Starter looking broken over a request the schema was
 * always going to turn down.
 *
 * So a delete asks first. The cost is one count on every delete; what it buys
 * is a refusal that says what is in the way in the API's own words. Count and
 * delete are two statements, so a row created between them still loses to the
 * database, and that race alone still answers 500.
 */
export async function refuseIfReferenced(
  subject: string,
  referrers: Referrers,
  count: () => Promise<number>,
): Promise<void> {
  const total = await count();
  if (total > 0) {
    throw new ConflictException(
      `${subject} still has ${total} ${total === 1 ? referrers.one : referrers.many}`,
    );
  }
}
