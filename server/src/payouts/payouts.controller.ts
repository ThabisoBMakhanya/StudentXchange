import {
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@UseGuards(JwtAuthGuard)
@Controller()
export class PayoutsController {
  constructor(private payouts: PayoutsService) {}

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/payouts')
  findAll() {
    return this.payouts.findAll();
  }

  @Get('seller/payouts')
  findForSeller(@CurrentUser('sub') sellerId: string) {
    return this.payouts.findForSeller(sellerId);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/payouts/:id/paid')
  markPaid(@Param('id') id: string, @CurrentUser('sub') adminId: string) {
    return this.payouts.markPaid(id, adminId);
  }
}
