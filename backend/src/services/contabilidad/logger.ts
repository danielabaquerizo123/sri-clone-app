import type { AccountingLogger } from "./interfaces";
import type { AccountingLogEntry } from "./types";

export class InMemoryAccountingLogger implements AccountingLogger {
  private readonly entries: AccountingLogEntry[] = [];

  info(entry: AccountingLogEntry): void {
    this.entries.push(entry);
  }

  error(entry: AccountingLogEntry): void {
    this.entries.push(entry);
  }

  list(): AccountingLogEntry[] {
    return [...this.entries];
  }
}
