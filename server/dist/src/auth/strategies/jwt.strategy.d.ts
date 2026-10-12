import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    private prisma;
    constructor(config: ConfigService, prisma: PrismaService);
    validate(payload: {
        sub: string;
        email: string;
        roles: string[];
    }): Promise<{
        sub: string;
        email: string;
        fullName: string;
        phone: string;
        university: string;
        roles: import(".prisma/client").$Enums.Role[];
        id: string;
        passwordHash: string;
        kycStatus: import(".prisma/client").$Enums.KycStatus;
        status: import(".prisma/client").$Enums.UserStatus;
        createdAt: Date;
        updatedAt: Date;
    }>;
}
export {};
