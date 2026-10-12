import { CategoriesService } from './categories.service';
import { ListingType } from '@prisma/client';
export declare class CategoriesController {
    private categories;
    constructor(categories: CategoriesService);
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
}
