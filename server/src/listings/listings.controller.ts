import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ListingsService } from './listings.service';
import { CreateListingDto } from './dto/create-listing.dto';
import { ListingsQueryDto } from './dto/listings-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role } from '@prisma/client';

@Controller()
export class ListingsController {
  constructor(private listings: ListingsService) {}

  @Get('listings')
  findAll(@Query() query: ListingsQueryDto) {
    return this.listings.findAll(query);
  }

  @Get('listings/:id')
  findOne(@Param('id') id: string) {
    return this.listings.findOne(id);
  }

  @Get('categories')
  getCategories(@Query('type') type?: 'PHYSICAL' | 'SERVICE') {
    return this.listings.getCategories(type);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Get('seller/listings')
  getSellerListings(@CurrentUser('sub') sellerId: string) {
    return this.listings.findForSeller(sellerId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Post('listings')
  create(@CurrentUser('sub') sellerId: string, @Body() dto: CreateListingDto) {
    return this.listings.create(sellerId, dto);
  }
}
