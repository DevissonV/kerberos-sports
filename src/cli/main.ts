import { healthCheck } from '../shared/health/health';
import { logger } from '../shared/logging/logger';

logger.info('Kerberos Sports starting', {
  ...healthCheck(),
  note: 'PAPER FIRST / FOOTBALL / RESEARCH MVP',
});
