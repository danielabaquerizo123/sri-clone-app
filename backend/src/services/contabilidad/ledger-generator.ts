import type { LedgerGeneratorContract } from "./interfaces";
import type { JournalEntry, LedgerAccount } from "./types";

export class LedgerGenerator implements LedgerGeneratorContract {
  generate(_journal: JournalEntry[]): LedgerAccount[] {
    return [];
  }
}
