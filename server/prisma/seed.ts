import { PrismaClient, Role, KycStatus, ListingType, EscrowStatus, PaymentMethod, ItemCondition, DisputeStatus, PayoutStatus, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // ─── Demo users ─────────────────────────────────────────────────────────────
  const password = await bcrypt.hash('password123', 10);

  const naledi = await prisma.user.upsert({
    where: { email: 'naledi@student.sz' },
    update: {},
    create: {
      fullName: 'Naledi Dlamini',
      email: 'naledi@student.sz',
      phone: '+268 7600 1234',
      university: 'University of Eswatini',
      passwordHash: password,
      roles: [Role.CUSTOMER, Role.SELLER],
      kycStatus: KycStatus.APPROVED,
      status: UserStatus.ACTIVE,
    },
  });

  const thandi = await prisma.user.upsert({
    where: { email: 'thandi@student.sz' },
    update: {},
    create: {
      fullName: 'Thandi Nkosi',
      email: 'thandi@student.sz',
      phone: '+268 7600 9012',
      university: 'Limkokwing University',
      passwordHash: password,
      roles: [Role.CUSTOMER],
      kycStatus: KycStatus.NOT_SUBMITTED,
      status: UserStatus.ACTIVE,
    },
  });

  const sipho = await prisma.user.upsert({
    where: { email: 'sipho@student.sz' },
    update: {},
    create: {
      fullName: 'Sipho Mavuso',
      email: 'sipho@student.sz',
      phone: '+268 7600 5678',
      university: 'University of Eswatini',
      passwordHash: password,
      roles: [Role.CUSTOMER, Role.SELLER],
      kycStatus: KycStatus.PENDING,
      status: UserStatus.ACTIVE,
    },
  });

  const bongani = await prisma.user.upsert({
    where: { email: 'bongani@student.sz' },
    update: {},
    create: {
      fullName: 'Bongani Shongwe',
      email: 'bongani@student.sz',
      phone: '+268 7600 3456',
      university: 'University of Eswatini',
      passwordHash: password,
      roles: [Role.CUSTOMER, Role.SELLER],
      kycStatus: KycStatus.APPROVED,
      status: UserStatus.ACTIVE,
    },
  });

  const zanele = await prisma.user.upsert({
    where: { email: 'zanele@student.sz' },
    update: {},
    create: {
      fullName: 'Zanele Magagula',
      email: 'zanele@student.sz',
      phone: '+268 7600 7890',
      university: 'Eswatini Medical Christian University',
      passwordHash: password,
      roles: [Role.SELLER],
      kycStatus: KycStatus.REJECTED,
      status: UserStatus.ACTIVE,
    },
  });

  // ─── Categories ─────────────────────────────────────────────────────────────

  const physicalCats: any[] = [
    { name: 'Electronics', slug: 'electronics', icon: 'chip', type: ListingType.PHYSICAL, sortOrder: 1, description: 'Laptops, phones, chargers, headphones, calculators' },
    { name: 'Furniture & Dorm', slug: 'furniture-dorm', icon: 'sofa', type: ListingType.PHYSICAL, sortOrder: 2, description: 'Desks, chairs, lamps, bedding, storage' },
    { name: 'Clothing & Fashion', slug: 'clothing-fashion', icon: 'shirt', type: ListingType.PHYSICAL, sortOrder: 3, description: 'Shoes, bags, jackets, accessories' },
    { name: 'Food & Snacks', slug: 'food-snacks', icon: 'food', type: ListingType.PHYSICAL, sortOrder: 4, description: 'Homemade meals, packaged snacks, drinks' },
    { name: 'Beauty & Personal Care', slug: 'beauty-care', icon: 'sparkles', type: ListingType.PHYSICAL, sortOrder: 5, description: 'Skincare, haircare, cosmetics' },
    { name: 'Sports & Fitness', slug: 'sports-fitness', icon: 'dumbbell', type: ListingType.PHYSICAL, sortOrder: 6, description: 'Gym gear, bikes, balls, sportswear' },
    { name: 'Stationery & Art', slug: 'stationery-art', icon: 'pencil', type: ListingType.PHYSICAL, sortOrder: 7, description: 'Pens, notebooks, drawing tools' },
    { name: 'Miscellaneous', slug: 'misc-physical', icon: 'grid', type: ListingType.PHYSICAL, sortOrder: 8, description: 'Everything else' },
  ];

  const serviceCats: any[] = [
    { name: 'Tutoring', slug: 'tutoring', icon: 'book', type: ListingType.SERVICE, sortOrder: 1, description: 'Math, science, languages, exam prep' },
    { name: 'Printing & Design', slug: 'printing-design', icon: 'printer', type: ListingType.SERVICE, sortOrder: 2, description: 'Documents, posters, business cards' },
    { name: 'Laundry & Cleaning', slug: 'laundry-cleaning', icon: 'washer', type: ListingType.SERVICE, sortOrder: 3, description: 'Clothes washing, room cleaning' },
    { name: 'Moving & Delivery', slug: 'moving-delivery', icon: 'truck', type: ListingType.SERVICE, sortOrder: 4, description: 'Help moving, campus deliveries' },
    { name: 'Tech Repair', slug: 'tech-repair', icon: 'wrench', type: ListingType.SERVICE, sortOrder: 5, description: 'Phone repair, laptop repair, software install' },
    { name: 'Beauty Services', slug: 'beauty-services', icon: 'scissors', type: ListingType.SERVICE, sortOrder: 6, description: 'Hair, makeup, nails' },
    { name: 'Event Services', slug: 'event-services', icon: 'camera', type: ListingType.SERVICE, sortOrder: 7, description: 'Photography, DJ, event planning' },
    { name: 'Hostel & Room Services', slug: 'hostel-room', icon: 'bed', type: ListingType.SERVICE, sortOrder: 8, description: 'Room setup, furniture assembly' },
    { name: 'Miscellaneous Services', slug: 'misc-services', icon: 'grid', type: ListingType.SERVICE, sortOrder: 9, description: 'Other services' },
  ];

  for (const cat of [...physicalCats, ...serviceCats]) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log('Categories seeded.');

  // ─── Sub-categories (leaf nodes) ────────────────────────────────────────────

  const electronics = await prisma.category.findUnique({ where: { slug: 'electronics' } });
  if (electronics) {
    const subs = [
      { name: 'Laptops', slug: 'laptops', icon: 'laptop', parentId: electronics.id },
      { name: 'Phones', slug: 'phones', icon: 'phone', parentId: electronics.id },
      { name: 'Audio', slug: 'audio', icon: 'headphones', parentId: electronics.id },
      { name: 'Calculators', slug: 'calculators', icon: 'calculator', parentId: electronics.id },
    ];
    for (const sub of subs) {
      await prisma.category.upsert({ where: { slug: sub.slug }, update: {}, create: { ...sub, type: ListingType.PHYSICAL } });
    }
  }

  const tutoring = await prisma.category.findUnique({ where: { slug: 'tutoring' } });
  if (tutoring) {
    const subs = [
      { name: 'Math', slug: 'math-tutoring', icon: 'calculator', parentId: tutoring.id },
      { name: 'Science', slug: 'science-tutoring', icon: 'flask', parentId: tutoring.id },
      { name: 'Languages', slug: 'language-tutoring', icon: 'chat', parentId: tutoring.id },
      { name: 'Exam Prep', slug: 'exam-prep', icon: 'clipboard', parentId: tutoring.id },
    ];
    for (const sub of subs) {
      await prisma.category.upsert({ where: { slug: sub.slug }, update: {}, create: { ...sub, type: ListingType.SERVICE } });
    }
  }
  console.log('Sub-categories seeded.');

  // ─── Listings ───────────────────────────────────────────────────────────────

  const laptops = await prisma.category.findUnique({ where: { slug: 'laptops' } });
  const phones = await prisma.category.findUnique({ where: { slug: 'phones' } });
  const desks = await prisma.category.findUnique({ where: { slug: 'furniture-dorm' } });
  const calculators = await prisma.category.findUnique({ where: { slug: 'calculators' } });
  const food = await prisma.category.findUnique({ where: { slug: 'food-snacks' } });
  const mathTutoring = await prisma.category.findUnique({ where: { slug: 'math-tutoring' } });
  const techRepair = await prisma.category.findUnique({ where: { slug: 'tech-repair' } });
  const printing = await prisma.category.findUnique({ where: { slug: 'printing-design' } });
  const eventServices = await prisma.category.findUnique({ where: { slug: 'event-services' } });

  const listings = [
    { sellerId: naledi.id, type: ListingType.PHYSICAL, categoryId: laptops!.id, title: 'MacBook Air M1 2020 — 8GB/256GB', description: 'Excellent condition, battery cycle count 120.', price: 8500, stock: 1, condition: ItemCondition.LIKE_NEW, location: 'UNISWA Kwaluseni Campus' },
    { sellerId: naledi.id, type: ListingType.PHYSICAL, categoryId: phones!.id, title: 'iPhone 13 — 128GB Midnight', description: 'Unlocked, battery health 89%.', price: 5200, stock: 1, condition: ItemCondition.GOOD, location: 'UNISWA Kwaluseni Campus' },
    { sellerId: bongani.id, type: ListingType.PHYSICAL, categoryId: desks!.id, title: 'Adjustable Standing Desk', description: 'Electric height-adjustable desk.', price: 1800, stock: 1, condition: ItemCondition.LIKE_NEW, location: 'UNISWA Mbabane Campus' },
    { sellerId: bongani.id, type: ListingType.PHYSICAL, categoryId: calculators!.id, title: 'Casio fx-991ES PLUS Calculator', description: 'Scientific calculator.', price: 350, stock: 3, condition: ItemCondition.GOOD, location: 'UNISWA Mbabane Campus' },
    { sellerId: sipho.id, type: ListingType.PHYSICAL, categoryId: food!.id, title: 'Homemade Samp & Beans (Weekly)', description: 'Traditional samp and beans.', price: 120, stock: 20, condition: ItemCondition.NEW, location: 'UNISWA Kwaluseni Campus' },
    { sellerId: naledi.id, type: ListingType.SERVICE, categoryId: mathTutoring!.id, title: 'Calculus I & II Tutoring — 1-on-1', description: 'Final-year math major.', price: 150, durationMinutes: 60, availabilitySlots: ['Mon 14:00', 'Wed 16:00', 'Sat 10:00'], location: 'UNISWA Kwaluseni Campus' },
    { sellerId: bongani.id, type: ListingType.SERVICE, categoryId: techRepair!.id, title: 'Phone Screen Replacement', description: 'Same day screen replacement.', price: 400, durationMinutes: 90, availabilitySlots: ['Tue 09:00', 'Thu 09:00'], location: 'UNISWA Mbabane Campus' },
    { sellerId: sipho.id, type: ListingType.SERVICE, categoryId: printing!.id, title: 'Thesis Printing & Binding', description: 'Spiral binding for dissertations.', price: 80, durationMinutes: 1440, availabilitySlots: ['Mon-Fri 08:00'], location: 'UNISWA Kwaluseni Campus' },
    { sellerId: bongani.id, type: ListingType.SERVICE, categoryId: eventServices!.id, title: 'Event Photography (2 Hours)', description: 'Professional event coverage.', price: 700, durationMinutes: 120, availabilitySlots: ['Sat 10:00', 'Sun 14:00'], location: 'All campuses' },
  ];

  for (const listing of listings) {
    const existing = await prisma.listing.findFirst({
      where: { sellerId: listing.sellerId, title: listing.title },
      select: { id: true },
    });
    if (!existing) await prisma.listing.create({ data: listing as any });
  }
  console.log('Listings seeded.');

  // ─── Orders ─────────────────────────────────────────────────────────────────

  const listing1 = await prisma.listing.findFirst({ where: { title: { contains: 'MacBook' } } });
  const listing4 = await prisma.listing.findFirst({ where: { title: { contains: 'Casio' } } });
  const listing6 = await prisma.listing.findFirst({ where: { title: { contains: 'Calculus' } } });
  const listing7 = await prisma.listing.findFirst({ where: { title: { contains: 'Screen Replacement' } } });

  if (listing1 && listing4 && listing6 && listing7) {
    await prisma.order.upsert({
      where: { id: 'demo-order-macbook' },
      update: {},
      create: {
        id: 'demo-order-macbook',
        listingId: listing1.id, buyerId: thandi.id, sellerId: naledi.id,
        quantity: 1, unitPrice: 8500, total: 8500, commission: 850,
        paymentMethod: PaymentMethod.MTN_MOMO, escrowStatus: EscrowStatus.HELD,
        trackingCode: 'STX-8842', shippedAt: new Date('2025-09-16'),
      },
    });
    await prisma.order.upsert({
      where: { id: 'demo-order-calculus' },
      update: {},
      create: {
        id: 'demo-order-calculus',
        listingId: listing6.id, buyerId: thandi.id, sellerId: naledi.id,
        quantity: 1, unitPrice: 150, total: 150, commission: 15,
        paymentMethod: PaymentMethod.DPO_PAY, escrowStatus: EscrowStatus.WITHHELD_BY_ADMIN,
        withheldAt: new Date('2025-09-18'), withheldReason: 'Buyer claims session never happened.',
      },
    });
    await prisma.order.upsert({
      where: { id: 'demo-order-calculator' },
      update: {},
      create: {
        id: 'demo-order-calculator',
        listingId: listing4.id, buyerId: thandi.id, sellerId: bongani.id,
        quantity: 1, unitPrice: 350, total: 350, commission: 35,
        paymentMethod: PaymentMethod.MTN_MOMO, escrowStatus: EscrowStatus.RELEASED,
        confirmedAt: new Date('2025-09-10'), deliveredAt: new Date('2025-09-10'),
      },
    });
    await prisma.order.upsert({
      where: { id: 'demo-order-repair' },
      update: {},
      create: {
        id: 'demo-order-repair',
        listingId: listing7.id, buyerId: thandi.id, sellerId: bongani.id,
        quantity: 1, unitPrice: 400, total: 400, commission: 40,
        paymentMethod: PaymentMethod.DPO_PAY, escrowStatus: EscrowStatus.RELEASED,
        confirmedAt: new Date('2025-09-05'), deliveredAt: new Date('2025-09-05'),
      },
    });
  }
  console.log('Orders seeded.');

  // ─── Payouts ────────────────────────────────────────────────────────────────

  const releasedOrders = await prisma.order.findMany({ where: { escrowStatus: EscrowStatus.RELEASED } });
  for (const order of releasedOrders) {
    await prisma.payout.upsert({
      where: { orderId: order.id },
      update: {},
      create: { sellerId: order.sellerId, orderId: order.id, amount: Number(order.total) - Number(order.commission), status: PayoutStatus.PAID },
    });
  }
  console.log('Payouts seeded.');

  // ─── Platform settings ──────────────────────────────────────────────────────

  await prisma.platformSetting.upsert({
    where: { key: 'commission_rate' },
    update: { value: '10' },
    create: { key: 'commission_rate', value: '10' },
  });
  console.log('Settings seeded.');

  console.log('\n✅ Seed complete!');
  console.log('\nDemo accounts:');
  console.log('  User:   naledi@student.sz / password123');
  console.log('  User:   thandi@student.sz / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
