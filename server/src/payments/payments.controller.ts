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
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('orders/:orderId/initiate')
  initiate(@Param('orderId') orderId: string, @Body() dto: InitiatePaymentDto) {
    return this.payments.initiatePayment(orderId, dto.method);
  }
}
