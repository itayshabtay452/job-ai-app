// lib/validation/jobs.ts
import { z } from "zod";

/** פרמטרים לשאילתת /api/jobs/list */
export const JobsListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(120).optional(),
  // נשמור skill ב-lowercase כדי להתאים לשדה skillsRequired שנשמר כ-lowercase
  skill: z
    .string()
    .trim()
    .max(80)
    .transform((s) => s.toLowerCase())
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type JobsListQuery = z.infer<typeof JobsListQuerySchema>;
