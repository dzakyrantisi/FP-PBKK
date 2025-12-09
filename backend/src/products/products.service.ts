import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaService } from '../prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

export interface SerializedProduct {
  id: number;
  name: string;
  description: string;
  price: number;
  category: string;
  stock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  sellerId: number;
  images: { id: number; url: string }[];
}

export function serializeProduct(
  product: Prisma.ProductGetPayload<{ include: { images: true } }>,
): SerializedProduct {
  return {
    id: product.id,
    name: product.name,
    description: product.description,
    price: Number(product.price),
    category: product.category,
    stock: product.stock,
    isActive: product.isActive,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
    sellerId: product.sellerId,
    images: product.images.map((image) => ({
      id: image.id,
      url: image.url,
    })),
  };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureSeller(role: Role) {
    if (role !== Role.SELLER) {
      throw new ForbiddenException('Seller role required');
    }
  }

  async create(
    sellerId: number,
    userRole: Role,
    dto: CreateProductDto,
    imagePaths: string[],
  ) {
    this.ensureSeller(userRole);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: new Prisma.Decimal(dto.price),
        category: dto.category,
        stock: dto.stock,
        isActive: dto.isActive ?? dto.stock > 0,
        sellerId,
        images: {
          create: imagePaths.map((url) => ({ url })),
        },
      },
      include: { images: true },
    });

    return serializeProduct(product);
  }

  async findAll(query: QueryProductsDto) {
    const { page = 1, limit = 12, search, category, minPrice, maxPrice } = query;
    const skip = (page - 1) * limit;
    const searchTerm = search?.trim().toLowerCase();
    const categoryFilter = category?.trim().toLowerCase();

    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { images: true },
    });

    const filtered = products.filter((product) => {
      const price = Number(product.price);
      const matchesSearch =
        !searchTerm ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm);
      const matchesCategory =
        !categoryFilter || product.category.toLowerCase() === categoryFilter;
      const matchesMin = minPrice === undefined || price >= minPrice;
      const matchesMax = maxPrice === undefined || price <= maxPrice;
      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    });

    const paginated = filtered.slice(skip, skip + limit);

    return {
      meta: {
        page,
        limit,
        total: filtered.length,
      },
      data: paginated.map((product) => serializeProduct(product)),
    };
  }

  async findOne(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { images: true, seller: { select: { id: true, fullName: true } } },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return {
      ...serializeProduct(product),
      seller: product.seller,
    };
  }

  private async assertOwnership(productId: number, sellerId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { sellerId: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (product.sellerId !== sellerId) {
      throw new ForbiddenException('You can only modify your own products');
    }
  }

  async update(
    productId: number,
    sellerId: number,
    userRole: Role,
    dto: UpdateProductDto,
    newImagePaths: string[],
  ) {
    this.ensureSeller(userRole);
    await this.assertOwnership(productId, sellerId);

    const data: Prisma.ProductUpdateInput = {
      ...dto,
    };

    if (dto.price !== undefined) {
      data.price = new Prisma.Decimal(dto.price);
    }

    if (dto.stock !== undefined) {
      data.stock = dto.stock;
      if (dto.stock === 0) {
        data.isActive = dto.isActive ?? false;
      }
    }

    if (newImagePaths.length > 0) {
      data.images = {
        create: newImagePaths.map((url) => ({ url })),
      };
    }

    if (dto.removeImageIds?.length) {
      const images = await this.prisma.productImage.findMany({
        where: { id: { in: dto.removeImageIds }, productId },
      });

      await Promise.all(
        images.map(async (image) => {
          try {
            await unlink(resolve(process.cwd(), image.url));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
              throw error;
            }
          }
        }),
      );

      if (dto.removeImageIds.length) {
        await this.prisma.productImage.deleteMany({
          where: { id: { in: dto.removeImageIds }, productId },
        });
      }
    }

    const product = await this.prisma.product.update({
      where: { id: productId },
      data,
      include: { images: true },
    });

    return serializeProduct(product);
  }

  async updateStock(
    productId: number,
    sellerId: number,
    userRole: Role,
    dto: UpdateStockDto,
  ) {
    this.ensureSeller(userRole);
    await this.assertOwnership(productId, sellerId);

    const product = await this.prisma.product.update({
      where: { id: productId },
      data: {
        stock: dto.stock,
        isActive: dto.stock > 0,
      },
      include: { images: true },
    });

    return serializeProduct(product);
  }

  async remove(productId: number, sellerId: number, userRole: Role) {
    this.ensureSeller(userRole);
    await this.assertOwnership(productId, sellerId);

    const product = await this.prisma.product.delete({
      where: { id: productId },
      include: { images: true },
    });

    await Promise.all(
      product.images.map(async (image) => {
        try {
          await unlink(resolve(process.cwd(), image.url));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            throw error;
          }
        }
      }),
    );

    return { message: 'Product deleted' };
  }

  async listSellerProducts(sellerId: number) {
    const products = await this.prisma.product.findMany({
      where: { sellerId },
      orderBy: { createdAt: 'desc' },
      include: { images: true },
    });

    return products.map((product) => serializeProduct(product));
  }
}
