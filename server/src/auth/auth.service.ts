import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { Role } from '@prisma/client';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) throw new ConflictException('An account with that email already exists.');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        fullName: dto.fullName,
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        university: dto.university,
        passwordHash,
        roles: dto.roles as Role[],
      },
    });

    const token = this.signToken(user.id, user.email, user.roles);
    return { user: this.sanitize(user), token };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) throw new UnauthorizedException('No account found with that email.');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials.');

    if (user.status === 'BANNED') throw new UnauthorizedException('This account has been banned.');
    if (user.status === 'SUSPENDED') throw new UnauthorizedException('This account is suspended.');

    const token = this.signToken(user.id, user.email, user.roles);
    return { user: this.sanitize(user), token };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found.');
    return this.sanitize(user);
  }

  async enableMarketplaceRole(userId: string, role: 'CUSTOMER' | 'SELLER') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found.');
    if (user.status === 'BANNED' || user.status === 'SUSPENDED') {
      throw new UnauthorizedException('This account cannot change marketplace roles.');
    }

    const roles = user.roles.includes(role) ? user.roles : [...user.roles, role];
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { roles },
    });
    return this.sanitize(updated);
  }

  private signToken(userId: string, email: string, roles: Role[]) {
    return this.jwt.sign({ sub: userId, email, roles });
  }

  private sanitize(user: any) {
    const { passwordHash, ...rest } = user;
    return rest;
  }
}
