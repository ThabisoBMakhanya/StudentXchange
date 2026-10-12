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
exports.OrdersService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const COMMISSION_RATE = 0.1;
let OrdersService = class OrdersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async placeOrder(buyerId, dto) {
        const listing = await this.prisma.listing.findUnique({
            where: { id: dto.listingId },
        });
        if (!listing)
            throw new common_1.NotFoundException('Listing not found.');
        if (listing.status !== 'ACTIVE')
            throw new common_1.BadRequestException('Listing is not active.');
        if (listing.type === 'PHYSICAL') {
            const stock = listing.stock ?? 0;
            if (dto.quantity > stock)
                throw new common_1.BadRequestException('Not enough stock.');
        }
        const total = Number(listing.price) * dto.quantity;
        const commission = Math.round(total * COMMISSION_RATE * 100) / 100;
        return this.prisma.$transaction(async (tx) => {
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
    async markShipped(orderId, sellerId) {
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { listing: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.sellerId !== sellerId)
            throw new common_1.BadRequestException('Not your order.');
        if (order.escrowStatus !== 'HELD')
            throw new common_1.BadRequestException('Order is not in escrow.');
        if (order.listing.type !== 'PHYSICAL') {
            throw new common_1.BadRequestException('Only physical items can be shipped.');
        }
        return this.prisma.order.update({
            where: { id: orderId },
            data: {
                shippedAt: new Date(),
                trackingCode: `STX-${Math.floor(1000 + Math.random() * 9000)}`,
            },
        });
    }
    async confirmReceipt(orderId, buyerId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.buyerId !== buyerId)
            throw new common_1.BadRequestException('Not your order.');
        if (order.escrowStatus === 'WITHHELD_BY_ADMIN') {
            throw new common_1.BadRequestException('Funds are withheld by admin. Contact support.');
        }
        if (order.escrowStatus !== 'HELD') {
            throw new common_1.ConflictException(`Order is already ${order.escrowStatus.toLowerCase()}.`);
        }
        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id: orderId },
                data: {
                    confirmedAt: new Date(),
                    escrowStatus: 'RELEASED',
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
            return updated;
        });
    }
    async findOne(id, requesterId) {
        const order = await this.prisma.order.findUnique({
            where: { id },
            include: { listing: true, buyer: true, seller: true },
        });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        if (order.buyerId !== requesterId && order.sellerId !== requesterId) {
            throw new common_1.ForbiddenException('You are not a participant in this order.');
        }
        return order;
    }
    async findAll() {
        return this.prisma.order.findMany({
            include: { listing: true, buyer: true, seller: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async adminWithhold(orderId, adminId, reason) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
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
    async adminRelease(orderId, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
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
    async adminRefund(orderId, adminId) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { escrowStatus: 'REFUNDED' },
        });
        await this.logAudit(adminId, 'FUNDS_REFUNDED', 'order', orderId, 'Refunded to buyer by admin.');
        return updated;
    }
    async adminSplit(orderId, adminId, buyerPercent) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new common_1.NotFoundException('Order not found.');
        const updated = await this.prisma.order.update({
            where: { id: orderId },
            data: { escrowStatus: 'SPLIT' },
        });
        await this.logAudit(adminId, 'FUNDS_SPLIT', 'order', orderId, `Split ${buyerPercent}% buyer / ${100 - buyerPercent}% seller.`);
        return updated;
    }
    async logAudit(actorId, action, targetType, targetId, detail) {
        await this.prisma.auditLog.create({
            data: { actorId, action, targetType, targetId, detail },
        });
    }
};
exports.OrdersService = OrdersService;
exports.OrdersService = OrdersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], OrdersService);
//# sourceMappingURL=orders.service.js.map