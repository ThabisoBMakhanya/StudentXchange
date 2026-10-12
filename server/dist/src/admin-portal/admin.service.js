"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AdminService = class AdminService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getKpis() {
        const [totalUsers, totalSellers, totalListings, activeListings, totalOrders, pendingKycSubmissions, openDisputes, escrowAgg, revenue,] = await Promise.all([
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
    async getUsers(search) {
        const where = {};
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
    async setUserStatus(userId, adminId, status) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found.');
        const updated = await this.prisma.user.update({
            where: { id: userId },
            data: { status },
        });
        const action = status === 'ACTIVE'
            ? 'USER_REACTIVATED'
            : status === 'SUSPENDED'
                ? 'USER_SUSPENDED'
                : 'USER_BANNED';
        await this.logAudit(adminId, action, 'user', userId, `${user.fullName} → ${status.toLowerCase()}.`);
        return updated;
    }
    async getKycSubmissions() {
        return this.prisma.kycSubmission.findMany({
            where: { status: 'PENDING' },
            include: { user: { select: { id: true, fullName: true, email: true } } },
            orderBy: { createdAt: 'asc' },
        });
    }
    async reviewKyc(submissionId, adminId, status, note) {
        const submission = await this.prisma.kycSubmission.findUnique({
            where: { id: submissionId },
        });
        if (!submission)
            throw new common_1.NotFoundException('KYC submission not found.');
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
    async getCategories(type) {
        return this.prisma.category.findMany({
            where: type ? { type } : undefined,
            orderBy: { sortOrder: 'asc' },
        });
    }
    async createCategory(data) {
        const category = await this.prisma.category.create({ data });
        await this.logAudit('admin', 'CATEGORY_CREATED', 'category', category.id, `Created "${category.name}".`);
        return category;
    }
    async updateCategory(id, data) {
        const category = await this.prisma.category.update({ where: { id }, data });
        await this.logAudit('admin', 'CATEGORY_UPDATED', 'category', id, `Updated "${category.name}".`);
        return category;
    }
    async deleteCategory(id) {
        const category = await this.prisma.category.update({
            where: { id },
            data: { active: false },
        });
        await this.logAudit('admin', 'CATEGORY_DELETED', 'category', id, `Deleted "${category.name}".`);
        return category;
    }
    async getAuditLog() {
        return this.prisma.auditLog.findMany({
            orderBy: { createdAt: 'desc' },
            take: 200,
        });
    }
    async updateCommission(adminId, rate) {
        await this.prisma.platformSetting.upsert({
            where: { key: 'commission_rate' },
            update: { value: String(rate) },
            create: { key: 'commission_rate', value: String(rate) },
        });
        await this.logAudit(adminId, 'COMMISSION_UPDATED', 'settings', 'commission_rate', `Commission set to ${rate}%.`);
        return { success: true };
    }
    async logAudit(actorId, action, targetType, targetId, detail) {
        await this.prisma.auditLog.create({
            data: { actorId, action, targetType, targetId, detail },
        });
    }
};
exports.AdminService = AdminService;
exports.AdminService = AdminService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AdminService);
//# sourceMappingURL=admin.service.js.map