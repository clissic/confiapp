import type { DisputesStatusDto } from './dto';
import { DisputesRepository } from './repository';

export class DisputesService {
  constructor(private readonly repository = new DisputesRepository()) {}

  async getStatus(): Promise<DisputesStatusDto> {
    void this.repository;
    return { module: 'disputes', status: 'ready' };
  }
}
