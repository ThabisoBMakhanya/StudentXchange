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
exports.PayoutsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let PayoutsService = class PayoutsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    findAll() {
        return this.prisma.payout.findMany({
            include: { seller: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
    findForSeller(sellerId) {
        return this.prisma.payout.findMany({
            where: { sellerId },
            orderBy: { createdAt: 'desc' },
        });
    }
    async markPaid(payoutId, adminId) {
        const payout = await this.prisma.payout.findUnique({ where: { id: payoutId } });
        if (!payout)
            throw new common_1.NotFoundException('Payout not found.');
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
};
exports.PayoutsService = PayoutsService;
exports.PayoutsService = PayoutsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PayoutsService);
//# sourceMappingURL=payouts.service.js.map