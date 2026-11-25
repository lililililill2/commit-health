import { Injectable } from '@nestjs/common';

@Injectable()
export class ActivityClock {
  now(): Date {
    return new Date();
  }
}
