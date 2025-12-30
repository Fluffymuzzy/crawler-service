import { injectable } from 'inversify';
import { PrismaClient } from '@prisma/client';
import { IDatabase } from '../interfaces/external/database.interface';

@injectable()
export class PrismaDatabase extends PrismaClient implements IDatabase {
  get client(): PrismaClient {
    return this;
  }

  async connect(): Promise<void> {
    await this.$connect();
  }

  async disconnect(): Promise<void> {
    await this.$disconnect();
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    return await this.$transaction(async () => {
      return await fn();
    });
  }
}
