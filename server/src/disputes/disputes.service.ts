import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DisputeStatus } from '@prisma/client';

@Injectable()
export class DisputesService {
  constructor(private prisma: PrismaService) {}

  async raise(
    orderId: string,
    raisedById: string,
    reason: string,
    details: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Order not found.');
    if (raisedById !== order.buyerId && raisedById !== order.sellerId) {
      throw new ForbiddenException('Only the buyer or seller can dispute this order.');
    }
    if (order.escrowStatus !== 'HELD') {
      throw new ConflictException('Only orders currently held in escrow can be disputed.');
    }

    return this.prisma.$transaction(async (tx) => {
      const dispute = await tx.dispute.create({
        data: { orderId, raisedById, reason, details },
      });

      await tx.order.update({
        where: { id: orderId },
        data: { escrowStatus: 'DISPUTED' },
      });

      return dispute;
    });
  }

  async findAll() {
    return this.prisma.dispute.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async resolve(
    disputeId: string,
    adminId: string,
    status: DisputeStatus,
    note: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });
    if (!dispute) throw new NotFoundException('Dispute not found.');
    if (dispute.status !== 'OPEN') {
      throw new ConflictException('This dispute has already been resolved.');
    }
    if (status === 'OPEN' || status === 'CLOSED') {
      throw new BadRequestException('Choose a final dispute resolution.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.dispute.update({
        where: { id: disputeId },
        data: { status, resolutionNote: note },
      });

      const order = await tx.order.findUnique({ where: { id: dispute.orderId } });
      if (!order) throw new NotFoundException('Disputed order not found.');

      const escrowStatus = status === 'RESOLVED_BUYER'
        ? 'REFUNDED'
        : status === 'RESOLVED_SELLER'
          ? 'RELEASED'
          : 'SPLIT';

      await tx.order.update({
        where: { id: order.id },
        data: { escrowStatus },
      });

      if (status === 'RESOLVED_SELLER' || status === 'SPLIT') {
        const sellerAmount = Number(order.total) - Number(order.commission);
        await tx.payout.upsert({
          where: { orderId: order.id },
          update: {},
          create: {
            sellerId: order.sellerId,
            orderId: order.id,
            amount: status === 'SPLIT' ? sellerAmount / 2 : sellerAmount,
            status: 'PENDING',
          },
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: 'DISPUTE_RESOLVED',
          targetType: 'order',
          targetId: dispute.orderId,
          detail: `${status}: ${note}`,
        },
      });

      return updated;
    });
  }
}
