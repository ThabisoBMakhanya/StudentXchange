import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListingType } from '@prisma/client';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findAll(type?: ListingType) {
    return this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async create(data: {
    type: ListingType;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    parentId?: string;
  }) {
    return this.prisma.category.create({ data });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      icon: string;
      parentId: string;
      active: boolean;
    }>,
  ) {
    return this.prisma.category.update({ where: { id }, data });
  }

  async remove(id: string) {
    // Soft-delete: deactivate instead of removing to preserve order history
    return this.prisma.category.update({
      where: { id },
      data: { active: false },
    });
  }
}
