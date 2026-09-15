/**
 * Validación temprana de variables de entorno (patrón homólogo a bot-kerberos:
 * @nestjs/config + zod). Falla rápido en el bootstrap si el entorno está mal
 * formado, ANTES de construir cualquier adapter. No sustituye a `configuration.ts`
 * (fuente real del objeto `config` consumido hoy por CLI/tests): es una red de
 * seguridad adicional que además blinda la restricción de producto PAPER FIRST.
 */

import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false'])
  .default('true')
  .transform((value) => value === 'true');
const refinementBoolean = z
  .enum(['true', 'false'])
  .default('false')
  .transform((value) => value === 'true');

export const environmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_FOOTBALL_KEY: z.string().optional(),
    API_FOOTBALL_BASE_URL: z.string().url().default('https://v3.football.api-sports.io'),
    ODDSPAPI_KEY: z.string().optional(),
    ODDSPAPI_BASE_URL: z.string().url().default('https://api.oddspapi.io'),
    OPENAI_COMPATIBLE_API_KEY: z.string().optional(),
    OPENAI_COMPATIBLE_MODEL: z.string().default('gpt-5.6-luna'),
    OPENAI_COMPATIBLE_BASE_URL: z.string().url().default('https://api.openai.com/v1'),
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),
    PAPER_BETS_DB_PATH: z.string().default('data/kerberos-sports.db'),
    PAPER_ONLY: booleanFromString,
    REFINEMENT_MODE: refinementBoolean,
    MAX_ODDSPAPI_FULL_SCANS_PER_DAY: z.coerce.number().int().positive().default(2),
  })
  .superRefine((env, context) => {
    if (!env.PAPER_ONLY) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PAPER_ONLY debe ser true: Kerberos Sports es PAPER FIRST (sin ejecución real)',
      });
    }
  });

export type Environment = z.infer<typeof environmentSchema>;

/** Usado como `validate` de `ConfigModule.forRoot` (falla rápido en bootstrap). */
export function validateEnvironment(env: Record<string, unknown>): Environment {
  const result = environmentSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Configuración de entorno inválida: ${result.error.message}`);
  }
  return result.data;
}
