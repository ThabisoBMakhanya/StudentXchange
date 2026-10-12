"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMfaController = void 0;
const common_1 = require("@nestjs/common");
const admin_mfa_service_1 = require("./admin-mfa.service");
const class_validator_1 = require("class-validator");
const jwt_1 = require("@nestjs/jwt");
const prisma_service_1 = require("../prisma/prisma.service");
class RequestMfaDto {
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], RequestMfaDto.prototype, "email", void 0);
class VerifyMfaDto {
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], VerifyMfaDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6),
    __metadata("design:type", String)
], VerifyMfaDto.prototype, "code", void 0);
let AdminMfaController = class AdminMfaController {
    constructor(mfa, jwt, prisma) {
        this.mfa = mfa;
        this.jwt = jwt;
        this.prisma = prisma;
    }
    async request(dto) {
        const admin = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (!admin || !admin.roles.includes('ADMIN')) {
            throw new common_1.UnauthorizedException('Unknown admin account.');
        }
        const code = await this.mfa.generateOtp(dto.email.toLowerCase());
        return { message: 'OTP sent.', demoCode: code };
    }
    async verify(dto) {
        const valid = await this.mfa.verifyOtp(dto.email.toLowerCase(), dto.code);
        if (!valid)
            throw new common_1.UnauthorizedException('Invalid or expired code.');
        const admin = await this.prisma.user.findUnique({
            where: { email: dto.email.toLowerCase() },
        });
        if (!admin)
            throw new common_1.UnauthorizedException('Admin not found.');
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
};
exports.AdminMfaController = AdminMfaController;
__decorate([
    (0, common_1.Post)('request'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RequestMfaDto]),
    __metadata("design:returntype", Promise)
], AdminMfaController.prototype, "request", null);
__decorate([
    (0, common_1.Post)('verify'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [VerifyMfaDto]),
    __metadata("design:returntype", Promise)
], AdminMfaController.prototype, "verify", null);
exports.AdminMfaController = AdminMfaController = __decorate([
    (0, common_1.Controller)('admin/mfa'),
    __metadata("design:paramtypes", [admin_mfa_service_1.AdminMfaService,
        jwt_1.JwtService,
        prisma_service_1.PrismaService])
], AdminMfaController);
//# sourceMappingURL=admin-mfa.controller.js.map