import { Injectable } from '@nestjs/common';

@Injectable()
export class SleepClock {
  now(): Date {
    return new Date();
  }
}
