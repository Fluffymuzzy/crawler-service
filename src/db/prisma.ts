import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

class PrismaService {
  private prisma: PrismaClient;
  private isShuttingDown = false;

  constructor() {
    this.prisma = new PrismaClient({
      log:
        process.env.NODE_ENV === 'test'
          ? []
          : [
              {
                emit: 'stdout',
                level: 'query',
              },
              {
                emit: 'stdout',
                level: 'error',
              },
              {
                emit: 'stdout',
                level: 'info',
              },
              {
                emit: 'stdout',
                level: 'warn',
              },
            ],
    });
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      logger.info('Connected to database');
    } catch (error) {
      logger.error({ error }, 'Failed to connect to database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    this.isShuttingDown = true;

    try {
      await this.prisma.$disconnect();
      logger.info('Disconnected from database');
    } catch (error) {
      logger.error({ error }, 'Error during database disconnect');
      throw error;
    }
  }
}

export const prismaService = new PrismaService();
export const prisma = prismaService.client;
