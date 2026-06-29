import type { AccountingDocumentKind } from "./types";

export type AccountDefinition = {
  code: string;
  name: string;
};

export type AccountingRuleDefinition = {
  id: string;
  documentKind: AccountingDocumentKind;
  baseAccount: AccountDefinition;
  ivaAccount: AccountDefinition;
  counterpartAccount: AccountDefinition;
  baseSide: "DEBE" | "HABER";
  ivaSide: "DEBE" | "HABER";
  counterpartSide: "DEBE" | "HABER";
  counterpartDescription: string;
};

const accounts = {
  bancos: { code: "1.01.01.03", name: "Bancos" },
  ivaCompras: { code: "1.01.05.01", name: "IVA Compras" },
  ivaVentas: { code: "2.01.07.01", name: "IVA Ventas" },
  gastosAdministrativos: { code: "5.02.02.29", name: "Gastos Administrativos" },
  ventasLocales: { code: "4.01.01.01", name: "Ventas Locales" },
};

export const accountingRuleMap: Partial<Record<AccountingDocumentKind, AccountingRuleDefinition>> = {
  COMPRA: {
    id: "COMPRA_FACTURA_BANCOS",
    documentKind: "COMPRA",
    baseAccount: accounts.gastosAdministrativos,
    ivaAccount: accounts.ivaCompras,
    counterpartAccount: accounts.bancos,
    baseSide: "DEBE",
    ivaSide: "DEBE",
    counterpartSide: "HABER",
    counterpartDescription: "Pago",
  },
  LIQUIDACION_COMPRA: {
    id: "LIQUIDACION_COMPRA_BANCOS",
    documentKind: "LIQUIDACION_COMPRA",
    baseAccount: accounts.gastosAdministrativos,
    ivaAccount: accounts.ivaCompras,
    counterpartAccount: accounts.bancos,
    baseSide: "DEBE",
    ivaSide: "DEBE",
    counterpartSide: "HABER",
    counterpartDescription: "Pago",
  },
  NOTA_DEBITO_COMPRA: {
    id: "NOTA_DEBITO_COMPRA_BANCOS",
    documentKind: "NOTA_DEBITO_COMPRA",
    baseAccount: accounts.gastosAdministrativos,
    ivaAccount: accounts.ivaCompras,
    counterpartAccount: accounts.bancos,
    baseSide: "DEBE",
    ivaSide: "DEBE",
    counterpartSide: "HABER",
    counterpartDescription: "Pago",
  },
  NOTA_CREDITO_COMPRA: {
    id: "NOTA_CREDITO_COMPRA_BANCOS",
    documentKind: "NOTA_CREDITO_COMPRA",
    baseAccount: accounts.gastosAdministrativos,
    ivaAccount: accounts.ivaCompras,
    counterpartAccount: accounts.bancos,
    baseSide: "HABER",
    ivaSide: "HABER",
    counterpartSide: "DEBE",
    counterpartDescription: "Reverso",
  },
  VENTA: {
    id: "VENTA_FACTURA_BANCOS",
    documentKind: "VENTA",
    baseAccount: accounts.ventasLocales,
    ivaAccount: accounts.ivaVentas,
    counterpartAccount: accounts.bancos,
    baseSide: "HABER",
    ivaSide: "HABER",
    counterpartSide: "DEBE",
    counterpartDescription: "Cobro",
  },
  NOTA_DEBITO_VENTA: {
    id: "NOTA_DEBITO_VENTA_BANCOS",
    documentKind: "NOTA_DEBITO_VENTA",
    baseAccount: accounts.ventasLocales,
    ivaAccount: accounts.ivaVentas,
    counterpartAccount: accounts.bancos,
    baseSide: "HABER",
    ivaSide: "HABER",
    counterpartSide: "DEBE",
    counterpartDescription: "Cobro",
  },
  NOTA_CREDITO_VENTA: {
    id: "NOTA_CREDITO_VENTA_BANCOS",
    documentKind: "NOTA_CREDITO_VENTA",
    baseAccount: accounts.ventasLocales,
    ivaAccount: accounts.ivaVentas,
    counterpartAccount: accounts.bancos,
    baseSide: "DEBE",
    ivaSide: "DEBE",
    counterpartSide: "HABER",
    counterpartDescription: "Reverso",
  },
};
