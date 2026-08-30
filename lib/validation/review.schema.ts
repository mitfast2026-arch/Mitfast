import { z } from 'zod';

export const upsertReviewSchema = z.object({
  rating: z
    .number()
    .int('Rating must be an integer')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  reviewText: z
    .string()
    .trim()
    .max(2000, 'Review text cannot exceed 2000 characters')
    .optional()
    .nullable()
    .transform((val) => (val && val.trim().length > 0 ? val.trim() : null)),
});

export type UpsertReviewInput = z.infer<typeof upsertReviewSchema>;
