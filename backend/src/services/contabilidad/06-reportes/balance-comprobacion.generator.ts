import type { TrialBalanceGeneratorContract } from "../contratos";
import type { LedgerAccount, TrialBalanceRow } from "../contratos";

export class TrialBalanceGenerator implements TrialBalanceGeneratorContract {
  generate(_ledger: LedgerAccount[]): TrialBalanceRow[] {
    return [];
  }
}
