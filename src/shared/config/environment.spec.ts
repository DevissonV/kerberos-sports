import { validateEnvironment } from './environment';
import { createConfig } from './configuration';

describe('validateEnvironment', () => {
  it('aplica defaults seguros con el entorno vacío', () => {
    expect(validateEnvironment({})).toMatchObject({
      NODE_ENV: 'development',
      API_FOOTBALL_BASE_URL: 'https://v3.football.api-sports.io',
      ODDSPAPI_BASE_URL: 'https://api.oddspapi.io',
      PAPER_BETS_DB_PATH: 'data/kerberos-sports.db',
      PAPER_ONLY: true,
      PRODUCTION_RISK_BASE_STAKE_COP: 10_000,
      PRODUCTION_RISK_ENABLE_ELEVATED: false,
    });
  });

  it('rechaza PAPER_ONLY=false: restricción de producto PAPER FIRST', () => {
    expect(() => validateEnvironment({ PAPER_ONLY: 'false' })).toThrow(/PAPER_ONLY debe ser true/);
  });

  it('rechaza NODE_ENV desconocido', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'staging' })).toThrow();
  });

  it('acepta claves opcionales de proveedores cuando están presentes', () => {
    const parsed = validateEnvironment({
      API_FOOTBALL_KEY: 'a-key',
      ODDSPAPI_KEY: 'another-key',
      TELEGRAM_BOT_TOKEN: 'bot-token',
      TELEGRAM_CHAT_ID: '123',
    });
    expect(parsed.API_FOOTBALL_KEY).toBe('a-key');
    expect(parsed.ODDSPAPI_KEY).toBe('another-key');
    expect(parsed.TELEGRAM_BOT_TOKEN).toBe('bot-token');
    expect(parsed.TELEGRAM_CHAT_ID).toBe('123');
  });

  it('acepta la convención OpenAI-compatible homologada', () => {
    const parsed = validateEnvironment({
      OPENAI_COMPATIBLE_API_KEY: 'test-key',
      OPENAI_COMPATIBLE_MODEL: 'gpt-5.6-luna',
      OPENAI_COMPATIBLE_BASE_URL: 'https://api.example.test/v1',
    });
    expect(parsed.OPENAI_COMPATIBLE_API_KEY).toBe('test-key');
    expect(parsed.OPENAI_COMPATIBLE_MODEL).toBe('gpt-5.6-luna');
    expect(parsed.OPENAI_COMPATIBLE_BASE_URL).toBe('https://api.example.test/v1');
  });

  it('mantiene conservador el gate de producción y limita su stake a 20k COP', () => {
    const parsed = validateEnvironment({
      PRODUCTION_RISK_ENABLE_ELEVATED: 'true',
      PRODUCTION_RISK_ENABLE_HIGH: 'true',
      PRODUCTION_RISK_ACTIVE_TIER: 'HIGH',
    });
    expect(parsed.PRODUCTION_RISK_MAX_STAKE_COP).toBe(20_000);
    expect(parsed.PRODUCTION_RISK_ENABLE_ELEVATED).toBe(true);
    expect(parsed.PRODUCTION_RISK_ENABLE_HIGH).toBe(true);
    expect(() => validateEnvironment({ PRODUCTION_RISK_MAX_STAKE_COP: '20001' })).toThrow();
  });

  it('rechaza activar un tier sin su habilitación administrativa explícita', () => {
    expect(() => validateEnvironment({ PRODUCTION_RISK_ACTIVE_TIER: 'HIGH' })).toThrow(
      /requiere habilitar explícitamente/,
    );
  });

  it('usa PAPER_BETS_DB_PATH cuando está definido y conserva el fallback local', () => {
    const previous = process.env.PAPER_BETS_DB_PATH;
    try {
      delete process.env.PAPER_BETS_DB_PATH;
      expect(createConfig().paperBetsDbPath).toBe('data/kerberos-sports.db');

      process.env.PAPER_BETS_DB_PATH = '/data/kerberos-sports.db';
      expect(createConfig().paperBetsDbPath).toBe('/data/kerberos-sports.db');
    } finally {
      if (previous === undefined) delete process.env.PAPER_BETS_DB_PATH;
      else process.env.PAPER_BETS_DB_PATH = previous;
    }
  });
});
