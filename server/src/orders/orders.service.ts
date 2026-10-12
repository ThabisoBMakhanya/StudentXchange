import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { EscrowStatus, PayoutStatus, Prisma } from '@prisma/client';

const COMMISSION_RATE = 0.1; // 10% platform commission

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

  // ─── Customer actions ──────────────────────────────────────────────────────

  async placeOrder(buyerId: string, dto: PlaceOrderDto) {
    const listing = await this.prisma.listing.findUnique({
      where: { id: dto.listingId },
    });
    if (!listing) throw new NotFoundException('Listing not found.');
    if (listing.status !== 'ACTIVE') throw new BadRequestException('Listing is not active.');

    if (listing.type === 'PHYSICAL') {
      const stock = listing.stock ?? 0;
      if (dto.quantity > stock) throw new BadRequestException('Not enough stock.');
    }

    const total = Number(listing.price) * dto.quantity;
    const commission = Math.round(total * COMMISSION_RATE * 100) / 100;

    return this.prisma.$transaction(async (tx) => {
      // Decrement stock for physical items
      if (listing.type === 'PHYSICAL') {
        await tx.listing.update({
          where: { id: listing.id },
          data: { stock: { decrement: dto.quantity } },
        });
      }

      const order = await tx.order.create({
        data: {
          listingId: listing.id,
          buyerId,
          sellerId: listing.sellerId,
          quantity: dto.quantity,
          unitPrice: listing.price,
          total,
          commission,
          paymentMethod: dto.paymentMethod,
          escrowStatus: 'HELD',
        },
        include: { listing: true, buyer: true, seller: true },
      });

      return order;
    });
  }

  async markShipped(orderId: string, sellerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { listing: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.sellerId !== sellerId) throw new BadRequestException('Not your order.');
    if (order.escrowStatus !== 'HELD') throw new BadRequestException('Order is not in escrow.');
    if (order.listing.type !== 'PHYSICAL') {
      throw new BadRequestException('Only physical items can be shipped.');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: {
        shippedAt: new Date(),
        trackingCode: `STX-${Math.floor(1000 + Math.random() * 9000)}`,
      },
    });
  }

  async confirmReceipt(orderId: string, buyerId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerId !== buyerId) throw new BadRequestException('Not your order.');

    if (order.escrowStatus === 'WITHHELD_BY_ADMIN') {
      throw new BadRequestException('Funds are withheld by admin. Contact support.');
    }
    if (order.escrowStatus !== 'HELD') {
      throw new ConflictException(`Order is already ${order.escrowStatus.toLowerCase()}.`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          confirmedAt: new Date(),
          escrowStatus: 'RELEASED',
        },
      });

      // Create payout for the seller (total minus commission)
      await tx.payout.create({
        data: {
          sellerId: order.sellerId,
          orderId: order.id,
          amount: Number(order.total) - Number(order.commission),
          status: 'PENDING',
        },
      });

      return updated;
    });
  }

  // ─── Queries ───────────────────────────────────────────────────────────────

  async findOne(id: string, requesterId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { listing: true, buyer: true, seller: true },
    });
    if (!order) throw new NotFoundException('Order not found.');
    if (order.buyerId !== requesterId && order.sellerId !== requesterId) {
      throw new ForbiddenException('You are not a participant in this order.');
    }
    return order;
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: { listing: true, buyer: true, seller: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ─── Admin escrow control ──────────────────────────────────────────────────

  async adminWithhold(orderId: string, adminId: string, reason: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: {
        escrowStatus: 'WITHHELD_BY_ADMIN',
        withheldAt: new Date(),
        withheldReason: reason,
      },
    });

    await this.logAudit(adminId, 'FUNDS_WITHHELD', 'order', orderId, `Withheld: ${reason}`);
    return updated;
  }

  async adminRelease(orderId: string, adminId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id: orderId },
        data: {
          escrowStatus: 'RELEASED',
          confirmedAt: new Date(),
        },
      });

      await tx.payout.create({
        data: {
          sellerId: order.sellerId,
          orderId: order.id,
          amount: Number(order.total) - Number(order.commission),
          status: 'PENDING',
        },
      });

      await this.logAudit(adminId, 'FUNDS_RELEASED', 'order', orderId, 'Released to seller by admin.');
      return updated;
    });
  }

  async adminRefund(orderId: string, adminId: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { escrowStatus: 'REFUNDED' },
    });

    await this.logAudit(adminId, 'FUNDS_REFUNDED', 'order', orderId, 'Refunded to buyer by admin.');
    return updated;
  }

  async adminSplit(orderId: string, adminId: string, buyerPercent: number) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');

    const updated = await this.prisma.order.update({
      where: { id: orderId },
      data: { escrowStatus: 'SPLIT' },
    });

    await this.logAudit(
      adminId,
      'FUNDS_SPLIT',
      'order',
      orderId,
      `Split ${buyerPercent}% buyer / ${100 - buyerPercent}% seller.`,
    );
    return updated;
  }

  // ─── Audit ─────────────────────────────────────────────────────────────────

  private async logAudit(
    actorId: string,
    action: string,
    targetType: string,
    targetId: string,
    detail: string,
  ) {
    await this.prisma.auditLog.create({
      data: { actorId, action, targetType, targetId, detail },
    });
  }
}
