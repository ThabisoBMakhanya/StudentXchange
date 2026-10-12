import { ListingType } from '@prisma/client';
export declare class ListingsQueryDto {
    type?: ListingType;
    categoryId?: string;
    search?: string;
}
