import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OrderStatus, Prisma } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';

interface OrderItemSummary {
  name: string;
  quantity: number;
  unitPrice: number;
}

interface OrderSummary {
  id: number;
  status: OrderStatus;
  totalAmount: number;
  shippingAddress: string;
  customer: {
    email: string;
    fullName: string;
  };
  items: Array<{
    product: {
      seller: {
        email: string;
        fullName: string;
      };
    };
    summary: OrderItemSummary;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('EMAIL_HOST');
    const port = this.configService.get<number>('EMAIL_PORT');
    const user = this.configService.get<string>('EMAIL_USER');
    const pass = this.configService.get<string>('EMAIL_PASS');
    this.fromAddress = this.configService.get<string>('EMAIL_FROM', 'no-reply@teahaven.local');

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('Email credentials not fully configured; email notifications will be logged.');
      this.transporter = null;
    }
  }

  private async send(options: nodemailer.SendMailOptions) {
    if (!this.transporter) {
      this.logger.log(`Email outbound skipped: ${options.subject}`);
      return;
    }

    await this.transporter.sendMail({
      from: this.fromAddress,
      ...options,
    });
  }

  async sendOrderConfirmation(order: OrderSummary) {
    const bodyLines = [
      `Hi ${order.customer.fullName},`,
      '',
      `Thank you for shopping at Tea Haven! Your order #${order.id} is now ${order.status.toLowerCase()}.`,
      '',
      'Items:',
      ...order.items.map(
        (item) =>
          `- ${item.summary.name} x${item.summary.quantity} @ $${item.summary.unitPrice.toFixed(2)}`,
      ),
      '',
      `Total: $${order.totalAmount.toFixed(2)}`,
      `Shipping to: ${order.shippingAddress}`,
      '',
      'We will update you as soon as your items ship.',
      '',
      'Best regards,',
      'Tea Haven Team',
    ];

    await this.send({
      to: order.customer.email,
      subject: `Tea Haven Order Confirmation #${order.id}`,
      text: bodyLines.join('\n'),
    });
  }

  async sendSellerNotification(order: OrderSummary) {
    const sellerGroups = new Map<string, { name: string; items: OrderItemSummary[] }>();

    order.items.forEach((item) => {
      const sellerEmail = item.product.seller.email;
      const sellerName = item.product.seller.fullName;
      const existing = sellerGroups.get(sellerEmail) ?? { name: sellerName, items: [] };
      existing.items.push(item.summary);
      sellerGroups.set(sellerEmail, existing);
    });

    await Promise.all(
      Array.from(sellerGroups.entries()).map(([email, detail]) =>
        this.send({
          to: email,
          subject: `New order #${order.id} from ${order.customer.fullName}`,
          text: [
            `Hello ${detail.name},`,
            '',
            `A new order (#${order.id}) includes your products.`,
            '',
            'Items:',
            ...detail.items.map(
              (item) => `- ${item.name} x${item.quantity} @ $${item.unitPrice.toFixed(2)}`,
            ),
            '',
            `Ship to: ${order.shippingAddress}`,
            '',
            'Please prepare the items for shipment.',
            '',
            'Tea Haven Platform',
          ].join('\n'),
        }),
      ),
    );
  }

  buildOrderSummary(
    order: Prisma.OrderGetPayload<{
      include: {
        customer: true;
        items: {
          include: {
            product: {
              include: {
                images: true;
                seller: true;
              };
            };
          };
        };
      };
    }>,
  ): OrderSummary {
    return {
      id: order.id,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      shippingAddress: order.shippingAddress,
      customer: {
        email: order.customer.email,
        fullName: order.customer.fullName,
      },
      items: order.items.map((item) => ({
        product: {
          seller: {
            email: item.product.seller.email,
            fullName: item.product.seller.fullName,
          },
        },
        summary: {
          name: item.product.name,
          quantity: item.quantity,
          unitPrice: Number(item.unitPrice),
        },
      })),
    };
  }
}
