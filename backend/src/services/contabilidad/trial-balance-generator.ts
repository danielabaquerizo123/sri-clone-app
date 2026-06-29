import type { TrialBalanceGeneratorContract } from "./interfaces";
import type { LedgerAccount, TrialBalanceRow } from "./types";

export class TrialBalanceGenerator implements TrialBalanceGeneratorContract {
  generate(_ledger: LedgerAccount[]): TrialBalanceRow[] {
    return [];
  }
}
