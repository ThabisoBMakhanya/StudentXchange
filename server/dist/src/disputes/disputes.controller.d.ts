import { DisputesService } from './disputes.service';
import { DisputeStatus } from '@prisma/client';
declare class RaiseDisputeDto {
    reason: string;
    details: string;
}
declare class ResolveDisputeDto {
    status: DisputeStatus;
    note: string;
}
export declare class DisputesController {
    private disputes;
    constructor(disputes: DisputesService);
    raise(orderId: string, userId: string, dto: RaiseDisputeDto): Promise<{
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
    resolve(id: string, adminId: string, dto: ResolveDisputeDto): Promise<{
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
export {};
