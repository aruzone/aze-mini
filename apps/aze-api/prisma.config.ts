import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma stops loading .env itself once this file exists, and DATABASE_URL
// lives there.
import 'dotenv/config';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: {
    // Demo — see docs/demo.md.
    seed: 'ts-node --compiler-options {"module":"CommonJS"} prisma/seed.ts',
  },
});
