import { z } from 'zod';

export const LUNA_MODEL_VERSION = 'GPT-5.6 Luna';
export const LUNA_RUNTIME_MODEL = 'gpt-5.6-luna';
export const LUNA_PROMPT_VERSION = 'luna-sports-brain-v1';
export const LUNA_SNAPSHOT_VERSION = '1.0';
export const MAX_LLM_REVIEWS_PER_RUN = 5;
export const LUNA_PROMPT = `Estima P(Over 2.5) y P(Under 2.5) usando únicamente el snapshot recibido.
Si falta contexto verificable, abstente con decision INSUFFICIENT_DATA.
Devuelve exclusivamente JSON estricto con el contrato de salida; razones breves, máximo 3.`;

const fixtureSchema = z
  .object({
    fixtureId: z.string().min(1),
    league: z.literal('Premier League'),
    kickoffAt: z.string().datetime({ offset: true }),
    home: z.string().min(1),
    away: z.string().min(1),
  })
  .strict();

/** Contrato deliberadamente ciego: no contiene cuotas ni campos de QUANT. */
export const lunaInputSchema = z
  .object({
    snapshotVersion: z.literal(LUNA_SNAPSHOT_VERSION),
    snapshotAt: z.string().datetime({ offset: true }),
    fixture: fixtureSchema,
    context: z
      .object({
        verifiedFacts: z.array(z.string()).max(20),
      })
      .strict(),
  })
  .strict();

export type LunaInput = z.infer<typeof lunaInputSchema>;

export const lunaOutputSchema = z
  .object({
    modelVersion: z.string().min(1),
    fixtureId: z.string().min(1),
    market: z.literal('OVER_UNDER_2_5'),
    pOver: z.number().finite().min(0).max(1),
    pUnder: z.number().finite().min(0).max(1),
    confidence: z.enum(['low', 'medium', 'high']),
    decision: z.enum(['CONFIRM', 'DOWNGRADE', 'REJECT', 'INSUFFICIENT_DATA']),
    reasons: z.array(z.string()).max(3),
    riskFlags: z.array(z.string()),
    snapshotAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type LunaOutput = z.infer<typeof lunaOutputSchema>;

export const lunaEvaluationStatusSchema = z.enum([
  'SUCCESS',
  'INSUFFICIENT_DATA',
  'INVALID_OUTPUT',
  'PROVIDER_ERROR',
  'TIMEOUT',
]);
export type LunaEvaluationStatus = z.infer<typeof lunaEvaluationStatusSchema>;

export function parseLunaOutput(value: unknown, expected: LunaInput): LunaOutput {
  const output = lunaOutputSchema.parse(value);
  if (output.fixtureId !== expected.fixture.fixtureId)
    throw new Error('fixtureId de Luna no coincide');
  if (output.snapshotAt !== expected.snapshotAt) throw new Error('snapshotAt de Luna no coincide');
  if (Math.abs(output.pOver + output.pUnder - 1) > 0.001) {
    throw new Error('pOver + pUnder debe sumar aproximadamente 1');
  }
  return output;
}
