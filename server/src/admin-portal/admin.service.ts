import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { KycStatus, Role, UserStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ─── KPI Dashboard ─────────────────────────────────────────────────────────

  async getKpis() {
    const [
      totalUsers,
      totalSellers,
      totalListings,
      activeListings,
      totalOrders,
      pendingKycSubmissions,
      openDisputes,
      escrowAgg,
      revenue,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { roles: { has: 'SELLER' } } }),
      this.prisma.listing.count(),
      this.prisma.listing.count({ where: { status: 'ACTIVE' } }),
      this.prisma.order.count(),
      this.prisma.kycSubmission.count({ where: { status: 'PENDING' } }),
      this.prisma.dispute.count({ where: { status: 'OPEN' } }),
      this.prisma.order.aggregate({
        _sum: { total: true },
        where: { escrowStatus: { in: ['HELD', 'WITHHELD_BY_ADMIN', 'DISPUTED'] } },
      }),
      this.prisma.order.aggregate({
        _sum: { commission: true },
        where: { escrowStatus: { in: ['RELEASED', 'SPLIT'] } },
      }),
    ]);

    const withheldAgg = await this.prisma.order.aggregate({
      _sum: { total: true },
      where: { escrowStatus: 'WITHHELD_BY_ADMIN' },
    });

    return {
      totalUsers,
      totalSellers,
      totalListings,
      activeListings,
      totalOrders,
      escrowBalance: escrowAgg._sum.total ?? 0,
      withheldBalance: withheldAgg._sum.total ?? 0,
      revenue: revenue._sum.commission ?? 0,
      pendingKyc: pendingKycSubmissions,
      openDisputes,
    };
  }

  // ─── User Management ───────────────────────────────────────────────────────

  async getUsers(search?: string) {
    const where: any = {};
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { university: { contains: search, mode: 'insensitive' } },
      ];
    }
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        university: true,
        roles: true,
        kycStatus: true,
        status: true,
        createdAt: true,
      },
    });
    return users;
  }

  async setUserStatus(userId: string, adminId: string, status: UserStatus) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found.');

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });

    const action =
      status === 'ACTIVE'
        ? 'USER_REACTIVATED'
        : status === 'SUSPENDED'
          ? 'USER_SUSPENDED'
          : 'USER_BANNED';

    await this.logAudit(adminId, action, 'user', userId, `${user.fullName} → ${status.toLowerCase()}.`);
    return updated;
  }

  // ─── KYC Management ────────────────────────────────────────────────────────

  async getKycSubmissions() {
    return this.prisma.kycSubmission.findMany({
      where: { status: 'PENDING' },
      include: { user: { select: { id: true, fullName: true, email: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewKyc(
    submissionId: string,
    adminId: string,
    status: 'APPROVED' | 'REJECTED',
    note?: string,
  ) {
    const submission = await this.prisma.kycSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new NotFoundException('KYC submission not found.');

    return this.prisma.$transaction(async (tx) => {
      await tx.kycSubmission.update({
        where: { id: submissionId },
        data: { status, note, reviewedBy: adminId },
      });

      await tx.user.update({
        where: { id: submission.userId },
        data: { kycStatus: status },
      });

      await tx.auditLog.create({
        data: {
          actorId: adminId,
          action: `KYC_${status}`,
          targetType: 'user',
          targetId: submission.userId,
          detail: note ?? `KYC ${status.toLowerCase()}.`,
        },
      });

      return { success: true };
    });
  }

  // ─── Category Management ──────────────────────────────────────────────────

  async getCategories(type?: 'PHYSICAL' | 'SERVICE') {
    return this.prisma.category.findMany({
      where: type ? { type } : undefined,
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createCategory(data: {
    type: 'PHYSICAL' | 'SERVICE';
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    parentId?: string;
  }) {
    const category = await this.prisma.category.create({ data });
    await this.logAudit('admin', 'CATEGORY_CREATED', 'category', category.id, `Created "${category.name}".`);
    return category;
  }

  async updateCategory(
    id: string,
    data: Partial<{ name: string; description: string; icon: string; parentId: string; active: boolean }>,
  ) {
    const category = await this.prisma.category.update({ where: { id }, data });
    await this.logAudit('admin', 'CATEGORY_UPDATED', 'category', id, `Updated "${category.name}".`);
    return category;
  }

  async deleteCategory(id: string) {
    const category = await this.prisma.category.update({
      where: { id },
      data: { active: false },
    });
    await this.logAudit('admin', 'CATEGORY_DELETED', 'category', id, `Deleted "${category.name}".`);
    return category;
  }

  // ─── Audit Log ─────────────────────────────────────────────────────────────

  async getAuditLog() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  async updateCommission(adminId: string, rate: number) {
    await this.prisma.platformSetting.upsert({
      where: { key: 'commission_rate' },
      update: { value: String(rate) },
      create: { key: 'commission_rate', value: String(rate) },
    });
    await this.logAudit(adminId, 'COMMISSION_UPDATED', 'settings', 'commission_rate', `Commission set to ${rate}%.`);
    return { success: true };
  }

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
