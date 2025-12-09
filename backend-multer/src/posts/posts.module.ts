import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PrismaService } from '../prisma.service';

@Module({
  imports: [],
  controllers: [PostsController],
  providers: [PostsService, PrismaService],
})
export class PostsModule {}
