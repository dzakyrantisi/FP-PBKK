import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { EmailService } from '../email/email.service';

export interface SerializedOrderItem {
  id: number;
  quantity: number;
  unitPrice: number;
  product: {
    id: number;
    name: string;
    category: string;
    sellerId: number;
    sellerName: string;
  };
}

export interface SerializedOrder {
  id: number;
  status: OrderStatus;
  shippingAddress: string;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  items: SerializedOrderItem[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  private ensureCustomer(role: Role) {
    if (role !== Role.CUSTOMER) {
      throw new ForbiddenException('Customer role required');
    }
  }

  private ensureSeller(role: Role) {
    if (role !== Role.SELLER) {
      throw new ForbiddenException('Seller role required');
    }
  }

  private serializeOrder(
    order: Prisma.OrderGetPayload<{
      include: {
        customer: true;
        items: {
          include: {
            product: {
              include: {
                seller: true;
              };
            };
          };
        };
      };
    }>,
  ): SerializedOrder {
    return {
      id: order.id,
      status: order.status,
      shippingAddress: order.shippingAddress,
      totalAmount: Number(order.totalAmount),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        product: {
          id: item.product.id,
          name: item.product.name,
          category: item.product.category,
          sellerId: item.product.sellerId,
          sellerName: item.product.seller.fullName,
        },
      })),
    };
  }

  async create(customerId: number, role: Role, dto: CreateOrderDto) {
    this.ensureCustomer(role);

    const order = await this.prisma.$transaction(async (tx) => {
      const productQuantities = new Map<number, number>();
      dto.items.forEach((item) => {
        productQuantities.set(
          item.productId,
          (productQuantities.get(item.productId) ?? 0) + item.quantity,
        );
      });

      const productIds = Array.from(productQuantities.keys());
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, isActive: true },
        include: { seller: true },
      });

      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products were not found or inactive');
      }

      const productMap = new Map<number, (typeof products)[number]>(
        products.map((product) => [product.id, product]),
      );

      // Validate stock availability for aggregated quantities.
      for (const [productId, quantity] of productQuantities.entries()) {
        const product = productMap.get(productId);
        if (!product) {
          throw new NotFoundException(`Product ${productId} not found`);
        }
        if (product.stock < quantity) {
          throw new ForbiddenException(`Insufficient stock for ${product.name}`);
        }
      }

      let total = new Prisma.Decimal(0);
      const createItems: Prisma.OrderItemCreateWithoutOrderInput[] = dto.items.map((item) => {
        const product = productMap.get(item.productId)!;
        const unitPrice = product.price;
        total = total.add(unitPrice.mul(item.quantity));

        return {
          quantity: item.quantity,
          unitPrice,
          product: {
            connect: { id: product.id },
          },
        } satisfies Prisma.OrderItemCreateWithoutOrderInput;
      });

      const createdOrder = await tx.order.create({
        data: {
          customerId,
          shippingAddress: dto.shippingAddress,
          totalAmount: total,
          items: {
            create: createItems,
          },
        },
        include: {
          customer: true,
          items: {
            include: {
              product: {
                include: {
                  seller: true,
                },
              },
            },
          },
        },
      });

      await Promise.all(
        Array.from(productQuantities.entries()).map(([productId, quantity]) => {
          const product = productMap.get(productId)!;
          const remainingStock = product.stock - quantity;
          return tx.product.update({
            where: { id: productId },
            data: {
              stock: remainingStock,
              isActive: remainingStock > 0,
            },
          });
        }),
      );

      return createdOrder;
    });

    const summary = this.emailService.buildOrderSummary(order);
    await Promise.all([
      this.emailService.sendOrderConfirmation(summary),
      this.emailService.sendSellerNotification(summary),
    ]);

    return this.serializeOrder(order);
  }

  async listCustomerOrders(customerId: number, role: Role) {
    this.ensureCustomer(role);

    const orders = await this.prisma.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async listSellerOrders(sellerId: number, role: Role) {
    this.ensureSeller(role);

    const orders = await this.prisma.order.findMany({
      where: {
        items: {
          some: {
            product: { sellerId },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
    });

    return orders.map((order) => this.serializeOrder(order));
  }

  async updateStatus(orderId: number, sellerId: number, role: Role, dto: UpdateOrderStatusDto) {
    this.ensureSeller(role);

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const sellerOwnsItem = order.items.some((item) => item.product.sellerId === sellerId);
    if (!sellerOwnsItem) {
      throw new ForbiddenException('You are not allowed to update this order');
    }

    const updatedOrder = await this.prisma.order.update({
      where: { id: orderId },
      data: { status: dto.status },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              include: { seller: true },
            },
          },
        },
      },
    });

    return this.serializeOrder(updatedOrder);
  }
}
