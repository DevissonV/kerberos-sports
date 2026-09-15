/**
 * Configuración central del proceso. Las claves de API llegan SOLO por entorno
 * (.env); jamás se hardcodean. `redactConfig` produce una versión segura para logs.
 */

export interface AppConfig {
  appName: string;
  mode: 'PAPER';
  sport: 'FOOTBALL';
  nodeEnv: string;
  /** Clave de API-Football (api-football.com). Undefined si no está configurada. */
  apiFootballKey?: string;
  /** Base URL de API-Football (permite v3 proxy). */
  apiFootballBaseUrl: string;
  /** Clave de OddsPapi (oddspapi.io). Undefined si no está configurada. */
  oddsPapiKey?: string;
  /** Base URL de OddsPapi. */
  oddsPapiBaseUrl: string;
  /** Clave del proveedor OpenAI-compatible para el evaluador shadow de Luna. */
  openAiCompatibleApiKey?: string;
  openAiCompatibleModel: string;
  openAiCompatibleBaseUrl: string;
  /** Token del bot de Telegram de Kerberos SPORTS (independiente de Crypto). */
  telegramBotToken?: string;
  /** Chat ID de destino de las notificaciones de Kerberos SPORTS. */
  telegramChatId?: string;
  /**
   * Ruta del fichero SQLite del PaperBetStore. En Railway debe apuntar al
   * volumen durable (/data); en local usa `data/` del proyecto.
   */
  paperBetsDbPath: string;
  refinementMode: boolean;
  maxOddsPapiFullScansPerDay: number;
}

/** Variables de entorno cuyo valor es un secreto y debe redactarse en logs. */
export const SECRET_ENV_KEYS = [
  'API_FOOTBALL_KEY',
  'ODDSPAPI_KEY',
  'TELEGRAM_BOT_TOKEN',
  'API_KEY',
  'APIKEY',
  'TOKEN',
  'SECRET',
  'PASSWORD',
] as const;

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

export function createConfig(): AppConfig {
  return {
    appName: 'kerberos-sports',
    mode: 'PAPER',
    sport: 'FOOTBALL',
    nodeEnv: process.env.NODE_ENV ?? 'development',
    apiFootballKey: optionalEnv('API_FOOTBALL_KEY'),
    apiFootballBaseUrl: optionalEnv('API_FOOTBALL_BASE_URL') ?? 'https://v3.football.api-sports.io',
    oddsPapiKey: optionalEnv('ODDSPAPI_KEY'),
    oddsPapiBaseUrl: optionalEnv('ODDSPAPI_BASE_URL') ?? 'https://api.oddspapi.io',
    openAiCompatibleApiKey: optionalEnv('OPENAI_COMPATIBLE_API_KEY'),
    openAiCompatibleModel: optionalEnv('OPENAI_COMPATIBLE_MODEL') ?? 'gpt-5.6-luna',
    openAiCompatibleBaseUrl:
      optionalEnv('OPENAI_COMPATIBLE_BASE_URL') ?? 'https://api.openai.com/v1',
    telegramBotToken: optionalEnv('TELEGRAM_BOT_TOKEN'),
    telegramChatId: optionalEnv('TELEGRAM_CHAT_ID'),
    paperBetsDbPath: optionalEnv('PAPER_BETS_DB_PATH') ?? 'data/kerberos-sports.db',
    refinementMode: process.env.REFINEMENT_MODE === 'true',
    maxOddsPapiFullScansPerDay: Number(process.env.MAX_ODDSPAPI_FULL_SCANS_PER_DAY ?? 2),
  };
}

export const config: AppConfig = createConfig();

/**
 * Devuelve una copia del entorno con los valores de claves/secrets reemplazados
 * por '[REDACTED]'. Usar SIEMPRE antes de registrar variables de entorno en logs.
 */
export function redactEnv(env: Record<string, string | undefined>): Record<string, string> {
  const safe: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    const isSecret = SECRET_ENV_KEYS.some((secret) => key.toUpperCase().includes(secret));
    safe[key] = isSecret && value !== undefined ? '[REDACTED]' : (value ?? '');
  }
  return safe;
}

/** Indica si hay claves suficientes para el smoke test de red. */
export function hasNetworkKeys(cfg: AppConfig = config): boolean {
  return cfg.apiFootballKey !== undefined && cfg.oddsPapiKey !== undefined;
}
