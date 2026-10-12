import { ItemCondition, ListingType } from '@prisma/client';
export declare class CreateListingDto {
    type: ListingType;
    categoryId: string;
    title: string;
    description: string;
    price: number;
    images?: string[];
    stock?: number;
    condition?: ItemCondition;
    durationMinutes?: number;
    availabilitySlots?: string[];
    location: string;
}
