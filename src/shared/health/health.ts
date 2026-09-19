import { config } from '../config/configuration';

export function healthCheck(): { status: string; app: string; mode: string; sport: string } {
  return {
    status: 'ok',
    app: config.appName,
    mode: config.executionMode,
    sport: config.sport,
  };
}
