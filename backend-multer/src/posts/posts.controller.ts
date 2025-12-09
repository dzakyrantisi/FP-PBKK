import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Param,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtPayloadDto } from '../auth/dto/jwt-payload.dto';
import { handlePrismaError } from '../common/prisma-error.handler';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Body() createPostDto: CreatePostDto,
    @Request() req: { user: JwtPayloadDto },
  ) {
    try {
      return this.postsService.create(createPostDto, req.user.username);
    } catch (error) {
      handlePrismaError(error, 'create post');
    }
  }

  @Get()
  async findAll() {
    try {
      return this.postsService.findAll();
    } catch (error) {
      handlePrismaError(error, 'fetch posts');
    }
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    try {
      const post = await this.postsService.findOne(id);
      if (!post) {
        throw new HttpException('Post not found', HttpStatus.NOT_FOUND);
      }
      return post;
    } catch (error) {
      handlePrismaError(error, 'fetch post');
    }
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updatePostDto: UpdatePostDto,
    @Request() req: { user: JwtPayloadDto },
  ) {
    try {
      return this.postsService.update(id, updatePostDto, req.user.username);
    } catch (error) {
      handlePrismaError(error, 'update post');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Param('id') id: string,
    @Request() req: { user: JwtPayloadDto },
  ) {
    try {
      return this.postsService.remove(id, req.user.username);
    } catch (error) {
      handlePrismaError(error, 'delete post');
    }
  }
}
