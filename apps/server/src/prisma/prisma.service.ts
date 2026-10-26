import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private instance?: PrismaClient;

  constructor(private readonly config: ConfigService) {}

  get client(): PrismaClient {
    if (!this.instance) {
      const connectionString = this.config.getOrThrow<string>('DATABASE_URL');
      this.instance = new PrismaClient({
        adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 }),
      });
    }
    return this.instance;
  }

  async onModuleDestroy(): Promise<void> {
    await this.instance?.$disconnect();
  }
}
