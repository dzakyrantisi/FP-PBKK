import { Role } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsInt } from 'class-validator';

export class JwtPayloadDto {
  @Type(() => Number)
  @IsInt()
  sub: number;

  @IsEmail()
  email: string;

  @IsEnum(Role)
  role: Role;
}
