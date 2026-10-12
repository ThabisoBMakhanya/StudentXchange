import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';

/**
 * Payment provider integration.
 *
 * DPO Pay (cards) and MTN MoMo (mobile money) are initialized here.
 * In production, replace the mock implementations with actual API calls:
 *
 * DPO Pay: POST {DPO_PAY_API_URL}/payments with store token + card details
 * MTN MoMo: POST {MTN_MOMO_API_URL}/collection/v1_0/requesttopay with OAuth token
 *
 * Webhooks from both providers should update the order's escrowStatus to HELD
 * once funds are confirmed in the platform escrow account.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  /**
   * Initialize a payment with the selected provider.
   * Returns a payment session/token that the frontend uses to complete payment.
   */
  async initiatePayment(orderId: string, method: PaymentMethod) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) throw new Error('Order not found.');

    if (method === 'DPO_PAY') {
      return this.initiateDpoPay(order);
    }
    return this.initiateMtnMoMo(order);
  }

  private async initiateDpoPay(order: any) {
    const apiUrl = this.config.get('DPO_PAY_API_URL');
    const storeToken = this.config.get('DPO_PAY_STORE_TOKEN');

    this.logger.log(`Initiating DPO Pay for order ${order.id}`);

    // Production: call DPO Pay API to create a payment token
    // const response = await fetch(`${apiUrl}/payments`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     storeToken,
    //     amount: order.total,
    //     currency: 'SZL',
    //     orderId: order.id,
    //   }),
    // });

    // Mock response for development
    return {
      provider: 'DPO_PAY',
      orderId: order.id,
      amount: order.total,
      currency: 'SZL',
      paymentUrl: `https://secure.directpay.online/pay/${order.id}`,
      status: 'pending',
    };
  }

  private async initiateMtnMoMo(order: any) {
    const apiUrl = this.config.get('MTN_MOMO_API_URL');
    const subscriptionKey = this.config.get('MTN_MOMO_SUBSCRIPTION_KEY');

    this.logger.log(`Initiating MTN MoMo for order ${order.id}`);

    // Production: OAuth + request-to-pay
    // const token = await this.getMtnMoMoToken();
    // const response = await fetch(`${apiUrl}/collection/v1_0/requesttopay`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Ocp-Apim-Subscription-Key': subscriptionKey,
    //     Authorization: `Bearer ${token}`,
    //   },
    //   body: JSON.stringify({
    //     amount: order.total,
    //     currency: 'SZL',
    //     externalId: order.id,
    //     payer: { partyIdType: 'MSISDN', partyId: order.buyer.phone },
    //     payerMessage: `StudentXchange order ${order.id}`,
    //     payeeNote: `Order ${order.id}`,
    //   }),
    // });

    // Mock response for development
    return {
      provider: 'MTN_MOMO',
      orderId: order.id,
      amount: order.total,
      currency: 'SZL',
      reference: `momo-${order.id}`,
      status: 'pending',
    };
  }

  /**
   * Webhook handler for payment confirmations.
   * Called by DPO Pay / MTN MoMo when funds land in escrow.
   */
  async handlePaymentWebhook(provider: string, payload: any) {
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
}
