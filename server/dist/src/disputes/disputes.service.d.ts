import { PrismaService } from '../prisma/prisma.service';
import { DisputeStatus } from '@prisma/client';
export declare class DisputesService {
    private prisma;
    constructor(prisma: PrismaService);
    raise(orderId: string, raisedById: string, reason: string, details: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.DisputeStatus;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        reason: string;
        details: string;
        resolutionNote: string | null;
        raisedById: string;
    }>;
    findAll(): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.DisputeStatus;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        reason: string;
        details: string;
        resolutionNote: string | null;
        raisedById: string;
    }[]>;
    resolve(disputeId: string, adminId: string, status: DisputeStatus, note: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.DisputeStatus;
        createdAt: Date;
        updatedAt: Date;
        orderId: string;
        reason: string;
        details: string;
        resolutionNote: string | null;
        raisedById: string;
    }>;
}
