import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, UserStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

class SetUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}

class ReviewKycDto {
  @IsEnum(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';

  @IsOptional()
  @IsString()
  note?: string;
}

class CreateCategoryDto {
  @IsEnum(['PHYSICAL', 'SERVICE'])
  type: 'PHYSICAL' | 'SERVICE';

  @IsString()
  name: string;

  @IsString()
  slug: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  parentId?: string;
}

class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsEnum([true, false])
  active?: boolean;
}

class UpdateCommissionDto {
  @IsNumber()
  @Min(0)
  rate: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private admin: AdminService) {}

  // ─── Dashboard ─────────────────────────────────────────────────────────────

  @Get('kpis')
  getKpis() {
    return this.admin.getKpis();
  }

  // ─── Users ─────────────────────────────────────────────────────────────────

  @Get('users')
  getUsers(@Query('search') search?: string) {
    return this.admin.getUsers(search);
  }

  @Post('users/:id/status')
  setUserStatus(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: SetUserStatusDto,
  ) {
    return this.admin.setUserStatus(id, adminId, dto.status);
  }

  // ─── KYC ───────────────────────────────────────────────────────────────────

  @Get('kyc')
  getKycSubmissions() {
    return this.admin.getKycSubmissions();
  }

  @Post('kyc/:id/review')
  reviewKyc(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ReviewKycDto,
  ) {
    return this.admin.reviewKyc(id, adminId, dto.status, dto.note);
  }

  // ─── Categories ────────────────────────────────────────────────────────────

  @Get('categories')
  getCategories(@Query('type') type?: 'PHYSICAL' | 'SERVICE') {
    return this.admin.getCategories(type);
  }

  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.admin.createCategory(dto);
  }

  @Post('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.admin.updateCategory(id, dto);
  }

  @Post('categories/:id/delete')
  deleteCategory(@Param('id') id: string) {
    return this.admin.deleteCategory(id);
  }

  // ─── Audit log ─────────────────────────────────────────────────────────────

  @Get('audit')
  getAuditLog() {
    return this.admin.getAuditLog();
  }

  // ─── Settings ──────────────────────────────────────────────────────────────

  @Post('settings/commission')
  updateCommission(@CurrentUser('sub') adminId: string, @Body() dto: UpdateCommissionDto) {
    return this.admin.updateCommission(adminId, dto.rate);
  }
}
