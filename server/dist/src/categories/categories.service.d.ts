import { PrismaService } from '../prisma/prisma.service';
import { ListingType } from '@prisma/client';
export declare class CategoriesService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(type?: ListingType): Promise<{
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
    create(data: {
        type: ListingType;
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
    update(id: string, data: Partial<{
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
    remove(id: string): Promise<{
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
}
