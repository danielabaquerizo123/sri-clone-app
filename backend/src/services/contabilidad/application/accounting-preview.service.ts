import type { JournalPreviewResult } from "../domain/journal-preview";

export class AccountingPreviewService {
  async buildFromAtsLote(_ruc: string, _loteId: string): Promise<JournalPreviewResult> {
    throw new Error("Preview contable productivo pendiente de migracion al modulo unificado.");
  }
}
