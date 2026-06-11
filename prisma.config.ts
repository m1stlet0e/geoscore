import path from 'node:path';
import { defineConfig } from 'prisma/config';
import 'dotenv/config';

const url = process.env.DATABASE_URL || 'postgresql://wangbo@localhost/geoos?schema=public';

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { path: path.join('prisma', 'migrations') },
  datasource: { url },
});
