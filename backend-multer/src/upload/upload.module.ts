import { Module, BadRequestException } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { UploadController } from './upload.controller';
import { diskStorage } from 'multer';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';

const uploadDir = join(__dirname, '..', '..', 'uploads');

if (!existsSync(uploadDir)) {
  mkdirSync(uploadDir, { recursive: true });
}

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          cb(null, uploadDir);
        },
        filename: (_req, file, cb) => {
          let extension = extname(file.originalname).toLowerCase();
          if (!extension) {
            const mimeExt = file.mimetype.split('/').pop() ?? '';
            const sanitized = mimeExt.replace(/[^a-z0-9]/gi, '').toLowerCase();
            extension = sanitized ? `.${sanitized}` : '';
          }
          const filename = `image-${randomUUID()}${extension}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024,
      },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          cb(new BadRequestException('Only image files are allowed'), false);
          return;
        }
        cb(null, true);
      },
    }),
  ],
  controllers: [UploadController],
})
export class UploadModule {}
