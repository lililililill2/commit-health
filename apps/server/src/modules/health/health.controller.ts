import { Controller, Get } from '@nestjs/common';

import { HealthService } from './health.service.js';
import { Public } from '../../auth/auth-context.js';

@Controller('health')
@Public()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  getHealth(): { status: 'ok'; service: 'commit-health-server' } {
    return this.healthService.getHealth();
  }
}
