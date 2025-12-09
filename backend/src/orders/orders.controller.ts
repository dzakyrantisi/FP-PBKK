import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    role: Role;
  };
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Roles(Role.CUSTOMER)
  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, req.user.role, dto);
  }

  @Roles(Role.CUSTOMER)
  @Get('me')
  async listCustomerOrders(@Req() req: AuthenticatedRequest) {
    return this.ordersService.listCustomerOrders(req.user.userId, req.user.role);
  }

  @Roles(Role.SELLER)
  @Get('seller')
  async listSellerOrders(@Req() req: AuthenticatedRequest) {
    return this.ordersService.listSellerOrders(req.user.userId, req.user.role);
  }

  @Roles(Role.SELLER)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, req.user.userId, req.user.role, dto);
  }
}
