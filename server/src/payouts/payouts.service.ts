import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayoutsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.payout.findMany({
      include: { seller: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findForSeller(sellerId: string) {
    return this.prisma.payout.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markPaid(payoutId: string, adminId: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
    if (!payout) throw new NotFoundException('Payout not found.');

    const updated = await this.prisma.payout.update({
      where: { id: payoutId },
      data: { status: 'PAID' },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId: adminId,
        action: 'PAYOUT_PAID',
        targetType: 'payout',
        targetId: payoutId,
        detail: `Paid ${payout.amount} SZL to seller.`,
      },
    });

    return updated;
  }
}
