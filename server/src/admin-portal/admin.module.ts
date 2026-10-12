import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AdminMfaService } from './admin-mfa.service';
import { AdminMfaController } from './admin-mfa.controller';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, AuthModule],
  providers: [AdminService, AdminMfaService],
  controllers: [AdminController, AdminMfaController],
})
export class AdminModule {}
