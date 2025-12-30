import { z } from 'zod';

export const crawlRequestSchema = z.object({
  urls: z
    .array(z.string().url().min(1))
    .min(1, 'At least one URL is required')
    .max(50, 'Maximum 50 URLs allowed'),
  priority: z.enum(['normal', 'high']).default('normal'),
});

export type CrawlRequest = z.infer<typeof crawlRequestSchema>;
