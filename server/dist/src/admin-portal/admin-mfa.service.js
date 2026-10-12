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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminMfaService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ioredis_1 = __importDefault(require("ioredis"));
const redis_module_1 = require("../redis/redis.module");
let AdminMfaService = class AdminMfaService {
    constructor(redis, config) {
        this.redis = redis;
        this.config = config;
    }
    async generateOtp(adminEmail) {
        const code = String(Math.floor(100000 + Math.random() * 900000));
        const key = `admin:mfa:${adminEmail}`;
        await this.redis.set(key, code, 'EX', 300);
        return code;
    }
    async verifyOtp(adminEmail, code) {
        const key = `admin:mfa:${adminEmail}`;
        const stored = await this.redis.get(key);
        if (!stored || stored !== code)
            return false;
        await this.redis.del(key);
        return true;
    }
};
exports.AdminMfaService = AdminMfaService;
exports.AdminMfaService = AdminMfaService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default,
        config_1.ConfigService])
], AdminMfaService);
//# sourceMappingURL=admin-mfa.service.js.map