/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// @ts-nocheck
/// <reference types="jest" />
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrderStatus, Prisma, Role } from '@prisma/client';
import request from 'supertest';
import { PrismockClient } from 'prismock';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/email/email.service';
import { PrismaService } from '../src/prisma.service';
import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    email: string;
    role: Role;
    fullName: string;
  };
}

describe('Tea Haven Platform (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let emailService: EmailService;
  let moduleFixture: TestingModule;

  const uploadsRoot = join(process.cwd(), 'uploads');
  const productsUploadDir = join(uploadsRoot, 'products');
  const nativeStructuredClone = globalThis.structuredClone?.bind(globalThis);

  const fallbackClone = (value: unknown): unknown => {
    if (value instanceof Prisma.Decimal) {
      return new Prisma.Decimal(value.toString());
    }
    if (value instanceof Date) {
      return new Date(value.getTime());
    }
    if (Array.isArray(value)) {
      return value.map((item) => fallbackClone(item));
    }
    if (value && typeof value === 'object') {
      const entries = Object.entries(value as Record<string, unknown>);
      return entries.reduce<Record<string, unknown>>((accumulator, [key, val]) => {
        accumulator[key] = fallbackClone(val);
        return accumulator;
      }, {});
    }
    return value;
  };

  globalThis.structuredClone = ((input: unknown) => {
    if (nativeStructuredClone) {
      try {
        return nativeStructuredClone(input);
      } catch {
        return fallbackClone(input);
      }
    }
    return fallbackClone(input);
  }) as typeof structuredClone;

  const getServer = () => app.getHttpServer();

  const registerUser = async (overrides: Partial<{ role: Role; email: string; password: string; fullName: string }> = {}) => {
    const payload = {
      email: overrides.email ?? `user+${Math.random().toString(16).slice(2)}@teahaven.dev`,
      password: overrides.password ?? 'Sup3rSecret!',
      fullName: overrides.fullName ?? 'Test User',
      role: overrides.role ?? Role.CUSTOMER,
    };

    const response = await request(getServer())
      .post('/auth/register')
      .send(payload)
      .expect(201);

    return response.body as AuthResponse;
  };

  const loginUser = async (email: string, password: string) => {
    const response = await request(getServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    return response.body as AuthResponse;
  };

  const createProduct = (
    token: string,
    overrides: Partial<{
      name: string;
      description: string;
      price: number;
      category: string;
      stock: number;
      isActive: boolean;
      imageCount: number;
      attachInvalidMime: boolean;
    }> = {},
  ) => {
    const req = request(getServer())
      .post('/products')
      .set('Authorization', `Bearer ${token}`)
      .field('name', overrides.name ?? 'Jasmine Green Tea')
      .field('description', overrides.description ?? 'Organic jasmine scented green tea leaves')
      .field('price', `${overrides.price ?? 12.5}`)
      .field('category', overrides.category ?? 'Tea')
      .field('stock', `${overrides.stock ?? 50}`);

    if (overrides.isActive !== undefined) {
      req.field('isActive', String(overrides.isActive));
    }

    const imageTotal = overrides.imageCount ?? 1;
    for (let i = 0; i < imageTotal; i += 1) {
      const filename = `product-${i + 1}.jpg`;
      req.attach(
        'images',
        Buffer.from(`fake image content ${i}`),
        {
          filename: overrides.attachInvalidMime ? `invalid-${i + 1}.txt` : filename,
          contentType: overrides.attachInvalidMime ? 'text/plain' : 'image/jpeg',
        },
      );
    }

    return req;
  };

  const truncateDatabase = async () => {
    const clientWithReset = prisma as unknown as { reset?: () => void };
    if (typeof clientWithReset.reset === 'function') {
      clientWithReset.reset();
      return;
    }

    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.productImage.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
  };

  beforeAll(async () => {
    prisma = new PrismockClient() as unknown as PrismaService;
    moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );

    await app.init();

    emailService = app.get(EmailService);
    jest.spyOn(emailService, 'sendOrderConfirmation').mockResolvedValue();
    jest.spyOn(emailService, 'sendSellerNotification').mockResolvedValue();
  });

  beforeEach(async () => {
    await truncateDatabase();
    await rm(uploadsRoot, { recursive: true, force: true });
    await mkdir(productsUploadDir, { recursive: true });
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    await rm(uploadsRoot, { recursive: true, force: true });
  });

  describe('Authentication & Authorization', () => {
    it('registers users with hashed passwords and rejects duplicates', async () => {
      const initial = await registerUser({ email: 'customer@teahaven.dev', role: Role.CUSTOMER });
      expect(initial.user.email).toBe('customer@teahaven.dev');
      expect(initial.access_token).toBeDefined();
      expect(initial.refresh_token).toBeDefined();

      await request(getServer())
        .post('/auth/register')
        .send({
          email: 'customer@teahaven.dev',
          password: 'Sup3rSecret!',
          fullName: 'Duplicate User',
          role: Role.CUSTOMER,
        })
        .expect(409);

      const storedUser = await prisma.user.findUnique({
        where: { email: 'customer@teahaven.dev' },
      });
      expect(storedUser).not.toBeNull();
      expect(storedUser?.password).not.toBe('Sup3rSecret!');
    });

    it('logs in existing users and denies invalid credentials', async () => {
      const registration = await registerUser({ email: 'seller@teahaven.dev', role: Role.SELLER });
      expect(registration.user.role).toBe(Role.SELLER);

      const login = await loginUser('seller@teahaven.dev', 'Sup3rSecret!');
      expect(login.access_token).toBeDefined();
      expect(login.user.email).toBe('seller@teahaven.dev');

      await request(getServer())
        .post('/auth/login')
        .send({ email: 'seller@teahaven.dev', password: 'wrong-password' })
        .expect(401);
    });

    it('refreshes tokens using a stored refresh token', async () => {
      const registration = await registerUser();
      const refreshResponse = await request(getServer())
        .post('/auth/refresh')
        .send({ refreshToken: registration.refresh_token })
        .expect(201);

      expect(refreshResponse.body.access_token).toBeDefined();
      expect(refreshResponse.body.refresh_token).toBeDefined();
      expect(refreshResponse.body.refresh_token).not.toBe(registration.refresh_token);
    });

    it('enforces JWT protection and role-based access', async () => {
      await registerUser({ email: 'protected@teahaven.dev' });

      await request(getServer())
        .get('/auth/profile')
        .expect(401);

      const { access_token } = await loginUser('protected@teahaven.dev', 'Sup3rSecret!');
      const profile = await request(getServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${access_token}`)
        .expect(200);

      expect(profile.body.email).toBe('protected@teahaven.dev');

      const customer = await registerUser({ role: Role.CUSTOMER, email: 'customer-role@teahaven.dev' });
      await request(getServer())
        .post('/products')
        .set('Authorization', `Bearer ${customer.access_token}`)
        .field('name', 'Forbidden Product')
        .field('description', 'Attempt from customer')
        .field('price', '20')
        .field('category', 'Tea')
        .field('stock', '5')
        .expect(403);
    });
  });

  describe('Product Management', () => {
    it('allows sellers to upload products with images and list their catalogue', async () => {
      const seller = await registerUser({ role: Role.SELLER, email: 'seller@products.dev' });

      const response = await createProduct(seller.access_token, { imageCount: 2 }).expect(201);
      expect(response.body.name).toBe('Jasmine Green Tea');
      expect(response.body.images).toHaveLength(2);
      expect(response.body.sellerId).toBe(seller.user.id);

      const listMine = await request(getServer())
        .get('/products/seller/me')
        .set('Authorization', `Bearer ${seller.access_token}`)
        .expect(200);

      expect(Array.isArray(listMine.body)).toBe(true);
      expect(listMine.body).toHaveLength(1);
      expect(listMine.body[0].images).toHaveLength(2);
    });

    it('rejects non-image uploads when creating a product', async () => {
      const seller = await registerUser({ role: Role.SELLER });

      await createProduct(seller.access_token, { attachInvalidMime: true }).expect(400);
    });

    it('supports public catalog search, filtering, and pagination', async () => {
      const seller = await registerUser({ role: Role.SELLER, email: 'inventory@teahaven.dev' });

      await createProduct(seller.access_token, {
        name: 'Genmaicha',
        category: 'Green',
        price: 8,
      }).expect(201);

      await createProduct(seller.access_token, {
        name: 'Assam Black Tea',
        category: 'Black',
        price: 6,
      }).expect(201);

      await createProduct(seller.access_token, {
        name: 'Matcha Deluxe',
        category: 'Green',
        price: 18,
      }).expect(201);

      const search = await request(getServer())
        .get('/products')
        .query({ search: 'Tea', category: 'Green', minPrice: 7, maxPrice: 20, limit: 2 })
        .expect(200);

      expect(search.body.meta.total).toBeGreaterThanOrEqual(2);
      expect(search.body.data.every((p: any) => p.category.toLowerCase() === 'green')).toBe(true);

      const secondPage = await request(getServer())
        .get('/products')
        .query({ page: 2, limit: 2 })
        .expect(200);

      expect(secondPage.body.meta.page).toBe(2);
    });

    it('allows sellers to update product details, images, and stock status', async () => {
      const seller = await registerUser({ role: Role.SELLER, email: 'update@teahaven.dev' });
      const created = await createProduct(seller.access_token, { imageCount: 1 }).expect(201);
      const productId = created.body.id;
      const initialImageId = created.body.images[0].id;

      const updateResponse = await request(getServer())
        .patch(`/products/${productId}`)
        .set('Authorization', `Bearer ${seller.access_token}`)
        .field('price', '15.75')
        .field('description', 'Updated description')
        .field('removeImageIds[0]', `${initialImageId}`)
        .attach('images', Buffer.from('replacement image'), 'replacement.jpg')
        .expect(200);

      expect(updateResponse.body.price).toBe(15.75);
      expect(updateResponse.body.description).toBe('Updated description');
      expect(updateResponse.body.images).toHaveLength(1);

      const stockUpdate = await request(getServer())
        .patch(`/products/${productId}/stock`)
        .set('Authorization', `Bearer ${seller.access_token}`)
        .send({ stock: 0 })
        .expect(200);

      expect(stockUpdate.body.stock).toBe(0);
      expect(stockUpdate.body.isActive).toBe(false);

      await request(getServer())
        .delete(`/products/${productId}`)
        .set('Authorization', `Bearer ${seller.access_token}`)
        .expect(200);

      const remainingProducts = await prisma.product.count();
      expect(remainingProducts).toBe(0);
    });
  });

  describe('Order Workflows & Notifications', () => {
    const seedSellerWithProducts = async () => {
      const seller = await registerUser({ role: Role.SELLER, email: 'orders@sellers.dev' });
      const productA = await createProduct(seller.access_token, {
        name: 'Hojicha Roasted Tea',
        price: 9.5,
        stock: 25,
      }).expect(201);

      const productB = await createProduct(seller.access_token, {
        name: 'Sencha Spring Harvest',
        price: 7.25,
        stock: 40,
      }).expect(201);

      return {
        seller,
        productA: productA.body,
        productB: productB.body,
      };
    };

    it('lets customers place orders, updates inventory, and triggers emails', async () => {
      const { seller, productA, productB } = await seedSellerWithProducts();
      const customer = await registerUser({ role: Role.CUSTOMER, email: 'shopper@teahaven.dev' });

      const orderResponse = await request(getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customer.access_token}`)
        .send({
          shippingAddress: '123 Tea Lane, Kyoto',
          items: [
            { productId: productA.id, quantity: 2 },
            { productId: productB.id, quantity: 3 },
          ],
        })
        .expect(201);

      expect(orderResponse.body.items).toHaveLength(2);
      expect(orderResponse.body.totalAmount).toBeGreaterThan(0);

      const updatedProductA = await prisma.product.findUniqueOrThrow({ where: { id: productA.id } });
      const updatedProductB = await prisma.product.findUniqueOrThrow({ where: { id: productB.id } });

      expect(updatedProductA.stock).toBe(23);
      expect(updatedProductB.stock).toBe(37);

      expect(emailService.sendOrderConfirmation).toHaveBeenCalledTimes(1);
      expect(emailService.sendSellerNotification).toHaveBeenCalledTimes(1);

      const customerOrders = await request(getServer())
        .get('/orders/me')
        .set('Authorization', `Bearer ${customer.access_token}`)
        .expect(200);
      expect(customerOrders.body).toHaveLength(1);

      const sellerOrders = await request(getServer())
        .get('/orders/seller')
        .set('Authorization', `Bearer ${seller.access_token}`)
        .expect(200);

      expect(sellerOrders.body).toHaveLength(1);
      expect(sellerOrders.body[0].items[0].product.sellerId).toBe(seller.user.id);
    });

    it('prevents sellers from placing orders and enforces authentication', async () => {
      const { seller, productA } = await seedSellerWithProducts();

      await request(getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${seller.access_token}`)
        .send({
          shippingAddress: 'Seller address',
          items: [{ productId: productA.id, quantity: 1 }],
        })
        .expect(403);

      await request(getServer())
        .get('/orders/me')
        .expect(401);
    });

    it('allows sellers to update order status while blocking customers', async () => {
      const { seller, productA } = await seedSellerWithProducts();
      const customer = await registerUser({ role: Role.CUSTOMER, email: 'status@teahaven.dev' });

      const orderResponse = await request(getServer())
        .post('/orders')
        .set('Authorization', `Bearer ${customer.access_token}`)
        .send({
          shippingAddress: '456 Tea Garden',
          items: [{ productId: productA.id, quantity: 1 }],
        })
        .expect(201);

      const orderId = orderResponse.body.id;

      await request(getServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${customer.access_token}`)
        .send({ status: OrderStatus.PROCESSING })
        .expect(403);

      const statusResponse = await request(getServer())
        .patch(`/orders/${orderId}/status`)
        .set('Authorization', `Bearer ${seller.access_token}`)
        .send({ status: OrderStatus.SHIPPED })
        .expect(200);

      expect(statusResponse.body.status).toBe(OrderStatus.SHIPPED);
    });
  });
});
