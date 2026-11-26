import { IsString, Matches } from 'class-validator';

import { RECORD_DATE_PATTERN } from '../../common/korean-day.js';

export class CreateSleepDto {
  @IsString()
  @Matches(RECORD_DATE_PATTERN)
  recordDate!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/)
  bedtime!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/)
  wakeTime!: string;
}
