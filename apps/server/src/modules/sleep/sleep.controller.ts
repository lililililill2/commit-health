import { Body, Controller, Get, Header, Post } from '@nestjs/common';

import { CurrentUser, type SessionUser } from '../../auth/auth-context.js';
import { CreateSleepDto } from './create-sleep.dto.js';
import { SleepService } from './sleep.service.js';

@Controller('sleep')
export class SleepController {
  constructor(private readonly sleep: SleepService) {}

  @Get('today')
  @Header('Cache-Control', 'no-store')
  today(@CurrentUser() user: SessionUser) {
    return this.sleep.today(user.id);
  }

  @Post()
  @Header('Cache-Control', 'no-store')
  create(@CurrentUser() user: SessionUser, @Body() input: CreateSleepDto) {
    return this.sleep.create(user.id, input);
  }
}
