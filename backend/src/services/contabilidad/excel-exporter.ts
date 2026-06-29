import type { AccountingEngineResult } from "./types";

export class AccountingExcelExporter {
  prepare(_result: AccountingEngineResult): Buffer | null {
    return null;
  }
}
