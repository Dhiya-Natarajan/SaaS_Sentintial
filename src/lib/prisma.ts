import 'dotenv/config';
import path from 'path';
import { PrismaClient } from '@prisma/client';

function normalizeSqliteUrl(url?: string) {
  if (!url || !url.startsWith('file:./')) {
    return url;
  }

  const relativePath = url.slice('file:'.length).replace(/^\.\//, '');
  const rootRelativePath = relativePath.startsWith('prisma/')
    ? relativePath
    : path.join('prisma', relativePath);

  return `file:${path.resolve(process.cwd(), rootRelativePath)}`;
}

const normalizedDatabaseUrl = normalizeSqliteUrl(process.env.DATABASE_URL);

if (normalizedDatabaseUrl) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

const globalForPrisma = globalThis as {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
