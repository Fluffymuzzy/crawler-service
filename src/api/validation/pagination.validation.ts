import { z } from 'zod';

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const profileSearchSchema = paginationSchema.extend({
  query: z.string().optional(),
});

export type PaginationParams = z.infer<typeof paginationSchema>;
export type ProfileSearchParams = z.infer<typeof profileSearchSchema>;
