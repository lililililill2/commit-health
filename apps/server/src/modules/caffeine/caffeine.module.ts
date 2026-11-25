import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { CaffeineController } from './caffeine.controller.js';
import { CaffeineService } from './caffeine.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [CaffeineController],
  providers: [CaffeineService],
})
export class CaffeineModule {}
