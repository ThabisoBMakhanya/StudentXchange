import { IsArray, IsEmail, IsIn, IsString, MinLength, ArrayNotEmpty } from 'class-validator';
import { Role } from '@prisma/client';

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RegisterDto {
  @IsString()
  @MinLength(2)
  fullName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(7)
  phone: string;

  @IsString()
  university: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsIn([Role.CUSTOMER, Role.SELLER], { each: true })
  roles: Role[];
}
