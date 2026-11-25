import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnvironment } from './config/environment.js';
import { HealthModule } from './modules/health/health.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SleepModule } from './modules/sleep/sleep.module.js';
import { ActivityModule } from './modules/activity/activity.module.js';
import { CaffeineModule } from './modules/caffeine/caffeine.module.js';
import { MealModule } from './modules/meals/meal.module.js';
import { DevRecordsModule } from './modules/dev-records/dev-records.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnvironment }),
    HealthModule,
    AuthModule,
    SleepModule,
    ActivityModule,
    CaffeineModule,
    MealModule,
    DevRecordsModule,
  ],
})
export class AppModule {}
