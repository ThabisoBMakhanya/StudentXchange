import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class AdminMfaService {
  constructor(
    @Inject(REDIS_CLIENT) private redis: Redis,
    private config: ConfigService,
  ) {}

  /**
   * Generate a 6-digit OTP for admin MFA.
   * Stored in Redis with 5-minute TTL.
   * In production: send via SMS (MTN) or email.
   */
  async generateOtp(adminEmail: string): Promise<string> {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const key = `admin:mfa:${adminEmail}`;
    await this.redis.set(key, code, 'EX', 300); // 5 minutes
    return code;
  }

  /**
   * Verify the OTP against Redis.
   */
  async verifyOtp(adminEmail: string, code: string): Promise<boolean> {
    const key = `admin:mfa:${adminEmail}`;
    const stored = await this.redis.get(key);
    if (!stored || stored !== code) return false;
    await this.redis.del(key);
    return true;
  }
}
