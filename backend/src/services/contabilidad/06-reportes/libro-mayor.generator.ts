import type { LedgerGeneratorContract } from "../contratos";
import type { JournalEntry, LedgerAccount } from "../contratos";

export class LedgerGenerator implements LedgerGeneratorContract {
  generate(_journal: JournalEntry[]): LedgerAccount[] {
    return [];
  }
}
