import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
export declare class AdminMfaService {
    private redis;
    private config;
    constructor(redis: Redis, config: ConfigService);
    generateOtp(adminEmail: string): Promise<string>;
    verifyOtp(adminEmail: string, code: string): Promise<boolean>;
}
