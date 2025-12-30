import type { PrismaClient } from '@prisma/client';

export interface IDatabase {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  client: PrismaClient;
}
