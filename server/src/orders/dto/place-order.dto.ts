import { IsString, IsInt, IsEnum, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class PlaceOrderDto {
  @IsString()
  listingId: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
