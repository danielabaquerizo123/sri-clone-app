import type { AccountCandidate } from "../domain/account-role";

export type AccountReadPort = {
  findActiveAccounts(): Promise<AccountCandidate[]>;
  findByIds(ids: string[]): Promise<AccountCandidate[]>;
};
