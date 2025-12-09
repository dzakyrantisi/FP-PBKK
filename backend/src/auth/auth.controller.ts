import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { handlePrismaError } from '../common/prisma-error.handler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Role } from '@prisma/client';
import { ChangePasswordDto } from './dto/change-password.dto';

interface AuthenticatedRequest {
  user: {
    userId: number;
    email: string;
    role: Role;
    fullName: string;
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    try {
      return await this.authService.register(registerDto);
    } catch (error) {
      handlePrismaError(error, 'register user');
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    try {
      return await this.authService.login(loginDto);
    } catch (error) {
      handlePrismaError(error, 'login user');
    }
  }

  @Post('refresh')
  async refresh(@Body() refreshTokenDto: RefreshTokenDto) {
    try {
      return await this.authService.refreshToken(refreshTokenDto);
    } catch (error) {
      handlePrismaError(error, 'refresh token');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(@Request() req: AuthenticatedRequest) {
    try {
      return await this.authService.logout(req.user.userId);
    } catch (error) {
      handlePrismaError(error, 'logout user');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async profile(@Request() req: AuthenticatedRequest) {
    try {
      return await this.authService.getProfile(req.user.userId);
    } catch (error) {
      handlePrismaError(error, 'fetch user profile');
    }
  }

  @UseGuards(JwtAuthGuard)
  @Patch('password')
  async changePassword(
    @Request() req: AuthenticatedRequest,
    @Body() payload: ChangePasswordDto,
  ) {
    try {
      return await this.authService.changePassword(req.user.userId, payload);
    } catch (error) {
      handlePrismaError(error, 'change password');
    }
  }
}
