import { healthCheck } from './common/health/health';
import { logger } from './common/logging/logger';

logger.info('Kerberos Sports starting', {
  ...healthCheck(),
  note: 'PAPER FIRST / FOOTBALL / RESEARCH MVP',
});
