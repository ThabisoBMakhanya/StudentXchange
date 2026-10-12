import { PrismaService } from '../prisma/prisma.service';
export declare class PayoutsService {
    private prisma;
    constructor(prisma: PrismaService);
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
    markPaid(payoutId: string, adminId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.PayoutStatus;
        createdAt: Date;
        updatedAt: Date;
        sellerId: string;
        amount: import("@prisma/client/runtime/library").Decimal;
        orderId: string;
    }>;
}
