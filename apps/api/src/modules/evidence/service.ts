import type { EvidenceStatusDto } from './dto';
import { EvidenceRepository } from './repository';

export class EvidenceService {
  constructor(private readonly repository = new EvidenceRepository()) {}

  async getStatus(): Promise<EvidenceStatusDto> {
    void this.repository;
    return { module: 'evidence', status: 'ready' };
  }
}
