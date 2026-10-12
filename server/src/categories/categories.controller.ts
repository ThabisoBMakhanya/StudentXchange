import { Controller, Get, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { ListingType } from '@prisma/client';

@Controller('categories')
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Get()
  findAll(@Query('type') type?: ListingType) {
    return this.categories.findAll(type);
  }
}
