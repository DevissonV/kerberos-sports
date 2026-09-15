import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { createConfig } from '../shared/config/configuration';
import { validateEnvironment } from '../shared/config/environment';
import { SettlementModule } from '../features/settlement/settlement.module';
import { SettlementService } from '../features/settlement/application/settlementService';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [createConfig],
      validate: validateEnvironment,
    }),
    SettlementModule,
  ],
})
class SettlementBatchModule {}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(SettlementBatchModule, { logger: false });
  try {
    const summary = await app.get(SettlementService).settleOpenBets();
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } finally {
    await app.close();
  }
}

void main().catch((error: unknown) => {
  console.error(`settle fallo: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
