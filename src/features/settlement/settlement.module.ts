import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaperBettingModule } from '../paper-betting/paper-betting.module';
import { ScanningModule } from '../scanning/scanning.module';
import { SettlementService } from './application/settlementService';

@Module({
  imports: [ScanningModule, PaperBettingModule, NotificationsModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
