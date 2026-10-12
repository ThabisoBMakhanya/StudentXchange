import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';

@Injectable()
export class ListingsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: ListingsQueryDto) {
    const where: any = { status: 'ACTIVE' };
    if (query.type) where.type = query.type.toUpperCase();
    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: query.categoryId },
      });
      if (category) {
        const children = await this.prisma.category.findMany({
          where: { parentId: query.categoryId },
          select: { id: true },
        });
        where.categoryId = {
          in: [query.categoryId, ...children.map((c) => c.id)],
        };
      }
    }
    return this.prisma.listing.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    return listing;
  }

  async create(sellerId: string, dto: CreateListingDto) {
    return this.prisma.listing.create({
      data: {
        sellerId,
        type: dto.type.toUpperCase() as any,
        categoryId: dto.categoryId,
        title: dto.title,
        description: dto.description,
        price: dto.price,
        currency: 'SZL',
        images: dto.images ?? [],
        stock: dto.type === 'PHYSICAL' ? dto.stock ?? 1 : null,
        condition: dto.type === 'PHYSICAL' ? (dto.condition as any) : null,
        durationMinutes: dto.type === 'SERVICE' ? dto.durationMinutes : null,
        availabilitySlots: dto.type === 'SERVICE' ? dto.availabilitySlots ?? [] : [],
        location: dto.location,
      },
    });
  }
}
