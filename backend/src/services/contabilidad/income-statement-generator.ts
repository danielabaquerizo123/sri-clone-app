import type { IncomeStatementGeneratorContract } from "./interfaces";
import type { IncomeStatementRow, TrialBalanceRow } from "./types";

export class IncomeStatementGenerator implements IncomeStatementGeneratorContract {
  generate(_trialBalance: TrialBalanceRow[]): IncomeStatementRow[] {
    return [];
  }
}
