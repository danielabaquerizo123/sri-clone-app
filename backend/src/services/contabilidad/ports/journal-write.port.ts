import type { JournalEntry } from "../domain/journal-entry";

export type JournalWritePort = {
  save(entries: JournalEntry[]): Promise<{ persistidos: number; asientos: unknown[] }>;
};
