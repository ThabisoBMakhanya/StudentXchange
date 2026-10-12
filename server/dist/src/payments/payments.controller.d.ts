import { PaymentsService } from './payments.service';
import { PaymentMethod } from '@prisma/client';
declare class InitiatePaymentDto {
    method: PaymentMethod;
}
export declare class PaymentsController {
    private payments;
    constructor(payments: PaymentsService);
    initiate(orderId: string, dto: InitiatePaymentDto): Promise<{
        provider: string;
        orderId: any;
        amount: any;
        currency: string;
        paymentUrl: string;
        status: string;
    } | {
        provider: string;
        orderId: any;
        amount: any;
        currency: string;
        reference: string;
        status: string;
    }>;
}
export {};
