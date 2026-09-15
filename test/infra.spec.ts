import { healthCheck } from '../src/shared/health/health';
import { logger } from '../src/shared/logging/logger';
import { config } from '../src/shared/config/configuration';

describe('infra', () => {
  it('health check reporta PAPER / FOOTBALL', () => {
    expect(healthCheck()).toEqual({
      status: 'ok',
      app: 'kerberos-sports',
      mode: 'PAPER',
      sport: 'FOOTBALL',
    });
  });

  it('config es paper-only por defecto', () => {
    expect(config.mode).toBe('PAPER');
    expect(config.sport).toBe('FOOTBALL');
  });

  it('logger emite lineas sin lanzar', () => {
    expect(() => {
      logger.info('test', { a: 1 });
      logger.warn('test');
      logger.error('test');
    }).not.toThrow();
  });
});
