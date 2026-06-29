import { absMoney, addMoney, formatMoney, isZero, moneyFrom } from "./decimal";
import type { AccountingRulesEngineContract } from "./interfaces";
import { accountingRuleMap } from "./accounting-rule-map";
import type {
  AccountingDocumentAnalysis,
  AccountingRuleLine,
  AccountingRuleResult,
} from "./types";

function lineDescription(prefix: string, document: AccountingDocumentAnalysis): string {
  return `${prefix} ${document.numeroDocumento}`.trim();
}

function buildLine(
  accountCode: string,
  accountName: string,
  side: "DEBE" | "HABER",
  amount: string,
  description: string
): AccountingRuleLine | null {
  const money = absMoney(moneyFrom(amount));

  if (isZero(money)) {
    return null;
  }

  return {
    accountCode,
    accountName,
    side,
    amount: formatMoney(money),
    description,
  };
}

export class AccountingRules implements AccountingRulesEngineContract {
  resolve(documents: AccountingDocumentAnalysis[]): AccountingRuleResult[] {
    return documents.flatMap((document) => {
      const rule = accountingRuleMap[document.kind];

      if (!rule) {
        return [];
      }

      const base = absMoney(moneyFrom(document.base));
      const iva = absMoney(moneyFrom(document.iva));
      const total = absMoney(
        isZero(moneyFrom(document.total))
          ? addMoney([base, iva])
          : moneyFrom(document.total)
      );
      const lines = [
        buildLine(
          rule.baseAccount.code,
          rule.baseAccount.name,
          rule.baseSide,
          formatMoney(base),
          lineDescription(document.source === "COMPRA" ? "Factura" : "Venta", document)
        ),
        buildLine(
          rule.ivaAccount.code,
          rule.ivaAccount.name,
          rule.ivaSide,
          formatMoney(iva),
          lineDescription("IVA", document)
        ),
        buildLine(
          rule.counterpartAccount.code,
          rule.counterpartAccount.name,
          rule.counterpartSide,
          formatMoney(total),
          lineDescription(rule.counterpartDescription, document)
        ),
      ].filter((line): line is AccountingRuleLine => Boolean(line));

      return {
        ruleId: rule.id,
        description: lineDescription(document.source === "COMPRA" ? "Factura" : "Venta", document),
        document,
        lines,
      };
    });
  }

  listEnabledRules(): string[] {
    return Object.values(accountingRuleMap)
      .filter(Boolean)
      .map((rule) => rule.id);
  }
}
