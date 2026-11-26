import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';

import { CurrentUser, type SessionUser } from '../../auth/auth-context.js';
import { caffeineCatalog } from './caffeine-catalog.js';
import { SaveCaffeineDto, SetCaffeineFreeDto } from './caffeine.dto.js';
import { CaffeineService } from './caffeine.service.js';

@Controller('caffeine')
export class CaffeineController {
  constructor(private readonly caffeine: CaffeineService) {}

  @Get('catalog')
  catalog() {
    return caffeineCatalog;
  }

  @Get('today')
  today(@CurrentUser() user: SessionUser) {
    return this.caffeine.today(user.id);
  }

  @Put('today/caffeine-free')
  @HttpCode(204)
  setCaffeineFree(@CurrentUser() user: SessionUser, @Body() input: SetCaffeineFreeDto) {
    return this.caffeine.setCaffeineFree(user.id, input);
  }

  @Post()
  @HttpCode(204)
  create(@CurrentUser() user: SessionUser, @Body() input: SaveCaffeineDto) {
    return this.caffeine.save(user.id, input);
  }

  @Put(':id')
  @HttpCode(204)
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: SaveCaffeineDto,
  ) {
    return this.caffeine.save(user.id, input, id);
  }

  @Delete(':id/:recordDate')
  @HttpCode(204)
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('recordDate') recordDate: string,
  ) {
    return this.caffeine.remove(user.id, id, recordDate);
  }
}
