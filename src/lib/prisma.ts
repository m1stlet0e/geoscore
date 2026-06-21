// Prisma 7 client singleton — PrismaPg adapter（Turbopack需要 serverExternalPackages）
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL environment variable is required');
  const adapter = new PrismaPg(url);
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
