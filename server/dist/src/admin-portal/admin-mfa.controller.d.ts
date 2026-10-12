import { AdminMfaService } from './admin-mfa.service';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
declare class RequestMfaDto {
    email: string;
}
declare class VerifyMfaDto {
    email: string;
    code: string;
}
export declare class AdminMfaController {
    private mfa;
    private jwt;
    private prisma;
    constructor(mfa: AdminMfaService, jwt: JwtService, prisma: PrismaService);
    request(dto: RequestMfaDto): Promise<{
        message: string;
        demoCode: string;
    }>;
    verify(dto: VerifyMfaDto): Promise<{
        token: string;
        user: {
            id: string;
            fullName: string;
            email: string;
            roles: import(".prisma/client").$Enums.Role[];
        };
    }>;
}
export {};
