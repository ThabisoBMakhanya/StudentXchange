import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PlaceOrderDto } from './dto/place-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';
import { IsNumber, IsString, Min, Max } from 'class-validator';

class WithholdDto {
  @IsString()
  reason: string;
}

class SplitDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  buyerPercent: number;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Post('orders')
  placeOrder(@CurrentUser('sub') buyerId: string, @Body() dto: PlaceOrderDto) {
    return this.orders.placeOrder(buyerId, dto);
  }

  @Get('orders/buyer')
  findForBuyer(@CurrentUser('sub') buyerId: string) {
    return this.orders.findForBuyer(buyerId);
  }

  @Get('orders/seller')
  findForSeller(@CurrentUser('sub') sellerId: string) {
    return this.orders.findForSeller(sellerId);
  }

  @Get('orders/:id')
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.orders.findOne(id, userId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.SELLER)
  @Post('orders/:id/ship')
  markShipped(@Param('id') id: string, @CurrentUser('sub') sellerId: string) {
    return this.orders.markShipped(id, sellerId);
  }

  @Post('orders/:id/confirm')
  confirmReceipt(@Param('id') id: string, @CurrentUser('sub') buyerId: string) {
    return this.orders.confirmReceipt(id, buyerId);
  }

  // ─── Admin escrow control ──────────────────────────────────────────────────

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/orders')
  adminFindAll() {
    return this.orders.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/withhold')
  adminWithhold(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: WithholdDto,
  ) {
    return this.orders.adminWithhold(id, adminId, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/release')
  adminRelease(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.orders.adminRelease(id, adminId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/refund')
  adminRefund(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.orders.adminRefund(id, adminId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/orders/:id/split')
  adminSplit(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: SplitDto,
  ) {
    return this.orders.adminSplit(id, adminId, dto.buyerPercent);
  }
}
