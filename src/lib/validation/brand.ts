import { z } from "zod";

export const createBrandSchema = z.object({
  name: z.string().trim().min(2).max(80),
  website: z.string().trim().min(3).max(240),
  industry: z.string().trim().min(2).max(80),
  product: z.string().trim().min(2).max(160),
  targetAudience: z.string().trim().min(2).max(160),
  aliases: z.array(z.string().max(80)).max(20).default([]),
  competitors: z.array(z.string().max(80)).max(20).default([]),
});
