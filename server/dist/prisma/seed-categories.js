"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const categoryGroups = [
    {
        type: client_1.ListingType.PHYSICAL,
        roots: [
            ['Electronics', 'electronics', 'chip'],
            ['Furniture & Dorm', 'furniture-dorm', 'sofa'],
            ['Clothing & Fashion', 'clothing-fashion', 'shirt'],
            ['Food & Snacks', 'food-snacks', 'food'],
            ['Beauty & Personal Care', 'beauty-care', 'sparkles'],
            ['Sports & Fitness', 'sports-fitness', 'dumbbell'],
            ['Stationery & Art', 'stationery-art', 'pencil'],
            ['Miscellaneous', 'misc-physical', 'grid'],
        ],
        children: [
            ['Laptops', 'laptops', 'laptop', 'electronics'],
            ['Phones', 'phones', 'phone', 'electronics'],
            ['Audio', 'audio', 'headphones', 'electronics'],
            ['Calculators', 'calculators', 'calculator', 'electronics'],
            ['Desks & Chairs', 'desks-chairs', 'desk', 'furniture-dorm'],
            ['Bedding', 'bedding', 'bed', 'furniture-dorm'],
            ['Storage', 'storage', 'box', 'furniture-dorm'],
            ['Shoes', 'shoes', 'shoe', 'clothing-fashion'],
            ['Bags', 'bags', 'bag', 'clothing-fashion'],
            ['Jackets', 'jackets', 'jacket', 'clothing-fashion'],
            ['Meals', 'meals', 'meal', 'food-snacks'],
            ['Snacks', 'snacks', 'snack', 'food-snacks'],
            ['Beauty products', 'beauty-products', 'sparkles', 'beauty-care'],
            ['Sports equipment', 'sports-equipment', 'dumbbell', 'sports-fitness'],
            ['Stationery', 'stationery', 'pencil', 'stationery-art'],
            ['Other physical items', 'other-physical-items', 'grid', 'misc-physical'],
        ],
    },
    {
        type: client_1.ListingType.SERVICE,
        roots: [
            ['Tutoring', 'tutoring', 'book'],
            ['Printing & Design', 'printing-design', 'printer'],
            ['Laundry & Cleaning', 'laundry-cleaning', 'washer'],
            ['Moving & Delivery', 'moving-delivery', 'truck'],
            ['Tech Repair', 'tech-repair', 'wrench'],
            ['Beauty Services', 'beauty-services', 'scissors'],
            ['Event Services', 'event-services', 'camera'],
            ['Hostel & Room Services', 'hostel-room', 'bed'],
            ['Miscellaneous Services', 'misc-services', 'grid'],
        ],
        children: [
            ['Math tutoring', 'math-tutoring', 'calculator', 'tutoring'],
            ['Science tutoring', 'science-tutoring', 'flask', 'tutoring'],
            ['Language tutoring', 'language-tutoring', 'chat', 'tutoring'],
            ['Exam preparation', 'exam-prep', 'clipboard', 'tutoring'],
            ['Document printing', 'document-printing', 'printer', 'printing-design'],
            ['Graphic design', 'graphic-design', 'pencil', 'printing-design'],
            ['Laundry', 'laundry', 'washer', 'laundry-cleaning'],
            ['Room cleaning', 'room-cleaning', 'sparkles', 'laundry-cleaning'],
            ['Campus delivery', 'campus-delivery', 'truck', 'moving-delivery'],
            ['Phone repair', 'phone-repair', 'phone', 'tech-repair'],
            ['Laptop repair', 'laptop-repair', 'laptop', 'tech-repair'],
            ['Hair services', 'hair-services', 'scissors', 'beauty-services'],
            ['Photography', 'photography', 'camera', 'event-services'],
            ['Room setup', 'room-setup', 'bed', 'hostel-room'],
            ['Other services', 'other-services', 'grid', 'misc-services'],
        ],
    },
];
async function main() {
    for (const group of categoryGroups) {
        const roots = new Map();
        for (const [index, [name, slug, icon]] of group.roots.entries()) {
            const root = await prisma.category.upsert({
                where: { slug },
                update: { type: group.type, name, icon, active: true },
                create: { type: group.type, name, slug, icon, sortOrder: index + 1 },
            });
            roots.set(slug, root.id);
        }
        for (const [index, [name, slug, icon, parentSlug]] of group.children.entries()) {
            const parentId = roots.get(parentSlug);
            if (!parentId)
                throw new Error(`Missing parent category: ${parentSlug}`);
            await prisma.category.upsert({
                where: { slug },
                update: { type: group.type, name, icon, parentId, active: true },
                create: { type: group.type, name, slug, icon, parentId, active: true, sortOrder: index + 1 },
            });
        }
    }
    console.log('Physical and service categories are ready.');
}
main()
    .catch((error) => {
    console.error(error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=seed-categories.js.map