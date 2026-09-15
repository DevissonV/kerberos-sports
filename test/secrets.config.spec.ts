import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { config, hasNetworkKeys, redactEnv } from '../src/shared/config/configuration';

describe('redaccion de secrets en logs', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('redacta valores de claves conocidas', () => {
    const safe = redactEnv({
      API_FOOTBALL_KEY: 'super-secret-123',
      ODDSPAPI_KEY: 'another-secret',
      NODE_ENV: 'development',
      PATH: '/usr/bin',
    });
    expect(safe['API_FOOTBALL_KEY']).toBe('[REDACTED]');
    expect(safe['ODDSPAPI_KEY']).toBe('[REDACTED]');
    expect(safe['NODE_ENV']).toBe('development');
    expect(safe['PATH']).toBe('/usr/bin');
    expect(JSON.stringify(safe)).not.toContain('super-secret-123');
  });

  it('redacta cualquier variable que contenga SECRET/TOKEN en el nombre', () => {
    const safe = redactEnv({ MY_SERVICE_SECRET: 'x', AUTH_TOKEN_VALUE: 'y' });
    expect(safe['MY_SERVICE_SECRET']).toBe('[REDACTED]');
    expect(safe['AUTH_TOKEN_VALUE']).toBe('[REDACTED]');
  });

  it('hasNetworkKeys exige ambas claves', () => {
    expect(hasNetworkKeys({ ...config, apiFootballKey: 'a', oddsPapiKey: undefined })).toBe(false);
    expect(hasNetworkKeys({ ...config, apiFootballKey: 'a', oddsPapiKey: 'b' })).toBe(true);
  });

  it('el scan CLI no imprime la API key (fuente inspeccionada)', () => {
    const scanPath = join(__dirname, '..', 'src', 'cli', 'scan.ts');
    const scanSource = readFileSync(scanPath, 'utf8');
    // Nunca accede a process.env directamente (la key solo via config) ni imprime URLs.
    expect(scanSource).not.toMatch(/process\.env\[/);
    expect(scanSource).not.toContain('url.toString()');
  });
});

describe('config base', () => {
  it('mantiene PAPER ONLY y FOOTBALL congelados', () => {
    expect(config.mode).toBe('PAPER');
    expect(config.sport).toBe('FOOTBALL');
  });
});
