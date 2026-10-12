import { Role } from '@prisma/client';
export declare class LoginDto {
    email: string;
    password: string;
}
export declare class RegisterDto {
    fullName: string;
    email: string;
    phone: string;
    university: string;
    password: string;
    roles: Role[];
}
