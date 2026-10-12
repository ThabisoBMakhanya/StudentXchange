import { IsOptional, IsString, IsEnum } from 'class-validator';
import { ListingType } from '@prisma/client';

export class ListingsQueryDto {
  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
