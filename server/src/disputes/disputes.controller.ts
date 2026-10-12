import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { DisputesService } from './disputes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Role, DisputeStatus } from '@prisma/client';
import { IsString, IsEnum, MinLength } from 'class-validator';

class RaiseDisputeDto {
  @IsString()
  reason: string;

  @IsString()
  details: string;
}

class ResolveDisputeDto {
  @IsEnum(DisputeStatus)
  status: DisputeStatus;

  @IsString()
  @MinLength(3)
  note: string;
}

@UseGuards(JwtAuthGuard)
@Controller()
export class DisputesController {
  constructor(private disputes: DisputesService) {}

  @Post('orders/:orderId/dispute')
  raise(
    @Param('orderId') orderId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.disputes.raise(orderId, userId, dto.reason, dto.details);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get('admin/disputes')
  findAll() {
    return this.disputes.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post('admin/disputes/:id/resolve')
  resolve(
    @Param('id') id: string,
    @CurrentUser('sub') adminId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.disputes.resolve(id, adminId, dto.status, dto.note);
  }
}
