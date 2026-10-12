import { PayoutsService } from './payouts.service';
export declare class PayoutsController {
    private payouts;
    constructor(payouts: PayoutsService);
    findAll(): import(".prisma/client").Prisma.PrismaPromise<({
        seller: {
            fullName: string;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        createdAt: Date;
        updatedAt: Date;
        sellerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        orderId: string;
    })[]>;
    findForSeller(sellerId: string): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        createdAt: Date;
        updatedAt: Date;
        sellerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        orderId: string;
    }[]>;
    markPaid(id: string, adminId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        createdAt: Date;
        updatedAt: Date;
        sellerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        orderId: string;
    }>;
}
