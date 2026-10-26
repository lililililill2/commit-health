import {
  Controller,
  Get,
  type INestApplication,
  InternalServerErrorException,
  Post,
  Body,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import type { Server } from 'node:http';

import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/config/configure-app.js';
import { Public } from '../src/auth/auth-context.js';

class ProbeDto {
  @IsString()
  name!: string;
}

// Test-only routes exercise global validation and the default exception contract.
@Controller('_test')
@Public()
class ProbeController {
  @Post('validation')
  validate(@Body() body: ProbeDto): ProbeDto {
    return body;
  }

  @Get('error')
  error(): never {
    throw new InternalServerErrorException();
  }
}

describe('HTTP application (no database)', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ CORS_ORIGIN: 'http://localhost:3000' }))
      .compile();
    app = moduleRef.createNestApplication<INestApplication<Server>>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('returns the expected health payload under /api', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200).expect({
      status: 'ok',
      service: 'commit-health-server',
    });
  });

  it('does not expose an unprefixed health route', async () => {
    await request(app.getHttpServer()).get('/health').expect(404);
  });

  it('permits browser requests from the frontend origin', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'http://localhost:3000')
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect(200);
  });

  it('does not grant CORS access to another origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/health')
      .set('Origin', 'https://example.com')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('handles CORS preflight', async () => {
    await request(app.getHttpServer())
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET')
      .expect('Access-Control-Allow-Origin', 'http://localhost:3000')
      .expect(204);
  });

  it('accepts a valid DTO and rejects extra or invalid fields', async () => {
    await request(app.getHttpServer())
      .post('/api/_test/validation')
      .send({ name: 'test' })
      .expect(201)
      .expect({ name: 'test' });
    await request(app.getHttpServer())
      .post('/api/_test/validation')
      .send({ name: 'test', extra: true })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/_test/validation')
      .send({ name: 123 })
      .expect(400);
  });

  it('uses Nest HTTP exception responses', async () => {
    const response = await request(app.getHttpServer()).get('/api/_test/error').expect(500);
    expect(response.body).toMatchObject({ statusCode: 500, message: 'Internal Server Error' });
    expect(response.body).not.toHaveProperty('stack');
  });
});
