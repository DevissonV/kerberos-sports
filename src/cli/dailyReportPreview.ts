import 'reflect-metadata';
import { SqlitePredictionStore } from '../features/prediction-ledger/adapters/sqlitePredictionStore';
import { formatDailyPredictionReport } from '../features/notifications/domain/dailyPredictionReport';
import { calendarDateInBogota } from '../features/scanning/domain/todayFirst';
import { config } from '../shared/config/configuration';

const store = new SqlitePredictionStore(config.paperBetsDbPath);
try {
  const day = process.argv[2] ?? calendarDateInBogota(new Date());
  process.stdout.write(`${formatDailyPredictionReport(store.list(), day)}\n`);
} finally {
  store.close();
}
