import { EvidenceModel } from '../../database/models';

export class EvidenceRepository {
  async findById(id: string) {
    return EvidenceModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async listByTransaction(transactionId: string) {
    return EvidenceModel.find({ transaction: transactionId, deletedAt: null }).exec();
  }
}
