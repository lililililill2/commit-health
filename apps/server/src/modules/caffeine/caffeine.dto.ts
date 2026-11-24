import { IsNumber, IsString, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class SaveCaffeineDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
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
