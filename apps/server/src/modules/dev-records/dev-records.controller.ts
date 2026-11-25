import { Controller, Delete, HttpCode, Param } from '@nestjs/common';
import { CurrentUser, type SessionUser } from '../../auth/auth-context.js';
import { DevRecordsService } from './dev-records.service.js';

@Controller('dev/records')
export class DevRecordsController {
  constructor(private readonly records: DevRecordsService) {}

  @Delete('today/:recordDate')
  @HttpCode(204)
  resetToday(@CurrentUser() user: SessionUser, @Param('recordDate') recordDate: string) {
    return this.records.resetToday(user.id, recordDate);
  }
}
