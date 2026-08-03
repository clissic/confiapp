import type { HealthResponseDto } from './dto';
import { HealthRepository } from './repository';

export class HealthService {
  constructor(private readonly repository = new HealthRepository()) {}

  async getHealth(): Promise<HealthResponseDto> {
    await this.repository.ping();

    return {
      status: 'ok',
      service: 'confiapp-api',
    };
  }
}
