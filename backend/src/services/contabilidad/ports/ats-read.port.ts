import type { AccountingDocument } from "../domain/accounting-document";

export type AtsReadPort = {
  readByLoteId(params: { ruc: string; loteId: string }): Promise<AccountingDocument[]>;
};
