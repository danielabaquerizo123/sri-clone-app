export class AccountingPersistenceService {
  async saveFromAtsLote(_params: { ruc: string; loteId: string; estado?: string }) {
    throw new Error("Persistencia contable productiva pendiente de migracion al modulo unificado.");
  }
}
