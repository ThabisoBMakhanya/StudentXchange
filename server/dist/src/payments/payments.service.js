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
var PaymentsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../prisma/prisma.service");
let PaymentsService = PaymentsService_1 = class PaymentsService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.logger = new common_1.Logger(PaymentsService_1.name);
    }
    async initiatePayment(orderId, method) {
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order)
            throw new Error('Order not found.');
        if (method === 'DPO_PAY') {
            return this.initiateDpoPay(order);
        }
        return this.initiateMtnMoMo(order);
    }
    async initiateDpoPay(order) {
        const apiUrl = this.config.get('DPO_PAY_API_URL');
        const storeToken = this.config.get('DPO_PAY_STORE_TOKEN');
        this.logger.log(`Initiating DPO Pay for order ${order.id}`);
        return {
            provider: 'DPO_PAY',
            orderId: order.id,
            amount: order.total,
            currency: 'SZL',
            paymentUrl: `https://secure.directpay.online/pay/${order.id}`,
            status: 'pending',
        };
    }
    async initiateMtnMoMo(order) {
        const apiUrl = this.config.get('MTN_MOMO_API_URL');
        const subscriptionKey = this.config.get('MTN_MOMO_SUBSCRIPTION_KEY');
        this.logger.log(`Initiating MTN MoMo for order ${order.id}`);
        return {
            provider: 'MTN_MOMO',
            orderId: order.id,
            amount: order.total,
            currency: 'SZL',
            reference: `momo-${order.id}`,
            status: 'pending',
        };
    }
    async handlePaymentWebhook(provider, payload) {
        this.logger.log(`Payment webhook from ${provider}: ${JSON.stringify(payload)}`);
        const orderId = payload.orderId || payload.externalId;
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) {
            this.logger.warn(`Webhook for unknown order: ${orderId}`);
            return;
        }
        if (payload.status === 'success' || payload.status === 'confirmed') {
            await this.prisma.order.update({
                where: { id: orderId },
                data: { escrowStatus: 'HELD' },
            });
            this.logger.log(`Order ${orderId} escrow status → HELD`);
        }
    }
};
exports.PaymentsService = PaymentsService;
exports.PaymentsService = PaymentsService = PaymentsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], PaymentsService);
//# sourceMappingURL=payments.service.js.map