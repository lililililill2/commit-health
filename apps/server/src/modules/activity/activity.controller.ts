import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { CurrentUser, type SessionUser } from '../../auth/auth-context.js';
import { CompleteStretchDto, SaveConditionDto, StartActivityDto } from './activity.dto.js';
import { ActivityService } from './activity.service.js';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activity: ActivityService) {}

  @Get('today')
  today(@CurrentUser() user: SessionUser) {
    return this.activity.today(user.id);
  }

  @Put('condition')
  condition(@CurrentUser() user: SessionUser, @Body() input: SaveConditionDto) {
    return this.activity.saveCondition(user.id, input);
  }

  @Post('sessions')
  start(@CurrentUser() user: SessionUser, @Body() input: StartActivityDto) {
    return this.activity.start(user.id, input.kind);
  }

  @Post('sessions/:id/heartbeat')
  heartbeat(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activity.heartbeat(user.id, id);
  }

  @Post('sessions/:id/complete')
  complete(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activity.complete(user.id, id);
  }

  @Post('sessions/:id/stretching-complete')
  completeStretch(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() input: CompleteStretchDto,
  ) {
    return this.activity.complete(user.id, id, input);
  }

  @Post('sessions/:id/fail')
  fail(@CurrentUser() user: SessionUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.activity.fail(user.id, id);
  }
}
