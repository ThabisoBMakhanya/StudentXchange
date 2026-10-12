import { Controller, Get, UseGuards, Param } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller()
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('seller/listings')
  sellerListings(@CurrentUser('sub') sellerId: string) {
    return this.users.getSellerListings(sellerId);
  }

  @Get('seller/listings/:id')
  async sellerListingDetail(@Param('id') id: string) {
    return this.users.getListing(id);
  }

  @Get('orders/buyer')
  ordersForBuyer(@CurrentUser('sub') buyerId: string) {
    return this.users.getOrdersForBuyer(buyerId);
  }

  @Get('orders/seller')
  ordersForSeller(@CurrentUser('sub') sellerId: string) {
    return this.users.getOrdersForSeller(sellerId);
  }
}
