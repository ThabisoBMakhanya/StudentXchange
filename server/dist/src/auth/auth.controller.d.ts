import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
declare class EnableMarketplaceRoleDto {
    role: 'CUSTOMER' | 'SELLER';
}
export declare class AuthController {
    private auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        user: any;
        token: string;
    }>;
    login(dto: LoginDto): Promise<{
        user: any;
        token: string;
    }>;
    me(userId: string): Promise<any>;
    enableMarketplaceRole(userId: string, dto: EnableMarketplaceRoleDto): Promise<any>;
}
export {};
