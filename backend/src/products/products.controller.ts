import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join, relative } from 'node:path';
import { mkdirSync } from 'node:fs';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateStockDto } from './dto/update-stock.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

interface AuthenticatedRequest extends Request {
  user: {
    userId: number;
    role: Role;
  };
}

const PRODUCT_UPLOAD_DIR = join(process.cwd(), 'uploads', 'products');

function ensureUploadDir() {
  mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
}

function buildMulterOptions() {
  ensureUploadDir();
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, PRODUCT_UPLOAD_DIR);
      },
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${unique}${extname(file.originalname)}`);
      },
    }),
    fileFilter: (_req: Request, file: Express.Multer.File, cb: CallableFunction) => {
      if (!file.mimetype.startsWith('image/')) {
        cb(new BadRequestException('Only image uploads are allowed'), false);
        return;
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  };
}

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  async findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Get('seller/me')
  async listMyProducts(@Req() req: AuthenticatedRequest) {
    return this.productsService.listSellerProducts(req.user.userId);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Post()
  @UseInterceptors(FilesInterceptor('images', 5, buildMulterOptions()))
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const imagePaths = files.map((file) =>
      relative(process.cwd(), join(PRODUCT_UPLOAD_DIR, file.filename)).replace(/\\/g, '/'),
    );

    return this.productsService.create(req.user.userId, req.user.role, dto, imagePaths);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', 5, buildMulterOptions()))
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProductDto,
    @UploadedFiles() files: Express.Multer.File[] = [],
  ) {
    const imagePaths = files.map((file) =>
      relative(process.cwd(), join(PRODUCT_UPLOAD_DIR, file.filename)).replace(/\\/g, '/'),
    );

    return this.productsService.update(
      id,
      req.user.userId,
      req.user.role,
      dto,
      imagePaths,
    );
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Patch(':id/stock')
  async updateStock(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateStockDto,
  ) {
    return this.productsService.updateStock(id, req.user.userId, req.user.role, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SELLER)
  @Delete(':id')
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.productsService.remove(id, req.user.userId, req.user.role);
  }
}
