import type {
  AccountingAtsInput,
  AccountingEngineResult,
  AccountingLogEntry,
  IncomeStatementRow,
  JournalEntry,
  LedgerAccount,
  TrialBalanceRow,
} from "./types";

export interface AccountingLogger {
  info(entry: AccountingLogEntry): void;
  error(entry: AccountingLogEntry): void;
  list(): AccountingLogEntry[];
}

export interface AtsAdapterContract {
  adapt(): AccountingAtsInput;
}

export interface JournalGeneratorContract {
  generate(input: AccountingAtsInput): JournalEntry[];
}

export interface LedgerGeneratorContract {
  generate(journal: JournalEntry[]): LedgerAccount[];
}

export interface TrialBalanceGeneratorContract {
  generate(ledger: LedgerAccount[]): TrialBalanceRow[];
}

export interface IncomeStatementGeneratorContract {
  generate(trialBalance: TrialBalanceRow[]): IncomeStatementRow[];
}

export interface AccountingEngineContract {
  process(buffer: Buffer, originalFilename: string): AccountingEngineResult;
}
