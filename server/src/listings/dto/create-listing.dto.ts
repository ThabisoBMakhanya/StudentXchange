import {
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsOptional,
  Min,
  MinLength,
  IsInt,
  MaxLength,
} from 'class-validator';
import { ItemCondition, ListingType } from '@prisma/client';

export class CreateListingDto {
  @IsEnum(ListingType)
  type: ListingType;

  @IsString()
  categoryId: string;

  @IsString()
  @MinLength(3)
  title: string;

  @IsString()
  description: string;

  @IsNumber()
  @Min(1)
  price: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(1100000, { each: true })
  images?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  stock?: number;

  @IsOptional()
  @IsEnum(ItemCondition)
  condition?: ItemCondition;

  @IsOptional()
  @IsInt()
  @Min(15)
  durationMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  availabilitySlots?: string[];

  @IsString()
  location: string;
}
