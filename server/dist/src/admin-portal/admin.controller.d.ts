import { AdminService } from './admin.service';
import { UserStatus } from '@prisma/client';
declare class SetUserStatusDto {
    status: UserStatus;
}
declare class ReviewKycDto {
    status: 'APPROVED' | 'REJECTED';
    note?: string;
}
declare class CreateCategoryDto {
    type: 'PHYSICAL' | 'SERVICE';
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    parentId?: string;
}
declare class UpdateCategoryDto {
    name?: string;
    description?: string;
    icon?: string;
    parentId?: string;
    active?: boolean;
}
declare class UpdateCommissionDto {
    rate: number;
}
export declare class AdminController {
    private admin;
    constructor(admin: AdminService);
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
    setUserStatus(id: string, adminId: string, dto: SetUserStatusDto): Promise<{
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
    reviewKyc(id: string, adminId: string, dto: ReviewKycDto): Promise<{
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
    createCategory(dto: CreateCategoryDto): Promise<{
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
    updateCategory(id: string, dto: UpdateCategoryDto): Promise<{
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
    updateCommission(adminId: string, dto: UpdateCommissionDto): Promise<{
        success: boolean;
    }>;
}
export {};
