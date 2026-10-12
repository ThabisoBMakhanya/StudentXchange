import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ListingsModule } from './listings/listings.module';
import { CategoriesModule } from './categories/categories.module';
import { OrdersModule } from './orders/orders.module';
import { DisputesModule } from './disputes/disputes.module';
import { PayoutsModule } from './payouts/payouts.module';
import { AdminModule } from './admin-portal/admin.module';
import { PaymentsModule } from './payments/payments.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ListingsModule,
    CategoriesModule,
    OrdersModule,
    DisputesModule,
    PayoutsModule,
    AdminModule,
    PaymentsModule,
  ],
})
export class AppModule {}
