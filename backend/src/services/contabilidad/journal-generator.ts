import type { JournalGeneratorContract } from "./interfaces";
import type { AccountingAtsInput, JournalEntry } from "./types";

export class JournalGenerator implements JournalGeneratorContract {
  generate(_input: AccountingAtsInput): JournalEntry[] {
    return [];
  }
}
