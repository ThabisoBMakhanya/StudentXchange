import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';
export declare class PaymentsService {
    private config;
    private prisma;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService);
    initiatePayment(orderId: string, method: PaymentMethod): Promise<{
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
    private initiateDpoPay;
    private initiateMtnMoMo;
    handlePaymentWebhook(provider: string, payload: any): Promise<void>;
}
