import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export const mealKinds = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;
export type MealKind = (typeof mealKinds)[number];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class MealDateDto {
  @Matches(datePattern)
  date!: string;
}

export class SchoolSearchDto {
  @Transform(trim)
  @IsString()
  @Length(2, 60)
  q!: string;
}

export class SchoolDto {
  @Matches(/^[A-Z][0-9]{2}$/)
  officeCode!: string;

  @Matches(/^\d{7}$/)
  schoolCode!: string;
}

class SchoolMealDto extends SchoolDto {
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  @Length(1, 120, { each: true })
  menu!: string[];
}

class MealItemDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(10000)
  amount?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.25)
  @Max(20)
  portions?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  kcalPerPortion?: number | null;

  @IsOptional()
  @IsUUID('4')
  savedId?: string;

  @IsOptional()
  @Matches(/^food_[a-f0-9]{16}$/)
  foodId?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 120)
  name?: string;
}

export class SaveMealDto {
  @IsUUID('4')
  requestId!: string;

  @Matches(datePattern)
  date!: string;

  @IsIn(mealKinds)
  kind!: MealKind;

  @IsOptional()
  @Matches(/^[a-f0-9]{64}$/)
  catalogVersion?: string;

  @IsArray()
  @ArrayMaxSize(40)
  @IsObject({ each: true })
  @ValidateNested({ each: true })
  @Type(() => MealItemDto)
  items!: MealItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => SchoolMealDto)
  school?: SchoolMealDto;
}

export class UpdateMealDto extends SaveMealDto {
  @IsInt()
  @Min(1)
  @Max(2147483647)
  revision!: number;
}
