import {
  IsBoolean,
  IsNumber,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { RECORD_DATE_PATTERN } from '../../common/korean-day.js';

export class SaveCaffeineDto {
  @IsString()
  @Matches(RECORD_DATE_PATTERN)
  recordDate!: string;

  @ValidateIf((_: SaveCaffeineDto, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  consumedTime?: string;

  @ValidateIf((_: SaveCaffeineDto, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(100)
  catalogId?: string;

  @ValidateIf((_: SaveCaffeineDto, value: unknown) => value !== undefined)
  @IsString()
  @MaxLength(100)
  drinkName?: string;

  @ValidateIf((_: SaveCaffeineDto, value: unknown) => value !== undefined)
  @IsNumber()
  @Min(0)
  @Max(9999.99)
  caffeineMg?: number;
}

export class SetCaffeineFreeDto {
  @IsString()
  @Matches(RECORD_DATE_PATTERN)
  recordDate!: string;

  @IsBoolean()
  caffeineFree!: boolean;
}
