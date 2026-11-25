import { IsString, Matches } from 'class-validator';

export class CreateSleepDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  recordDate!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/)
  bedtime!: string;

  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):(?:00|15|30|45)$/)
  wakeTime!: string;
}
