import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { CurrentUser, type SessionUser } from '../../auth/auth-context.js';
import {
  MealDateDto,
  SaveMealDayDto,
  SaveMealDto,
  SchoolDto,
  SchoolSearchDto,
  UpdateMealDto,
} from './meal.dto.js';
import { MealService } from './meal.service.js';
import { NeisService } from './neis.service.js';

@Controller('meals')
export class MealController {
  constructor(
    private readonly meals: MealService,
    private readonly neis: NeisService,
  ) {}

  @Get()
  day(@CurrentUser() user: SessionUser, @Query() { date }: MealDateDto) {
    return this.meals.day(user.id, date);
  }

  @Get('history')
  history(@CurrentUser() user: SessionUser) {
    return this.meals.history(user.id);
  }

  @Get('today-progress')
  progress(@CurrentUser() user: SessionUser) {
    return this.meals.todayProgress(user.id);
  }

  @Get('schools')
  schools(@Query() { q }: SchoolSearchDto) {
    return this.neis.schools(q);
  }

  @Get('school')
  async school(@CurrentUser() user: SessionUser) {
    return { school: await this.meals.school(user.id) };
  }

  @Put('school')
  setSchool(@CurrentUser() user: SessionUser, @Body() input: SchoolDto) {
    return this.meals.setSchool(user.id, input);
  }

  @Delete('school')
  @HttpCode(204)
  removeSchool(@CurrentUser() user: SessionUser) {
    return this.meals.removeSchool(user.id);
  }

  @Get('school/menus')
  menus(@CurrentUser() user: SessionUser, @Query() { date }: MealDateDto) {
    return this.meals.menus(user.id, date);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() input: SaveMealDto) {
    return this.meals.save(user.id, input);
  }

  @Put('day')
  @HttpCode(204)
  saveDay(@CurrentUser() user: SessionUser, @Body() input: SaveMealDayDto) {
    return this.meals.saveDay(user.id, input);
  }

  @Put(':id')
  update(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: UpdateMealDto,
  ) {
    return this.meals.save(user.id, input, { id, revision: input.revision });
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('revision', ParseIntPipe) revision: number,
  ) {
    return this.meals.remove(user.id, id, revision);
  }
}
