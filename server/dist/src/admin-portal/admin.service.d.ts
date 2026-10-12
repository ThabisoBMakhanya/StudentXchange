import { PrismaService } from '../prisma/prisma.service';
import { UserStatus } from '@prisma/client';
export declare class AdminService {
    private prisma;
    constructor(prisma: PrismaService);
    getKpis(): Promise<{
        totalUsers: number;
        totalSellers: number;
        totalListings: number;
        activeListings: number;
        totalOrders: number;
        escrowBalance: number | import("@prisma/client/runtime/library").Decimal;
        withheldBalance: number | import("@prisma/client/runtime/library").Decimal;
        revenue: number | import("@prisma/client/runtime/library").Decimal;
        pendingKyc: number;
        openDisputes: number;
    }>;
    getUsers(search?: string): Promise<{
        email: string;
        fullName: string;
        phone: string;
        university: string;
        roles: import(".prisma/client").$Enums.Role[];
        id: string;
        kycStatus: import(".prisma/client").$Enums.KycStatus;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
    }[]>;
    setUserStatus(userId: string, adminId: string, status: UserStatus): Promise<{
        email: string;
        fullName: string;
        phone: string;
        university: string;
        roles: import(".prisma/client").$Enums.Role[];
        id: string;
        passwordHash: string;
        kycStatus: import(".prisma/client").$Enums.KycStatus;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
    getKycSubmissions(): Promise<({
        user: {
            email: string;
            fullName: string;
            id: string;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
        updatedAt: Date;
        note: string | null;
        userId: string;
        idNumber: string;
        idPhotoUrl: string;
        reviewedBy: string | null;
    })[]>;
    reviewKyc(submissionId: string, adminId: string, status: 'APPROVED' | 'REJECTED', note?: string): Promise<{
        success: boolean;
    }>;
    getCategories(type?: 'PHYSICAL' | 'SERVICE'): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        type: import(".prisma/client").$Enums.ListingType;
        description: string;
        slug: string;
        icon: string;
        parentId: string | null;
        active: boolean;
        sortOrder: number;
    }[]>;
    createCategory(data: {
        type: 'PHYSICAL' | 'SERVICE';
        name: string;
        slug: string;
        description?: string;
        icon?: string;
        parentId?: string;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        type: import(".prisma/client").$Enums.ListingType;
        description: string;
        slug: string;
        icon: string;
        parentId: string | null;
        active: boolean;
        sortOrder: number;
    }>;
    updateCategory(id: string, data: Partial<{
        name: string;
        description: string;
        icon: string;
        parentId: string;
        active: boolean;
    }>): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        type: import(".prisma/client").$Enums.ListingType;
        description: string;
        slug: string;
        icon: string;
        parentId: string | null;
        active: boolean;
        sortOrder: number;
    }>;
    deleteCategory(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        type: import(".prisma/client").$Enums.ListingType;
        description: string;
        slug: string;
        icon: string;
        parentId: string | null;
        active: boolean;
        sortOrder: number;
    }>;
    getAuditLog(): Promise<{
        id: string;
        createdAt: Date;
        action: string;
        targetType: string;
        targetId: string;
        detail: string;
        actorId: string;
    }[]>;
    updateCommission(adminId: string, rate: number): Promise<{
        success: boolean;
    }>;
    private logAudit;
}
