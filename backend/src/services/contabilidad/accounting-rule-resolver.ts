import { prisma } from "../../lib/prisma";

export class AccountingRuleNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AccountingRuleNotFoundError";
  }
}

export type NormalizedAccountingRow = {
  tipoOperacion: "COMPRA" | "VENTA" | "GASTO";
  tipoComprobante?: string | null;
  codigoSustento?: string | null;
  tarifaIva?: number | null;
  formaPago?: string | null;
};

function sameOptional(ruleValue: unknown, rowValue: unknown) {
  if (ruleValue === null || ruleValue === undefined || ruleValue === "") return true;
  if (rowValue === null || rowValue === undefined || rowValue === "") return false;
  return String(ruleValue) === String(rowValue);
}

function sameTarifa(ruleValue: unknown, rowValue: unknown) {
  if (ruleValue === null || ruleValue === undefined) return true;
  if (rowValue === null || rowValue === undefined) return false;
  return Number(ruleValue).toFixed(2) === Number(rowValue).toFixed(2);
}

export class AccountingRuleResolver {
  async resolve(row: NormalizedAccountingRow) {
    const candidates = await prisma.reglaContable.findMany({
      where: {
        activa: true,
        tipoOperacion: row.tipoOperacion,
        OR: [{ tipoComprobante: row.tipoComprobante || null }, { tipoComprobante: null }],
      },
      include: {
        cuentaBase: true,
        cuentaIva: true,
        cuentaContrapartida: true,
      },
      orderBy: [{ prioridad: "asc" }, { codigo: "asc" }],
    });

    const rule = candidates.find(
      (candidate) =>
        sameOptional(candidate.tipoComprobante, row.tipoComprobante) &&
        sameOptional(candidate.codigoSustento, row.codigoSustento) &&
        sameOptional(candidate.formaPago, row.formaPago) &&
        sameTarifa(candidate.tarifaIva, row.tarifaIva)
    );

    if (!rule) {
      throw new AccountingRuleNotFoundError(
        `No existe regla contable activa para ${row.tipoOperacion} comprobante ${
          row.tipoComprobante || "SIN_TIPO"
        }.`
      );
    }

    return rule;
  }
}
