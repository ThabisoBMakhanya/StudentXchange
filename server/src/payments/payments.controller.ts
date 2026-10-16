import {
  Body,
  Controller,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsEnum } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

class InitiatePaymentDto {
  @IsEnum(PaymentMethod)
  method: PaymentMethod;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('payments/orders/:orderId/initiate')
  initiate(@Param('orderId') orderId: string, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiatePayment(orderId, dto.method);
  }

  @Post('payments/webhooks/:provider')
  webhook(@Param('provider') provider: string, @Body() payload: any) {
    return this.payments.handlePaymentWebhook(provider, payload);
  }

  @Post('payments/momo/status/:referenceId')
  momoStatus(@Param('referenceId') referenceId: string) {
    return this.payments.checkMtnMoMoStatus(referenceId);
  }

  @Post('payments/dpo/verify/:transactionToken')
  dpoVerify(@Param('transactionToken') transactionToken: string) {
    return this.payments.verifyDpoPayToken(transactionToken);
  }
}
