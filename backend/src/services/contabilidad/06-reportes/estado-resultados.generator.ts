import type { IncomeStatementGeneratorContract } from "../contratos";
import type { IncomeStatementRow, TrialBalanceRow } from "../contratos";

export class IncomeStatementGenerator implements IncomeStatementGeneratorContract {
  generate(_trialBalance: TrialBalanceRow[]): IncomeStatementRow[] {
    return [];
  }
}
