import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth(): { status: 'ok'; service: 'commit-health-server' } {
    return { status: 'ok', service: 'commit-health-server' };
  }
}
