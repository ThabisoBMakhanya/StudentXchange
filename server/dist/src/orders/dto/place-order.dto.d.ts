import { PaymentMethod } from '@prisma/client';
export declare class PlaceOrderDto {
    listingId: string;
    quantity: number;
    paymentMethod: PaymentMethod;
}
