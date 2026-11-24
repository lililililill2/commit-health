import { Equals, IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export const STRETCH_DIRECTION_MS = 10_000;
export const MEDITATION_SECONDS = 180;

export class StartActivityDto {
  @IsIn(['focus', 'meditation', 'shoulder-cross-body'])
  kind!: 'focus' | 'meditation' | 'shoulder-cross-body';
}

export class CompleteStretchDto {
  @Equals(STRETCH_DIRECTION_MS)
  leftMs!: number;

  @Equals(STRETCH_DIRECTION_MS)
  rightMs!: number;
}

export class CompleteMeditationDto {
  @IsInt()
  @Min(MEDITATION_SECONDS)
  playedSeconds!: number;
}

export class SaveConditionDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  recordDate!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  score!: number;
}
