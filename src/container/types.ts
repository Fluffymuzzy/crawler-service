export const TYPES = {
  // Repositories
  JobRepository: Symbol.for('JobRepository'),
  ProfileRepository: Symbol.for('ProfileRepository'),
  JobItemRepository: Symbol.for('JobItemRepository'),

  // Services
  JobService: Symbol.for('JobService'),
  ProfileService: Symbol.for('ProfileService'),
  QueueService: Symbol.for('QueueService'),

  // External
  Database: Symbol.for('Database'),
  Logger: Symbol.for('Logger'),
  MessageQueue: Symbol.for('MessageQueue'),

  // Parsers and Fetchers
  Parser: Symbol.for('Parser'),
  Fetcher: Symbol.for('Fetcher'),
  ParserRegistry: Symbol.for('ParserRegistry'),
  FetcherRegistry: Symbol.for('FetcherRegistry'),

  // Worker components
  JobProcessor: Symbol.for('JobProcessor'),
  RetryManager: Symbol.for('RetryManager'),
  JobStatusCalculator: Symbol.for('JobStatusCalculator'),
  CrawlOrchestrator: Symbol.for('CrawlOrchestrator'),
};
