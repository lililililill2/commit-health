import { Module } from '@nestjs/common';

import { PrismaModule } from '../../prisma/prisma.module.js';
import { MealController } from './meal.controller.js';
import { MealService } from './meal.service.js';
import { NeisService } from './neis.service.js';

@Module({
  imports: [PrismaModule],
  controllers: [MealController],
  providers: [MealService, NeisService],
})
export class MealModule {}
