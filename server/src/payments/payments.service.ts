import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentMethod } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async initiatePayment(orderId: string, method: PaymentMethod) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { buyer: true },
    });
    if (!order) throw new Error('Order not found.');

    if (method === 'DPO_PAY') {
      return this.initiateDpoPay(order);
    }
    return this.initiateMtnMoMo(order);
  }

  private async initiateDpoPay(order: any) {
    const companyToken = this.config.get('DPO_PAY_COMPANY_TOKEN');
    const apiUrl = this.config.get('DPO_PAY_API_URL') || 'https://secure.3gdirectpay.com/API/v6/';
    const frontendUrl = this.config.get('FRONTEND_URL') || 'http://localhost:5173';

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${companyToken}</CompanyToken>
  <Request>createToken</Request>
  <Transaction>
    <PaymentAmount>${Number(order.total).toFixed(2)}</PaymentAmount>
    <PaymentCurrency>SZL</PaymentCurrency>
    <CompanyRef>${order.id}</CompanyRef>
    <CompanyRefUnique>1</CompanyRefUnique>
    <RedirectURL>${frontendUrl}/orders/${order.id}?paid=1</RedirectURL>
    <BackURL>${frontendUrl}/orders/${order.id}</BackURL>
    <customerFirstName>${order.buyer.fullName.split(' ')[0]}</customerFirstName>
    <customerLastName>${order.buyer.fullName.split(' ').slice(1).join(' ') || ''}</customerLastName>
    <customerEmail>${order.buyer.email}</customerEmail>
    <customerPhone>${order.buyer.phone}</customerPhone>
    <DefaultPayment>CC</DefaultPayment>
    <TransactionSource>API</TransactionSource>
  </Transaction>
  <Services>
    <Service>
      <ServiceType>6456</ServiceType>
      <ServiceDescription>${order.listing?.title || 'StudentXchange purchase'}</ServiceDescription>
      <ServiceDate>${new Date().toISOString().slice(0, 16).replace('T', ' ')}</ServiceDate>
    </Service>
  </Services>
</API3G>`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/xml',
      },
      body: xml,
    });

    const text = await response.text();
    this.logger.log(`DPO Pay response: ${text}`);

    const resultMatch = text.match(/<Result>([^<]+)<\/Result>/);
    const tokenMatch = text.match(/<TransToken>([^<]+)<\/TransToken>/);
    const explanationMatch = text.match(/<ResultExplanation>([^<]+)<\/ResultExplanation>/);

    if (!resultMatch || resultMatch[1] !== '000' || !tokenMatch?.[1]) {
      throw new Error(explanationMatch?.[1] || 'DPO Pay transaction creation failed');
    }

    return {
      provider: 'DPO_PAY',
      orderId: order.id,
      amount: order.total,
      currency: 'SZL',
      paymentUrl: `https://secure.3gdirectpay.com//payv2.php?ID=${tokenMatch[1]}`,
      transactionToken: tokenMatch[1],
      status: 'pending',
    };
  }

  private async initiateMtnMoMo(order: any) {
    const baseUrl = this.config.get('MTN_MOMO_API_URL') || 'https://sandbox.momodeveloper.mtn.com/collection';
    const subscriptionKey = this.config.get('MTN_MOMO_SUBSCRIPTION_KEY');
    const apiUser = this.config.get('MTN_MOMO_API_USER');
    const apiKey = this.config.get('MTN_MOMO_API_PASSWORD');
    const targetEnv = this.config.get('MTN_MOMO_TARGET_ENV') || 'sandbox';
    const callbackUrl = this.config.get('MTN_MOMO_CALLBACK_URL') || '';

    const tokenResponse = await fetch(`${baseUrl}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
      body: JSON.stringify({
        apiUser,
        apiKey,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('MTN MoMo authentication failed');
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    const referenceId = crypto.randomUUID();

    const paymentResponse = await fetch(`${baseUrl}/v1_0/requesttopay`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        Authorization: `Bearer ${accessToken}`,
        'X-Target-Environment': targetEnv,
        'X-Callback-Url': callbackUrl,
        'X-Reference-Id': referenceId,
      },
      body: JSON.stringify({
        amount: String(order.total),
        currency: 'SZL',
        externalId: order.id,
        payer: {
          partyIdType: 'MSISDN',
          partyId: order.buyer.phone,
        },
        payerMessage: `StudentXchange order ${order.id}`,
        payeeNote: `Order ${order.id}`,
      }),
    });

    if (!paymentResponse.ok) {
      const errText = await paymentResponse.text();
      throw new Error(`MTN MoMo request to pay failed: ${errText}`);
    }

    return {
      provider: 'MTN_MOMO',
      orderId: order.id,
      amount: order.total,
      currency: 'SZL',
      reference: referenceId,
      status: 'pending',
    };
  }

  async checkMtnMoMoStatus(referenceId: string) {
    const baseUrl = this.config.get('MTN_MOMO_API_URL') || 'https://sandbox.momodeveloper.mtn.com/collection';
    const subscriptionKey = this.config.get('MTN_MOMO_SUBSCRIPTION_KEY');
    const apiUser = this.config.get('MTN_MOMO_API_USER');
    const apiKey = this.config.get('MTN_MOMO_API_PASSWORD');
    const targetEnv = this.config.get('MTN_MOMO_TARGET_ENV') || 'sandbox';

    const tokenResponse = await fetch(`${baseUrl}/token/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': subscriptionKey,
      },
      body: JSON.stringify({ apiUser, apiKey }),
    });

    if (!tokenResponse.ok) throw new Error('MTN MoMo authentication failed');
    const { access_token } = await tokenResponse.json();

    const statusResponse = await fetch(`${baseUrl}/v1_0/requesttopay/${referenceId}`, {
      headers: {
        'Ocp-Apim-Subscription-Key': subscriptionKey,
        Authorization: `Bearer ${access_token}`,
        'X-Target-Environment': targetEnv,
      },
    });

    if (!statusResponse.ok) throw new Error('Failed to check MTN MoMo payment status');
    return statusResponse.json();
  }

  async verifyDpoPayToken(transactionToken: string) {
    const companyToken = this.config.get('DPO_PAY_COMPANY_TOKEN');
    const apiUrl = this.config.get('DPO_PAY_API_URL') || 'https://secure.3gdirectpay.com/API/v6/';

    const xml = `<?xml version="1.0" encoding="utf-8"?>
<API3G>
  <CompanyToken>${companyToken}</CompanyToken>
  <Request>verifyToken</Request>
  <TransactionToken>${transactionToken}</TransactionToken>
</API3G>`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        Accept: 'application/xml',
      },
      body: xml,
    });

    const text = await response.text();
    this.logger.log(`DPO Pay verify response: ${text}`);

    const statusMatch = text.match(/<TransactionStatus>([^<]+)<\/TransactionStatus>/);
    const resultMatch = text.match(/<Result>([^<]+)<\/Result>/);

    return {
      verified: resultMatch?.[1] === '000',
      status: statusMatch?.[1] || 'unknown',
      raw: text,
    };
  }

  async handlePaymentWebhook(provider: string, payload: any) {
    this.logger.log(`Payment webhook from ${provider}: ${JSON.stringify(payload)}`);

    const orderId = payload.orderId || payload.externalId || payload.CompanyRef;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.warn(`Webhook for unknown order: ${orderId}`);
      return;
    }

    if (provider === 'MTN_MOMO') {
      const status = payload.status;
      if (status === 'SUCCESSFUL') {
        await this.prisma.order.update({
          where: { id: orderId },
          data: { escrowStatus: 'HELD' },
        });
        this.logger.log(`Order ${orderId} escrow status → HELD`);
      }
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
