// lib/validation/coverLetter.ts
import { z } from "zod";

export const PostCoverLetterSchema = z.object({
  maxWords: z
    .number({ invalid_type_error: "maxWords must be a number" })
    .int("must be integer")
    .min(80, "min 80")
    .max(400, "max 400")
    .optional(),
});

export const PutCoverLetterSchema = z.object({
  coverLetter: z
    .string({ required_error: "coverLetter is required" })
    .trim()
    .min(1, "coverLetter cannot be empty"),
});

/** ספירת מילים פשוטה (כמו בלקוח) */
export function wordCount(s: string) {
  return (s ?? "").trim().split(/\s+/).filter(Boolean).length;
}
