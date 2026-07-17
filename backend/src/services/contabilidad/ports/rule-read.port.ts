import type { AccountCandidate } from "../domain/account-role";

export type AccountingRuleAccountHint = {
  id?: string;
  codigo: string;
  descripcion: string;
  tipoOperacion: "COMPRA" | "VENTA" | "GASTO" | string;
  tipoComprobante?: string | null;
  codigoSustento?: string | null;
  tarifaIva?: number | string | null;
  formaPago?: string | null;
  cuentaBase?: AccountCandidate | null;
  cuentaIva?: AccountCandidate | null;
  cuentaContrapartida?: AccountCandidate | null;
};

export type RuleReadPort = {
  findActiveRules(): Promise<AccountingRuleAccountHint[]>;
};
