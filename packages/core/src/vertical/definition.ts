import { z } from 'zod';

export const VerticalDefinitionSchema = z.object({
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z_]+$/),
  name: z.string().min(1),
  description: z.string(),
  enabled: z.boolean().default(true),
  version: z.string().default('0.0.0'),
  corpus: z.object({
    namespace: z.string().min(1),
    sources: z.array(z.string()).default([]),
  }),
  intake: z.object({
    fields: z.array(z.string()).default([]),
  }),
});

export type VerticalDefinition = z.infer<typeof VerticalDefinitionSchema>;
