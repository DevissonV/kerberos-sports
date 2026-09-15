import { Test } from '@nestjs/testing';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ScanningService } from '../src/features/scanning/application/scanningService';
import { FIXTURES_PROVIDER } from '../src/features/scanning/ports/fixturesProvider';
import { ODDS_PROVIDER } from '../src/features/scanning/ports/oddsProvider';
import { NOTIFICATION_PORT } from '../src/features/notifications/ports/notificationPort';
import { ApiFootballFixturesAdapter } from '../src/features/scanning/adapters/apiFootballFixtures';
import { OddsPapiAdapter } from '../src/features/scanning/adapters/oddsPapiOdds';
import { TelegramNotificationAdapter } from '../src/features/notifications/adapters/telegramNotification';

describe('AppModule (smoke Nest)', () => {
  it('compila el árbol de módulos y resuelve los providers críticos', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    expect(moduleRef.get(ScanningService)).toBeInstanceOf(ScanningService);
    expect(moduleRef.get(FIXTURES_PROVIDER)).toBeInstanceOf(ApiFootballFixturesAdapter);
    expect(moduleRef.get(ODDS_PROVIDER)).toBeInstanceOf(OddsPapiAdapter);
    expect(moduleRef.get(NOTIFICATION_PORT)).toBeInstanceOf(TelegramNotificationAdapter);

    await moduleRef.close();
  });

  it('levanta y cierra un ApplicationContext real sin servidor HTTP', async () => {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    expect(app.get(ScanningService)).toBeInstanceOf(ScanningService);
    await expect(app.close()).resolves.not.toThrow();
  });
});
