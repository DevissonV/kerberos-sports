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
