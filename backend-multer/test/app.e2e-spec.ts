/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

describe('Image Upload with Multer (e2e)', () => {
  let app: INestApplication<App>;
  let prismaService: PrismaService;
  let authToken: string;
  let testUsername: string;

  // Create a simple test image buffer (1x1 PNG)
  const createTestImageBuffer = () => {
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64',
    );
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    app.useGlobalPipes(new ValidationPipe());

    // Configure static assets (same as main.ts)
    (app as NestExpressApplication).useStaticAssets(
      join(__dirname, '..', 'uploads'),
      {
        prefix: '/uploads/',
      },
    );

    prismaService = app.get<PrismaService>(PrismaService);

    await app.init();
  });

  beforeEach(async () => {
    await prismaService.post.deleteMany();
    await prismaService.user.deleteMany();
    testUsername = `testuser_${Date.now()}`;

    // Create a user and get auth token for all tests
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        username: testUsername,
        password: 'password123',
      });

    authToken = registerResponse.body.access_token;
  });

  afterAll(async () => {
    await prismaService.post.deleteMany();
    await prismaService.user.deleteMany();
    await app.close();
  });

  describe('File Upload with Multer', () => {
    it('should upload an image with valid authentication', async () => {
      const response = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', createTestImageBuffer(), 'test.png')
        .expect(201);

      expect(response.body).toHaveProperty('imagePath');
      expect(typeof response.body.imagePath).toBe('string');
      expect(response.body.imagePath).toMatch(/^image-.*\.png$/);
    });

    it('should fail without authentication', async () => {
      await request(app.getHttpServer())
        .post('/upload')
        .attach('image', createTestImageBuffer(), 'test.png')
        .expect(401);
    });

    it('should return null imagePath when no file is provided', async () => {
      const response = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(201);

      expect(response.body).toHaveProperty('imagePath', null);
    });

    it('should accept different image file extensions', async () => {
      const extensions = [
        { ext: 'jpg', filename: 'test.jpg' },
        { ext: 'png', filename: 'test.png' },
        { ext: 'gif', filename: 'test.gif' },
        { ext: 'webp', filename: 'test.webp' },
      ];

      for (const { ext, filename } of extensions) {
        const response = await request(app.getHttpServer())
          .post('/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('image', createTestImageBuffer(), filename)
          .expect(201);

        expect(response.body.imagePath).toMatch(
          new RegExp(`^image-.*\\.${ext}$`),
        );
      }
    });

    it('should reject non-image files', async () => {
      const textBuffer = Buffer.from('Hello World');

      const response = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', textBuffer, 'test.txt')
        .expect(400);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Only image files are allowed');
    });

    it('should reject files larger than 5MB', async () => {
      // Create a buffer larger than 5MB
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024);

      const response = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', largeBuffer, 'large.png')
        .expect(413);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('File too large');
    });
  });

  describe('Posts with Image Upload', () => {
    let uploadedImagePath: string;

    beforeEach(async () => {
      // Upload an image first
      const uploadResponse = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', createTestImageBuffer(), 'test.png');

      uploadedImagePath = uploadResponse.body.imagePath;
    });

    it('should create a post with imagePath', async () => {
      const createPostDto = {
        content: 'Post with image',
        imagePath: uploadedImagePath,
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('content', 'Post with image');
      expect(response.body).toHaveProperty('imagePath', uploadedImagePath);
      expect(response.body).toHaveProperty('author');
      expect(response.body.author).toHaveProperty('username', testUsername);
      expect(response.body).toHaveProperty('id');
    });

    it('should create a post without imagePath', async () => {
      const createPostDto = {
        content: 'Post without image',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      expect(response.body).toHaveProperty('content', 'Post without image');
      expect(response.body.imagePath).toBeNull();
    });

    it('should retrieve posts with imagePath in list', async () => {
      // Create post with image
      await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with image',
          imagePath: uploadedImagePath,
        });

      // Get all posts
      const response = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0]).toHaveProperty('imagePath');
      expect(response.body[0].imagePath).toBe(uploadedImagePath);
    });

    it('should retrieve post with imagePath by id', async () => {
      // Create post with image
      const createResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with image',
          imagePath: uploadedImagePath,
        });

      const postId = createResponse.body.id;

      // Get specific post
      const response = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id', postId);
      expect(response.body).toHaveProperty('imagePath');
      expect(response.body.imagePath).toBe(uploadedImagePath);
    });

    it('should validate imagePath format', async () => {
      const createPostDto = {
        content: 'Post with custom imagePath',
        imagePath: 'custom-path.jpg',
      };

      const response = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send(createPostDto)
        .expect(201);

      // Any string is accepted as imagePath
      expect(response.body).toHaveProperty('imagePath', 'custom-path.jpg');
    });
  });

  describe('Image Upload Integration Flow', () => {
    it('should complete full image upload flow', async () => {
      // Step 1: Upload image
      const uploadResponse = await request(app.getHttpServer())
        .post('/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('image', createTestImageBuffer(), 'test.png')
        .expect(201);

      expect(uploadResponse.body).toHaveProperty('imagePath');
      const { imagePath } = uploadResponse.body;

      // Step 2: Create post with imagePath
      const createPostResponse = await request(app.getHttpServer())
        .post('/posts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          content: 'Post with uploaded image',
          imagePath: imagePath,
        })
        .expect(201);

      expect(createPostResponse.body).toHaveProperty('imagePath', imagePath);
      expect(createPostResponse.body).toHaveProperty(
        'content',
        'Post with uploaded image',
      );

      // Step 3: Retrieve post and verify imagePath
      const postId = createPostResponse.body.id;
      const getPostResponse = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(getPostResponse.body).toHaveProperty('imagePath', imagePath);

      // Step 4: Verify in posts list
      const getPostsResponse = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      const post = getPostsResponse.body.find((p: any) => p.id === postId);
      expect(post).toBeDefined();
      expect(post.imagePath).toBe(imagePath);

      // Step 5: Verify image is accessible via static route
      const imageResponse = await request(app.getHttpServer())
        .get(`/uploads/${imagePath}`)
        .expect(200);

      expect(imageResponse.headers['content-type']).toContain('image');
    });
  });

  describe('Multiple Image Formats', () => {
    it('should handle different image formats', async () => {
      const formats = [
        { extension: 'jpg', filename: 'test.jpg' },
        { extension: 'png', filename: 'test.png' },
        { extension: 'gif', filename: 'test.gif' },
        { extension: 'webp', filename: 'test.webp' },
      ];

      for (const format of formats) {
        // Upload image
        const uploadResponse = await request(app.getHttpServer())
          .post('/upload')
          .set('Authorization', `Bearer ${authToken}`)
          .attach('image', createTestImageBuffer(), format.filename)
          .expect(201);

        const { imagePath } = uploadResponse.body;

        // Create post with this image
        const postResponse = await request(app.getHttpServer())
          .post('/posts')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            content: `Post with ${format.extension} image`,
            imagePath: imagePath,
          })
          .expect(201);

        expect(postResponse.body.imagePath).toMatch(
          new RegExp(`^image-.*\\.${format.extension}$`),
        );
      }
    });
  });
});
