import type { AccountingClassification } from "../domain/accounting-classification";
import type { AccountingDocument } from "../domain/accounting-document";

export type ClassificationRulePort = {
  classify(document: AccountingDocument): AccountingClassification;
};
