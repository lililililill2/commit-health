import { IsIn, IsInt, IsString, Matches, Max, Min } from 'class-validator';

export class StartActivityDto {
  @IsIn(['focus', 'meditation'])
  kind!: 'focus' | 'meditation';
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
