import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found.');
    const { passwordHash, ...rest } = user;
    return rest;
  }

  async getSellerListings(sellerId: string) {
    return this.prisma.listing.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersForBuyer(buyerId: string) {
    return this.prisma.order.findMany({
      where: { buyerId },
      include: { listing: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOrdersForSeller(sellerId: string) {
    return this.prisma.order.findMany({
      where: { sellerId },
      include: { listing: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getListing(id: string) {
    const listing = await this.prisma.listing.findUnique({ where: { id } });
    if (!listing) throw new NotFoundException('Listing not found.');
    return listing;
  }
}
