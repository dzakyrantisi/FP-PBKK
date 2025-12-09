import { Controller, Post, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';

@Controller('upload')
export class UploadController {
  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('image'))
  uploadFile(@UploadedFile() file?: Express.Multer.File) {
    return {
      imagePath: file?.filename ?? null,
    };
  }
}
