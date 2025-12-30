import { prismaService } from '../../src/db/prisma';

export async function setupTestDatabase(): Promise<void> {
  await prismaService.connect();
}

export async function cleanupTestDatabase(): Promise<void> {
  // Clear all tables in the correct order
  await prismaService.client.jobItem.deleteMany();
  await prismaService.client.job.deleteMany();
  await prismaService.client.profile.deleteMany();
}

export async function teardownTestDatabase(): Promise<void> {
  await prismaService.disconnect();
}
