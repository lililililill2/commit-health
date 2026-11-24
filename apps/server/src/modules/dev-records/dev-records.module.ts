import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { DevRecordsController } from './dev-records.controller.js';
import { DevRecordsService } from './dev-records.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [DevRecordsController],
  providers: [DevRecordsService],
})
export class DevRecordsModule {}
