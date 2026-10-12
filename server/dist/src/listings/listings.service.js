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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListingsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ListingsService = class ListingsService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findAll(query) {
        const where = { status: 'ACTIVE' };
        if (query.type)
            where.type = query.type.toUpperCase();
        if (query.search) {
            where.OR = [
                { title: { contains: query.search, mode: 'insensitive' } },
                { description: { contains: query.search, mode: 'insensitive' } },
            ];
        }
        if (query.categoryId) {
            const category = await this.prisma.category.findUnique({
                where: { id: query.categoryId },
            });
            if (category) {
                const children = await this.prisma.category.findMany({
                    where: { parentId: query.categoryId },
                    select: { id: true },
                });
                where.categoryId = {
                    in: [query.categoryId, ...children.map((c) => c.id)],
                };
            }
        }
        return this.prisma.listing.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
    }
    async findOne(id) {
        const listing = await this.prisma.listing.findUnique({ where: { id } });
        if (!listing)
            throw new common_1.NotFoundException('Listing not found.');
        return listing;
    }
    async create(sellerId, dto) {
        return this.prisma.listing.create({
            data: {
                sellerId,
                type: dto.type.toUpperCase(),
                categoryId: dto.categoryId,
                title: dto.title,
                description: dto.description,
                price: dto.price,
                currency: 'SZL',
                images: dto.images ?? [],
                stock: dto.type === 'PHYSICAL' ? dto.stock ?? 1 : null,
                condition: dto.type === 'PHYSICAL' ? dto.condition : null,
                durationMinutes: dto.type === 'SERVICE' ? dto.durationMinutes : null,
                availabilitySlots: dto.type === 'SERVICE' ? dto.availabilitySlots ?? [] : [],
                location: dto.location,
            },
        });
    }
};
exports.ListingsService = ListingsService;
exports.ListingsService = ListingsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ListingsService);
//# sourceMappingURL=listings.service.js.map