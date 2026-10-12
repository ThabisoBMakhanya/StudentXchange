import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AdminMfaService } from './admin-mfa.service';
import { IsEmail, IsString, Length } from 'class-validator';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
import { Role } from '@prisma/client';

class RequestMfaDto {
  @IsEmail()
  email: string;
}

class VerifyMfaDto {
  @IsEmail()
  email: string;

  @IsString()
  @Length(6, 6)
  code: string;
}

@Controller('admin/mfa')
export class AdminMfaController {
  constructor(
    private mfa: AdminMfaService,
    private jwt: JwtService,
    private prisma: PrismaService,
  ) {}

  @Post('request')
  async request(@Body() dto: RequestMfaDto) {
    const admin = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!admin || !admin.roles.includes('ADMIN')) {
      throw new UnauthorizedException('Unknown admin account.');
    }

    const code = await this.mfa.generateOtp(dto.email.toLowerCase());
    // In production: send via SMS/email. Returned here for demo purposes.
    return { message: 'OTP sent.', demoCode: code };
  }

  @Post('verify')
  async verify(@Body() dto: VerifyMfaDto) {
    const valid = await this.mfa.verifyOtp(dto.email.toLowerCase(), dto.code);
    if (!valid) throw new UnauthorizedException('Invalid or expired code.');

    const admin = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!admin) throw new UnauthorizedException('Admin not found.');

    const token = this.jwt.sign({
      sub: admin.id,
      email: admin.email,
      roles: admin.roles,
      isAdmin: true,
    });

    return {
      token,
      user: { id: admin.id, fullName: admin.fullName, email: admin.email, roles: admin.roles },
    };
  }
}
