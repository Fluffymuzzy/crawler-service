import { Container } from 'inversify';
import { TYPES } from './types';

// External dependencies
import type { IDatabase } from '../interfaces/external/database.interface';
import type { ILogger } from '../interfaces/external/logger.interface';
import type { IMessageQueue } from '../interfaces/external/message-queue.interface';
import { PrismaDatabase } from '../db/prisma-database';
import { PinoLogger } from '../utils/pino-logger';
import { BullMQAdapter } from '../queue/bullmq-adapter';

// Repositories
import type { IJobRepository } from '../interfaces/repositories/job.repository.interface';
import type { IProfileRepository } from '../interfaces/repositories/profile.repository.interface';
import type { IJobItemRepository } from '../interfaces/repositories/job-item.repository.interface';
import { JobRepository } from '../db/repositories/job.repository';
import { ProfileRepository } from '../db/repositories/profile.repository';
import { JobItemRepository } from '../db/repositories/job-item.repository';

// Services
import type { IJobService } from '../interfaces/services/job.service.interface';
import type { IProfileService } from '../interfaces/services/profile.service.interface';
import type { IQueueService } from '../interfaces/services/queue.service.interface';
import { JobService } from '../services/job.service';
import { ProfileService } from '../services/profile.service';
import { QueueService } from '../services/queue.service';

// Controllers
import { CrawlController } from '../api/controllers/crawl.controller';
import { JobController } from '../api/controllers/job.controller';
import { ProfileController } from '../api/controllers/profile.controller';

// Worker components
import { JobProcessor } from '../workers/processors/job.processor';
import { RetryManager } from '../workers/processors/retry.manager';
import { JobStatusCalculator } from '../workers/processors/job-status.calculator';
import { CrawlOrchestrator } from '../workers/crawl.orchestrator';
import { CrawlWorker } from '../workers/crawl.worker';

// Parsers and Fetchers
import type { IParser } from '../interfaces/parser.interface';
import type { IFetcher } from '../interfaces/fetcher.interface';
import { ParserRegistry } from '../parser/parser.registry';
import { FetcherRegistry } from '../fetcher/fetcher.registry';
import { GenericProfileParser } from '../parser/strategies/generic.parser';
import { SocialMediaParser } from '../parser/strategies/social-media.parser';
import { HttpFetcher } from '../fetcher/strategies/http.fetcher';
import { PlaywrightFetcher } from '../fetcher/strategies/playwright.fetcher';

export function configureContainer(): Container {
  const container = new Container({
    defaultScope: 'Singleton',
  });

  // External dependencies
  container.bind<IDatabase>(TYPES.Database).to(PrismaDatabase).inSingletonScope();
  container.bind<ILogger>(TYPES.Logger).to(PinoLogger).inSingletonScope();
  container.bind<IMessageQueue>(TYPES.MessageQueue).to(BullMQAdapter).inSingletonScope();

  // Repositories
  container.bind<IJobRepository>(TYPES.JobRepository).to(JobRepository);
  container.bind<IProfileRepository>(TYPES.ProfileRepository).to(ProfileRepository);
  container.bind<IJobItemRepository>(TYPES.JobItemRepository).to(JobItemRepository);

  // Services
  container.bind<IJobService>(TYPES.JobService).to(JobService);
  container.bind<IProfileService>(TYPES.ProfileService).to(ProfileService);
  container.bind<IQueueService>(TYPES.QueueService).to(QueueService);

  // Controllers
  container.bind<CrawlController>(CrawlController).toSelf();
  container.bind<JobController>(JobController).toSelf();
  container.bind<ProfileController>(ProfileController).toSelf();

  // Worker components
  container.bind<JobProcessor>(TYPES.JobProcessor).to(JobProcessor);
  container.bind<RetryManager>(TYPES.RetryManager).to(RetryManager);
  container.bind<JobStatusCalculator>(TYPES.JobStatusCalculator).to(JobStatusCalculator);
  container.bind<CrawlOrchestrator>(TYPES.CrawlOrchestrator).to(CrawlOrchestrator);
  container.bind<CrawlWorker>(CrawlWorker).toSelf();

  // Parsers
  container.bind<IParser>(TYPES.Parser).to(GenericProfileParser);
  container.bind<IParser>(TYPES.Parser).to(SocialMediaParser);

  // Fetchers
  container.bind<IFetcher>(TYPES.Fetcher).to(HttpFetcher);
  container.bind<IFetcher>(TYPES.Fetcher).to(PlaywrightFetcher);

  // Registries
  container.bind<ParserRegistry>(TYPES.ParserRegistry).to(ParserRegistry).inSingletonScope();
  container.bind<FetcherRegistry>(TYPES.FetcherRegistry).to(FetcherRegistry).inSingletonScope();

  // Auto-register parsers and fetchers
  container.onActivation<ParserRegistry>(TYPES.ParserRegistry, (_context, registry) => {
    const parsers = container.getAll<IParser>(TYPES.Parser);
    parsers.forEach((parser) => registry.register(parser));
    return registry;
  });

  container.onActivation<FetcherRegistry>(TYPES.FetcherRegistry, (_context, registry) => {
    const fetchers = container.getAll<IFetcher>(TYPES.Fetcher);
    fetchers.forEach((fetcher) => registry.register(fetcher));
    return registry;
  });

  return container;
}
