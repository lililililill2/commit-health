import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { SleepClock } from './sleep-clock.js';
import { SleepController } from './sleep.controller.js';
import { SleepService } from './sleep.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [SleepController],
  providers: [SleepService, SleepClock],
})
export class SleepModule {}
