import { z } from 'zod';

export const ANALYST_PROMPT_VERSION = 'llm-analyst-context-v1';
export const ANALYST_CONTEXT_VERSION = '1.0';

export const analystInputSchema = z
  .object({
    contextVersion: z.literal(ANALYST_CONTEXT_VERSION),
    fixtureId: z.string().min(1),
    snapshotAt: z.string().datetime({ offset: true }),
    fixture: z
      .object({
        league: z.string().min(1),
        kickoffAt: z.string().datetime({ offset: true }),
        home: z.string().min(1),
        away: z.string().min(1),
      })
      .strict(),
    quantitativeSignal: z
      .object({
        modelProbability: z.number().finite().min(0).max(1),
        expectedGoals: z
          .object({
            home: z.number().finite().nonnegative(),
            away: z.number().finite().nonnegative(),
            total: z.number().finite().nonnegative(),
          })
          .strict(),
        sampleSize: z
          .object({
            league: z.number().int().nonnegative(),
            homeRole: z.number().int().nonnegative(),
            awayRole: z.number().int().nonnegative(),
          })
          .strict(),
        marketState: z
          .object({ selection: z.string(), observedOdds: z.number().finite().positive() })
          .nullable(),
      })
      .strict(),
  })
  .strict();

export type AnalystInput = z.infer<typeof analystInputSchema>;

export const analystOutputSchema = z
  .object({
    fixtureId: z.string().min(1),
    contextScore: z.number().finite().int().min(0).max(100),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    alerts: z.array(z.string()).max(5),
    supportingFactors: z.array(z.string()).max(5),
    contradictingFactors: z.array(z.string()).max(5),
    suggestedMarketsToInvestigate: z.array(z.string()).max(5),
    summary: z.string().min(1).max(500),
    confidenceInContext: z.enum(['LOW', 'MEDIUM', 'HIGH']),
  })
  .strict();

export type AnalystOutput = z.infer<typeof analystOutputSchema>;

export function parseAnalystOutput(value: unknown, expected: AnalystInput): AnalystOutput {
  const output = analystOutputSchema.parse(value);
  if (output.fixtureId !== expected.fixtureId) throw new Error('fixtureId del Analyst no coincide');
  return output;
}
