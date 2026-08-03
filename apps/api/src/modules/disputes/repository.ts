import { DisputeModel } from '../../database/models';

export class DisputesRepository {
  async findById(id: string) {
    return DisputeModel.findOne({ _id: id, deletedAt: null }).exec();
  }

  async listByTransaction(transactionId: string) {
    return DisputeModel.find({ transaction: transactionId, deletedAt: null }).exec();
  }
}
