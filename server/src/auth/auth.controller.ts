import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { Role } from '@prisma/client';

class EnableMarketplaceRoleDto {
  @IsIn([Role.CUSTOMER, Role.SELLER])
  role: 'CUSTOMER' | 'SELLER';
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser('sub') userId: string) {
    return this.auth.me(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('roles')
  enableMarketplaceRole(
    @CurrentUser('sub') userId: string,
    @Body() dto: EnableMarketplaceRoleDto,
  ) {
    return this.auth.enableMarketplaceRole(userId, dto.role);
  }
}
