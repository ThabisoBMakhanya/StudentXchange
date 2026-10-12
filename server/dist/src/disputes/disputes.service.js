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
exports.DisputesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let DisputesService = class DisputesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async raise(orderId, raisedById, reason, details) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (raisedById !== order.buyerId && raisedById !== order.sellerId) {
            throw new common_1.ForbiddenException('Only the buyer or seller can dispute this order.');
        }
        if (order.escrowStatus !== 'HELD') {
            throw new common_1.ConflictException('Only orders currently held in escrow can be disputed.');
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
    async resolve(disputeId, adminId, status, note) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id: disputeId },
        });
        if (!dispute)
            throw new common_1.NotFoundException('Dispute not found.');
        if (dispute.status !== 'OPEN') {
            throw new common_1.ConflictException('This dispute has already been resolved.');
        }
        if (status === 'OPEN' || status === 'CLOSED') {
            throw new common_1.BadRequestException('Choose a final dispute resolution.');
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.dispute.update({
                where: { id: disputeId },
                data: { status, resolutionNote: note },
            });
            const order = await tx.order.findUnique({ where: { id: dispute.orderId } });
            if (!order)
                throw new common_1.NotFoundException('Disputed order not found.');
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
};
exports.DisputesService = DisputesService;
exports.DisputesService = DisputesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DisputesService);
//# sourceMappingURL=disputes.service.js.map