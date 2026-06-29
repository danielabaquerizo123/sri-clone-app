import type {
  AccountingAtsInput,
  AccountingDocumentAnalysis,
  AccountingRuleResult,
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
  generate(ruleResults: AccountingRuleResult[]): JournalEntry[];
}

export interface DocumentAnalyzerContract {
  analyze(input: AccountingAtsInput): AccountingDocumentAnalysis[];
}

export interface AccountingRulesEngineContract {
  resolve(documents: AccountingDocumentAnalysis[]): AccountingRuleResult[];
}

export interface AccountingJournalValidatorContract {
  validate(entry: JournalEntry): string[];
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
